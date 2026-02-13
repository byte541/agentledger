/**
 * AgentLedger — Core SDK
 *
 * Logs AI agent decisions as immutable audit trails on Solana
 * using the Solana Memo program (SPL Memo v2).
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  ConfirmOptions,
  ParsedTransactionWithMeta,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  AgentLedgerConfig,
  LogOptions,
  LogResult,
  MemoPayload,
  QueryOptions,
  LogEntry,
  VerifyResult,
  Network,
} from "./types";

/** SPL Memo program ID (v2) */
const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

const EXPLORER_BASE: Record<Network, string> = {
  devnet: "https://explorer.solana.com/tx",
  "mainnet-beta": "https://explorer.solana.com/tx",
};

const CLUSTER_PARAM: Record<Network, string> = {
  devnet: "?cluster=devnet",
  "mainnet-beta": "",
};

export class AgentLedger {
  private connection: Connection;
  private keypair: Keypair;
  private agentId: string;
  private network: Network;
  private heliusApiKey?: string;
  private heliusBaseUrl?: string;

  constructor(config: AgentLedgerConfig) {
    this.agentId = config.agentId;
    this.network = config.network ?? "devnet";
    this.heliusApiKey = config.heliusApiKey;

    // Build connection — prefer Helius RPC if key is provided
    let rpcUrl = config.rpcUrl;
    if (config.heliusApiKey) {
      const cluster =
        this.network === "mainnet-beta" ? "mainnet" : "devnet";
      this.heliusBaseUrl = `https://${cluster}.helius-rpc.com`;
      rpcUrl = `${this.heliusBaseUrl}/?api-key=${config.heliusApiKey}`;
    }

    this.connection = new Connection(rpcUrl, "confirmed");

    // Support both 32-byte seeds and 64-byte keypair bytes
    if (config.privateKey.length === 64) {
      this.keypair = Keypair.fromSecretKey(config.privateKey);
    } else if (config.privateKey.length === 32) {
      this.keypair = Keypair.fromSeed(config.privateKey);
    } else {
      throw new Error(
        `Invalid private key length: ${config.privateKey.length} (expected 32 or 64)`
      );
    }
  }

  /**
   * Returns the public key (wallet address) of the agent's signing keypair.
   */
  get walletAddress(): string {
    return this.keypair.publicKey.toBase58();
  }

  /**
   * Returns the active Solana connection.
   */
  get rpcConnection(): Connection {
    return this.connection;
  }

  /**
   * Checks the agent wallet's SOL balance.
   */
  async getBalance(): Promise<number> {
    const lamports = await this.connection.getBalance(this.keypair.publicKey);
    return lamports / LAMPORTS_PER_SOL;
  }

  /**
   * Requests an airdrop on devnet (useful for testing).
   * Throws on mainnet.
   *
   * Falls back to the official Solana devnet RPC if the primary connection
   * (e.g. Helius) has airdrop rate limits.
   */
  async requestAirdrop(solAmount = 0.5): Promise<string> {
    if (this.network !== "devnet") {
      throw new Error("Airdrop only available on devnet");
    }

    const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);

    // Try primary connection first
    try {
      const sig = await this.connection.requestAirdrop(
        this.keypair.publicKey,
        lamports
      );
      await this.connection.confirmTransaction(sig);
      return sig;
    } catch (err) {
      const msg = (err as Error).message ?? "";
      // If it's a rate-limit error from Helius, fall back to public devnet RPC
      if (this.heliusApiKey && msg.includes("Rate limit")) {
        const fallback = new Connection(
          "https://api.devnet.solana.com",
          "confirmed"
        );
        const sig = await fallback.requestAirdrop(
          this.keypair.publicKey,
          lamports
        );
        await fallback.confirmTransaction(sig);
        return sig;
      }
      throw err;
    }
  }

  /**
   * Logs an agent action as an immutable memo on Solana.
   *
   * @param action  Short label for the action (e.g. "decision:buy", "tool:search")
   * @param options Optional metadata and additional signers
   */
  async log(action: string, options: LogOptions = {}): Promise<LogResult> {
    const payload: MemoPayload = {
      v: "1",
      agent: this.agentId,
      action,
      ts: Math.floor(Date.now() / 1000),
    };

    if (options.data && Object.keys(options.data).length > 0) {
      payload.data = options.data;
    }

    const memoText = JSON.stringify(payload);

    if (Buffer.byteLength(memoText, "utf8") > 566) {
      throw new Error(
        `Memo payload exceeds 566-byte limit (${Buffer.byteLength(memoText, "utf8")} bytes). ` +
          "Reduce data size or summarise metadata."
      );
    }

    const instruction = new TransactionInstruction({
      keys: [
        {
          pubkey: this.keypair.publicKey,
          isSigner: true,
          isWritable: false,
        },
      ],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memoText, "utf8"),
    });

    const transaction = new Transaction().add(instruction);

    const confirmOptions: ConfirmOptions = {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    };

    const signers = [this.keypair];
    if (options.additionalSigners) {
      for (const sk of options.additionalSigners) {
        signers.push(
          sk.length === 64 ? Keypair.fromSecretKey(sk) : Keypair.fromSeed(sk)
        );
      }
    }

    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      signers,
      confirmOptions
    );

    // Fetch slot
    const txInfo = await this.connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    const slot = txInfo?.slot ?? 0;

    return {
      signature,
      explorerUrl: this.explorerUrl(signature),
      slot,
      timestamp: Date.now(),
      memo: payload,
    };
  }

  /**
   * Queries on-chain log entries for a given wallet address.
   * Uses Helius enhanced API when an API key is configured, otherwise falls
   * back to standard `getSignaturesForAddress` + `getParsedTransaction`.
   *
   * @param wallet  Public key of the wallet to query
   * @param options Filtering options
   */
  async query(
    wallet: string | PublicKey,
    options: QueryOptions = {}
  ): Promise<LogEntry[]> {
    const pubkey =
      typeof wallet === "string" ? new PublicKey(wallet) : wallet;

    const limit = options.limit ?? 50;
    const entries: LogEntry[] = [];

    if (this.heliusApiKey) {
      return this.queryViaHelius(pubkey, options);
    }

    // Standard RPC path
    const signatures = await this.connection.getSignaturesForAddress(pubkey, {
      limit: Math.min(limit * 4, 1000), // fetch extra to allow for filtering
    });

    for (const sigInfo of signatures) {
      if (entries.length >= limit) break;

      if (sigInfo.err) continue;

      const blockTime = sigInfo.blockTime ?? 0;
      if (options.after && blockTime < options.after) continue;
      if (options.before && blockTime > options.before) continue;

      try {
        const tx = await this.connection.getParsedTransaction(
          sigInfo.signature,
          {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          }
        );

        const memo = this.extractMemoFromParsedTx(tx);
        if (!memo) continue;
        if (!this.matchesMemoFilters(memo, options)) continue;

        entries.push({
          signature: sigInfo.signature,
          blockTime,
          slot: sigInfo.slot,
          memo,
          explorerUrl: this.explorerUrl(sigInfo.signature),
        });
      } catch {
        // Skip unparseable transactions
        continue;
      }
    }

    return entries;
  }

  /**
   * Verifies that a transaction signature contains a valid AgentLedger memo.
   *
   * @param signature  Base58 transaction signature
   */
  async verify(signature: string): Promise<VerifyResult> {
    const explorerUrl = this.explorerUrl(signature);

    try {
      const tx = await this.connection.getParsedTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        return {
          valid: false,
          signature,
          explorerUrl,
          reason: "Transaction not found on-chain",
        };
      }

      const memo = this.extractMemoFromParsedTx(tx);

      if (!memo) {
        return {
          valid: false,
          signature,
          blockTime: tx.blockTime ?? undefined,
          slot: tx.slot,
          explorerUrl,
          reason:
            "Transaction does not contain a valid AgentLedger memo payload",
        };
      }

      return {
        valid: true,
        signature,
        memo,
        blockTime: tx.blockTime ?? undefined,
        slot: tx.slot,
        explorerUrl,
      };
    } catch (err) {
      return {
        valid: false,
        signature,
        explorerUrl,
        reason: `RPC error: ${(err as Error).message}`,
      };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private explorerUrl(signature: string): string {
    return `${EXPLORER_BASE[this.network]}/${signature}${CLUSTER_PARAM[this.network]}`;
  }

  private extractMemoFromParsedTx(
    tx: ParsedTransactionWithMeta | null
  ): MemoPayload | null {
    if (!tx?.transaction?.message?.instructions) return null;

    for (const ix of tx.transaction.message.instructions) {
      // Parsed memo instructions look like: { parsed: "<memo text>", program: "spl-memo", ... }
      if ("parsed" in ix && ix.program === "spl-memo") {
        try {
          const payload = JSON.parse(ix.parsed as string) as unknown;
          if (this.isValidMemoPayload(payload)) {
            return payload;
          }
        } catch {
          // Not JSON — not an AgentLedger memo
        }
      }

      // Fallback: raw instruction with programId matching MEMO_PROGRAM_ID
      if (
        "programId" in ix &&
        ix.programId.toBase58() === MEMO_PROGRAM_ID.toBase58()
      ) {
        // data is base64 in raw instructions
        if ("data" in ix && typeof ix.data === "string") {
          try {
            const text = Buffer.from(ix.data, "base64").toString("utf8");
            const payload = JSON.parse(text) as unknown;
            if (this.isValidMemoPayload(payload)) {
              return payload;
            }
          } catch {
            continue;
          }
        }
      }
    }

    return null;
  }

  private isValidMemoPayload(payload: unknown): payload is MemoPayload {
    if (typeof payload !== "object" || payload === null) return false;
    const p = payload as Record<string, unknown>;
    return (
      p["v"] === "1" &&
      typeof p["agent"] === "string" &&
      typeof p["action"] === "string" &&
      typeof p["ts"] === "number"
    );
  }

  private matchesMemoFilters(
    memo: MemoPayload,
    options: QueryOptions
  ): boolean {
    if (options.agentId && memo.agent !== options.agentId) return false;
    if (options.action && memo.action !== options.action) return false;
    if (options.after && memo.ts < options.after) return false;
    if (options.before && memo.ts > options.before) return false;
    return true;
  }

  private async queryViaHelius(
    pubkey: PublicKey,
    options: QueryOptions
  ): Promise<LogEntry[]> {
    const limit = options.limit ?? 50;
    const entries: LogEntry[] = [];
    let before: string | undefined;

    // Helius `getSignaturesForAddress` is still standard JSON-RPC
    // We use it but batch transaction fetches efficiently
    while (entries.length < limit) {
      const batchSize = Math.min(100, (limit - entries.length) * 3);

      const params: Record<string, unknown> = { limit: batchSize };
      if (before) params.before = before;
      if (options.before) {
        // We filter by blockTime server-side isn't possible; filter client-side
      }

      const response = await fetch(
        `${this.heliusBaseUrl}/?api-key=${this.heliusApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getSignaturesForAddress",
            params: [pubkey.toBase58(), params],
          }),
        }
      );

      const json = (await response.json()) as {
        result?: Array<{
          signature: string;
          blockTime: number | null;
          slot: number;
          err: unknown;
        }>;
        error?: unknown;
      };

      if (!json.result || json.result.length === 0) break;

      const batch = json.result;
      before = batch[batch.length - 1].signature;

      // Fetch parsed transactions in parallel (bounded concurrency)
      const CONCURRENCY = 10;
      for (let i = 0; i < batch.length; i += CONCURRENCY) {
        if (entries.length >= limit) break;
        const chunk = batch.slice(i, i + CONCURRENCY);
        const txPromises = chunk.map((s) =>
          s.err
            ? Promise.resolve(null)
            : this.connection.getParsedTransaction(s.signature, {
                commitment: "confirmed",
                maxSupportedTransactionVersion: 0,
              })
        );
        const txs = await Promise.all(txPromises);

        for (let j = 0; j < chunk.length; j++) {
          if (entries.length >= limit) break;
          const sigInfo = chunk[j];
          const tx = txs[j];

          if (!tx) continue;

          const blockTime = sigInfo.blockTime ?? 0;
          if (options.after && blockTime < options.after) continue;
          if (options.before && blockTime > options.before) continue;

          const memo = this.extractMemoFromParsedTx(tx);
          if (!memo) continue;
          if (!this.matchesMemoFilters(memo, options)) continue;

          entries.push({
            signature: sigInfo.signature,
            blockTime,
            slot: sigInfo.slot,
            memo,
            explorerUrl: this.explorerUrl(sigInfo.signature),
          });
        }
      }

      // If we got fewer results than requested, we've exhausted history
      if (batch.length < batchSize) break;
    }

    return entries;
  }
}

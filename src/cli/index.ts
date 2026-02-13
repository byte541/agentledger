#!/usr/bin/env node

/**
 * AgentLedger CLI
 *
 * Commands:
 *   agentledger log        — Log an agent action on-chain
 *   agentledger history    — Query on-chain logs for a wallet
 *   agentledger verify     — Verify a transaction is a valid AgentLedger entry
 *   agentledger wallet     — Show wallet address + balance
 *   agentledger airdrop    — Request devnet airdrop
 */

import "dotenv/config";
import { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { AgentLedger } from "../sdk/AgentLedger";
import { LogEntry, VerifyResult } from "../sdk/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function loadKeypair(): Keypair {
  const raw = process.env.AGENT_PRIVATE_KEY;
  if (!raw) {
    console.error(
      "Error: AGENT_PRIVATE_KEY not set.\n" +
        "Set it to a base58-encoded private key or a JSON array of bytes."
    );
    process.exit(1);
  }

  // Try JSON array first (Solana CLI format)
  if (raw.startsWith("[")) {
    try {
      const bytes = JSON.parse(raw) as number[];
      return Keypair.fromSecretKey(new Uint8Array(bytes));
    } catch {
      console.error("Error: AGENT_PRIVATE_KEY is not a valid JSON array.");
      process.exit(1);
    }
  }

  // Base58 encoded
  try {
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    console.error("Error: AGENT_PRIVATE_KEY is not a valid base58 key.");
    process.exit(1);
  }
}

function buildLedger(agentId: string): AgentLedger {
  const keypair = loadKeypair();
  const network =
    (process.env.SOLANA_NETWORK as "devnet" | "mainnet-beta") ?? "devnet";

  const defaultRpc =
    network === "mainnet-beta"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";

  return new AgentLedger({
    rpcUrl: process.env.SOLANA_RPC_URL ?? defaultRpc,
    agentId,
    privateKey: keypair.secretKey,
    heliusApiKey: process.env.HELIUS_API_KEY,
    network,
  });
}

function formatEntry(entry: LogEntry, index?: number): void {
  const prefix = index !== undefined ? `[${index + 1}] ` : "";
  const time = new Date(entry.blockTime * 1000).toISOString();
  console.log(
    `${prefix}${time}  action=${entry.memo.action}  agent=${entry.memo.agent}`
  );
  if (entry.memo.data) {
    console.log(`    data: ${JSON.stringify(entry.memo.data)}`);
  }
  console.log(`    tx:   ${entry.explorerUrl}`);
}

// ─── CLI Definition ──────────────────────────────────────────────────────────

const program = new Command();

program
  .name("agentledger")
  .description(
    "Log AI agent decisions as immutable audit trails on Solana"
  )
  .version("0.1.0");

// ── log ──────────────────────────────────────────────────────────────────────
program
  .command("log <action>")
  .description("Log an agent action on-chain")
  .option("-a, --agent <id>", "Agent identifier", process.env.AGENT_ID ?? "cli-agent")
  .option("-d, --data <json>", "JSON metadata to attach", "{}")
  .option("-q, --quiet", "Only print the transaction signature")
  .action(async (action: string, opts: { agent: string; data: string; quiet: boolean }) => {
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(opts.data);
    } catch {
      console.error("Error: --data must be valid JSON (e.g. '{\"key\":\"value\"}')");
      process.exit(1);
    }

    const ledger = buildLedger(opts.agent);

    if (!opts.quiet) {
      console.log(`Logging action "${action}" for agent "${opts.agent}"...`);
    }

    try {
      const result = await ledger.log(action, { data });
      if (opts.quiet) {
        console.log(result.signature);
      } else {
        console.log(`✓ Logged on-chain`);
        console.log(`  Signature: ${result.signature}`);
        console.log(`  Explorer:  ${result.explorerUrl}`);
        console.log(`  Slot:      ${result.slot}`);
        console.log(
          `  Memo:      ${JSON.stringify(result.memo)}`
        );
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── history ──────────────────────────────────────────────────────────────────
program
  .command("history <wallet>")
  .description("Query on-chain log entries for a wallet address")
  .option("-a, --agent <id>", "Filter by agent ID")
  .option("--action <type>", "Filter by action type")
  .option("-n, --limit <n>", "Maximum entries to return", "20")
  .option("--after <iso>", "Only show entries after this ISO date")
  .option("--before <iso>", "Only show entries before this ISO date")
  .option("--agent-id <id>", "Agent ID for the ledger connection", process.env.AGENT_ID ?? "cli-agent")
  .action(
    async (
      wallet: string,
      opts: {
        agent?: string;
        action?: string;
        limit: string;
        after?: string;
        before?: string;
        agentId: string;
      }
    ) => {
      // Validate wallet address
      try {
        new PublicKey(wallet);
      } catch {
        console.error(`Error: Invalid wallet address "${wallet}"`);
        process.exit(1);
      }

      const ledger = buildLedger(opts.agentId);

      console.log(`Querying logs for ${wallet}...`);

      try {
        const entries = await ledger.query(wallet, {
          agentId: opts.agent,
          action: opts.action,
          limit: parseInt(opts.limit, 10),
          after: opts.after
            ? Math.floor(new Date(opts.after).getTime() / 1000)
            : undefined,
          before: opts.before
            ? Math.floor(new Date(opts.before).getTime() / 1000)
            : undefined,
        });

        if (entries.length === 0) {
          console.log("No AgentLedger entries found.");
          return;
        }

        console.log(`Found ${entries.length} entries:\n`);
        entries.forEach((entry, i) => formatEntry(entry, i));
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    }
  );

// ── verify ────────────────────────────────────────────────────────────────────
program
  .command("verify <signature>")
  .description("Verify a transaction signature contains a valid AgentLedger entry")
  .option("--agent-id <id>", "Agent ID for the ledger connection", process.env.AGENT_ID ?? "cli-agent")
  .action(async (signature: string, opts: { agentId: string }) => {
    const ledger = buildLedger(opts.agentId);

    console.log(`Verifying ${signature}...`);

    try {
      const result: VerifyResult = await ledger.verify(signature);

      if (result.valid) {
        console.log("✓ Valid AgentLedger entry");
        console.log(`  Agent:   ${result.memo!.agent}`);
        console.log(`  Action:  ${result.memo!.action}`);
        if (result.memo!.data) {
          console.log(`  Data:    ${JSON.stringify(result.memo!.data)}`);
        }
        console.log(
          `  Time:    ${new Date((result.blockTime ?? 0) * 1000).toISOString()}`
        );
        console.log(`  Slot:    ${result.slot}`);
        console.log(`  URL:     ${result.explorerUrl}`);
      } else {
        console.log("✗ Not a valid AgentLedger entry");
        console.log(`  Reason: ${result.reason}`);
        console.log(`  URL:    ${result.explorerUrl}`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── wallet ────────────────────────────────────────────────────────────────────
program
  .command("wallet")
  .description("Show the agent wallet address and SOL balance")
  .option("--agent-id <id>", "Agent ID", process.env.AGENT_ID ?? "cli-agent")
  .action(async (opts: { agentId: string }) => {
    const ledger = buildLedger(opts.agentId);
    const balance = await ledger.getBalance();
    console.log(`Address: ${ledger.walletAddress}`);
    console.log(`Balance: ${balance.toFixed(6)} SOL`);
    console.log(
      `Network: ${process.env.SOLANA_NETWORK ?? "devnet"}`
    );
  });

// ── airdrop ───────────────────────────────────────────────────────────────────
program
  .command("airdrop")
  .description("Request a devnet airdrop (0.5 SOL by default)")
  .option("--amount <sol>", "Amount in SOL", "0.5")
  .option("--agent-id <id>", "Agent ID", process.env.AGENT_ID ?? "cli-agent")
  .action(async (opts: { amount: string; agentId: string }) => {
    const ledger = buildLedger(opts.agentId);
    console.log(`Requesting ${opts.amount} SOL airdrop for ${ledger.walletAddress}...`);
    try {
      const sig = await ledger.requestAirdrop(parseFloat(opts.amount));
      console.log(`✓ Airdrop confirmed: ${sig}`);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  ParsedTransactionWithMeta,
} from '@solana/web3.js';
import {
  AgentLedgerConfig,
  AgentAction,
  AgentMemoPayload,
  LogEntry,
  QueryOptions,
  LogResult,
  VerifyResult,
} from './types';

// Solana Memo Program ID
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/**
 * AgentLedger - Immutable audit trails for AI agents on Solana
 * 
 * Uses the Solana Memo program to store structured action logs
 * that can be queried and verified by anyone.
 */
export class AgentLedger {
  private connection: Connection;
  private wallet: Keypair;
  private agentId: string;
  private heliusApiKey?: string;
  private heliusBaseUrl: string;

  constructor(config: AgentLedgerConfig) {
    this.connection = new Connection(config.rpcEndpoint, 'confirmed');
    this.wallet = Keypair.fromSecretKey(config.walletKeypair);
    this.agentId = config.agentId;
    this.heliusApiKey = config.heliusApiKey;
    
    // Determine Helius URL based on RPC endpoint
    if (config.rpcEndpoint.includes('devnet')) {
      this.heliusBaseUrl = 'https://api.helius.xyz/v0';
    } else {
      this.heliusBaseUrl = 'https://api.helius.xyz/v0';
    }
  }

  /**
   * Get the wallet's public key
   */
  getWalletAddress(): PublicKey {
    return this.wallet.publicKey;
  }

  /**
   * Get the agent identifier
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Log an action to the Solana blockchain
   */
  async log(
    actionType: string,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<LogResult> {
    try {
      const action: AgentAction = {
        actionId: this.generateActionId(),
        actionType,
        description,
        metadata,
        timestamp: new Date().toISOString(),
      };

      const payload: AgentMemoPayload = {
        v: 1,
        agent: this.agentId,
        action,
      };

      const memoData = JSON.stringify(payload);
      
      // Check memo size (max ~1000 bytes for memo program)
      if (memoData.length > 900) {
        return {
          success: false,
          error: `Memo too large: ${memoData.length} bytes (max 900)`,
        };
      }

      const instruction = new TransactionInstruction({
        keys: [{ pubkey: this.wallet.publicKey, isSigner: true, isWritable: true }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memoData, 'utf-8'),
      });

      const transaction = new Transaction().add(instruction);
      
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet],
        { commitment: 'confirmed' }
      );

      const network = this.connection.rpcEndpoint.includes('devnet') ? 'devnet' : 'mainnet';
      const explorerUrl = `https://explorer.solana.com/tx/${signature}${network === 'devnet' ? '?cluster=devnet' : ''}`;

      return {
        success: true,
        signature,
        explorerUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Query the agent's log history
   */
  async query(options: QueryOptions = {}): Promise<LogEntry[]> {
    const { limit = 50, actionType, after, before } = options;
    
    try {
      // Use Helius API if available for better performance
      if (this.heliusApiKey) {
        return this.queryWithHelius(options);
      }

      // Fallback to standard RPC
      const signatures = await this.connection.getSignaturesForAddress(
        this.wallet.publicKey,
        { limit: Math.min(limit * 2, 1000) }
      );

      const entries: LogEntry[] = [];

      for (const sig of signatures) {
        if (entries.length >= limit) break;
        
        // Apply time filters
        if (after && sig.blockTime && sig.blockTime < after) continue;
        if (before && sig.blockTime && sig.blockTime > before) continue;

        const tx = await this.connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx) continue;

        const entry = this.parseTransaction(sig.signature, tx);
        if (entry) {
          // Filter by action type if specified
          if (actionType && entry.payload.action.actionType !== actionType) continue;
          // Only include logs from this agent
          if (entry.payload.agent !== this.agentId) continue;
          entries.push(entry);
        }
      }

      return entries;
    } catch (error) {
      console.error('Query error:', error);
      return [];
    }
  }

  /**
   * Query using Helius API for better performance
   */
  private async queryWithHelius(options: QueryOptions): Promise<LogEntry[]> {
    const { limit = 50, actionType, after, before } = options;
    
    try {
      const url = `${this.heliusBaseUrl}/addresses/${this.wallet.publicKey.toBase58()}/transactions?api-key=${this.heliusApiKey}&limit=${Math.min(limit * 2, 100)}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Helius API error: ${response.status}`);
      }

      const transactions = await response.json() as Array<{
        signature: string;
        timestamp?: number;
        slot?: number;
        instructions?: Array<{ programId: string; data?: string }>;
      }>;
      const entries: LogEntry[] = [];

      for (const tx of transactions) {
        if (entries.length >= limit) break;

        // Apply time filters
        if (after && tx.timestamp && tx.timestamp < after) continue;
        if (before && tx.timestamp && tx.timestamp > before) continue;

        // Look for memo instructions
        if (tx.instructions) {
          for (const ix of tx.instructions) {
            if (ix.programId === MEMO_PROGRAM_ID.toBase58() && ix.data) {
              try {
                const payload = JSON.parse(ix.data) as AgentMemoPayload;
                if (payload.v === 1 && payload.agent === this.agentId) {
                  if (actionType && payload.action.actionType !== actionType) continue;
                  
                  entries.push({
                    signature: tx.signature,
                    blockTime: tx.timestamp ?? null,
                    slot: tx.slot ?? 0,
                    payload,
                    verified: true,
                  });
                }
              } catch {
                // Not a valid AgentLedger memo
              }
            }
          }
        }
      }

      return entries;
    } catch (error) {
      console.error('Helius query error, falling back to RPC:', error);
      // Fallback to standard query
      return this.query({ ...options });
    }
  }

  /**
   * Verify a specific transaction and retrieve its log entry
   */
  async verify(signature: string): Promise<VerifyResult> {
    try {
      const tx = await this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        return { valid: false, error: 'Transaction not found' };
      }

      const entry = this.parseTransaction(signature, tx);
      
      if (!entry) {
        return { valid: false, error: 'No valid AgentLedger memo found in transaction' };
      }

      return { valid: true, entry };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Parse a transaction to extract AgentLedger memo
   */
  private parseTransaction(
    signature: string,
    tx: ParsedTransactionWithMeta
  ): LogEntry | null {
    if (!tx.transaction?.message?.instructions) return null;

    for (const ix of tx.transaction.message.instructions) {
      // Check if this is a memo instruction
      if ('programId' in ix && ix.programId.equals(MEMO_PROGRAM_ID)) {
        // For parsed instructions, the data might be in different formats
        if ('parsed' in ix && typeof ix.parsed === 'string') {
          try {
            const payload = JSON.parse(ix.parsed) as AgentMemoPayload;
            if (this.isValidPayload(payload)) {
              return {
                signature,
                blockTime: tx.blockTime ?? null,
                slot: tx.slot,
                payload,
                verified: true,
              };
            }
          } catch {
            // Not a JSON memo
          }
        }
      }
    }

    // Also check inner instructions and raw log messages
    if (tx.meta?.logMessages) {
      for (const log of tx.meta.logMessages) {
        if (log.includes('Program log: Memo')) {
          const match = log.match(/Memo \(len \d+\): "(.*)"$/);
          if (match) {
            try {
              const payload = JSON.parse(match[1]) as AgentMemoPayload;
              if (this.isValidPayload(payload)) {
                return {
                  signature,
                  blockTime: tx.blockTime ?? null,
                  slot: tx.slot,
                  payload,
                  verified: true,
                };
              }
            } catch {
              // Not a valid JSON memo
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Validate an AgentMemoPayload structure
   */
  private isValidPayload(payload: unknown): payload is AgentMemoPayload {
    if (!payload || typeof payload !== 'object') return false;
    const p = payload as Record<string, unknown>;
    return (
      p.v === 1 &&
      typeof p.agent === 'string' &&
      p.action !== null &&
      typeof p.action === 'object'
    );
  }

  /**
   * Generate a unique action ID
   */
  private generateActionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  /**
   * Get the current SOL balance of the wallet
   */
  async getBalance(): Promise<number> {
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    return balance / 1e9; // Convert lamports to SOL
  }

  /**
   * Create a new keypair for a fresh agent wallet
   */
  static generateKeypair(): Keypair {
    return Keypair.generate();
  }

  /**
   * Request an airdrop (devnet only)
   */
  async requestAirdrop(amount: number = 1): Promise<string> {
    const signature = await this.connection.requestAirdrop(
      this.wallet.publicKey,
      amount * 1e9
    );
    await this.connection.confirmTransaction(signature);
    return signature;
  }
}

// Re-export types
export * from './types';

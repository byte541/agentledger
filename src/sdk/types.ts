/**
 * AgentLedger — Type Definitions
 */

export interface AgentLedgerConfig {
  /** Solana RPC endpoint URL */
  rpcUrl: string;
  /** Agent identifier (e.g. "my-trading-bot-v1") */
  agentId: string;
  /** Base58 private key for signing transactions (32 or 64 bytes) */
  privateKey: Uint8Array;
  /** Helius API key for enhanced transaction querying (optional) */
  heliusApiKey?: string;
  /** Network: "devnet" | "mainnet-beta" (default: "devnet") */
  network?: "devnet" | "mainnet-beta";
}

export interface LogOptions {
  /** Arbitrary metadata to attach alongside the action */
  data?: Record<string, unknown>;
  /** Additional signers (for multi-agent scenarios) */
  additionalSigners?: Uint8Array[];
}

export interface LogResult {
  /** Transaction signature */
  signature: string;
  /** Solana explorer URL */
  explorerUrl: string;
  /** Slot the transaction was confirmed in */
  slot: number;
  /** Timestamp (Unix ms) when the log was submitted */
  timestamp: number;
  /** The memo payload that was written on-chain */
  memo: MemoPayload;
}

export interface MemoPayload {
  /** Schema version */
  v: "1";
  /** Agent identifier */
  agent: string;
  /** Action type / label */
  action: string;
  /** Unix timestamp (seconds) */
  ts: number;
  /** Optional metadata */
  data?: Record<string, unknown>;
}

export interface QueryOptions {
  /** Filter by agent ID (matches the `agent` field in memo) */
  agentId?: string;
  /** Filter by action type */
  action?: string;
  /** Maximum number of entries to return (default: 50) */
  limit?: number;
  /** Only return entries after this Unix timestamp (seconds) */
  after?: number;
  /** Only return entries before this Unix timestamp (seconds) */
  before?: number;
}

export interface LogEntry {
  /** Transaction signature */
  signature: string;
  /** Block time (Unix seconds) */
  blockTime: number;
  /** Slot */
  slot: number;
  /** Decoded memo payload */
  memo: MemoPayload;
  /** Solana explorer URL */
  explorerUrl: string;
}

export interface VerifyResult {
  /** Whether the transaction exists and contains a valid AgentLedger memo */
  valid: boolean;
  /** The decoded memo payload if valid */
  memo?: MemoPayload;
  /** Transaction signature */
  signature: string;
  /** Block time */
  blockTime?: number;
  /** Slot */
  slot?: number;
  /** Reason why verification failed (if !valid) */
  reason?: string;
  /** Solana explorer URL */
  explorerUrl: string;
}

export type Network = "devnet" | "mainnet-beta";

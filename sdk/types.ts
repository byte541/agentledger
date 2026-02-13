import { PublicKey } from '@solana/web3.js';

/**
 * Configuration for AgentLedger
 */
export interface AgentLedgerConfig {
  /** Solana RPC endpoint (devnet/mainnet) */
  rpcEndpoint: string;
  /** Optional Helius API key for efficient history queries */
  heliusApiKey?: string;
  /** Agent identifier (will be included in all logs) */
  agentId: string;
  /** Agent wallet keypair (for signing transactions) */
  walletKeypair: Uint8Array;
}

/**
 * An action logged to the Solana blockchain
 */
export interface AgentAction {
  /** Unique action identifier */
  actionId: string;
  /** Type of action (e.g., 'decision', 'api_call', 'file_write') */
  actionType: string;
  /** Human-readable description of what happened */
  description: string;
  /** Optional structured metadata */
  metadata?: Record<string, unknown>;
  /** ISO timestamp when the action occurred */
  timestamp: string;
}

/**
 * The full memo payload stored on-chain
 */
export interface AgentMemoPayload {
  /** Protocol version */
  v: number;
  /** Agent identifier */
  agent: string;
  /** The action being logged */
  action: AgentAction;
}

/**
 * A log entry retrieved from the blockchain
 */
export interface LogEntry {
  /** Transaction signature */
  signature: string;
  /** Block time (unix timestamp) */
  blockTime: number | null;
  /** Slot number */
  slot: number;
  /** The decoded memo payload */
  payload: AgentMemoPayload;
  /** Was this log successfully verified */
  verified: boolean;
}

/**
 * Options for querying log history
 */
export interface QueryOptions {
  /** Maximum number of entries to return */
  limit?: number;
  /** Filter by action type */
  actionType?: string;
  /** Only entries after this unix timestamp */
  after?: number;
  /** Only entries before this unix timestamp */
  before?: number;
}

/**
 * Result of a log operation
 */
export interface LogResult {
  /** Whether the log was successful */
  success: boolean;
  /** Transaction signature (if successful) */
  signature?: string;
  /** Error message (if failed) */
  error?: string;
  /** Explorer URL for the transaction */
  explorerUrl?: string;
}

/**
 * Result of verifying a transaction
 */
export interface VerifyResult {
  /** Whether the transaction was found and valid */
  valid: boolean;
  /** The log entry (if valid) */
  entry?: LogEntry;
  /** Error message (if invalid) */
  error?: string;
}

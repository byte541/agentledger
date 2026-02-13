/**
 * AgentLedger — Public API
 *
 * SDK for logging AI agent decisions as immutable audit trails on Solana.
 *
 * @example
 * ```typescript
 * import { AgentLedger } from 'agentledger';
 *
 * const ledger = new AgentLedger({
 *   rpcUrl: 'https://api.devnet.solana.com',
 *   agentId: 'my-trading-bot-v1',
 *   privateKey: myKeypair.secretKey,
 *   heliusApiKey: process.env.HELIUS_API_KEY,
 * });
 *
 * const result = await ledger.log('decision:buy', {
 *   data: { asset: 'SOL', amount: 10, reason: 'momentum signal' }
 * });
 * console.log('Logged on-chain:', result.explorerUrl);
 * ```
 */

export { AgentLedger } from "./sdk/AgentLedger";
export * from "./sdk/types";

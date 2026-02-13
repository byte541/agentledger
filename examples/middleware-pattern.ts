/**
 * Middleware Pattern Example
 * 
 * Shows how to use AgentLedger as middleware in an agent's action pipeline.
 * Every action flows through the ledger before execution.
 */

import { Keypair } from '@solana/web3.js';
import { AgentLedger, LogResult } from '../sdk';

// Types for our agent's actions
interface AgentAction {
  type: string;
  payload: Record<string, unknown>;
}

interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// The actual action handlers
const actionHandlers: Record<string, (payload: Record<string, unknown>) => Promise<ActionResult>> = {
  async fetchData(payload) {
    // Simulate fetching data
    return { success: true, data: { price: 100 } };
  },
  
  async makeTrade(payload) {
    // Simulate making a trade
    return { success: true, data: { orderId: '12345' } };
  },
  
  async sendAlert(payload) {
    // Simulate sending an alert
    return { success: true };
  },
};

// Create an audited agent wrapper
function createAuditedAgent(ledger: AgentLedger) {
  return {
    async execute(action: AgentAction): Promise<{ result: ActionResult; auditLog: LogResult }> {
      // 1. Log the action BEFORE execution
      const auditLog = await ledger.log(
        `pre_${action.type}`,
        `Agent preparing to execute: ${action.type}`,
        { payload: action.payload, timestamp: new Date().toISOString() }
      );

      // 2. Execute the action
      const handler = actionHandlers[action.type];
      if (!handler) {
        throw new Error(`Unknown action type: ${action.type}`);
      }
      
      const result = await handler(action.payload);

      // 3. Log the result AFTER execution
      await ledger.log(
        `post_${action.type}`,
        `Action completed: ${action.type}`,
        { 
          success: result.success, 
          data: result.data,
          error: result.error,
          preActionTx: auditLog.signature,
        }
      );

      return { result, auditLog };
    },

    // Convenience method for decisions
    async decide(description: string, options: string[], choice: string, reasoning: string) {
      await ledger.log('decision', description, {
        options,
        choice,
        reasoning,
      });
    },
  };
}

// Example usage
async function main() {
  const wallet = Keypair.generate();
  
  const ledger = new AgentLedger({
    rpcEndpoint: 'https://api.devnet.solana.com',
    agentId: 'audited-trading-bot',
    walletKeypair: wallet.secretKey,
  });

  // Request airdrop for demo
  await ledger.requestAirdrop(0.1);

  const agent = createAuditedAgent(ledger);

  // Now every action is automatically audited
  await agent.decide(
    'Selecting trading strategy',
    ['momentum', 'mean-reversion', 'arbitrage'],
    'arbitrage',
    'Lower risk profile matches current market volatility'
  );

  const { result, auditLog } = await agent.execute({
    type: 'fetchData',
    payload: { symbol: 'SOL/USDC' },
  });

  console.log('Action result:', result);
  console.log('Audit logged at:', auditLog.explorerUrl);
}

main().catch(console.error);

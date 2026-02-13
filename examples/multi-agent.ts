/**
 * AgentLedger — Multi-Agent Example
 *
 * Demonstrates multiple agents logging to their own wallets
 * and cross-querying each other's audit trails.
 */

import "dotenv/config";
import { Keypair } from "@solana/web3.js";
import { AgentLedger } from "../src";

const coordinatorKeypair = Keypair.generate();
const workerKeypair = Keypair.generate();

async function setupAgent(keypair: Keypair, agentId: string) {
  const ledger = new AgentLedger({
    rpcUrl: "https://api.devnet.solana.com",
    agentId,
    privateKey: keypair.secretKey,
    heliusApiKey: process.env.HELIUS_API_KEY,
    network: "devnet",
  });
  await ledger.requestAirdrop(0.5);
  return ledger;
}

async function main() {
  console.log("Setting up coordinator and worker agents...");
  const [coordinator, worker] = await Promise.all([
    setupAgent(coordinatorKeypair, "coordinator-v1"),
    setupAgent(workerKeypair, "worker-v1"),
  ]);

  console.log("Coordinator:", coordinator.walletAddress);
  console.log("Worker:     ", worker.walletAddress);

  // Coordinator assigns a task
  const task = await coordinator.log("task:assigned", {
    data: {
      taskId: "research-001",
      assignedTo: worker.walletAddress,
      description: "Analyze top 5 Solana DeFi protocols",
    },
  });
  console.log("\nCoordinator assigned task:", task.signature.slice(0, 16) + "...");

  // Worker logs its progress
  await worker.log("task:started", {
    data: { taskId: "research-001", assignedBy: coordinator.walletAddress },
  });

  await worker.log("tool:data-fetch", {
    data: {
      taskId: "research-001",
      source: "DeFiLlama",
      protocols: ["Raydium", "Orca", "Jupiter", "Drift", "Kamino"],
    },
  });

  await worker.log("task:completed", {
    data: {
      taskId: "research-001",
      result_summary: "Raydium leads TVL; Jupiter dominates DEX volume",
      confidence: 0.92,
    },
  });

  // Coordinator queries the worker's log to verify completion
  console.log("\nCoordinator verifying worker's audit trail...");
  const workerLog = await coordinator.query(worker.walletAddress, {
    agentId: "worker-v1",
    action: "task:completed",
    limit: 5,
  });

  if (workerLog.length > 0) {
    console.log(`✓ Worker completed task: ${JSON.stringify(workerLog[0].memo.data)}`);
  }

  // Log coordinator's verification
  await coordinator.log("task:verified", {
    data: {
      taskId: "research-001",
      workerAddress: worker.walletAddress,
      workerTx: workerLog[0]?.signature ?? "unknown",
      status: "accepted",
    },
  });

  console.log("\nMulti-agent audit trail complete.");
  console.log(
    "Both agents' decisions are permanently recorded and cross-referenceable."
  );
}

main().catch(console.error);

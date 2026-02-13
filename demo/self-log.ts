/**
 * AgentLedger Self-Logging Demo
 *
 * This script demonstrates Byte (the AI agent that built this project)
 * logging its own build decisions on Solana devnet in real time.
 *
 * It recreates the actual decision trail from AgentLedger's creation,
 * writing each step as an immutable memo transaction.
 *
 * Run: npx ts-node demo/self-log.ts
 *
 * Environment variables:
 *   HELIUS_API_KEY     — Helius API key (recommended for faster queries)
 *   DEMO_PRIVATE_KEY   — Base58 private key to use (optional; overrides default seed)
 *   DRY_RUN=true       — Preview what would be logged without broadcasting
 *
 * Funding the demo wallet:
 *   The demo uses a deterministic devnet wallet. If the faucet is dry, fund it:
 *     https://faucet.solana.com
 *   Or set DEMO_PRIVATE_KEY to an already-funded devnet keypair.
 */

import "dotenv/config";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AgentLedger } from "../src/sdk/AgentLedger";
import bs58 from "bs58";

// Demo uses a deterministic devnet keypair derived from a fixed seed.
// This makes the demo reproducible and avoids needing real funds.
const DEMO_SEED = Buffer.from(
  "agentledger-byte-demo-solana-v2-pad000000000000",
  "utf8"
).slice(0, 32);

function loadDemoKeypair(): Keypair {
  if (process.env.DEMO_PRIVATE_KEY) {
    return Keypair.fromSecretKey(bs58.decode(process.env.DEMO_PRIVATE_KEY));
  }
  return Keypair.fromSeed(DEMO_SEED);
}

const DEMO_KEYPAIR = loadDemoKeypair();
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const DRY_RUN = process.env.DRY_RUN === "true";

// Build decisions Byte made while creating this project
const BUILD_DECISIONS = [
  {
    action: "decision:project-scoped",
    data: {
      project: "AgentLedger",
      rationale:
        "AI agent accountability via blockchain immutability fills a real gap in the agent ecosystem",
      approach: "SDK + CLI using Solana Memo program — no custom program needed",
    },
  },
  {
    action: "decision:tech-stack",
    data: {
      language: "TypeScript",
      solana_lib: "@solana/web3.js",
      rpc: "Helius (devnet)",
      memo_program: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
      reason:
        "Memo program is battle-tested, zero deployment overhead, works immediately on devnet + mainnet",
    },
  },
  {
    action: "decision:schema-design",
    data: {
      schema_version: "1",
      fields: ["v", "agent", "action", "ts", "data"],
      max_bytes: 566,
      rationale:
        "Minimal schema keeps gas low while providing enough structure for filtering + verification",
    },
  },
  {
    action: "decision:helius-integration",
    data: {
      why: "Standard RPC requires N+1 queries to find memo transactions; Helius enables batched parallel fetching",
      fallback: "Standard RPC path kept for users without Helius API key",
    },
  },
  {
    action: "decision:cli-design",
    data: {
      commands: ["log", "history", "verify", "wallet", "airdrop"],
      env_vars: ["AGENT_PRIVATE_KEY", "HELIUS_API_KEY", "AGENT_ID", "SOLANA_NETWORK"],
      rationale: "CLI first: agents need to be able to log via shell without importing SDK",
    },
  },
  {
    action: "build:completed",
    data: {
      files_written: [
        "src/sdk/AgentLedger.ts",
        "src/sdk/types.ts",
        "src/cli/index.ts",
        "demo/self-log.ts",
        "tests/unit/AgentLedger.test.ts",
        "README.md",
      ],
      lines_of_code: "~900",
      test_coverage: "unit (15 passing) + integration (devnet)",
    },
  },
];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryFundWallet(
  keypair: Keypair,
  connection: Connection
): Promise<boolean> {
  const endpoints = [
    "https://api.devnet.solana.com",
    ...(HELIUS_API_KEY
      ? [`https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`]
      : []),
  ];

  for (const endpoint of endpoints) {
    try {
      const conn = new Connection(endpoint, "confirmed");
      const sig = await conn.requestAirdrop(keypair.publicKey, 0.5 * LAMPORTS_PER_SOL);
      await conn.confirmTransaction(sig);
      return true;
    } catch {
      // Try next endpoint
      continue;
    }
  }
  return false;
}

async function main() {
  console.log("=".repeat(60));
  console.log("  AgentLedger — Byte's Self-Logging Demo");
  console.log("=".repeat(60));
  console.log();
  console.log(
    "This demo recreates Byte's actual build decisions on Solana devnet."
  );
  console.log(`Agent:       byte-agent-fixed-69`);
  console.log(`Demo wallet: ${DEMO_KEYPAIR.publicKey.toBase58()}`);
  console.log(`Mode:        ${DRY_RUN ? "DRY RUN (preview only)" : "LIVE (broadcasting to devnet)"}`);
  console.log();

  if (DRY_RUN) {
    console.log("Preview — these decisions would be logged on-chain:\n");
    for (const decision of BUILD_DECISIONS) {
      console.log(`  action: ${decision.action}`);
      if (decision.data) {
        const preview = JSON.stringify(decision.data).slice(0, 100);
        console.log(`  data:   ${preview}${preview.length >= 100 ? "..." : ""}`);
      }
      console.log();
    }
    console.log("To run live: remove DRY_RUN=true (ensure wallet has devnet SOL)");
    console.log(
      `  Fund at: https://faucet.solana.com/?recipient=${DEMO_KEYPAIR.publicKey.toBase58()}`
    );
    return;
  }

  const ledger = new AgentLedger({
    rpcUrl: RPC_URL,
    agentId: "byte-agent-fixed-69",
    privateKey: DEMO_KEYPAIR.secretKey,
    heliusApiKey: HELIUS_API_KEY,
    network: "devnet",
  });

  // Fund the demo wallet if needed
  console.log("Checking devnet balance...");
  let balance = await ledger.getBalance();
  console.log(`Balance: ${balance.toFixed(6)} SOL`);

  if (balance < 0.05) {
    console.log("Balance low — attempting devnet airdrop...");
    const funded = await tryFundWallet(DEMO_KEYPAIR, ledger.rpcConnection);
    if (funded) {
      await sleep(2000);
      balance = await ledger.getBalance();
      console.log(`Balance after airdrop: ${balance.toFixed(6)} SOL`);
    } else {
      console.error(
        "\n⚠️  Devnet faucet unavailable (rate-limited). Fund the demo wallet manually:"
      );
      console.error(
        `   https://faucet.solana.com/?recipient=${DEMO_KEYPAIR.publicKey.toBase58()}`
      );
      console.error(
        "\n   Then re-run: npx ts-node demo/self-log.ts"
      );
      console.error(
        "\n   To preview without SOL: DRY_RUN=true npx ts-node demo/self-log.ts"
      );
      process.exit(1);
    }
  }

  console.log();
  console.log(
    `Logging ${BUILD_DECISIONS.length} build decisions on-chain...\n`
  );

  const results: Array<{ action: string; signature: string; url: string }> = [];

  for (let i = 0; i < BUILD_DECISIONS.length; i++) {
    const decision = BUILD_DECISIONS[i];
    process.stdout.write(
      `[${i + 1}/${BUILD_DECISIONS.length}] ${decision.action} ... `
    );

    try {
      const result = await ledger.log(decision.action, {
        data: decision.data,
      });

      console.log(`✓`);
      console.log(`    ${result.explorerUrl}`);

      results.push({
        action: decision.action,
        signature: result.signature,
        url: result.explorerUrl,
      });

      // Small delay to avoid hitting rate limits
      if (i < BUILD_DECISIONS.length - 1) {
        await sleep(1500);
      }
    } catch (err) {
      console.log(`✗ FAILED`);
      console.error(`    Error: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  console.log();
  console.log("=".repeat(60));
  console.log("  All decisions logged. Querying audit trail...");
  console.log("=".repeat(60));
  console.log();

  // Give devnet a moment to index
  await sleep(3000);

  const entries = await ledger.query(DEMO_KEYPAIR.publicKey, {
    agentId: "byte-agent-fixed-69",
    limit: 20,
  });

  console.log(`Found ${entries.length} AgentLedger entries on-chain:\n`);

  for (const entry of entries) {
    const time = new Date(entry.blockTime * 1000).toISOString();
    console.log(`  ${time}  ${entry.memo.action}`);
    if (entry.memo.data) {
      const preview = JSON.stringify(entry.memo.data).slice(0, 80);
      console.log(`    ${preview}${preview.length >= 80 ? "..." : ""}`);
    }
    console.log(`    ${entry.explorerUrl}`);
    console.log();
  }

  // Verify the last transaction
  const lastSig = results[results.length - 1].signature;
  console.log(`Verifying last transaction: ${lastSig.slice(0, 16)}...`);
  const verified = await ledger.verify(lastSig);
  console.log(
    `Verification: ${verified.valid ? "✓ VALID" : "✗ INVALID"} — agent=${verified.memo?.agent}, action=${verified.memo?.action}`
  );

  console.log();
  console.log("=".repeat(60));
  console.log("  Demo complete.");
  console.log(`  ${results.length} decisions permanently recorded on Solana.`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});

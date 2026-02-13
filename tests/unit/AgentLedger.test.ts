/**
 * AgentLedger — Unit Tests
 *
 * Tests core SDK logic with mocked Solana RPC calls.
 * These tests run without network access.
 */

import { Keypair } from "@solana/web3.js";
import { AgentLedger } from "../../src/sdk/AgentLedger";

// ─── Mocks ────────────────────────────────────────────────────────────────────
// Note: jest.mock() is hoisted before const declarations — all values used
// inside the factory must be plain literals, not references to outer consts.

jest.mock("@solana/web3.js", () => {
  const MOCK_SIG = "5VfYxLzK3QmG9RnD1pXeJ8oWcB4tHvMsAkFuP2yNqZ7";
  const MOCK_SLOT_NUM = 300_000_000;
  const MOCK_BT = 1739300000;

  const actual = jest.requireActual("@solana/web3.js");

  class MockConnection {
    async getBalance(_pubkey: unknown): Promise<number> {
      return 1_000_000_000; // 1 SOL in lamports
    }

    async requestAirdrop(_pubkey: unknown, _lamports: number): Promise<string> {
      return MOCK_SIG;
    }

    async confirmTransaction(_sig: string): Promise<{ value: { err: null } }> {
      return { value: { err: null } };
    }

    async getTransaction(_sig: string, _opts?: unknown): Promise<{ slot: number }> {
      return { slot: MOCK_SLOT_NUM };
    }

    async getParsedTransaction(_sig: string, _opts?: unknown): Promise<unknown> {
      const payload = {
        v: "1",
        agent: "test-agent",
        action: "decision:test",
        ts: MOCK_BT,
        data: { key: "value" },
      };
      return {
        slot: MOCK_SLOT_NUM,
        blockTime: MOCK_BT,
        transaction: {
          message: {
            instructions: [
              {
                parsed: JSON.stringify(payload),
                program: "spl-memo",
                programId: new actual.PublicKey(
                  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
                ),
              },
            ],
          },
        },
      };
    }

    async getSignaturesForAddress(
      _pubkey: unknown,
      _opts?: unknown
    ): Promise<Array<{ signature: string; blockTime: number; slot: number; err: null }>> {
      return [
        { signature: MOCK_SIG, blockTime: MOCK_BT, slot: MOCK_SLOT_NUM, err: null },
        { signature: MOCK_SIG + "2", blockTime: MOCK_BT - 60, slot: MOCK_SLOT_NUM - 100, err: null },
      ];
    }
  }

  return {
    ...actual,
    Connection: MockConnection,
    sendAndConfirmTransaction: jest.fn().mockResolvedValue(MOCK_SIG),
  };
});

// ─── Constants (mirrored from mock factory above) ────────────────────────────

const MOCK_SIGNATURE = "5VfYxLzK3QmG9RnD1pXeJ8oWcB4tHvMsAkFuP2yNqZ7";
const MOCK_SLOT = 300_000_000;
const MOCK_BLOCK_TIME = 1739300000;

// ─── Test Setup ───────────────────────────────────────────────────────────────

let ledger: AgentLedger;

beforeEach(() => {
  const testKeypair = Keypair.generate();
  ledger = new AgentLedger({
    rpcUrl: "https://api.devnet.solana.com",
    agentId: "test-agent",
    privateKey: testKeypair.secretKey,
    network: "devnet",
  });
});

// ─── Constructor Tests ────────────────────────────────────────────────────────

describe("AgentLedger constructor", () => {
  it("creates instance with 64-byte secret key", () => {
    const kp = Keypair.generate();
    const inst = new AgentLedger({
      rpcUrl: "https://api.devnet.solana.com",
      agentId: "test",
      privateKey: kp.secretKey,
      network: "devnet",
    });
    expect(inst.walletAddress).toBe(kp.publicKey.toBase58());
  });

  it("creates instance with 32-byte seed", () => {
    const seed = new Uint8Array(32).fill(42);
    const expected = Keypair.fromSeed(seed);
    const inst = new AgentLedger({
      rpcUrl: "https://api.devnet.solana.com",
      agentId: "test",
      privateKey: seed,
      network: "devnet",
    });
    expect(inst.walletAddress).toBe(expected.publicKey.toBase58());
  });

  it("throws on invalid key length", () => {
    expect(() => {
      new AgentLedger({
        rpcUrl: "https://api.devnet.solana.com",
        agentId: "test",
        privateKey: new Uint8Array(16),
        network: "devnet",
      });
    }).toThrow("Invalid private key length");
  });

  it("defaults network to devnet when not specified", () => {
    const inst = new AgentLedger({
      rpcUrl: "https://api.devnet.solana.com",
      agentId: "test",
      privateKey: Keypair.generate().secretKey,
    });
    expect(inst).toBeDefined();
  });
});

// ─── log() Tests ──────────────────────────────────────────────────────────────

describe("AgentLedger.log()", () => {
  it("logs a simple action and returns correct shape", async () => {
    const result = await ledger.log("decision:test");
    expect(result.signature).toBe(MOCK_SIGNATURE);
    expect(result.slot).toBe(MOCK_SLOT);
    expect(result.memo.action).toBe("decision:test");
    expect(result.memo.agent).toBe("test-agent");
    expect(result.memo.v).toBe("1");
    expect(result.memo.ts).toBeGreaterThan(0);
  });

  it("includes data in memo payload when provided", async () => {
    const result = await ledger.log("tool:search", {
      data: { query: "Solana DeFi", results: 5 },
    });
    expect(result.memo.data).toEqual({ query: "Solana DeFi", results: 5 });
  });

  it("generates correct devnet explorer URL", async () => {
    const result = await ledger.log("test");
    expect(result.explorerUrl).toContain("explorer.solana.com/tx");
    expect(result.explorerUrl).toContain("?cluster=devnet");
    expect(result.explorerUrl).toContain(MOCK_SIGNATURE);
  });

  it("throws when memo payload exceeds 566 bytes", async () => {
    const hugeData = { blob: "x".repeat(600) };
    await expect(ledger.log("action", { data: hugeData })).rejects.toThrow(
      "Memo payload exceeds 566-byte limit"
    );
  });

  it("includes timestamp in result within expected range", async () => {
    const before = Date.now();
    const result = await ledger.log("test");
    const after = Date.now();
    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after);
  });

  it("omits data field when empty object is passed", async () => {
    const result = await ledger.log("test:no-data", { data: {} });
    expect(result.memo.data).toBeUndefined();
  });
});

// ─── verify() Tests ───────────────────────────────────────────────────────────

describe("AgentLedger.verify()", () => {
  it("returns valid=true for a transaction with an AgentLedger memo", async () => {
    const result = await ledger.verify(MOCK_SIGNATURE);
    expect(result.valid).toBe(true);
    expect(result.memo?.agent).toBe("test-agent");
    expect(result.memo?.action).toBe("decision:test");
    expect(result.slot).toBe(MOCK_SLOT);
    expect(result.blockTime).toBe(MOCK_BLOCK_TIME);
  });

  it("includes explorer URL in result", async () => {
    const result = await ledger.verify(MOCK_SIGNATURE);
    expect(result.explorerUrl).toContain(MOCK_SIGNATURE);
  });
});

// ─── getBalance() Tests ───────────────────────────────────────────────────────

describe("AgentLedger.getBalance()", () => {
  it("returns balance in SOL (not lamports)", async () => {
    const balance = await ledger.getBalance();
    expect(balance).toBe(1.0); // 1_000_000_000 lamports → 1 SOL
  });
});

// ─── requestAirdrop() Tests ───────────────────────────────────────────────────

describe("AgentLedger.requestAirdrop()", () => {
  it("throws on mainnet-beta", async () => {
    const mainnetLedger = new AgentLedger({
      rpcUrl: "https://api.mainnet-beta.solana.com",
      agentId: "test",
      privateKey: Keypair.generate().secretKey,
      network: "mainnet-beta",
    });
    await expect(mainnetLedger.requestAirdrop()).rejects.toThrow(
      "Airdrop only available on devnet"
    );
  });
});

// ─── MemoPayload schema ───────────────────────────────────────────────────────

describe("MemoPayload schema", () => {
  it("memo has required fields with correct types", async () => {
    const result = await ledger.log("test:action", {
      data: { foo: "bar", num: 42 },
    });
    const { memo } = result;
    expect(memo.v).toBe("1");
    expect(typeof memo.agent).toBe("string");
    expect(typeof memo.action).toBe("string");
    expect(typeof memo.ts).toBe("number");
    expect(memo.data?.foo).toBe("bar");
    expect(memo.data?.num).toBe(42);
  });
});

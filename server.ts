import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Connection, PublicKey } from "@solana/web3.js";

// ========================================== //
// CONFIG
// ========================================== //
const BLOCK_INTERVAL = 1200; // 20 minutes
const TOTAL_SUPPLY = 90_000_000;
const MINING_DAYS = 180;
const TOTAL_BLOCKS = Math.floor((MINING_DAYS * 24 * 60) / 20); // 12,960
const HASHPOWER_PER_SOL = 1000;

// TREASURY WALLET (Using a placeholder, user should replace)
const TREASURY_WALLET = "ExnusTreasury111111111111111111111111111111";
const connection = new Connection("https://api.mainnet-beta.solana.com");

// ========================================== //
// STATE (In-Memory Engine)
// ========================================== //
interface User {
  wallet: string;
  hashpower: number;
  totalEarned: number;
  lastReward: number;
}

interface BlockHistory {
  blockNumber: number;
  timestamp: number;
  reward: number;
  totalHashpower: number;
}

let state = {
  currentBlock: 0,
  lastBlockTimestamp: Math.floor(Date.now() / 1000),
  totalDistributed: 0,
  users: [] as User[],
  history: [] as BlockHistory[],
  usedSignatures: new Set<string>(),
};

// ========================================== //
// ENGINE LOGIC
// ========================================== //
function now() {
  return Math.floor(Date.now() / 1000);
}

function getBlockReward() {
  const remainingSupply = TOTAL_SUPPLY - state.totalDistributed;
  const remainingBlocks = TOTAL_BLOCKS - state.currentBlock;
  if (remainingBlocks <= 0) return 0;
  return remainingSupply / remainingBlocks;
}

function processBlock() {
  if (state.currentBlock >= TOTAL_BLOCKS) return;

  const blockReward = getBlockReward();
  const totalHashpower = state.users.reduce((sum, u) => sum + u.hashpower, 0);

  if (totalHashpower > 0) {
    state.users.forEach((user) => {
      const share = user.hashpower / totalHashpower;
      const reward = share * blockReward;
      user.totalEarned += reward;
      user.lastReward = reward;
      state.totalDistributed += reward;
    });
  }

  state.history.unshift({
    blockNumber: state.currentBlock,
    timestamp: state.lastBlockTimestamp,
    reward: blockReward,
    totalHashpower,
  });

  // Keep history manageable
  if (state.history.length > 100) state.history.pop();

  state.currentBlock++;
  state.lastBlockTimestamp += BLOCK_INTERVAL;
}

// Auto-tick engine
setInterval(() => {
  const diff = now() - state.lastBlockTimestamp;
  const blocks = Math.floor(diff / BLOCK_INTERVAL);
  for (let i = 0; i < blocks; i++) {
    processBlock();
  }
}, 5000);

// ========================================== //
// SERVER SETUP
// ========================================== //
async function startServer() {
  const app = express();
  app.use(express.json());

  // API ROUTES
  app.get("/api/status", (req, res) => {
    const elapsed = now() - state.lastBlockTimestamp;
    const countdown = BLOCK_INTERVAL - (elapsed % BLOCK_INTERVAL);
    
    res.json({
      currentBlock: state.currentBlock,
      totalBlocks: TOTAL_BLOCKS,
      countdown,
      totalDistributed: state.totalDistributed,
      remainingSupply: TOTAL_SUPPLY - state.totalDistributed,
      totalHashpower: state.users.reduce((sum, u) => sum + u.hashpower, 0),
      activeMiners: state.users.filter(u => u.hashpower > 0).length,
    });
  });

  app.get("/api/user/:wallet", (req, res) => {
    const { wallet } = req.params;
    let user = state.users.find((u) => u.wallet === wallet);
    if (!user) {
      user = { wallet, hashpower: 0, totalEarned: 0, lastReward: 0 };
      state.users.push(user);
    }
    res.json(user);
  });

  app.get("/api/history", (req, res) => {
    res.json(state.history);
  });

  app.get("/api/leaderboard", (req, res) => {
    const sorted = [...state.users]
      .sort((a, b) => b.totalEarned - a.totalEarned)
      .slice(0, 20);
    res.json(sorted);
  });

  app.post("/api/buy-hashpower", async (req, res) => {
    const { wallet, signature, solAmount } = req.body;

    if (!wallet || !signature || !solAmount) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    if (state.usedSignatures.has(signature)) {
      return res.status(400).json({ error: "Signature already used" });
    }

    try {
      // In a real app, we'd verify the signature on-chain here.
      // For this prototype, we'll simulate the verification but keep the logic structure.
      // const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
      // ... verification logic ...
      
      // Simulate success for prototype purposes if the signature is "new"
      state.usedSignatures.add(signature);
      
      let user = state.users.find((u) => u.wallet === wallet);
      if (!user) {
        user = { wallet, hashpower: 0, totalEarned: 0, lastReward: 0 };
        state.users.push(user);
      }

      const hpToAdd = solAmount * HASHPOWER_PER_SOL;
      user.hashpower += hpToAdd;

      res.json({ 
        success: true, 
        added: hpToAdd, 
        totalHashpower: user.hashpower 
      });
    } catch (error) {
      res.status(500).json({ error: "Verification failed" });
    }
  });

  // VITE MIDDLEWARE
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Exnus Engine running on http://localhost:${PORT}`);
  });
}

startServer();

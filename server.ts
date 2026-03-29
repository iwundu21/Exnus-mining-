import express from "express";
import { createServer as createViteServer } from "vite";
import { Connection } from "@solana/web3.js";
import path from "path";

const app = express();
app.use(express.json());

// ==========================================
// CONFIG
// ==========================================
const BLOCK_INTERVAL = 1200; // 20 minutes
const TOTAL_SUPPLY = 90_000_000;
const MINING_DAYS = 180;

const TOTAL_BLOCKS = Math.floor((MINING_DAYS * 24 * 60) / 20); // 12,960
const HASHPOWER_PER_SOL = 1000;

const TREASURY_WALLET = "YOUR_SOL_WALLET";
const connection = new Connection("https://api.mainnet-beta.solana.com");

// Fixed start time: 2026-03-28 21:30:00 UTC
const GENESIS_TIMESTAMP = 1774733400; 

// ==========================================
// STATE
// ==========================================
let state = {
  currentBlock: 0,
  lastBlockTimestamp: GENESIS_TIMESTAMP,
  totalDistributed: 0,
  users: [] as any[],
  usedSignatures: new Set<string>(), // prevent replay
  history: [] as any[], // store block history
};

// ==========================================
// TIME
// ==========================================
function now() {
  return Math.floor(Date.now() / 1000);
}

function getCountdown() {
  const elapsed = now() - state.lastBlockTimestamp;
  if (elapsed < 0) {
    return Math.abs(elapsed);
  }
  return BLOCK_INTERVAL - (elapsed % BLOCK_INTERVAL);
}

// ==========================================
// USER HELPER
// ==========================================
function getUser(wallet: string) {
  let user = state.users.find((u) => u.wallet === wallet);

  if (!user) {
    user = { wallet, hashpower: 0, totalEarned: 0, history: [] };
    state.users.push(user);
  }

  return user;
}

// ==========================================
// DYNAMIC BLOCK REWARD
// ==========================================
function getBlockReward() {
  const remainingSupply = TOTAL_SUPPLY - state.totalDistributed;
  const remainingBlocks = TOTAL_BLOCKS - state.currentBlock;

  if (remainingBlocks <= 0) return 0;

  return remainingSupply / remainingBlocks;
}

// ==========================================
// REWARD DISTRIBUTION
// ==========================================
function processBlock() {
  if (state.currentBlock >= TOTAL_BLOCKS) {
    console.log("⛔ Mining finished");
    return;
  }

  const blockReward = getBlockReward();

  const totalHashpower = state.users.reduce(
    (sum, u) => sum + u.hashpower,
    0
  );

  console.log(`\n⛏ Block #${state.currentBlock}`);
  console.log(`Reward: ${blockReward.toFixed(4)}`);

  state.users.forEach((user) => {
    const reward = totalHashpower > 0 ? (user.hashpower / totalHashpower) * blockReward : 0;

    user.totalEarned += reward;
    state.totalDistributed += reward;

    if (!user.history) user.history = [];
    user.history.unshift({
      blockNumber: state.currentBlock,
      reward: reward,
      timestamp: state.lastBlockTimestamp,
      hashpower: user.hashpower
    });

    // Keep last 20 user history items
    if (user.history.length > 20) user.history.pop();

    console.log(
      `💰 ${user.wallet} → ${reward.toFixed(4)}`
    );
  });

  state.history.unshift({
    blockNumber: state.currentBlock,
    timestamp: state.lastBlockTimestamp,
    reward: blockReward,
    totalHashpower: totalHashpower,
    activeMiners: state.users.filter(u => u.hashpower > 0).length,
  });

  // Keep only the last 50 blocks in history to prevent memory leak
  if (state.history.length > 50) {
    state.history.pop();
  }

  state.currentBlock++;
  state.lastBlockTimestamp += BLOCK_INTERVAL;
}

// ==========================================
// AUTO ENGINE
// ==========================================
function checkBlocks() {
  const diff = now() - state.lastBlockTimestamp;
  if (diff < 0) return; // Not started yet

  const blocks = Math.floor(diff / BLOCK_INTERVAL);

  for (let i = 0; i < blocks; i++) {
    processBlock();
  }
}

checkBlocks(); // Run immediately on startup
setInterval(checkBlocks, 5000);

// ==========================================
// VERIFY SOL PAYMENT
// ==========================================
async function verifySolPayment(signature: string, amount: number, wallet: string) {
  if (state.usedSignatures.has(signature)) return false;

  try {
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return false;

    const instructions = tx.transaction.message.instructions;

    for (let ix of instructions) {
      if ('program' in ix && ix.program === "system") {
        const info = (ix as any).parsed.info;

        if (
          info.destination === TREASURY_WALLET &&
          info.source === wallet &&
          info.lamports === amount * 1e9
        ) {
          state.usedSignatures.add(signature);
          return true;
        }
      }
    }

    return false;
  } catch (e) {
    console.log("Verification error", e);
    return false;
  }
}

// ==========================================
// API
// ==========================================

// Status
app.get("/api/status", (req, res) => {
  const activeMiners = state.users.filter(u => u.hashpower > 0).length;
  const totalUsers = state.users.length;
  const totalHashpower = state.users.reduce((sum, u) => sum + u.hashpower, 0);
  
  res.json({
    currentBlock: state.currentBlock,
    totalBlocks: TOTAL_BLOCKS,
    countdown: getCountdown(),
    blockReward: getBlockReward(),
    totalDistributed: state.totalDistributed,
    remainingSupply: TOTAL_SUPPLY - state.totalDistributed,
    totalHashpower,
    activeMiners,
    totalUsers,
    miners: state.users,
  });
});

// Get User
app.get("/api/user/:wallet", (req, res) => {
  const user = getUser(req.params.wallet);
  res.json(user);
});

// Buy hashpower
app.post("/api/buy-hashpower", async (req, res) => {
  const { wallet, signature, solAmount } = req.body;

  if (!wallet || !signature || !solAmount) {
    return res.status(400).json({ error: "Missing params" });
  }

  const valid = await verifySolPayment(
    signature,
    solAmount,
    wallet
  );

  if (!valid) {
    return res.status(400).json({ error: "Invalid payment" });
  }

  const user = getUser(wallet);

  const hp = solAmount * HASHPOWER_PER_SOL;
  user.hashpower += hp;

  res.json({
    message: "Hashpower added",
    added: hp,
    totalHashpower: user.hashpower,
  });
});

// Manual hashpower
app.post("/api/set-hashpower", (req, res) => {
  const { wallet, hashpower } = req.body;

  const user = getUser(wallet);
  user.hashpower = hashpower;

  res.json(user);
});

// Leaderboard
app.get("/api/leaderboard", (req, res) => {
  const sorted = [...state.users].sort(
    (a, b) => b.totalEarned - a.totalEarned
  );

  res.json(sorted);
});

// History
app.get("/api/history", (req, res) => {
  res.json(state.history);
});

// ==========================================
// STARTUP AND VITE MIDDLEWARE
// ==========================================
async function startServer() {
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Exnus Mining Engine Live on http://localhost:${PORT}`);
  });
}

startServer();

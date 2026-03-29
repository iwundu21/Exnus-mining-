import express from "express";
import { createServer as createViteServer } from "vite";
import { Connection } from "@solana/web3.js";
import path from "path";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit, addDoc, updateDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = express();
app.use(express.json());

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

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
// STATE (Now backed by Firestore)
// ==========================================
let state = {
  currentBlock: 0,
  lastBlockTimestamp: GENESIS_TIMESTAMP,
  totalDistributed: 0,
  users: [] as any[],
  usedSignatures: new Set<string>(), // prevent replay
  history: [] as any[], // store block history
};

// Sync state from Firestore on startup
async function syncState() {
  try {
    const statusDoc = await getDoc(doc(db, 'status', 'global'));
    if (statusDoc.exists()) {
      const data = statusDoc.data();
      state.currentBlock = data.currentBlock;
      state.lastBlockTimestamp = data.lastBlockTimestamp;
      state.totalDistributed = data.totalDistributed;
    }

    const usersSnap = await getDocs(collection(db, 'users'));
    state.users = usersSnap.docs.map(d => d.data());

    const historySnap = await getDocs(query(collection(db, 'history'), orderBy('blockNumber', 'desc'), limit(50)));
    state.history = historySnap.docs.map(d => d.data());
  } catch (err) {
    console.error("Error syncing state from Firestore:", err);
  }
}

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
async function getUser(wallet: string) {
  let user = state.users.find((u) => u.wallet === wallet);

  if (!user) {
    user = { wallet, hashpower: 0, totalEarned: 0, history: [] };
    state.users.push(user);
    // Save to Firestore
    await setDoc(doc(db, 'users', wallet), user);
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
async function processBlock() {
  if (state.currentBlock >= TOTAL_BLOCKS) {
    console.log("⛔ Mining finished");
    return;
  }

  const blockReward = getBlockReward();

  const totalHashpower = state.users.reduce(
    (sum, u) => sum + u.hashpower,
    0
  );

  if (totalHashpower === 0) {
    console.log(`[EXNUS ENGINE] Zero network hashpower detected. Block #${state.currentBlock} rewards deferred to maintain economic scarcity. Generating null-hash cryptographic record.`);
    
    for (const user of state.users) {
      const record = {
        blockNumber: state.currentBlock,
        reward: 0,
        timestamp: state.lastBlockTimestamp,
        hashpower: user.hashpower,
        note: "Empty Block - No Hashpower"
      };
      if (!user.history) user.history = [];
      user.history.unshift(record);
      if (user.history.length > 20) user.history.pop();
      await addDoc(collection(db, 'users', user.wallet, 'history'), record);
    }

    const emptyBlockData = {
      blockNumber: state.currentBlock,
      timestamp: state.lastBlockTimestamp,
      reward: 0,
      totalHashpower: 0,
      activeMiners: 0,
      status: "DEFERRED"
    };
    state.history.unshift(emptyBlockData);
    if (state.history.length > 50) state.history.pop();
    await addDoc(collection(db, 'history'), emptyBlockData);

    state.lastBlockTimestamp += BLOCK_INTERVAL;
    await setDoc(doc(db, 'status', 'global'), {
      currentBlock: state.currentBlock,
      lastBlockTimestamp: state.lastBlockTimestamp,
      totalDistributed: state.totalDistributed
    });
    return;
  }

  console.log(`\n⛏ Block #${state.currentBlock}`);
  console.log(`Reward: ${blockReward.toFixed(4)}`);

  const blockData = {
    blockNumber: state.currentBlock,
    timestamp: state.lastBlockTimestamp,
    reward: blockReward,
    totalHashpower: totalHashpower,
    activeMiners: state.users.filter(u => u.hashpower > 0).length,
  };

  // Update users and their history in Firestore
  for (const user of state.users) {
    const reward = totalHashpower > 0 ? (user.hashpower / totalHashpower) * blockReward : 0;

    user.totalEarned += reward;
    state.totalDistributed += reward;

    const record = {
      blockNumber: state.currentBlock,
      reward: reward,
      timestamp: state.lastBlockTimestamp,
      hashpower: user.hashpower
    };

    if (!user.history) user.history = [];
    user.history.unshift(record);
    if (user.history.length > 20) user.history.pop();

    // Persist user update and history record
    await updateDoc(doc(db, 'users', user.wallet), {
      totalEarned: user.totalEarned,
      lastReward: reward
    });
    await addDoc(collection(db, 'users', user.wallet, 'history'), record);

    console.log(`💰 ${user.wallet} → ${reward.toFixed(4)}`);
  }

  state.history.unshift(blockData);
  if (state.history.length > 50) state.history.pop();

  // Persist global history and status
  await addDoc(collection(db, 'history'), blockData);
  
  state.currentBlock++;
  state.lastBlockTimestamp += BLOCK_INTERVAL;

  await setDoc(doc(db, 'status', 'global'), {
    currentBlock: state.currentBlock,
    lastBlockTimestamp: state.lastBlockTimestamp,
    totalDistributed: state.totalDistributed
  });
}

// ==========================================
// AUTO ENGINE
// ==========================================
async function checkBlocks() {
  const diff = now() - state.lastBlockTimestamp;
  if (diff < 0) return; // Not started yet

  const blocks = Math.floor(diff / BLOCK_INTERVAL);

  for (let i = 0; i < blocks; i++) {
    await processBlock();
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
app.get("/api/user/:wallet", async (req, res) => {
  const user = await getUser(req.params.wallet);
  // Fetch history from Firestore for this user
  const historySnap = await getDocs(query(collection(db, 'users', user.wallet, 'history'), orderBy('blockNumber', 'desc'), limit(20)));
  const history = historySnap.docs.map(d => d.data());
  res.json({ ...user, history });
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

  const user = await getUser(wallet);

  const hp = solAmount * HASHPOWER_PER_SOL;
  user.hashpower += hp;

  // Persist update
  await updateDoc(doc(db, 'users', wallet), { hashpower: user.hashpower });

  res.json({
    message: "Hashpower added",
    added: hp,
    totalHashpower: user.hashpower,
  });
});

// Manual hashpower
app.post("/api/set-hashpower", async (req, res) => {
  const { wallet, hashpower } = req.body;

  const user = await getUser(wallet);
  user.hashpower = hashpower;
  
  await updateDoc(doc(db, 'users', wallet), { hashpower: user.hashpower });

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

  // Sync state from Firestore
  await syncState();

  // Initial check
  await checkBlocks();
  setInterval(checkBlocks, 5000);

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

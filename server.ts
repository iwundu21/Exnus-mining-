import express from "express";
import "dotenv/config";
import { createServer as createViteServer } from "vite";
import { Connection } from "@solana/web3.js";
import path from "path";
import fs from "fs";
import axios from "axios";
import crypto from "crypto";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
console.log(`📦 Loading Firebase config from ${firebaseConfigPath}...`);
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
console.log(`✅ Firebase config loaded for project: ${firebaseConfig.projectId}`);

// ==========================================
// CRYPTO SCRAMBLER
// ==========================================
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "exnus_mining_engine_secure_key_32"; // 32 chars
const IV_LENGTH = 16;

function encrypt(text: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string) {
  try {
    const textParts = text.split(':');
    if (textParts.length < 2) return text;
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return text;
  }
}

function pack(data: any, plainFields: string[] = []) {
  const plain: any = {};
  plainFields.forEach(f => { if (data[f] !== undefined) plain[f] = data[f]; });
  return { ...plain, _e: encrypt(JSON.stringify(data)) };
}

function unpack(data: any) {
  if (data && data._e) {
    try {
      return JSON.parse(decrypt(data._e));
    } catch (e) {
      return data;
    }
  }
  return data;
}

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
const HASHPOWER_PER_SOL = 70;

const TREASURY_WALLET = "H2bdBhMeNwjekkpsyM2g7pCDuWUxgxADMGh4q8xAnt8J";
const connection = new Connection("https://solana.llamarpc.com", "confirmed");

// Fixed start time: 2026-03-29 10:08:10 UTC
const GENESIS_TIMESTAMP = 1774778890; 

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
  console.log("📦 Starting syncState...");
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Sync timeout")), 10000));
  
  try {
    await Promise.race([
      (async () => {
        const statusDoc = await getDoc(doc(db, 'status', 'global'));
        if (statusDoc.exists()) {
          const data = unpack(statusDoc.data());
          state.currentBlock = Number(data.currentBlock) || 0;
          state.lastBlockTimestamp = Number(data.lastBlockTimestamp) || GENESIS_TIMESTAMP;
          state.totalDistributed = Number(data.totalDistributed) || 0;
          
          const expectedTimestamp = GENESIS_TIMESTAMP + (state.currentBlock * BLOCK_INTERVAL);
          if (Math.abs(state.lastBlockTimestamp - expectedTimestamp) > BLOCK_INTERVAL) {
            console.warn(`[EXNUS] Timestamp inconsistency detected. Expected ${expectedTimestamp}, got ${state.lastBlockTimestamp}. Resetting...`);
            state.lastBlockTimestamp = expectedTimestamp;
          }
        }

        const usersSnap = await getDocs(collection(db, 'users'));
        state.users = usersSnap.docs.map(d => unpack(d.data()));

        const historySnap = await getDocs(query(collection(db, 'history'), orderBy('blockNumber', 'desc'), limit(100)));
        const rawHistory = historySnap.docs.map(d => unpack(d.data()));
        state.history = rawHistory.reduce((acc: any[], current: any) => {
          const exists = acc.find(item => item.blockNumber === current.blockNumber && item.timestamp === current.timestamp);
          if (!exists) acc.push(current);
          return acc;
        }, []).slice(0, 50);
      })(),
      timeout
    ]);
    console.log("✅ syncState completed.");
  } catch (err) {
    console.error("❌ Error syncing state from Firestore:", err);
  }
}

// ==========================================
// TIME
// ==========================================
function now() {
  return Math.floor(Date.now() / 1000);
}

function getCountdown() {
  const nextBlockTimestamp = GENESIS_TIMESTAMP + (state.currentBlock + 1) * BLOCK_INTERVAL;
  const remaining = nextBlockTimestamp - now();
  
  // If we are behind (remaining < 0), it should show 0 until processed
  if (remaining < 0) return 0;
  
  // If it's more than the interval, something is wrong with our state, return 0 or interval
  if (remaining > BLOCK_INTERVAL) return BLOCK_INTERVAL;
  
  return remaining;
}

// ==========================================
// USER HELPER
// ==========================================
async function getUser(wallet: string, req?: any) {
  let user = state.users.find((u) => u.wallet === wallet);
  let isNew = false;

  if (!user) {
    user = { 
      wallet, 
      hashpower: 0, 
      totalEarned: 0, 
      history: [], 
      solSpent: 0,
      ip: req?.ip || req?.headers['x-forwarded-for'] || 'unknown',
      country: 'Unknown',
      countryCode: 'UN'
    };
    isNew = true;
  }

  // Detect country if missing or unknown
  if (user.country === 'Unknown' || !user.countryCode) {
    const ip = (req?.ip || req?.headers['x-forwarded-for'] || user.ip || 'unknown').split(',')[0].trim();
    if (ip !== 'unknown' && ip !== '::1' && ip !== '127.0.0.1') {
      try {
        const geoRes = await axios.get(`http://ip-api.com/json/${ip}`);
        if (geoRes.data && geoRes.data.status === 'success') {
          user.country = geoRes.data.country;
          user.countryCode = geoRes.data.countryCode;
          user.ip = ip;
          
          // Update in Firestore
          await setDoc(doc(db, 'users', wallet), pack(user, ['wallet']));
        }
      } catch (e) {
        console.error("GeoIP error:", e);
      }
    }
  }

  if (isNew) {
    state.users.push(user);
    await setDoc(doc(db, 'users', wallet), pack(user, ['wallet']));
  }

  return user;
}

async function saveUser(user: any) {
  try {
    await setDoc(doc(db, 'users', user.wallet), pack(user, ['wallet']));
  } catch (e) {
    console.error(`❌ Firestore Error (saveUser ${user.wallet}):`, e);
  }
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
  if (state.currentBlock === undefined || isNaN(state.currentBlock)) state.currentBlock = 0;
  if (state.lastBlockTimestamp === undefined || isNaN(state.lastBlockTimestamp)) state.lastBlockTimestamp = GENESIS_TIMESTAMP;

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
    
    // Only process users who have some hashpower (though in this block it should be zero)
    // Actually, if totalHashpower is 0, we don't need to add history to anyone.
    // We just log the empty block globally.

    const emptyBlockData = {
      blockNumber: state.currentBlock,
      timestamp: state.lastBlockTimestamp,
      reward: 0,
      totalHashpower: 0,
      activeMiners: 0,
      status: "DEFERRED"
    };
    
    const globalExists = state.history.some((h: any) => h.blockNumber === emptyBlockData.blockNumber && h.timestamp === emptyBlockData.timestamp);
    if (!globalExists) {
      state.history.unshift(emptyBlockData);
      if (state.history.length > 50) state.history.pop();
    }
    try {
      await setDoc(doc(db, 'history', `${state.currentBlock}-${state.lastBlockTimestamp}`), pack(emptyBlockData, ['blockNumber', 'timestamp']));
    } catch (err) {
      console.error("❌ Firestore Error (history):", err);
    }

    state.currentBlock++;
    state.lastBlockTimestamp += BLOCK_INTERVAL;
    try {
      await setDoc(doc(db, 'status', 'global'), pack({
        currentBlock: state.currentBlock,
        lastBlockTimestamp: state.lastBlockTimestamp,
        totalDistributed: state.totalDistributed
      }));
    } catch (err) {
      console.error("❌ Firestore Error (status):", err);
    }
    return;
  }

  console.log(`\n⛏ Block #${state.currentBlock}`);
  console.log(`Reward: ${blockReward.toFixed(4)}`);

  const blockHash = crypto.createHash('sha256').update(`${state.currentBlock}-${state.lastBlockTimestamp}-${totalHashpower}`).digest('hex');

  const blockData = {
    blockNumber: state.currentBlock,
    timestamp: state.lastBlockTimestamp,
    reward: blockReward,
    totalHashpower: totalHashpower,
    activeMiners: state.users.filter(u => u.hashpower > 0).length,
    hash: blockHash
  };

  // Update only users with active hashpower
  const activeUsers = state.users.filter(u => u.hashpower > 0);
  
  for (const user of activeUsers) {
    const reward = (user.hashpower / totalHashpower) * blockReward;

    user.totalEarned += reward;
    state.totalDistributed += reward;

  const record = {
    blockNumber: state.currentBlock,
    reward: reward,
    timestamp: state.lastBlockTimestamp,
    hashpower: user.hashpower,
    hash: blockHash
  };

  if (!user.history) user.history = [];
  
  // Check for duplicate before unshifting
  const exists = user.history.some((h: any) => h.blockNumber === record.blockNumber && h.timestamp === record.timestamp);
  if (!exists) {
    user.history.unshift(record);
    if (user.history.length > 20) user.history.pop();
  }

    // Persist user update and history record
    try {
      await setDoc(doc(db, 'users', user.wallet), pack(user, ['wallet']));
      await setDoc(doc(db, 'users', user.wallet, 'history', `${state.currentBlock}-${state.lastBlockTimestamp}`), pack(record, ['blockNumber', 'timestamp']));
      
      // Store in global history rewards subcollection
      await setDoc(doc(db, 'history', `${state.currentBlock}-${state.lastBlockTimestamp}`, 'rewards', user.wallet), pack({
        wallet: user.wallet,
        reward: reward,
        hashpower: user.hashpower,
        timestamp: state.lastBlockTimestamp,
        blockNumber: state.currentBlock,
        status: "CONFIRMED"
      }, ['wallet', 'blockNumber', 'timestamp']));
    } catch (err) {
      console.error(`❌ Firestore Error (user ${user.wallet}):`, err);
    }

    console.log(`💰 ${user.wallet} → ${reward.toFixed(4)}`);
  }

  // Check for duplicate in global history
  const globalExists = state.history.some((h: any) => h.blockNumber === blockData.blockNumber && h.timestamp === blockData.timestamp);
  if (!globalExists) {
    state.history.unshift(blockData);
    if (state.history.length > 50) state.history.pop();
  }

  // Persist global history and status
  try {
    await setDoc(doc(db, 'history', `${state.currentBlock}-${state.lastBlockTimestamp}`), pack(blockData, ['blockNumber', 'timestamp']));
    
    state.currentBlock++;
    state.lastBlockTimestamp += BLOCK_INTERVAL;

    await setDoc(doc(db, 'status', 'global'), pack({
      currentBlock: state.currentBlock,
      lastBlockTimestamp: state.lastBlockTimestamp,
      totalDistributed: state.totalDistributed
    }));
  } catch (err) {
    console.error("❌ Firestore Error (global):", err);
  }
}

// ==========================================
// AUTO ENGINE
// ==========================================
let isChecking = false;
async function checkBlocks() {
  if (isChecking) return;
  isChecking = true;
  try {
    const diff = now() - state.lastBlockTimestamp;
    if (diff < 0) return; // Not started yet

    // Calculate how many blocks we are behind
    const blocksBehind = Math.floor(diff / BLOCK_INTERVAL);

    if (blocksBehind > 0) {
      console.log(`[EXNUS ENGINE] Catching up ${blocksBehind} blocks...`);
      // Limit catch-up to prevent overwhelming
      const toProcess = Math.min(blocksBehind, 10);
      for (let i = 0; i < toProcess; i++) {
        await processBlock();
      }
    }
  } finally {
    isChecking = false;
  }
}

// ==========================================
// VERIFY SOL PAYMENT
// ==========================================
const fallbackRPCs = [
  "https://solana-mainnet.rpc.extrnode.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
  "https://solana.publicnode.com",
  "https://mainnet.helius-rpc.com/?api-key=49911993-9080-4966-993c-238435843234"
];

import bs58 from 'bs58';

async function verifySolPayment(signature: string, amount: number, wallet: string) {
  let finalSignature = signature;
  if (signature.endsWith('=') || signature.includes('+') || signature.includes('/') || 
      (signature.length === 88 && /[0OIl]/.test(signature))) {
    try {
      finalSignature = bs58.encode(Buffer.from(signature, 'base64'));
    } catch (e) {
      console.warn('Failed to decode base64 signature in backend, using original', e);
    }
  }

  if (state.usedSignatures.has(finalSignature)) return false;

  const connections = [connection, ...fallbackRPCs.map(rpc => new Connection(rpc))];

  for (const conn of connections) {
    try {
      const tx = await conn.getParsedTransaction(finalSignature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
      });

      if (!tx) continue;

      const instructions = tx.transaction.message.instructions;

      for (let ix of instructions) {
        if ('program' in ix && ix.program === "system") {
          const info = (ix as any).parsed.info;

          // Use rounded lamports for comparison
          const expectedLamports = Math.round(amount * 1e9);
          
          if (
            info.destination === TREASURY_WALLET &&
            info.source === wallet &&
            Math.abs(info.lamports - expectedLamports) < 100 // Allow tiny rounding difference
          ) {
            state.usedSignatures.add(finalSignature);
            return true;
          }
        }
      }
      
      // If we found the transaction but it didn't match our criteria, we don't need to check other RPCs
      return false;
    } catch (e) {
      console.log(`Verification error with RPC: ${conn.rpcEndpoint}`, e);
      // Try next RPC
    }
  }

  return false;
}

// ==========================================
// API
// ==========================================

// Status
app.get("/api/status", (req, res) => {
  const activeMiners = state.users.filter(u => u.hashpower > 0).length;
  const totalUsers = state.users.length;
  const totalHashpower = state.users.reduce((sum, u) => sum + u.hashpower, 0);
  
  const countdown = getCountdown();
  console.log(`[DEBUG] /api/status: now=${now()}, lastBlock=${state.lastBlockTimestamp}, diff=${now() - state.lastBlockTimestamp}, countdown=${countdown}`);
  
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

// Get Block Rewards
app.get("/api/history/:blockId/rewards", async (req, res) => {
  const { blockId } = req.params;
  try {
    const rewardsSnap = await getDocs(collection(db, 'history', blockId, 'rewards'));
    const rewards = rewardsSnap.docs.map(d => unpack(d.data()));
    res.json(rewards);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch rewards" });
  }
});

// Get User
app.get("/api/user/:wallet", async (req, res) => {
  const user = await getUser(req.params.wallet, req);
  // Fetch history from Firestore for this user
  const historySnap = await getDocs(query(collection(db, 'users', user.wallet, 'history'), orderBy('blockNumber', 'desc'), limit(40)));
  const rawHistory = historySnap.docs.map(d => unpack(d.data()));
  
  // Deduplicate by blockNumber and timestamp
  const history = rawHistory.reduce((acc: any[], current: any) => {
    const exists = acc.find(item => item.blockNumber === current.blockNumber && item.timestamp === current.timestamp);
    if (!exists) acc.push(current);
    return acc;
  }, []).slice(0, 20);

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

  const user = await getUser(wallet, req);

  // Pricing Tiers
  // 0.7 hashpower = 0.01 sol
  // 1 hashpower = 0.04 sol
  // 1.5 hashpower = 0.057 sol
  // 2 hashpower = 0.067 sol
  // 2.5 hashpower = 0.077 sol
  
  let hp = 0;
  const amount = Math.round(solAmount * 1000) / 1000; // Round to 3 decimal places
  
  if (amount <= 0.011 && amount >= 0.009) hp = 0.7;
  else if (amount <= 0.041 && amount >= 0.039) hp = 1.0;
  else if (amount <= 0.058 && amount >= 0.056) hp = 1.5;
  else if (amount <= 0.068 && amount >= 0.066) hp = 2.0;
  else if (amount <= 0.078 && amount >= 0.076) hp = 2.5;
  else {
    // Fallback to default if not a tier (though UI should prevent this)
    hp = solAmount * HASHPOWER_PER_SOL;
  }

  user.hashpower += hp;
  user.solSpent = (user.solSpent || 0) + solAmount;

  // Persist update
  await saveUser(user);

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
  
  await saveUser(user);

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
  // Deduplicate global history
  const uniqueHistory = state.history.reduce((acc: any[], current: any) => {
    const exists = acc.find(item => item.blockNumber === current.blockNumber && item.timestamp === current.timestamp);
    if (!exists) acc.push(current);
    return acc;
  }, []);
  res.json(uniqueHistory);
});

// Config
app.get("/api/config", (req, res) => {
  res.json({
    treasuryWallet: TREASURY_WALLET
  });
});

// ==========================================
// STARTUP AND VITE MIDDLEWARE
// ==========================================
async function startServer() {
  const PORT = 3000;
  console.log("🚀 Starting Exnus Mining Engine Server...");

  // Sync state from Firestore
  console.log("📦 Syncing state from Firestore...");
  await syncState();
  console.log("✅ State synced.");

  // Initial check
  console.log("🔍 Running initial block check...");
  // Moved to after app.listen

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("🛠️  Initializing Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("✅ Vite middleware ready.");
  } else {
    console.log("📦 Serving production build...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Exnus Mining Engine Live on http://localhost:${PORT}`);
    
    // Run catch-up in background after server starts
    (async () => {
      console.log("🔍 Running initial block check...");
      await checkBlocks();
      setInterval(checkBlocks, 5000);
      console.log("✅ Initial check complete.");
    })();
  });
}

startServer();

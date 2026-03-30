import express from "express";
import "dotenv/config";
import { createServer as createViteServer } from "vite";
import { Connection } from "@solana/web3.js";
import path from "path";
import fs from "fs";
import axios from "axios";
import crypto from "crypto";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit, addDoc, updateDoc, deleteDoc, where } from 'firebase/firestore';

import { 
  BLOCK_INTERVAL, 
  TOTAL_SUPPLY, 
  TOTAL_BLOCKS, 
  HASHPOWER_PER_SOL, 
  TREASURY_WALLET, 
  ADMIN_WALLET, 
  DEFAULT_GENESIS_TIMESTAMP 
} from "./src/lib/constants";

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
// CONFIG (Moved to constants.ts)
// ==========================================
const connection = new Connection("https://solana.llamarpc.com", "confirmed");

// Fixed start time
let GENESIS_TIMESTAMP = DEFAULT_GENESIS_TIMESTAMP; 

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
let initialSyncDone = false;
async function syncState() {
  if (initialSyncDone && isChecking) return; // Don't sync while mining is in progress
  
  console.log("📦 Starting syncState...");
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Sync timeout")), 10000));
  
  try {
    await Promise.race([
      (async () => {
        const statusDoc = await getDoc(doc(db, 'status', 'global'));
        if (statusDoc.exists()) {
          const data = unpack(statusDoc.data());
          const firestoreGenesis = Number(data.genesisTimestamp);
          
          if (firestoreGenesis) {
            GENESIS_TIMESTAMP = firestoreGenesis;
          } else {
            // Initialize if not present
            await setDoc(doc(db, 'status', 'global'), pack({
              currentBlock: 0,
              lastBlockTimestamp: DEFAULT_GENESIS_TIMESTAMP,
              totalDistributed: 0,
              genesisTimestamp: DEFAULT_GENESIS_TIMESTAMP
            }));
            GENESIS_TIMESTAMP = DEFAULT_GENESIS_TIMESTAMP;
          }
          
          // Only overwrite global state if we haven't started mining or if it's the first sync
          if (!initialSyncDone) {
            state.currentBlock = Number(data.currentBlock) || 0;
            state.lastBlockTimestamp = Number(data.lastBlockTimestamp) || GENESIS_TIMESTAMP;
            state.totalDistributed = Number(data.totalDistributed) || 0;
          }
        }

        const usersSnap = await getDocs(collection(db, 'users'));
        const users = usersSnap.docs.map(d => unpack(d.data()));
        
        // Merge with local state
        users.forEach(u => {
          const existing = state.users.find(eu => eu.wallet === u.wallet);
          if (!existing) {
            state.users.push(u);
          } else if (!initialSyncDone) {
            // Only overwrite existing users on first sync to avoid losing in-memory updates
            Object.assign(existing, u);
          }
        });

        if (!initialSyncDone) {
          const historySnap = await getDocs(query(collection(db, 'history'), orderBy('blockNumber', 'desc'), limit(100)));
          state.history = historySnap.docs.map(d => unpack(d.data())).slice(0, 50);
          initialSyncDone = true;
        }
      })(),
      timeout
    ]);
    console.log(`✅ syncState completed. Users: ${state.users.length}`);
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
  // The next block to be mined is state.currentBlock
  const nextBlockTimestamp = GENESIS_TIMESTAMP + (state.currentBlock * BLOCK_INTERVAL);
  const remaining = nextBlockTimestamp - now();
  
  // If we are behind (remaining < 0), it should show 0 until processed
  if (remaining < 0) return 0;
  
  return remaining;
}

// ==========================================
// USER HELPER
// ==========================================
function generateReferralId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789@#$';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function getUser(wallet: string, req?: any) {
  let user = state.users.find((u) => u.wallet === wallet);
  let isNew = false;

  if (!user) {
    // Generate a unique referral ID
    let referralId = generateReferralId();
    while (state.users.find(u => u.referralId === referralId)) {
      referralId = generateReferralId();
    }

    user = { 
      wallet, 
      referralId,
      hashpower: 0, 
      totalEarned: 0, 
      history: [], 
      solSpent: 0,
      referralCount: 0,
      referralRewards: 0,
      referralBonusClaimed: false,
      referredBy: req?.query?.ref || null, // This will now be a referralId
      ip: req?.ip || req?.headers['x-forwarded-for'] || 'unknown',
      country: 'Unknown',
      countryCode: 'UN'
    };
    isNew = true;
  }

  // Ensure existing users have a referralId
  if (!user.referralId) {
    let referralId = generateReferralId();
    while (state.users.find(u => u.referralId === referralId)) {
      referralId = generateReferralId();
    }
    user.referralId = referralId;
    await saveUser(user);
  }

  // Detect country if missing or unknown
  if (user.country === 'Unknown' || !user.countryCode) {
    const ip = (req?.ip || req?.headers['x-forwarded-for'] || user.ip || 'unknown').split(',')[0].trim();
    if (ip !== 'unknown' && ip !== '::1' && ip !== '127.0.0.1') {
      try {
        const geoRes = await axios.get(`http://ip-api.com/json/${ip}`, { timeout: 3000 });
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
  
  // Deterministic timestamp for the block being processed
  const blockTimestamp = GENESIS_TIMESTAMP + (state.currentBlock * BLOCK_INTERVAL);
  state.lastBlockTimestamp = blockTimestamp;

  if (state.currentBlock >= TOTAL_BLOCKS) {
    console.log("⛔ Mining finished");
    return;
  }

  const blockReward = getBlockReward();
  const totalHashpower = state.users.reduce((sum, u) => sum + (u.hashpower || 0), 0);

  const blockHash = crypto.createHash('sha256').update(`${state.currentBlock}-${blockTimestamp}-${totalHashpower}`).digest('hex');

  const blockData = {
    blockNumber: state.currentBlock,
    timestamp: blockTimestamp,
    reward: blockReward,
    totalHashpower: totalHashpower,
    activeMiners: state.users.filter(u => u.hashpower > 0).length,
    hash: blockHash,
    status: totalHashpower === 0 ? "DEFERRED" : "CONFIRMED"
  };

  console.log(`⛏ Block #${state.currentBlock} | Reward: ${blockReward.toFixed(4)} | Hashpower: ${totalHashpower}`);

  // Update only users with active hashpower
  const activeUsers = state.users.filter(u => u.hashpower > 0);
  
  if (totalHashpower > 0) {
    for (const user of activeUsers) {
      const reward = (user.hashpower / totalHashpower) * blockReward;
      user.totalEarned += reward;
      state.totalDistributed += reward;

      const rewardHash = crypto.createHash('sha256').update(`${state.currentBlock}-${blockTimestamp}-${user.wallet}-${reward}`).digest('hex');
      const record = {
        blockNumber: state.currentBlock,
        reward: reward,
        timestamp: blockTimestamp,
        hashpower: user.hashpower,
        hash: blockHash,
        rewardHash: rewardHash
      };

      if (!user.history) user.history = [];
      user.history.unshift(record);
      if (user.history.length > 20) user.history.pop();

      // Persist user update and history record
      try {
        await Promise.all([
          setDoc(doc(db, 'users', user.wallet), pack(user, ['wallet'])),
          setDoc(doc(db, 'users', user.wallet, 'history', `${state.currentBlock}-${blockTimestamp}`), pack(record, ['blockNumber', 'timestamp'])),
          setDoc(doc(db, 'history', `${state.currentBlock}-${blockTimestamp}`, 'rewards', user.wallet), pack({
            wallet: user.wallet,
            reward: reward,
            hashpower: user.hashpower,
            timestamp: blockTimestamp,
            blockNumber: state.currentBlock,
            status: "CONFIRMED",
            rewardHash: rewardHash
          }, ['wallet', 'blockNumber', 'timestamp']))
        ]);
      } catch (err) {
        console.error(`❌ Firestore Error (user ${user.wallet}):`, err);
      }
    }
  }

  // Update global history
  state.history.unshift(blockData);
  if (state.history.length > 50) state.history.pop();

  // Increment block BEFORE persisting status
  state.currentBlock++;
  const nextBlockTimestamp = GENESIS_TIMESTAMP + (state.currentBlock * BLOCK_INTERVAL);

  // Persist global history and status
  try {
    await Promise.all([
      setDoc(doc(db, 'history', `${blockData.blockNumber}-${blockTimestamp}`), pack(blockData, ['blockNumber', 'timestamp'])),
      setDoc(doc(db, 'status', 'global'), pack({
        currentBlock: state.currentBlock,
        lastBlockTimestamp: blockTimestamp, // This is the timestamp of the block just mined
        totalDistributed: state.totalDistributed,
        genesisTimestamp: GENESIS_TIMESTAMP
      }))
    ]);
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
    // Deterministic target block calculation based on time elapsed since genesis
    const currentTime = now();
    const timeElapsed = currentTime - GENESIS_TIMESTAMP;
    
    // If we haven't reached genesis yet, do nothing
    if (timeElapsed < 0) {
      isChecking = false;
      return;
    }

    const targetBlock = Math.floor(timeElapsed / BLOCK_INTERVAL);
    
    // If currentBlock is behind targetBlock, mine the missed blocks
    if (state.currentBlock <= targetBlock) {
      const blocksToMine = Math.min(targetBlock - state.currentBlock + 1, 100); // Max 100 at a time for stability
      if (blocksToMine > 0) {
        console.log(`[EXNUS ENGINE] Catching up: current=${state.currentBlock}, target=${targetBlock}, mining=${blocksToMine}`);
        for (let i = 0; i < blocksToMine; i++) {
          await processBlock();
        }
      }
    }
  } catch (err) {
    console.error("❌ Error in checkBlocks:", err);
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

// Get SOL Balance
app.get("/api/sol-balance/:wallet", async (req, res) => {
  const { wallet } = req.params;
  const apiKey = process.env.ALCHEMY_API_KEY || "BOTMZgnjnRcNK5cr21TnMAz64XAUbl_J";
  
  try {
    if (apiKey) {
      const response = await axios.post(`https://solana-mainnet.g.alchemy.com/v2/${apiKey}`, {
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [wallet]
      });
      
      if (!response.data.error) {
        return res.json({ balance: response.data.result.value / 1e9 });
      }
      console.warn("Alchemy balance fetch failed, falling back to standard RPC:", response.data.error.message);
    }

    // Fallback to standard connection
    const balance = await connection.getBalance(new (await import("@solana/web3.js")).PublicKey(wallet));
    res.json({ balance: balance / 1e9 });
  } catch (err) {
    console.error("Error fetching SOL balance:", err);
    res.status(500).json({ error: "Failed to fetch SOL balance" });
  }
});

// Status
app.get("/api/status", (req, res) => {
  const { adminWallet } = req.query;
  console.log(`DEBUG: /api/status called`);
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
    miners: adminWallet === ADMIN_WALLET ? state.users : [],
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
  console.log(`DEBUG: /api/user/${req.params.wallet} called`);
  try {
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
  } catch (err) {
    console.error(`Error fetching user data for ${req.params.wallet}:`, err);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

// Get Purchase History
app.get("/api/purchases/:wallet", async (req, res) => {
  const { wallet } = req.params;
  try {
    const purchasesSnap = await getDocs(query(collection(db, 'purchases'), where('wallet', '==', wallet), orderBy('timestamp', 'desc')));
    const purchases = purchasesSnap.docs.map(d => unpack(d.data()));
    res.json(purchases);
  } catch (err) {
    console.error(`Error fetching purchases for ${wallet}:`, err);
    res.status(500).json({ error: "Failed to fetch purchases" });
  }
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

  // Referral Bonus Logic: Both earn 0.004 TH/s after referred user's first purchase
  if (user.referredBy && !user.referralBonusClaimed) {
    const referrer = state.users.find(u => u.referralId === user.referredBy);
    if (referrer) {
      const BONUS = 0.004;
      referrer.hashpower = (referrer.hashpower || 0) + BONUS;
      referrer.referralCount = (referrer.referralCount || 0) + 1;
      referrer.referralRewards = (referrer.referralRewards || 0) + BONUS;
      
      user.hashpower += BONUS;
      user.referralBonusClaimed = true;
      
      console.log(`🎁 Referral Bonus Applied: ${user.wallet} and ${referrer.wallet} both received ${BONUS} TH/s`);
      await saveUser(referrer);
    }
  }

  // Persist update
  await saveUser(user);

  // Persist purchase record
  try {
    await addDoc(collection(db, 'purchases'), pack({
      wallet,
      solAmount,
      hashpowerAdded: hp,
      timestamp: now(),
      signature
    }));
  } catch (err) {
    console.error(`❌ Firestore Error (savePurchase ${wallet}):`, err);
  }

  res.json({
    message: "Hashpower added",
    added: hp,
    totalHashpower: user.hashpower,
  });
});

// Manual hashpower
app.post("/api/set-hashpower", async (req, res) => {
  const { wallet, hashpower, adminWallet } = req.body;

  if (adminWallet !== ADMIN_WALLET) {
    return res.status(403).json({ error: "Unauthorized access. Admin only." });
  }

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
  res.json(state.history);
});

// Config
app.get("/api/config", (req, res) => {
  res.json({
    treasuryWallet: TREASURY_WALLET
  });
});

// Set Genesis Timestamp
app.post("/api/admin/set-genesis", async (req, res) => {
  const { adminWallet, genesisTimestamp } = req.body;

  if (adminWallet !== ADMIN_WALLET) {
    return res.status(403).json({ error: "Unauthorized access. Admin only." });
  }

  try {
    const newGenesis = Number(genesisTimestamp);
    if (isNaN(newGenesis) || newGenesis <= 0) {
      return res.status(400).json({ error: "Invalid genesis timestamp." });
    }

    console.log(`⚠️ Admin requested to change genesis timestamp to ${newGenesis}.`);
    
    GENESIS_TIMESTAMP = newGenesis;
    state.currentBlock = 0;
    state.lastBlockTimestamp = newGenesis;
    
    // Update global status
    await setDoc(doc(db, 'status', 'global'), pack({
      currentBlock: state.currentBlock,
      lastBlockTimestamp: state.lastBlockTimestamp,
      totalDistributed: state.totalDistributed,
      genesisTimestamp: GENESIS_TIMESTAMP
    }));

    console.log(`✅ Genesis timestamp updated successfully.`);
    res.json({ success: true, message: "Genesis timestamp updated successfully", genesisTimestamp: GENESIS_TIMESTAMP });
  } catch (err) {
    console.error("❌ Failed to update genesis timestamp:", err);
    res.status(500).json({ error: "Failed to update genesis timestamp" });
  }
});

// Clear History
app.post("/api/admin/clear-history", async (req, res) => {
  const { adminWallet } = req.body;

  if (adminWallet !== ADMIN_WALLET) {
    return res.status(403).json({ error: "Unauthorized access. Admin only." });
  }

  try {
    console.log("⚠️ Admin requested to clear all history data.");
    
    // 1. Clear memory state
    state.history = [];
    
    // 2. Clear global history collection
    const historySnap = await getDocs(collection(db, 'history'));
    for (const d of historySnap.docs) {
      // Clear rewards subcollection
      const rewardsSnap = await getDocs(collection(db, 'history', d.id, 'rewards'));
      for (const r of rewardsSnap.docs) {
        await deleteDoc(doc(db, 'history', d.id, 'rewards', r.id));
      }
      await deleteDoc(doc(db, 'history', d.id));
    }

    // 3. Clear users' history subcollections
    const usersSnap = await getDocs(collection(db, 'users'));
    for (const u of usersSnap.docs) {
      const userHistorySnap = await getDocs(collection(db, 'users', u.id, 'history'));
      for (const uh of userHistorySnap.docs) {
        await deleteDoc(doc(db, 'users', u.id, 'history', uh.id));
      }
      // Clear in-memory user history
      const memUser = state.users.find(user => user.wallet === u.id);
      if (memUser) memUser.history = [];
    }

    console.log("✅ All history data cleared successfully.");
    res.json({ success: true, message: "History cleared successfully" });
  } catch (err) {
    console.error("❌ Failed to clear history:", err);
    res.status(500).json({ error: "Failed to clear history" });
  }
});

// Factory Reset
app.post("/api/admin/factory-reset", async (req, res) => {
  const { adminWallet } = req.body;

  if (adminWallet !== ADMIN_WALLET) {
    return res.status(403).json({ error: "Unauthorized access. Admin only." });
  }

  try {
    console.log("🚨 FACTORY RESET INITIATED BY ADMIN 🚨");

    // 1. Reset memory state
    const currentTime = now();
    GENESIS_TIMESTAMP = currentTime;
    state.users = [];
    state.history = [];
    state.usedSignatures = new Set();
    state.currentBlock = 0;
    state.totalDistributed = 0;
    state.lastBlockTimestamp = currentTime; // New genesis is NOW

    // 2. Clear Firestore collections
    // Update global status with new genesis
    await setDoc(doc(db, 'status', 'global'), pack({
      currentBlock: 0,
      lastBlockTimestamp: currentTime,
      totalDistributed: 0,
      genesisTimestamp: currentTime
    }));
    // Clear 'users'
    const usersSnap = await getDocs(collection(db, 'users'));
    for (const d of usersSnap.docs) {
      // Clear user history subcollection
      const userHistorySnap = await getDocs(collection(db, 'users', d.id, 'history'));
      for (const uh of userHistorySnap.docs) {
        await deleteDoc(doc(db, 'users', d.id, 'history', uh.id));
      }
      await deleteDoc(doc(db, 'users', d.id));
    }

    // Clear 'history'
    const historySnap = await getDocs(collection(db, 'history'));
    for (const d of historySnap.docs) {
      // Clear rewards subcollection
      const rewardsSnap = await getDocs(collection(db, 'history', d.id, 'rewards'));
      for (const r of rewardsSnap.docs) {
        await deleteDoc(doc(db, 'history', d.id, 'rewards', r.id));
      }
      await deleteDoc(doc(db, 'history', d.id));
    }

    // Clear 'status'
    const statusSnap = await getDocs(collection(db, 'status'));
    for (const d of statusSnap.docs) {
      await deleteDoc(doc(db, 'status', d.id));
    }

    // 3. Save new global status
    await setDoc(doc(db, 'status', 'global'), pack({
      currentBlock: state.currentBlock,
      lastBlockTimestamp: state.lastBlockTimestamp,
      totalDistributed: state.totalDistributed,
      genesisTimestamp: GENESIS_TIMESTAMP
    }));

    console.log("✅ Factory reset completed successfully.");
    res.json({ success: true, message: "Factory reset completed successfully. Network restarted at current timestamp." });
  } catch (err) {
    console.error("❌ Factory reset failed:", err);
    res.status(500).json({ error: "Factory reset failed" });
  }
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
      setInterval(checkBlocks, 1000);
      
      // Periodic user sync (every 30 seconds)
      setInterval(syncState, 30000);
      
      console.log("✅ Initial check complete.");
    })();
  });
}

startServer();

import express from "express";
import "dotenv/config";
import { createServer as createViteServer } from "vite";
import { Connection } from "@solana/web3.js";
import path from "path";
import fs from "fs";
import axios from "axios";
import crypto from "crypto";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit, addDoc, updateDoc, deleteDoc, where, runTransaction, writeBatch } from 'firebase/firestore';

import { 
  BLOCK_INTERVAL, 
  TOTAL_SUPPLY, 
  TOTAL_BLOCKS, 
  HASHPOWER_PER_SOL, 
  TREASURY_WALLET, 
  ADMIN_WALLET, 
  DEFAULT_GENESIS_TIMESTAMP 
} from "./src/lib/constants";

// Integer-safe reward (avoid floating issues)
const BASE_REWARD = Math.floor(TOTAL_SUPPLY / TOTAL_BLOCKS); 
// remainder to distribute in last block
const REMAINDER = TOTAL_SUPPLY - (BASE_REWARD * TOTAL_BLOCKS);

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

async function clearMiningData() {
  console.log("🧹 Clearing mining data...");
  
  // 1. Reset memory state
  state.users = [];
  state.history = [];
  state.usedSignatures = new Set();
  state.totalDistributed = 0;
  state.currentBlock = 0;
  state.lastBlockTimestamp = GENESIS_TIMESTAMP;
  state.genesisBlock = 0;
  
  // 2. Clear Firestore collections
  try {
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
  } catch (e: any) {
    handleFirestoreError(e, OperationType.DELETE, 'all');
  }
  
  console.log("✅ Mining data cleared.");
}

const app = express();
app.use(express.json());

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
console.log(`🔥 Initializing Firestore with Database ID: ${dbId}`);
let db = getFirestore(firebaseApp, dbId);

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
  genesisBlock: 0,
  paused: false,
};

let lastSyncTime = 0;
async function ensureSynced() {
  const nowTime = Date.now();
  if (nowTime - lastSyncTime > 5000) { // Sync every 5 seconds max
    await syncState();
    lastSyncTime = nowTime;
  }
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: undefined, // Server-side doesn't have a current user in the same way
      email: undefined,
      emailVerified: undefined,
      isAnonymous: undefined,
      tenantId: undefined,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Sync state from Firestore on startup
let initialSyncDone = false;
async function syncState() {
  if (initialSyncDone && isChecking) return; // Don't sync while mining is in progress
  
  console.log("📦 Starting syncState...");
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Sync timeout")), 10000));
  
  try {
    await Promise.race([
      (async () => {
        let statusDoc;
        try {
          statusDoc = await getDoc(doc(db, 'status', 'global'));
        } catch (e: any) {
          if (e.message.includes("NOT_FOUND") && dbId !== "(default)") {
            console.warn(`⚠️  Database ${dbId} not found. Falling back to (default).`);
            db = getFirestore(firebaseApp, "(default)");
            statusDoc = await getDoc(doc(db, 'status', 'global'));
          } else if (e.message.includes("permission") || e.code === 'permission-denied') {
            handleFirestoreError(e, OperationType.GET, 'status/global');
          } else {
            throw e;
          }
        }
        if (statusDoc && statusDoc.exists()) {
          const data = unpack(statusDoc.data());
          const firestoreGenesis = Number(data.genesisTimestamp);
          
          if (firestoreGenesis) {
            GENESIS_TIMESTAMP = firestoreGenesis;
          } else {
            // Initialize if not present
            try {
              await setDoc(doc(db, 'status', 'global'), pack({
                currentBlock: 0,
                lastBlockTimestamp: DEFAULT_GENESIS_TIMESTAMP,
                totalDistributed: 0,
                genesisTimestamp: DEFAULT_GENESIS_TIMESTAMP
              }));
            } catch (e: any) {
              handleFirestoreError(e, OperationType.WRITE, 'status/global');
            }
            GENESIS_TIMESTAMP = DEFAULT_GENESIS_TIMESTAMP;
          }
          
          // Always sync global state to stay in sync with other serverless instances
          const dbCurrentBlock = Number(data.currentBlock) || 0;
          state.paused = !!data.paused;
          
          // If Firestore block is higher
          console.log(`[DEBUG] syncState: dbCurrentBlock=${dbCurrentBlock}, state.currentBlock=${state.currentBlock}`);
          if (dbCurrentBlock > state.currentBlock) {
            console.log(`[DEBUG] syncState: Updating local state from Firestore`);
            state.currentBlock = dbCurrentBlock;
            state.lastBlockTimestamp = Number(data.lastBlockTimestamp) || GENESIS_TIMESTAMP;
            state.totalDistributed = Number(data.totalDistributed) || 0;
            state.genesisBlock = Number(data.genesisBlock) || 0;
          }
        }

        let usersSnap;
        try {
          usersSnap = await getDocs(collection(db, 'users'));
        } catch (e: any) {
          handleFirestoreError(e, OperationType.GET, 'users');
        }
        const users = usersSnap.docs.map(d => unpack(d.data()));
        
        // In a serverless environment, the DB is the absolute source of truth.
        // We must completely overwrite local state to prevent zombie data after a factory reset
        // and to ensure we see updates from other instances.
        state.users = users;

        let historySnap;
        try {
          historySnap = await getDocs(query(collection(db, 'history'), orderBy('blockNumber', 'desc'), limit(50)));
        } catch (e: any) {
          handleFirestoreError(e, OperationType.GET, 'history');
        }
        state.history = historySnap.docs.map(d => unpack(d.data()));
        
        initialSyncDone = true;
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
  const lastTime = state.lastBlockTimestamp || GENESIS_TIMESTAMP;
  const nextBlockDueAt = lastTime + BLOCK_INTERVAL;
  const remaining = nextBlockDueAt - now();
  console.log(`[DEBUG] getCountdown: lastTime=${lastTime}, nextBlockDueAt=${nextBlockDueAt}, now=${now()}, remaining=${remaining}`);
  
  return Math.max(0, remaining);
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
      withdrawnAmount: 0,
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
    const forwarded = req?.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : (req?.socket?.remoteAddress || 'unknown');
    
    if (ip !== 'unknown' && ip !== '::1' && ip !== '127.0.0.1' && !ip.startsWith('10.') && !ip.startsWith('172.')) {
      try {
        // Use https and a slightly more reliable service if possible, or stick to ip-api with https
        const geoRes = await axios.get(`https://ipapi.co/${ip}/json/`, { timeout: 5000 });
        if (geoRes.data && !geoRes.data.error) {
          user.country = geoRes.data.country_name;
          user.countryCode = geoRes.data.country_code;
          user.ip = ip;
          
          await saveUser(user);
        }
      } catch (e) {
        console.error("GeoIP error for IP", ip, ":", e);
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
  } catch (e: any) {
    handleFirestoreError(e, OperationType.WRITE, `users/${user.wallet}`);
  }
}

// ==========================================
// DYNAMIC BLOCK REWARD
// ==========================================
function getBlockReward(blockNumber: number) {
  if (blockNumber >= TOTAL_BLOCKS - 1) {
    return BASE_REWARD + REMAINDER; // last block adjustment
  }
  return BASE_REWARD;
}

// ==========================================
// REWARD DISTRIBUTION
// ==========================================
async function processBlock(): Promise<boolean> {
  if (state.paused) {
    console.log("Mining is paused.");
    return false;
  }
  if (state.currentBlock === undefined || isNaN(state.currentBlock)) state.currentBlock = 0;
  
  const blockToMine = state.currentBlock;
  const blockTimestamp = now();

  if (blockToMine >= TOTAL_BLOCKS) {
    console.log("⛔ Mining finished");
    return false;
  }

  let claimed = false;
  try {
    await runTransaction(db, async (transaction) => {
      const statusRef = doc(db, 'status', 'global');
      const statusDoc = await transaction.get(statusRef);
      
      if (statusDoc.exists()) {
        const data = unpack(statusDoc.data());
        const dbBlock = Number(data.currentBlock) || 0;
        if (dbBlock > blockToMine) {
          throw new Error("Block already mined by another instance");
        }
      }
      
      // Claim the block by incrementing the block number
      try {
        transaction.set(statusRef, pack({
          currentBlock: blockToMine + 1,
          lastBlockTimestamp: blockTimestamp,
          totalDistributed: state.totalDistributed, // Will update again after processing
          genesisTimestamp: GENESIS_TIMESTAMP,
          genesisBlock: state.genesisBlock
        }), { merge: true });
      } catch (e: any) {
        handleFirestoreError(e, OperationType.WRITE, 'status/global');
      }
    });
    claimed = true;
  } catch (e: any) {
    console.log(`[EXNUS ENGINE] Skipping block #${blockToMine}: ${e.message}`);
    await syncState(); // Sync to get the latest block
    return false;
  }

  if (!claimed) return false;

  // We successfully claimed the block. Now process rewards.
  state.currentBlock = blockToMine + 1;
  state.lastBlockTimestamp = blockTimestamp;

  const activeUsers = state.users.filter(u => u.hashpower > 0);
  const totalHashpower = activeUsers.reduce((sum, u) => sum + (u.hashpower || 0), 0);
  const blockReward = totalHashpower > 0 ? getBlockReward(blockToMine) : 0;

  const blockHash = crypto.createHash('sha256').update(`${blockToMine}-${blockTimestamp}-${totalHashpower}`).digest('hex');

  const blockData = {
    blockNumber: blockToMine,
    timestamp: blockTimestamp,
    reward: blockReward,
    totalHashpower: totalHashpower,
    activeMiners: activeUsers.length,
    hash: blockHash,
    status: totalHashpower === 0 ? "DEFERRED" : "CONFIRMED"
  };

  console.log(`⛏ Block #${blockToMine} | Reward: ${blockReward.toFixed(4)} | Hashpower: ${totalHashpower} | Miners: ${activeUsers.length}`);

  // Update only users with active hashpower
  if (totalHashpower > 0) {
    console.log(`[EXNUS ENGINE] Distributing rewards to ${activeUsers.length} active miners...`);
    
    // Process in chunks of 100 to avoid hitting Firestore batch limits (max 500 ops per batch)
    const chunkSize = 100;
    for (let i = 0; i < activeUsers.length; i += chunkSize) {
      const chunk = activeUsers.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      
      for (const user of chunk) {
        const reward = Math.floor((user.hashpower / totalHashpower) * blockReward);
        user.totalEarned += reward;
        state.totalDistributed += reward;

        // Referral commission: Referrer gets 10% of the reward
        if (user.referredBy) {
          const referrer = state.users.find(u => u.referralId === user.referredBy);
          if (referrer) {
            const commission = Math.floor(reward * 0.1);
            if (commission > 0) {
              referrer.totalEarned += commission;
              referrer.referralRewards = (referrer.referralRewards || 0) + commission;
              state.totalDistributed += commission;
              
              // Track referral reward
              const refRecord = {
                blockNumber: blockToMine,
                reward: commission,
                fromWallet: user.wallet,
                timestamp: blockTimestamp,
                type: 'referral_commission'
              };
              
              batch.set(doc(db, 'users', referrer.wallet, 'referralHistory', `${blockToMine}-${user.wallet}`), pack(refRecord, ['blockNumber', 'timestamp', 'reward', 'fromWallet']));
              batch.set(doc(db, 'users', referrer.wallet), pack(referrer, ['wallet', 'hashpower', 'totalEarned']));
            }
          }
        }

        const rewardHash = crypto.createHash('sha256').update(`${blockToMine}-${blockTimestamp}-${user.wallet}-${reward}`).digest('hex');
        const record = {
          blockNumber: blockToMine,
          reward: Math.floor(reward),
          timestamp: blockTimestamp,
          hashpower: user.hashpower,
          hash: blockHash,
          rewardHash: rewardHash
        };

        if (!user.history) user.history = [];
        user.history.unshift(record);
        if (user.history.length > 20) user.history.pop();

        // 1. Update user document
        batch.set(doc(db, 'users', user.wallet), pack(user, ['wallet', 'hashpower', 'totalEarned']));
        
        // 2. Add to user's personal history subcollection
        batch.set(doc(db, 'users', user.wallet, 'history', `${blockToMine}-${blockTimestamp}`), pack(record, ['blockNumber', 'timestamp', 'reward']));
        
        // 3. Add to global block rewards subcollection (for transparency)
        // CRITICAL: Must include 'reward' in plainFields for orderBy to work in Firestore
        batch.set(doc(db, 'history', `${blockToMine}-${blockTimestamp}`, 'rewards', user.wallet), pack({
          wallet: user.wallet,
          reward: Math.floor(reward),
          hashpower: user.hashpower,
          timestamp: blockTimestamp,
          blockNumber: blockToMine,
          status: "CONFIRMED",
          rewardHash: rewardHash
        }, ['wallet', 'blockNumber', 'timestamp', 'reward', 'hashpower', 'status', 'rewardHash']));
      }
      
      try {
        await batch.commit();
        console.log(`[EXNUS ENGINE] Batch ${Math.floor(i/chunkSize) + 1} committed successfully (${chunk.length} users).`);
      } catch (err) {
        console.error(`[EXNUS ENGINE] ❌ Batch ${Math.floor(i/chunkSize) + 1} failed:`, err);
      }
    }
  } else {
    console.log("[EXNUS ENGINE] No active miners to distribute rewards to.");
  }

  // Update global history
  state.history.unshift(blockData);
  if (state.history.length > 50) state.history.pop();

  // Persist global history and status (update totalDistributed)
  try {
    await Promise.all([
      setDoc(doc(db, 'history', `${blockData.blockNumber}-${blockTimestamp}`), pack(blockData, ['blockNumber', 'timestamp', 'reward', 'totalHashpower', 'activeMiners', 'status', 'hash'])),
      setDoc(doc(db, 'status', 'global'), pack({
        currentBlock: state.currentBlock,
        lastBlockTimestamp: blockTimestamp,
        totalDistributed: state.totalDistributed,
        genesisTimestamp: GENESIS_TIMESTAMP,
        genesisBlock: state.genesisBlock
      }, ['currentBlock', 'lastBlockTimestamp']))
    ]);
  } catch (err) {
    console.error("❌ Firestore Error (global):", err);
  }
  
  return true;
}

// ==========================================
// AUTO ENGINE
// ==========================================
let isChecking = false;
async function checkBlocks() {
  if (!initialSyncDone || isChecking || state.paused) return; // Added state.paused check
  isChecking = true;
  try {
    const currentTime = now();
    const lastTime = state.lastBlockTimestamp || GENESIS_TIMESTAMP;
    
    // If we haven't reached the first interval yet, do nothing
    if (currentTime < lastTime + BLOCK_INTERVAL) {
      isChecking = false;
      return;
    }

    if (currentTime >= (state.lastBlockTimestamp || GENESIS_TIMESTAMP) + BLOCK_INTERVAL && state.currentBlock < TOTAL_BLOCKS) {
      const nextBlockDueAt = (state.lastBlockTimestamp || GENESIS_TIMESTAMP) + BLOCK_INTERVAL;
      console.log(`[EXNUS ENGINE] Mining block #${state.currentBlock}: due=${nextBlockDueAt}, now=${currentTime}`);
      
      // CRITICAL: Sync state immediately before mining to ensure we have the latest active miners
      await syncState();
      
      await processBlock();
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
  "https://api.mainnet-beta.solana.com",
  "https://solana-api.syndica.io/public-rpc",
  "https://rpc.ankr.com/solana",
  "https://api.metaplex.solana.com"
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

  // Retry logic
  for (let attempt = 0; attempt < 3; attempt++) {
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
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retrying
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
app.get("/api/status", async (req, res) => {
  const { adminWallet } = req.query;
  console.log(`DEBUG: /api/status called`);
  
  await ensureSynced();
  await checkBlocks(); // Trigger mining check on status request (serverless)

  const activeMiners = state.users.filter(u => u.hashpower > 0).length;
  const totalUsers = state.users.length;
  const totalHashpower = state.users.reduce((sum, u) => sum + u.hashpower, 0);
  
  const countdown = getCountdown();
  const lastTime = state.lastBlockTimestamp || GENESIS_TIMESTAMP;
  const nextBlockDueAt = lastTime + BLOCK_INTERVAL;
  console.log(`[DEBUG] /api/status: now=${now()}, countdown=${countdown}`);
  
  res.json({
    currentBlock: state.currentBlock - state.genesisBlock,
    totalBlocks: TOTAL_BLOCKS,
    countdown: countdown,
    nextBlockDueAt: nextBlockDueAt,
    serverNow: now(),
    blockReward: getBlockReward(state.currentBlock),
    totalDistributed: state.totalDistributed,
    remainingSupply: TOTAL_SUPPLY - state.totalDistributed,
    totalHashpower,
    activeMiners,
    totalUsers,
    paused: state.paused,
    miners: adminWallet === ADMIN_WALLET ? state.users : [],
  });
});

// Get Block Rewards
app.get("/api/history/:blockId/rewards", async (req, res) => {
  const { blockId } = req.params;
  console.log(`DEBUG: Fetching rewards for blockId: ${blockId}`);
  try {
    const rewardsSnap = await getDocs(query(collection(db, 'history', blockId, 'rewards'), orderBy('reward', 'desc')));
    const rewards = rewardsSnap.docs.map(d => unpack(d.data()));
    console.log(`DEBUG: Found ${rewards.length} rewards for blockId: ${blockId}`);
    res.json(rewards);
  } catch (err) {
    console.error(`❌ Failed to fetch rewards for ${blockId}:`, err);
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

    // Calculate rank
    const sortedUsers = [...state.users].sort((a, b) => b.totalEarned - a.totalEarned);
    const rank = sortedUsers.findIndex(u => u.wallet === user.wallet) + 1;

    res.json({ ...user, history, rank });
  } catch (err) {
    console.error(`Error fetching user data for ${req.params.wallet}:`, err);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

// Update User Geo (Client-side fallback)
app.post("/api/user/:wallet/geo", async (req, res) => {
  try {
    const { wallet } = req.params;
    const { country, countryCode } = req.body;
    
    if (!country || !countryCode) {
      return res.status(400).json({ error: "Country and countryCode are required" });
    }

    const user = await getUser(wallet, req);
    user.country = country;
    user.countryCode = countryCode;
    
    await saveUser(user);
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating user geo:", err);
    res.status(500).json({ error: "Failed to update geo" });
  }
});

// Withdraw EXN
app.post("/api/withdraw", async (req, res) => {
  const { wallet, amount, signature } = req.body;

  if (!wallet || !amount || !signature) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    const user = await getUser(wallet, req);
    const availableBalance = (user.totalEarned || 0) - (user.withdrawnAmount || 0);

    if (amount > availableBalance) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // In a real scenario, we would verify the Solana transaction signature here
    // to ensure the user actually signed the withdrawal transaction on-chain.
    // For now, we'll assume the signature is valid if it's provided.
    
    // Update user state
    user.withdrawnAmount = (user.withdrawnAmount || 0) + amount;
    await saveUser(user);

    // Record the withdrawal in the purchases collection (as per user request)
    await addDoc(collection(db, 'purchases'), pack({
      wallet,
      type: 'withdrawal',
      amount: amount,
      currency: 'EXN',
      signature,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'completed'
    }));

    res.json({ success: true, newBalance: (user.totalEarned - user.withdrawnAmount) });
  } catch (err) {
    console.error(`Error processing withdrawal for ${wallet}:`, err);
    res.status(500).json({ error: "Failed to process withdrawal" });
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
  let hp = 0;
  const amount = Math.round(solAmount * 1000) / 1000; // Round to 3 decimal places
  
  if (amount <= 0.011 && amount >= 0.009) hp = 0.7;
  else if (amount <= 0.041 && amount >= 0.039) hp = 1.0;
  else if (amount <= 0.058 && amount >= 0.056) hp = 1.5;
  else if (amount <= 0.068 && amount >= 0.066) hp = 2.0;
  else if (amount <= 0.078 && amount >= 0.076) hp = 2.5;
  else {
    hp = solAmount * HASHPOWER_PER_SOL;
  }

  user.hashpower += hp;
  user.solSpent = (user.solSpent || 0) + solAmount;

  // Referral Bonus Logic
  if (user.referredBy && !user.referralBonusClaimed) {
    const referrer = state.users.find(u => u.referralId === user.referredBy);
    if (referrer) {
      const BONUS = 0.004;
      referrer.hashpower = (referrer.hashpower || 0) + BONUS;
      referrer.referralCount = (referrer.referralCount || 0) + 1;
      referrer.referralRewards = (referrer.referralRewards || 0) + BONUS;
      
      user.hashpower += BONUS;
      user.referralBonusClaimed = true;
      
      await saveUser(referrer);
    }
  }

  await saveUser(user);

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

    GENESIS_TIMESTAMP = newGenesis;
    await clearMiningData();
    
    await setDoc(doc(db, 'status', 'global'), pack({
      currentBlock: state.currentBlock,
      lastBlockTimestamp: state.lastBlockTimestamp,
      totalDistributed: state.totalDistributed,
      genesisTimestamp: GENESIS_TIMESTAMP,
      genesisBlock: state.genesisBlock
    }));

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

// Toggle Pause/Resume
app.post("/api/admin/toggle-pause", async (req, res) => {
  const { adminWallet, paused } = req.body;
  if (adminWallet !== ADMIN_WALLET) return res.status(403).json({ error: "Unauthorized" });

  state.paused = !!paused;
  await setDoc(doc(db, 'status', 'global'), pack({
    ...unpack((await getDoc(doc(db, 'status', 'global'))).data()!),
    paused: state.paused
  }), { merge: true });

  res.json({ success: true, paused: state.paused });
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
    
    await clearMiningData();
    
    state.currentBlock = 0;
    state.lastBlockTimestamp = currentTime; // New genesis is NOW

    // 2. Clear Firestore collections
    // Update global status with new genesis
    await setDoc(doc(db, 'status', 'global'), pack({
      currentBlock: 0,
      lastBlockTimestamp: currentTime,
      totalDistributed: 0,
      genesisTimestamp: currentTime,
      genesisBlock: 0
    }));
    
    // Clear 'status'
    const statusSnap = await getDocs(collection(db, 'status'));
    for (const d of statusSnap.docs) {
      if (d.id !== 'global') {
        await deleteDoc(doc(db, 'status', d.id));
      }
    }

    // 3. Save new global status
    await setDoc(doc(db, 'status', 'global'), pack({
      currentBlock: state.currentBlock,
      lastBlockTimestamp: state.lastBlockTimestamp,
      totalDistributed: state.totalDistributed,
      genesisTimestamp: GENESIS_TIMESTAMP,
      genesisBlock: 0
    }));

    console.log("✅ Factory reset completed successfully.");
    res.json({ success: true, message: "Factory reset completed successfully. Network restarted at current timestamp." });
  } catch (err) {
    console.error("❌ Factory reset failed:", err);
    res.status(500).json({ error: "Factory reset failed" });
  }
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
    
    // Run initial sync in background after server starts listening
    (async () => {
      console.log("🔍 Running initial block check and state sync...");
      await syncState();
      console.log("✅ Initial sync complete. Engine is running.");
    })();
  });
}

startServer();

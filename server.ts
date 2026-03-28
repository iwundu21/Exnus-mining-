import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, getDocs, increment, runTransaction } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

// ========================================== //
// FIREBASE SETUP
// ========================================== //
console.log("Initializing Firebase with config:", firebaseConfig.projectId);
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
console.log("Firestore initialized successfully");

// ========================================== //
// CONFIG
// ========================================== //
const BLOCK_INTERVAL = 1200; // 20 minutes
const TOTAL_SUPPLY = 90_000_000;
const MINING_DAYS = 180;
const TOTAL_BLOCKS = Math.floor((MINING_DAYS * 24 * 60) / 20); // 12,960
const HASHPOWER_PER_SOL = 1000;
const GENESIS_TIMESTAMP = 1711641600; // Fixed start date: March 28, 2024

// ========================================== //
// ENGINE LOGIC (Deterministic & Persistent)
// ========================================== //

interface GlobalState {
  lastProcessedBlock: number;
  accRewardPerShare: number;
  totalHashpower: number;
  totalDistributed: number;
}

async function getGlobalState(): Promise<GlobalState> {
  const globalRef = doc(db, "system", "state");
  const snap = await getDoc(globalRef);
  
  if (!snap.exists()) {
    console.log("Initializing global state in Firestore...");
    const initialState: GlobalState = {
      lastProcessedBlock: 0,
      accRewardPerShare: 0,
      totalHashpower: 0,
      totalDistributed: 0,
    };
    await setDoc(globalRef, initialState);
    return initialState;
  }
  return snap.data() as GlobalState;
}

function getBlockReward(blockNumber: number, totalDistributed: number) {
  const remainingSupply = TOTAL_SUPPLY - totalDistributed;
  const remainingBlocks = TOTAL_BLOCKS - blockNumber;
  if (remainingBlocks <= 0) return 0;
  return remainingSupply / remainingBlocks;
}

async function syncEngine(): Promise<GlobalState & { currentBlock: number }> {
  console.log("Syncing engine...");
  return await runTransaction(db, async (transaction) => {
    const globalRef = doc(db, "system", "state");
    const globalSnap = await transaction.get(globalRef);
    let state = (globalSnap.data() as GlobalState) || {
      lastProcessedBlock: 0,
      accRewardPerShare: 0,
      totalHashpower: 0,
      totalDistributed: 0,
    };

    const now = Math.floor(Date.now() / 1000);
    const currentBlock = Math.floor((now - GENESIS_TIMESTAMP) / BLOCK_INTERVAL);
    
    if (currentBlock > state.lastProcessedBlock) {
      console.log(`Processing ${currentBlock - state.lastProcessedBlock} missed blocks...`);
      let newAccRewardPerShare = state.accRewardPerShare;
      let newTotalDistributed = state.totalDistributed;
      
      // Process missed blocks
      for (let b = state.lastProcessedBlock + 1; b <= currentBlock; b++) {
        const reward = getBlockReward(b, newTotalDistributed);
        if (state.totalHashpower > 0) {
          newAccRewardPerShare += reward / state.totalHashpower;
        }
        newTotalDistributed += reward;

        // Log block to history
        const historyRef = doc(collection(db, "history"), b.toString());
        transaction.set(historyRef, {
          blockNumber: b,
          timestamp: GENESIS_TIMESTAMP + (b * BLOCK_INTERVAL),
          reward,
          totalHashpower: state.totalHashpower
        });
      }

      state.lastProcessedBlock = currentBlock;
      state.accRewardPerShare = newAccRewardPerShare;
      state.totalDistributed = newTotalDistributed;
      
      transaction.set(globalRef, state as any, { merge: true });
    }
    
    return { ...state, currentBlock };
  });
}

// ========================================== //
// SERVER SETUP
// ========================================== //
async function startServer() {
  const app = express();
  app.use(express.json());

  // API ROUTES
  app.get("/api/status", async (req, res) => {
    console.log("Fetching status...");
    try {
      const state = await syncEngine();
      console.log("Status fetched:", state);
      const now = Math.floor(Date.now() / 1000);
      const countdown = BLOCK_INTERVAL - ((now - GENESIS_TIMESTAMP) % BLOCK_INTERVAL);
      
      res.json({
        currentBlock: state.currentBlock,
        totalBlocks: TOTAL_BLOCKS,
        countdown,
        totalDistributed: state.totalDistributed,
        remainingSupply: TOTAL_SUPPLY - state.totalDistributed,
        totalHashpower: state.totalHashpower,
        activeMiners: 124, // Placeholder or query Firestore count
      });
    } catch (error) {
      console.error("Status error:", error);
      res.status(500).json({ error: "Failed to sync engine" });
    }
  });

  app.get("/api/user/:wallet", async (req, res) => {
    const { wallet } = req.params;
    try {
      const state = await syncEngine();
      const userRef = doc(db, "users", wallet);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        const newUser = {
          wallet,
          hashpower: 0,
          totalEarned: 0,
          rewardDebt: 0,
          lastReward: 0
        };
        await setDoc(userRef, newUser);
        return res.json(newUser);
      }
      
      const userData = userSnap.data();
      // Calculate pending rewards
      const pending = (userData.hashpower * state.accRewardPerShare) - userData.rewardDebt;
      
      res.json({
        ...userData,
        totalEarned: userData.totalEarned + pending,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.get("/api/history", async (req, res) => {
    try {
      const q = query(collection(db, "history"), orderBy("blockNumber", "desc"), limit(50));
      const snap = await getDocs(q);
      const history = snap.docs.map(doc => doc.data());
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.post("/api/buy-hashpower", async (req, res) => {
    const { wallet, signature, solAmount } = req.body;

    try {
      const state = await syncEngine();
      
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", wallet);
        const globalRef = doc(db, "system", "state");
        const sigRef = doc(db, "signatures", signature);
        
        const sigSnap = await transaction.get(sigRef);
        if (sigSnap.exists()) throw new Error("Signature used");
        
        const userSnap = await transaction.get(userRef);
        let userData = userSnap.data() || {
          wallet,
          hashpower: 0,
          totalEarned: 0,
          rewardDebt: 0,
          lastReward: 0
        };

        // 1. Process pending rewards with OLD hashpower
        const pending = (userData.hashpower * state.accRewardPerShare) - userData.rewardDebt;
        userData.totalEarned += pending;
        
        // 2. Add new hashpower
        const hpToAdd = solAmount * HASHPOWER_PER_SOL;
        userData.hashpower += hpToAdd;
        
        // 3. Update reward debt with NEW hashpower
        userData.rewardDebt = userData.hashpower * state.accRewardPerShare;
        
        transaction.set(userRef, userData);
        transaction.set(sigRef, { used: true, timestamp: Date.now() });
        transaction.set(globalRef, { totalHashpower: increment(hpToAdd) }, { merge: true });
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
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

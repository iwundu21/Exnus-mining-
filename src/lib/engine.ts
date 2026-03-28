import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, getDocs, increment, runTransaction } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// ========================================== //
// FIREBASE SETUP
// ========================================== //
const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);

// ========================================== //
// CONFIG
// ========================================== //
export const BLOCK_INTERVAL = 1200; // 20 minutes
export const TOTAL_SUPPLY = 90_000_000;
export const MINING_DAYS = 180;
export const TOTAL_BLOCKS = Math.floor((MINING_DAYS * 24 * 60) / 20); // 12,960
export const HASHPOWER_PER_SOL = 1000;
export const GENESIS_TIMESTAMP = Math.floor(Date.now() / 1000); // Set to current time

// ========================================== //
// ENGINE LOGIC (Deterministic & Persistent)
// ========================================== //

export interface GlobalState {
  lastProcessedBlock: number;
  accRewardPerShare: number;
  totalHashpower: number;
  totalDistributed: number;
  genesisTimestamp: number;
}

export function getBlockReward(blockNumber: number, totalDistributed: number) {
  const remainingSupply = TOTAL_SUPPLY - totalDistributed;
  const remainingBlocks = TOTAL_BLOCKS - blockNumber;
  if (remainingBlocks <= 0) return 0;
  return remainingSupply / remainingBlocks;
}

export async function syncEngine(): Promise<GlobalState & { currentBlock: number }> {
  console.log("Syncing engine...");
  return await runTransaction(db, async (transaction) => {
    const globalRef = doc(db, "system", "state");
    const globalSnap = await transaction.get(globalRef);
    let state = (globalSnap.data() as GlobalState) || {
      lastProcessedBlock: -1,
      accRewardPerShare: 0,
      totalHashpower: 0,
      totalDistributed: 0,
      genesisTimestamp: Math.floor(Date.now() / 1000),
    };

    // Ensure genesisTimestamp is set
    if (!state.genesisTimestamp) {
      state.genesisTimestamp = Math.floor(Date.now() / 1000);
    }

    const now = Math.floor(Date.now() / 1000);
    const currentBlock = Math.floor((now - state.genesisTimestamp) / BLOCK_INTERVAL);
    
    console.log(`Syncing: currentBlock=${currentBlock}, lastProcessedBlock=${state.lastProcessedBlock}`);

    // Reset if we've moved backwards in time (e.g. genesis reset)
    if (currentBlock < state.lastProcessedBlock) {
      console.log("Resetting engine state due to block regression.");
      state = {
        lastProcessedBlock: -1,
        accRewardPerShare: 0,
        totalHashpower: state.totalHashpower, // Keep hashpower
        totalDistributed: 0,
        genesisTimestamp: state.genesisTimestamp,
      };
    }
    
    const MAX_BLOCKS_PER_SYNC = 100;
    if (currentBlock > state.lastProcessedBlock) {
      console.log(`Processing ${currentBlock - state.lastProcessedBlock} missed blocks...`);
      let newAccRewardPerShare = state.accRewardPerShare;
      let newTotalDistributed = state.totalDistributed;
      
      // Process missed blocks
      const endBlock = Math.min(currentBlock, state.lastProcessedBlock + MAX_BLOCKS_PER_SYNC);
      for (let b = state.lastProcessedBlock + 1; b <= endBlock; b++) {
        const reward = getBlockReward(b, newTotalDistributed);
        if (state.totalHashpower > 0) {
          newAccRewardPerShare += reward / state.totalHashpower;
        }
        newTotalDistributed += reward;

        // Log block to history
        const historyRef = doc(collection(db, "history"), b.toString());
        transaction.set(historyRef, {
          blockNumber: b,
          timestamp: state.genesisTimestamp + (b * BLOCK_INTERVAL),
          reward,
          totalHashpower: state.totalHashpower
        });
      }

      state.lastProcessedBlock = endBlock;
      state.accRewardPerShare = newAccRewardPerShare;
      state.totalDistributed = newTotalDistributed;
      
      transaction.set(globalRef, state as any, { merge: true });
    }
    
    return { ...state, currentBlock };
  });
}

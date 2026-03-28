import { VercelRequest, VercelResponse } from '@vercel/node';
import { syncEngine, BLOCK_INTERVAL, TOTAL_SUPPLY, TOTAL_BLOCKS, db } from '../src/lib/engine';
import { collection, getDocs } from 'firebase/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const state = await syncEngine();
    console.log("Status API: state=", state, "TOTAL_SUPPLY=", TOTAL_SUPPLY);
    const now = Math.floor(Date.now() / 1000);
    const countdown = BLOCK_INTERVAL - ((now - state.genesisTimestamp) % BLOCK_INTERVAL);
    
    const usersSnap = await getDocs(collection(db, "users"));
    const activeMiners = usersSnap.size;
    
    res.json({
      currentBlock: state.currentBlock,
      totalBlocks: TOTAL_BLOCKS,
      countdown,
      totalDistributed: state.totalDistributed,
      remainingSupply: TOTAL_SUPPLY - state.totalDistributed,
      totalHashpower: state.totalHashpower,
      activeMiners,
    });
  } catch (error) {
    console.error("Status error:", error);
    res.status(500).json({ error: "Failed to sync engine" });
  }
}

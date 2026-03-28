import { VercelRequest, VercelResponse } from '@vercel/node';
import { syncEngine, BLOCK_INTERVAL, GENESIS_TIMESTAMP, TOTAL_SUPPLY, db } from '../src/lib/engine';
import { collection, getDocs } from 'firebase/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const state = await syncEngine();
    const now = Math.floor(Date.now() / 1000);
    const countdown = BLOCK_INTERVAL - ((now - GENESIS_TIMESTAMP) % BLOCK_INTERVAL);
    
    const usersSnap = await getDocs(collection(db, "users"));
    const activeMiners = usersSnap.size;
    
    res.json({
      currentBlock: state.currentBlock,
      totalBlocks: 12960, // Hardcoded for now, should be imported from engine.ts
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

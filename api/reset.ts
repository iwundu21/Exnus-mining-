import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/lib/engine';
import { doc, setDoc } from 'firebase/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const globalRef = doc(db, "system", "state");
    await setDoc(globalRef, {
      lastProcessedBlock: -1,
      accRewardPerShare: 0,
      totalHashpower: 0,
      totalDistributed: 0,
      genesisTimestamp: Math.floor(Date.now() / 1000),
    });
    res.json({ message: "Mining reset successfully" });
  } catch (error) {
    console.error("Reset error:", error);
    res.status(500).json({ error: "Failed to reset mining" });
  }
}

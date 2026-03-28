import { VercelRequest, VercelResponse } from '@vercel/node';
import { syncEngine, db } from '../../src/lib/engine';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { wallet } = req.query;
  if (typeof wallet !== 'string') {
    return res.status(400).json({ error: "Invalid wallet address" });
  }

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
        lastReward: 0,
        staked: 0,
        locked: 0,
        available: 0
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
    console.error("User fetch error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
}

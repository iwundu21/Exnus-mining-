import { VercelRequest, VercelResponse } from '@vercel/node';
import { syncEngine, db, HASHPOWER_PER_SOL } from '../src/lib/engine';
import { doc, setDoc, increment, runTransaction } from 'firebase/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
}

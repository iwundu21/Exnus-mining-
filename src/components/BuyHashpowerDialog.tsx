import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { motion, AnimatePresence } from 'motion/react';
import { X, Cpu, Zap, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface Tier {
  hp: number;
  sol: number;
  label: string;
}

const TIERS: Tier[] = [
  { hp: 0.7, sol: 0.01, label: "Starter" },
  { hp: 1.0, sol: 0.04, label: "Basic" },
  { hp: 1.5, sol: 0.057, label: "Pro" },
  { hp: 2.0, sol: 0.067, label: "Elite" },
  { hp: 2.5, sol: 0.077, label: "Ultimate" }
];

export default function BuyHashpowerDialog({ isOpen, onClose, onPurchaseSuccess }: { isOpen: boolean, onClose: () => void, onPurchaseSuccess: () => void }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'verifying' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [treasuryWallet, setTreasuryWallet] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get('/api/config');
        setTreasuryWallet(res.data.treasuryWallet);
      } catch (err) {
        console.error("Failed to fetch config:", err);
      }
    };
    fetchConfig();
  }, []);

  const handlePurchase = async (tier: Tier) => {
    if (!publicKey || !treasuryWallet) return;
    
    if (treasuryWallet === "YOUR_SOL_WALLET") {
      setStatus('error');
      setError("Treasury wallet not configured. Please contact admin.");
      return;
    }

    setLoading(true);
    setStatus('sending');
    setError(null);

    try {
      const treasuryPubKey = new PublicKey(treasuryWallet);
      
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      
      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: publicKey,
      }).add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: treasuryPubKey,
          lamports: Math.round(tier.sol * LAMPORTS_PER_SOL),
        })
      );

      const signature = await sendTransaction(transaction, connection);
      
      setStatus('verifying');
      
      // Wait for confirmation
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      // Verify with backend
      const response = await axios.post('/api/buy-hashpower', {
        wallet: publicKey.toBase58(),
        signature,
        solAmount: tier.sol
      });

      if (response.data.message === "Hashpower added") {
        setStatus('success');
        setTimeout(() => {
          onPurchaseSuccess();
          onClose();
          setStatus('idle');
        }, 2000);
      } else {
        throw new Error("Verification failed");
      }
    } catch (err: any) {
      console.error("Purchase error:", err);
      setStatus('error');
      setError(err.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-surface border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
        >
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
            <div className="flex items-center gap-2">
              <Zap className="text-primary" size={18} />
              <h3 className="text-lg font-bold tracking-tight uppercase">Buy Mining Hashpower</h3>
            </div>
            <button onClick={onClose} className="text-muted hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {status === 'idle' && (
              <div className="grid gap-3">
                {TIERS.map((tier) => (
                  <button
                    key={tier.hp}
                    onClick={() => handlePurchase(tier)}
                    className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Cpu size={20} className="text-muted group-hover:text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-muted uppercase font-bold tracking-widest">{tier.label}</p>
                        <p className="text-xl font-mono font-bold">{tier.hp} <span className="text-sm">TH/s</span></p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-mono font-bold text-primary">{tier.sol} SOL</p>
                      <p className="text-[10px] text-muted uppercase tracking-tighter">One-time payment</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {(status === 'sending' || status === 'verifying') && (
              <div className="py-12 text-center space-y-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-lg font-bold uppercase tracking-tight">
                    {status === 'sending' ? 'Awaiting Signature' : 'Verifying Transaction'}
                  </h4>
                  <p className="text-xs text-muted">
                    {status === 'sending' ? 'Please confirm the transaction in your wallet.' : 'Securing your hashpower on the network...'}
                  </p>
                </div>
              </div>
            )}

            {status === 'success' && (
              <div className="py-12 text-center space-y-4">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-lg font-bold uppercase tracking-tight">Purchase Successful</h4>
                  <p className="text-xs text-muted">Your hashpower has been updated. Happy mining!</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="py-12 text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-lg font-bold uppercase tracking-tight">Transaction Failed</h4>
                  <p className="text-xs text-muted">{error || 'An unknown error occurred.'}</p>
                </div>
                <button 
                  onClick={() => setStatus('idle')}
                  className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>

          <div className="p-4 bg-black/20 border-t border-white/5">
            <p className="text-[9px] text-muted uppercase tracking-widest text-center leading-relaxed">
              Hashpower is added instantly after network confirmation. <br />
              All sales are final and contribute to the Exnus Mining ecosystem.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

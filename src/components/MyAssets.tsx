import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';
import { motion } from 'motion/react';
import { Wallet, Zap, ArrowUpRight, History as HistoryIcon } from 'lucide-react';
import { formatNumber } from '../lib/utils';

export default function MyAssets() {
  const { publicKey } = useWallet();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchUser = async () => {
    if (!publicKey) return;
    try {
      const res = await axios.get(`/api/user/${publicKey.toBase58()}`);
      setUser(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [publicKey]);

  const buyHashpower = async (sol: number) => {
    if (!publicKey) return;
    setLoading(true);
    try {
      // In a real app, we'd trigger a Solana transaction here.
      // For this prototype, we'll simulate the purchase.
      const signature = `sim_${Math.random().toString(36).substring(7)}`;
      await axios.post('/api/buy-hashpower', {
        wallet: publicKey.toBase58(),
        signature,
        solAmount: sol
      });
      await fetchUser();
      alert(`Successfully added ${sol * 1000} TH/s hashpower!`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!publicKey) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <Wallet size={48} className="opacity-10" />
        <h2 className="text-xl font-bold">Wallet Disconnected</h2>
        <p className="text-sm opacity-50">Please connect your Solana wallet to view your assets and hashpower.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 pb-24 space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">My Assets</h1>
        <p className="text-xs opacity-50 uppercase tracking-widest">Portfolio Overview</p>
      </header>

      {/* Balance Card */}
      <section className="p-8 bg-gradient-to-br from-primary/20 to-transparent border border-white/5 space-y-6">
        <div className="space-y-2">
          <p className="text-[10px] uppercase opacity-50 font-bold tracking-widest">Total Earned</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-display font-bold">{formatNumber(user?.totalEarned || 0)}</span>
            <span className="text-sm opacity-50">EXN</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
          <div className="space-y-1">
            <p className="text-[10px] opacity-30 uppercase font-bold">Hashpower</p>
            <p className="text-lg font-display font-bold">{formatNumber(user?.hashpower || 0)} <span className="text-[10px] opacity-50">TH/s</span></p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] opacity-30 uppercase font-bold">Last Reward</p>
            <p className="text-lg font-display font-bold text-primary">+{formatNumber(user?.lastReward || 0)}</p>
          </div>
        </div>
      </section>

      {/* Buy Hashpower */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-primary" />
          <h2 className="text-xs uppercase font-bold tracking-widest">Acquire Hashpower</h2>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {[0.1, 0.5, 1, 5].map((sol) => (
            <button
              key={sol}
              disabled={loading}
              onClick={() => buyHashpower(sol)}
              className="p-4 border border-white/5 hover:border-primary/50 transition-colors text-left space-y-1 group"
            >
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">{sol} SOL</span>
                <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[10px] opacity-50">+{sol * 1000} TH/s Hashpower</p>
            </button>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="space-y-3">
        <button className="w-full p-4 bg-white/5 flex items-center justify-between group">
          <div className="flex items-center gap-3">
            <HistoryIcon size={18} className="opacity-50" />
            <span className="text-sm">Transaction History</span>
          </div>
          <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100" />
        </button>
      </section>
    </div>
  );
}

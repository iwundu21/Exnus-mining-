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
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight uppercase">Asset Portfolio</h2>
          <p className="text-muted text-sm md:text-base max-w-2xl mt-2">
            Manage your mining assets, monitor your EXN earnings, and expand your hashpower contribution to the network.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-surface/50 p-4 rounded-xl border border-line">
          <div className="text-right">
            <p className="data-label">Wallet Address</p>
            <p className="font-mono text-xs opacity-50">{publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-6)}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
            <Wallet size={18} className="text-primary" />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Balance Overview */}
        <section className="lg:col-span-2 space-y-8">
          <div className="p-10 bg-gradient-to-br from-primary/10 via-background to-background border border-line rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -mr-32 -mt-32 rounded-full group-hover:bg-primary/10 transition-colors duration-500"></div>
            
            <div className="relative z-10 space-y-10">
              <div className="space-y-2">
                <p className="data-label text-primary">Total Cumulative Earnings</p>
                <div className="flex items-baseline gap-4">
                  <span className="text-5xl md:text-7xl font-display font-bold tracking-tighter">{formatNumber(user?.totalEarned || 0)}</span>
                  <span className="text-xl md:text-2xl font-display font-bold text-muted">EXN</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-10 border-t border-line">
                <div className="space-y-1">
                  <p className="data-label">Current Hashpower</p>
                  <p className="text-2xl font-mono font-bold">{formatNumber(user?.hashpower || 0)} <span className="text-xs text-muted">TH/s</span></p>
                </div>
                <div className="space-y-1">
                  <p className="data-label">Last Block Reward</p>
                  <p className="text-2xl font-mono font-bold text-primary">+{formatNumber(user?.lastReward || 0)} <span className="text-xs text-muted">EXN</span></p>
                </div>
                <div className="space-y-1">
                  <p className="data-label">Est. Monthly</p>
                  <p className="text-2xl font-mono font-bold">~372.4 <span className="text-xs text-muted">EXN</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* Asset Breakdown */}
          <div className="space-y-6">
            <h3 className="data-label">Asset Breakdown</h3>
            <div className="data-grid rounded-2xl overflow-hidden">
              <div className="data-card border-r border-line">
                <p className="data-label">Staked EXN</p>
                <p className="text-xl font-mono font-bold">12,450.00</p>
              </div>
              <div className="data-card border-r border-line">
                <p className="data-label">Locked Rewards</p>
                <p className="text-xl font-mono font-bold">1,204.42</p>
              </div>
              <div className="data-card border-r border-line">
                <p className="data-label">Available Balance</p>
                <p className="text-xl font-mono font-bold text-primary">450.12</p>
              </div>
              <div className="data-card">
                <p className="data-label">Network Tier</p>
                <p className="text-xl font-mono font-bold">GOLD</p>
              </div>
            </div>
          </div>
        </section>

        {/* Acquisition Sidebar */}
        <section className="space-y-8">
          <div className="p-8 border border-line bg-surface/30 rounded-3xl space-y-6">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-primary" />
              <h3 className="data-label">Acquire Hashpower</h3>
            </div>
            
            <div className="space-y-3">
              {[0.1, 0.5, 1, 5].map((sol) => (
                <button
                  key={sol}
                  disabled={loading}
                  onClick={() => buyHashpower(sol)}
                  className="w-full p-5 border border-line bg-background hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 rounded-2xl text-left space-y-1 group relative overflow-hidden"
                >
                  <div className="flex justify-between items-center relative z-10">
                    <span className="text-xl font-bold font-mono">{sol} SOL</span>
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                      <ArrowUpRight size={16} />
                    </div>
                  </div>
                  <p className="text-xs text-muted relative z-10">+{sol * 1000} TH/s Hashpower Contribution</p>
                </button>
              ))}
            </div>

            <div className="pt-4">
              <button className="w-full py-4 border border-line bg-white/5 rounded-xl flex items-center justify-center gap-3 hover:bg-white/10 transition-colors">
                <HistoryIcon size={18} className="text-muted" />
                <span className="text-xs font-bold uppercase tracking-widest">Transaction History</span>
              </button>
            </div>
          </div>

          <div className="p-6 border border-primary/20 bg-primary/5 rounded-2xl text-center space-y-2">
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest">Network Bonus</p>
            <p className="text-xs text-muted">Stake 5,000 EXN to unlock 15% bonus hashpower efficiency.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

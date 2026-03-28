import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import axios from 'axios';
import { motion } from 'motion/react';
import { Cpu, Timer, Database, TrendingUp, Users, Wallet } from 'lucide-react';
import { formatNumber } from '../lib/utils';
import { TOTAL_SUPPLY } from '../lib/engine';

interface Status {
  currentBlock: number;
  totalBlocks: number;
  countdown: number;
  totalDistributed: number;
  remainingSupply: number;
  totalHashpower: number;
  activeMiners: number;
}

export default function Dashboard() {
  const { publicKey } = useWallet();
  const [status, setStatus] = useState<Status | null>(null);
  const [user, setUser] = useState<any>(null);

  const fetchData = async () => {
    try {
      const [statusRes, userRes] = await Promise.all([
        axios.get('/api/status'),
        publicKey ? axios.get(`/api/user/${publicKey.toBase58()}`) : Promise.resolve({ data: null })
      ]);
      console.log("Dashboard: statusRes=", statusRes.data);
      setStatus(statusRes.data);
      setUser(userRes.data);
    } catch (err) {
      console.error("Dashboard error:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [publicKey]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="status-indicator status-online"></div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-green-500">Network Online</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">EXNUS MINING ENGINE</h2>
          <p className="text-muted text-sm md:text-base max-w-2xl mt-2">
            The next generation of decentralized hashpower distribution. Connect your wallet to start contributing to the network and earn EXN rewards.
          </p>
        </div>
      </header>

      {/* Main Stats Grid */}
      <section className="data-grid">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="data-card border-r border-line"
        >
          <div className="flex items-center gap-2 data-label">
            <Database size={14} />
            <span>Current Block</span>
          </div>
          <div className="data-value">
            #{status?.currentBlock || 0}
          </div>
          <p className="text-[10px] text-muted">Total: {status?.totalBlocks || 0}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="data-card border-r border-line"
        >
          <div className="flex items-center gap-2 data-label">
            <Timer size={14} />
            <span>Next Reward</span>
          </div>
          <div className="data-value text-primary">
            {status ? formatTime(status.countdown) : '0:00'}
          </div>
          <p className="text-[10px] text-muted">Block Interval: 10m</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="data-card border-r border-line"
        >
          <div className="flex items-center gap-2 data-label">
            <Cpu size={14} />
            <span>Total Hashrate</span>
          </div>
          <div className="data-value">
            {formatNumber(status?.totalHashpower || 0)} <span className="text-xs text-muted">TH/s</span>
          </div>
          <p className="text-[10px] text-muted">Network Difficulty: 84.2P</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="data-card"
        >
          <div className="flex items-center gap-2 data-label">
            <Users size={14} />
            <span>Active Nodes</span>
          </div>
          <div className="data-value">
            {status?.activeMiners || 0}
          </div>
          <p className="text-[10px] text-muted">Global Distribution</p>
        </motion.div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Network Distribution Chart Area */}
        <section className="lg:col-span-2 space-y-6">
          <div className="p-8 border border-line bg-surface/30 rounded-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="data-label">Network Distribution</h3>
              <div className="flex gap-4 text-[10px] uppercase font-bold tracking-widest">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Distributed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white/10 rounded-full"></div>
                  <span>Remaining</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-8">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-muted">Supply Distribution</span>
                  <span>{((status?.totalDistributed || 0) / ((status?.totalDistributed || 0) + (status?.remainingSupply || 1)) * 100).toFixed(2)}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${((status?.totalDistributed || 0) / ((status?.totalDistributed || 0) + (status?.remainingSupply || 1)) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                  <p className="data-label">Total Distributed</p>
                  <p className="text-xl font-mono font-bold">{formatNumber(status?.totalDistributed || 0)} EXN</p>
                </div>
                <div className="space-y-1">
                  <p className="data-label">Remaining Supply</p>
                  <p className="text-xl font-mono font-bold">{formatNumber(status?.remainingSupply ?? TOTAL_SUPPLY)} EXN</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* User Sidebar Info */}
        <section className="space-y-6">
          {publicKey && user ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-8 bg-primary/10 border border-primary/20 rounded-2xl space-y-8"
            >
              <div className="space-y-2">
                <p className="data-label text-primary">Your Mining Status</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                    <TrendingUp className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-bold">{formatNumber(user.totalEarned)} EXN</h3>
                    <p className="text-[10px] text-muted uppercase tracking-widest">Total Rewards</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-primary/10">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted">Current Hashpower</span>
                  <span className="text-sm font-mono font-bold">{formatNumber(user.hashpower)} TH/s</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted">Network Share</span>
                  <span className="text-sm font-mono font-bold">0.0042%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted">Daily Est.</span>
                  <span className="text-sm font-mono font-bold text-primary">~12.4 EXN</span>
                </div>
              </div>

              <button className="w-full py-4 bg-primary text-white rounded-xl font-bold text-sm tracking-widest uppercase hover:bg-accent transition-colors">
                Buy Hashpower
              </button>
            </motion.div>
          ) : (
            <div className="p-8 border border-dashed border-line rounded-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-white/5 mx-auto flex items-center justify-center">
                <Wallet className="text-muted" size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold">Wallet Not Connected</p>
                <p className="text-xs text-muted">Connect your Solana wallet to view your mining statistics and assets.</p>
              </div>
              <WalletMultiButton className="!bg-primary !w-full !rounded-xl !h-12 !text-sm !font-bold !uppercase !tracking-widest" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

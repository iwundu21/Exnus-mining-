import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import axios from 'axios';
import { motion } from 'motion/react';
import { Cpu, Timer, Database, TrendingUp, Users, Wallet } from 'lucide-react';
import { formatNumber } from '../lib/utils';
import { TOTAL_SUPPLY, BLOCK_INTERVAL } from '../lib/engine';
import BuyHashpowerDialog from './BuyHashpowerDialog';

interface Status {
  currentBlock: number;
  totalBlocks: number;
  countdown: number;
  blockReward: number;
  totalDistributed: number;
  remainingSupply: number;
  totalHashpower: number;
  activeMiners: number;
  totalUsers: number;
}

export default function Dashboard() {
  const { publicKey } = useWallet();
  const [status, setStatus] = useState<Status | null>(null);
  const [user, setUser] = useState<any>(null);
  const [difficulty, setDifficulty] = useState<string>('84.2P');
  const [isBuyDialogOpen, setIsBuyDialogOpen] = useState(false);

  const formatDifficulty = (diff: number) => {
    if (diff >= 1e15) return (diff / 1e15).toFixed(1) + 'P';
    if (diff >= 1e12) return (diff / 1e12).toFixed(1) + 'T';
    if (diff >= 1e9) return (diff / 1e9).toFixed(1) + 'G';
    if (diff >= 1e6) return (diff / 1e6).toFixed(1) + 'M';
    if (diff >= 1e3) return (diff / 1e3).toFixed(1) + 'K';
    return diff.toFixed(1);
  };

  const fetchData = async () => {
    try {
      const [statusRes, userRes, diffRes] = await Promise.all([
        axios.get('/api/status'),
        publicKey ? axios.get(`/api/user/${publicKey.toBase58()}`) : Promise.resolve({ data: null }),
        axios.get('https://blockchain.info/q/getdifficulty').catch(() => ({ data: null }))
      ]);
      console.log("Dashboard: statusRes=", statusRes.data);
      setStatus(prev => {
        if (!prev) return statusRes.data;
        const newStatus = { ...statusRes.data };
        // Prevent jitter by keeping local countdown if it's close to server's
        if (Math.abs(prev.countdown - newStatus.countdown) <= 2) {
          newStatus.countdown = prev.countdown;
        }
        return newStatus;
      });
      setUser(userRes.data);

      if (diffRes && diffRes.data) {
        const diffNum = parseFloat(diffRes.data);
        if (!isNaN(diffNum)) {
          setDifficulty(formatDifficulty(diffNum));
        }
      }
    } catch (err) {
      console.error("Dashboard error:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [publicKey]);

  useEffect(() => {
    const timer = setInterval(() => {
      setStatus(prev => {
        if (!prev) return prev;
        return { ...prev, countdown: Math.max(0, prev.countdown - 1) };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number | undefined | null) => {
    if (seconds === undefined || seconds === null || isNaN(seconds)) return '0:00';
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
        </div>
      </header>

      {/* Main Stats Grid */}
      <section className="data-grid">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="data-card"
        >
          <div className="data-value">
            #{status?.currentBlock || 0}
          </div>
          <p className="text-[10px] text-muted">Total Mined: {status?.currentBlock || 0} / {status?.totalBlocks || 0}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="data-card"
        >
          <div className="flex items-center justify-between data-label">
            <div className="flex items-center gap-2">
              <Timer size={14} />
              <span>Next Reward</span>
            </div>
            <span className="text-primary font-mono">{status ? formatTime(status.countdown) : '0:00'}</span>
          </div>
          <div className="data-value text-primary">
            {formatNumber(status?.blockReward || 0)} <span className="text-xs text-muted">EXN</span>
          </div>
          <p className="text-[10px] text-muted">Block Interval: {BLOCK_INTERVAL / 60}m</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="data-card"
        >
          <div className="flex items-center gap-2 data-label">
            <Cpu size={14} />
            <span>Total Hashrate</span>
          </div>
          <div className="data-value">
            {formatNumber(status?.totalHashpower || 0)} <span className="text-xs text-muted">TH/s</span>
          </div>
          <p className="text-[10px] text-muted">Network Difficulty: {difficulty}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="data-card"
        >
          <div className="flex items-center gap-2 data-label">
            <Users size={14} />
            <span>Active Miners</span>
          </div>
          <div className="data-value">
            {status?.activeMiners || 0} <span className="text-xs text-muted">/ {status?.totalUsers || 0}</span>
          </div>
          <p className="text-[10px] text-muted">Total Registered Users</p>
        </motion.div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Network Distribution Chart Area */}
        <section className="lg:col-span-2 space-y-6">
          <div className="p-8">
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
              className="p-8 space-y-8"
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

              <div className="space-y-4 pt-6">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted">Current Hashpower</span>
                  <span className="text-sm font-mono font-bold">{formatNumber(user.hashpower)} TH/s</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted">Network Share</span>
                  <span className="text-sm font-mono font-bold">
                    {status?.totalHashpower ? ((user.hashpower / status.totalHashpower) * 100).toFixed(4) : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted">Daily Est.</span>
                  <span className="text-sm font-mono font-bold text-primary">
                    ~{formatNumber(
                      (user.hashpower && status?.totalHashpower && status?.blockReward)
                        ? (user.hashpower / status.totalHashpower) * status.blockReward * (24 * 60 * 60 / 1200)
                        : 0
                    )} EXN
                  </span>
                </div>
              </div>

              <button 
                onClick={() => setIsBuyDialogOpen(true)}
                className="w-full py-4 bg-primary text-white rounded-xl font-bold text-sm tracking-widest uppercase hover:bg-accent transition-colors"
              >
                Buy Hashpower
              </button>
            </motion.div>
          ) : (
            <div className="p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-white/5 mx-auto flex items-center justify-center border border-white/10">
                <Wallet className="text-primary" size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold tracking-tight">Connect to Mining Engine</h3>
                <p className="text-xs text-muted leading-relaxed max-w-[240px] mx-auto">
                  Securely link your Solana wallet to monitor your mining assets and network rewards. 
                  <span className="block mt-2 text-[10px] text-green-500/80 uppercase tracking-widest font-bold">Read-Only Connection</span>
                </p>
              </div>
              <div className="space-y-3">
                <WalletMultiButton className="!bg-primary !w-full !rounded-xl !h-12 !text-sm !font-bold !uppercase !tracking-widest !transition-all hover:!bg-accent" />
                <p className="text-[9px] text-muted uppercase tracking-tighter">No transaction required to connect</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <BuyHashpowerDialog 
        isOpen={isBuyDialogOpen} 
        onClose={() => setIsBuyDialogOpen(false)} 
        onPurchaseSuccess={fetchData}
      />
    </div>
  );
}

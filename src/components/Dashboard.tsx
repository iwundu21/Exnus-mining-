import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import axios from 'axios';
import { motion } from 'motion/react';
import { Cpu, Timer, Database, TrendingUp, Users } from 'lucide-react';
import { formatNumber } from '../lib/utils';

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
      setStatus(statusRes.data);
      setUser(userRes.data);
    } catch (err) {
      console.error(err);
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
    <div className="flex-1 p-6 pb-24 space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">EXNUS MINING</h1>
          <p className="text-xs opacity-50 uppercase tracking-widest">Mining Engine</p>
        </div>
        <WalletMultiButton className="!bg-primary !rounded-full !h-10 !px-4 !text-sm" />
      </header>

      {/* Main Stats */}
      <section className="grid grid-cols-2 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 border border-white/5 space-y-2"
        >
          <div className="flex items-center gap-2 opacity-50">
            <Database size={14} />
            <span className="text-[10px] uppercase font-medium">Current Block</span>
          </div>
          <div className="text-xl font-display font-bold">
            #{status?.currentBlock || 0}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 border border-white/5 space-y-2"
        >
          <div className="flex items-center gap-2 opacity-50">
            <Timer size={14} />
            <span className="text-[10px] uppercase font-medium">Next Reward</span>
          </div>
          <div className="text-xl font-display font-bold text-primary">
            {status ? formatTime(status.countdown) : '0:00'}
          </div>
        </motion.div>
      </section>

      {/* Network Stats */}
      <section className="space-y-4">
        <h2 className="text-xs uppercase opacity-30 font-bold tracking-widest">Network Status</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-2 opacity-50">
              <Cpu size={14} />
              <span className="text-xs">Total Hashpower</span>
            </div>
            <span className="text-sm font-medium">{formatNumber(status?.totalHashpower || 0)} TH/s</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: '65%' }}
            />
          </div>

          <div className="flex justify-between items-end">
            <div className="flex items-center gap-2 opacity-50">
              <TrendingUp size={14} />
              <span className="text-xs">Total Distributed</span>
            </div>
            <span className="text-sm font-medium">{formatNumber(status?.totalDistributed || 0)} EXN</span>
          </div>

          <div className="flex justify-between items-end">
            <div className="flex items-center gap-2 opacity-50">
              <Users size={14} />
              <span className="text-xs">Active Miners</span>
            </div>
            <span className="text-sm font-medium">{status?.activeMiners || 0}</span>
          </div>
        </div>
      </section>

      {/* User Quick Info */}
      {publicKey && user && (
        <section className="p-6 bg-primary/10 border border-primary/20 space-y-4">
          <div className="space-y-1">
            <p className="text-[10px] uppercase opacity-50 font-bold tracking-widest">Your Assets</p>
            <h3 className="text-2xl font-display font-bold">{formatNumber(user.totalEarned)} EXN</h3>
          </div>
          <div className="flex justify-between text-xs">
            <span className="opacity-50">Hashpower</span>
            <span className="text-primary font-bold">{formatNumber(user.hashpower)} TH/s</span>
          </div>
        </section>
      )}

      {!publicKey && (
        <div className="p-8 text-center border border-dashed border-white/10 opacity-30">
          <p className="text-xs">Connect wallet to start mining</p>
        </div>
      )}
    </div>
  );
}

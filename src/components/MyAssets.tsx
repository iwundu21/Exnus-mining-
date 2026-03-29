import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';
import { motion } from 'motion/react';
import { Wallet, Zap } from 'lucide-react';
import { formatNumber } from '../lib/utils';
import BuyHashpowerDialog from './BuyHashpowerDialog';

export default function MyAssets() {
  const { publicKey } = useWallet();
  const [user, setUser] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [isBuyDialogOpen, setIsBuyDialogOpen] = useState(false);

  const fetchData = async () => {
    try {
      const [statusRes, userRes] = await Promise.all([
        axios.get('/api/status'),
        publicKey ? axios.get(`/api/user/${publicKey.toBase58()}`) : Promise.resolve({ data: null })
      ]);
      setStatus(statusRes.data);
      if (userRes.data && Array.isArray(userRes.data.history)) {
        // Deduplicate user history using a Map
        const historyMap = new Map();
        userRes.data.history.forEach((item: any) => {
          const key = `${item.blockNumber}-${item.timestamp}`;
          if (!historyMap.has(key)) {
            historyMap.set(key, item);
          }
        });
        setUser({ ...userRes.data, history: Array.from(historyMap.values()) });
      } else {
        setUser(userRes.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [publicKey]);

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
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <h2 className="text-3xl font-bold tracking-tight uppercase">My Assets</h2>
        <button 
          onClick={() => setIsBuyDialogOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-accent transition-colors shadow-lg shadow-primary/20"
        >
          <Zap size={14} />
          Buy Hashpower
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="data-card p-8 space-y-2"
        >
          <p className="data-label text-primary">Balance</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-mono font-bold">{formatNumber(user?.totalEarned || 0)}</span>
            <span className="text-sm text-muted font-bold">EXN</span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="data-card p-8 space-y-2"
        >
          <p className="data-label">Earn</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-mono font-bold">{formatNumber(user?.totalEarned || 0)}</span>
            <span className="text-sm text-muted font-bold">EXN</span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="data-card p-8 space-y-2"
        >
          <p className="data-label">Mined so far</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-mono font-bold">{formatNumber(user?.totalEarned || 0)}</span>
            <span className="text-sm text-muted font-bold">EXN</span>
          </div>
        </motion.div>
      </div>

      <div className="space-y-4">
        <h3 className="data-label">Mining History</h3>
        <div className="data-card overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-muted">Block</th>
                <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-muted">Reward</th>
                <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-muted">Hashpower</th>
                <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-muted">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {user?.history?.length > 0 ? (
                user.history.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4 font-mono text-sm">#{item.blockNumber}</td>
                    <td className={`p-4 font-mono text-sm ${item.reward > 0 ? 'text-primary' : 'text-muted'}`}>
                      {item.reward > 0 ? `+${formatNumber(item.reward)}` : '0.00'} EXN
                    </td>
                    <td className="p-4 font-mono text-sm">{formatNumber(item.hashpower)} TH/s</td>
                    <td className="p-4 font-mono text-xs text-muted">
                      {new Date(item.timestamp * 1000).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted text-sm italic">
                    No mining history available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BuyHashpowerDialog 
        isOpen={isBuyDialogOpen} 
        onClose={() => setIsBuyDialogOpen(false)} 
        onPurchaseSuccess={fetchData}
      />
    </div>
  );
}

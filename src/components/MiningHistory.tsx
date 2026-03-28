import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import { History as HistoryIcon, Hash, Clock, Coins } from 'lucide-react';
import { formatNumber } from '../lib/utils';
import { format } from 'date-fns';

export default function MiningHistory() {
  const [history, setHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get('/api/history');
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 p-6 pb-24 space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Mining History</h1>
        <p className="text-xs opacity-50 uppercase tracking-widest">Block Distribution Log</p>
      </header>

      <section className="space-y-4">
        {history.length === 0 ? (
          <div className="p-12 text-center opacity-20">
            <p className="text-sm">No blocks processed yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((block, i) => (
              <motion.div
                key={block.blockNumber}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 border-l-2 border-primary bg-white/[0.02] space-y-3"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Hash size={12} className="opacity-30" />
                    <span className="text-sm font-bold">Block #{block.blockNumber}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-30 text-[10px]">
                    <Clock size={10} />
                    <span>{format(new Date(block.timestamp * 1000), 'HH:mm:ss')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[9px] uppercase opacity-40 font-bold">Reward</p>
                    <div className="flex items-center gap-1">
                      <Coins size={10} className="text-primary" />
                      <span className="text-xs font-medium">{formatNumber(block.reward)} EXN</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] uppercase opacity-40 font-bold">Network HP</p>
                    <span className="text-xs font-medium">{formatNumber(block.totalHashpower)} TH/s</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

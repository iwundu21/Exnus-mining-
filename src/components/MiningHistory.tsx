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
      if (Array.isArray(res.data)) {
        setHistory(res.data);
      } else {
        console.error("Expected array for history, got:", res.data);
      }
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
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight uppercase">Mining History</h2>
          <p className="text-muted text-sm md:text-base max-w-2xl mt-2">
            Real-time ledger of block distributions and network rewards. Monitor the heartbeat of the Exnus Mining Engine.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
          <div className="status-indicator status-online"></div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-primary">Live Updates Enabled</span>
        </div>
      </header>

      <section>
        <div className="grid grid-cols-4 md:grid-cols-6 gap-4 p-6 data-label">
          <div className="col-span-1">Block</div>
          <div className="hidden md:block">Timestamp</div>
          <div className="col-span-1">Reward</div>
          <div className="col-span-1">Network HP</div>
          <div className="hidden md:block">Miners</div>
          <div className="text-right">Status</div>
        </div>

        <div className="space-y-2">
          {history.length === 0 ? (
            <div className="p-20 text-center opacity-20">
              <HistoryIcon size={48} className="mx-auto mb-4" />
              <p className="text-sm">Synchronizing with network ledger...</p>
            </div>
          ) : (
            history.map((block, i) => (
              <motion.div
                key={`${block.blockNumber}-${block.timestamp}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="grid grid-cols-4 md:grid-cols-6 gap-4 p-6 items-center hover:bg-white/[0.02] transition-colors group"
              >
                <div className="col-span-1 flex items-center gap-3">
                  <Hash size={14} className="text-muted group-hover:text-primary transition-colors" />
                  <span className="font-mono font-bold text-sm">#{block.blockNumber}</span>
                </div>
                
                <div className="hidden md:block font-mono text-xs text-muted">
                  {format(new Date(block.timestamp * 1000), 'MMM dd, HH:mm:ss')}
                </div>

                <div className="col-span-1 flex items-center gap-2">
                  <Coins size={14} className="text-primary" />
                  <span className="font-mono font-bold text-sm">{formatNumber(block.reward)} <span className="text-[10px] text-muted">EXN</span></span>
                </div>

                <div className="col-span-1 font-mono text-sm">
                  {formatNumber(block.totalHashpower)} <span className="text-[10px] text-muted">TH/s</span>
                </div>

                <div className="hidden md:block font-mono text-sm text-muted">
                  {block.activeMiners || 0}
                </div>

                <div className="text-right">
                  <span className="px-2 py-1 bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-widest rounded">
                    Confirmed
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>

      {/* Pagination / Load More Placeholder */}
      <div className="flex justify-center pt-8">
        <button className="px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest text-muted hover:text-text hover:bg-white/5 transition-all">
          Load Older Blocks
        </button>
      </div>
    </div>
  );
}

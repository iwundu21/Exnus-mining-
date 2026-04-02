import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { History as HistoryIcon, Hash, Clock, Coins, X, ExternalLink, User } from 'lucide-react';
import { formatNumber, cn } from '../lib/utils';
import { format } from 'date-fns';

const formatWallet = (wallet: string) => {
  if (!wallet) return '';
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 5)}****${wallet.slice(-6)}`;
};

interface BlockReward {
  wallet: string;
  reward: number;
  hashpower: number;
  timestamp: number;
  blockNumber: number;
  status: string;
}

function BlockDetailsDialog({ block, onClose }: { block: any, onClose: () => void }) {
  const [rewards, setRewards] = useState<BlockReward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRewards = async () => {
      try {
        const res = await axios.get(`/api/history/${block.blockNumber}-${block.timestamp}/rewards`);
        setRewards(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRewards();
  }, [block]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-surface border border-white/10 rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-6 border-b border-white/5 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Hash className="text-primary shrink-0" size={20} />
              <span className="truncate">Block #{block.blockNumber} Details</span>
            </h3>
            <p className="text-xs text-muted mt-1 font-mono break-all">
              Hash: {block.hash || 'GENESIS_BLOCK_HASH_0000000000000000'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors shrink-0">
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-7 gap-4 p-4 text-[10px] uppercase tracking-widest font-bold text-muted border-b border-white/5 bg-white/[0.02]">
                <div className="col-span-1">Wallet Address</div>
                <div className="col-span-2">Reward Hash ID</div>
                <div className="col-span-1">Amount</div>
                <div className="col-span-1">Hashpower</div>
                <div className="col-span-1">Share %</div>
                <div className="col-span-1 text-right">Status</div>
              </div>

              <div className="divide-y divide-white/5">
                {loading ? (
                  <div className="p-12 text-center text-muted text-xs uppercase tracking-widest animate-pulse">
                    Fetching block distribution data...
                  </div>
                ) : rewards.length === 0 ? (
                  <div className="p-12 text-center text-muted text-xs uppercase tracking-widest">
                    No individual rewards recorded for this block.
                  </div>
                ) : (
                  rewards.map((reward: any, i) => (
                    <div key={i} className="grid grid-cols-7 gap-4 p-4 items-center text-sm font-mono hover:bg-white/[0.01] transition-colors">
                      <div className="col-span-1 flex items-center gap-2">
                        <User size={12} className="text-muted shrink-0" />
                        <span className="text-primary font-bold truncate">{formatWallet(reward.wallet)}</span>
                      </div>
                      <div className="col-span-2">
                        <div className="font-mono text-[9px] text-primary/70 bg-primary/5 px-2 py-1 rounded border border-primary/10 truncate max-w-[200px]">
                          {reward.rewardHash || 'PENDING_HASH_GENERATION...'}
                        </div>
                      </div>
                      <div className="col-span-1 font-bold text-green-500 whitespace-nowrap flex items-center gap-1">
                        +{formatNumber(reward.reward)} 
                        <img 
                          src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                          alt="EXN" 
                          className="w-3 h-3 rounded-full"
                          referrerPolicy="no-referrer"
                        />
                        <span className="text-[10px] text-muted">EXN</span>
                      </div>
                      <div className="col-span-1 text-muted text-xs whitespace-nowrap">
                        {formatNumber(reward.hashpower)} <span className="text-[10px]">TH/s</span>
                      </div>
                      <div className="col-span-1 text-xs text-primary font-bold">
                        {block.totalHashpower > 0 ? ((reward.hashpower / block.totalHashpower) * 100).toFixed(2) : '0.00'}%
                      </div>
                      <div className="col-span-1 text-right">
                        <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[9px] font-bold uppercase tracking-widest rounded border border-green-500/20 whitespace-nowrap">
                          {reward.status || 'CONFIRMED'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <footer className="p-6 border-t border-white/5 bg-white/[0.02] flex justify-between items-center text-[10px] text-muted uppercase tracking-widest font-bold">
          <div>Total Rewards: {rewards.length} Miners</div>
          <div>Block Time: {format(new Date(block.timestamp * 1000), 'MMM dd, yyyy HH:mm:ss')}</div>
        </footer>
      </motion.div>
    </motion.div>
  );
}

export default function MiningHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const isFetchingRef = useRef(false);

  // Pagination logic
  const totalPages = Math.ceil(history.length / itemsPerPage);
  const paginatedHistory = history.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const fetchHistory = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const res = await axios.get('/api/history', { timeout: 10000 });
      if (Array.isArray(res.data)) {
        // Deduplicate history by blockNumber and timestamp using a Map
        const historyMap = new Map();
        res.data.forEach((item: any) => {
          const key = `${item.blockNumber}-${item.timestamp}`;
          if (!historyMap.has(key)) {
            historyMap.set(key, item);
          }
        });
        setHistory(Array.from(historyMap.values()));
      } else {
        console.error("Expected array for history, got:", res.data);
      }
    } catch (err) {
      console.error("MiningHistory fetch error:", err);
    } finally {
      isFetchingRef.current = false;
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

      <section className="overflow-x-auto pb-4">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-8 gap-4 p-6 data-label bg-white/[0.02] border-b border-white/5">
            <div className="col-span-1">Block</div>
            <div className="col-span-2">Reward Hash ID</div>
            <div className="col-span-1">Timestamp</div>
            <div className="col-span-1">Reward</div>
            <div className="col-span-1">Network HP</div>
            <div className="col-span-1">Miners</div>
            <div className="col-span-1 text-right">Status</div>
          </div>

          <div className="space-y-2">
            {paginatedHistory.length === 0 ? (
              <div className="p-20 text-center opacity-20">
                <HistoryIcon size={48} className="mx-auto mb-4" />
                <p className="text-sm">Synchronizing with network ledger...</p>
              </div>
            ) : (
              paginatedHistory.map((block, i) => (
                <motion.div
                  key={`${block.blockNumber}-${block.timestamp}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedBlock(block)}
                  className="grid grid-cols-8 gap-4 p-6 items-center hover:bg-white/[0.05] transition-colors group cursor-pointer border border-transparent hover:border-primary/20 rounded-xl"
                >
                  <div className="col-span-1 flex items-center gap-3">
                    <Hash size={14} className="text-muted group-hover:text-primary transition-colors" />
                    <span className="font-mono font-bold text-sm">#{block.blockNumber}</span>
                  </div>

                  <div className="col-span-2">
                    <div className="font-mono text-[9px] text-primary/70 group-hover:text-primary transition-all flex items-center gap-2 group/hash bg-primary/5 px-3 py-1.5 rounded-md border border-primary/20 group-hover:border-primary/40 group-hover:bg-primary/10 shadow-[0_0_10px_rgba(var(--primary-rgb),0.05)] w-fit">
                      <span className="truncate max-w-[160px] tracking-tighter">{block.hash || '0000000000000000000000000000000000000000000000000000000000000000'}</span>
                      <ExternalLink size={10} className="opacity-40 group-hover/hash:opacity-100 transition-opacity shrink-0" />
                    </div>
                  </div>
                  
                  <div className="col-span-1 font-mono text-xs text-muted">
                    {format(new Date(block.timestamp * 1000), 'MMM dd, HH:mm:ss')}
                  </div>

                  <div className="col-span-1 flex items-center gap-2">
                    <img 
                      src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                      alt="EXN" 
                      className="w-4 h-4 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                    <span className="font-mono font-bold text-sm">{formatNumber(block.reward)} <span className="text-[10px] text-muted">EXN</span></span>
                  </div>

                  <div className="col-span-1 font-mono text-sm">
                    {formatNumber(block.totalHashpower)} <span className="text-[10px] text-muted">TH/s</span>
                  </div>

                  <div className="col-span-1 font-mono text-sm text-primary">
                    {block.activeMiners || 0} <span className="text-[10px] text-muted">Miners</span>
                  </div>

                  <div className="col-span-1 text-right">
                    <span className="px-2 py-1 bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-widest rounded">
                      Confirmed
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {selectedBlock && (
          <BlockDetailsDialog 
            block={selectedBlock} 
            onClose={() => setSelectedBlock(null)} 
          />
        )}
      </AnimatePresence>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 pt-8">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-6 py-3 bg-white/5 rounded-xl text-xs font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-white/10 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs font-mono text-muted">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-6 py-3 bg-white/5 rounded-xl text-xs font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-white/10 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

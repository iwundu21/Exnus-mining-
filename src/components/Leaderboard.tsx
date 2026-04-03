import React, { useEffect, useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { formatNumber, cn } from '../lib/utils';

interface Miner {
  wallet: string;
  hashpower: number;
  totalEarned: number;
  lastActive: number;
  country?: string;
  countryCode?: string;
}

const formatWallet = (wallet: string) => {
  if (!wallet) return '';
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 5)}****${wallet.slice(-6)}`;
};

export default function Leaderboard() {
  const { publicKey } = useWallet();
  const [miners, setMiners] = useState<Miner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const isFetchingRef = useRef(false);

  const userWallet = publicKey?.toBase58();
  const userRank = userWallet ? miners.findIndex(m => m.wallet === userWallet) + 1 : 0;
  const userMiner = userWallet ? miners.find(m => m.wallet === userWallet) : null;

  const fetchMiners = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const res = await axios.get('/api/leaderboard', { timeout: 10000 });
      // Ensure res.data is an array before sorting
      const data = Array.isArray(res.data) ? res.data : [];
      const sortedMiners = [...data].sort((a: Miner, b: Miner) => b.totalEarned - a.totalEarned);
      setMiners(sortedMiners);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchMiners();
    const interval = setInterval(fetchMiners, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredMiners = miners.filter(m => 
    m.wallet.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const topThree = miners.slice(0, 3);
  
  // Pagination logic
  const totalPages = Math.ceil(filteredMiners.length / itemsPerPage);
  const paginatedMiners = filteredMiners.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight uppercase flex items-center gap-4">
            Leaderboard
          </h2>
          <p className="text-muted text-sm md:text-base max-w-2xl mt-2">
            The elite of Exnus Mining. Rankings are based on total EXN rewards earned through the network.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-full border border-yellow-500/20">
          <span className="text-[10px] uppercase font-bold tracking-widest text-yellow-500">Real-time Rankings</span>
        </div>
      </header>

      {/* Top 3 Podium */}
      {!loading && miners.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-8">
          {/* 2nd Place */}
          {topThree[1] && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="data-card p-8 text-center space-y-4 border-t-4 border-t-slate-400 order-2 md:order-1"
            >
              <div className="relative inline-block">
                <div className="w-20 h-20 rounded-full bg-slate-400/20 flex items-center justify-center border-2 border-slate-400/50 mx-auto">
                  <span className="text-slate-400 text-2xl font-bold">#2</span>
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-slate-400 text-black font-bold flex items-center justify-center text-sm">2</div>
              </div>
              <div>
                <p className="text-sm font-mono font-bold text-slate-400">{formatWallet(topThree[1].wallet)}</p>
                <div className="flex items-center justify-center gap-1 mt-2">
                  <span className="text-2xl font-display font-bold">{formatNumber(topThree[1].totalEarned)}</span>
                  <img 
                    src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                    alt="EXN" 
                    className="w-5 h-5 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <p className="text-[10px] text-muted uppercase tracking-widest mt-1">{formatNumber(topThree[1].hashpower)} TH/s Power</p>
              </div>
            </motion.div>
          )}

          {/* 1st Place */}
          {topThree[0] && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="data-card p-10 text-center space-y-6 border-t-4 border-t-yellow-500 bg-yellow-500/5 shadow-[0_0_30px_rgba(234,179,8,0.1)] order-1 md:order-2 scale-105 z-10"
            >
              <div className="relative inline-block">
                <div className="w-24 h-24 rounded-full bg-yellow-500/20 flex items-center justify-center border-2 border-yellow-500/50 mx-auto">
                  <span className="text-yellow-500 text-3xl font-bold">#1</span>
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-yellow-500 text-black font-bold flex items-center justify-center text-lg">1</div>
              </div>
              <div>
                <p className="text-base font-mono font-bold text-yellow-500">{formatWallet(topThree[0].wallet)}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-4xl font-display font-bold">{formatNumber(topThree[0].totalEarned)}</span>
                  <img 
                    src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                    alt="EXN" 
                    className="w-6 h-6 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <p className="text-xs text-muted uppercase tracking-widest mt-1 font-bold">{formatNumber(topThree[0].hashpower)} TH/s Power</p>
              </div>
            </motion.div>
          )}

          {/* 3rd Place */}
          {topThree[2] && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="data-card p-8 text-center space-y-4 border-t-4 border-t-amber-700 order-3"
            >
              <div className="relative inline-block">
                <div className="w-20 h-20 rounded-full bg-amber-700/20 flex items-center justify-center border-2 border-amber-700/50 mx-auto">
                  <span className="text-amber-700 text-2xl font-bold">#3</span>
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-amber-700 text-white font-bold flex items-center justify-center text-sm">3</div>
              </div>
              <div>
                <p className="text-sm font-mono font-bold text-amber-700">{formatWallet(topThree[2].wallet)}</p>
                <div className="flex items-center justify-center gap-1 mt-2">
                  <span className="text-2xl font-display font-bold">{formatNumber(topThree[2].totalEarned)}</span>
                  <img 
                    src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                    alt="EXN" 
                    className="w-5 h-5 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <p className="text-[10px] text-muted uppercase tracking-widest mt-1">{formatNumber(topThree[2].hashpower)} TH/s Power</p>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* User Rank Section */}
      {publicKey && !loading && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/5 border border-primary/20 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full -mr-16 -mt-16" />
          
          <div className="flex items-center gap-6 z-10">
            <div className="w-16 h-16 rounded-2xl bg-primary flex flex-col items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-[10px] uppercase font-bold text-white/60 leading-none mb-1">Rank</span>
              <span className="text-2xl font-display font-bold text-white">
                {userRank > 0 ? `#${userRank}` : '—'}
              </span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-primary mb-1">Your Current Position</p>
              <h3 className="text-xl font-mono font-bold text-white">
                {userWallet ? formatWallet(userWallet) : 'Wallet Not Connected'}
              </h3>
              {userRank === 0 && (
                <p className="text-xs text-muted mt-1 italic">You are not yet ranked. Start mining to join the leaderboard!</p>
              )}
            </div>
          </div>

          {userMiner && (
            <div className="flex items-center gap-8 md:gap-12 z-10">
              <div className="text-center md:text-right">
                <p className="text-[10px] uppercase tracking-widest font-bold text-muted mb-1">Total Earned</p>
                <div className="flex items-center justify-center md:justify-end gap-2">
                  <span className="text-2xl font-display font-bold text-green-500">{formatNumber(userMiner.totalEarned)}</span>
                  <img 
                    src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                    alt="EXN" 
                    className="w-5 h-5 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
              <div className="text-center md:text-right">
                <p className="text-[10px] uppercase tracking-widest font-bold text-muted mb-1">Hashpower</p>
                <div className="flex items-center justify-center md:justify-end gap-1">
                  <span className="text-2xl font-mono font-bold text-white">{formatNumber(userMiner.hashpower)}</span>
                  <span className="text-xs text-muted font-bold">TH/s</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Search and List */}
      <div className="space-y-6">
        <div className="relative max-w-md">
          <input 
            type="text" 
            placeholder="Search for a miner..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-primary/50 transition-colors"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="data-card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/5">
                  <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-muted w-20">Rank</th>
                  <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-muted">Miner</th>
                  <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-muted">Hashpower</th>
                  <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-muted text-right">Total Rewards</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-20 text-center">
                      <div className="flex flex-col items-center justify-center gap-3 text-muted">
                        <p className="text-xs uppercase tracking-widest">Compiling rankings...</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedMiners.length > 0 ? (
                  paginatedMiners.map((miner, index) => {
                    const rank = miners.indexOf(miner) + 1;
                    return (
                      <motion.tr 
                        key={miner.wallet}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        <td className="p-6">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-xs",
                            rank === 1 ? "bg-yellow-500 text-black" :
                            rank === 2 ? "bg-slate-400 text-black" :
                            rank === 3 ? "bg-amber-700 text-white" :
                            "bg-white/5 text-muted"
                          )}>
                            {rank}
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="text-sm font-mono font-bold">{formatWallet(miner.wallet)}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {miner.countryCode && (
                                  <img 
                                    src={`https://flagcdn.com/w20/${miner.countryCode.toLowerCase()}.png`} 
                                    alt={miner.country}
                                    className="w-4 h-auto rounded-sm opacity-60"
                                    referrerPolicy="no-referrer"
                                  />
                                )}
                                <span className="text-[10px] text-muted uppercase tracking-tighter">{miner.country || 'Unknown Region'}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-bold">{formatNumber(miner.hashpower)}</span>
                            <span className="text-[10px] text-muted">TH/s</span>
                          </div>
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-lg font-display font-bold text-green-500">{formatNumber(miner.totalEarned)}</span>
                            <img 
                              src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                              alt="EXN" 
                              className="w-4 h-4 rounded-full"
                              referrerPolicy="no-referrer"
                            />
                            <span className="text-[10px] text-muted">EXN</span>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="p-20 text-center text-muted text-sm italic">
                      No miners found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-xs text-muted">
              Showing <span className="text-white font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-white font-bold">{Math.min(currentPage * itemsPerPage, filteredMiners.length)}</span> of <span className="text-white font-bold">{filteredMiners.length}</span> miners
            </p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = currentPage;
                  if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  
                  if (pageNum <= 0 || pageNum > totalPages) return null;

                  return (
                    <button 
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                        currentPage === pageNum ? "bg-primary text-white" : "bg-white/5 text-muted hover:bg-white/10"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

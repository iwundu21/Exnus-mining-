import React, { useEffect, useState, useRef } from 'react';
import { Trophy, Medal, User, Zap, TrendingUp, Search, Loader2 } from 'lucide-react';
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
  const [miners, setMiners] = useState<Miner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const isFetchingRef = useRef(false);

  const fetchMiners = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const res = await axios.get('/api/leaderboard', { timeout: 10000 });
      // Sort by totalEarned descending
      const sortedMiners = (res.data || []).sort((a: Miner, b: Miner) => b.totalEarned - a.totalEarned);
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
  const restOfMiners = filteredMiners.slice(0, 50); // Show top 50 in list

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight uppercase flex items-center gap-4">
            <Trophy className="text-yellow-500" size={40} />
            Leaderboard
          </h2>
          <p className="text-muted text-sm md:text-base max-w-2xl mt-2">
            The elite of Exnus Mining. Rankings are based on total EXN rewards earned through the network.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-full border border-yellow-500/20">
          <TrendingUp size={14} className="text-yellow-500" />
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
                  <Medal className="text-slate-400" size={32} />
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
                  <Trophy className="text-yellow-500" size={40} />
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
                  <Medal className="text-amber-700" size={32} />
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

      {/* Search and List */}
      <div className="space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <input 
            type="text" 
            placeholder="Search for a miner..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
                        <Loader2 className="animate-spin" />
                        <p className="text-xs uppercase tracking-widest">Compiling rankings...</p>
                      </div>
                    </td>
                  </tr>
                ) : restOfMiners.length > 0 ? (
                  restOfMiners.map((miner, index) => {
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
                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                              <User size={16} className="text-muted group-hover:text-primary transition-colors" />
                            </div>
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
                            <Zap size={14} className="text-primary" />
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
      </div>
    </div>
  );
}

import React, { useEffect, useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { Cpu, Timer, Database, TrendingUp, Users, Wallet, ArrowUp, ArrowDown, Coins, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatNumber, cn } from '../lib/utils';
import { TOTAL_SUPPLY, BLOCK_INTERVAL } from '../lib/constants';
import BuyHashpowerDialog from './BuyHashpowerDialog';
import Onboarding from './Onboarding';

interface Status {
  currentBlock: number;
  totalBlocks: number;
  countdown: number;
  nextBlockDueAt?: number;
  blockReward: number;
  totalDistributed: number;
  remainingSupply: number;
  totalHashpower: number;
  activeMiners: number;
  totalUsers: number;
}

const AnimatedNumber = ({ value, className }: { value: number, className?: string }) => (
  <span className={className}>
    {formatNumber(value)}
  </span>
);

const TrendIndicator = ({ trend }: { trend: number }) => (
  <span className={cn("flex items-center text-[10px] font-bold", trend >= 0 ? "text-green-500" : "text-red-500")}>
    {trend >= 0 ? <ArrowUp size={10} className="mr-0.5" /> : <ArrowDown size={10} className="mr-0.5" />}
    {Math.abs(trend).toFixed(2)}%
  </span>
);

// ... (rest of the component)

export default function Dashboard() {
  const { publicKey } = useWallet();
  const [status, setStatus] = useState<Status | null>(() => {
    const saved = localStorage.getItem('exnus_status');
    return saved ? JSON.parse(saved) : null;
  });
  const [user, setUser] = useState<any>(null);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [history, setHistory] = useState<any[]>([]);
  const [difficulty, setDifficulty] = useState<string>('84.2P');
  const [isBuyDialogOpen, setIsBuyDialogOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  useEffect(() => {
    if (status) {
      localStorage.setItem('exnus_status', JSON.stringify(status));
    }
  }, [status]);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('exnus_onboarding_seen');
    if (!hasSeenOnboarding) {
      setIsOnboardingOpen(true);
    }
  }, []);

  const formatDifficulty = (diff: number) => {
    if (diff >= 1e15) return (diff / 1e15).toFixed(1) + 'P';
    if (diff >= 1e12) return (diff / 1e12).toFixed(1) + 'T';
    if (diff >= 1e9) return (diff / 1e9).toFixed(1) + 'G';
    if (diff >= 1e6) return (diff / 1e6).toFixed(1) + 'M';
    if (diff >= 1e3) return (diff / 1e3).toFixed(1) + 'K';
    return diff.toFixed(1);
  };

  const isFetchingRef = useRef(false);

  const fetchData = async (retryCount = 0) => {
    if (isFetchingRef.current && retryCount === 0) return;
    isFetchingRef.current = true;
    try {
      const ref = sessionStorage.getItem('exnus_ref');
      const userUrl = publicKey ? `/api/user/${publicKey.toBase58()}${ref ? `?ref=${ref}` : ''}` : null;
      
      const [statusRes, userRes, diffRes, historyRes] = await Promise.all([
        axios.get('/api/status', { timeout: 30000 }),
        userUrl ? axios.get(userUrl, { timeout: 30000 }) : Promise.resolve({ data: null }),
        axios.get('https://blockchain.info/q/getdifficulty', { timeout: 15000 }).catch(() => ({ data: null })),
        axios.get('/api/history', { timeout: 15000 })
      ]);
      
      const newStatus = statusRes.data;
      
      // Only update if the difference is significant (e.g., > 2 seconds)
      if (Math.abs((newStatus.countdown) - (status?.countdown || 0)) > 2) {
        newStatus.countdown = Math.max(0, newStatus.countdown);
        setStatus(newStatus);
      } else {
        // Keep the existing countdown to avoid jumps
        setStatus(prev => ({ ...newStatus, countdown: prev?.countdown || newStatus.countdown }));
      }
      setUser(userRes.data);
      if (Array.isArray(historyRes.data)) {
        const uniqueHistory = historyRes.data.filter((v, i, a) => a.findIndex(v2 => (v2.blockNumber === v.blockNumber)) === i);
        setHistory(uniqueHistory.slice(0, 10).reverse());
      }

      if (diffRes && diffRes.data) {
        const diffNum = parseFloat(diffRes.data);
        if (!isNaN(diffNum)) {
          setDifficulty(formatDifficulty(diffNum));
        }
      }
    } catch (err) {
      console.error("Dashboard error:", err);
      if (retryCount < 3) {
        setTimeout(() => fetchData(retryCount + 1), 2000 * (retryCount + 1));
      }
    } finally {
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(prev => {
        if (!prev || prev.countdown <= 0) return prev;
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [publicKey]);

  useEffect(() => {
    if (!publicKey) {
      setSolBalance(0);
      return;
    }
    const fetchSolBalance = async () => {
      try {
        const res = await axios.get(`/api/sol-balance/${publicKey.toBase58()}`);
        setSolBalance(res.data.balance);
      } catch (err) {
        console.error("Error fetching SOL balance:", err);
      }
    };
    fetchSolBalance();
    const interval = setInterval(fetchSolBalance, 10000);
    return () => clearInterval(interval);
  }, [publicKey]);

  const playTick = () => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playPing = (time: number) => {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, time);
      gainNode.gain.setValueAtTime(0.1, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start(time);
      oscillator.stop(time + 0.05);
    };

    // Pattern: titi titi titi, pause, titi titi titi
    const now = audioCtx.currentTime;
    [0, 0.1, 0.2, 0.4, 0.5, 0.6].forEach(offset => playPing(now + offset));
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setStatus(prev => {
        if (!prev) return prev;
        if (prev.nextBlockDueAt) {
          const now = Math.floor(Date.now() / 1000);
          const remaining = Math.max(0, prev.nextBlockDueAt - now);
          return { ...prev, countdown: remaining };
        }
        return { ...prev, countdown: Math.max(0, prev.countdown - 1) };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number | undefined | null) => {
    if (seconds === undefined || seconds === null || isNaN(seconds)) return '0:00';
    
    if (seconds >= 86400) {
      const d = Math.floor(seconds / 86400);
      const h = Math.floor((seconds % 86400) / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${d}d ${h}h ${m}m ${s}s`;
    }
    
    if (seconds >= 3600) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const chartData = history.map(block => ({
    block: `#${block.blockNumber}`,
    reward: block.reward,
    efficiency: block.totalHashpower ? (block.reward / block.totalHashpower) : 0
  }));

  return (
    <div className="space-y-12">
      <AnimatePresence>
        {isOnboardingOpen && (
          <Onboarding onComplete={() => setIsOnboardingOpen(false)} />
        )}
      </AnimatePresence>
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="status-indicator status-online"></div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-green-500">Network Online</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Overview</h2>
        </div>
        <button 
          onClick={() => setIsOnboardingOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-xs font-bold text-white/60 hover:text-white self-start md:self-end"
        >
          <Info size={14} />
          Tutorial
        </button>
      </header>

      {/* Main Stats Grid */}
      <section className="data-grid">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="data-card"
        >
          <div className="data-value">
            #<AnimatedNumber value={status?.currentBlock || 0} />
          </div>
          <p className="text-[10px] text-muted">Total Mined: {formatNumber(status?.currentBlock || 0)} / {formatNumber(status?.totalBlocks || 0)}</p>
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
              <span>{status?.currentBlock === 0 ? 'Mining Starts In' : 'Next Reward'}</span>
            </div>
            <span className="text-primary font-mono text-xl">
              {status ? formatTime(status.countdown) : '0:00'}
            </span>
          </div>
          <div className="data-value text-primary flex items-center gap-2">
            <AnimatedNumber value={status?.blockReward || 0} />
            <span className="relative group cursor-help flex items-center gap-1 text-xs text-muted">
              <img 
                src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                alt="EXN" 
                className="w-4 h-4 rounded-full"
                referrerPolicy="no-referrer"
              />
              EXN
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-4 bg-black border border-white/10 text-white text-[10px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                <div className="flex items-center gap-2 mb-2">
                  <img 
                    src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                    alt="EXN" 
                    className="w-6 h-6 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                  <p className="font-bold text-primary">EXN Token</p>
                </div>
                <p className="text-muted mb-2">Total Supply: {formatNumber(TOTAL_SUPPLY)}</p>
                <p className="leading-relaxed">Exnus (EXN) is the native utility token powering the Exnus Mining Engine, used for network governance and reward distribution.</p>
              </div>
            </span>
          </div>
          <p className="text-[10px] text-muted">Block Interval: {BLOCK_INTERVAL / 60}m</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="data-card"
        >
          <div className="data-label">
            <div className="flex items-center gap-2">
              <Cpu size={14} />
              <span>Total Hashrate</span>
            </div>
          </div>
          <div className="data-value">
            <AnimatedNumber value={status?.totalHashpower || 0} /> <span className="text-xs text-muted">TH/s</span>
          </div>
          <p className="text-[10px] text-muted">Network Difficulty: {difficulty}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="data-card"
        >
          <div className="data-label">
            <div className="flex items-center gap-2">
              <Users size={14} />
              <span>Active Miners</span>
            </div>
          </div>
          <div className="data-value">
            <AnimatedNumber value={status?.activeMiners || 0} /> <span className="text-xs text-muted">/ {formatNumber(status?.totalUsers || 0)}</span>
          </div>
          <p className="text-[10px] text-muted">Total Registered Users</p>
        </motion.div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Network Distribution Chart Area */}
        <section className="lg:col-span-2 space-y-6">
          <div className="data-card p-8">
            <h3 className="data-label mb-8">Network Distribution</h3>
            
            <div className="space-y-8 mb-12">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-widest mb-1">Supply Distribution</p>
                    <div className="flex items-center gap-2">
                      <img 
                        src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                        alt="EXN" 
                        className="w-6 h-6 rounded-full"
                        referrerPolicy="no-referrer"
                      />
                      <p className="text-2xl font-display font-bold">
                        <AnimatedNumber value={status?.totalDistributed || 0} /> 
                        <span className="text-xs text-muted ml-2">/ {formatNumber(TOTAL_SUPPLY)} EXN</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted uppercase tracking-widest mb-1">Progress</p>
                    <p className="text-sm font-mono font-bold text-primary">
                      {((status?.totalDistributed || 0) / TOTAL_SUPPLY * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, ((status?.totalDistributed || 0) / TOTAL_SUPPLY) * 100)}%` }}
                    className="h-full bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-4 border-t border-white/5">
                <div className="space-y-1">
                  <p className="data-label">Total Distributed</p>
                  <div className="flex items-center gap-1">
                    <p className="text-xl font-mono font-bold text-green-500">{formatNumber(status?.totalDistributed || 0)}</p>
                    <img 
                      src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                      alt="EXN" 
                      className="w-4 h-4 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-[10px] text-muted">EXN</span>
                  </div>
                </div>
                <div className="space-y-1 text-right">
                  <p className="data-label">Remaining Supply</p>
                  <div className="flex items-center justify-end gap-1">
                    <p className="text-xl font-mono font-bold">{formatNumber(TOTAL_SUPPLY - (status?.totalDistributed || 0))}</p>
                    <img 
                      src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                      alt="EXN" 
                      className="w-4 h-4 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-[10px] text-muted">EXN</span>
                  </div>
                </div>
              </div>
            </div>

            <h3 className="data-label mb-8">Block Reward Distribution</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="block" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.1)' }}
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                  />
                  <Line type="monotone" dataKey="reward" stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* User Sidebar Info */}
        <section className="space-y-6">
          {publicKey && user ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="data-card p-8 space-y-8"
            >
              <div className="space-y-2">
                <p className="data-label text-primary">Your Mining Status</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-primary/20 border border-primary/30">
                    <img 
                      src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                      alt="EXN Logo" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-bold flex items-center gap-2">
                      <AnimatedNumber value={user.totalEarned} /> 
                      <span className="text-xs text-muted">EXN</span>
                    </h3>
                    <p className="text-[10px] text-muted uppercase tracking-widest">Total Rewards</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-white/5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted">SOL Balance</span>
                    <img 
                      src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafkreihx2yxwcaucavhn7lf55mgi2jqwkf66sj4pmaucthokzgrjty525i" 
                      alt="SOL" 
                      className="w-3 h-3 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <span className="text-sm font-mono font-bold text-green-500">
                    {solBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted">Current Hashpower</span>
                  <span className="text-sm font-mono font-bold"><AnimatedNumber value={user.hashpower} /> TH/s</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted">Network Share</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold">
                      {status?.totalHashpower ? ((user.hashpower / status.totalHashpower) * 100).toFixed(4) : 0}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted">Daily Est.</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-mono font-bold text-primary">
                      ~<AnimatedNumber value={
                        (user.hashpower && status?.totalHashpower && status?.blockReward)
                          ? (user.hashpower / status.totalHashpower) * status.blockReward * (24 * 60 * 60 / BLOCK_INTERVAL)
                          : 0
                      } />
                    </span>
                    <img 
                      src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                      alt="EXN" 
                      className="w-3 h-3 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-[10px] text-muted">EXN</span>
                  </div>
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
            <div className="data-card p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-white/5 mx-auto flex items-center justify-center border border-white/10">
                <Wallet className="text-primary" size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold tracking-tight">Connect to Mining Engine</h3>
                <p className="text-xs text-muted leading-relaxed max-w-[240px] mx-auto">
                  Securely link your Solana wallet to monitor your mining assets and network rewards. 
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

import React, { useEffect, useState, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import axios from 'axios';
import { motion } from 'motion/react';
import { formatNumber } from '../lib/utils';
import BuyHashpowerDialog from './BuyHashpowerDialog';
import WithdrawDialog from './WithdrawDialog';
import CopyButton from './CopyButton';

export default function MyAssets() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState<number>(0);
  const [status, setStatus] = useState<any>(null);
  const [isBuyDialogOpen, setIsBuyDialogOpen] = useState(false);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const isFetchingRef = useRef(false);

  // Pagination logic
  const totalPages = user?.history ? Math.ceil(user.history.length / itemsPerPage) : 0;
  const paginatedHistory = user?.history?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  ) || [];

  // Fetch user data (history, hashpower)
  const fetchUserData = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const ref = sessionStorage.getItem('exnus_ref');
      const userUrl = publicKey ? `/api/user/${publicKey.toBase58()}${ref ? `?ref=${ref}` : ''}` : null;

      const [statusRes, userRes] = await Promise.all([
        axios.get('/api/status', { timeout: 10000 }),
        userUrl ? axios.get(userUrl, { timeout: 10000 }) : Promise.resolve({ data: null })
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
      console.error("MyAssets fetch error:", err);
    } finally {
      isFetchingRef.current = false;
    }
  };

  // Real-time balance subscription
  useEffect(() => {
    if (!publicKey) {
      setBalance(0);
      return;
    }

    // Fetch balance from server-side Alchemy API
    const fetchBalance = async () => {
      try {
        const res = await axios.get(`/api/sol-balance/${publicKey.toBase58()}`);
        setBalance(res.data.balance);
      } catch (err) {
        console.error("Error fetching SOL balance:", err);
      }
    };
    
    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [publicKey]);

  // Polling for user data
  useEffect(() => {
    fetchUserData();
    const interval = setInterval(fetchUserData, 10000);
    return () => clearInterval(interval);
  }, [publicKey]);

  // Helper to determine font size based on length
  const getFontSizeClass = (value: number) => {
    const str = formatNumber(value || 0);
    if (str.length > 20) return "text-sm";
    if (str.length > 15) return "text-lg";
    if (str.length > 10) return "text-2xl";
    return "text-4xl";
  };

  if (!publicKey) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h2 className="text-xl font-bold">Wallet Disconnected</h2>
        <p className="text-sm opacity-50">Please connect your Solana wallet to view your assets and hashpower.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <h2 className="text-3xl font-bold tracking-tight uppercase">My Assets</h2>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <button 
              disabled={true}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 text-white/30 border border-white/10 rounded-xl font-bold text-xs tracking-widest uppercase cursor-not-allowed shrink-0"
            >
              Withdraw EXN
              <span className="ml-1 text-[8px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">Coming Soon</span>
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 border border-white/10 rounded-lg text-[10px] text-white/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Withdrawals will be available once the EXN Smart Contract is deployed.
            </div>
          </div>
          <button 
            onClick={() => setIsBuyDialogOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-accent transition-colors shadow-lg shadow-primary/20 shrink-0"
          >
            Buy Hashpower
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="data-card p-6 md:p-8 space-y-2 min-w-0"
        >
          <p className="data-label text-primary text-xs md:text-sm">Available Balance</p>
          <div className="flex items-baseline gap-2 overflow-hidden">
            <span className={`${getFontSizeClass((user?.totalEarned || 0) - (user?.withdrawnAmount || 0))} font-mono font-bold truncate`}>
              {formatNumber((user?.totalEarned || 0) - (user?.withdrawnAmount || 0))}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <img 
                src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                alt="EXN" 
                className="w-4 h-4 rounded-full"
                referrerPolicy="no-referrer"
              />
              <span className="text-xs md:text-sm text-muted font-bold">EXN</span>
            </div>
          </div>
          <p className="text-[10px] text-muted uppercase tracking-widest">Total Earned: {formatNumber(user?.totalEarned || 0)} EXN</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="data-card p-6 md:p-8 space-y-2 min-w-0"
        >
          <div className="flex items-center gap-1">
            <p className="data-label text-xs md:text-sm">SOL Balance</p>
            <img 
              src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafkreihx2yxwcaucavhn7lf55mgi2jqwkf66sj4pmaucthokzgrjty525i" 
              alt="SOL" 
              className="w-3 h-3 rounded-full"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex items-baseline gap-2 overflow-hidden">
            <span className={`${getFontSizeClass(balance || 0)} font-mono font-bold truncate`}>
              {formatNumber(balance || 0)}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <img 
                src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafkreihx2yxwcaucavhn7lf55mgi2jqwkf66sj4pmaucthokzgrjty525i" 
                alt="SOL" 
                className="w-4 h-4 rounded-full"
                referrerPolicy="no-referrer"
              />
              <span className="text-xs md:text-sm text-muted font-bold">SOL</span>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="data-card p-6 md:p-8 space-y-2 min-w-0"
        >
          <p className="data-label text-xs md:text-sm">Hashpower</p>
          <div className="flex items-baseline gap-2 overflow-hidden">
            <span className={`${getFontSizeClass(user?.hashpower || 0)} font-mono font-bold truncate`}>
              {formatNumber(user?.hashpower || 0)}
            </span>
            <span className="text-xs md:text-sm text-muted font-bold shrink-0">TH/s</span>
          </div>
        </motion.div>
      </div>

      <div className="space-y-4">
        <h3 className="data-label">Mining History</h3>
        <div className="data-card overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-muted">Block</th>
                <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-muted">Reward Hash ID</th>
                <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-muted">Reward</th>
                <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-muted">Hashpower</th>
                <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-muted">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHistory.length > 0 ? (
                paginatedHistory.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4 font-mono text-sm">#{item.blockNumber}</td>
                    <td className="p-4">
                      <div className="font-mono text-[9px] text-primary/70 bg-primary/5 px-2 py-1 rounded border border-primary/10 flex items-center justify-between gap-2 w-full max-w-[140px]">
                        <span className="truncate flex-1">{item.rewardHash || item.hash || 'PENDING_HASH_GENERATION...'}</span>
                        <CopyButton value={item.rewardHash || item.hash || ''} />
                      </div>
                    </td>
                    <td className={`p-4 font-mono text-sm flex items-center gap-1 ${item.reward > 0 ? 'text-primary' : 'text-green-500'}`}>
                      {item.reward > 0 ? `+${formatNumber(item.reward)}` : '0.00'} 
                      <img 
                        src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                        alt="EXN" 
                        className="w-3 h-3 rounded-full"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[10px] text-muted">EXN</span>
                    </td>
                    <td className="p-4 font-mono text-sm">{formatNumber(item.hashpower)} TH/s</td>
                    <td className="p-4 font-mono text-xs text-muted">
                      {new Date(item.timestamp * 1000).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted text-sm italic">
                    No mining history available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white/5 rounded-lg text-xs font-bold uppercase tracking-widest disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs font-mono text-muted">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white/5 rounded-lg text-xs font-bold uppercase tracking-widest disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <BuyHashpowerDialog 
        isOpen={isBuyDialogOpen} 
        onClose={() => setIsBuyDialogOpen(false)} 
        onPurchaseSuccess={fetchUserData}
      />

      <WithdrawDialog 
        isOpen={isWithdrawDialogOpen} 
        onClose={() => setIsWithdrawDialogOpen(false)} 
        availableBalance={(user?.totalEarned || 0) - (user?.withdrawnAmount || 0)}
        onWithdrawSuccess={fetchUserData}
      />
    </div>
  );
}

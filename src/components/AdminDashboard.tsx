import React, { useState, useEffect } from 'react';
import { Shield, User, Zap, Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';

interface Miner {
  wallet: string;
  referralId?: string;
  hashpower: number;
  totalEarned: number;
  lastActive: number;
  solSpent?: number;
  country?: string;
  countryCode?: string;
}

const formatWallet = (wallet: string) => {
  if (!wallet) return '';
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 5)}****${wallet.slice(-6)}`;
};

export default function AdminDashboard() {
  const { publicKey } = useWallet();
  const [miners, setMiners] = useState<Miner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMiner, setSelectedMiner] = useState<Miner | null>(null);
  const [newHashpower, setNewHashpower] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [clearMessage, setClearMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resettingFactory, setResettingFactory] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (publicKey) {
      fetchMiners();
    }
  }, [publicKey]);

  const fetchMiners = async () => {
    if (!publicKey) return;
    try {
      const res = await axios.get(`/api/status?adminWallet=${publicKey.toString()}`, { timeout: 10000 });
      setMiners(res.data.miners || []);
    } catch (err) {
      console.error('Failed to fetch miners:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!publicKey) return;
    setClearingHistory(true);
    setClearMessage(null);
    try {
      await axios.post('/api/admin/clear-history', { adminWallet: publicKey.toString() });
      setClearMessage({ type: 'success', text: 'All history data cleared successfully.' });
      setShowClearConfirm(false);
      fetchMiners(); // Refresh list
    } catch (err) {
      console.error('Failed to clear history:', err);
      setClearMessage({ type: 'error', text: 'Failed to clear history. Please try again.' });
    } finally {
      setClearingHistory(false);
    }
  };

  const handleFactoryReset = async () => {
    if (!publicKey) return;
    setResettingFactory(true);
    setResetMessage(null);
    try {
      await axios.post('/api/admin/factory-reset', { adminWallet: publicKey.toString() });
      setResetMessage({ type: 'success', text: 'Factory reset completed successfully. Network restarted.' });
      setShowResetConfirm(false);
      fetchMiners(); // Refresh list (should be empty)
    } catch (err) {
      console.error('Failed to factory reset:', err);
      setResetMessage({ type: 'error', text: 'Failed to factory reset. Please try again.' });
    } finally {
      setResettingFactory(false);
    }
  };

  const handleSetHashpower = async () => {
    if (!selectedMiner || !newHashpower || !publicKey) return;
    
    setSubmitting(true);
    setMessage(null);
    
    try {
      const res = await axios.post('/api/set-hashpower', {
        wallet: selectedMiner.wallet,
        hashpower: parseFloat(newHashpower),
        adminWallet: publicKey.toString()
      });
      
      setMessage({ type: 'success', text: `Successfully set hashpower for ${selectedMiner.wallet.slice(0, 8)}...` });
      setSelectedMiner(res.data);
      setNewHashpower('');
      fetchMiners(); // Refresh list
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update hashpower. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMiners = miners.filter(m => 
    m.wallet.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold tracking-tight flex items-center gap-3">
            <Shield className="text-primary" size={32} />
            Admin Control
          </h2>
          <p className="text-muted text-sm mt-1">Manage network hashpower and monitor user activity.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-muted uppercase tracking-widest font-bold">Total Users</p>
            <p className="text-xl font-mono font-bold">{miners.length}</p>
          </div>
          <div className="h-8 w-px bg-white/10"></div>
          <div className="text-right">
            <p className="text-[10px] text-muted uppercase tracking-widest font-bold">Network Power</p>
            <p className="text-xl font-mono font-bold text-primary">
              {(miners.reduce((sum, m) => sum + (m.hashpower || 0), 0)).toLocaleString()} <span className="text-[10px]">TH/s</span>
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Miner Table Area */}
        <div className="xl:col-span-3 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input 
              type="text" 
              placeholder="Search by wallet address..."
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
                    <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-muted">Miner Wallet</th>
                    <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-muted">Ref ID</th>
                    <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-muted">Country</th>
                    <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-muted">Hashpower</th>
                    <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-muted">
                      <div className="flex items-center gap-1">
                        SOL Spent
                        <img 
                          src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafkreihx2yxwcaucavhn7lf55mgi2jqwkf66sj4pmaucthokzgrjty525i" 
                          alt="SOL" 
                          className="w-3 h-3 rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </th>
                    <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-muted">EXN Balance</th>
                    <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 text-muted">
                          <Loader2 className="animate-spin" />
                          <p className="text-xs uppercase tracking-widest">Loading network data...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredMiners.length > 0 ? (
                    filteredMiners.map((miner) => (
                      <tr 
                        key={miner.wallet}
                        className={`hover:bg-white/5 transition-colors group ${selectedMiner?.wallet === miner.wallet ? 'bg-primary/5' : ''}`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                              <User size={14} className="text-muted group-hover:text-primary transition-colors" />
                            </div>
                            <span className="text-sm font-mono font-bold truncate max-w-[120px]" title={miner.wallet}>
                              {formatWallet(miner.wallet)}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-mono font-bold text-blue-400">{miner.referralId || '-'}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {miner.countryCode && miner.countryCode !== 'UN' ? (
                              <img 
                                src={`https://flagcdn.com/w20/${miner.countryCode.toLowerCase()}.png`} 
                                alt={miner.country}
                                className="w-5 h-auto rounded-sm"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-5 h-3.5 bg-white/10 rounded-sm"></div>
                            )}
                            <span className="text-xs text-muted">{miner.country || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-mono font-bold text-primary">{(miner.hashpower || 0).toLocaleString()}</span>
                          <span className="text-[10px] text-muted ml-1">TH/s</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-mono font-bold text-yellow-500/80">{(miner.solSpent || 0).toFixed(2)}</span>
                            <img 
                              src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafkreihx2yxwcaucavhn7lf55mgi2jqwkf66sj4pmaucthokzgrjty525i" 
                              alt="SOL" 
                              className="w-3 h-3 rounded-full"
                              referrerPolicy="no-referrer"
                            />
                            <span className="text-[10px] text-muted">SOL</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-mono font-bold text-green-500">{(miner.totalEarned || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            <img 
                              src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                              alt="EXN" 
                              className="w-3 h-3 rounded-full"
                              referrerPolicy="no-referrer"
                            />
                            <span className="text-[10px] text-muted">EXN</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <button 
                            onClick={() => setSelectedMiner(miner)}
                            className="text-[10px] uppercase tracking-widest font-bold text-primary hover:text-accent transition-colors"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-muted text-sm">
                        No miners found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {selectedMiner ? (
              <motion.div
                key={selectedMiner.wallet}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-6 bg-surface/50 border border-white/10 rounded-2xl space-y-6 sticky top-8"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-primary">
                    <Zap size={18} />
                    <h3 className="font-bold">Grant Hashpower</h3>
                  </div>
                  <p className="text-xs text-muted">Updating power for:</p>
                  <p className="text-[10px] font-mono bg-black/30 p-2 rounded border border-white/5 break-all">
                    {formatWallet(selectedMiner.wallet)}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-muted">New Hashpower (TH/s)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 5000"
                      className="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                      value={newHashpower}
                      onChange={(e) => setNewHashpower(e.target.value)}
                    />
                  </div>

                  <button 
                    onClick={handleSetHashpower}
                    disabled={submitting || !newHashpower}
                    className="w-full py-4 bg-primary text-white rounded-xl font-bold text-sm tracking-widest uppercase hover:bg-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="animate-spin" size={16} /> : 'Update Power'}
                  </button>
                </div>

                {message && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-lg flex items-start gap-2 text-xs ${message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}
                  >
                    {message.type === 'success' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
                    <span>{message.text}</span>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <div className="p-8 border border-dashed border-white/10 rounded-2xl text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-white/5 mx-auto flex items-center justify-center">
                  <User className="text-muted" size={20} />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Select a miner from the table to manage their hashpower settings.
                </p>
              </div>
            )}
          </AnimatePresence>

          {/* Clear History Panel */}
          <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl space-y-4 mt-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle size={18} />
                <h3 className="font-bold">Danger Zone</h3>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Clearing history will permanently delete all block history and user mining records. This action cannot be undone.
              </p>
            </div>

            {!showClearConfirm ? (
              <button 
                onClick={() => setShowClearConfirm(true)}
                className="w-full py-3 bg-red-500/10 text-red-500 rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-red-500/20 transition-all border border-red-500/20"
              >
                Clear All History
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-red-400 font-bold text-center">Are you absolutely sure?</p>
                <div className="flex gap-2">
                  <button 
                    onClick={handleClearHistory}
                    disabled={clearingHistory}
                    className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {clearingHistory ? <Loader2 className="animate-spin" size={14} /> : 'Yes, Delete'}
                  </button>
                  <button 
                    onClick={() => setShowClearConfirm(false)}
                    disabled={clearingHistory}
                    className="flex-1 py-3 bg-white/5 text-white rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-white/10 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {clearMessage && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-lg flex items-start gap-2 text-xs ${clearMessage.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}
              >
                {clearMessage.type === 'success' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
                <span>{clearMessage.text}</span>
              </motion.div>
            )}
          </div>

          {/* Factory Reset Panel */}
          <div className="p-6 bg-red-600/10 border border-red-600/30 rounded-2xl space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle size={18} />
                <h3 className="font-bold">Factory Reset</h3>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                This will delete ALL users, ALL history, and reset the mining engine to the current timestamp. This is the ultimate reset.
              </p>
            </div>

            {!showResetConfirm ? (
              <button 
                onClick={() => setShowResetConfirm(true)}
                className="w-full py-3 bg-red-600/20 text-red-600 rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-red-600/30 transition-all border border-red-600/30"
              >
                Factory Reset App
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-red-500 font-bold text-center">DELETE EVERYTHING? NO UNDO!</p>
                <div className="flex gap-2">
                  <button 
                    onClick={handleFactoryReset}
                    disabled={resettingFactory}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {resettingFactory ? <Loader2 className="animate-spin" size={14} /> : 'YES, RESET ALL'}
                  </button>
                  <button 
                    onClick={() => setShowResetConfirm(false)}
                    disabled={resettingFactory}
                    className="flex-1 py-3 bg-white/5 text-white rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-white/10 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {resetMessage && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-lg flex items-start gap-2 text-xs ${resetMessage.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}
              >
                {resetMessage.type === 'success' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
                <span>{resetMessage.text}</span>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

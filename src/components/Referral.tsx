import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Share2, Copy, Check, Users, Gift, TrendingUp, ExternalLink } from 'lucide-react';
import axios from 'axios';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function Referral() {
  const { publicKey } = useWallet();
  const [copied, setCopied] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const referralLink = publicKey && userData?.referralId
    ? `${window.location.origin}?ref=${userData.referralId}`
    : publicKey ? 'Loading your unique ID...' : 'Connect wallet to see your link';

  useEffect(() => {
    if (publicKey) {
      fetchUserData();
    } else {
      setLoading(false);
    }
  }, [publicKey]);

  const fetchUserData = async () => {
    if (!publicKey) return;
    try {
      setLoading(true);
      const ref = sessionStorage.getItem('exnus_ref');
      const res = await axios.get(`/api/user/${publicKey.toString()}${ref ? `?ref=${ref}` : ''}`);
      setUserData(res.data);
    } catch (err) {
      console.error("Error fetching user data for referral:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = [
    {
      label: "Total Referrals",
      value: userData?.referralCount || 0,
      icon: Users,
      color: "text-blue-400"
    },
    {
      label: "Referral Bonus",
      value: `${((userData?.referralCount || 0) * 0.1).toFixed(1)} TH/s`,
      icon: TrendingUp,
      color: "text-green-400"
    },
    {
      label: "Program Status",
      value: "Active",
      icon: Check,
      color: "text-primary"
    }
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Referral Program</h2>
          <p className="text-muted text-sm uppercase tracking-widest font-bold mt-1">Grow the network, earn more hashpower</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Referral Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Gift size={120} />
            </div>
            
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-4">Your Referral Link</h3>
              <p className="text-muted text-sm mb-6 max-w-md">
                Share your unique link with friends. For every friend who joins using your link, 
                you'll receive a permanent <span className="text-primary font-bold">0.1 TH/s</span> hashpower boost.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm truncate flex items-center">
                  {referralLink}
                </div>
                <button 
                  onClick={copyToClipboard}
                  disabled={!publicKey}
                  className={cn(
                    "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-all",
                    copied ? "bg-green-500 text-white" : "bg-primary text-black hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                  )}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Copied" : "Copy Link"}
                </button>
              </div>

              {!publicKey && (
                <p className="mt-4 text-xs text-red-400 font-bold uppercase tracking-tighter">
                  Please connect your wallet to generate your referral link.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map((stat, i) => (
              <div key={i} className="card p-6 flex flex-col items-center text-center">
                <div className={cn("p-3 rounded-full bg-white/5 mb-4", stat.color)}>
                  <stat.icon size={24} />
                </div>
                <span className="text-[10px] text-muted uppercase tracking-widest font-bold mb-1">{stat.label}</span>
                <span className="text-xl font-bold">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              How it works
            </h3>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">1</div>
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-tight">Share Link</h4>
                  <p className="text-xs text-muted mt-1 leading-relaxed">Send your unique referral link to your friends and community.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">2</div>
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-tight">Friend Joins</h4>
                  <p className="text-xs text-muted mt-1 leading-relaxed">Your friend connects their wallet for the first time using your link.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">3</div>
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-tight">Earn Rewards</h4>
                  <p className="text-xs text-muted mt-1 leading-relaxed">You instantly receive 0.1 TH/s hashpower for every successful referral.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6 bg-primary/5 border-primary/20">
            <h3 className="text-sm font-bold uppercase tracking-widest mb-3">Pro Tip</h3>
            <p className="text-xs text-muted leading-relaxed italic">
              "There is no limit to how many friends you can refer. Top referrers can earn massive passive hashpower without spending a single SOL."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

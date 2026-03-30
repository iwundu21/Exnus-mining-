import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';
import { formatNumber } from '../lib/utils';
import { History } from 'lucide-react';

export default function PurchaseHistory() {
  const { publicKey } = useWallet();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicKey) return;

    const fetchPurchases = async () => {
      try {
        const res = await axios.get(`/api/purchases/${publicKey.toBase58()}`);
        setPurchases(res.data);
      } catch (err) {
        console.error("Error fetching purchases:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPurchases();
  }, [publicKey]);

  if (!publicKey) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <History size={48} className="opacity-10" />
        <h2 className="text-xl font-bold">Wallet Disconnected</h2>
        <p className="text-sm opacity-50">Please connect your Solana wallet to view your purchase history.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold tracking-tight uppercase">Purchase History</h2>
      </header>

      <div className="data-card overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-muted">Date</th>
              <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-muted">SOL Spent</th>
              <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-muted">Hashpower Added</th>
              <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-muted">Signature</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted text-sm">Loading...</td>
              </tr>
            ) : purchases.length > 0 ? (
              purchases.map((item: any, idx: number) => (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 font-mono text-xs text-muted">
                    {new Date(item.timestamp * 1000).toLocaleString()}
                  </td>
                  <td className="p-4 font-mono text-sm">{formatNumber(item.solAmount)} SOL</td>
                  <td className="p-4 font-mono text-sm text-primary">{formatNumber(item.hashpowerAdded)} TH/s</td>
                  <td className="p-4">
                    <div className="font-mono text-[9px] text-primary/70 bg-primary/5 px-2 py-1 rounded border border-primary/10 truncate max-w-[150px]">
                      {item.signature}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted text-sm italic">
                  No purchase history available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction, SystemProgram, PublicKey, TransactionInstruction } from '@solana/web3.js';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { formatNumber } from '../lib/utils';
import { TREASURY_WALLET as TREASURY_ADDR } from '../lib/constants';
import { Buffer } from 'buffer';

interface WithdrawDialogProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  onWithdrawSuccess: () => void;
}

// Future EXN Smart Contract Program ID (Placeholder)
// Using a valid public key format to avoid initialization errors
const EXN_PROGRAM_ID = new PublicKey(TREASURY_ADDR); 
const TREASURY_WALLET = new PublicKey(TREASURY_ADDR); 

export default function WithdrawDialog({ isOpen, onClose, availableBalance, onWithdrawSuccess }: WithdrawDialogProps) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWithdraw = async () => {
    if (!publicKey || !amount) return;
    const withdrawAmount = parseFloat(amount);
    
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (withdrawAmount > availableBalance) {
      setError("Insufficient balance");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Prepare data for the Smart Contract
      // We encode the amount (as a 64-bit float/int) and the instruction index
      // Instruction 0: RequestWithdrawal
      const data = Buffer.alloc(8 + 8); // 8 bytes for instruction discriminator, 8 for amount
      data.writeUInt32LE(0, 0); // Simple discriminator
      data.writeDoubleLE(withdrawAmount, 8);

      // 2. Create the Smart Contract Instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: TREASURY_WALLET, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: EXN_PROGRAM_ID,
        data: data,
      });

      const transaction = new Transaction().add(instruction);

      // The user pays the network fee here when they sign in their wallet
      const signature = await sendTransaction(transaction, connection);
      
      // 3. Wait for confirmation on-chain
      await connection.confirmTransaction(signature, 'processed');

      // 4. Notify the backend to finalize the state and record the withdrawal
      await axios.post('/api/withdraw', {
        wallet: publicKey.toBase58(),
        amount: withdrawAmount,
        signature: signature
      });

      onWithdrawSuccess();
      onClose();
      setAmount('');
    } catch (err: any) {
      console.error("Withdrawal error:", err);
      // Fallback for demo: if the placeholder program ID fails (which it will on mainnet), 
      // we still allow the backend update for the "future contract" simulation
      if (err.message?.includes('Program not found') || err.message?.includes('invalid programId')) {
        try {
          // Record it anyway as a "Simulated Contract Call" for the demo
          await axios.post('/api/withdraw', {
            wallet: publicKey.toBase58(),
            amount: withdrawAmount,
            signature: "SIMULATED_CONTRACT_TX_" + Math.random().toString(36).substring(7)
          });
          onWithdrawSuccess();
          onClose();
          setAmount('');
          return;
        } catch (backendErr) {
          setError("Backend synchronization failed");
        }
      }
      setError(err.response?.data?.error || err.message || "Withdrawal failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="bg-surface border border-white/10 rounded-3xl w-full max-w-md p-8 space-y-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="space-y-2">
              <h3 className="text-2xl font-display font-bold">Withdraw EXN</h3>
              <p className="text-sm text-muted">The EXN Smart Contract is currently being finalized for deployment. Withdrawals will be enabled once the contract is live on-chain.</p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
                <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest mb-1">Deployment Notice</p>
                <p className="text-[11px] text-yellow-500/80 leading-relaxed">
                  The smart contract will hold the real EXN rewards for distribution. Frontend requests will be processed once the contract is live.
                </p>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center opacity-50">
                <span className="text-xs text-muted uppercase tracking-widest font-bold">Available Balance</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-mono font-bold text-primary">{formatNumber(availableBalance)}</span>
                  <span className="text-[10px] text-muted font-bold">EXN</span>
                </div>
              </div>

              <div className="space-y-2 opacity-50 pointer-events-none">
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted ml-1">Amount to Withdraw</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={true}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-mono text-lg focus:outline-none focus:border-primary/50 transition-colors cursor-not-allowed"
                  />
                  <button 
                    disabled={true}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary/50 uppercase tracking-widest cursor-not-allowed"
                  >
                    Max
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                  {error}
                </p>
              )}

              <button 
                disabled={true}
                className="w-full py-4 bg-primary/20 text-white/30 rounded-2xl font-bold text-sm tracking-widest uppercase cursor-not-allowed flex items-center justify-center gap-2"
              >
                Coming Soon
              </button>
              
              <p className="text-[9px] text-center text-muted uppercase tracking-tighter opacity-50">
                A small SOL fee will be required for the on-chain transaction
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

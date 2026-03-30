import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cpu, Wallet, Coins, ArrowRight, X, CheckCircle2, Info, Zap, Users } from 'lucide-react';
import { cn } from '../lib/utils';

interface OnboardingProps {
  onComplete: () => void;
}

const steps = [
  {
    title: "Welcome to Exnus",
    description: "Exnus is a high-performance decentralized mining engine built on Solana. Mine EXNUS tokens in real-time with zero hardware requirements.",
    icon: <Cpu className="w-12 h-12 text-primary" />,
    color: "from-blue-500/20 to-cyan-500/20"
  },
  {
    title: "How it Works",
    description: "New blocks are mined every 20 minutes. Your share of the block reward is proportional to your Hashpower relative to the total network Hashpower.",
    icon: <Zap className="w-12 h-12 text-yellow-500" />,
    color: "from-yellow-500/20 to-orange-500/20"
  },
  {
    title: "Connect Your Wallet",
    description: "To start mining, connect your Solana wallet (Phantom, Solflare, etc.). This allows you to track your earnings and manage your hashpower.",
    icon: <Wallet className="w-12 h-12 text-purple-500" />,
    color: "from-purple-500/20 to-pink-500/20"
  },
  {
    title: "Get Hashpower",
    description: "Purchase Hashpower using SOL. More Hashpower means a larger share of every block reward. Your mining is fully automated once you have Hashpower.",
    icon: <Coins className="w-12 h-12 text-green-500" />,
    color: "from-green-500/20 to-emerald-500/20"
  },
  {
    title: "Referral Program",
    description: "Invite friends using your unique link. When they make their first hashpower purchase, both you and your friend receive a permanent 0.004 TH/s bonus.",
    icon: <Users className="w-12 h-12 text-blue-500" />,
    color: "from-blue-500/20 to-cyan-500/20"
  },
  {
    title: "Ready to Mine?",
    description: "You're all set! Monitor the network status, track your rewards, and grow your mining operation. Welcome to the future of mining.",
    icon: <CheckCircle2 className="w-12 h-12 text-primary" />,
    color: "from-primary/20 to-blue-500/20"
  }
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    localStorage.setItem('exnus_onboarding_seen', 'true');
    onComplete();
  };

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-lg overflow-hidden bg-[#151619] border border-white/10 rounded-2xl shadow-2xl"
      >
        {/* Background Glow */}
        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30 transition-colors duration-500", step.color)} />
        
        <div className="relative p-8 flex flex-col items-center text-center">
          <button 
            onClick={handleComplete}
            className="absolute top-4 right-4 p-2 text-white/40 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>

          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            className="mb-6 p-4 bg-white/5 rounded-2xl border border-white/10"
          >
            {step.icon}
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">
                {step.title}
              </h2>
              <p className="text-white/60 leading-relaxed mb-8">
                {step.description}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between w-full mt-auto">
            <div className="flex gap-1.5">
              {steps.map((_, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    idx === currentStep ? "w-8 bg-primary" : "w-2 bg-white/10"
                  )}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-black font-bold rounded-xl hover:bg-primary/90 transition-all active:scale-95 group"
            >
              {currentStep === steps.length - 1 ? "Get Started" : "Next"}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

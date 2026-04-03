import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import axios from 'axios';
import { TOTAL_SUPPLY } from '../lib/constants';

export default function HowItWorks() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await axios.get('/api/status');
        const totalDistributed = response.data.totalDistributed || 0;
        const calculatedProgress = (totalDistributed / TOTAL_SUPPLY) * 100;
        setProgress(Math.min(calculatedProgress, 100));
      } catch (error) {
        console.error('Error fetching mining status:', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      className="space-y-12 pb-20"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Hero Section */}
      <header className="space-y-4">
        <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">
          Protocol Documentation
        </motion.div>
        <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold tracking-tight uppercase leading-none">
          How Exnus <span className="text-primary">Works</span>
        </motion.h2>
        <motion.p variants={itemVariants} className="text-muted max-w-2xl text-sm md:text-base leading-relaxed">
          Exnus is a decentralized mining infrastructure designed to empower the community through a fair-launch distribution model. By contributing computational resources to the network, participants secure the ecosystem and earn EXN tokens.
        </motion.p>
      </header>

      {/* Core Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="data-card p-6 space-y-4 border-t-2 border-t-primary">
          <h3 className="text-lg font-bold uppercase tracking-tight">Decentralized Mining</h3>
          <p className="text-xs text-muted leading-relaxed">
            A community-driven system where EXN tokens are distributed based on verifiable network contribution. No pre-mine, no venture capital control—just pure protocol-driven mining.
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="data-card p-6 space-y-4 border-t-2 border-t-blue-500">
          <h3 className="text-lg font-bold uppercase tracking-tight">Zero Vesting</h3>
          <p className="text-xs text-muted leading-relaxed">
            At the Token Generation Event (TGE), 100% of your mined tokens are unlocked. We believe in immediate liquidity for our miners, ensuring your rewards are yours from day one.
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="data-card p-6 space-y-4 border-t-2 border-t-accent">
          <h3 className="text-lg font-bold uppercase tracking-tight">15-Year Horizon</h3>
          <p className="text-xs text-muted leading-relaxed">
            Exnus isn't a short-term project. Following TGE, the main mining system will launch with a sustainable 15-year emission schedule, ensuring long-term network stability.
          </p>
        </motion.div>
      </div>

      {/* The Mining Process */}
      <section className="space-y-8">
        <motion.div variants={itemVariants} className="flex items-center gap-4">
          <div className="h-px flex-1 bg-white/5"></div>
          <h3 className="text-xl font-bold uppercase tracking-widest text-primary">The Mining Process</h3>
          <div className="h-px flex-1 bg-white/5"></div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div variants={itemVariants} className="data-card p-6 space-y-4">
            <h4 className="text-lg font-bold uppercase tracking-tight text-white/90">Block Intervals</h4>
            <p className="text-xs text-muted leading-relaxed">
              The Exnus network operates on a fixed block schedule. A new block is mined exactly every <strong>20 minutes</strong> (1,200 seconds). This predictable interval ensures a steady and secure emission of EXN tokens over the entire Genesis Phase.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="data-card p-6 space-y-4">
            <h4 className="text-lg font-bold uppercase tracking-tight text-white/90">Block Rewards</h4>
            <p className="text-xs text-muted leading-relaxed">
              The total Genesis supply is capped at <strong>90,000,000 EXN</strong>, distributed across <strong>12,960 blocks</strong>. Each block yields a fixed base reward of approximately <strong>6,944 EXN</strong>, which is shared among all active miners.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="data-card p-6 space-y-4">
            <h4 className="text-lg font-bold uppercase tracking-tight text-white/90">Proportional Distribution</h4>
            <p className="text-xs text-muted leading-relaxed">
              Rewards are not based on luck. When a block is mined, the EXN reward is distributed proportionally based on your active <strong>Hashpower (TH/s)</strong> relative to the total network hashpower. The more hashpower you contribute, the larger your share of the block reward.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="data-card p-6 space-y-4">
            <h4 className="text-lg font-bold uppercase tracking-tight text-white/90">Referral Hashpower</h4>
            <p className="text-xs text-muted leading-relaxed">
              To protect the fixed supply of EXN, our referral system does not mint extra tokens. Instead, referring active miners grants you a permanent <strong>0.004 TH/s hashpower boost</strong>, increasing your share of all future block rewards.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Genesis Phase Section */}
      <section className="space-y-8">
        <motion.div variants={itemVariants} className="flex items-center gap-4">
          <div className="h-px flex-1 bg-white/5"></div>
          <h3 className="text-xl font-bold uppercase tracking-widest text-primary">The Genesis Phase</h3>
          <div className="h-px flex-1 bg-white/5"></div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div variants={itemVariants} className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-2xl font-bold leading-tight">The Foundation of the Exnus Ecosystem</h4>
              <p className="text-sm text-muted leading-relaxed">
                The Genesis Phase is the initial distribution period where early adopters can secure their position in the network. This phase is expected to conclude approximately 6 months from now (October 2026), marking the transition to the mainnet.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div>
                  <h5 className="font-bold uppercase text-xs tracking-wider text-primary">Timeline</h5>
                  <p className="text-xs text-muted">Estimated completion: October 2026. This phase distributes the initial supply to the most dedicated contributors.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div>
                  <h5 className="font-bold uppercase text-xs tracking-wider text-primary">Mining Licenses</h5>
                  <p className="text-xs text-muted">Your participation in the Genesis Phase yields unique Reward Hash IDs. These IDs are the key to long-term mining rights.</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="data-card p-8 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
            <h4 className="text-xl font-bold mb-6">
              License Conversion Protocol
            </h4>
            
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-black/40 border border-white/5 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted font-bold">Requirement</p>
                <p className="text-2xl font-mono font-bold text-white">30 Unique Hash IDs</p>
                <p className="text-xs text-muted italic">Per Mining License</p>
              </div>

              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-muted">
                  Every block you mine generates a unique <span className="text-white font-bold">Reward Hash ID</span>. These IDs are cryptographically unique proofs of contribution.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-[11px] text-muted">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 flex-shrink-0"></div>
                    Collect 30 unique Hash IDs from your mining history.
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-muted">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 flex-shrink-0"></div>
                    Convert these IDs into a permanent Mining License at TGE.
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-muted">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 flex-shrink-0"></div>
                    Licenses grant priority access to the 15-year main mining system.
                  </li>
                </ul>
              </div>

              <div className="pt-4">
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  ></motion.div>
                </div>
                <p className="text-[9px] text-center mt-2 text-muted uppercase tracking-widest font-bold">
                  Genesis Progress: {progress.toFixed(2)}% Complete
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* TGE Details */}
      <motion.section variants={itemVariants} className="data-card p-8 border-line">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h3 className="text-2xl font-bold uppercase tracking-tight">The Token Generation Event (TGE)</h3>
          <p className="text-sm text-muted leading-relaxed">
            TGE marks the evolution of Exnus from a Genesis Phase to a fully operational global mining network. This is the pivotal moment for all contributors.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            <div className="space-y-2">
              <h4 className="text-primary font-bold uppercase text-xs tracking-widest">Immediate Liquidity</h4>
              <p className="text-[11px] text-muted">Withdraw 100% of your mined EXN tokens immediately. No lockups, no vesting schedules, no delays.</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-primary font-bold uppercase text-xs tracking-widest">Mainnet Launch</h4>
              <p className="text-[11px] text-muted">The 15-year main mining protocol activates, utilizing the licenses earned during Genesis.</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* CTA */}
      <motion.div variants={itemVariants} className="flex flex-col items-center justify-center space-y-6 pt-8">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-bold uppercase tracking-widest">Ready to contribute?</h3>
          <p className="text-xs text-muted">Start your mining engine and secure your Genesis rewards today.</p>
        </div>
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="px-8 py-3 bg-primary text-black font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-accent transition-all shadow-lg shadow-primary/20"
        >
          Return to Dashboard
        </button>
      </motion.div>
    </motion.div>
  );
}

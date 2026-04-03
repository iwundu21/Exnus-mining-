import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useWallet } from '@solana/wallet-adapter-react';

interface Task {
  id: string;
  title: string;
  description: string;
  reward: number;
  link: string;
  icon: React.ReactNode;
}

const TASKS: Task[] = [
  {
    id: 'twitter_follow',
    title: 'Follow on Twitter',
    description: 'Follow our official Twitter account for the latest updates.',
    reward: 50,
    link: 'https://twitter.com',
    icon: null
  },
  {
    id: 'telegram_join',
    title: 'Join Telegram Group',
    description: 'Join our community on Telegram to discuss with other miners.',
    reward: 50,
    link: 'https://telegram.org',
    icon: null
  },
  {
    id: 'discord_join',
    title: 'Join Discord Server',
    description: 'Get support and chat with the team on Discord.',
    reward: 100,
    link: 'https://discord.com',
    icon: null
  }
];

export default function Tasks() {
  const { publicKey } = useWallet();
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);

  const handleTaskClick = (task: Task) => {
    if (completedTasks.includes(task.id) || claiming === task.id) return;
    
    // Open link
    window.open(task.link, '_blank');
    
    // Simulate claiming process
    setClaiming(task.id);
    setTimeout(() => {
      setCompletedTasks(prev => [...prev, task.id]);
      setClaiming(null);
    }, 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight uppercase flex items-center gap-4">
          Tasks & Rewards
        </h2>
        <p className="text-muted text-sm md:text-base max-w-2xl mt-2">
          Complete community tasks to earn bonus EXN rewards and boost your mining journey.
        </p>
      </header>

      {!publicKey ? (
        <div className="data-card p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-primary text-2xl font-bold">!</span>
          </div>
          <h3 className="text-xl font-bold">Connect Wallet to View Tasks</h3>
          <p className="text-muted text-sm max-w-md mx-auto">
            You need to connect your Solana wallet to participate in tasks and claim rewards.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {TASKS.map((task, index) => {
            const isCompleted = completedTasks.includes(task.id);
            const isClaiming = claiming === task.id;
            
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`data-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all ${
                  isCompleted ? 'opacity-70 bg-white/5 border-white/5' : 'hover:border-primary/30'
                }`}
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className={`mt-1 shrink-0 font-bold ${isCompleted ? 'text-green-500' : 'text-muted'}`}>
                    {isCompleted ? "[✓]" : "[ ]"}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      {task.title}
                      {isCompleted && <span className="text-[10px] bg-green-500/20 text-green-500 px-2 py-0.5 rounded uppercase tracking-widest">Completed</span>}
                    </h3>
                    <p className="text-sm text-muted mt-1">{task.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-6 shrink-0 border-t border-white/10 md:border-t-0 pt-4 md:pt-0 mt-2 md:mt-0">
                  <div className="text-left md:text-right">
                    <p className="text-[10px] uppercase tracking-widest text-muted font-bold">Reward</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-display font-bold text-primary">+{task.reward}</span>
                      <img 
                        src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                        alt="EXN" 
                        className="w-4 h-4 rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleTaskClick(task)}
                    disabled={isCompleted || isClaiming}
                    className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${
                      isCompleted 
                        ? 'bg-white/5 text-muted cursor-not-allowed' 
                        : 'bg-primary text-white hover:bg-accent'
                    }`}
                  >
                    {isClaiming ? (
                      <>
                        Verifying...
                      </>
                    ) : isCompleted ? (
                      'Claimed'
                    ) : (
                      <>
                        Go
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

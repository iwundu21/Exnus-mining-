import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';

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
    title: 'Follow on X',
    description: 'Follow @exnusprotocol on X for the latest updates and announcements.',
    reward: 50,
    link: 'https://x.com/exnusprotocol',
    icon: <img src="https://img.icons8.com/ios-filled/50/ffffff/twitterx--v1.png" className="w-5 h-5" alt="X" referrerPolicy="no-referrer" />
  },
  {
    id: 'telegram_join',
    title: 'Join Telegram Channel',
    description: 'Join our official Telegram announcement channel for real-time updates.',
    reward: 50,
    link: 'https://t.me/Exnusprotocol',
    icon: <img src="https://img.icons8.com/ios-filled/50/ffffff/telegram-app.png" className="w-5 h-5" alt="Telegram" referrerPolicy="no-referrer" />
  },
  {
    id: 'discord_join',
    title: 'Join Discord Server',
    description: 'Get support and chat with the team on Discord.',
    reward: 100,
    link: 'https://ais-dev-72b5wlqzgb2mcjbso2ducs-682135868049.europe-west2.run.app/',
    icon: <img src="https://img.icons8.com/ios-filled/50/ffffff/discord-logo.png" className="w-5 h-5" alt="Discord" referrerPolicy="no-referrer" />
  },
  {
    id: 'linkedin_follow',
    title: 'Follow on LinkedIn',
    description: 'Follow Exnus Protocol on LinkedIn to stay connected with our professional network.',
    reward: 50,
    link: 'https://www.linkedin.com/in/exnus-protocol-248a85277?utm_source=share_via&utm_content=profile&utm_medium=member_android',
    icon: <img src="https://img.icons8.com/ios-filled/50/ffffff/linkedin.png" className="w-5 h-5" alt="LinkedIn" referrerPolicy="no-referrer" />
  },
  {
    id: 'telegram_group_join',
    title: 'Join Telegram Community',
    description: 'Join our Telegram community group to chat with other miners and the team.',
    reward: 50,
    link: 'https://t.me/exnusprotocolchat',
    icon: <img src="https://img.icons8.com/ios-filled/50/ffffff/telegram-app.png" className="w-5 h-5" alt="Telegram" referrerPolicy="no-referrer" />
  }
];

export default function Tasks() {
  const { publicKey } = useWallet();
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [readyToClaim, setReadyToClaim] = useState<string[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [processingGo, setProcessingGo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (publicKey) {
      fetchUserData();
    } else {
      setLoading(false);
    }
  }, [publicKey]);

  const fetchUserData = async () => {
    try {
      const res = await axios.get(`/api/user/${publicKey?.toBase58()}`);
      if (res.data && res.data.completedTasks) {
        setCompletedTasks(res.data.completedTasks);
      }
    } catch (err) {
      console.error("Error fetching user tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskClick = (task: Task) => {
    if (completedTasks.includes(task.id) || claiming === task.id || readyToClaim.includes(task.id) || processingGo === task.id) return;
    
    // Open link
    window.open(task.link, '_blank');
    
    // Set as processing for 5 seconds
    setProcessingGo(task.id);
    
    setTimeout(() => {
      setReadyToClaim(prev => [...prev, task.id]);
      setProcessingGo(null);
    }, 5000);
  };

  const handleClaimClick = async (task: Task) => {
    if (claiming || !publicKey) return;

    setClaiming(task.id);
    
    // Process for 7 seconds as requested
    setTimeout(async () => {
      try {
        const res = await axios.post('/api/tasks/complete', {
          wallet: publicKey.toBase58(),
          taskId: task.id,
          reward: task.reward
        });

        if (res.data.success) {
          setCompletedTasks(prev => [...prev, task.id]);
          setReadyToClaim(prev => prev.filter(id => id !== task.id));
        }
      } catch (err) {
        console.error("Error claiming task reward:", err);
      } finally {
        setClaiming(null);
      }
    }, 7000);
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
      ) : loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid gap-4">
          {TASKS.map((task, index) => {
            const isCompleted = completedTasks.includes(task.id);
            const isReady = readyToClaim.includes(task.id);
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
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                    {task.icon}
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
                  
                  {isCompleted ? (
                    <div className="px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest bg-white/5 text-muted cursor-not-allowed">
                      Claimed
                    </div>
                  ) : isReady || isClaiming ? (
                    <button
                      onClick={() => handleClaimClick(task)}
                      disabled={isClaiming}
                      className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${
                        isClaiming 
                          ? 'bg-white/10 text-muted cursor-not-allowed' 
                          : 'bg-green-500 text-black hover:bg-green-400'
                      }`}
                    >
                      {isClaiming ? 'Verifying...' : 'Claim'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTaskClick(task)}
                      disabled={processingGo === task.id}
                      className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                        processingGo === task.id
                          ? 'bg-white/10 text-muted cursor-not-allowed'
                          : 'bg-primary text-white hover:bg-accent'
                      }`}
                    >
                      {processingGo === task.id ? 'Processing...' : 'Go'}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import React, { useMemo, useState, Component, ErrorInfo, ReactNode, useEffect } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { LayoutDashboard, Wallet, History, Cpu, Shield, Trophy, Users } from 'lucide-react';
import { cn } from './lib/utils';

// Pages
import Dashboard from './components/Dashboard';
import MyAssets from './components/MyAssets';
import MiningHistory from './components/MiningHistory';
import AdminDashboard from './components/AdminDashboard';
import Leaderboard from './components/Leaderboard';
import Referral from './components/Referral';
import DynamicBackground from './components/DynamicBackground';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';

type Page = 'dashboard' | 'assets' | 'history' | 'admin' | 'leaderboard' | 'referral';

class ErrorBoundary extends React.Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-white bg-red-900 min-h-screen">
          <h1 className="text-2xl font-bold mb-4">Something went wrong.</h1>
          <pre className="text-xs bg-black/50 p-4 overflow-auto max-h-96">
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-white text-black rounded"
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ADMIN_WALLET = "9Kqt28pfMVBsBvXYYnYQCT2BZyorAwzbR6dUmgQfsZYW";

function MainContent() {
  const { publicKey } = useWallet();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const isAdmin = publicKey?.toString() === ADMIN_WALLET;

  // Capture referral code from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref) {
      sessionStorage.setItem('exnus_ref', ref);
      // Clean up URL without refreshing
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Security check: if user is on admin page but not admin, kick them to dashboard
  useEffect(() => {
    if (currentPage === 'admin' && !isAdmin) {
      setCurrentPage('dashboard');
    }
  }, [currentPage, isAdmin]);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'assets': return <MyAssets />;
      case 'history': return <MiningHistory />;
      case 'admin': return isAdmin ? <AdminDashboard /> : <Dashboard />;
      case 'leaderboard': return <Leaderboard />;
      case 'referral': return <Referral />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="app-container">
      <DynamicBackground />
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="p-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-primary/20">
              <img 
                src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
                alt="EXN Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none">EXNUS</h1>
              <p className="text-[10px] text-muted uppercase tracking-widest">Mining Engine</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 py-6">
          <button 
            onClick={() => setCurrentPage('dashboard')}
            className={cn("nav-item", currentPage === 'dashboard' && "active")}
          >
            <LayoutDashboard />
            <span>Dashboard</span>
          </button>
          <button 
            onClick={() => setCurrentPage('leaderboard')}
            className={cn("nav-item", currentPage === 'leaderboard' && "active")}
          >
            <Trophy />
            <span>Leaderboard</span>
          </button>
          <button 
            onClick={() => setCurrentPage('referral')}
            className={cn("nav-item", currentPage === 'referral' && "active")}
          >
            <Users />
            <span>Referral</span>
          </button>
          <button 
            onClick={() => setCurrentPage('assets')}
            className={cn("nav-item", currentPage === 'assets' && "active")}
          >
            <Wallet />
            <span>My Assets</span>
          </button>
          <button 
            onClick={() => setCurrentPage('history')}
            className={cn("nav-item", currentPage === 'history' && "active")}
          >
            <History />
            <span>History</span>
          </button>
        </nav>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <WalletMultiButton className="!bg-primary !w-full !rounded-lg !h-10 !text-sm !font-medium" />
          </div>
          <div className="pt-4 border-t border-white/5 space-y-4">
            <p className="text-[8px] text-muted uppercase tracking-widest leading-relaxed text-center">
              Exnus uses read-only connection. We never access your private keys or funds.
            </p>
            {isAdmin && (
              <button 
                onClick={() => setCurrentPage('admin')}
                className={cn(
                  "w-full flex items-center justify-center gap-2 text-[10px] text-muted hover:text-primary transition-colors uppercase tracking-widest font-bold",
                  currentPage === 'admin' && "text-primary"
                )}
              >
                <Shield size={10} />
                Admin Dashboard
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden p-4 flex justify-between items-center bg-background border-b border-line sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded overflow-hidden flex items-center justify-center bg-primary/20">
            <img 
              src="https://coffee-abundant-skunk-245.mypinata.cloud/ipfs/bafybeid2os6ocficy2ijgrhbxv4triyfnmrls36grwp6sznsf2r7u7e2km" 
              alt="EXN Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-sm font-bold tracking-tight">EXNUS</h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <WalletMultiButton className="!bg-primary !rounded-lg !h-8 !px-3 !text-[10px] !min-w-0" />
          <span className="text-[8px] text-muted uppercase tracking-tighter">Secure Link</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="content-area">
        <div className="flex-1 p-4 md:p-8 lg:p-12 max-w-7xl mx-auto w-full flex flex-col min-h-full">
          <div className="flex-1">
            {renderPage()}
          </div>
          
          <footer className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-muted uppercase tracking-widest font-bold">
            <p>© 2026 EXNUS MINING ENGINE. ALL RIGHTS RESERVED.</p>
            <div className="flex items-center gap-6">
              <button onClick={() => setCurrentPage('dashboard')} className="hover:text-primary transition-colors">Dashboard</button>
              <button onClick={() => setCurrentPage('leaderboard')} className="hover:text-primary transition-colors">Leaderboard</button>
              <button onClick={() => setCurrentPage('referral')} className="hover:text-primary transition-colors">Referral</button>
              <button onClick={() => setCurrentPage('assets')} className="hover:text-primary transition-colors">Assets</button>
              <button onClick={() => setCurrentPage('history')} className="hover:text-primary transition-colors">History</button>
              {isAdmin && (
                <button onClick={() => setCurrentPage('admin')} className={cn("hover:text-primary transition-colors flex items-center gap-1.5", currentPage === 'admin' && "text-primary")}>
                  <Shield size={10} />
                  Admin
                </button>
              )}
            </div>
          </footer>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-nav">
        <button 
          onClick={() => setCurrentPage('dashboard')}
          className={cn("nav-item", currentPage === 'dashboard' && "active")}
        >
          <LayoutDashboard />
          <span>Dashboard</span>
        </button>
        <button 
          onClick={() => setCurrentPage('leaderboard')}
          className={cn("nav-item", currentPage === 'leaderboard' && "active")}
        >
          <Trophy />
          <span>Rank</span>
        </button>
        <button 
          onClick={() => setCurrentPage('referral')}
          className={cn("nav-item", currentPage === 'referral' && "active")}
        >
          <Users />
          <span>Refer</span>
        </button>
        <button 
          onClick={() => setCurrentPage('assets')}
          className={cn("nav-item", currentPage === 'assets' && "active")}
        >
          <Wallet />
          <span>Assets</span>
        </button>
        <button 
          onClick={() => setCurrentPage('history')}
          className={cn("nav-item", currentPage === 'history' && "active")}
        >
          <History />
          <span>History</span>
        </button>
        {isAdmin && (
          <button 
            onClick={() => setCurrentPage('admin')}
            className={cn("nav-item", currentPage === 'admin' && "active")}
          >
            <Shield />
            <span>Admin</span>
          </button>
        )}
      </nav>
    </div>
  );
}

export default function App() {
  const endpoint = useMemo(() => "https://api.mainnet-beta.solana.com", []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ErrorBoundary>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <MainContent />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ErrorBoundary>
  );
}


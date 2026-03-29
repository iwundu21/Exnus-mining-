import React, { useMemo, useState, Component, ErrorInfo, ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { LayoutDashboard, Wallet, History, Cpu } from 'lucide-react';
import { cn } from './lib/utils';

// Pages
import Dashboard from './components/Dashboard';
import MyAssets from './components/MyAssets';
import MiningHistory from './components/MiningHistory';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';

type Page = 'dashboard' | 'assets' | 'history';

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

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  console.log('Exnus Mining: App rendering...');

  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
  const network = WalletAdapterNetwork.Mainnet;

  // You can also provide a custom RPC endpoint.
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'assets': return <MyAssets />;
      case 'history': return <MiningHistory />;
      default: return <Dashboard />;
    }
  };

  return (
    <ErrorBoundary>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <div className="app-container">
              {/* Desktop Sidebar */}
              <aside className="sidebar">
                <div className="p-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                      <Cpu className="text-white" size={18} />
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
                    <div className="flex items-center justify-center gap-1.5 text-[9px] text-muted uppercase tracking-widest">
                      <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
                      <span>Secure Read-Only Access</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/5">
                    <p className="text-[8px] text-muted uppercase tracking-widest leading-relaxed text-center">
                      Exnus uses read-only connection. We never access your private keys or funds.
                    </p>
                  </div>
                </div>
              </aside>

              {/* Mobile Header */}
              <header className="md:hidden p-4 flex justify-between items-center bg-surface/50 backdrop-blur-md sticky top-0 z-40">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                    <Cpu className="text-white" size={14} />
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
                <div className="flex-1 p-4 md:p-8 lg:p-12 max-w-7xl mx-auto w-full">
                  {renderPage()}
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
              </nav>
            </div>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ErrorBoundary>
  );
}


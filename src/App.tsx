import React, { useMemo, useState, Component, ErrorInfo, ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { LayoutDashboard, Wallet, History } from 'lucide-react';
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
            <div className="device-container">
              {/* Page Content */}
              <main className="flex-1 flex flex-col">
                {renderPage()}
              </main>

              {/* Footer Navigation */}
              <nav className="footer-nav">
                <button 
                  onClick={() => setCurrentPage('dashboard')}
                  className={cn("nav-item", currentPage === 'dashboard' && "active")}
                >
                  <LayoutDashboard size={20} />
                  <span>Dashboard</span>
                </button>
                <button 
                  onClick={() => setCurrentPage('assets')}
                  className={cn("nav-item", currentPage === 'assets' && "active")}
                >
                  <Wallet size={20} />
                  <span>My Assets</span>
                </button>
                <button 
                  onClick={() => setCurrentPage('history')}
                  className={cn("nav-item", currentPage === 'history' && "active")}
                >
                  <History size={20} />
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


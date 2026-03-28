import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log('Exnus Mining: App starting...');

try {
  createRoot(document.getElementById('root')!).render(
    <App />
  );
} catch (error) {
  console.error('Exnus Mining: Failed to render app', error);
  document.getElementById('root')!.innerHTML = `
    <div style="padding: 20px; color: white; background: #4B0F1A; font-family: sans-serif;">
      <h1>Failed to start Exnus Mining</h1>
      <pre style="font-size: 10px; opacity: 0.7;">${error instanceof Error ? error.stack : String(error)}</pre>
    </div>
  `;
}

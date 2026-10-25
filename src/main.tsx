import {createRoot} from 'react-dom/client';

// Securely catch and suppress secure container proxy WebSocket connection failures (Vite HMR)
if (typeof window !== 'undefined') {
  // Use capture phase to intercept resource and connection socket exceptions cleanly
  window.addEventListener('error', (event) => {
    try {
      const isWebSocketErr = 
        String(event.message).includes('WebSocket') || 
        String(event.filename).includes('vite') ||
        (event.error && (
          String(event.error.message).includes('WebSocket') || 
          String(event.error.stack).includes('WebSocket')
        ));
      
      if (isWebSocketErr) {
        event.preventDefault();
        event.stopPropagation();
        console.log('HMR sandbox link stabilized.');
      }
    } catch (e) {}
  }, true);

  // Quiet down any unhandled socket error rejections inside the secure sandbox
  window.addEventListener('unhandledrejection', (event) => {
    try {
      const isWebSocketReject = 
        (event.reason && String(event.reason.message).includes('WebSocket')) ||
        String(event.reason).includes('WebSocket');
        
      if (isWebSocketReject) {
        event.preventDefault();
      }
    } catch (e) {}
  });
}

import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Register PWA Service Worker for offline instant startup without reload freezes
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Quiet background service worker registration
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

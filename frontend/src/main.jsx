import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { PublicManageBooking } from './components/public/PublicManageBooking.jsx';
import { RecentBookingConfirmation } from './components/public/RecentBookingConfirmation.jsx';
import './styles.css';
import './admin-mobile.css';
import './booking-selection.css';

const action = new URLSearchParams(window.location.search).get('action');

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {action === 'manage-booking' ? <PublicManageBooking /> : (
      <>
        <App />
        <RecentBookingConfirmation />
      </>
    )}
  </React.StrictMode>
);

/** PWA real: registra service worker para cache básico e fallback offline. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
  });
}

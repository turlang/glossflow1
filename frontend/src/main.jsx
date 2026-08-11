import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { PublicManageBooking } from './components/public/PublicManageBooking.jsx';
import { RecentBookingConfirmation } from './components/public/RecentBookingConfirmation.jsx';
import './styles.css';
import './public-showcase.css';
import './ui-primitives.css';
import './admin-shell.css';
import './admin-operations.css';
import './responsive.css';
import './agenda-enterprise.css';
import './admin-business.css';
import './admin-platform.css';
import './admin-mobile.css';
import './booking-selection.css';
import './public-booking.css';

/**
 * Bootstrap do frontend GlossFlow.
 *
 * A página pública de gerenciamento de agendamento é isolada do App principal
 * porque funciona com token próprio do cliente e não depende da sessão admin.
 */
const action = new URLSearchParams(window.location.search).get('action');

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {action === 'manage-booking' ? (
      <PublicManageBooking />
    ) : (
      <>
        <App />
        <RecentBookingConfirmation />
      </>
    )}
  </React.StrictMode>
);

/**
 * PWA: o registro é deliberadamente não bloqueante. Falha do service worker
 * não pode impedir a aplicação online de iniciar.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
  });
}

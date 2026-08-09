import React, { useEffect, useState } from 'react';
import { request } from './services/api';
import { Header, PublicShowcase, BookingPage, LoginPage } from './components/public/PublicExperience.jsx';
import { SkeletonPage, StateMessage } from './components/ui/Feedback.jsx';
import { AdminDashboard } from './components/admin/AdminDashboard.jsx';
import { PlatformAdmin } from './components/admin/PlatformAdmin.jsx';
import { SiteSettings } from './components/admin/SiteSettings.jsx';
import { WhatsAppAgentTester } from './components/admin/WhatsAppAgentTester.jsx';
import { CommercialLanding } from './components/commercial/CommercialLanding.jsx';

function tokenRole(token) {
  if (!token) return '';
  try {
    const payload = token.split('.')[1];
    if (!payload) return '';
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded))?.role || '';
  } catch {
    return '';
  }
}

/**
 * GlossFlow Frontend
 *
 * Existem dois backoffices independentes:
 * - SUPER_ADMIN: visão global do SaaS, clientes, planos e MRR.
 * - ADMIN/RECEPTION/PROFESSIONAL: operação isolada do salão via salonId.
 */
export default function App() {
  const [page, setPage] = useState('public');
  const [theme, setTheme] = useState(() => localStorage.getItem('glossflow.theme') || 'dark');
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('glossflow.token') || '');
  const [salon, setSalon] = useState(null);
  const [adminSalon, setAdminSalon] = useState(null);
  const [services, setServices] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [financialEntries, setFinancialEntries] = useState([]);
  const [commissions, setCommissions] = useState({ rules: [], projections: [] });
  const [loyalty, setLoyalty] = useState({ program: null, entries: [] });
  const [subscription, setSubscription] = useState({ plans: [], subscription: null });
  const [whatsappTemplates, setWhatsappTemplates] = useState([]);
  const [insights, setInsights] = useState({ saved: [], suggestions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAuthenticated = Boolean(authToken);
  const authRole = tokenRole(authToken);
  const isSuperAdmin = authRole === 'SUPER_ADMIN';
  const backofficeSalon = adminSalon || salon;
  const backofficePages = ['admin', 'login', 'site-settings', 'agent-test'];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'booking') setPage('booking');
    if (action === 'admin') setPage(authToken ? (tokenRole(authToken) === 'SUPER_ADMIN' ? 'platform-admin' : 'admin') : 'login');
    if (action === 'platform-admin') setPage(authToken && tokenRole(authToken) === 'SUPER_ADMIN' ? 'platform-admin' : 'login');
    if (action === 'site-settings') setPage(authToken && tokenRole(authToken) !== 'SUPER_ADMIN' ? 'site-settings' : 'login');
    if (action === 'agent-test') setPage(authToken && tokenRole(authToken) !== 'SUPER_ADMIN' ? 'agent-test' : 'login');
    if (action === 'commercial') setPage('commercial');
    localStorage.setItem('glossflow.pwa.query-action', action || 'public');
  }, []);

  useEffect(() => {
    if (!authToken) return;
    if (isSuperAdmin && ['admin', 'site-settings', 'agent-test'].includes(page)) setPage('platform-admin');
    if (!isSuperAdmin && page === 'platform-admin') setPage('admin');
  }, [authToken, authRole, page]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('glossflow.theme', theme);
  }, [theme]);

  useEffect(() => {
    if (page === 'platform-admin') {
      document.title = 'GlossFlow • Super Admin';
      return;
    }
    const currentSalon = backofficePages.includes(page) ? backofficeSalon : salon;
    if (!currentSalon) return;
    document.title = backofficePages.includes(page)
      ? `GlossFlow • ${currentSalon.name}`
      : currentSalon.name;
  }, [salon, adminSalon, page]);

  function toggleTheme() {
    setTheme((current) => current === 'dark' ? 'light' : 'dark');
  }

  function clearTenantAdminData() {
    setAdminSalon(null);
    setAppointments([]);
    setInventory([]);
    setUsers([]);
    setClients([]);
    setFinancialEntries([]);
    setCommissions({ rules: [], projections: [] });
    setLoyalty({ program: null, entries: [] });
    setSubscription({ plans: [], subscription: null });
    setWhatsappTemplates([]);
    setInsights({ saved: [], suggestions: [] });
  }

  async function loadPublicData() {
    setLoading(true);
    setError('');

    try {
      const [salonData, servicesData, professionalsData, portfolioData] = await Promise.all([
        request('/public/salon'),
        request('/services'),
        request('/professionals'),
        request('/portfolio')
      ]);

      setSalon(salonData);
      setServices(servicesData);
      setProfessionals(professionalsData);
      setPortfolio(portfolioData);

      if (!authToken || isSuperAdmin) {
        clearTenantAdminData();
      }

      /** SUPER_ADMIN nunca carrega dados operacionais de um salão. */
      if (authToken && isSuperAdmin) return;

      if (authToken) {
        try {
          /**
           * Primeiro valida a sessão e o tenant. Só depois carrega os módulos.
           * Isso evita uma cascata de 401/404/500 quando existe token antigo,
           * sessão expirada ou backend ainda não atualizado.
           */
          const adminSalonData = await request('/admin/salon-info');
          setAdminSalon(adminSalonData);

          const [appointmentsData, inventoryData, usersData, clientsData, financialData, commissionsData, loyaltyData, subscriptionData, templatesData, insightsData] = await Promise.all([
            request('/admin/appointments'),
            request('/admin/inventory'),
            request('/admin/users'),
            request('/admin/clients'),
            request('/admin/financial'),
            request('/admin/commissions'),
            request('/admin/loyalty'),
            request('/admin/subscription'),
            request('/admin/whatsapp/templates'),
            request('/admin/insights')
          ]);

          setAppointments(appointmentsData);
          setInventory(inventoryData);
          setUsers(usersData);
          setClients(clientsData);
          setFinancialEntries(financialData);
          setCommissions(commissionsData);
          setLoyalty(loyaltyData);
          setSubscription(subscriptionData);
          setWhatsappTemplates(templatesData);
          setInsights(insightsData);
        } catch (adminError) {
          console.warn('Sessão administrativa indisponível:', adminError.message);
          localStorage.removeItem('glossflow.token');
          localStorage.removeItem('glossflow.refreshToken');
          setAuthToken('');
          clearTenantAdminData();
          setPage('login');
        }
      }
    } catch (err) {
      setError(err.message || 'Não foi possível conectar à API.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPublicData();
  }, [authToken, authRole]);

  return (
    <div className="app-shell">
      {page !== 'platform-admin' && (
        <Header page={page} setPage={setPage} isAuthenticated={isAuthenticated} theme={theme} toggleTheme={toggleTheme} salon={page === 'public' || page === 'booking' ? salon : backofficeSalon} />
      )}

      {loading && <SkeletonPage />}
      {!loading && error && <StateMessage title="Não foi possível conectar à API." text={error} danger />}

      {!loading && !error && page === 'public' && (
        <PublicShowcase salon={salon} services={services} professionals={professionals} portfolio={portfolio} setPage={setPage} />
      )}

      {!loading && !error && page === 'commercial' && <CommercialLanding />}

      {!loading && !error && page === 'booking' && (
        <BookingPage services={services} professionals={professionals} onCreated={loadPublicData} salon={salon} />
      )}

      {!loading && !error && page === 'login' && (
        <LoginPage setPage={setPage} onLogin={setAuthToken} />
      )}

      {!loading && !error && page === 'platform-admin' && (
        isAuthenticated && isSuperAdmin
          ? <PlatformAdmin setPage={setPage} />
          : <LoginPage setPage={setPage} onLogin={setAuthToken} />
      )}

      {!loading && !error && page === 'site-settings' && (
        isAuthenticated && !isSuperAdmin
          ? <SiteSettings salon={backofficeSalon} reload={loadPublicData} setPage={setPage} />
          : <LoginPage setPage={setPage} onLogin={setAuthToken} />
      )}

      {!loading && !error && page === 'agent-test' && (
        isAuthenticated && !isSuperAdmin
          ? <WhatsAppAgentTester setPage={setPage} />
          : <LoginPage setPage={setPage} onLogin={setAuthToken} />
      )}

      {!loading && !error && page === 'admin' && (
        isAuthenticated && !isSuperAdmin
          ? <AdminDashboard
              salon={backofficeSalon}
              services={services}
              professionals={professionals}
              portfolio={portfolio}
              appointments={appointments}
              inventory={inventory}
              users={users}
              clients={clients}
              financialEntries={financialEntries}
              commissions={commissions}
              loyalty={loyalty}
              subscription={subscription}
              whatsappTemplates={whatsappTemplates}
              insights={insights}
              reload={loadPublicData}
              setPage={setPage}
              theme={theme}
              toggleTheme={toggleTheme}
            />
          : <LoginPage setPage={setPage} onLogin={setAuthToken} />
      )}
    </div>
  );
}

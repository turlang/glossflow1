import React, { useEffect, useState } from 'react';
import { request } from './services/api';
import { Header, PublicShowcase, BookingPage, LoginPage } from './components/public/PublicExperience.jsx';
import { SkeletonPage, StateMessage } from './components/ui/Feedback.jsx';
import { AdminDashboard } from './components/admin/AdminDashboard.jsx';
import { SiteSettings } from './components/admin/SiteSettings.jsx';
import { WhatsAppAgentTester } from './components/admin/WhatsAppAgentTester.jsx';
import { CommercialLanding } from './components/commercial/CommercialLanding.jsx';

/**
 * GlossFlow Frontend
 *
 * Uma única aplicação atende vários salões. O contexto público é resolvido em
 * runtime pelo hostname/domínio; o contexto administrativo vem exclusivamente
 * do salonId contido no JWT.
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
  const backofficeSalon = adminSalon || salon;
  const backofficePages = ['admin', 'login', 'site-settings', 'agent-test'];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'booking') setPage('booking');
    if (action === 'admin') setPage(authToken ? 'admin' : 'login');
    if (action === 'site-settings') setPage(authToken ? 'site-settings' : 'login');
    if (action === 'agent-test') setPage(authToken ? 'agent-test' : 'login');
    if (action === 'commercial') setPage('commercial');
    localStorage.setItem('glossflow.pwa.query-action', action || 'public');
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('glossflow.theme', theme);
  }, [theme]);

  useEffect(() => {
    const currentSalon = backofficePages.includes(page) ? backofficeSalon : salon;
    if (!currentSalon) return;
    document.title = backofficePages.includes(page)
      ? `GlossFlow • ${currentSalon.name}`
      : currentSalon.name;
  }, [salon, adminSalon, page]);

  function toggleTheme() {
    setTheme((current) => current === 'dark' ? 'light' : 'dark');
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

      if (!authToken) {
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

      if (authToken) {
        try {
          const [adminSalonData, appointmentsData, inventoryData, usersData, clientsData, financialData, commissionsData, loyaltyData, subscriptionData, templatesData, insightsData] = await Promise.all([
            request('/admin/salon-info'),
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
          setAdminSalon(adminSalonData);
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
          console.warn('Sessão administrativa inválida ou expirada:', adminError.message);
          localStorage.removeItem('glossflow.token');
          localStorage.removeItem('glossflow.refreshToken');
          setAuthToken('');
          setAdminSalon(null);
          setAppointments([]);
          setInventory([]);
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
  }, [authToken]);

  return (
    <div className="app-shell">
      <Header page={page} setPage={setPage} isAuthenticated={isAuthenticated} theme={theme} toggleTheme={toggleTheme} salon={page === 'public' || page === 'booking' ? salon : backofficeSalon} />

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

      {!loading && !error && page === 'site-settings' && (
        isAuthenticated
          ? <SiteSettings salon={backofficeSalon} reload={loadPublicData} setPage={setPage} />
          : <LoginPage setPage={setPage} onLogin={setAuthToken} />
      )}

      {!loading && !error && page === 'agent-test' && (
        isAuthenticated
          ? <WhatsAppAgentTester setPage={setPage} />
          : <LoginPage setPage={setPage} onLogin={setAuthToken} />
      )}

      {!loading && !error && page === 'admin' && (
        isAuthenticated
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

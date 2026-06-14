import React, { useEffect, useState } from 'react';
import { request } from './services/api';
import { Header, PublicShowcase, BookingPage, LoginPage } from './components/public/PublicExperience.jsx';
import { SkeletonPage, StateMessage } from './components/ui/Feedback.jsx';
import { AdminDashboard } from './components/admin/AdminDashboard.jsx';
import { CommercialLanding } from './components/commercial/CommercialLanding.jsx';

/**
 * GlossFlow Frontend
 *
 * Aplicação React em Vite organizada em três áreas principais:
 * 1. Vitrine pública do salão;
 * 2. Fluxo de agendamento do cliente;
 * 3. Painel administrativo com autenticação simples via JWT.
 */
export default function App() {
  const [page, setPage] = useState('public');
  const [theme, setTheme] = useState(() => localStorage.getItem('glossflow.theme') || 'dark');
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('glossflow.token') || '');
  const [salon, setSalon] = useState(null);
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

  /**
   * Atalhos do PWA.
   * Quando o usuário abre o app pelo ícone ou por um atalho do manifesto,
   * a query string decide se ele cai direto na vitrine, agendamento ou painel.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'booking') setPage('booking');
    if (action === 'admin') setPage(authToken ? 'admin' : 'login');
    localStorage.setItem('glossflow.pwa.query-action', action || 'public');
  }, []);

  /**
   * Preferência visual persistente.
   * O atributo data-theme permite alternar entre tema dark premium e light premium
   * sem duplicar componentes, seguindo boas práticas de design tokens.
   */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('glossflow.theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => current === 'dark' ? 'light' : 'dark');
  }

  async function loadPublicData() {
    setLoading(true);
    setError('');

    try {
      const [salonData, servicesData, professionalsData, portfolioData, appointmentsData, inventoryData] = await Promise.all([
        request('/public/salon'),
        request('/services'),
        request('/professionals'),
        request('/portfolio'),
        request('/appointments'),
        request('/inventory/summary')
      ]);

      setSalon(salonData);
      setServices(servicesData);
      setProfessionals(professionalsData);
      setPortfolio(portfolioData);
      setAppointments(appointmentsData);
      setInventory(inventoryData.products || []);

      /**
       * Carrega módulos administrativos apenas quando há sessão ativa.
       * Caso o token esteja ausente, expirado ou seja de uma versão antiga,
       * limpamos a sessão sem derrubar a vitrine pública.
       */
      if (authToken) {
        try {
          const [usersData, clientsData, financialData, commissionsData, loyaltyData, subscriptionData, templatesData, insightsData] = await Promise.all([
            request('/admin/users'),
            request('/admin/clients'),
            request('/admin/financial'),
            request('/admin/commissions'),
            request('/admin/loyalty'),
            request('/admin/subscription'),
            request('/admin/whatsapp/templates'),
            request('/admin/insights')
          ]);
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
          setAuthToken('');
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
      <Header page={page} setPage={setPage} isAuthenticated={isAuthenticated} theme={theme} toggleTheme={toggleTheme} />

      {loading && <SkeletonPage />}
      {!loading && error && <StateMessage title="Não foi possível conectar à API." text={error} danger />}

      {!loading && !error && page === 'public' && (
        <PublicShowcase
          salon={salon}
          services={services}
          professionals={professionals}
          portfolio={portfolio}
          setPage={setPage}
        />
      )}

      {!loading && !error && page === 'commercial' && <CommercialLanding />}

      {!loading && !error && page === 'booking' && (
        <BookingPage services={services} professionals={professionals} onCreated={loadPublicData} />
      )}

      {!loading && !error && page === 'login' && (
        <LoginPage setPage={setPage} onLogin={setAuthToken} />
      )}

      {!loading && !error && page === 'admin' && (
        isAuthenticated
          ? <AdminDashboard
              salon={salon}
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

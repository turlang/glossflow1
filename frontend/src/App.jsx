import React, { useEffect, useState } from 'react';
import { onAuthExpired, request } from './services/api';
import { Header, PublicShowcase, BookingPage, LoginPage } from './components/public/PublicExperience.jsx';
import { SkeletonPage, StateMessage } from './components/ui/Feedback.jsx';
import { AdminDashboard } from './components/admin/AdminDashboard.jsx';
import { PlatformAdmin } from './components/admin/PlatformAdmin.jsx';
import { WhatsAppAgentTester } from './components/admin/WhatsAppAgentTester.jsx';
import { ProfessionalCapabilitiesAdmin } from './components/admin/ProfessionalCapabilitiesAdmin.jsx';
import { ProfessionalScheduleAdmin } from './components/admin/ProfessionalScheduleAdmin.jsx';
import { OperationalAgendaBoard } from './components/admin/OperationalAgendaBoard.jsx';
import { SmartFitAdmin } from './components/admin/SmartFitAdmin.jsx';
import { ModuleVisibilityGuard } from './components/admin/ModuleVisibilityGuard.jsx';
import { CommercialLanding } from './components/commercial/CommercialLanding.jsx';
import { hasModule } from './utils/modules';

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
  const backofficePages = ['admin', 'login', 'agent-test', 'professional-services', 'professional-schedule', 'operational-agenda', 'smart-fit'];

  function clearTenantAdminData() {
    setAdminSalon(null); setAppointments([]); setInventory([]); setUsers([]); setClients([]); setFinancialEntries([]);
    setCommissions({ rules: [], projections: [] }); setLoyalty({ program: null, entries: [] });
    setSubscription({ plans: [], subscription: null }); setWhatsappTemplates([]); setInsights({ saved: [], suggestions: [] });
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'booking') setPage('booking');
    if (action === 'admin') setPage(authToken ? (tokenRole(authToken) === 'SUPER_ADMIN' ? 'platform-admin' : 'admin') : 'login');
    if (action === 'platform-admin') setPage(authToken && tokenRole(authToken) === 'SUPER_ADMIN' ? 'platform-admin' : 'login');
    if (action === 'site-settings') setPage(authToken && tokenRole(authToken) === 'SUPER_ADMIN' ? 'platform-admin' : 'admin');
    if (action === 'agent-test') setPage(authToken && tokenRole(authToken) !== 'SUPER_ADMIN' ? 'agent-test' : 'login');
    if (action === 'professional-services') setPage(authToken && tokenRole(authToken) !== 'SUPER_ADMIN' ? 'professional-services' : 'login');
    if (action === 'professional-schedule') setPage(authToken && tokenRole(authToken) !== 'SUPER_ADMIN' ? 'professional-schedule' : 'login');
    if (action === 'operational-agenda') setPage(authToken && tokenRole(authToken) !== 'SUPER_ADMIN' ? 'operational-agenda' : 'login');
    if (action === 'smart-fit') setPage(authToken && tokenRole(authToken) !== 'SUPER_ADMIN' ? 'smart-fit' : 'login');
    if (action === 'commercial') setPage('commercial');
    localStorage.setItem('glossflow.pwa.query-action', action || 'public');
  }, []);

  useEffect(() => onAuthExpired(() => {
    setAuthToken('');
    clearTenantAdminData();
    setError('');
    setLoading(false);
    setPage('login');
  }), []);

  useEffect(() => {
    if (!authToken) return;
    if (isSuperAdmin && ['admin', 'agent-test', 'professional-services', 'professional-schedule', 'operational-agenda', 'smart-fit'].includes(page)) setPage('platform-admin');
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
    document.title = backofficePages.includes(page) ? `GlossFlow • ${currentSalon.name}` : currentSalon.name;
  }, [salon, adminSalon, page]);

  function toggleTheme() { setTheme((current) => current === 'dark' ? 'light' : 'dark'); }

  async function loadPublicData() {
    setLoading(true); setError('');
    try {
      const [salonData, servicesData, professionalsData, portfolioData] = await Promise.all([
        request('/public/salon'), request('/services'), request('/professionals'), request('/portfolio')
      ]);
      setSalon(salonData); setServices(servicesData); setProfessionals(professionalsData); setPortfolio(portfolioData);

      if (!authToken || isSuperAdmin) clearTenantAdminData();
      if (authToken && isSuperAdmin) return;

      if (authToken) {
        try {
          const adminSalonData = await request('/admin/salon-info');
          setAdminSalon(adminSalonData);
          const agendaEnabled = hasModule(adminSalonData, 'AGENDA');
          const inventoryEnabled = hasModule(adminSalonData, 'ESTOQUE');
          const crmEnabled = hasModule(adminSalonData, 'CRM');
          const financialEnabled = hasModule(adminSalonData, 'FINANCEIRO');
          const loyaltyEnabled = hasModule(adminSalonData, 'FIDELIDADE');
          const whatsappEnabled = hasModule(adminSalonData, 'WHATSAPP');
          const aiEnabled = hasModule(adminSalonData, 'IA');

          const [appointmentsData, inventoryData, usersData, clientsData, financialData, commissionsData, loyaltyData, subscriptionData, templatesData, insightsData] = await Promise.all([
            agendaEnabled ? request('/admin/appointments') : Promise.resolve([]),
            inventoryEnabled ? request('/admin/inventory') : Promise.resolve([]),
            request('/admin/users'),
            crmEnabled ? request('/admin/clients') : Promise.resolve([]),
            financialEnabled ? request('/admin/financial') : Promise.resolve([]),
            financialEnabled ? request('/admin/commissions') : Promise.resolve({ rules: [], projections: [] }),
            loyaltyEnabled ? request('/admin/loyalty') : Promise.resolve({ program: null, entries: [] }),
            request('/admin/subscription'),
            whatsappEnabled ? request('/admin/whatsapp/templates') : Promise.resolve([]),
            aiEnabled ? request('/admin/insights') : Promise.resolve({ saved: [], suggestions: [] })
          ]);
          setAppointments(appointmentsData); setInventory(inventoryData); setUsers(usersData); setClients(clientsData);
          setFinancialEntries(financialData); setCommissions(commissionsData); setLoyalty(loyaltyData); setSubscription(subscriptionData);
          setWhatsappTemplates(templatesData); setInsights(insightsData);
        } catch (adminError) {
          console.warn('Sessão administrativa indisponível:', adminError.message);
          localStorage.removeItem('glossflow.token'); localStorage.removeItem('glossflow.refreshToken'); setAuthToken(''); clearTenantAdminData(); setPage('login');
        }
      }
    } catch (err) { setError(err.message || 'Não foi possível conectar à API.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadPublicData(); }, [authToken, authRole]);

  const canUseAgent = backofficeSalon ? hasModule(backofficeSalon, 'IA') && hasModule(backofficeSalon, 'WHATSAPP') : true;
  const canUseBooking = salon ? hasModule(salon, 'AGENDA') : true;

  return (
    <div className="app-shell">
      {isAuthenticated && !isSuperAdmin && backofficeSalon && <ModuleVisibilityGuard salon={backofficeSalon} />}
      {page !== 'platform-admin' && <Header page={page} setPage={setPage} isAuthenticated={isAuthenticated} theme={theme} toggleTheme={toggleTheme} salon={page === 'public' || page === 'booking' ? salon : backofficeSalon} />}

      {loading && <SkeletonPage />}
      {!loading && error && <StateMessage title="Não foi possível conectar à API." text={error} danger />}
      {!loading && !error && page === 'public' && <PublicShowcase salon={salon} services={services} professionals={professionals} portfolio={portfolio} setPage={setPage} />}
      {!loading && !error && page === 'commercial' && <CommercialLanding />}
      {!loading && !error && page === 'booking' && (canUseBooking ? <BookingPage services={services} professionals={professionals} onCreated={loadPublicData} salon={salon} /> : <StateMessage title="Agendamento online indisponível" text="Este salão não possui o módulo Agenda habilitado." danger />)}
      {!loading && !error && page === 'login' && <LoginPage setPage={setPage} onLogin={setAuthToken} />}
      {!loading && !error && page === 'platform-admin' && (isAuthenticated && isSuperAdmin ? <PlatformAdmin setPage={setPage} /> : <LoginPage setPage={setPage} onLogin={setAuthToken} />)}
      {!loading && !error && page === 'agent-test' && (isAuthenticated && !isSuperAdmin && canUseAgent ? <WhatsAppAgentTester setPage={setPage} /> : isAuthenticated && !isSuperAdmin ? <StateMessage title="Módulo não habilitado" text="O agente precisa dos módulos WhatsApp e Inteligência Artificial habilitados." danger /> : <LoginPage setPage={setPage} onLogin={setAuthToken} />)}
      {!loading && !error && page === 'professional-services' && (isAuthenticated && !isSuperAdmin ? <ProfessionalCapabilitiesAdmin salon={backofficeSalon} services={services} professionals={professionals} reload={loadPublicData} setPage={setPage} /> : <LoginPage setPage={setPage} onLogin={setAuthToken} />)}
      {!loading && !error && page === 'professional-schedule' && (isAuthenticated && !isSuperAdmin && canUseBooking ? <ProfessionalScheduleAdmin setPage={setPage} /> : isAuthenticated && !isSuperAdmin ? <StateMessage title="Módulo não habilitado" text="A jornada da equipe faz parte do módulo Agenda." danger /> : <LoginPage setPage={setPage} onLogin={setAuthToken} />)}
      {!loading && !error && page === 'operational-agenda' && (isAuthenticated && !isSuperAdmin && canUseBooking ? <OperationalAgendaBoard appointments={appointments} professionals={professionals} reload={loadPublicData} setPage={setPage} /> : isAuthenticated && !isSuperAdmin ? <StateMessage title="Módulo não habilitado" text="A agenda operacional faz parte do módulo Agenda." danger /> : <LoginPage setPage={setPage} onLogin={setAuthToken} />)}
      {!loading && !error && page === 'smart-fit' && (isAuthenticated && !isSuperAdmin && canUseBooking ? <SmartFitAdmin services={services} professionals={professionals} setPage={setPage} /> : isAuthenticated && !isSuperAdmin ? <StateMessage title="Módulo não habilitado" text="O encaixe inteligente faz parte do módulo Agenda." danger /> : <LoginPage setPage={setPage} onLogin={setAuthToken} />)}
      {!loading && !error && page === 'admin' && (isAuthenticated && !isSuperAdmin ? <AdminDashboard salon={backofficeSalon} services={services} professionals={professionals} portfolio={portfolio} appointments={appointments} inventory={inventory} users={users} clients={clients} financialEntries={financialEntries} commissions={commissions} loyalty={loyalty} subscription={subscription} whatsappTemplates={whatsappTemplates} insights={insights} reload={loadPublicData} setPage={setPage} theme={theme} toggleTheme={toggleTheme} /> : <LoginPage setPage={setPage} onLogin={setAuthToken} />)}
    </div>
  );
}

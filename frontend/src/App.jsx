import React, { Suspense, useEffect, useState } from 'react';
import { isAuthExpiredError, onAuthExpired, request } from './services/api.js';
import { emptyBackofficeData, loadTenantBackofficeData } from './services/backoffice-data.js';
import { Header, PublicShowcase, BookingPage, LoginPage } from './components/public/PublicExperience.jsx';
import { SkeletonPage, StateMessage } from './components/ui/Feedback.jsx';
import { ModuleVisibilityGuard } from './components/admin/ModuleVisibilityGuard.jsx';
import {
  AdminDashboard,
  CommercialLanding,
  OperationalAgendaBoard,
  PlatformAdmin,
  ProfessionalCapabilitiesAdmin,
  ProfessionalScheduleAdmin,
  SmartFitAdmin,
  WaitlistAdmin,
  WhatsAppAgentTester
} from './components/lazy-pages.jsx';
import { TENANT_BACKOFFICE_PAGES, normalizePageForRole, resolveInitialPage } from './config/navigation.js';
import { isSuperAdmin as isSuperAdminRole, tokenRole } from './utils/auth.js';
import { hasModule } from './utils/modules.js';

/**
 * Orquestrador principal do frontend.
 *
 * Responsabilidades mantidas aqui:
 * - estado global mínimo da aplicação;
 * - composição das páginas;
 * - ciclo de carregamento público e do tenant autenticado.
 *
 * Regras de papel, navegação e matriz de endpoints ficam em módulos dedicados
 * para impedir que o App volte a concentrar autorização e acesso a dados.
 * Telas pesadas do backoffice são carregadas sob demanda para manter a vitrine
 * e o fluxo público fora do bundle administrativo.
 */
export default function App() {
  const [page, setPage] = useState('public');
  const [theme, setTheme] = useState(() => localStorage.getItem('glossflow.theme') || 'dark');
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('glossflow.token') || '');

  const [salon, setSalon] = useState(null);
  const [services, setServices] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [backoffice, setBackoffice] = useState(() => emptyBackofficeData());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAuthenticated = Boolean(authToken);
  const authRole = tokenRole(authToken);
  const isSuperAdmin = isSuperAdminRole(authRole);

  const {
    adminSalon,
    appointments,
    inventory,
    users,
    clients,
    financialEntries,
    commissions,
    loyalty,
    subscription,
    whatsappTemplates,
    insights
  } = backoffice;

  const backofficeSalon = adminSalon || salon;

  function clearTenantAdminData() {
    setBackoffice(emptyBackofficeData());
  }

  /** Resolve `?action=` uma única vez no bootstrap da SPA. */
  useEffect(() => {
    const action = new URLSearchParams(window.location.search).get('action');
    setPage(resolveInitialPage({ action, authenticated: isAuthenticated, role: authRole }));
    localStorage.setItem('glossflow.pwa.query-action', action || 'public');
  }, []);

  /**
   * O cliente HTTP dispara este evento somente quando a sessão realmente
   * expirou. Falhas de módulos individuais não devem mais causar logout.
   */
  useEffect(() => onAuthExpired(() => {
    setAuthToken('');
    clearTenantAdminData();
    setError('');
    setLoading(false);
    setPage('login');
  }), []);

  /** Corrige a página quando o papel autenticado muda ou a sessão termina. */
  useEffect(() => {
    const normalizedPage = normalizePageForRole({
      page,
      authenticated: isAuthenticated,
      role: authRole
    });

    if (normalizedPage !== page) setPage(normalizedPage);
  }, [authToken, authRole, page]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('glossflow.theme', theme);
  }, [theme]);

  /** Mantém título público e administrativo coerentes com o tenant ativo. */
  useEffect(() => {
    if (page === 'platform-admin') {
      document.title = 'GlossFlow • Super Admin';
      return;
    }

    const currentSalon = TENANT_BACKOFFICE_PAGES.includes(page) ? backofficeSalon : salon;
    if (!currentSalon) return;

    document.title = TENANT_BACKOFFICE_PAGES.includes(page)
      ? `GlossFlow • ${currentSalon.name}`
      : currentSalon.name;
  }, [salon, adminSalon, page]);

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  /**
   * Carrega a vitrine e, quando aplicável, o backoffice do tenant.
   * `silent` é usado após mutações para atualizar dados sem desmontar a tela.
   */
  async function loadPublicData(options = {}) {
    const silent = Boolean(options?.silent);

    if (!silent) {
      setLoading(true);
      setError('');
    }

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
        return;
      }

      try {
        const tenantData = await loadTenantBackofficeData({ role: authRole });
        setBackoffice(tenantData);
      } catch (backofficeError) {
        if (isAuthExpiredError(backofficeError)) return;

        console.warn('Falha ao atualizar dados administrativos:', backofficeError.message);
        if (silent) throw backofficeError;
        setError(backofficeError.message || 'Não foi possível carregar os dados administrativos.');
      }
    } catch (loadError) {
      if (isAuthExpiredError(loadError)) return;
      if (silent) throw loadError;
      setError(loadError.message || 'Não foi possível conectar à API.');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  /** Atualização pós-CRUD sem resetar o painel ou a aba administrativa. */
  async function reloadBackofficeData() {
    return loadPublicData({ silent: true });
  }

  useEffect(() => {
    loadPublicData();
  }, [authToken, authRole]);

  const canUseAgent = backofficeSalon
    ? hasModule(backofficeSalon, 'IA') && hasModule(backofficeSalon, 'WHATSAPP')
    : true;
  const canUseBooking = salon ? hasModule(salon, 'AGENDA') : true;

  return (
    <div className="app-shell">
      {isAuthenticated && !isSuperAdmin && backofficeSalon && (
        <ModuleVisibilityGuard salon={backofficeSalon} />
      )}

      {page !== 'platform-admin' && (
        <Header
          page={page}
          setPage={setPage}
          isAuthenticated={isAuthenticated}
          theme={theme}
          toggleTheme={toggleTheme}
          salon={page === 'public' || page === 'booking' ? salon : backofficeSalon}
        />
      )}

      {loading && <SkeletonPage />}
      {!loading && error && <StateMessage title="Não foi possível conectar à API." text={error} danger />}

      <Suspense fallback={<SkeletonPage />}>
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
          canUseBooking
            ? <BookingPage services={services} professionals={professionals} onCreated={loadPublicData} salon={salon} />
            : <StateMessage title="Agendamento online indisponível" text="Este salão não possui o módulo Agenda habilitado." danger />
        )}

        {!loading && !error && page === 'login' && (
          <LoginPage setPage={setPage} onLogin={setAuthToken} />
        )}

        {!loading && !error && page === 'platform-admin' && (
          isAuthenticated && isSuperAdmin
            ? <PlatformAdmin setPage={setPage} />
            : <LoginPage setPage={setPage} onLogin={setAuthToken} />
        )}

        {!loading && !error && page === 'agent-test' && (
          isAuthenticated && !isSuperAdmin && canUseAgent
            ? <WhatsAppAgentTester setPage={setPage} />
            : isAuthenticated && !isSuperAdmin
              ? <StateMessage title="Módulo não habilitado" text="O agente precisa dos módulos WhatsApp e Inteligência Artificial habilitados." danger />
              : <LoginPage setPage={setPage} onLogin={setAuthToken} />
        )}

        {!loading && !error && page === 'professional-services' && (
          isAuthenticated && !isSuperAdmin
            ? <ProfessionalCapabilitiesAdmin salon={backofficeSalon} services={services} professionals={professionals} reload={reloadBackofficeData} setPage={setPage} />
            : <LoginPage setPage={setPage} onLogin={setAuthToken} />
        )}

        {!loading && !error && page === 'professional-schedule' && (
          isAuthenticated && !isSuperAdmin && canUseBooking
            ? <ProfessionalScheduleAdmin setPage={setPage} />
            : isAuthenticated && !isSuperAdmin
              ? <StateMessage title="Módulo não habilitado" text="A jornada da equipe faz parte do módulo Agenda." danger />
              : <LoginPage setPage={setPage} onLogin={setAuthToken} />
        )}

        {!loading && !error && page === 'operational-agenda' && (
          isAuthenticated && !isSuperAdmin && canUseBooking
            ? <OperationalAgendaBoard appointments={appointments} professionals={professionals} reload={reloadBackofficeData} setPage={setPage} />
            : isAuthenticated && !isSuperAdmin
              ? <StateMessage title="Módulo não habilitado" text="A agenda operacional faz parte do módulo Agenda." danger />
              : <LoginPage setPage={setPage} onLogin={setAuthToken} />
        )}

        {!loading && !error && page === 'smart-fit' && (
          isAuthenticated && !isSuperAdmin && canUseBooking
            ? <SmartFitAdmin services={services} professionals={professionals} setPage={setPage} />
            : isAuthenticated && !isSuperAdmin
              ? <StateMessage title="Módulo não habilitado" text="O encaixe inteligente faz parte do módulo Agenda." danger />
              : <LoginPage setPage={setPage} onLogin={setAuthToken} />
        )}

        {!loading && !error && page === 'waitlist' && (
          isAuthenticated && !isSuperAdmin && canUseBooking
            ? <WaitlistAdmin setPage={setPage} />
            : isAuthenticated && !isSuperAdmin
              ? <StateMessage title="Módulo não habilitado" text="A lista de espera faz parte do módulo Agenda." danger />
              : <LoginPage setPage={setPage} onLogin={setAuthToken} />
        )}

        {!loading && !error && page === 'admin' && (
          isAuthenticated && !isSuperAdmin
            ? (
              <AdminDashboard
                role={authRole}
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
                reload={reloadBackofficeData}
                setPage={setPage}
                theme={theme}
                toggleTheme={toggleTheme}
              />
            )
            : <LoginPage setPage={setPage} onLogin={setAuthToken} />
        )}
      </Suspense>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { hasModule } from '../../utils/modules';
import { OperationalNotificationsBell } from './OperationalNotificationsBell.jsx';

const TITLE_TO_MODULE = {
  'Vitrine': 'SITE',
  'Agenda': 'AGENDA',
  'Estoque': 'ESTOQUE',
  'Clientes': 'CRM',
  'Financeiro': 'FINANCEIRO',
  'Comissões': 'FINANCEIRO',
  'Fidelidade': 'FIDELIDADE',
  'Automações': 'WHATSAPP',
  'Assistente IA': 'IA',
  'Métricas Avançadas': 'ANALYTICS'
};

const PLATFORM_ONLY_TITLES = new Set([
  'Assinatura',
  'Segurança',
  'Ecossistema',
  'Observabilidade',
  'UX Premium',
  'App/PWA'
]);

const PLATFORM_ONLY_TEXT = [
  'Assinatura Planos do SaaS',
  'Segurança Auditoria, sessões e LGPD',
  'Ecossistema WhatsApp, pagamentos e marketing',
  'Observabilidade Métricas, saúde e alertas',
  'UX Premium Tour, busca e atalhos',
  'App/PWA Instalação, offline e mobile'
];

const STAT_TO_MODULE = {
  'Vitrine': 'SITE',
  'Agenda': 'AGENDA',
  'Estoque': 'ESTOQUE',
  'Clientes': 'CRM',
  'Receita': 'FINANCEIRO'
};

function normalizedText(element) {
  return (element?.textContent || '').trim().replace(/\s+/g, ' ');
}

function tokenRole() {
  const token = localStorage.getItem('glossflow.token');
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

function isPlatformOnlyButton(button) {
  const title = button.getAttribute('title') || '';
  if (PLATFORM_ONLY_TITLES.has(title)) return true;
  const text = normalizedText(button);
  return PLATFORM_ONLY_TEXT.some((platformText) => text === platformText || text.startsWith(`${platformText} `));
}

function moduleForButton(button) {
  const title = button.getAttribute('title') || '';
  if (TITLE_TO_MODULE[title]) return TITLE_TO_MODULE[title];
  const text = normalizedText(button);
  if (text === 'Site & Marca') return 'SITE';
  if (text === 'Testar IA') return 'IA';
  if (text === 'Agendar') return 'AGENDA';
  return null;
}

function hideElement(element) {
  if (!element) return;
  element.dataset.moduleHidden = 'true';
  element.hidden = true;
  element.setAttribute('aria-hidden', 'true');
  element.style.setProperty('display', 'none', 'important');
}

function restoreElement(element) {
  if (element?.dataset.moduleHidden === 'true') {
    delete element.dataset.moduleHidden;
    element.hidden = false;
    element.removeAttribute('aria-hidden');
    element.style.removeProperty('display');
  }
}

function findBackofficeNav() {
  return [...document.querySelectorAll('.header .nav')].find((nav) =>
    [...nav.querySelectorAll('button')].some((button) => normalizedText(button) === 'Ver site')
  ) || null;
}

/**
 * Camada visual de entitlements do salão.
 * O sino é montado no fluxo normal do header e somente para role ADMIN.
 */
export function ModuleVisibilityGuard({ salon }) {
  const [notificationHost, setNotificationHost] = useState(null);

  useEffect(() => {
    if (!salon) return undefined;

    function syncNotificationHost() {
      const currentHost = document.querySelector('.operational-notification-host');
      const canShowBell = tokenRole() === 'ADMIN' && hasModule(salon, 'AGENDA');
      const nav = canShowBell ? findBackofficeNav() : null;

      if (!nav) {
        currentHost?.remove();
        setNotificationHost(null);
        return;
      }

      let host = currentHost;
      if (!host || host.parentElement !== nav) {
        currentHost?.remove();
        host = document.createElement('span');
        host.className = 'operational-notification-host';
        host.setAttribute('aria-label', 'Notificações administrativas');
        host.style.display = 'inline-flex';
        host.style.alignItems = 'center';
        host.style.flex = '0 0 auto';
        host.style.position = 'relative';
        host.style.zIndex = '2';
        host.style.margin = '0 2px';
        const themeButton = nav.querySelector('.theme-toggle');
        nav.insertBefore(host, themeButton || null);
      }
      setNotificationHost(host);
    }

    function apply() {
      document.querySelectorAll('button').forEach((button) => {
        if (button.closest('.operational-notification-host')) return;
        if (isPlatformOnlyButton(button)) {
          hideElement(button);
          return;
        }

        const module = moduleForButton(button);
        if (!module) return;
        const allowed = hasModule(salon, module)
          && (normalizedText(button) !== 'Testar IA' || hasModule(salon, 'WHATSAPP'));
        if (!allowed) hideElement(button); else restoreElement(button);
      });

      document.querySelectorAll('.pro-stat-card').forEach((card) => {
        const labels = [...card.querySelectorAll('span')].map((item) => normalizedText(item));
        const moduleEntry = Object.entries(STAT_TO_MODULE).find(([label]) => labels.includes(label));
        if (!moduleEntry) return;
        const [, module] = moduleEntry;
        if (!hasModule(salon, module)) hideElement(card); else restoreElement(card);
      });

      syncNotificationHost();
    }

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['title'] });

    return () => {
      observer.disconnect();
      document.querySelector('.operational-notification-host')?.remove();
      document.querySelectorAll('[data-module-hidden="true"]').forEach(restoreElement);
      setNotificationHost(null);
    };
  }, [salon]);

  return notificationHost ? createPortal(<OperationalNotificationsBell />, notificationHost) : null;
}

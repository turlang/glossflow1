import { useEffect } from 'react';
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

/**
 * Camada visual de entitlements do ADMIN do salão.
 * O sino de notificações é mantido aqui para ficar disponível em todas as telas
 * operacionais sem acoplar a central a um dashboard específico.
 */
export function ModuleVisibilityGuard({ salon }) {
  useEffect(() => {
    if (!salon) return undefined;

    function apply() {
      document.querySelectorAll('button').forEach((button) => {
        if (button.closest('.operational-notification-anchor')) return;
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
    }

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['title'] });

    return () => {
      observer.disconnect();
      document.querySelectorAll('[data-module-hidden="true"]').forEach(restoreElement);
    };
  }, [salon]);

  if (!salon || !hasModule(salon, 'AGENDA')) return null;
  return (
    <div className="operational-notification-anchor" style={{ position: 'fixed', top: 18, right: 76, zIndex: 120 }}>
      <OperationalNotificationsBell />
    </div>
  );
}

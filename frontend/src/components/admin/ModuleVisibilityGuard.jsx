import { useEffect } from 'react';
import { hasModule } from '../../utils/modules';

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
  'Ecossistema',
  'Observabilidade',
  'UX Premium',
  'App/PWA'
]);

const STAT_TO_MODULE = {
  'Vitrine': 'SITE',
  'Agenda': 'AGENDA',
  'Estoque': 'ESTOQUE',
  'Clientes': 'CRM',
  'Receita': 'FINANCEIRO'
};

function moduleForButton(button) {
  const title = button.getAttribute('title') || '';
  if (TITLE_TO_MODULE[title]) return TITLE_TO_MODULE[title];

  const text = (button.textContent || '').trim().replace(/\s+/g, ' ');
  if (text === 'Site & Marca') return 'SITE';
  if (text === 'Testar IA') return 'IA';
  if (text === 'Agendar') return 'AGENDA';
  return null;
}

function hideElement(element) {
  if (!element) return;
  element.dataset.moduleHidden = 'true';
  element.style.display = 'none';
}

function restoreElement(element) {
  if (element?.dataset.moduleHidden === 'true') {
    delete element.dataset.moduleHidden;
    element.style.removeProperty('display');
  }
}

/**
 * Camada visual de entitlements do ADMIN do salão.
 * - módulos desativados pelo SUPER_ADMIN não aparecem;
 * - áreas de plataforma (planos, infraestrutura e produto) nunca aparecem;
 * - cards do dashboard respeitam os módulos contratados.
 * O backend continua sendo a fonte final de autorização.
 */
export function ModuleVisibilityGuard({ salon }) {
  useEffect(() => {
    if (!salon) return undefined;

    function apply() {
      document.querySelectorAll('button').forEach((button) => {
        const title = button.getAttribute('title') || '';
        if (PLATFORM_ONLY_TITLES.has(title)) {
          hideElement(button);
          return;
        }

        const module = moduleForButton(button);
        if (!module) return;
        const allowed = hasModule(salon, module)
          && (button.textContent?.trim() !== 'Testar IA' || hasModule(salon, 'WHATSAPP'));
        if (!allowed) hideElement(button); else restoreElement(button);
      });

      document.querySelectorAll('.pro-stat-card').forEach((card) => {
        const labels = [...card.querySelectorAll('span')].map((item) => (item.textContent || '').trim());
        const moduleEntry = Object.entries(STAT_TO_MODULE).find(([label]) => labels.includes(label));
        if (!moduleEntry) return;
        const [, module] = moduleEntry;
        if (!hasModule(salon, module)) hideElement(card); else restoreElement(card);
      });
    }

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.querySelectorAll('[data-module-hidden="true"]').forEach(restoreElement);
    };
  }, [salon]);

  return null;
}

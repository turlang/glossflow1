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

function moduleForButton(button) {
  const title = button.getAttribute('title') || '';
  if (TITLE_TO_MODULE[title]) return TITLE_TO_MODULE[title];

  const text = (button.textContent || '').trim().replace(/\s+/g, ' ');
  if (text === 'Site & Marca') return 'SITE';
  if (text === 'Testar IA') return 'IA';
  if (text === 'Agendar') return 'AGENDA';
  return null;
}

/**
 * Camada visual de entitlements.
 * O backend continua sendo a fonte de segurança; este componente apenas evita
 * mostrar ao cliente atalhos para módulos que o Super Admin desativou.
 */
export function ModuleVisibilityGuard({ salon }) {
  useEffect(() => {
    if (!salon) return undefined;

    function apply() {
      document.querySelectorAll('button').forEach((button) => {
        const module = moduleForButton(button);
        if (!module) return;

        const allowed = hasModule(salon, module) && (button.textContent?.trim() !== 'Testar IA' || hasModule(salon, 'WHATSAPP'));
        if (!allowed) {
          button.dataset.moduleHidden = 'true';
          button.style.display = 'none';
        } else if (button.dataset.moduleHidden === 'true') {
          delete button.dataset.moduleHidden;
          button.style.removeProperty('display');
        }
      });
    }

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.querySelectorAll('button[data-module-hidden="true"]').forEach((button) => {
        delete button.dataset.moduleHidden;
        button.style.removeProperty('display');
      });
    };
  }, [salon]);

  return null;
}

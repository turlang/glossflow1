export type AIProvider = 'groq' | 'openai';

export type AIResponseItem = {
  type: string;
  id?: string;
  role?: string;
  status?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: Array<{ type: string; text?: string }>;
  [key: string]: unknown;
};

export type AIResponse = {
  id: string;
  output?: AIResponseItem[];
  [key: string]: unknown;
};

export type AIRuntimeConfig = {
  provider: AIProvider;
  providerLabel: 'Groq' | 'OpenAI';
  model: string;
  apiKey: string;
  apiKeyEnv: 'GROQ_API_KEY' | 'OPENAI_API_KEY';
  endpoint: string;
  configured: boolean;
};

function normalizedProvider(): AIProvider {
  const explicit = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (explicit === 'groq') return 'groq';
  if (explicit === 'openai') return 'openai';

  // Compatibilidade: quando AI_PROVIDER ainda não foi definido, prioriza Groq
  // se houver chave configurada; caso contrário mantém o comportamento antigo.
  if (process.env.GROQ_API_KEY) return 'groq';
  return 'openai';
}

export function getAIRuntimeConfig(): AIRuntimeConfig {
  const provider = normalizedProvider();

  if (provider === 'groq') {
    const apiKey = String(process.env.GROQ_API_KEY || '').trim();
    return {
      provider,
      providerLabel: 'Groq',
      model: String(process.env.GROQ_MODEL || 'openai/gpt-oss-120b').trim(),
      apiKey,
      apiKeyEnv: 'GROQ_API_KEY',
      endpoint: 'https://api.groq.com/openai/v1/responses',
      configured: Boolean(apiKey)
    };
  }

  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  return {
    provider,
    providerLabel: 'OpenAI',
    model: String(process.env.OPENAI_MODEL || 'gpt-4o-mini').trim(),
    apiKey,
    apiKeyEnv: 'OPENAI_API_KEY',
    endpoint: 'https://api.openai.com/v1/responses',
    configured: Boolean(apiKey)
  };
}

function publicResponse(data: AIResponse): AIResponse {
  // Nunca devolve itens de raciocínio para o agente de atendimento. Além de
  // não terem utilidade para o cliente, reenviá-los no próximo round de tools
  // pode fazer o modelo repetir texto interno na resposta final.
  return {
    ...data,
    output: (data.output || []).filter((item) => item.type !== 'reasoning')
  };
}

export async function requestAIResponse(payload: Record<string, unknown>): Promise<AIResponse> {
  const config = getAIRuntimeConfig();
  if (!config.configured) {
    throw new Error(`${config.providerLabel}: ${config.apiKeyEnv} não configurada.`);
  }

  const providerPayload: Record<string, unknown> = {
    ...payload,
    model: config.model
  };

  // GPT-OSS é um modelo de raciocínio. Para atendimento de salão, uma carga
  // baixa é suficiente e reduz latência/custo. O raciocínio continua separado
  // da resposta pública e é removido por publicResponse().
  if (config.provider === 'groq' && config.model.startsWith('openai/gpt-oss-')) {
    providerPayload.reasoning = { effort: 'low' };
  }

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(providerPayload)
  });

  const data = await response.json().catch(() => ({})) as AIResponse & {
    error?: { message?: string; code?: string; type?: string };
  };

  if (!response.ok) {
    const detail = data.error?.message || data.error?.code || data.error?.type || `HTTP ${response.status}`;
    throw new Error(`${config.providerLabel} respondeu HTTP ${response.status}: ${detail}`);
  }

  return publicResponse(data);
}

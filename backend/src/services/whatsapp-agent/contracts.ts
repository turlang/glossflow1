export type AgentSalon = {
  id: string;
  name: string;
  description: string;
  whatsapp: string;
  openingHours: string;
};

export type ConversationMessage = {
  direction: 'IN' | 'OUT';
  text: string;
};

export type ResponseFunctionCall = {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string;
};

export type ToolArgs = Record<string, unknown>;

export function normalizePhone(value: string) {
  return String(value || '').replace(/\D/g, '');
}

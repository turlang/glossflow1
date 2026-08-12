export { normalizePhone } from './whatsapp-agent/contracts';
export {
  closeHumanHandoff,
  findSalonByWhatsApp,
  hasOpenHumanHandoff,
  isDuplicateWhatsAppMessage,
  openHumanHandoff,
  saveWhatsAppMessage
} from './whatsapp-agent/conversation.repository';
export { answerWhatsAppMessage } from './whatsapp-agent/orchestrator.service';

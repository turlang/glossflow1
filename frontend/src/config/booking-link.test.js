import { describe, expect, it } from 'vitest';
import { bookingSelection, directBookingLink } from './booking-link.js';
describe('links de agendamento direto', () => {
  const services = [{ id: 's', active: true }];
  const professionals = [
    { id: 'p', servicesConfigured: true, serviceIds: ['s'] },
    { id: 'other', servicesConfigured: true, serviceIds: ['different'] }
  ];
  it('pré-seleciona somente serviço e profissional elegíveis carregados pelo salão', () => {
    expect(bookingSelection('?service=s&professional=p', services, professionals)).toEqual({
      serviceId: 's',
      professionalId: 'p'
    });
    expect(bookingSelection('?service=s&professional=other', services, professionals)).toEqual({
      serviceId: 's',
      professionalId: ''
    });
    expect(bookingSelection('?service=foreign&professional=p', services, professionals)).toEqual({
      serviceId: '',
      professionalId: ''
    });
  });
  it('preserva tenant e remove parâmetros privados do link compartilhável', () => {
    expect(directBookingLink('https://example.com/?token=secret&action=admin#private', 'salao')).toBe(
      'https://example.com/?action=booking&salon=salao'
    );
  });
});

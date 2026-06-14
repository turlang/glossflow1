/** Formatação monetária padronizada para o Brasil. */
export function currency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

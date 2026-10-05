export function bookingSelection(search, services, professionals) {
  const params = new URLSearchParams(search);
  const service = services.find((s) => s.id === params.get('service') && s.active !== false);
  const professional =
    service &&
    professionals.find(
      (p) =>
        p.id === params.get('professional') &&
        p.active !== false &&
        (!p.servicesConfigured || p.serviceIds?.includes(service.id))
    );
  return { serviceId: service?.id || '', professionalId: professional?.id || '' };
}

export function directBookingLink(url, salonSlug) {
  const link = new URL(url);
  link.search = '';
  link.hash = '';
  link.searchParams.set('action', 'booking');
  if (salonSlug) link.searchParams.set('salon', salonSlug);
  return link.toString();
}

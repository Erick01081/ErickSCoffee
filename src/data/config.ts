// Edita aquí lo básico de tu tienda.
export const config = {
  brand: 'ØPPOSITE',                 // nombre / logo
  whatsapp: '573228874210',          // número con indicativo, sin + ni espacios
  shippingStartsAt: '2026-12-01T00:00:00-05:00',
  shippingEndsAt: '2026-12-07T23:59:59-05:00',
  privacyPolicyVersion: '2026-11-26',
  shipping: 'Despachos del 1 al 7 de diciembre de 2026.',
  currency: 'COP',
};

export function formatDate(date: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) {
  return new Intl.DateTimeFormat('es-CO', { ...options, timeZone: 'America/Bogota' }).format(new Date(date));
}

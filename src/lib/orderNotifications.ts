import { ORDER_NOTIFY_EMAIL } from 'astro:env/server';
import { config } from '../data/config';
import { customerOrderEmail, isEmail, ownerOrderEmail, sendEmail, type OrderSummary } from './email';

type CheckoutData = {
  buyer?: OrderSummary['buyer'];
  items?: OrderSummary['items'];
  subtotal?: number;
  shipping?: number;
  shippingFee?: number;
  shippingPayment?: string;
  total?: number;
};

/** Convierte lo que guardamos en Supabase (checkout_data) en el resumen que usan los correos. */
export function summaryFromCheckout(reference: string, data: CheckoutData, state: OrderSummary['state']): OrderSummary {
  return {
    reference,
    channel: 'mercadopago',
    state,
    buyer: data.buyer ?? {},
    items: data.items ?? [],
    subtotal: Number(data.subtotal ?? 0),
    shipping: Number(data.shipping ?? 0),
    shippingFee: data.shippingFee ? Number(data.shippingFee) : undefined,
    shippingPayment: data.shippingPayment === 'on_delivery' ? 'on_delivery' : 'prepaid',
    total: Number(data.total ?? 0),
  };
}

const ownerAddress = () => (ORDER_NOTIFY_EMAIL || '').split(',').map(value => value.trim()).filter(isEmail);

export async function emailOwner(order: OrderSummary, idempotencyKey: string) {
  const to = ownerAddress();
  if (!to.length) {
    console.warn('ORDER_NOTIFY_EMAIL is missing or invalid; owner email skipped');
    return false;
  }
  const email = ownerOrderEmail(order);
  const result = await sendEmail({
    to,
    ...email,
    // Si el cliente dejó su correo, "Responder" le escribe directo.
    replyTo: isEmail(order.buyer.email) ? order.buyer.email.trim() : undefined,
    idempotencyKey,
  });
  return result.ok;
}

export async function emailCustomer(order: OrderSummary, idempotencyKey: string) {
  if (!isEmail(order.buyer.email)) return false;
  const shippingNote = order.state === 'paid'
    ? `${config.shipping} Cuando salga tu pedido te avisamos.`
    : 'Revisa tu WhatsApp: ahí acordamos contigo el pago y el envío.';
  const email = customerOrderEmail(order, shippingNote);
  const result = await sendEmail({
    to: order.buyer.email.trim(),
    ...email,
    replyTo: ownerAddress()[0],
    idempotencyKey,
  });
  return result.ok;
}

/**
 * Pago aprobado: avisa al dueño y confirma al cliente.
 * Devuelve false si el correo al dueño no salió, para que el webhook pueda reintentar.
 */
export async function notifyPaidOrder(order: OrderSummary) {
  const [ownerSent] = await Promise.all([
    emailOwner(order, `order-paid-owner-${order.reference}`),
    emailCustomer(order, `order-paid-customer-${order.reference}`),
  ]);
  return ownerSent;
}

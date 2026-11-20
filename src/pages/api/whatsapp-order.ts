import type { APIRoute } from 'astro';
import { colombianDepartments, shippingPrice } from '../../data/locations';
import { priceCart } from '../../lib/cart';
import { isEmail, type OrderSummary } from '../../lib/email';
import { emailCustomer, emailOwner } from '../../lib/orderNotifications';
import { randomUUID } from 'node:crypto';

export const prerender = false;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** Pedidos que el cliente envía por WhatsApp: se recalculan con el catálogo y se avisa por correo. */
export const POST: APIRoute = async ({ request }) => {
  let input: { items?: unknown; shippingPayment?: unknown; buyer?: Record<string, unknown> };
  try { input = await request.json(); } catch { return json({ error: 'Pedido ilegible.' }, 400); }

  const cart = priceCart(input.items);
  if (!cart.ok) return json({ error: cart.error }, 400);

  const buyer = input.buyer ?? {};
  const department = text(buyer.department, 80);
  const city = text(buyer.city, 100);
  const hasDestination = colombianDepartments.includes(department) && !!city;
  const shippingPayment = input.shippingPayment === 'on_delivery' ? 'on_delivery' : 'prepaid';
  const shippingFee = hasDestination ? shippingPrice(department, city) : undefined;

  const order: OrderSummary = {
    reference: randomUUID(),
    channel: 'whatsapp',
    state: 'whatsapp',
    buyer: {
      name: text(buyer.name, 100),
      email: isEmail(buyer.email) ? String(buyer.email).trim() : '',
      phone: text(buyer.phone, 30),
      identification: text(buyer.identification, 30),
      address: text(buyer.address, 200),
      department: hasDestination ? department : '',
      city: hasDestination ? city : '',
    },
    items: cart.items,
    subtotal: cart.subtotal,
    shipping: 0,
    shippingFee,
    shippingPayment,
    total: cart.subtotal,
  };

  await Promise.race([
    Promise.all([
      emailOwner(order, `order-wa-owner-${order.reference}`),
      emailCustomer(order, `order-wa-customer-${order.reference}`),
    ]),
    new Promise(resolve => setTimeout(resolve, 6000)),
  ]).catch(() => {});

  return json({ ok: true });
};

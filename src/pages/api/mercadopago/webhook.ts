import type { APIRoute } from 'astro';
import {
  MP_ACCESS_TOKEN,
  MP_ENVIRONMENT,
  MP_WEBHOOK_SECRET,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from 'astro:env/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { notifyPaidOrder, summaryFromCheckout } from '../../../lib/orderNotifications';

export const prerender = false;

function supabaseRestUrl(path: string) {
  const baseUrl = (SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  return `${baseUrl}/rest/v1/${path}`;
}

async function saveOrder(orderId: string, order: Record<string, unknown>) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase is not configured');
  }

  const payer = order.payer && typeof order.payer === 'object'
    ? order.payer as Record<string, unknown>
    : {};
  const identification = payer.identification && typeof payer.identification === 'object'
    ? payer.identification as Record<string, unknown>
    : {};

  const payload = {
    mercadopago_order_id: orderId,
    external_reference: typeof order.external_reference === 'string' ? order.external_reference : null,
    status: typeof order.status === 'string' ? order.status : null,
    status_detail: typeof order.status_detail === 'string' ? order.status_detail : null,
    live_mode: typeof order.live_mode === 'boolean' ? order.live_mode : null,
    transaction_amount: typeof order.total_amount === 'number' ? order.total_amount : null,
    currency_id: typeof order.currency_id === 'string' ? order.currency_id : 'COP',
    payer_email: typeof payer.email === 'string' ? payer.email : null,
    payer_name: typeof payer.name === 'string' ? payer.name : null,
    payer_identification: typeof identification.number === 'string' ? identification.number : null,
    order_data: order,
    updated_at: new Date().toISOString(),
  };

  const response = await fetch(
    `${supabaseRestUrl('mercadopago_orders')}?external_reference=eq.${encodeURIComponent(payload.external_reference || '')}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase update failed (${response.status}): ${error.slice(0, 300)}`);
  }

  const updatedRows = await response.json().catch(() => []);
  if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
    const insertResponse = await fetch(`${supabaseRestUrl('mercadopago_orders')}?on_conflict=mercadopago_order_id`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(payload),
    });
    if (!insertResponse.ok) {
      const error = await insertResponse.text();
      throw new Error(`Supabase insert failed (${insertResponse.status}): ${error.slice(0, 300)}`);
    }
  }
}

function supabaseHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY || '',
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/** Guarda en la fila del pedido lo que Mercado Pago reporta del pago (estado, detalle y respuesta completa). */
async function savePayment(reference: string, payment: Record<string, unknown>) {
  const payer = payment.payer && typeof payment.payer === 'object' ? payment.payer as Record<string, unknown> : {};
  const response = await fetch(`${supabaseRestUrl('mercadopago_orders')}?external_reference=eq.${encodeURIComponent(reference)}`, {
    method: 'PATCH',
    headers: supabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({
      status: typeof payment.status === 'string' ? payment.status : null,
      status_detail: typeof payment.status_detail === 'string' ? payment.status_detail : null,
      live_mode: typeof payment.live_mode === 'boolean' ? payment.live_mode : null,
      payer_email: typeof payer.email === 'string' ? payer.email : null,
      payment_data: payment,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase payment update failed (${response.status}): ${error.slice(0, 300)}`);
  }
}

/**
 * Envía los correos de pago confirmado una sola vez por pedido.
 * Primero "reclama" la fila (confirmation_email_sent_at pasa de null a la fecha). Solo quien logra
 * reclamarla envía; si Mercado Pago repite la notificación, la segunda llamada no encuentra nada que reclamar.
 */
async function sendConfirmationOnce(reference: string) {
  const table = supabaseRestUrl('mercadopago_orders');
  const filter = `external_reference=eq.${encodeURIComponent(reference)}`;
  const claim = await fetch(`${table}?${filter}&confirmation_email_sent_at=is.null`, {
    method: 'PATCH',
    headers: supabaseHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify({ confirmation_email_sent_at: new Date().toISOString() }),
  });
  if (!claim.ok) {
    const error = await claim.text();
    throw new Error(`Supabase email claim failed (${claim.status}): ${error.slice(0, 300)}`);
  }
  const rows = await claim.json().catch(() => []);
  if (!Array.isArray(rows) || rows.length === 0) return; // ya enviado, o el pedido no existe

  const checkout = rows[0]?.checkout_data;
  if (!checkout || typeof checkout !== 'object') {
    console.error('Paid order has no checkout_data; confirmation email skipped', reference);
    return;
  }

  const ownerNotified = await notifyPaidOrder(summaryFromCheckout(reference, checkout, 'paid'));
  if (!ownerNotified) {
    // Libera la reclamación para que el reintento de Mercado Pago vuelva a intentar el envío.
    await fetch(`${table}?${filter}`, {
      method: 'PATCH',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ confirmation_email_sent_at: null }),
    }).catch(() => {});
    throw new Error('Owner confirmation email could not be sent');
  }
}

async function handlePayment(paymentId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    cache: 'no-store',
  });
  if (!response.ok) return new Response('Could not verify payment', { status: 502 });
  const payment = await response.json() as Record<string, unknown>;
  if (typeof payment.live_mode === 'boolean' && payment.live_mode !== (MP_ENVIRONMENT === 'production')) {
    return new Response('Environment mismatch', { status: 400 });
  }
  const reference = typeof payment.external_reference === 'string' ? payment.external_reference : '';
  if (!/^[a-f0-9-]{36}$/i.test(reference)) return new Response(null, { status: 200 }); // pago ajeno a este sitio

  await savePayment(reference, payment);
  if (payment.status === 'approved') await sendConfirmationOnce(reference);
  console.info('Mercado Pago payment notification verified', { paymentId, status: payment.status, statusDetail: payment.status_detail });
  return new Response(null, { status: 200 });
}

function hasValidSignature(signatureHeader: string | null, requestId: string | null, dataId: string, secret: string) {
  if (!signatureHeader) return false;
  const fields = Object.fromEntries(signatureHeader.split(',').map(part => part.trim().split('=').map(value => value.trim())));
  if (!fields.ts || !fields.v1 || !/^[a-f0-9]{64}$/i.test(fields.v1)) return false;
  const manifest = [
    `id:${dataId.toLowerCase()}`,
    ...(requestId ? [`request-id:${requestId}`] : []),
    `ts:${fields.ts}`,
  ].join(';') + ';';
  const expected = createHmac('sha256', secret).update(manifest).digest();
  const provided = Buffer.from(fields.v1, 'hex');
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export const POST: APIRoute = async ({ request, url }) => {
  if (
    !MP_WEBHOOK_SECRET ||
    !MP_ACCESS_TOKEN ||
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !['test', 'production'].includes(MP_ENVIRONMENT || '')
  ) {
    return new Response('Webhook not configured', { status: 503 });
  }

  let body: { type?: unknown; action?: unknown; data?: { id?: unknown } } = {};
  try { body = await request.json(); } catch { /* Some notifications only send query parameters. */ }
  const type = url.searchParams.get('type') || (typeof body.type === 'string' ? body.type : '');
  if (type && type !== 'order' && type !== 'payment') return new Response(null, { status: 200 });

  const dataId = url.searchParams.get('data.id') || url.searchParams.get('id') || String(body.data?.id || '');
  if (!/^[A-Z0-9-]{8,100}$/i.test(dataId)) return new Response('Invalid order id', { status: 400 });
  if (!hasValidSignature(request.headers.get('x-signature'), request.headers.get('x-request-id'), dataId, MP_WEBHOOK_SECRET)) {
    return new Response('Invalid signature', { status: 401 });
  }

  try {
    if (type === 'payment') return await handlePayment(dataId);

    const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(dataId)}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      cache: 'no-store',
    });
    if (!response.ok) return new Response('Could not verify order', { status: 502 });
    const order = await response.json();
    if (typeof order.live_mode === 'boolean' && order.live_mode !== (MP_ENVIRONMENT === 'production')) {
      return new Response('Environment mismatch', { status: 400 });
    }
    await saveOrder(dataId, order as Record<string, unknown>);
    if (order.status === 'processed' && order.status_detail === 'accredited' && typeof order.external_reference === 'string') {
      await sendConfirmationOnce(order.external_reference);
    }
    console.info('Mercado Pago order notification verified', { orderId: dataId, status: order.status, statusDetail: order.status_detail });
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error('Could not verify or save Mercado Pago order', error);
    return new Response('Could not verify or save order', { status: 502 });
  }
};

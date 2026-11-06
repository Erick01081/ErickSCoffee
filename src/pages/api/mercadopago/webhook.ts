import type { APIRoute } from 'astro';
import {
  MP_ACCESS_TOKEN,
  MP_ENVIRONMENT,
  MP_WEBHOOK_SECRET,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from 'astro:env/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

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
    `${supabaseRestUrl('mercadopago_orders')}?on_conflict=mercadopago_order_id`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase insert failed (${response.status}): ${error.slice(0, 300)}`);
  }
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
  if (type && type !== 'order') return new Response(null, { status: 200 });

  const dataId = url.searchParams.get('data.id') || url.searchParams.get('id') || String(body.data?.id || '');
  if (!/^[A-Z0-9-]{8,100}$/i.test(dataId)) return new Response('Invalid order id', { status: 400 });
  if (!hasValidSignature(request.headers.get('x-signature'), request.headers.get('x-request-id'), dataId, MP_WEBHOOK_SECRET)) {
    return new Response('Invalid signature', { status: 401 });
  }

  try {
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
    console.info('Mercado Pago order notification verified', { orderId: dataId, status: order.status, statusDetail: order.status_detail });
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error('Could not verify or save Mercado Pago order', error);
    return new Response('Could not verify or save order', { status: 502 });
  }
};

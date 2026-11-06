import type { APIRoute } from 'astro';
import { MP_ACCESS_TOKEN, MP_ENVIRONMENT, MP_WEBHOOK_SECRET } from 'astro:env/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const prerender = false;

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
  if (!MP_WEBHOOK_SECRET || !MP_ACCESS_TOKEN || !['test', 'production'].includes(MP_ENVIRONMENT || '')) {
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
    // Keep logs minimal; the seller's Mercado Pago account remains the order system of record.
    console.info('Mercado Pago order notification verified', { orderId: dataId, status: order.status, statusDetail: order.status_detail });
    return new Response(null, { status: 200 });
  } catch {
    return new Response('Could not verify order', { status: 502 });
  }
};

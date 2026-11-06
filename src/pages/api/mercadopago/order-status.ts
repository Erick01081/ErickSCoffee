import type { APIRoute } from 'astro';
import { MP_ACCESS_TOKEN, MP_ENVIRONMENT } from 'astro:env/server';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const orderId = url.searchParams.get('order_id') || '';
  if (!/^[A-Z0-9-]{8,100}$/i.test(orderId)) {
    return Response.json({ status: 'unknown' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!MP_ACCESS_TOKEN || !['test', 'production'].includes(MP_ENVIRONMENT || '')) {
    return Response.json({ status: 'unknown' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      return Response.json({ status: 'unknown' }, { status: response.status === 404 ? 404 : 502, headers: { 'Cache-Control': 'no-store' } });
    }

    const order = await response.json();
    const expectedLiveMode = MP_ENVIRONMENT === 'production';
    if (typeof order.live_mode === 'boolean' && order.live_mode !== expectedLiveMode) {
      return Response.json({ status: 'unknown' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    const status = order.status === 'processed' && order.status_detail === 'accredited'
      ? 'paid'
      : order.status === 'processed' && order.status_detail === 'refunded'
        ? 'refunded'
        : order.status === 'failed' || ['cancelled', 'canceled', 'rejected'].includes(String(order.status).toLowerCase())
          ? 'rejected'
          : 'pending';
    return Response.json({ status, orderId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ status: 'unknown' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
};

import { RESEND_API_KEY, EMAIL_FROM } from 'astro:env/server';

export type SendResult = { ok: true } | { ok: false; error: string };

type Message = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Resend ignora reenvíos con la misma clave durante 24 h: evita correos duplicados. */
  idempotencyKey?: string;
};

const EMAIL_PATTERN = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
export const isEmail = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 160 && EMAIL_PATTERN.test(value.trim());

export const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export const cop = (value: number) => '$' + Math.round(value).toLocaleString('es-CO');

/** Nunca lanza: un fallo de correo no debe romper un pedido ni un pago. */
export async function sendEmail(message: Message): Promise<SendResult> {
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    console.warn('Email not configured: set RESEND_API_KEY and EMAIL_FROM');
    return { ok: false, error: 'Email not configured' };
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        ...(message.idempotencyKey ? { 'Idempotency-Key': message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      console.error('Resend rejected the email', response.status, detail);
      return { ok: false, error: `Resend ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    console.error('Could not reach Resend', error);
    return { ok: false, error: 'Network error' };
  }
}

// ---------------------------------------------------------------------------
// Plantilla base: mismos colores que el sitio (noche, crema, verde, sol).
// Tablas e inline CSS porque los clientes de correo ignoran casi todo lo demás.
// ---------------------------------------------------------------------------
const colors = { night: '#0c0c0c', cream: '#efe6d2', ink: '#1a120d', green: '#0e6b4a', sun: '#f7b32b', sand: '#ded4bd' };

export function layoutEmail(opts: { preheader: string; title: string; body: string; footer?: string }) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${colors.cream};color:${colors.ink};font-family:Arial,Helvetica,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.cream};"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
    <tr><td style="background:${colors.night};padding:20px 28px;border-radius:16px 16px 0 0;">
      <span style="font-family:Georgia,serif;font-size:22px;font-weight:bold;letter-spacing:1px;color:${colors.cream};">ØPPOSITE</span>
    </td></tr>
    <tr><td style="background:#fffaf0;padding:28px;border-radius:0 0 16px 16px;">
      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;line-height:1.2;color:${colors.ink};">${escapeHtml(opts.title)}</h1>
      ${opts.body}
    </td></tr>
    <tr><td style="padding:16px 8px;text-align:center;font-size:12px;line-height:1.5;color:#5a5046;">${opts.footer ?? 'ØPPOSITE · Café para descubrir · Colombia'}</td></tr>
  </table>
</td></tr></table></body></html>`;
}

const row = (label: string, value: string) =>
  `<tr><td style="padding:6px 12px 6px 0;font-size:14px;color:#5a5046;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:14px;color:${colors.ink};">${value}</td></tr>`;

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------
export type OrderItem = { title: string; quantity: number; unit_price: number; amount: number };
export type OrderSummary = {
  reference: string;
  channel: 'mercadopago' | 'whatsapp';
  /** pending = pedido iniciado, sin pago confirmado; paid = pago aprobado; whatsapp = a coordinar por WhatsApp */
  state: 'pending' | 'paid' | 'whatsapp';
  buyer: { name?: string; email?: string; phone?: string; identification?: string; department?: string; city?: string; address?: string };
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  shippingFee?: number;
  shippingPayment: 'prepaid' | 'on_delivery';
  total: number;
};

const shortRef = (reference: string) => reference.slice(0, 8).toUpperCase();

function itemsTable(order: OrderSummary) {
  const lines = order.items.map(item =>
    `<tr>
      <td style="padding:10px 0;border-bottom:1px solid ${colors.sand};font-size:14px;">${escapeHtml(item.title)}<br><span style="color:#5a5046;font-size:13px;">${item.quantity} × ${cop(item.unit_price)}</span></td>
      <td align="right" style="padding:10px 0 10px 12px;border-bottom:1px solid ${colors.sand};font-size:14px;white-space:nowrap;">${cop(item.amount)}</td>
    </tr>`).join('');
  const shippingLabel = order.shippingPayment === 'on_delivery'
    ? `Envío (se paga al recibir${order.shippingFee ? `: ${cop(order.shippingFee)}` : ''})`
    : order.state === 'whatsapp' ? 'Envío (por acordar)' : 'Envío';
  const shippingValue = order.shippingPayment === 'on_delivery' || order.state === 'whatsapp' ? '—' : cop(order.shipping);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
    ${lines}
    <tr><td style="padding:10px 0 4px;font-size:14px;color:#5a5046;">Productos</td><td align="right" style="padding:10px 0 4px 12px;font-size:14px;">${cop(order.subtotal)}</td></tr>
    <tr><td style="padding:4px 0;font-size:14px;color:#5a5046;">${escapeHtml(shippingLabel)}</td><td align="right" style="padding:4px 0 4px 12px;font-size:14px;">${shippingValue}</td></tr>
    <tr><td style="padding:10px 0 0;font-size:16px;font-weight:bold;">Total${order.state === 'paid' ? ' pagado' : ''}</td><td align="right" style="padding:10px 0 0 12px;font-size:16px;font-weight:bold;">${cop(order.total)}</td></tr>
  </table>`;
}

function deliveryBlock(order: OrderSummary) {
  const b = order.buyer;
  const place = [b.city, b.department].filter(Boolean).join(', ');
  const rows = [
    b.name ? row('Nombre', escapeHtml(b.name)) : '',
    b.email ? row('Correo', escapeHtml(b.email)) : '',
    b.phone ? row('Teléfono', escapeHtml(b.phone)) : '',
    b.identification ? row('Cédula', escapeHtml(b.identification)) : '',
    b.address ? row('Dirección', escapeHtml(b.address)) : '',
    place ? row('Ciudad', escapeHtml(place)) : '',
  ].join('');
  return rows ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0;">${rows}</table>` : '';
}

const orderText = (order: OrderSummary) => [
  ...order.items.map(item => `- ${item.quantity} x ${item.title} = ${cop(item.amount)}`),
  `Productos: ${cop(order.subtotal)}`,
  order.shippingPayment === 'on_delivery' ? 'Envío: se paga al recibir' : order.state === 'whatsapp' ? 'Envío: por acordar' : `Envío: ${cop(order.shipping)}`,
  `Total: ${cop(order.total)}`,
].join('\n');

const heading = (text: string) => `<h2 style="margin:24px 0 4px;font-family:Georgia,serif;font-size:17px;color:${colors.green};">${escapeHtml(text)}</h2>`;

/** Correo para ti: todo lo que necesitas para despachar. */
export function ownerOrderEmail(order: OrderSummary) {
  const stateLabel = { paid: 'Pago confirmado', pending: 'Pendiente de pago', whatsapp: 'Pedido por WhatsApp' }[order.state];
  const intro = {
    paid: 'Mercado Pago confirmó el pago. Ya puedes preparar este pedido.',
    pending: 'El cliente llegó a Mercado Pago, pero el pago aún no está confirmado. Te escribiremos de nuevo cuando se apruebe.',
    whatsapp: 'El cliente envió este pedido y lo está coordinando contigo por WhatsApp. El pago y el envío quedan por acordar.',
  }[order.state];
  const body = `
    <p style="margin:0 0 8px;font-size:15px;line-height:1.5;">${escapeHtml(intro)}</p>
    ${heading('Productos')}${itemsTable(order)}
    ${heading('Cliente y entrega')}${deliveryBlock(order)}
    <p style="margin:20px 0 0;font-size:12px;color:#5a5046;">Referencia: ${escapeHtml(order.reference)}</p>`;
  return {
    subject: `[${stateLabel}] Pedido ${shortRef(order.reference)} · ${order.buyer.name || 'Cliente'} · ${cop(order.total)}`,
    html: layoutEmail({ preheader: `${order.buyer.name || 'Un cliente'} · ${cop(order.total)}`, title: `Nuevo pedido: ${stateLabel.toLowerCase()}`, body }),
    text: `${stateLabel}\n\n${orderText(order)}\n\nCliente: ${order.buyer.name || '-'} · ${order.buyer.email || '-'} · ${order.buyer.phone || '-'}\nCédula: ${order.buyer.identification || '-'}\nEntrega: ${[order.buyer.address, order.buyer.city, order.buyer.department].filter(Boolean).join(', ') || 'por acordar'}\nReferencia: ${order.reference}`,
  };
}

/** Correo para el cliente: el mismo detalle del pedido, en tono de confirmación. */
export function customerOrderEmail(order: OrderSummary, shippingNote: string) {
  const firstName = (order.buyer.name || '').split(/\s+/)[0];
  const lead = order.state === 'paid'
    ? 'Recibimos tu pago y tu pedido ya está en preparación.'
    : 'Recibimos tu pedido. Te escribiremos por WhatsApp para acordar el pago y el envío.';
  const body = `
    <p style="margin:0 0 8px;font-size:15px;line-height:1.5;">${firstName ? `Hola, ${escapeHtml(firstName)}. ` : ''}${escapeHtml(lead)}</p>
    ${heading('Tu pedido')}${itemsTable(order)}
    ${heading('Entrega')}${deliveryBlock(order)}
    <p style="margin:16px 0 0;font-size:14px;line-height:1.5;">${escapeHtml(shippingNote)}</p>
    <p style="margin:16px 0 0;font-size:14px;line-height:1.5;">Si algo no está bien, responde este correo o escríbenos por WhatsApp.</p>
    <p style="margin:20px 0 0;font-size:12px;color:#5a5046;">Pedido ${escapeHtml(shortRef(order.reference))}</p>`;
  return {
    subject: order.state === 'paid' ? `Pago confirmado · Pedido ${shortRef(order.reference)} · ØPPOSITE` : `Recibimos tu pedido · ØPPOSITE`,
    html: layoutEmail({ preheader: lead, title: order.state === 'paid' ? '¡Gracias por tu pedido!' : 'Recibimos tu pedido', body }),
    text: `${lead}\n\n${orderText(order)}\n\n${shippingNote}\n\nPedido ${shortRef(order.reference)}`,
  };
}

// ---------------------------------------------------------------------------
// Trabaja con nosotros
// ---------------------------------------------------------------------------
export type Application = {
  name: string; email: string; phone: string; city: string; area: string; link: string; message: string;
};

export function applicationEmail(app: Application) {
  const link = /^https?:\/\//i.test(app.link)
    ? `<a href="${escapeHtml(app.link)}" style="color:${colors.green};">${escapeHtml(app.link)}</a>`
    : escapeHtml(app.link || 'No compartió enlace');
  const body = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      ${row('Nombre', escapeHtml(app.name))}
      ${row('Correo', `<a href="mailto:${escapeHtml(app.email)}" style="color:${colors.green};">${escapeHtml(app.email)}</a>`)}
      ${row('Teléfono', escapeHtml(app.phone || 'No lo compartió'))}
      ${row('Ciudad', escapeHtml(app.city))}
      ${row('Área de interés', escapeHtml(app.area))}
      ${row('Enlace', link)}
    </table>
    ${heading('Lo que cuenta')}
    <p style="margin:6px 0 0;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(app.message)}</p>
    <p style="margin:20px 0 0;font-size:12px;color:#5a5046;">Puedes responder este correo para escribirle directamente.</p>`;
  return {
    subject: `Postulación · ${app.area} · ${app.name}`,
    html: layoutEmail({ preheader: `${app.name} quiere trabajar con ustedes`, title: 'Nueva postulación', body }),
    text: `Nueva postulación\n\nNombre: ${app.name}\nCorreo: ${app.email}\nTeléfono: ${app.phone || '-'}\nCiudad: ${app.city}\nÁrea: ${app.area}\nEnlace: ${app.link || '-'}\n\n${app.message}`,
  };
}

export function applicationReceiptEmail(app: Application) {
  const firstName = app.name.split(/\s+/)[0];
  const body = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hola, ${escapeHtml(firstName)}. Recibimos tu postulación para el área de ${escapeHtml(app.area.toLowerCase())}.</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Leemos cada mensaje con calma. Si hay una conversación posible, te escribimos a este correo.</p>`;
  return {
    subject: 'Recibimos tu postulación · ØPPOSITE',
    html: layoutEmail({ preheader: 'Gracias por querer trabajar con nosotros.', title: 'Gracias por escribirnos', body }),
    text: `Hola, ${firstName}. Recibimos tu postulación para el área de ${app.area.toLowerCase()}. Leemos cada mensaje con calma; si hay una conversación posible, te escribimos a este correo.`,
  };
}

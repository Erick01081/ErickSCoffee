import type { APIRoute } from 'astro';
import { JOBS_NOTIFY_EMAIL, ORDER_NOTIFY_EMAIL } from 'astro:env/server';
import { applicationEmail, applicationReceiptEmail, isEmail, sendEmail, type Application } from '../../lib/email';
import { jobAreas } from '../../data/jobs';

export const prerender = false;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\r/g, '').trim().slice(0, max) : '');

export const POST: APIRoute = async ({ request }) => {
  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return json({ error: 'No pudimos leer tu postulación. Vuelve a intentarlo.' }, 400); }

  // Campo trampa para bots: las personas no lo ven ni lo llenan. Respondemos "ok" sin enviar nada.
  if (clean(input.website, 200)) return json({ ok: true });

  const app: Application = {
    name: clean(input.name, 100).replace(/\s+/g, ' '),
    email: clean(input.email, 160),
    phone: clean(input.phone, 30),
    city: clean(input.city, 100),
    area: clean(input.area, 80),
    link: clean(input.link, 300),
    message: clean(input.message, 3000),
  };

  const errors: Record<string, string> = {};
  if (!app.name) errors.name = 'Escribe tu nombre completo.';
  if (!isEmail(app.email)) errors.email = 'Escribe un correo como nombre@correo.com.';
  if (!app.city) errors.city = 'Escribe la ciudad donde vives.';
  if (!jobAreas.includes(app.area)) errors.area = 'Elige el área que más te interesa.';
  if (app.message.length < 30) errors.message = 'Cuéntanos un poco más: escribe al menos 30 caracteres.';
  if (app.link && !/^https?:\/\/\S+$/i.test(app.link)) errors.link = 'Pega un enlace completo que empiece por https://.';
  if (app.phone && app.phone.replace(/\D/g, '').length < 7) errors.phone = 'Escribe un teléfono con al menos 7 dígitos.';
  if (input.consent !== true) errors.consent = 'Necesitamos tu autorización para poder contactarte.';
  if (Object.keys(errors).length) return json({ error: 'Revisa los campos marcados.', errors }, 400);

  const to = (JOBS_NOTIFY_EMAIL || ORDER_NOTIFY_EMAIL || '').split(',').map(v => v.trim()).filter(isEmail);
  if (!to.length) {
    console.error('JOBS_NOTIFY_EMAIL / ORDER_NOTIFY_EMAIL is not configured');
    return json({ error: 'No pudimos recibir tu postulación en este momento. Escríbenos por WhatsApp.' }, 503);
  }

  const result = await sendEmail({ to, ...applicationEmail(app), replyTo: app.email });
  if (!result.ok) return json({ error: 'No pudimos enviar tu postulación. Tus datos siguen en el formulario: inténtalo de nuevo en un momento.' }, 502);

  // Acuse de recibo: si falla no afecta la postulación.
  await sendEmail({ to: app.email, ...applicationReceiptEmail(app), replyTo: to[0] }).catch(() => {});
  return json({ ok: true });
};

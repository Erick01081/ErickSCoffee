import type { APIRoute } from 'astro';
import { MP_ACCESS_TOKEN, MP_ENVIRONMENT, PUBLIC_SITE_URL } from 'astro:env/server';
import { randomUUID } from 'node:crypto';
import { products } from '../../../data/products';
import { colombianDepartments, shippingPrice } from '../../../data/locations';

export const prerender = false;

const grindNames: Record<string, string> = {
  bean: 'Grano entero',
  fine: 'Molienda fina para espresso',
  medium: 'Molienda media para V60, AeroPress u Origami',
  coarse: 'Molienda gruesa para prensa francesa',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export const POST: APIRoute = async ({ request, url }) => {
  if (!['test', 'production'].includes(MP_ENVIRONMENT || '')) {
    return json({ error: 'Configura MP_ENVIRONMENT como test o production en el entorno de despliegue.' }, 503);
  }

  const accessToken = MP_ACCESS_TOKEN;
  if (!accessToken) return json({ error: 'Falta configurar MP_ACCESS_TOKEN en el entorno de despliegue.' }, 503);

  let input: {
    items?: Array<{ key?: unknown; quantity?: unknown }>;
    buyer?: {
      name?: unknown;
      email?: unknown;
      department?: unknown;
      city?: unknown;
      address?: unknown;
      phone?: unknown;
      identification?: unknown;
    };
  };
  try {
    input = await request.json();
  } catch {
    return json({ error: 'No pudimos leer el pedido. Vuelve a intentarlo.' }, 400);
  }

  const name = typeof input.buyer?.name === 'string' ? input.buyer.name.trim().slice(0, 100) : '';
  const email = typeof input.buyer?.email === 'string' ? input.buyer.email.trim().slice(0, 160) : '';
  const department = typeof input.buyer?.department === 'string' ? input.buyer.department.trim() : '';
  const city = typeof input.buyer?.city === 'string' ? input.buyer.city.trim().slice(0, 100) : '';
  const address = typeof input.buyer?.address === 'string' ? input.buyer.address.trim().slice(0, 200) : '';
  const phone = typeof input.buyer?.phone === 'string' ? input.buyer.phone.trim().slice(0, 30) : '';
  const identification = typeof input.buyer?.identification === 'string' ? input.buyer.identification.trim().slice(0, 30) : '';
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Escribe tu nombre y un correo válido para continuar.' }, 400);
  }
  if (!colombianDepartments.includes(department) || !city) {
    return json({ error: 'Selecciona un departamento y escribe tu ciudad o municipio.' }, 400);
  }
  const phoneDigits = phone.replace(/\D/g, '');
  const identificationDigits = identification.replace(/\D/g, '');
  if (!address || phoneDigits.length < 7 || phoneDigits.length > 15 || identificationDigits.length < 5 || identificationDigits.length > 15) {
    return json({ error: 'Escribe una dirección, un teléfono y una cédula válidos.' }, 400);
  }
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20) {
    return json({ error: 'El carrito no tiene productos válidos.' }, 400);
  }

  const orderItems: Array<{ title: string; quantity: number; unit_price: string }> = [];
  let total = 0;

  for (const entry of input.items) {
    if (typeof entry.key !== 'string' || !Number.isInteger(entry.quantity) || Number(entry.quantity) < 1 || Number(entry.quantity) > 10) {
      return json({ error: 'Hay un producto o una cantidad inválida en el carrito.' }, 400);
    }

    const [productId, selectedSize, selectedGrind, ...extra] = entry.key.split('::');
    if (extra.length) return json({ error: 'Hay una presentación inválida en el carrito.' }, 400);
    const product = products.find(item => item.id === productId);
    if (!product) return json({ error: 'No encontramos uno de los productos del carrito.' }, 400);

    const quantity = Number(entry.quantity);
    let unitPrice = product.price;
    let title = product.name;

    if (product.category === 'cafe') {
      const size = selectedSize || '250';
      const grind = selectedGrind || 'bean';
      if (!['250', '340'].includes(size) || !(grind in grindNames)) {
        return json({ error: 'Revisa el tamaño y la molienda elegidos para cada café.' }, 400);
      }
      if (size === '340') unitPrice = product.price340 ?? product.price;
      title = `${product.name} · ${size} g · ${grindNames[grind]}`;
    } else if (selectedSize || selectedGrind) {
      return json({ error: 'La presentación de uno de los productos no es válida.' }, 400);
    }

    total += unitPrice * quantity;
    orderItems.push({
      title,
      quantity,
      unit_price: String(unitPrice),
    });
  }

  const deliveryFee = shippingPrice(department, city);
  total += deliveryFee;
  orderItems.push({
    title: `Envío a ${city}, ${department}`,
    quantity: 1,
    unit_price: String(deliveryFee),
  });

  const firstName = name.split(/\s+/)[0];
  const lastName = name.split(/\s+/).slice(1).join(' ') || undefined;
  const siteUrl = (PUBLIC_SITE_URL || url.origin).replace(/\/$/, '');
  const payload = {
    type: 'online',
    processing_mode: 'manual',
    total_amount: String(total),
    external_reference: randomUUID(),
    description: `Pedido ØPPOSITE con envío a ${city}, ${department}.`,
    payer: {
      email,
      first_name: firstName,
      ...(lastName ? { last_name: lastName } : {}),
      phone: { area_code: '57', number: phoneDigits },
      identification: { type: 'CC', number: identificationDigits },
      address: { street_name: address, city_name: city, state_name: department },
    },
    items: orderItems,
    config: {
      online: {
        success_url: `${siteUrl}/pago?resultado=aprobado`,
        failure_url: `${siteUrl}/pago?resultado=rechazado`,
        pending_url: `${siteUrl}/pago?resultado=pendiente`,
        auto_return: 'approved',
      },
    },
  };

  let response: Response;
  try {
    response = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return json({ error: 'No pudimos conectar con Mercado Pago. Inténtalo de nuevo.' }, 502);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.checkout_url !== 'string') {
    console.error('Mercado Pago order creation failed', response.status, JSON.stringify({ error: result.error, message: result.message, cause: result.cause, errors: result.errors }));
    return json({ error: 'Mercado Pago no pudo iniciar el pago. Revisa los datos e inténtalo otra vez.' }, 502);
  }

  return json({ checkoutUrl: result.checkout_url });
};

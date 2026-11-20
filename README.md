# Preventa de café (Astro)

    npm install
    npm run dev      # http://localhost:4321
    npm run build    # genera /dist

- Datos de tu tienda (marca, WhatsApp, fecha de cierre): `src/data/config.ts`
- Productos y precios (placeholders): `src/data/products.ts`
- Imágenes: `public/img/` (cámbialas por tus fotos o mockups finales)
- El pedido se puede enviar por WhatsApp o pagar con Mercado Pago Checkout Pro. El servidor crea la orden con precios calculados desde el catálogo y el token nunca se expone al navegador.
- Para probar Mercado Pago en local, copia `.env.example` a `.env.local` y configura `MP_ENVIRONMENT=test` y `MP_ACCESS_TOKEN` con credenciales de prueba de vendedor. En Vercel producción configura `MP_ENVIRONMENT=production`, el Access Token de producción en `MP_ACCESS_TOKEN`, y `PUBLIC_SITE_URL` con el dominio HTTPS final. No configures Public Key, Client ID ni Client Secret para este flujo de órdenes.
- En Mercado Pago, configura una notificación Webhook para eventos de órdenes apuntando a `https://tu-dominio/api/mercadopago/webhook`. Guarda la clave secreta del webhook en Vercel como `MP_WEBHOOK_SECRET` en Production. Usa la URL de producción en la configuración de producción de Mercado Pago y vuelve a desplegar después de añadir o cambiar variables.
- Para guardar los pedidos, ejecuta `supabase/schema.sql` en el SQL Editor de Supabase. En Vercel agrega `SUPABASE_URL` con la URL base del proyecto (por ejemplo, `https://tu-proyecto.supabase.co`) y `SUPABASE_SERVICE_ROLE_KEY` con la clave secreta; no uses ninguna de las dos en variables `PUBLIC_` ni en el navegador. Al iniciar el checkout se guardan en `checkout_data` los productos, cantidades, presentación, precios, subtotal, envío y todos los datos del formulario del carrito. El webhook enlaza esa fila con la orden verificada mediante `external_reference`; los reintentos no duplican pedidos.
- Al volver del checkout, `/pago` consulta `/api/mercadopago/order-status` y confirma el pago solo cuando Mercado Pago devuelve el estado acreditado. La página de estado verifica el pago; Supabase conserva la orden completa recibida por webhook y el panel de Mercado Pago sigue siendo el registro de ventas.
- Para pagar con Mercado Pago, el comprador informa nombre, correo, dirección, teléfono, cédula, departamento y ciudad o municipio. Dirección, teléfono e identificación se envían al `payer` de Mercado Pago; el envío se calcula automáticamente: $6.000 para Bogotá D. C. y $15.000 para el resto del país, incluido en el total. Por WhatsApp puede enviar solo el pedido y acordar después el destino, costo y forma de envío.
# ErickSCoffee

## Correos de pedidos y postulaciones

Los correos salen con [Resend](https://resend.com) (sin dependencias extra). Variables en Vercel (Production):

- `RESEND_API_KEY`, `EMAIL_FROM` (con un dominio verificado en Resend, p. ej. `ØPPOSITE <pedidos@tudominio.com>`), `ORDER_NOTIFY_EMAIL` (quién recibe los pedidos; varios separados por coma) y, opcional, `JOBS_NOTIFY_EMAIL` (postulaciones; si falta se usa `ORDER_NOTIFY_EMAIL`).
- Ejecuta de nuevo `supabase/schema.sql` (agrega `payment_data` y `confirmation_email_sent_at`).
- En Mercado Pago > Webhooks activa también el evento **Pagos** (además de órdenes) apuntando a `/api/mercadopago/webhook`.

Qué correo llega y cuándo:

| Momento | Tú | Cliente |
| --- | --- | --- |
| Entra a Mercado Pago | "Pendiente de pago" | — |
| Pago aprobado (webhook, una sola vez por pedido) | "Pago confirmado" | Confirmación con el mismo detalle |
| Pedido por WhatsApp | "Pedido por WhatsApp" | Solo si dejó su correo |
| Formulario Trabaja con nosotros | Postulación (Responder escribe al candidato) | Acuse de recibo |

## Páginas

- `/nosotros`, `/historia`, `/trabaja-con-nosotros` usan `src/layouts/Page.astro` (menú, footer y estilos compartidos).
- Fotos de la finca: copia las imágenes en `public/img/finca/` y descomenta/agrega líneas en `src/data/farm.ts`. Hasta que haya fotos la galería no se muestra en producción.
- Áreas del formulario de empleo: `src/data/jobs.ts`.

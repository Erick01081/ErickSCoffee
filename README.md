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
- Al volver del checkout, `/pago` consulta `/api/mercadopago/order-status` y confirma el pago solo cuando Mercado Pago devuelve el estado acreditado. La página de estado verifica el pago; no hay una base de datos de pedidos en este proyecto, así que el panel de Mercado Pago sigue siendo el registro de ventas y Vercel Logs permite revisar notificaciones recibidas.
- El comprador informa nombre, correo, dirección, teléfono, cédula, departamento y ciudad o municipio. Dirección, teléfono e identificación se envían al `payer` de Mercado Pago; el envío se calcula automáticamente: $6.000 para Bogotá D. C. y $15.000 para el resto del país, incluido en el total.
# ErickSCoffee

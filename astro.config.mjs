import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'static',
  adapter: vercel(),
  env: {
    schema: {
      MP_ENVIRONMENT: envField.enum({ values: ['test', 'production'], context: 'server', access: 'secret', optional: true }),
      MP_ACCESS_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      MP_WEBHOOK_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      SUPABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true, url: true }),
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      PUBLIC_SITE_URL: envField.string({ context: 'server', access: 'secret', optional: true, url: true }),
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      EMAIL_FROM: envField.string({ context: 'server', access: 'secret', optional: true }),
      ORDER_NOTIFY_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
      JOBS_NOTIFY_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});

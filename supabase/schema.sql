create table if not exists public.mercadopago_orders (
  mercadopago_order_id text primary key,
  external_reference text,
  status text,
  status_detail text,
  live_mode boolean,
  transaction_amount numeric,
  currency_id text not null default 'COP',
  payer_email text,
  payer_name text,
  payer_identification text,
  order_data jsonb not null,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mercadopago_orders enable row level security;

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
  checkout_data jsonb,
  subtotal_amount numeric,
  shipping_amount numeric,
  total_amount numeric,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mercadopago_orders add column if not exists checkout_data jsonb;
alter table public.mercadopago_orders add column if not exists subtotal_amount numeric;
alter table public.mercadopago_orders add column if not exists shipping_amount numeric;
alter table public.mercadopago_orders add column if not exists total_amount numeric;

alter table public.mercadopago_orders enable row level security;

create unique index if not exists mercadopago_orders_external_reference_key
  on public.mercadopago_orders (external_reference)
  where external_reference is not null;

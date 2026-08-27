create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_slug text not null check (plan_slug in ('start', 'pro', 'business', 'enterprise')),
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'cancelled')),
  mercado_pago_preference_id text unique,
  mercado_pago_payment_id text unique,
  amount numeric(14,2),
  currency text not null default 'BRL',
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_auth_user_id on public.subscriptions(auth_user_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.subscriptions enable row level security;

create policy "Users can read their own subscription" on public.subscriptions
for select
using (auth_user_id = auth.uid());

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions
for each row execute procedure public.handle_updated_at();
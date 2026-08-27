create extension if not exists "pgcrypto";

-- 1) Fix ambiguous memberships/users relation safely.
alter table if exists public.memberships
  drop constraint if exists memberships_invited_by_fkey;

alter table if exists public.memberships
  drop constraint if exists memberships_invited_by_user_id_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'memberships'
      AND column_name = 'invited_by'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'memberships'
      AND column_name = 'invited_by_user_id'
  ) THEN
    ALTER TABLE public.memberships
      RENAME COLUMN invited_by TO invited_by_user_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'memberships'
      AND column_name = 'invited_by_user_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.memberships'::regclass
      AND a.attname = 'invited_by_user_id'
  ) THEN
    ALTER TABLE public.memberships
      ADD CONSTRAINT memberships_invited_by_user_id_fkey
      FOREIGN KEY (invited_by_user_id)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 2) Core tenant tables
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, slug)
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  resource text not null,
  action text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role_id uuid references public.roles(id) on delete set null,
  status text not null default 'active',
  invited_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (company_id, role_id, permission_id)
);

-- 3) Helper functions
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.company_id
  from public.memberships m
  join public.users u on u.id = m.user_id
  where u.auth_user_id = auth.uid()
    and m.status = 'active'
  order by m.created_at desc
  limit 1;
$$;

create or replace function public.user_has_company_access(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.users u on u.id = m.user_id
    where u.auth_user_id = auth.uid()
      and m.company_id = p_company_id
      and m.status = 'active'
  );
$$;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 4) RLS activation
alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.memberships enable row level security;
alter table public.role_permissions enable row level security;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('companies','users','roles','permissions','memberships','role_permissions')
  LOOP
    EXECUTE format('drop policy if exists %I on public.%I;', r.policyname, r.tablename);
  END LOOP;
END $$;

create policy "Users can create their own company" on public.companies
for insert
with check (auth.uid() is not null);

create policy "Company members can read company" on public.companies
for select
using (public.user_has_company_access(id));

create policy "Company members can update company" on public.companies
for update
using (public.user_has_company_access(id))
with check (public.user_has_company_access(id));

create policy "Users can read own company users" on public.users
for select
using (company_id = public.current_company_id());

create policy "Users can create own profile" on public.users
for insert
with check (auth_user_id = auth.uid() and company_id is not null);

create policy "Users can update own profile" on public.users
for update
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid() and company_id = public.current_company_id());

create policy "Users can read their memberships" on public.memberships
for select
using (company_id = public.current_company_id());

create policy "Users can create own membership" on public.memberships
for insert
with check (
  company_id = public.current_company_id()
  and user_id = (
    select id
    from public.users
    where auth_user_id = auth.uid()
    limit 1
  )
);

create policy "Company members can manage memberships" on public.memberships
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read roles" on public.roles
for select
using (company_id = public.current_company_id());

create policy "Company members can manage roles" on public.roles
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read permissions" on public.permissions
for select
using (company_id = public.current_company_id());

create policy "Company admins can manage permissions" on public.permissions
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read role_permissions" on public.role_permissions
for select
using (company_id = public.current_company_id());

create policy "Company admins can manage role_permissions" on public.role_permissions
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

-- 5) Seed default roles and permissions
insert into public.companies (id, name, slug)
values (gen_random_uuid(), 'Nexo Demo', 'nexo-demo')
on conflict (slug) do nothing;

with company_seed as (
  select id
  from public.companies
  where slug = 'nexo-demo'
  limit 1
)
insert into public.roles (id, company_id, name, slug, description, is_system)
select gen_random_uuid(), c.id, v.name, v.slug, v.description, true
from company_seed c
cross join (
  values
    ('Administrador', 'admin', 'Acesso total ao sistema.'),
    ('Gerente', 'manager', 'Gerencia operações e pessoas.'),
    ('Colaborador', 'employee', 'Acesso operacional comum.'),
    ('Visualizador', 'viewer', 'Leitura apenas.')
) as v(name, slug, description)
on conflict (company_id, slug) do nothing;

with company_seed as (
  select id
  from public.companies
  where slug = 'nexo-demo'
  limit 1
), role_map as (
  select id, slug
  from public.roles
  where company_id = (select id from company_seed)
)
insert into public.permissions (id, company_id, name, resource, action, description)
select gen_random_uuid(), c.id, v.name, v.resource, v.action, v.description
from company_seed c
cross join (
  values
    ('companies.read', 'companies', 'read', 'Permite visualizar a empresa.'),
    ('companies.write', 'companies', 'write', 'Permite alterar a empresa.'),
    ('users.read', 'users', 'read', 'Permite visualizar usuários.'),
    ('users.write', 'users', 'write', 'Permite gerenciar usuários.'),
    ('memberships.read', 'memberships', 'read', 'Permite visualizar vínculos.'),
    ('memberships.write', 'memberships', 'write', 'Permite gerenciar vínculos.'),
    ('roles.read', 'roles', 'read', 'Permite visualizar funções.'),
    ('roles.write', 'roles', 'write', 'Permite gerenciar funções.'),
    ('permissions.read', 'permissions', 'read', 'Permite visualizar permissões.'),
    ('permissions.write', 'permissions', 'write', 'Permite gerenciar permissões.')
) as v(name, resource, action, description)
on conflict (company_id, name) do nothing;

-- 6) Assign all permissions to admin role
with company_seed as (
  select id
  from public.companies
  where slug = 'nexo-demo'
  limit 1
), admin_role as (
  select id
  from public.roles
  where company_id = (select id from company_seed)
    and slug = 'admin'
  limit 1
), perms as (
  select p.id, p.company_id
  from public.permissions p
  where p.company_id = (select id from company_seed)
)
insert into public.role_permissions (id, company_id, role_id, permission_id)
select gen_random_uuid(), p.company_id, a.id, p.id
from perms p
cross join admin_role a
on conflict (company_id, role_id, permission_id) do nothing;
-- Subscriptions table (integração de pagamento / Mercado Pago)
-- Esta tabela já existe no banco "Nexo" mas não estava em nenhum dos
-- arquivos de migration versionados. Este script é idempotente
-- (safe to re-run) e replica exatamente a estrutura + policies atuais.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_slug text not null check (plan_slug in ('start', 'pro', 'business', 'enterprise')),
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'cancelled')),
  mercado_pago_preference_id text unique,
  mercado_pago_payment_id text unique,
  amount numeric,
  currency text not null default 'BRL',
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_auth_user_id
  on public.subscriptions(auth_user_id);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read own subscription" on public.subscriptions;
drop policy if exists "Users can create own subscription" on public.subscriptions;
drop policy if exists "Users can update own subscription" on public.subscriptions;

create policy "Users can read own subscription" on public.subscriptions
for select
using (auth_user_id = auth.uid());

create policy "Users can create own subscription" on public.subscriptions
for insert
with check (auth_user_id = auth.uid());

create policy "Users can update own subscription" on public.subscriptions
for update
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

-- Mantém updated_at em dia, reaproveitando a função já criada
-- nas migrations do multi-tenant (public.handle_updated_at).
drop trigger if exists subscriptions_updated_at on public.subscriptions;

create trigger subscriptions_updated_at
before update on public.subscriptions
for each row execute procedure public.handle_updated_at();

-- Garante que a API REST enxergue a tabela imediatamente.
notify pgrst, 'reload schema';
-- Garante que TODA conta criada seja designada como "Proprietário" (owner),
-- direto no banco — independente do código da aplicação.
-- Safe to re-run (idempotente).

-- 1) Toda empresa nova já nasce com o papel "Proprietário".
create or replace function public.seed_owner_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.roles (company_id, name, slug, description, is_system)
  values (new.id, 'Proprietário', 'owner', 'Acesso total, dono da conta.', true)
  on conflict (company_id, slug) do nothing;

  return new;
end;
$$;

drop trigger if exists companies_seed_owner_role on public.companies;

create trigger companies_seed_owner_role
after insert on public.companies
for each row execute procedure public.seed_owner_role();

-- 2) Todo membership criado sem role_id explícito recebe automaticamente
-- o papel "Proprietário" da empresa. Se a empresa ainda não tiver esse
-- papel (ex: criada antes deste trigger existir), ele é criado na hora.
create or replace function public.default_membership_role_to_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_role_id uuid;
begin
  if new.role_id is null then
    select id into v_owner_role_id
    from public.roles
    where company_id = new.company_id
      and slug = 'owner'
    limit 1;

    if v_owner_role_id is null then
      insert into public.roles (company_id, name, slug, description, is_system)
      values (new.company_id, 'Proprietário', 'owner', 'Acesso total, dono da conta.', true)
      on conflict (company_id, slug) do nothing
      returning id into v_owner_role_id;

      if v_owner_role_id is null then
        select id into v_owner_role_id
        from public.roles
        where company_id = new.company_id
          and slug = 'owner'
        limit 1;
      end if;
    end if;

    new.role_id := v_owner_role_id;
  end if;

  return new;
end;
$$;

drop trigger if exists memberships_default_owner_role on public.memberships;

create trigger memberships_default_owner_role
before insert on public.memberships
for each row execute procedure public.default_membership_role_to_owner();

-- 3) Backfill: garante que toda empresa já existente tenha o papel Proprietário.
insert into public.roles (company_id, name, slug, description, is_system)
select c.id, 'Proprietário', 'owner', 'Acesso total, dono da conta.', true
from public.companies c
on conflict (company_id, slug) do nothing;

notify pgrst, 'reload schema';
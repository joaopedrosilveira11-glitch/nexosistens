-- NEXO multi-tenant schema for Supabase
-- Prepared for secure tenant isolation across all business tables.

create extension if not exists "pgcrypto";

-- Remove any stale foreign-key metadata that causes the ambiguous
-- memberships -> users relationship in Supabase Studio.
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
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
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

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  manager_user_id uuid references public.users(id),
  parent_department_id uuid references public.departments(id),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null unique references public.users(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  position text,
  employee_code text,
  hire_date date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  legal_name text,
  document text,
  email text,
  phone text,
  segment text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  name text not null,
  email text,
  phone text,
  source text,
  status text not null default 'new',
  score integer not null default 0,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  name text not null,
  stage text not null default 'lead',
  amount numeric(14,2) not null default 0,
  probability integer not null default 0,
  expected_close_date date,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  parent_category_id uuid references public.product_categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid references public.product_categories(id) on delete set null,
  sku text not null,
  name text not null,
  description text,
  unit_price numeric(14,2) not null default 0,
  cost_price numeric(14,2) not null default 0,
  stock_quantity numeric(14,2) not null default 0,
  min_stock_quantity numeric(14,2) not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, sku)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  order_number text not null,
  status text not null default 'draft',
  total_amount numeric(14,2) not null default 0,
  payment_status text not null default 'pending',
  requested_delivery_date date,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, order_number)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(14,2) not null default 0,
  unit_price numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  quote_number text not null,
  status text not null default 'draft',
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  valid_until date,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, quote_number)
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(14,2) not null default 0,
  unit_price numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo',
  priority text not null default 'medium',
  due_date date,
  assignee_user_id uuid references public.users(id),
  related_order_id uuid references public.orders(id) on delete set null,
  related_customer_id uuid references public.customers(id) on delete set null,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id),
  comment text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.procedures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  category text,
  version text,
  responsible_user_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.procedure_steps (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  step_number integer not null default 1,
  title text not null,
  instructions text,
  created_at timestamptz not null default now(),
  unique (company_id, procedure_id, step_number)
);

create table if not exists public.production_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  product_id uuid references public.products(id) on delete restrict,
  quantity numeric(14,2) not null default 0,
  status text not null default 'queued',
  start_date date,
  due_date date,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null unique references public.products(id) on delete restrict,
  location text,
  available_quantity numeric(14,2) not null default 0,
  reserved_quantity numeric(14,2) not null default 0,
  min_quantity numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  movement_type text not null check (movement_type in ('inbound', 'outbound', 'adjustment', 'reserved')),
  quantity numeric(14,2) not null default 0,
  reference text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  company_name text,
  email text,
  phone text,
  address text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  purchase_number text not null,
  status text not null default 'draft',
  total_amount numeric(14,2) not null default 0,
  requested_date date,
  expected_delivery_date date,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, purchase_number)
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(14,2) not null default 0,
  unit_price numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('income', 'expense', 'receivable', 'payable')),
  description text not null,
  amount numeric(14,2) not null default 0,
  due_date date,
  category text,
  reference text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  payment_method text,
  payment_status text not null default 'pending',
  amount numeric(14,2) not null default 0,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  title text not null,
  body text not null,
  channel text not null default 'in_app',
  notification_type text not null default 'info',
  is_read boolean not null default false,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.problems (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  description text,
  category text,
  priority text not null default 'medium',
  status text not null default 'open',
  source text,
  department_id uuid references public.departments(id) on delete set null,
  reported_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.problem_comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  user_id uuid not null references public.users(id),
  comment text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  file_name text not null,
  file_url text not null,
  mime_type text,
  file_size bigint,
  uploaded_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  change_summary text,
  previous_value jsonb,
  new_value jsonb,
  origin text,
  created_at timestamptz not null default now()
);

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  trigger_event text not null,
  conditions jsonb,
  actions jsonb,
  is_active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id),
  session_key text,
  title text,
  context jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  category text not null,
  title text not null,
  summary text,
  confidence numeric(5,2) default 0,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_company_id on public.users(company_id);
create index if not exists idx_users_auth_user_id on public.users(auth_user_id);
create index if not exists idx_memberships_company_id on public.memberships(company_id);
create index if not exists idx_memberships_user_id on public.memberships(user_id);
create index if not exists idx_roles_company_id on public.roles(company_id);
create index if not exists idx_permissions_company_id on public.permissions(company_id);
create index if not exists idx_role_permissions_role_id on public.role_permissions(role_id);
create index if not exists idx_departments_company_id on public.departments(company_id);
create index if not exists idx_employees_company_id on public.employees(company_id);
create index if not exists idx_customers_company_id on public.customers(company_id);
create index if not exists idx_leads_company_id on public.leads(company_id);
create index if not exists idx_opportunities_company_id on public.opportunities(company_id);
create index if not exists idx_product_categories_company_id on public.product_categories(company_id);
create index if not exists idx_products_company_id on public.products(company_id);
create index if not exists idx_orders_company_id on public.orders(company_id);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_quotes_company_id on public.quotes(company_id);
create index if not exists idx_quote_items_quote_id on public.quote_items(quote_id);
create index if not exists idx_tasks_company_id on public.tasks(company_id);
create index if not exists idx_task_comments_task_id on public.task_comments(task_id);
create index if not exists idx_procedures_company_id on public.procedures(company_id);
create index if not exists idx_production_orders_company_id on public.production_orders(company_id);
create index if not exists idx_inventory_items_company_id on public.inventory_items(company_id);
create index if not exists idx_inventory_movements_company_id on public.inventory_movements(company_id);
create index if not exists idx_suppliers_company_id on public.suppliers(company_id);
create index if not exists idx_purchase_orders_company_id on public.purchase_orders(company_id);
create index if not exists idx_purchase_items_purchase_order_id on public.purchase_items(purchase_order_id);
create index if not exists idx_financial_transactions_company_id on public.financial_transactions(company_id);
create index if not exists idx_payments_company_id on public.payments(company_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_problems_company_id on public.problems(company_id);
create index if not exists idx_problem_comments_problem_id on public.problem_comments(problem_id);
create index if not exists idx_attachments_company_id on public.attachments(company_id);
create index if not exists idx_audit_logs_company_id on public.audit_logs(company_id);
create index if not exists idx_automations_company_id on public.automations(company_id);
create index if not exists idx_ai_conversations_company_id on public.ai_conversations(company_id);
create index if not exists idx_ai_insights_company_id on public.ai_insights(company_id);

-- NOTA: estas funções usam "language plpgsql" (em vez de "language sql")
-- de propósito. Funções SQL simples são candidatas a "inlining" pelo
-- planejador do Postgres, o que faz o corpo da função ser colado dentro
-- da query externa ANTES da semântica de security definer ser aplicada.
-- Como ambas consultam public.users/public.memberships (tabelas com RLS
-- habilitada, incluindo policies que chamam estas mesmas funções), o
-- inlining reintroduz a checagem de RLS na consulta interna e gera o
-- erro "infinite recursion detected in policy for relation users".
-- Funções plpgsql não sofrem inlining, preservando o isolamento do
-- security definer e evitando a recursão.
create or replace function public.current_company_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select m.company_id
  into v_company_id
  from public.memberships m
  join public.users u on u.id = m.user_id
  where u.auth_user_id = auth.uid()
    and m.status = 'active'
  limit 1;

  return v_company_id;
end;
$$;

create or replace function public.user_has_company_access(p_company_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  select exists (
    select 1
    from public.memberships m
    join public.users u on u.id = m.user_id
    where u.auth_user_id = auth.uid()
      and m.company_id = p_company_id
      and m.status = 'active'
  ) into v_exists;

  return v_exists;
end;
$$;

alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.memberships enable row level security;
alter table public.role_permissions enable row level security;
alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.customers enable row level security;
alter table public.leads enable row level security;
alter table public.opportunities enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.procedures enable row level security;
alter table public.procedure_steps enable row level security;
alter table public.production_orders enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_items enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.problems enable row level security;
alter table public.problem_comments enable row level security;
alter table public.attachments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.automations enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_insights enable row level security;

-- Safe to re-run: remove prior policies before creating the tenant set.
do $$
declare
  rec record;
begin
  for rec in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'companies', 'users', 'roles', 'permissions', 'memberships', 'role_permissions',
        'departments', 'employees', 'customers', 'leads', 'opportunities',
        'product_categories', 'products', 'orders', 'order_items', 'quotes',
        'quote_items', 'tasks', 'task_comments', 'procedures', 'procedure_steps',
        'production_orders', 'inventory_items', 'inventory_movements', 'suppliers',
        'purchase_orders', 'purchase_items', 'financial_transactions', 'payments',
        'notifications', 'problems', 'problem_comments', 'attachments', 'audit_logs',
        'automations', 'ai_conversations', 'ai_insights'
      )
  loop
    execute format('drop policy if exists %I on public.%I;', rec.policyname, rec.tablename);
  end loop;
end $$;

create policy "Authenticated users can create a company" on public.companies
for insert
with check (auth.uid() is not null);

create policy "Company members can read company" on public.companies
for select
using (public.user_has_company_access(id));

create policy "Company admins can update company" on public.companies
for update
using (public.user_has_company_access(id))
with check (public.user_has_company_access(id));

create policy "Users can read their own company users" on public.users
for select
using (company_id = public.current_company_id());

create policy "Users can create their own profile" on public.users
for insert
with check (
  auth_user_id = auth.uid()
  and company_id is not null
);

create policy "Users can manage their own user record" on public.users
for update
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid() and company_id = public.current_company_id());

create policy "Users can insert their own profile" on public.users
for insert
with check (auth_user_id = auth.uid() and company_id is not null);

create policy "Users can create their own membership" on public.memberships
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

create policy "Company members can read memberships" on public.memberships
for select
using (company_id = public.current_company_id());

create policy "Company members can manage memberships" on public.memberships
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can create roles for their company" on public.roles
for insert
with check (
  company_id = public.current_company_id()
  and public.user_has_company_access(company_id)
);

create policy "Company members can read roles" on public.roles
for select
using (company_id = public.current_company_id());

create policy "Company admins can manage roles" on public.roles
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

create policy "Company members can read role permissions" on public.role_permissions
for select
using (company_id = public.current_company_id());

create policy "Company admins can manage role permissions" on public.role_permissions
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read departments" on public.departments
for select
using (company_id = public.current_company_id());

create policy "Company admins can manage departments" on public.departments
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read employees" on public.employees
for select
using (company_id = public.current_company_id());

create policy "Company admins can manage employees" on public.employees
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read customers" on public.customers
for select
using (company_id = public.current_company_id());

create policy "Company members can manage customers" on public.customers
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read leads" on public.leads
for select
using (company_id = public.current_company_id());

create policy "Company members can manage leads" on public.leads
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read opportunities" on public.opportunities
for select
using (company_id = public.current_company_id());

create policy "Company members can manage opportunities" on public.opportunities
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read product categories" on public.product_categories
for select
using (company_id = public.current_company_id());

create policy "Company members can manage product categories" on public.product_categories
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read products" on public.products
for select
using (company_id = public.current_company_id());

create policy "Company members can manage products" on public.products
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read orders" on public.orders
for select
using (company_id = public.current_company_id());

create policy "Company members can manage orders" on public.orders
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read order items" on public.order_items
for select
using (company_id = public.current_company_id());

create policy "Company members can manage order items" on public.order_items
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read quotes" on public.quotes
for select
using (company_id = public.current_company_id());

create policy "Company members can manage quotes" on public.quotes
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read quote items" on public.quote_items
for select
using (company_id = public.current_company_id());

create policy "Company members can manage quote items" on public.quote_items
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read tasks" on public.tasks
for select
using (company_id = public.current_company_id());

create policy "Company members can manage tasks" on public.tasks
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read task comments" on public.task_comments
for select
using (company_id = public.current_company_id());

create policy "Company members can manage task comments" on public.task_comments
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read procedures" on public.procedures
for select
using (company_id = public.current_company_id());

create policy "Company members can manage procedures" on public.procedures
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read procedure steps" on public.procedure_steps
for select
using (company_id = public.current_company_id());

create policy "Company members can manage procedure steps" on public.procedure_steps
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read production orders" on public.production_orders
for select
using (company_id = public.current_company_id());

create policy "Company members can manage production orders" on public.production_orders
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read inventory items" on public.inventory_items
for select
using (company_id = public.current_company_id());

create policy "Company members can manage inventory items" on public.inventory_items
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read inventory movements" on public.inventory_movements
for select
using (company_id = public.current_company_id());

create policy "Company members can manage inventory movements" on public.inventory_movements
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read suppliers" on public.suppliers
for select
using (company_id = public.current_company_id());

create policy "Company members can manage suppliers" on public.suppliers
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read purchase orders" on public.purchase_orders
for select
using (company_id = public.current_company_id());

create policy "Company members can manage purchase orders" on public.purchase_orders
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read purchase items" on public.purchase_items
for select
using (company_id = public.current_company_id());

create policy "Company members can manage purchase items" on public.purchase_items
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read financial transactions" on public.financial_transactions
for select
using (company_id = public.current_company_id());

create policy "Company members can manage financial transactions" on public.financial_transactions
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read payments" on public.payments
for select
using (company_id = public.current_company_id());

create policy "Company members can manage payments" on public.payments
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read notifications" on public.notifications
for select
using (company_id = public.current_company_id());

create policy "Company members can manage notifications" on public.notifications
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read problems" on public.problems
for select
using (company_id = public.current_company_id());

create policy "Company members can manage problems" on public.problems
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read problem comments" on public.problem_comments
for select
using (company_id = public.current_company_id());

create policy "Company members can manage problem comments" on public.problem_comments
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read attachments" on public.attachments
for select
using (company_id = public.current_company_id());

create policy "Company members can manage attachments" on public.attachments
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read audit logs" on public.audit_logs
for select
using (company_id = public.current_company_id());

create policy "Company admins can insert audit logs" on public.audit_logs
for insert
with check (company_id = public.current_company_id());

create policy "Company members can read automations" on public.automations
for select
using (company_id = public.current_company_id());

create policy "Company admins can manage automations" on public.automations
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read ai conversations" on public.ai_conversations
for select
using (company_id = public.current_company_id());

create policy "Company members can manage ai conversations" on public.ai_conversations
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "Company members can read ai insights" on public.ai_insights
for select
using (company_id = public.current_company_id());

create policy "Company members can manage ai insights" on public.ai_insights
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  -- Recreate idempotently to allow re-running the schema.
  drop trigger if exists companies_updated_at on public.companies;
  drop trigger if exists users_updated_at on public.users;
  drop trigger if exists roles_updated_at on public.roles;
  drop trigger if exists memberships_updated_at on public.memberships;
  drop trigger if exists departments_updated_at on public.departments;
  drop trigger if exists employees_updated_at on public.employees;
  drop trigger if exists customers_updated_at on public.customers;
  drop trigger if exists leads_updated_at on public.leads;
  drop trigger if exists opportunities_updated_at on public.opportunities;
  drop trigger if exists product_categories_updated_at on public.product_categories;
  drop trigger if exists products_updated_at on public.products;
  drop trigger if exists orders_updated_at on public.orders;
  drop trigger if exists quotes_updated_at on public.quotes;
  drop trigger if exists tasks_updated_at on public.tasks;
  drop trigger if exists procedures_updated_at on public.procedures;
  drop trigger if exists production_orders_updated_at on public.production_orders;
  drop trigger if exists inventory_items_updated_at on public.inventory_items;
  drop trigger if exists suppliers_updated_at on public.suppliers;
  drop trigger if exists purchase_orders_updated_at on public.purchase_orders;
  drop trigger if exists financial_transactions_updated_at on public.financial_transactions;
  drop trigger if exists payments_updated_at on public.payments;
  drop trigger if exists problems_updated_at on public.problems;
  drop trigger if exists automations_updated_at on public.automations;
  drop trigger if exists ai_conversations_updated_at on public.ai_conversations;
end $$;

create trigger companies_updated_at before update on public.companies for each row execute procedure public.handle_updated_at();
create trigger users_updated_at before update on public.users for each row execute procedure public.handle_updated_at();
create trigger roles_updated_at before update on public.roles for each row execute procedure public.handle_updated_at();
create trigger memberships_updated_at before update on public.memberships for each row execute procedure public.handle_updated_at();
create trigger departments_updated_at before update on public.departments for each row execute procedure public.handle_updated_at();
create trigger employees_updated_at before update on public.employees for each row execute procedure public.handle_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute procedure public.handle_updated_at();
create trigger leads_updated_at before update on public.leads for each row execute procedure public.handle_updated_at();
create trigger opportunities_updated_at before update on public.opportunities for each row execute procedure public.handle_updated_at();
create trigger product_categories_updated_at before update on public.product_categories for each row execute procedure public.handle_updated_at();
create trigger products_updated_at before update on public.products for each row execute procedure public.handle_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute procedure public.handle_updated_at();
create trigger quotes_updated_at before update on public.quotes for each row execute procedure public.handle_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute procedure public.handle_updated_at();
create trigger procedures_updated_at before update on public.procedures for each row execute procedure public.handle_updated_at();
create trigger production_orders_updated_at before update on public.production_orders for each row execute procedure public.handle_updated_at();
create trigger inventory_items_updated_at before update on public.inventory_items for each row execute procedure public.handle_updated_at();
create trigger suppliers_updated_at before update on public.suppliers for each row execute procedure public.handle_updated_at();
create trigger purchase_orders_updated_at before update on public.purchase_orders for each row execute procedure public.handle_updated_at();
create trigger financial_transactions_updated_at before update on public.financial_transactions for each row execute procedure public.handle_updated_at();
create trigger payments_updated_at before update on public.payments for each row execute procedure public.handle_updated_at();
create trigger problems_updated_at before update on public.problems for each row execute procedure public.handle_updated_at();
create trigger automations_updated_at before update on public.automations for each row execute procedure public.handle_updated_at();
create trigger ai_conversations_updated_at before update on public.ai_conversations for each row execute procedure public.handle_updated_at();

comment on schema public is 'Multi-tenant schema for the NEXO platform. Every tenant-scoped business table contains company_id and is protected by RLS.';-- Garante que TODA conta criada seja designada como "Proprietário" (owner),
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
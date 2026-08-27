create table if not exists public.employee_module_access (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  module_name text not null,
  allowed boolean not null default true,
  granted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id, module_name)
);

create index if not exists employee_module_access_company_user_idx
  on public.employee_module_access(company_id, user_id);

create index if not exists employee_module_access_module_idx
  on public.employee_module_access(module_name);

create or replace function public.touch_employee_module_access_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists employee_module_access_updated_at on public.employee_module_access;
create trigger employee_module_access_updated_at
before update on public.employee_module_access
for each row
execute function public.touch_employee_module_access_updated_at();

alter table public.employee_module_access enable row level security;

create policy "Company members can read employee module access"
on public.employee_module_access
for select
using (company_id = public.current_company_id());

create policy "Company admins can manage employee module access"
on public.employee_module_access
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

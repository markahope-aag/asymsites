-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Sites table
create table public.sites (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  domain text not null unique,
  wpengine_install_id text not null,
  wpengine_environment text not null default 'production',
  cloudflare_zone_id text,
  client_name text,
  page_builder text check (page_builder in ('elementor', 'beaver', 'gutenberg', 'other')),
  monthly_fee numeric(10,2) default 150.00,
  is_ecommerce boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Audits table
create table public.audits (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  started_at timestamptz,
  completed_at timestamptz,
  health_score integer check (health_score >= 0 and health_score <= 100),
  summary text,
  raw_data jsonb default '{}'::jsonb,
  error_message text,
  created_at timestamptz default now()
);

-- Issues table
create table public.issues (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites(id) on delete cascade,
  audit_id uuid references public.audits(id) on delete cascade,
  category text not null check (category in ('plugins', 'database', 'performance', 'security', 'seo')),
  severity text not null check (severity in ('critical', 'warning', 'info')),
  title text not null,
  description text,
  recommendation text,
  auto_fixable boolean default false,
  fix_action text,
  fix_params jsonb default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'fixed', 'ignored', 'in_progress')),
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz default now()
);

-- Action log table (for tracking all actions taken)
create table public.action_logs (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites(id) on delete cascade,
  issue_id uuid references public.issues(id) on delete set null,
  action_type text not null,
  action_params jsonb default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  result jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Indexes for performance
create index idx_audits_site_id on public.audits(site_id);
create index idx_audits_created_at on public.audits(created_at desc);
create index idx_audits_status on public.audits(status);
create index idx_issues_site_id on public.issues(site_id);
create index idx_issues_status on public.issues(status);
create index idx_issues_severity on public.issues(severity);
create index idx_issues_category on public.issues(category);
create index idx_action_logs_site_id on public.action_logs(site_id);

-- Updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply trigger to sites
create trigger sites_updated_at
  before update on public.sites
  for each row
  execute function public.handle_updated_at();

-- View for site dashboard (latest audit per site)
create view public.site_dashboard as
select
  s.*,
  a.id as latest_audit_id,
  a.health_score as latest_health_score,
  a.completed_at as latest_audit_at,
  a.status as latest_audit_status,
  (select count(*) from public.issues i where i.site_id = s.id and i.status = 'open') as open_issues_count,
  (select count(*) from public.issues i where i.site_id = s.id and i.status = 'open' and i.severity = 'critical') as critical_issues_count
from public.sites s
left join lateral (
  select * from public.audits
  where site_id = s.id
  order by created_at desc
  limit 1
) a on true;

-- Row level security (basic - enable if using Supabase Auth)
-- alter table public.sites enable row level security;
-- alter table public.audits enable row level security;
-- alter table public.issues enable row level security;
-- alter table public.action_logs enable row level security;

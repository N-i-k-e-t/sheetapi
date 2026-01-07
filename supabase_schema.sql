-- 1. Main Data Table (Replaces 'sheet_api_data')
create table records (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  date date not null, -- For filtering (e.g. 2026-01-07)
  raw_data jsonb not null, -- The entire Excel row as JSON
  uploaded_by text default 'admin'
);

-- 2. API Keys (Replaces 'sheet_api_key' / Auth check)
create table api_keys (
  id uuid default gen_random_uuid() primary key,
  key_value text unique not null,
  owner_name text not null, -- e.g. "Megha IT"
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Audit Logs (Replaces 'sheet_api_traffic')
create table audit_logs (
  id uuid default gen_random_uuid() primary key,
  timestamp timestamp with time zone default timezone('utc'::text, now()),
  action text not null, -- 'UPLOAD', 'API_PULL'
  status text not null, -- 'SUCCESS', 'ERROR'
  details text
);

-- Enable Row Level Security (RLS)
alter table records enable row level security;
alter table api_keys enable row level security;
alter table audit_logs enable row level security;

-- Create Open Policies (Since we control access via App & API Key)
create policy "Public Access" on records for all using (true);
create policy "Public Access" on api_keys for all using (true);
create policy "Public Access" on audit_logs for all using (true);

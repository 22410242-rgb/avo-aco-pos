-- ============================================================================
-- Avocados POS — Supabase schema
-- Run this once in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ----------------------------------------------------------------------------
-- Every former Firestore collection becomes a table (id text PK, data jsonb).
-- The whole document is stored in `data`, preserving the original schemaless
-- shape so no application code had to change.
-- ============================================================================

-- 1) Tables -----------------------------------------------------------------
create table if not exists "users"                ( id text primary key, data jsonb not null default '{}', updated_at timestamptz not null default now() );
create table if not exists "categories"           ( id text primary key, data jsonb not null default '{}', updated_at timestamptz not null default now() );
create table if not exists "products"             ( id text primary key, data jsonb not null default '{}', updated_at timestamptz not null default now() );
create table if not exists "invoices"             ( id text primary key, data jsonb not null default '{}', updated_at timestamptz not null default now() );
create table if not exists "sessions"             ( id text primary key, data jsonb not null default '{}', updated_at timestamptz not null default now() );
create table if not exists "expenses"             ( id text primary key, data jsonb not null default '{}', updated_at timestamptz not null default now() );
create table if not exists "heldOrders"           ( id text primary key, data jsonb not null default '{}', updated_at timestamptz not null default now() );
create table if not exists "suppliers"            ( id text primary key, data jsonb not null default '{}', updated_at timestamptz not null default now() );
create table if not exists "supplierTransactions" ( id text primary key, data jsonb not null default '{}', updated_at timestamptz not null default now() );
create table if not exists "purchases"            ( id text primary key, data jsonb not null default '{}', updated_at timestamptz not null default now() );
create table if not exists "inventoryMovements"   ( id text primary key, data jsonb not null default '{}', updated_at timestamptz not null default now() );
create table if not exists "settings"             ( id text primary key, data jsonb not null default '{}', updated_at timestamptz not null default now() );
create table if not exists "test"                 ( id text primary key, data jsonb not null default '{}', updated_at timestamptz not null default now() );

-- 2) Row Level Security ------------------------------------------------------
-- Any authenticated user can read/write (role checks happen in the app UI,
-- mirroring the previous Firestore `isAuthenticated()` rules). The `test`
-- table is also readable by anonymous visitors for the pre-login health check.
do $$
declare t text;
begin
  foreach t in array array[
    'users','categories','products','invoices','sessions','expenses',
    'heldOrders','suppliers','supplierTransactions','purchases',
    'inventoryMovements','settings','test'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format($f$
      drop policy if exists "authenticated_all" on public.%I;
      create policy "authenticated_all" on public.%I
        for all to authenticated using (true) with check (true);
    $f$, t, t);
  end loop;
end $$;

-- Pre-login connectivity check needs anonymous read on the test table.
drop policy if exists "anon_read_test" on public.test;
create policy "anon_read_test" on public.test
  for select to anon using (true);

-- 3) Realtime ----------------------------------------------------------------
-- Add every table to the realtime publication (replaces Firestore onSnapshot).
do $$
declare t text;
begin
  foreach t in array array[
    'users','categories','products','invoices','sessions','expenses',
    'heldOrders','suppliers','supplierTransactions','purchases',
    'inventoryMovements','settings','test'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- 4) Seed --------------------------------------------------------------------
insert into public.test (id, data) values ('connection', '{"ok": true}')
  on conflict (id) do nothing;

-- 5) Storage (optional) ------------------------------------------------------
-- A public bucket for future image/logo uploads. The current app stores images
-- as base64 inside documents, so this is not required, but it is ready to use.
insert into storage.buckets (id, name, public)
  values ('assets', 'assets', true)
  on conflict (id) do nothing;

drop policy if exists "assets_public_read" on storage.objects;
create policy "assets_public_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'assets');

drop policy if exists "assets_auth_write" on storage.objects;
create policy "assets_auth_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'assets');

drop policy if exists "assets_auth_update" on storage.objects;
create policy "assets_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'assets');

drop policy if exists "assets_auth_delete" on storage.objects;
create policy "assets_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'assets');

-- Done. ----------------------------------------------------------------------

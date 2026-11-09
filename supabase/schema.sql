-- =====================================================================
-- Blue Carbon Field App — skema Supabase
-- Jalankan sekali di Supabase: SQL Editor > New query > tempel > Run.
-- =====================================================================

-- 1. Data lapangan. Setiap record aplikasi (survei, observasi, sampel, foto)
--    disimpan utuh di kolom doc (JSON) beserta metadata & riwayat perubahannya.
create table if not exists public.bcfa_records (
  id          text primary key,
  type        text not null check (type in ('survey','observation','sample','photo')),
  parent_id   text,
  sample_code text,
  updated_at  timestamptz,              -- waktu diubah di perangkat
  deleted     boolean not null default false,
  doc         jsonb not null,
  synced_at   timestamptz not null default now(),  -- waktu diterima server
  synced_by   uuid default auth.uid()
);
create index if not exists bcfa_records_type_idx   on public.bcfa_records (type);
create index if not exists bcfa_records_parent_idx on public.bcfa_records (parent_id);
create index if not exists bcfa_records_code_idx   on public.bcfa_records (sample_code);
create index if not exists bcfa_records_synced_idx on public.bcfa_records (synced_at);

-- 2. Jejak audit server: setiap kiriman tercatat (untuk traceability MRV).
create table if not exists public.bcfa_audit (
  audit_id    bigint generated always as identity primary key,
  record_id   text not null,
  type        text,
  sample_code text,
  rev         int,
  doc_hash    text,
  deleted     boolean,
  synced_by   uuid,
  synced_at   timestamptz not null default now()
);
create index if not exists bcfa_audit_record_idx on public.bcfa_audit (record_id);

create or replace function public.bcfa_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.synced_at := now();
  new.synced_by := auth.uid();
  return new;
end $$;
drop trigger if exists bcfa_records_touch on public.bcfa_records;
create trigger bcfa_records_touch before insert or update on public.bcfa_records
  for each row execute function public.bcfa_touch();

create or replace function public.bcfa_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.bcfa_audit (record_id, type, sample_code, rev, doc_hash, deleted, synced_by)
  values (new.id, new.type, new.sample_code, (new.doc->'meta'->>'rev')::int, new.doc->'meta'->>'hash', new.deleted, auth.uid());
  return null;
end $$;
drop trigger if exists bcfa_records_log on public.bcfa_records;
create trigger bcfa_records_log after insert or update on public.bcfa_records
  for each row execute function public.bcfa_log();

-- 3. Admin aplikasi (boleh menerbitkan metadata ke semua perangkat).
create table if not exists public.bcfa_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- 4. Metadata aplikasi yang diterbitkan admin.
create table if not exists public.bcfa_config (
  key        text primary key,
  doc        jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

-- 5. Aturan akses (Row Level Security): hanya akun tim yang sudah masuk.
alter table public.bcfa_records enable row level security;
alter table public.bcfa_audit   enable row level security;
alter table public.bcfa_admins  enable row level security;
alter table public.bcfa_config  enable row level security;

drop policy if exists "tim membaca data"   on public.bcfa_records;
drop policy if exists "tim menambah data"  on public.bcfa_records;
drop policy if exists "tim mengubah data"  on public.bcfa_records;
create policy "tim membaca data"  on public.bcfa_records for select to authenticated using (true);
create policy "tim menambah data" on public.bcfa_records for insert to authenticated with check (true);
create policy "tim mengubah data" on public.bcfa_records for update to authenticated using (true) with check (true);
-- Tidak ada izin DELETE: penghapusan di aplikasi bersifat lunak (deleted = true) demi jejak audit.

drop policy if exists "tim membaca audit" on public.bcfa_audit;
create policy "tim membaca audit" on public.bcfa_audit for select to authenticated using (true);

drop policy if exists "cek status admin sendiri" on public.bcfa_admins;
create policy "cek status admin sendiri" on public.bcfa_admins for select to authenticated using (user_id = auth.uid());

drop policy if exists "tim membaca metadata"  on public.bcfa_config;
drop policy if exists "admin menulis metadata" on public.bcfa_config;
drop policy if exists "admin mengubah metadata" on public.bcfa_config;
create policy "tim membaca metadata"   on public.bcfa_config for select to authenticated using (true);
create policy "admin menulis metadata" on public.bcfa_config for insert to authenticated
  with check (exists (select 1 from public.bcfa_admins a where a.user_id = auth.uid()));
create policy "admin mengubah metadata" on public.bcfa_config for update to authenticated
  using (exists (select 1 from public.bcfa_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.bcfa_admins a where a.user_id = auth.uid()));


-- 6. Anggota tim: hanya akun di bcfa_members yang boleh membaca/menulis.
--    Akun yang dibuat admin dari dashboard dengan "Auto Confirm User" otomatis menjadi anggota.
--    Akun PERTAMA otomatis menjadi admin aplikasi.
create table if not exists public.bcfa_members (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  email    text,
  added_at timestamptz not null default now()
);
alter table public.bcfa_members enable row level security;

create or replace function public.bcfa_is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bcfa_members where user_id = auth.uid());
$$;
revoke execute on function public.bcfa_is_member() from public, anon;
grant execute on function public.bcfa_is_member() to authenticated;

drop policy if exists "anggota melihat daftar anggota" on public.bcfa_members;
create policy "anggota melihat daftar anggota" on public.bcfa_members for select to authenticated
  using ((select public.bcfa_is_member()));

create or replace function public.bcfa_on_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null then
    insert into public.bcfa_members (user_id, email) values (new.id, new.email) on conflict do nothing;
    if not exists (select 1 from public.bcfa_admins) then
      insert into public.bcfa_admins (user_id) values (new.id) on conflict do nothing;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.bcfa_on_new_user() from public, anon, authenticated;
revoke execute on function public.bcfa_touch() from public, anon, authenticated;
revoke execute on function public.bcfa_log() from public, anon, authenticated;
drop trigger if exists bcfa_on_auth_user_created on auth.users;
create trigger bcfa_on_auth_user_created after insert on auth.users
  for each row execute function public.bcfa_on_new_user();

drop policy if exists "tim membaca data"  on public.bcfa_records;
drop policy if exists "tim menambah data" on public.bcfa_records;
drop policy if exists "tim mengubah data" on public.bcfa_records;
create policy "tim membaca data"  on public.bcfa_records for select to authenticated using ((select public.bcfa_is_member()));
create policy "tim menambah data" on public.bcfa_records for insert to authenticated with check ((select public.bcfa_is_member()));
create policy "tim mengubah data" on public.bcfa_records for update to authenticated using ((select public.bcfa_is_member())) with check ((select public.bcfa_is_member()));
drop policy if exists "tim membaca audit" on public.bcfa_audit;
create policy "tim membaca audit" on public.bcfa_audit for select to authenticated using ((select public.bcfa_is_member()));
drop policy if exists "tim membaca metadata" on public.bcfa_config;
create policy "tim membaca metadata" on public.bcfa_config for select to authenticated using ((select public.bcfa_is_member()));

-- Menambah anggota/admin secara manual (bila perlu):
-- insert into public.bcfa_members (user_id, email) select id, email from auth.users where email = 'nama@kkp.go.id';
-- insert into public.bcfa_admins (user_id) select id from auth.users where email = 'nama@kkp.go.id';
-- Mencabut anggota: delete from public.bcfa_members where email = 'nama@kkp.go.id';

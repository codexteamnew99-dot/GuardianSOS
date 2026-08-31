-- GuardianSOS schema (Supabase Auth + RLS)
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  email text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  guardian_user_id uuid references public.profiles (id) on delete set null,
  invite_email text,
  invite_phone text,
  relationship text,
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REMOVED')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index if not exists guardians_owner_idx on public.guardians (owner_id);
create index if not exists guardians_guardian_idx on public.guardians (guardian_user_id);
create index if not exists guardians_invite_email_idx on public.guardians (lower(invite_email));

create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  phone text not null,
  relationship text,
  created_at timestamptz not null default now()
);
create index if not exists emergency_contacts_user_idx on public.emergency_contacts (user_id);

create table if not exists public.sos_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'RESOLVED')),
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  lat double precision,
  lng double precision,
  accuracy double precision
);
create index if not exists sos_events_user_idx on public.sos_events (user_id, status);
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  sos_event_id uuid not null references public.sos_events (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  recorded_at timestamptz not null default now()
);
create index if not exists locations_sos_idx on public.locations (sos_event_id, recorded_at desc);

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  platform text,
  updated_at timestamptz not null default now()
);
create index if not exists device_tokens_user_idx on public.device_tokens (user_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  sos_event_id uuid references public.sos_events (id) on delete cascade,
  type text not null default 'SOS',
  title text,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- new auth user -> profile row
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
-- helpers (security definer: avoid recursive RLS)
create or replace function public.my_email()
returns text language sql stable security definer set search_path = public as $$
  select u.email from auth.users u where u.id = auth.uid();
$$;

create or replace function public.is_accepted_guardian(_owner uuid, _guardian uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.guardians g
    where g.owner_id = _owner and g.guardian_user_id = _guardian and g.status = 'ACCEPTED'
  );
$$;

create or replace function public.can_view_profile(_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _id = auth.uid()
    or public.is_accepted_guardian(_id, auth.uid())
    or public.is_accepted_guardian(auth.uid(), _id)
    or exists (
      select 1 from public.guardians g
      where g.owner_id = _id
        and g.status = 'PENDING'
        and lower(g.invite_email) = lower(coalesce(public.my_email(), ''))
    );
$$;

create or replace function public.can_view_sos(_sos uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sos_events e
    where e.id = _sos
      and (e.user_id = auth.uid() or public.is_accepted_guardian(e.user_id, auth.uid()))
  );
$$;

create or replace function public.owns_sos(_sos uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sos_events e where e.id = _sos and e.user_id = auth.uid());
$$;

alter table public.profiles enable row level security;
alter table public.guardians enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.sos_events enable row level security;
alter table public.locations enable row level security;
alter table public.device_tokens enable row level security;
alter table public.notifications enable row level security;
-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (public.can_view_profile(id));
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- guardians
drop policy if exists guardians_select on public.guardians;
create policy guardians_select on public.guardians for select to authenticated
  using (
    owner_id = auth.uid()
    or guardian_user_id = auth.uid()
    or lower(invite_email) = lower(coalesce(public.my_email(), ''))
  );
drop policy if exists guardians_insert on public.guardians;
create policy guardians_insert on public.guardians for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists guardians_update on public.guardians;
create policy guardians_update on public.guardians for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists guardians_delete on public.guardians;
create policy guardians_delete on public.guardians for delete to authenticated
  using (owner_id = auth.uid());

-- emergency_contacts (own rows only)
drop policy if exists contacts_all on public.emergency_contacts;
create policy contacts_all on public.emergency_contacts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- sos_events: owner full access, accepted guardian read-only
drop policy if exists sos_select on public.sos_events;
create policy sos_select on public.sos_events for select to authenticated
  using (user_id = auth.uid() or public.is_accepted_guardian(user_id, auth.uid()));
drop policy if exists sos_insert on public.sos_events;
create policy sos_insert on public.sos_events for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists sos_update on public.sos_events;
create policy sos_update on public.sos_events for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- locations: only inside an owned or accepted-guardian SOS
drop policy if exists locations_select on public.locations;
create policy locations_select on public.locations for select to authenticated
  using (public.can_view_sos(sos_event_id));
drop policy if exists locations_insert on public.locations;
create policy locations_insert on public.locations for insert to authenticated
  with check (public.owns_sos(sos_event_id));

-- device_tokens: own tokens, plus read tokens of my accepted guardians (to push them)
drop policy if exists tokens_select on public.device_tokens;
create policy tokens_select on public.device_tokens for select to authenticated
  using (user_id = auth.uid() or public.is_accepted_guardian(auth.uid(), user_id));
drop policy if exists tokens_write on public.device_tokens;
create policy tokens_write on public.device_tokens for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists tokens_update on public.device_tokens;
create policy tokens_update on public.device_tokens for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists tokens_delete on public.device_tokens;
create policy tokens_delete on public.device_tokens for delete to authenticated
  using (user_id = auth.uid());

-- notifications: read own, insert for self or for my accepted guardians
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists notif_insert on public.notifications;
create policy notif_insert on public.notifications for insert to authenticated
  with check (user_id = auth.uid() or public.is_accepted_guardian(auth.uid(), user_id));
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- accepting an invite runs through this function so the invitee can never
-- rewrite owner_id (which would fake a guardianship over another user)
create or replace function public.accept_guardian_invite(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare inv public.guardians;
begin
  select * into inv from public.guardians where id = _id;
  if inv.id is null then
    raise exception 'Invite not found';
  end if;
  if lower(coalesce(inv.invite_email, '')) <> lower(coalesce(public.my_email(), '')) then
    raise exception 'This invite is not for you';
  end if;
  if inv.status <> 'PENDING' then
    raise exception 'Invite already handled';
  end if;
  if inv.owner_id = auth.uid() then
    raise exception 'You cannot be your own guardian';
  end if;
  update public.guardians
     set guardian_user_id = auth.uid(), status = 'ACCEPTED', accepted_at = now()
   where id = _id;
end;
$$;
revoke all on function public.accept_guardian_invite(uuid) from public;
grant execute on function public.accept_guardian_invite(uuid) to authenticated;

-- realtime
alter table public.locations replica identity full;
alter table public.sos_events replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.locations; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.sos_events; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  end if;
end $$;





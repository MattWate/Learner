-- Tutor Centre invite codes and learner self-connection RPCs
-- Safe to run after the existing tutor centre tables have been created.

alter table public.tutor_centres
add column if not exists invite_code text unique,
add column if not exists invite_code_enabled boolean not null default true,
add column if not exists invite_code_created_at timestamp with time zone not null default now();

create or replace function public.generate_tutor_centre_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    candidate text;
begin
    loop
        candidate := 'TC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

        exit when not exists (
            select 1
            from public.tutor_centres
            where invite_code = candidate
        );
    end loop;

    return candidate;
end;
$$;

update public.tutor_centres
set
    invite_code = public.generate_tutor_centre_invite_code(),
    invite_code_created_at = now(),
    invite_code_enabled = true
where invite_code is null;

create or replace function public.set_tutor_centre_invite_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.invite_code is null or btrim(new.invite_code) = '' then
        new.invite_code := public.generate_tutor_centre_invite_code();
    else
        new.invite_code := upper(btrim(new.invite_code));
    end if;

    if new.invite_code_created_at is null then
        new.invite_code_created_at := now();
    end if;

    return new;
end;
$$;

drop trigger if exists set_tutor_centre_invite_code_trigger on public.tutor_centres;

create trigger set_tutor_centre_invite_code_trigger
before insert on public.tutor_centres
for each row
execute function public.set_tutor_centre_invite_code();

create or replace function public.tutor_centre_user_can_manage(p_tutor_centre_id bigint, p_account_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.tutor_centre_users tcu
        where tcu.tutor_centre_id = p_tutor_centre_id
          and tcu.account_id = p_account_id
          and tcu.status = 'active'
          and tcu.role in ('owner', 'admin', 'tutor', 'teacher')
    );
$$;

create or replace function public.user_owns_profile(p_profile_id bigint, p_account_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles p
        where p.id = p_profile_id
          and p.account_id = p_account_id
    );
$$;

create or replace function public.account_is_paid(p_account_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.accounts a
        where a.id = p_account_id
          and (
              coalesce(a.active_tier, 'free') <> 'free'
              or coalesce(a.subscription_status, 'free') in ('active', 'trialing', 'paid')
          )
    );
$$;

create or replace function public.join_tutor_centre_by_code(
    p_profile_id bigint,
    p_invite_code text
)
returns table (
    tutor_centre_id bigint,
    tutor_centre_name text,
    profile_id bigint,
    connection_status text,
    already_connected boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_account_id uuid;
    v_code text;
    v_centre record;
    v_existing record;
begin
    v_account_id := auth.uid();

    if v_account_id is null then
        raise exception 'You must be signed in to connect to a tutor centre.';
    end if;

    if not public.user_owns_profile(p_profile_id, v_account_id) then
        raise exception 'You can only connect your own learner profile to a tutor centre.';
    end if;

    if not public.account_is_paid(v_account_id) then
        raise exception 'Connecting to a tutor centre is available to paid accounts.';
    end if;

    v_code := upper(btrim(coalesce(p_invite_code, '')));

    if v_code = '' then
        raise exception 'Please enter a tutor centre code.';
    end if;

    select tc.*
    into v_centre
    from public.tutor_centres tc
    where upper(tc.invite_code) = v_code
      and tc.invite_code_enabled = true
      and tc.status = 'active'
    limit 1;

    if v_centre.id is null then
        raise exception 'Tutor centre code not found or no longer active.';
    end if;

    select tcp.*
    into v_existing
    from public.tutor_centre_profiles tcp
    where tcp.tutor_centre_id = v_centre.id
      and tcp.profile_id = p_profile_id
    order by tcp.id desc
    limit 1;

    if v_existing.id is not null then
        if v_existing.status = 'active' then
            return query
            select v_centre.id, v_centre.name, p_profile_id, 'active'::text, true;
            return;
        end if;

        update public.tutor_centre_profiles tcp
        set status = 'active', assigned_at = now(), assigned_by = v_account_id
        where tcp.id = v_existing.id;

        return query
        select v_centre.id, v_centre.name, p_profile_id, 'active'::text, false;
        return;
    end if;

    insert into public.tutor_centre_profiles (tutor_centre_id, profile_id, status, assigned_at, assigned_by)
    values (v_centre.id, p_profile_id, 'active', now(), v_account_id);

    return query
    select v_centre.id, v_centre.name, p_profile_id, 'active'::text, false;
end;
$$;

grant execute on function public.join_tutor_centre_by_code(bigint, text) to authenticated;

create or replace function public.get_profile_tutor_centre_connections(p_profile_id bigint)
returns table (
    tutor_centre_id bigint,
    tutor_centre_name text,
    tutor_centre_description text,
    connection_status text,
    assigned_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_account_id uuid;
begin
    v_account_id := auth.uid();

    if v_account_id is null then
        raise exception 'You must be signed in.';
    end if;

    if not public.user_owns_profile(p_profile_id, v_account_id) then
        raise exception 'You can only view tutor centre connections for your own learner profile.';
    end if;

    return query
    select tc.id, tc.name, tc.description, tcp.status, tcp.assigned_at
    from public.tutor_centre_profiles tcp
    join public.tutor_centres tc on tc.id = tcp.tutor_centre_id
    where tcp.profile_id = p_profile_id
      and tcp.status = 'active'
      and tc.status = 'active'
    order by tcp.assigned_at desc;
end;
$$;

grant execute on function public.get_profile_tutor_centre_connections(bigint) to authenticated;

create or replace function public.remove_profile_from_tutor_centre(
    p_tutor_centre_id bigint,
    p_profile_id bigint
)
returns table (
    tutor_centre_id bigint,
    profile_id bigint,
    removed_from_groups integer,
    connection_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_account_id uuid;
    v_removed_groups integer := 0;
begin
    v_account_id := auth.uid();

    if v_account_id is null then
        raise exception 'You must be signed in.';
    end if;

    if not public.tutor_centre_user_can_manage(p_tutor_centre_id, v_account_id) then
        raise exception 'You do not have permission to remove learners from this tutor centre.';
    end if;

    delete from public.tutor_group_profiles tgp
    using public.tutor_groups tg
    where tgp.tutor_group_id = tg.id
      and tg.tutor_centre_id = p_tutor_centre_id
      and tgp.profile_id = p_profile_id;

    get diagnostics v_removed_groups = row_count;

    update public.tutor_centre_profiles tcp
    set status = 'revoked'
    where tcp.tutor_centre_id = p_tutor_centre_id
      and tcp.profile_id = p_profile_id
      and tcp.status in ('active', 'pending', 'inactive');

    return query
    select p_tutor_centre_id, p_profile_id, v_removed_groups, 'revoked'::text;
end;
$$;

grant execute on function public.remove_profile_from_tutor_centre(bigint, bigint) to authenticated;

create or replace function public.get_my_tutor_centres()
returns table (
    tutor_centre_id bigint,
    tutor_centre_name text,
    role text,
    invite_code text,
    invite_code_enabled boolean,
    status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_account_id uuid;
begin
    v_account_id := auth.uid();

    if v_account_id is null then
        raise exception 'You must be signed in.';
    end if;

    return query
    select tc.id, tc.name, tcu.role, tc.invite_code, tc.invite_code_enabled, tc.status
    from public.tutor_centre_users tcu
    join public.tutor_centres tc on tc.id = tcu.tutor_centre_id
    where tcu.account_id = v_account_id
      and tcu.status = 'active'
    order by tc.name;
end;
$$;

grant execute on function public.get_my_tutor_centres() to authenticated;

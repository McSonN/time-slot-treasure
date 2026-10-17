ALTER TABLE public.bookings
  ADD COLUMN rejection_reason text,
  ADD COLUMN change_request text,
  ADD COLUMN change_requested_at timestamptz,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE public.booking_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  booking_owner uuid NOT NULL,
  actor_id uuid,
  actor_email text,
  actor_is_admin boolean NOT NULL DEFAULT false,
  action text NOT NULL,
  from_status text,
  to_status text,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_history_booking_idx ON public.booking_history(booking_id, created_at);
GRANT SELECT ON public.booking_history TO authenticated;
GRANT ALL ON public.booking_history TO service_role;
ALTER TABLE public.booking_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner or admin read history" ON public.booking_history FOR SELECT TO authenticated
  USING (booking_owner = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_notifications TO authenticated;
GRANT ALL ON public.email_notifications TO service_role;
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read notifications" ON public.email_notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "owner update" ON public.bookings FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.guard_booking_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare is_admin boolean := public.has_role(auth.uid(), 'admin');
begin
  new.updated_at := now();
  if auth.uid() is null or is_admin then return new; end if;
  if new.user_id <> old.user_id or new.kind <> old.kind or new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'Brak uprawnień do tej zmiany';
  end if;
  if new.status <> old.status then
    if not (old.status = 'pending' and new.status = 'cancelled') then
      raise exception 'Brak uprawnień do zmiany statusu';
    end if;
    return new;
  end if;
  if old.status = 'pending' then return new; end if;
  if old.status = 'approved' and (to_jsonb(new) - array['change_request','change_requested_at','updated_at'])
       = (to_jsonb(old) - array['change_request','change_requested_at','updated_at']) then
    return new;
  end if;
  raise exception 'Tego wniosku nie można już edytować';
end $$;
CREATE TRIGGER bookings_guard BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.guard_booking_update();

CREATE OR REPLACE FUNCTION public.log_booking_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare
  actor uuid := auth.uid();
  is_admin boolean := coalesce(public.has_role(auth.uid(), 'admin'), false);
  email text := auth.jwt() ->> 'email';
  act text; diff jsonb := '{}'::jsonb; note text; rec record; subj text; target record;
begin
  if tg_op = 'INSERT' then
    insert into booking_history(booking_id, booking_owner, actor_id, actor_email, actor_is_admin, action, to_status)
    values (new.id, new.user_id, actor, email, is_admin, 'created', new.status);
    return new;
  end if;
  if tg_op = 'DELETE' then
    insert into booking_history(booking_id, booking_owner, actor_id, actor_email, actor_is_admin, action, from_status)
    values (old.id, old.user_id, actor, email, is_admin, 'deleted', old.status);
    if is_admin and actor is distinct from old.user_id and old.contact_email is not null then
      insert into email_notifications(booking_id, recipient, subject, body)
      values (old.id, old.contact_email, 'Wniosek usunięty: ' || old.event_name,
        'Administrator usunął Twój wniosek „' || old.event_name || '”.');
    end if;
    return old;
  end if;
  for rec in select n.key, n.value as nv, o.value as ov from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value and n.key not in ('updated_at','status','change_requested_at') loop
    diff := diff || jsonb_build_object(rec.key, jsonb_build_object('from', rec.ov, 'to', rec.nv));
  end loop;
  if new.status <> old.status then
    act := case new.status when 'approved' then 'approved' when 'rejected' then 'rejected' when 'cancelled' then 'cancelled' else 'status_changed' end;
    note := case when new.status = 'rejected' then new.rejection_reason end;
  elsif new.change_request is not null and new.change_request is distinct from old.change_request then
    act := 'change_requested'; note := new.change_request;
  elsif diff = '{}'::jsonb then return new;
  else act := 'edited';
  end if;
  insert into booking_history(booking_id, booking_owner, actor_id, actor_email, actor_is_admin, action, from_status, to_status, changes, note)
  values (new.id, new.user_id, actor, email, is_admin, act, old.status, new.status, diff, note);
  if is_admin and actor is distinct from new.user_id and new.contact_email is not null then
    subj := case act when 'approved' then 'Wniosek zaakceptowany' when 'rejected' then 'Wniosek odrzucony'
      when 'edited' then 'Wniosek zmieniony przez administratora' else 'Zmiana we wniosku' end;
    insert into email_notifications(booking_id, recipient, subject, body)
    values (new.id, new.contact_email, subj || ': ' || new.event_name,
      subj || ' — „' || new.event_name || '”.' || coalesce(E'\nUzasadnienie: ' || note, ''));
  end if;
  if act = 'change_requested' then
    insert into email_notifications(booking_id, recipient, subject, body)
    values (new.id, 'administrator', 'Prośba o zmianę: ' || new.event_name, new.change_request);
  end if;
  return new;
end $$;
CREATE TRIGGER bookings_log AFTER INSERT OR UPDATE OR DELETE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.log_booking_change();

CREATE OR REPLACE FUNCTION public.check_booking_overlap()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  if new.status not in ('rejected','cancelled') and exists (
    select 1 from public.bookings b where b.venue_id=new.venue_id and b.id<>new.id and b.status not in ('rejected','cancelled')
      and b.start_at < new.end_at and b.end_at > new.start_at) then
    raise exception 'Wybrany termin jest już zajęty';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.get_busy_slots(_from timestamp with time zone, _to timestamp with time zone)
 RETURNS TABLE(id uuid, venue_id uuid, start_at timestamp with time zone, end_at timestamp with time zone, is_mine boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  select b.id, b.venue_id, b.start_at, b.end_at, (b.user_id = auth.uid()) as is_mine
  from public.bookings b
  where b.status not in ('rejected','cancelled') and b.start_at < _to and b.end_at > _from
$function$;
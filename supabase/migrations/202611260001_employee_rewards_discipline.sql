-- Staged additive migration. NO production execution in this batch.
-- Contract: docs/rewards-discipline-contract.md. Run as trusted DB owner.
BEGIN;
CREATE SCHEMA IF NOT EXISTS rewards_private;
REVOKE ALL ON SCHEMA rewards_private FROM PUBLIC, anon, authenticated, service_role;

-- Match ECMAScript String.prototype.trim WhiteSpace + LineTerminator exactly.
-- Do not use locale-dependent [:space:] / Unicode White_Space (e.g. U+0085 differs).
-- This is only a presence predicate: persisted input is never trimmed or normalized.
CREATE OR REPLACE FUNCTION rewards_private.rd_has_text(p text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(length(btrim(p, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'))>0,false);
$$;
REVOKE ALL ON FUNCTION rewards_private.rd_has_text(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS rewards_private.rd_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  grant_reason text NOT NULL CHECK (rewards_private.rd_has_text(grant_reason) AND length(grant_reason)<=2000),
  granted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Intentionally EMPTY. No auto-grant based on users, metadata, email or other allowlists.
CREATE TABLE IF NOT EXISTS rewards_private.rd_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL CHECK (rewards_private.rd_has_text(label) AND length(label)<=200),
  employee_id uuid REFERENCES public.employees(id),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE TABLE IF NOT EXISTS rewards_private.rd_subject_origins (
  subject_id uuid PRIMARY KEY REFERENCES rewards_private.rd_subjects(id),
  spreadsheet_id text NOT NULL CHECK (length(spreadsheet_id) BETWEEN 1 AND 300),
  gid text NOT NULL CHECK (length(gid) BETWEEN 1 AND 100),
  person_id text NOT NULL CHECK (length(person_id) BETWEEN 1 AND 300),
  raw jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (spreadsheet_id, gid, person_id)
);
CREATE TABLE IF NOT EXISTS rewards_private.rd_types (
  code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_]{0,49}$'),
  label text NOT NULL CHECK (rewards_private.rd_has_text(label) AND length(label)<=200),
  points numeric NOT NULL CHECK (points <> 'NaN'::numeric AND abs(points) <= 1000000000 AND mod(points*2,1)=0),
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE TABLE IF NOT EXISTS rewards_private.rd_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES rewards_private.rd_subjects(id),
  subject_label text NOT NULL,
  applicant_subject_id uuid REFERENCES rewards_private.rd_subjects(id),
  applicant_label text,
  application_date date CHECK (application_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
  event_date date CHECK (event_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
  type_code text REFERENCES rewards_private.rd_types(code),
  type_label text NOT NULL CHECK (rewards_private.rd_has_text(type_label) AND length(type_label)<=200),
  quantity integer CHECK (quantity BETWEEN 1 AND 1000000),
  unit_points numeric CHECK (unit_points <> 'NaN'::numeric AND abs(unit_points) <= 1000000000 AND mod(unit_points*2,1)=0),
  total_points numeric NOT NULL CHECK (total_points <> 'NaN'::numeric AND abs(total_points) <= 1000000000000000 AND mod(total_points*2,1)=0),
  basis text NOT NULL DEFAULT '' CHECK (length(basis) <= 2000),
  reason text NOT NULL CHECK (length(reason) <= 4000),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 4000),
  origin text NOT NULL CHECK (origin IN ('manual','import')),
  status text NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded','voided')),
  void_reason text CHECK (void_reason IS NULL OR (rewards_private.rd_has_text(void_reason) AND length(void_reason)<=2000)),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((status='recorded' AND void_reason IS NULL) OR (status='voided' AND void_reason IS NOT NULL)),
  CHECK (origin='import' OR (application_date IS NOT NULL AND type_code IS NOT NULL AND quantity IS NOT NULL AND unit_points IS NOT NULL AND rewards_private.rd_has_text(reason)))
);
CREATE TABLE IF NOT EXISTS rewards_private.rd_sources (
  record_id uuid PRIMARY KEY REFERENCES rewards_private.rd_records(id),
  spreadsheet_id text NOT NULL CHECK (length(spreadsheet_id) BETWEEN 1 AND 300),
  gid text NOT NULL CHECK (length(gid) BETWEEN 1 AND 100),
  source_record_id text NOT NULL CHECK (length(source_record_id) BETWEEN 1 AND 300),
  raw jsonb NOT NULL,
  source_updated_raw text,
  captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (spreadsheet_id, gid, source_record_id)
);
CREATE TABLE IF NOT EXISTS rewards_private.rd_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_kind text NOT NULL CHECK (entity_kind IN ('record','subject','type')),
  entity_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('create','update','void','import','link','type_update')),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  at timestamptz NOT NULL DEFAULT clock_timestamp(),
  before jsonb,
  after jsonb NOT NULL,
  reason text
);
CREATE INDEX IF NOT EXISTS rd_records_date_idx ON rewards_private.rd_records(application_date DESC NULLS LAST,id DESC);
CREATE INDEX IF NOT EXISTS rd_records_subject_date_idx ON rewards_private.rd_records(subject_id,application_date DESC NULLS LAST,id DESC);
CREATE INDEX IF NOT EXISTS rd_audit_entity_idx ON rewards_private.rd_audit(entity_kind,entity_id,at DESC,id DESC);

-- Revoke Supabase's permissive owner defaults BEFORE selective grants; same transaction.
REVOKE ALL ON ALL TABLES IN SCHEMA rewards_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA rewards_private FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION rewards_private.rd_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM rewards_private.rd_admins WHERE user_id=auth.uid());
$$;
CREATE OR REPLACE FUNCTION rewards_private.rd_require_admin() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT rewards_private.rd_is_admin() THEN RAISE EXCEPTION 'Rewards permission denied' USING ERRCODE='42501'; END IF;
END;
$$;
-- Every table is protected even if a future grant accidentally exposes its schema.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rd_admins','rd_subjects','rd_subject_origins','rd_types','rd_records','rd_sources','rd_audit'] LOOP
    EXECUTE format('ALTER TABLE rewards_private.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('DROP POLICY IF EXISTS rd_admin_read ON rewards_private.%I',t);
    IF t <> 'rd_admins' THEN
      EXECUTE format('CREATE POLICY rd_admin_read ON rewards_private.%I FOR SELECT TO authenticated USING (rewards_private.rd_is_admin())',t);
    END IF;
    -- No client INSERT/UPDATE/DELETE policy; mutations exclusively through authorized RPC.
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION rewards_private.rd_keys(p jsonb, allowed text[]) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p IS NULL OR jsonb_typeof(p)<>'object' THEN RAISE EXCEPTION 'Expected object' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p) k WHERE NOT k=ANY(allowed)) THEN RAISE EXCEPTION 'Unknown field' USING ERRCODE='22023'; END IF;
END $$;
CREATE OR REPLACE FUNCTION rewards_private.rd_text(p text, max_length integer, required boolean DEFAULT false) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p IS NULL OR length(p)>max_length OR (required AND NOT rewards_private.rd_has_text(p)) THEN RAISE EXCEPTION 'Invalid text' USING ERRCODE='22023'; END IF;
  RETURN p;
END $$;
CREATE OR REPLACE FUNCTION rewards_private.rd_json_text(p jsonb, k text, max_length integer, required boolean DEFAULT false) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF jsonb_typeof(p->k) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Expected text field' USING ERRCODE='22023'; END IF;
  RETURN rewards_private.rd_text(p->>k,max_length,required);
END $$;
CREATE OR REPLACE FUNCTION rewards_private.rd_int(p jsonb, lo integer, hi integer) RETURNS integer
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE n numeric;
BEGIN
  IF jsonb_typeof(p) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Expected integer' USING ERRCODE='22023'; END IF;
  n := p::text::numeric;
  IF trunc(n)<>n OR n<lo OR n>hi THEN RAISE EXCEPTION 'Integer out of range' USING ERRCODE='22023'; END IF;
  RETURN n::integer;
END $$;
CREATE OR REPLACE FUNCTION rewards_private.rd_date(p jsonb) RETURNS date
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE s text; d date;
BEGIN
  IF jsonb_typeof(p) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Expected date' USING ERRCODE='22023'; END IF;
  s := p #>> '{}';
  IF s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR left(s,4)='0000' THEN RAISE EXCEPTION 'Invalid date' USING ERRCODE='22023'; END IF;
  d := s::date;
  IF to_char(d,'YYYY-MM-DD')<>s THEN RAISE EXCEPTION 'Invalid date' USING ERRCODE='22023'; END IF;
  RETURN d;
END $$;
CREATE OR REPLACE FUNCTION rewards_private.rd_points(p text, max_abs numeric DEFAULT 1000000000000000) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE n numeric;
BEGIN
  IF p IS NULL OR length(p)>30 OR p !~ '^-?(0|[1-9][0-9]*)(\.[05])?$' OR p ~ '^-0(\.0)?$' THEN RAISE EXCEPTION 'Invalid half-point decimal' USING ERRCODE='22023'; END IF;
  n := p::numeric;
  IF abs(n)>max_abs THEN RAISE EXCEPTION 'Points out of range' USING ERRCODE='22023'; END IF;
  RETURN n;
END $$;
CREATE OR REPLACE FUNCTION rewards_private.rd_record_json(r rewards_private.rd_records) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id',r.id,'subject_id',r.subject_id,'subject_label',r.subject_label,
    'applicant_subject_id',r.applicant_subject_id,'applicant_label',r.applicant_label,
    'application_date',r.application_date,'event_date',r.event_date,
    'type_code',r.type_code,'type_label',r.type_label,'quantity',r.quantity,
    'unit_points',CASE WHEN r.unit_points IS NULL THEN NULL ELSE trim_scale(r.unit_points)::text END,
    'total_points',trim_scale(r.total_points)::text,'basis',r.basis,'reason',r.reason,'notes',r.notes,
    'origin',r.origin,'status',r.status,'void_reason',r.void_reason,'version',r.version,
    'created_at',r.created_at,'updated_at',r.updated_at);
$$;
CREATE OR REPLACE FUNCTION rewards_private.rd_type_json(r rewards_private.rd_types) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT to_jsonb(r) || jsonb_build_object('points',trim_scale(r.points)::text);
$$;
CREATE OR REPLACE FUNCTION rewards_private.rd_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'Append-only or immutable data' USING ERRCODE='42501'; END $$;
DROP TRIGGER IF EXISTS rd_audit_immutable ON rewards_private.rd_audit;
CREATE TRIGGER rd_audit_immutable BEFORE UPDATE OR DELETE ON rewards_private.rd_audit FOR EACH ROW EXECUTE FUNCTION rewards_private.rd_immutable();
DROP TRIGGER IF EXISTS rd_source_immutable ON rewards_private.rd_sources;
CREATE TRIGGER rd_source_immutable BEFORE UPDATE OR DELETE ON rewards_private.rd_sources FOR EACH ROW EXECUTE FUNCTION rewards_private.rd_immutable();
DROP TRIGGER IF EXISTS rd_identity_immutable ON rewards_private.rd_subject_origins;
CREATE TRIGGER rd_identity_immutable BEFORE UPDATE OR DELETE ON rewards_private.rd_subject_origins FOR EACH ROW EXECUTE FUNCTION rewards_private.rd_immutable();
DROP TRIGGER IF EXISTS rd_record_no_delete ON rewards_private.rd_records;
CREATE TRIGGER rd_record_no_delete BEFORE DELETE ON rewards_private.rd_records FOR EACH ROW EXECUTE FUNCTION rewards_private.rd_immutable();
DROP TRIGGER IF EXISTS rd_subject_no_delete ON rewards_private.rd_subjects;
CREATE TRIGGER rd_subject_no_delete BEFORE DELETE ON rewards_private.rd_subjects FOR EACH ROW EXECUTE FUNCTION rewards_private.rd_immutable();
DROP TRIGGER IF EXISTS rd_type_no_delete ON rewards_private.rd_types;
CREATE TRIGGER rd_type_no_delete BEFORE DELETE ON rewards_private.rd_types FOR EACH ROW EXECUTE FUNCTION rewards_private.rd_immutable();

-- Seed before installing type audit trigger; reruns don't overwrite edited catalogue values.
INSERT INTO rewards_private.rd_types(code,label,points) VALUES
 ('commendation','嘉獎',0.5),('minor_merit','小功',1),('major_merit','大功',3),
 ('warning','警告',-0.5),('reprimand','申誡',-0.5),('minor_demerit','小過',-1),('major_demerit','大過',-2)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION rewards_private.rd_audit_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE b jsonb; a jsonb; kind text; act text; eid text; why text;
BEGIN
  PERFORM rewards_private.rd_require_admin();
  IF TG_TABLE_NAME='rd_records' THEN
    kind := 'record'; eid := NEW.id::text; a := rewards_private.rd_record_json(NEW);
    IF TG_OP='INSERT' THEN act := CASE WHEN NEW.origin='import' THEN 'import' ELSE 'create' END;
    ELSE
      IF OLD.id<>NEW.id OR OLD.subject_id<>NEW.subject_id OR OLD.subject_label<>NEW.subject_label OR OLD.origin<>NEW.origin OR OLD.created_at<>NEW.created_at OR OLD.status='voided' THEN
        RAISE EXCEPTION 'Immutable record or voided record' USING ERRCODE='22023';
      END IF;
      b := rewards_private.rd_record_json(OLD);
      act := CASE WHEN NEW.status='voided' THEN 'void' ELSE 'update' END;
      why := NEW.void_reason;
    END IF;
  ELSIF TG_TABLE_NAME='rd_subjects' THEN
    kind := 'subject'; eid := NEW.id::text; a := to_jsonb(NEW); act := 'create';
    IF TG_OP='UPDATE' THEN b := to_jsonb(OLD); act := 'link'; END IF;
  ELSE
    kind := 'type'; eid := NEW.code; a := rewards_private.rd_type_json(NEW); act := 'type_update';
    IF TG_OP='UPDATE' THEN b := rewards_private.rd_type_json(OLD); END IF;
  END IF;
  INSERT INTO rewards_private.rd_audit(entity_kind,entity_id,action,actor_id,before,after,reason)
    VALUES(kind,eid,act,auth.uid(),b,a,why);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rd_record_audit ON rewards_private.rd_records;
CREATE TRIGGER rd_record_audit AFTER INSERT OR UPDATE ON rewards_private.rd_records FOR EACH ROW EXECUTE FUNCTION rewards_private.rd_audit_change();
DROP TRIGGER IF EXISTS rd_subject_audit ON rewards_private.rd_subjects;
-- Subject UPDATE is only performed by rd_link_subject, which appends its reviewed reason.
CREATE TRIGGER rd_subject_audit AFTER INSERT ON rewards_private.rd_subjects FOR EACH ROW EXECUTE FUNCTION rewards_private.rd_audit_change();
DROP TRIGGER IF EXISTS rd_type_audit ON rewards_private.rd_types;
CREATE TRIGGER rd_type_audit AFTER INSERT OR UPDATE ON rewards_private.rd_types FOR EACH ROW EXECUTE FUNCTION rewards_private.rd_audit_change();

CREATE OR REPLACE FUNCTION public.rd_permission() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT rewards_private.rd_is_admin(); $$;
CREATE OR REPLACE FUNCTION public.rd_list_types() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM rewards_private.rd_require_admin();
  RETURN (SELECT coalesce(jsonb_agg(rewards_private.rd_type_json(t) ORDER BY t.code),'[]'::jsonb) FROM rewards_private.rd_types t);
END $$;
CREATE OR REPLACE FUNCTION public.rd_get_record(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r rewards_private.rd_records;
BEGIN
  PERFORM rewards_private.rd_require_admin();
  SELECT * INTO r FROM rewards_private.rd_records WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Record not found' USING ERRCODE='P0002'; END IF;
  RETURN rewards_private.rd_record_json(r);
END $$;
CREATE OR REPLACE FUNCTION rewards_private.rd_filter(p jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  PERFORM rewards_private.rd_keys(p,ARRAY['search','year','type_code','subject_id','status','from_date','to_date','page','page_size']);
  PERFORM rewards_private.rd_int(coalesce(p->'page','1'),1,1000000);
  PERFORM rewards_private.rd_int(coalesce(p->'page_size','20'),1,100);
  IF p ? 'search' THEN PERFORM rewards_private.rd_json_text(p,'search',200); END IF;
  IF p ? 'year' THEN PERFORM rewards_private.rd_int(p->'year',1,9999); END IF;
  IF p ? 'type_code' THEN
    IF rewards_private.rd_json_text(p,'type_code',50,true) !~ '^[a-z][a-z0-9_]{0,49}$' THEN RAISE EXCEPTION 'Invalid type' USING ERRCODE='22023'; END IF;
  END IF;
  IF p ? 'subject_id' THEN PERFORM rewards_private.rd_json_text(p,'subject_id',36,true)::uuid; END IF;
  IF p ? 'status' AND rewards_private.rd_json_text(p,'status',20,true) NOT IN ('recorded','voided') THEN RAISE EXCEPTION 'Invalid status' USING ERRCODE='22023'; END IF;
  IF p ? 'from_date' THEN PERFORM rewards_private.rd_date(p->'from_date'); END IF;
  IF p ? 'to_date' THEN PERFORM rewards_private.rd_date(p->'to_date'); END IF;
  IF p->>'from_date'>p->>'to_date' THEN RAISE EXCEPTION 'Invalid date range' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('page',1,'page_size',20)||p;
END $$;
CREATE OR REPLACE FUNCTION public.rd_list_records(p_filter jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE f jsonb; result jsonb;
BEGIN
  PERFORM rewards_private.rd_require_admin(); f := rewards_private.rd_filter(p_filter);
  WITH filtered AS MATERIALIZED (
    SELECT r.* FROM rewards_private.rd_records r
    WHERE (NOT f?'subject_id' OR r.subject_id=(f->>'subject_id')::uuid)
      AND (NOT f?'type_code' OR r.type_code=f->>'type_code')
      AND (NOT f?'status' OR r.status=f->>'status')
      AND (NOT f?'year' OR extract(year FROM r.application_date)=(f->>'year')::integer)
      AND (NOT f?'from_date' OR r.application_date>=(f->>'from_date')::date)
      AND (NOT f?'to_date' OR r.application_date<=(f->>'to_date')::date)
      AND (NOT f?'search' OR strpos(lower(r.subject_label||E'\n'||r.type_label||E'\n'||r.reason),lower(f->>'search'))>0)
  ), paged AS (
    SELECT * FROM filtered ORDER BY application_date DESC NULLS LAST,id DESC
    LIMIT (f->>'page_size')::integer OFFSET ((f->>'page')::integer-1)*(f->>'page_size')::integer
  )
  SELECT jsonb_build_object(
    'items',(SELECT coalesce(jsonb_agg(rewards_private.rd_record_json(p) ORDER BY p.application_date DESC NULLS LAST,p.id DESC),'[]') FROM paged p),
    'total',count(*),'page',(f->>'page')::integer,'page_size',(f->>'page_size')::integer,
    'summary',jsonb_build_object('recorded_count',count(*) FILTER(WHERE status='recorded'),'voided_count',count(*) FILTER(WHERE status='voided'),
      'total_points',trim_scale(coalesce(sum(total_points) FILTER(WHERE status='recorded'),0))::text)
  ) INTO result FROM filtered;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.rd_subject_history(p_subject_id uuid,p_filter jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM rewards_private.rd_require_admin();
  IF NOT EXISTS(SELECT 1 FROM rewards_private.rd_subjects WHERE id=p_subject_id) THEN RAISE EXCEPTION 'Subject not found' USING ERRCODE='P0002'; END IF;
  PERFORM rewards_private.rd_filter(p_filter);
  RETURN public.rd_list_records(p_filter||jsonb_build_object('subject_id',p_subject_id));
END $$;
CREATE OR REPLACE FUNCTION public.rd_subject_picker(p_search text DEFAULT '',p_page integer DEFAULT 1,p_page_size integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM rewards_private.rd_require_admin(); PERFORM rewards_private.rd_text(p_search,200);
  IF p_page IS NULL OR p_page NOT BETWEEN 1 AND 1000000 OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid pagination' USING ERRCODE='22023'; END IF;
  RETURN (WITH f AS MATERIALIZED(SELECT * FROM rewards_private.rd_subjects WHERE strpos(lower(label),lower(p_search))>0),
    p AS(SELECT * FROM f ORDER BY label,id LIMIT p_page_size OFFSET (p_page-1)*p_page_size)
    SELECT jsonb_build_object('items',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY label,id),'[]') FROM p),'total',count(*),'page',p_page,'page_size',p_page_size) FROM f);
END $$;
CREATE OR REPLACE FUNCTION public.rd_employee_picker(p_search text DEFAULT '',p_page integer DEFAULT 1,p_page_size integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM rewards_private.rd_require_admin(); PERFORM rewards_private.rd_text(p_search,200);
  IF p_page IS NULL OR p_page NOT BETWEEN 1 AND 1000000 OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid pagination' USING ERRCODE='22023'; END IF;
  RETURN (WITH f AS MATERIALIZED(SELECT id,name,department FROM public.employees WHERE is_active IS TRUE AND strpos(lower(name),lower(p_search))>0),
    p AS(SELECT * FROM f ORDER BY name,id LIMIT p_page_size OFFSET (p_page-1)*p_page_size)
    SELECT jsonb_build_object('items',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY name,id),'[]') FROM p),'total',count(*),'page',p_page,'page_size',p_page_size) FROM f);
END $$;
CREATE OR REPLACE FUNCTION public.rd_create_subject(p_label text,p_employee_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r rewards_private.rd_subjects; label_value text;
BEGIN
  PERFORM rewards_private.rd_require_admin(); label_value := rewards_private.rd_text(p_label,200,true);
  IF p_employee_id IS NOT NULL THEN
    SELECT name INTO label_value FROM public.employees WHERE id=p_employee_id AND is_active IS TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Active employee not found' USING ERRCODE='P0002'; END IF;
  END IF;
  INSERT INTO rewards_private.rd_subjects(label,employee_id) VALUES(label_value,p_employee_id) RETURNING * INTO r;
  RETURN to_jsonb(r);
END $$;
CREATE OR REPLACE FUNCTION public.rd_link_subject(p_id uuid,p_expected_version integer,p_employee_id uuid,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r rewards_private.rd_subjects; b jsonb;
BEGIN
  PERFORM rewards_private.rd_require_admin(); PERFORM rewards_private.rd_text(p_reason,2000,true);
  SELECT * INTO r FROM rewards_private.rd_subjects WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subject not found' USING ERRCODE='P0002'; END IF;
  IF p_expected_version IS DISTINCT FROM r.version THEN RAISE EXCEPTION 'Stale version' USING ERRCODE='40001'; END IF;
  IF p_employee_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.employees WHERE id=p_employee_id) THEN RAISE EXCEPTION 'Employee not found' USING ERRCODE='P0002'; END IF;
  -- Link reason is domain audit data, not a session GUC a client can forge.
  b := to_jsonb(r);
  IF r.employee_id IS NOT DISTINCT FROM p_employee_id THEN RETURN b; END IF;
  UPDATE rewards_private.rd_subjects SET employee_id=p_employee_id,version=version+1 WHERE id=p_id RETURNING * INTO r;
  -- No generic UPDATE trigger on subjects: append exactly one reviewed link event.
  INSERT INTO rewards_private.rd_audit(entity_kind,entity_id,action,actor_id,before,after,reason)
    VALUES('subject',p_id::text,'link',auth.uid(),b,to_jsonb(r),p_reason);
  RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION rewards_private.rd_validate_record_input(p jsonb,is_create boolean) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE k text; allowed text[] := ARRAY['application_date','event_date','applicant_subject_id','type_code','quantity','basis','reason','notes'];
BEGIN
  IF is_create THEN allowed := allowed||ARRAY['subject_id']; END IF;
  PERFORM rewards_private.rd_keys(p,allowed);
  IF p='{}' THEN RAISE EXCEPTION 'Empty mutation' USING ERRCODE='22023'; END IF;
  IF is_create THEN
    FOREACH k IN ARRAY ARRAY['subject_id','application_date','type_code','quantity','reason'] LOOP
      IF NOT p?k THEN RAISE EXCEPTION 'Missing required field' USING ERRCODE='22023'; END IF;
    END LOOP;
    PERFORM rewards_private.rd_json_text(p,'subject_id',36,true)::uuid;
  END IF;
  IF p?'application_date' THEN PERFORM rewards_private.rd_date(p->'application_date'); END IF;
  IF p?'event_date' AND p->'event_date'<>'null'::jsonb THEN PERFORM rewards_private.rd_date(p->'event_date'); END IF;
  IF p?'applicant_subject_id' AND p->'applicant_subject_id'<>'null'::jsonb THEN PERFORM rewards_private.rd_json_text(p,'applicant_subject_id',36,true)::uuid; END IF;
  IF p?'quantity' THEN PERFORM rewards_private.rd_int(p->'quantity',1,1000000); END IF;
  IF p?'type_code' AND rewards_private.rd_json_text(p,'type_code',50,true) !~ '^[a-z][a-z0-9_]{0,49}$' THEN RAISE EXCEPTION 'Invalid type code' USING ERRCODE='22023'; END IF;
  IF p?'basis' THEN PERFORM rewards_private.rd_json_text(p,'basis',2000); END IF;
  IF p?'reason' THEN PERFORM rewards_private.rd_json_text(p,'reason',4000,true); END IF;
  IF p?'notes' THEN PERFORM rewards_private.rd_json_text(p,'notes',4000); END IF;
END $$;
CREATE OR REPLACE FUNCTION public.rd_create_record(p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r rewards_private.rd_records; t rewards_private.rd_types; s rewards_private.rd_subjects; a rewards_private.rd_subjects;
BEGIN
  PERFORM rewards_private.rd_require_admin(); PERFORM rewards_private.rd_validate_record_input(p_input,true);
  SELECT * INTO s FROM rewards_private.rd_subjects WHERE id=(p_input->>'subject_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subject not found' USING ERRCODE='P0002'; END IF;
  IF p_input->>'applicant_subject_id' IS NOT NULL THEN
    SELECT * INTO a FROM rewards_private.rd_subjects WHERE id=(p_input->>'applicant_subject_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Applicant not found' USING ERRCODE='P0002'; END IF;
  END IF;
  SELECT * INTO t FROM rewards_private.rd_types WHERE code=p_input->>'type_code' AND active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active type not found' USING ERRCODE='22023'; END IF;
  INSERT INTO rewards_private.rd_records(subject_id,subject_label,applicant_subject_id,applicant_label,application_date,event_date,type_code,type_label,quantity,unit_points,total_points,basis,reason,notes,origin)
    VALUES(s.id,s.label,a.id,a.label,(p_input->>'application_date')::date,(p_input->>'event_date')::date,t.code,t.label,rewards_private.rd_int(p_input->'quantity',1,1000000),t.points,t.points*rewards_private.rd_int(p_input->'quantity',1,1000000),coalesce(p_input->>'basis',''),p_input->>'reason',coalesce(p_input->>'notes',''),'manual') RETURNING * INTO r;
  RETURN rewards_private.rd_record_json(r);
END $$;
CREATE OR REPLACE FUNCTION public.rd_update_record(p_id uuid,p_expected_version integer,p_patch jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r rewards_private.rd_records; t rewards_private.rd_types; a rewards_private.rd_subjects; new_type text; new_quantity integer;
BEGIN
  PERFORM rewards_private.rd_require_admin(); PERFORM rewards_private.rd_validate_record_input(p_patch,false);
  SELECT * INTO r FROM rewards_private.rd_records WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Record not found' USING ERRCODE='P0002'; END IF;
  IF p_expected_version IS DISTINCT FROM r.version THEN RAISE EXCEPTION 'Stale version' USING ERRCODE='40001'; END IF;
  IF r.status='voided' THEN RAISE EXCEPTION 'Voided record cannot be edited' USING ERRCODE='22023'; END IF;
  new_type := CASE WHEN p_patch?'type_code' THEN p_patch->>'type_code' ELSE r.type_code END;
  new_quantity := CASE WHEN p_patch?'quantity' THEN rewards_private.rd_int(p_patch->'quantity',1,1000000) ELSE r.quantity END;
  IF new_type IS DISTINCT FROM r.type_code OR new_quantity IS DISTINCT FROM r.quantity THEN
    SELECT * INTO t FROM rewards_private.rd_types WHERE code=new_type AND active FOR SHARE;
    IF NOT FOUND OR new_quantity IS NULL THEN RAISE EXCEPTION 'Active type and quantity required to recalculate' USING ERRCODE='22023'; END IF;
    r.type_code := t.code; r.type_label := t.label; r.quantity := new_quantity; r.unit_points := t.points; r.total_points := t.points*new_quantity;
  END IF;
  IF p_patch?'applicant_subject_id' THEN
    IF p_patch->>'applicant_subject_id' IS NOT NULL THEN
      SELECT * INTO a FROM rewards_private.rd_subjects WHERE id=(p_patch->>'applicant_subject_id')::uuid;
      IF NOT FOUND THEN RAISE EXCEPTION 'Applicant not found' USING ERRCODE='P0002'; END IF;
    END IF;
    r.applicant_subject_id:=a.id; r.applicant_label:=a.label;
  END IF;
  UPDATE rewards_private.rd_records SET
    application_date=CASE WHEN p_patch?'application_date' THEN (p_patch->>'application_date')::date ELSE r.application_date END,
    event_date=CASE WHEN p_patch?'event_date' THEN (p_patch->>'event_date')::date ELSE r.event_date END,
    applicant_subject_id=r.applicant_subject_id,applicant_label=r.applicant_label,
    type_code=r.type_code,type_label=r.type_label,quantity=r.quantity,unit_points=r.unit_points,total_points=r.total_points,
    basis=coalesce(p_patch->>'basis',r.basis),reason=coalesce(p_patch->>'reason',r.reason),notes=coalesce(p_patch->>'notes',r.notes),
    version=r.version+1,updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO r;
  RETURN rewards_private.rd_record_json(r);
END $$;
CREATE OR REPLACE FUNCTION public.rd_void_record(p_id uuid,p_expected_version integer,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r rewards_private.rd_records;
BEGIN
  PERFORM rewards_private.rd_require_admin(); PERFORM rewards_private.rd_text(p_reason,2000,true);
  SELECT * INTO r FROM rewards_private.rd_records WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Record not found' USING ERRCODE='P0002'; END IF;
  IF p_expected_version IS DISTINCT FROM r.version THEN RAISE EXCEPTION 'Stale version' USING ERRCODE='40001'; END IF;
  IF r.status='voided' THEN RAISE EXCEPTION 'Already voided' USING ERRCODE='22023'; END IF;
  UPDATE rewards_private.rd_records SET status='voided',void_reason=p_reason,version=version+1,updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO r;
  RETURN rewards_private.rd_record_json(r);
END $$;
CREATE OR REPLACE FUNCTION public.rd_record_audit(p_record_id uuid,p_page integer DEFAULT 1,p_page_size integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM rewards_private.rd_require_admin();
  IF p_page IS NULL OR p_page NOT BETWEEN 1 AND 1000000 OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid pagination' USING ERRCODE='22023'; END IF;
  PERFORM public.rd_get_record(p_record_id);
  RETURN (WITH f AS MATERIALIZED(SELECT * FROM rewards_private.rd_audit WHERE entity_kind='record' AND entity_id=p_record_id::text),
    p AS(SELECT * FROM f ORDER BY at DESC,id DESC LIMIT p_page_size OFFSET (p_page-1)*p_page_size)
    SELECT jsonb_build_object('items',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY at DESC,id DESC),'[]') FROM p),'total',count(*),'page',p_page,'page_size',p_page_size) FROM f);
END $$;
CREATE OR REPLACE FUNCTION public.rd_save_type(p_code text,p_expected_version integer,p_label text,p_points text,p_active boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t rewards_private.rd_types; n numeric;
BEGIN
  PERFORM rewards_private.rd_require_admin(); PERFORM rewards_private.rd_text(p_label,200,true); n:=rewards_private.rd_points(p_points,1000000000);
  IF p_active IS NULL THEN RAISE EXCEPTION 'Active required' USING ERRCODE='22023'; END IF;
  SELECT * INTO t FROM rewards_private.rd_types WHERE code=p_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Type not found' USING ERRCODE='P0002'; END IF;
  IF p_expected_version IS DISTINCT FROM t.version THEN RAISE EXCEPTION 'Stale version' USING ERRCODE='40001'; END IF;
  UPDATE rewards_private.rd_types SET label=p_label,points=n,active=p_active,version=version+1 WHERE code=p_code RETURNING * INTO t;
  RETURN rewards_private.rd_type_json(t);
END $$;

-- Owner-only historical import helpers. Not granted and not in exposed schema.
CREATE OR REPLACE FUNCTION rewards_private.rd_import_subject(p jsonb) RETURNS rewards_private.rd_subjects
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r rewards_private.rd_subjects; origin_id uuid; k text;
BEGIN
  PERFORM rewards_private.rd_require_admin();
  PERFORM rewards_private.rd_keys(p,ARRAY['spreadsheet_id','gid','person_id','label','raw']);
  FOREACH k IN ARRAY ARRAY['spreadsheet_id','person_id'] LOOP PERFORM rewards_private.rd_json_text(p,k,300,true); END LOOP;
  PERFORM rewards_private.rd_json_text(p,'gid',100,true); PERFORM rewards_private.rd_json_text(p,'label',200,true);
  IF NOT p?'raw' THEN RAISE EXCEPTION 'Raw capture required' USING ERRCODE='22023'; END IF;
  -- Serialize namespace+identity creation without leaking identity in audit.
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array(p->>'spreadsheet_id',p->>'gid',p->>'person_id')::text,0));
  SELECT subject_id INTO origin_id FROM rewards_private.rd_subject_origins WHERE spreadsheet_id=p->>'spreadsheet_id' AND gid=p->>'gid' AND person_id=p->>'person_id';
  IF FOUND THEN SELECT * INTO r FROM rewards_private.rd_subjects WHERE id=origin_id; RETURN r; END IF;
  INSERT INTO rewards_private.rd_subjects(label) VALUES(p->>'label') RETURNING * INTO r;
  INSERT INTO rewards_private.rd_subject_origins(subject_id,spreadsheet_id,gid,person_id,raw) VALUES(r.id,p->>'spreadsheet_id',p->>'gid',p->>'person_id',p->'raw');
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION rewards_private.rd_import_record(p_source jsonb,p_record jsonb,p_subject jsonb,p_applicant jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing uuid; r rewards_private.rd_records; s rewards_private.rd_subjects; a rewards_private.rd_subjects; k text; n numeric; q integer;
BEGIN
  PERFORM rewards_private.rd_require_admin();
  PERFORM rewards_private.rd_keys(p_source,ARRAY['spreadsheet_id','gid','record_id','raw','source_updated_raw']);
  FOREACH k IN ARRAY ARRAY['spreadsheet_id','record_id'] LOOP PERFORM rewards_private.rd_json_text(p_source,k,300,true); END LOOP;
  PERFORM rewards_private.rd_json_text(p_source,'gid',100,true);
  IF NOT p_source?'raw' THEN RAISE EXCEPTION 'Raw capture required' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array(p_source->>'spreadsheet_id',p_source->>'gid',p_source->>'record_id')::text,1));
  SELECT record_id INTO existing FROM rewards_private.rd_sources WHERE spreadsheet_id=p_source->>'spreadsheet_id' AND gid=p_source->>'gid' AND source_record_id=p_source->>'record_id';
  IF FOUND THEN RETURN jsonb_build_object('id',existing,'inserted',false); END IF;
  PERFORM rewards_private.rd_keys(p_record,ARRAY['application_date','event_date','type_code','type_label','quantity','total_points','basis','reason','notes']);
  IF p_record?'application_date' AND p_record->'application_date'<>'null'::jsonb THEN PERFORM rewards_private.rd_date(p_record->'application_date'); END IF;
  IF p_record?'event_date' AND p_record->'event_date'<>'null'::jsonb THEN PERFORM rewards_private.rd_date(p_record->'event_date'); END IF;
  IF p_record?'quantity' AND p_record->'quantity'<>'null'::jsonb THEN q:=rewards_private.rd_int(p_record->'quantity',1,1000000); END IF;
  PERFORM rewards_private.rd_json_text(p_record,'type_label',200,true);
  n:=rewards_private.rd_points(rewards_private.rd_json_text(p_record,'total_points',30,true));
  FOREACH k IN ARRAY ARRAY['basis','reason','notes'] LOOP
    IF p_record?k THEN PERFORM rewards_private.rd_json_text(p_record,k,CASE WHEN k='basis' THEN 2000 ELSE 4000 END); END IF;
  END LOOP;
  IF p_source?'source_updated_raw' AND p_source->'source_updated_raw'<>'null'::jsonb THEN PERFORM rewards_private.rd_json_text(p_source,'source_updated_raw',4000); END IF;
  s:=rewards_private.rd_import_subject(p_subject);
  IF p_applicant IS NOT NULL AND p_applicant<>'null'::jsonb THEN a:=rewards_private.rd_import_subject(p_applicant); END IF;
  INSERT INTO rewards_private.rd_records(subject_id,subject_label,applicant_subject_id,applicant_label,application_date,event_date,type_code,type_label,quantity,unit_points,total_points,basis,reason,notes,origin)
    VALUES(s.id,s.label,a.id,a.label,(p_record->>'application_date')::date,(p_record->>'event_date')::date,p_record->>'type_code',p_record->>'type_label',q,NULL,n,coalesce(p_record->>'basis',''),coalesce(p_record->>'reason',''),coalesce(p_record->>'notes',''),'import') RETURNING * INTO r;
  INSERT INTO rewards_private.rd_sources(record_id,spreadsheet_id,gid,source_record_id,raw,source_updated_raw)
    VALUES(r.id,p_source->>'spreadsheet_id',p_source->>'gid',p_source->>'record_id',p_source->'raw',p_source->>'source_updated_raw');
  RETURN jsonb_build_object('id',r.id,'inserted',true);
END $$;

-- Functions also inherit permissive defaults. Revoke ALL before granting exact RPC allowlist.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rewards_private FROM PUBLIC, anon, authenticated, service_role;
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=ANY(ARRAY['rd_permission','rd_list_types','rd_get_record','rd_list_records','rd_subject_history','rd_subject_picker','rd_employee_picker','rd_create_subject','rd_link_subject','rd_create_record','rd_update_record','rd_void_record','rd_record_audit','rd_save_type'])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f);
  END LOOP;
END $$;
COMMIT;

-- 心安居午間值班: separate from shift swaps and original punch records.
-- A privileged operator must provision admin_duty_editors via service role/SQL using
-- the actual Supabase auth.users.id. Never grant this table to browser clients.
CREATE TABLE IF NOT EXISTS public.admin_duty_editors (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
REVOKE ALL ON public.admin_duty_editors FROM PUBLIC, anon, authenticated;
ALTER TABLE public.admin_duty_editors ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.employee_lunch_duties (
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  duty_date date NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, duty_date)
);
CREATE INDEX IF NOT EXISTS employee_lunch_duties_date_idx ON public.employee_lunch_duties(duty_date);
ALTER TABLE public.employee_lunch_duties ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employee_lunch_duties FROM PUBLIC, anon, authenticated;

-- Keep history even when switched off; no browser DELETE policy. Trigger audits all
-- mutations, including service-role operations. Explicitly revoke access to history.
CREATE TABLE IF NOT EXISTS public.employee_lunch_duty_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id uuid NOT NULL,
  duty_date date NOT NULL,
  old_enabled boolean,
  new_enabled boolean,
  actor_id uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_lunch_duty_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employee_lunch_duty_audit FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_employee_lunch_duty() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.employee_id IS DISTINCT FROM OLD.employee_id OR NEW.duty_date IS DISTINCT FROM OLD.duty_date) THEN
    RAISE EXCEPTION 'Duty identity is immutable';
  END IF;
  IF TG_OP = 'INSERT' OR OLD.enabled IS DISTINCT FROM NEW.enabled THEN
    INSERT INTO public.employee_lunch_duty_audit(employee_id, duty_date, old_enabled, new_enabled, actor_id)
    VALUES (NEW.employee_id, NEW.duty_date,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.enabled END,
      NEW.enabled, NEW.updated_by);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.audit_employee_lunch_duty() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS employee_lunch_duty_audit_trigger ON public.employee_lunch_duties;
CREATE TRIGGER employee_lunch_duty_audit_trigger AFTER INSERT OR UPDATE ON public.employee_lunch_duties
FOR EACH ROW EXECUTE FUNCTION public.audit_employee_lunch_duty();

CREATE OR REPLACE FUNCTION public.is_lunch_duty_editor() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_duty_editors WHERE user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_lunch_duty_editor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_lunch_duty_editor() TO authenticated;

DROP POLICY IF EXISTS "duty authenticated read" ON public.employee_lunch_duties;
DROP POLICY IF EXISTS "duty calendar read" ON public.employee_lunch_duties;
-- Employee PIN sessions use the anon Supabase client (EmployeeContext); read-only
-- parity with existing attendance calendar data. Only admin auth UUIDs can write.
CREATE POLICY "duty calendar read" ON public.employee_lunch_duties
FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "duty admin insert" ON public.employee_lunch_duties;
CREATE POLICY "duty admin insert" ON public.employee_lunch_duties
FOR INSERT TO authenticated WITH CHECK (
  updated_by = (select auth.uid()) AND (select public.is_lunch_duty_editor())
  AND EXISTS (SELECT 1 FROM public.employees WHERE id = employee_id AND department = '心安居')
);
DROP POLICY IF EXISTS "duty admin update" ON public.employee_lunch_duties;
CREATE POLICY "duty admin update" ON public.employee_lunch_duties
FOR UPDATE TO authenticated USING (
  (select public.is_lunch_duty_editor())
) WITH CHECK (
  updated_by = (select auth.uid()) AND (select public.is_lunch_duty_editor())
  AND EXISTS (SELECT 1 FROM public.employees WHERE id = employee_id AND department = '心安居')
);
GRANT SELECT ON public.employee_lunch_duties TO anon;
GRANT SELECT, INSERT ON public.employee_lunch_duties TO authenticated;
GRANT UPDATE (enabled, updated_by, updated_at) ON public.employee_lunch_duties TO authenticated;

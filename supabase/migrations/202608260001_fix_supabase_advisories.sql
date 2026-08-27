-- Fix Supabase security/performance advisories detected by the linter.
-- Safe to re-run: these statements guard against missing objects and duplicate indexes.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'handle_updated_at'
  ) THEN
    ALTER FUNCTION public.handle_updated_at() SET search_path = public;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'touch_employee_module_access_updated_at'
  ) THEN
    ALTER FUNCTION public.touch_employee_module_access_updated_at() SET search_path = public;
  END IF;
END $$;

DO $$
DECLARE
  fn_name text[] := ARRAY[
    'public.current_company_id()',
    'public.user_has_company_access(uuid)',
    'public.default_membership_role_to_owner()',
    'public.is_company_admin(uuid)',
    'public.rls_auto_enable()',
    'public.seed_owner_role()'
  ];
  current_fn text;
BEGIN
  FOREACH current_fn IN ARRAY fn_name LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC;', current_fn);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon;', current_fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', current_fn);
    EXCEPTION WHEN undefined_function THEN
      NULL;
    END;
  END LOOP;
END $$;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name NOT IN ('memberships')
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s ON public.%I(%I)',
      replace(lower(rec.constraint_name), '-', '_'),
      rec.table_name,
      rec.column_name
    );
  END LOOP;
END $$;

-- Keep RLS-isolated helper functions available only through the service role / policies.
-- The app should not invoke these via anon/authenticated RPCs.

-- Fix ambiguous relationship between memberships and users.
-- There were two FK references from memberships.user_id and memberships.invited_by to public.users.
-- Renaming the second relation removes the ambiguity for Supabase Studio / embedded relationship introspection.

alter table if exists public.memberships
  drop constraint if exists memberships_invited_by_fkey;

alter table if exists public.memberships
  drop constraint if exists memberships_invited_by_user_id_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'memberships'
      AND column_name = 'invited_by'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'memberships'
      AND column_name = 'invited_by_user_id'
  ) THEN
    ALTER TABLE public.memberships
      RENAME COLUMN invited_by TO invited_by_user_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'memberships'
      AND column_name = 'invited_by_user_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.memberships'::regclass
      AND a.attname = 'invited_by_user_id'
  ) THEN
    ALTER TABLE public.memberships
      ADD CONSTRAINT memberships_invited_by_user_id_fkey
      FOREIGN KEY (invited_by_user_id)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

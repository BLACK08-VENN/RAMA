-- Harden saved_designs row ownership.
--
-- The original policies shipped in 20260928000000_create_saved_designs.sql left two gaps:
--
--   1. The UPDATE policy used USING only. USING selects which rows may be updated, but it
--      places no constraint on the row as it ends up. A client could therefore update one
--      of its own rows while rewriting user_id to any other UUID in the payload, handing
--      ownership of that row to another account. Every other policy keys off
--      auth.uid() = user_id, so that single writable field is what the whole ownership
--      boundary rests on.
--   2. user_id was nullable. auth.uid() = NULL is never true, so such rows are invisible
--      to every caller through the API and can never be reclaimed or deleted by their
--      creator -- they are orphaned permanently.
--
-- This is a forward migration rather than an edit to the original, so that databases
-- which already applied it converge on the same end state as a fresh reset.

-- Clear unowned rows before NOT NULL can be enforced. These have no reachable owner:
-- RLS already hides them from every caller, so there is nothing here to recover.
DELETE FROM saved_designs WHERE user_id IS NULL;

ALTER TABLE saved_designs
  ALTER COLUMN user_id SET NOT NULL;

-- Re-issue INSERT as well so the two write paths state the constraint identically.
-- (The original WITH CHECK was already correct; this is defensive against drift.)
DROP POLICY IF EXISTS "Users can insert own designs" ON saved_designs;

CREATE POLICY "Users can insert own designs"
  ON saved_designs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own designs" ON saved_designs;

CREATE POLICY "Users can update own designs"
  ON saved_designs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Note: FORCE ROW LEVEL SECURITY is deliberately not enabled. anon and authenticated are
-- already non-owners and are covered above, while forcing it would additionally block the
-- postgres owner in the Supabase SQL editor, where legitimate data cleanup would fail.
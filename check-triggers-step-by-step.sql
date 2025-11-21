-- ============================================================================
-- RUN DEZE QUERIES ÉÉN VOOR ÉÉN EN STUUR ELKE OUTPUT
-- ============================================================================

-- 🔥 QUERY 1: Welke triggers zijn er op auth.users?
-- Kopieer deze query, run hem, en stuur de output
SELECT 
  trigger_name,
  event_manipulation as trigger_event,
  action_timing as timing,
  action_statement as function_called
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND event_object_schema = 'auth'
ORDER BY action_order;


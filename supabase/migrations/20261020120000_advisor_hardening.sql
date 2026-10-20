-- Close three findings from Supabase's security advisor (2026-10-20), the
-- first time the advisor has been read from inside the project.
--
-- All three are hygiene rather than live holes, but two are the exact class
-- of defect that bit increment_ask_usage: a SECURITY DEFINER function that the
-- client roles could call directly over /rest/v1/rpc.

-- 1. handle_new_user() — the auth.users INSERT trigger that creates a profile
--    row. SECURITY DEFINER and callable by anon and authenticated via RPC.
--
--    Revoked from the two named client roles ONLY — deliberately NOT from
--    PUBLIC. The trigger fires when supabase_auth_admin inserts into
--    auth.users, and Postgres checks EXECUTE for the role running the firing
--    statement. supabase_auth_admin holds EXECUTE today only through the
--    PUBLIC default; revoking from PUBLIC would strip it and silently break
--    every new signup. The advisor only names anon and authenticated, and that
--    is the whole exposure.
revoke execute on function public.handle_new_user() from anon, authenticated;

-- 2. rls_auto_enable() — an event-trigger function that enables RLS on new
--    public tables. Same shape, same fix. Event triggers run as the DDL
--    issuer (postgres), which keeps EXECUTE through its own default grant.
revoke execute on function public.rls_auto_enable() from anon, authenticated;

-- 3. is_quiet_hours(text) — called from alerts_due(), which is SECURITY
--    DEFINER, so a mutable search_path here is a path for a malicious schema
--    to shadow the functions it resolves. Pinned like every other function in
--    this schema already is. It is not itself SECURITY DEFINER and is not
--    callable by the client roles, so this is defence in depth, not a hole.
alter function public.is_quiet_hours(text) set search_path = public;

-- Not addressed: pg_net installed in the public schema. Moving an extension's
-- schema is a larger change with a real chance of breaking the pg_cron jobs
-- that call net.http_post(), for a lint that is advisory. Left for a
-- deliberate maintenance window, not folded into a hardening pass.

-- Function hardening, following the RLS lockdown.
--
-- 1. handle_new_user() is a SECURITY DEFINER trigger function (auth.users
--    -> profiles) that was directly invocable by anon/authenticated via the
--    PostgREST RPC endpoint. Revoke EXECUTE so it cannot be called directly.
--    The signup trigger still fires on user creation: trigger execution does
--    not check the caller's EXECUTE privilege, and the function runs as its
--    owner regardless.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2. Pin a non-mutable search_path on the vector-search functions. They are
--    SECURITY INVOKER and reference chunks/stories/images and the `vector`
--    extension (the <=> operator and type) unqualified; all live in the
--    public schema, so pinning to public clears the mutable-search_path
--    warning without breaking those references.
alter function public.search_chunks set search_path = public;
alter function public.search_images set search_path = public;

-- Open persona_config writes while the auth layer is disabled.
--
-- The archive currently runs with AUTH_ENABLED = false (a private prototype;
-- see web/app/lib/config.ts), so there is no signed-in admin and the
-- admin-only write policy would deny every save from the open /admin editor.
-- This replaces that policy with an open one so the editor is usable.
--
-- SECURITY NOTE: this lets anyone with the public anon key edit personas AND
-- the global shared-rules safety block. That is acceptable only because the
-- site is a private, unlisted prototype. When the auth layer is re-enabled,
-- restore the admin-only policy (see the dynamic_personas migration).

drop policy if exists persona_config_admin_write on persona_config;
drop policy if exists persona_config_open_write on persona_config;

create policy persona_config_open_write on persona_config
  for all to anon, authenticated
  using (true)
  with check (true);

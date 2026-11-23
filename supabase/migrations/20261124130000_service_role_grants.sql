-- New Supabase projects no longer give the server-side role (service_role) access to tables
-- automatically. The edge functions (create and reset logins, audit log) and the admin scripts
-- use that role, so it needs explicit access. It bypasses row-level security by design, which is
-- why its key is kept out of the app and lives only in the functions' environment and your terminal.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

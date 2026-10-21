#!/bin/bash
set -euo pipefail
umask 077
psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE SCHEMA IF NOT EXISTS oms_deploy;
REVOKE ALL ON SCHEMA oms_deploy FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS oms_deploy.migrations(version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN CREATE PUBLICATION supabase_realtime; END IF; END $$;
SQL
for file in /tmp/oms-migrations/*.sql; do
 name=$(basename "$file"); digest=$(sha256sum "$file" | cut -d ' ' -f1)
 existing=$(psql -U supabase_admin -d postgres -Atc "SELECT checksum FROM oms_deploy.migrations WHERE version='$name'")
 if [ -n "$existing" ]; then test "$existing" = "$digest"; continue; fi
 { printf 'BEGIN;\n'; cat "$file"; printf "\nINSERT INTO oms_deploy.migrations(version,checksum) VALUES ('%s','%s');\nCOMMIT;\n" "$name" "$digest"; } | psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q >/tmp/oms-migration.log 2>&1 || { echo "Failed: $name"; tail -12 /tmp/oms-migration.log; exit 1; }
 echo "Applied: $name"
done
psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
INSERT INTO storage.buckets(id,name,public) VALUES ('product-attachments','product-attachments',false) ON CONFLICT(id) DO NOTHING;
-- An HTTPS Kubernetes job handles outbound delivery. Never call the old cloud.
DO $patch$ DECLARE definition text; BEGIN
 definition := pg_get_functiondef('public.run_scheduled_housekeeping()'::regprocedure);
 definition := regexp_replace(definition, 'IF due > 0 OR mail > 0 THEN[[:space:]]+PERFORM net.http_post[(].*?END IF;', '-- Outbound delivery is handled by oms-dispatch over verified HTTPS.', 's');
 IF definition LIKE '%project--3bf5c787%' THEN RAISE EXCEPTION 'Old cloud callback remains'; END IF;
 EXECUTE definition;
END $patch$;
NOTIFY pgrst, 'reload schema';
SELECT count(*) AS verified_migrations FROM oms_deploy.migrations;
SQL

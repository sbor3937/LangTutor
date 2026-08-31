#!/bin/sh
set -eu
: "${LANGTUTOR_RUNTIME_PASSWORD:?required}"
: "${LANGTUTOR_MIGRATION_PASSWORD:?required}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /opt/langtutor/bootstrap-roles.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=database_name="$POSTGRES_DB" --set=runtime_password="$LANGTUTOR_RUNTIME_PASSWORD" --set=migration_password="$LANGTUTOR_MIGRATION_PASSWORD" <<'SQL'
ALTER ROLE langtutor_runtime LOGIN PASSWORD :'runtime_password';
ALTER ROLE langtutor_migrator LOGIN PASSWORD :'migration_password';
GRANT CONNECT ON DATABASE :"database_name" TO langtutor_runtime, langtutor_migrator, langtutor_authenticator;
GRANT CREATE ON DATABASE :"database_name" TO langtutor_owner;
SQL

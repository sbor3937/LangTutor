FROM postgres:17-alpine

COPY deploy/postgres/bootstrap-roles.sql /opt/langtutor/bootstrap-roles.sql
COPY deploy/postgres/init-roles.sh /docker-entrypoint-initdb.d/10-langtutor-roles.sh
RUN chmod 0444 /opt/langtutor/bootstrap-roles.sql \
  && chmod 0555 /docker-entrypoint-initdb.d/10-langtutor-roles.sh

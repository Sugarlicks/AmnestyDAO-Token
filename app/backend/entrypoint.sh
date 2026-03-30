#!/usr/bin/env sh
set -e

# Start supervisord in the foreground
exec /usr/bin/supervisord -n -c /etc/supervisord.conf

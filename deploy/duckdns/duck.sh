#!/bin/sh
# DuckDNS dynamic-DNS updater. Run it on a cron every 5 minutes.
#
# Setup (on the Pi):
#   mkdir -p ~/duckdns && cp deploy/duckdns/duck.sh ~/duckdns/duck.sh && chmod 700 ~/duckdns/duck.sh
#   printf 'DUCKDNS_DOMAIN=your-name\nDUCKDNS_TOKEN=xxxxxxxx-xxxx-xxxx\n' > ~/duckdns/duck.env
#   chmod 600 ~/duckdns/duck.env
#   ( crontab -l 2>/dev/null; echo '*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1' ) | crontab -
#
# DUCKDNS_DOMAIN is just the label (e.g. "kitchencanon" for kitchencanon.duckdns.org).
# Leaving ip= blank tells DuckDNS to use the request's source IP — i.e. your router's WAN IP.

set -eu
DIR="$(dirname "$0")"
. "$DIR/duck.env"

echo "url=https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=" \
  | curl -fsS -k -o "$DIR/duck.log" -K -

# DuckDNS replies "OK" on success, "KO" on a bad domain/token.
grep -q OK "$DIR/duck.log" || { echo "DuckDNS update failed: $(cat "$DIR/duck.log")" >&2; exit 1; }

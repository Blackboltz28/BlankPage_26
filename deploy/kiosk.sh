#!/bin/bash
# Opens the kiosk full screen. The desktop runs this at login (set up by setup-kiosk.sh).
pgrep -f "localhost:5000/kiosk" > /dev/null && exit 0  # already open

BROWSER="$(command -v chromium-browser || command -v chromium)"

# Wait for the server, so the screen doesn't show an error page while the Pi boots.
for _ in $(seq 60); do
  curl -sf http://localhost:5000/api/health > /dev/null && break
  sleep 2
done

exec "$BROWSER" --kiosk --noerrdialogs --disable-infobars --no-first-run \
  --password-store=basic --disable-session-crashed-bubble http://localhost:5000/kiosk

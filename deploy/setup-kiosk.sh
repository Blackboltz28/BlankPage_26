#!/bin/bash
# Run on the Pi with the screen attached:  bash ~/BlankPage_26/deploy/setup-kiosk.sh
# Opens the kiosk page full screen every time the desktop starts.
set -e
BROWSER="$(command -v chromium-browser || command -v chromium || true)"
if [ -z "$BROWSER" ]; then
  echo "Chromium isn't installed. This Pi needs Raspberry Pi OS with desktop."
  exit 1
fi

LINE="$BROWSER --kiosk --noerrdialogs --disable-infobars --no-first-run --password-store=basic http://localhost:5000/kiosk &"
mkdir -p ~/.config/labwc
touch ~/.config/labwc/autostart
grep -q "localhost:5000/kiosk" ~/.config/labwc/autostart || echo "$LINE" >> ~/.config/labwc/autostart

# Keep the screen from going black after a few minutes.
sudo raspi-config nonint do_blanking 1 || true

echo "Done. Reboot to start the kiosk:  sudo reboot"

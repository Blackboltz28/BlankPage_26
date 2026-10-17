#!/bin/bash
# Run on the Pi with the screen:  bash ~/BlankPage_26/deploy/setup-kiosk.sh
# Makes the kiosk open full screen whenever the desktop starts, and opens it right now.
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
LAUNCH="bash $DIR/deploy/kiosk.sh"

if ! command -v chromium-browser > /dev/null && ! command -v chromium > /dev/null; then
  echo "Chromium isn't installed. Install it with:  sudo apt install -y chromium"
  exit 1
fi

# Remove any other kiosk set up on this Pi before (a Chromium started with --kiosk),
# so it doesn't open on top of ours.
for f in ~/.config/labwc/autostart ~/.config/wayfire.ini; do
  [ -f "$f" ] && grep -n -- "--kiosk" "$f" && sed -i '/--kiosk/d' "$f" && echo "Removed an old kiosk from $f"
done
for f in ~/.config/autostart/*.desktop; do
  [ -f "$f" ] && grep -q -- "--kiosk" "$f" && rm "$f" && echo "Removed an old kiosk: $f"
done
for f in /etc/xdg/labwc/autostart /etc/xdg/autostart/*.desktop; do
  [ -f "$f" ] && grep -q -- "chromium.*--kiosk" "$f" && sudo sed -i '/chromium.*--kiosk/d' "$f" && echo "Removed an old kiosk from $f"
done
pkill -f "chromium.*--kiosk" && sleep 2 || true

# Raspberry Pi OS has used three different desktops, so start the kiosk from all of them.
# kiosk.sh exits straight away if it's already open, so it never opens twice.

# 1. labwc (current Raspberry Pi OS)
mkdir -p ~/.config/labwc
touch ~/.config/labwc/autostart
sed -i '/localhost:5000\/kiosk/d;/deploy\/kiosk.sh/d' ~/.config/labwc/autostart
echo "$LAUNCH &" >> ~/.config/labwc/autostart

# 2. wayfire (2023-2024 Raspberry Pi OS)
if [ -f ~/.config/wayfire.ini ] && ! grep -q "deploy/kiosk.sh" ~/.config/wayfire.ini; then
  if grep -q '^\[autostart\]' ~/.config/wayfire.ini; then
    sed -i "/^\[autostart\]/a blankpage_kiosk = $LAUNCH" ~/.config/wayfire.ini
  else
    printf '\n[autostart]\nblankpage_kiosk = %s\n' "$LAUNCH" >> ~/.config/wayfire.ini
  fi
fi

# 3. Older X11 desktops use the standard autostart folder.
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/blankpage-kiosk.desktop <<EOF
[Desktop Entry]
Type=Application
Name=TaskMaster kiosk
Exec=$LAUNCH
EOF

# Keep the screen from going black after a few minutes.
sudo raspi-config nonint do_blanking 1 || true

echo "Server: $(systemctl is-active blankpage-server 2>/dev/null || echo 'not set up - run deploy/setup-server.sh')"

# If the screen is showing a text terminal (Ctrl+Alt+F1-F6), switch it back to the desktop.
for s in $(loginctl list-sessions --no-legend | awk '{print $1}'); do
  case "$(loginctl show-session "$s" -p Type --value 2> /dev/null)" in
    wayland | x11)
      VT="$(loginctl show-session "$s" -p VTNr --value)"
      [ -n "$VT" ] && [ "$VT" != 0 ] && sudo chvt "$VT" && echo "Switched the screen to the desktop."
      break
      ;;
  esac
done

# Open it on the screen right now if the desktop is running.
RUNTIME="/run/user/$(id -u)"
WAYLAND="$(ls "$RUNTIME" 2> /dev/null | grep -m1 '^wayland-[0-9]*$' || true)"
if [ -n "$WAYLAND" ]; then
  XDG_RUNTIME_DIR="$RUNTIME" WAYLAND_DISPLAY="$WAYLAND" nohup $LAUNCH > /dev/null 2>&1 &
  echo "Opening the kiosk on the screen now."
elif [ -e /tmp/.X11-unix/X0 ]; then
  DISPLAY=:0 nohup $LAUNCH > /dev/null 2>&1 &
  echo "Opening the kiosk on the screen now."
else
  echo "Couldn't find a desktop running as $USER."
  echo "Desktop sessions on this Pi belong to: $(loginctl list-sessions --no-legend 2> /dev/null | awk '{print $3}' | sort -u | tr '\n' ' ')"
  echo "If that's a different user, run this script as that user. Otherwise: sudo reboot"
fi

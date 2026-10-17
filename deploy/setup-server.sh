#!/bin/bash
# Run on the server Pi:  bash ~/BlankPage_26/deploy/setup-server.sh
# Installs the Python packages and makes the server start by itself at boot.
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR/server"

[ -d venv ] || python3 -m venv venv
venv/bin/pip install -r requirements.txt

# Stop a server started by hand, so the service can use port 5000.
pkill -f "[p]ython app.py" || true

sudo tee /etc/systemd/system/blankpage-server.service > /dev/null <<EOF
[Unit]
Description=BlankPage server
After=network-online.target bluetooth.target
Wants=network-online.target

[Service]
User=$USER
WorkingDirectory=$DIR/server
ExecStart=$DIR/server/venv/bin/python app.py
Environment=PYTHONUNBUFFERED=1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable blankpage-server
sudo systemctl restart blankpage-server
sleep 3
systemctl --no-pager --lines=5 status blankpage-server
echo
echo "Done. The site is at http://$(hostname).local:5000 and the kiosk at http://localhost:5000/kiosk"

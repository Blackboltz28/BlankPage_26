# Setting up the Pis

```
 Browser ──► website Pi "todoweb" (nginx) ──/api──► server Pi "todopi" (Flask + database)
                                                        ▲
 ESP32 reminder devices ────────── Wi-Fi ───────────────┘
```

**Everything must be on the same Wi-Fi network**: both Pis, every ESP32, and any phone or
laptop that opens the site. ESP32s only use 2.4 GHz Wi-Fi.

To move a Pi to a different Wi-Fi network without reflashing, run `sudo nmtui` on it and pick
**Activate a connection**.

---

## 1. Server Pi (`todopi`)

Over SSH (`ssh blankpage@todopi.local`):

```bash
cd ~/BlankPage_26 && git pull
cd server && source venv/bin/activate
pip install -r requirements.txt
```

### Turn on the AI features (optional)

Get a key at https://console.anthropic.com, then:

```bash
cp .env.example .env
nano .env
```

Paste the key after `ANTHROPIC_API_KEY=`, save with Ctrl+O, Enter, and exit with Ctrl+X.
`.env` is in `.gitignore`, so the key never goes to GitHub.

### Start the server automatically at boot

```bash
sudo cp ~/BlankPage_26/deploy/blankpage-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now blankpage-server
```

From now on you don't need to run `python app.py` yourself. Useful commands:

| What | Command |
|---|---|
| Is it running? | `systemctl status blankpage-server` |
| Watch its log | `journalctl -u blankpage-server -f` |
| Restart after `git pull` | `sudo systemctl restart blankpage-server` |

If you started `python app.py` by hand earlier, stop it first (Ctrl+C), or the service can't use port 5000.

---

## 2. Website Pi (`todoweb`)

Flash it like the first Pi (hostname `todoweb`, same Wi-Fi, SSH on), but choose
**Raspberry Pi OS with desktop**, because the kiosk needs a web browser.

### Install nginx (once)

```bash
sudo apt update && sudo apt install -y nginx
sudo mkdir -p /var/www/blankpage && sudo chown blankpage /var/www/blankpage
git clone https://github.com/Blackboltz28/BlankPage_26.git
sudo cp ~/BlankPage_26/deploy/nginx-blankpage.conf /etc/nginx/sites-available/blankpage
sudo ln -sf /etc/nginx/sites-available/blankpage /etc/nginx/sites-enabled/blankpage
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

If `nginx -t` says *host not found in upstream "todopi.local"*, the server Pi isn't on the
network yet. Turn it on, wait a minute, and run the last line again.

### Put the website on it

On your laptop, from the `website` folder:

```bash
npm.cmd run build
scp -r dist blankpage@todoweb.local:/var/www/blankpage/
```

Then anyone on the Wi-Fi can open **http://todoweb.local**. Run these two commands again
whenever the website changes.

### Kiosk: open ambient mode full screen at boot

On the website Pi:

```bash
mkdir -p ~/.config/labwc
echo 'chromium-browser --kiosk --noerrdialogs --disable-infobars --no-first-run --password-store=basic http://localhost/ambient &' >> ~/.config/labwc/autostart
```

(If `chromium-browser` isn't found, use `chromium` instead.)

Also turn off screen blanking: `sudo raspi-config` → **Display Options** → **Screen Blanking** → **No**.

Reboot. The first time, plug in a keyboard and sign in on the kiosk. It stays signed in after
that. Press **Esc** to leave ambient mode.

---

## 3. ESP32 reminder devices

1. On the website, open **Devices** → **+**, name the device (like "Kitchen") and copy its key.
2. Open `esp32/reminder_node/reminder_node.ino` in the Arduino IDE.
3. Fill in the Wi-Fi name and password, `DEVICE_KEY`, and the pins at the top.
4. Upload. Open the Serial Monitor (115200 baud) to see what it's doing.

The device beeps once when it's connected. When a task is due it beeps until you press the
button: **short press = done**, **hold 1 second = stop ringing**. Use the bell button next to a
device on the website to make it test-beep.

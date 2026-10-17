# Setting up TaskMaster: the server Pi and kiosk

One Pi (`mk3`) does everything: runs the server, serves the website, listens for the
ESP32 tags over Bluetooth, and shows the kiosk on its touchscreen.

```
 Phones / laptops ──► http://mk3.local:5000 ──┐
                                              ▼
 ESP32 tags (Bluetooth "TM-1", "TM-2"...) ──► mk3: Flask + database + Bluetooth listener
 ESP32s check for reminders over Wi-Fi ─────► └── touchscreen: http://localhost:5000/kiosk
```

**Everything must be on the same Wi-Fi network.** ESP32s only use 2.4 GHz.
To move a Pi to another network without reflashing: `sudo nmtui` → **Activate a connection**.

## 1. Server (once)

```bash
cd ~/BlankPage_26 && git pull
bash deploy/setup-server.sh
```

This installs everything and makes the server start at boot. After that:

| What | Command |
|---|---|
| Update to the latest code | `cd ~/BlankPage_26 && git pull && sudo systemctl restart blankpage-server` |
| Is it running? | `systemctl status blankpage-server` |
| Watch its log | `journalctl -u blankpage-server -f` |

### AI features (optional)

```bash
cd ~/BlankPage_26/server && cp .env.example .env && nano .env
```

Paste your key from https://console.anthropic.com after `ANTHROPIC_API_KEY=`, save
(Ctrl+O, Enter, Ctrl+X), then `sudo systemctl restart blankpage-server`.

## 2. Kiosk screen (once)

```bash
bash ~/BlankPage_26/deploy/setup-kiosk.sh
sudo reboot
```

After the reboot the screen shows a clock. When someone walks up with their ESP32 tag, it
switches to **their** tasks. The closest person (strongest signal) wins. When they walk away,
it goes back to the clock.

To tune how close someone has to be, change `NEAR_RSSI` in `server/presence.py`. -60 means
very close and -85 means across the room.

## 3. ESP32 tags

1. Each person signs up on the website and adds their ESP32 under **Devices** → **+**. Copy the key.
2. Open `esp32/reminder_node/reminder_node.ino` in the Arduino IDE. Set the Wi-Fi, `DEVICE_KEY`
   and pins at the top, and choose **Tools → Partition Scheme → Huge APP**.
3. Upload. The Serial Monitor (115200 baud) shows `Broadcasting Bluetooth tag TM-…`.

Each ESP32 also rings when its owner's tasks are due. **Short press = done, hold 1 s = stop ringing.**

## Testing without ESP32s

Pretend device 1 is right next to the kiosk (run this on the Pi):

```bash
curl -X POST localhost:5000/api/presence -H "Content-Type: application/json" -d '{"beacon": "TM-1", "rssi": -50}'
```

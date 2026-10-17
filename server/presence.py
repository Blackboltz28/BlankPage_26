"""Works out who is standing closest to the kiosk.

Each person's ESP32 broadcasts a Bluetooth name like "TM-3" (3 = its device id).
This Pi listens for those broadcasts; the stronger the signal (RSSI), the closer the person.
Readings can also be sent in over HTTP (POST /api/presence), which is handy for testing
or for an ESP32 that does the listening instead.
"""
import asyncio
import threading
import time

TAG_PREFIX = "TM-"
NEAR_RSSI = -85      # weaker than this (in dBm) doesn't count as being near the kiosk
GONE_AFTER = 12      # seconds without hearing a tag before that person counts as gone
SWITCH_MARGIN = 6    # dB a new person must beat whoever is showing by, so the screen doesn't flicker

_lock = threading.Lock()
_readings = {}       # device_id -> {"rssi": smoothed signal, "seen": time.time()}
_current = None      # device id currently shown on the kiosk
_status = "Bluetooth scanner not started"


def status():
    return _status


def update(device_id, rssi):
    """Record one signal reading. Smooths out the jumps Bluetooth signals are known for."""
    now = time.time()
    with _lock:
        previous = _readings.get(device_id)
        if previous is None or now - previous["seen"] > GONE_AFTER:
            smoothed = rssi
        else:
            smoothed = previous["rssi"] * 0.7 + rssi * 0.3
        _readings[device_id] = {"rssi": smoothed, "seen": now}


def nearby():
    """Devices close enough to count, strongest first, as [(device_id, rssi)]."""
    now = time.time()
    with _lock:
        live = [
            (device_id, r["rssi"])
            for device_id, r in _readings.items()
            if now - r["seen"] < GONE_AFTER and r["rssi"] >= NEAR_RSSI
        ]
    return sorted(live, key=lambda item: item[1], reverse=True)


def closest(known_ids):
    """The device id to show on the kiosk (or None), plus everyone nearby.
    Only devices in known_ids count, so a stranger's tag can't take over the screen."""
    global _current
    live = [(device_id, rssi) for device_id, rssi in nearby() if device_id in known_ids]
    signal = dict(live)
    with _lock:
        if not live:
            _current = None
        else:
            best_id, best_rssi = live[0]
            # Keep showing the current person unless someone else is clearly closer.
            if _current in signal and best_id != _current and best_rssi < signal[_current] + SWITCH_MARGIN:
                best_id = _current
            _current = best_id
        return _current, live


def tag_to_device_id(name):
    if not name or not name.startswith(TAG_PREFIX):
        return None
    try:
        return int(name[len(TAG_PREFIX):])
    except ValueError:
        return None


def start_scanner():
    """Listen for ESP32 tags in a background thread. Safe to call when there's no Bluetooth."""
    global _status
    try:
        from bleak import BleakScanner
    except ImportError:
        _status = "Bluetooth scanner off: run pip install -r requirements.txt"
        return

    def on_advertisement(device, advertisement):
        device_id = tag_to_device_id(advertisement.local_name or device.name)
        if device_id is not None:
            update(device_id, advertisement.rssi)

    async def scan_forever():
        global _status
        while True:
            try:
                async with BleakScanner(detection_callback=on_advertisement):
                    _status = "Listening for tags"
                    while True:
                        await asyncio.sleep(1)
            except Exception as error:  # no adapter, Bluetooth turned off, etc. Try again shortly.
                _status = f"Bluetooth scanner off: {error}"
                await asyncio.sleep(10)

    threading.Thread(target=lambda: asyncio.run(scan_forever()), daemon=True, name="ble-scanner").start()

// BlankPage reminder device for ESP32.
//
// Every few seconds it asks the server Pi "anything due for me?". When a task is due it
// beeps and blinks until someone presses the button:
//   - short press      -> marks the task done
//   - hold for 1 second -> stops ringing (the task stays on the list)
// It also gives two quick beeps when you press "Test beep" on the website.
//
// It also broadcasts a Bluetooth name like "BP-3" so the kiosk can tell its owner is
// standing nearby, and show their tasks.
//
// Setup:
// 1. Arduino IDE: Boards Manager -> install "esp32" by Espressif.
//    Library Manager -> install "ArduinoJson" by Benoit Blanchon.
// 2. Tools -> Partition Scheme -> "Huge APP (3MB No OTA)". Wi-Fi + Bluetooth don't fit otherwise.
// 3. On the website: Devices panel -> + -> give it a name -> copy its key into DEVICE_KEY below.
// 4. Fill in the Wi-Fi details (2.4 GHz only - ESP32s can't use 5 GHz), then upload.

#include <WiFi.h>
#include <HTTPClient.h>
#include <ESPmDNS.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>

// ---------- Change these ----------
const char* WIFI_NAME     = "your-hotspot-name";
const char* WIFI_PASSWORD = "your-hotspot-password";
const char* SERVER_NAME   = "mk3";     // the server Pi's hostname, without ".local"
const char* SERVER_IP     = "";        // optional: an IP like "192.168.1.50" to skip the name lookup
const int   SERVER_PORT   = 5000;
const char* DEVICE_KEY    = "paste-the-key-from-the-website";

const int  BUZZER_PIN     = 25;     // buzzer + leg (other leg to GND)
const int  LED_PIN        = 2;      // the blue LED on most ESP32 dev boards
const int  BUTTON_PIN     = 0;      // the BOOT button on most dev boards, or a button wired from a pin to GND
const bool PASSIVE_BUZZER = false;  // set true if your buzzer only clicks (passive buzzers need a tone)
// ----------------------------------

const unsigned long POLL_MS = 5000;
const unsigned long RING_TIMEOUT_MS = 60000;  // give up ringing after a minute with no button press
const unsigned long HOLD_MS = 1000;

String serverBase;
unsigned long lastPoll = 0;

int ringingId = -1;  // the task we're ringing for, or -1 when quiet
String ringingTitle;
unsigned long ringStarted = 0;
bool buzzerOn = false;

unsigned long pressStarted = 0;
bool wasPressed = false;

String beaconName;  // e.g. "BP-3", told to us by the server on the first check-in

// Broadcasts our Bluetooth name over and over so the kiosk can measure how close we are.
void startBeacon(const String& name) {
  if (name.length() == 0 || name == beaconName) return;
  beaconName = name;
  BLEDevice::init(name.c_str());
  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  BLEAdvertisementData data;
  data.setFlags(0x06);  // general discoverable, Bluetooth LE only
  data.setName(name.c_str());
  advertising->setAdvertisementData(data);
  advertising->setMinInterval(0x20);  // advertise often (every ~20-40 ms) for steadier readings
  advertising->setMaxInterval(0x40);
  advertising->start();
  Serial.println("Broadcasting Bluetooth tag " + name);
}

void setBuzzer(bool on) {
  if (on == buzzerOn) return;
  buzzerOn = on;
  if (PASSIVE_BUZZER) {
    if (on) tone(BUZZER_PIN, 2000);
    else noTone(BUZZER_PIN);
  } else {
    digitalWrite(BUZZER_PIN, on ? HIGH : LOW);
  }
  digitalWrite(LED_PIN, on ? HIGH : LOW);
}

void beep(int ms) {
  setBuzzer(true);
  delay(ms);
  setBuzzer(false);
}

void connectWifi() {
  Serial.printf("Connecting to Wi-Fi \"%s\"", WIFI_NAME);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_NAME, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));  // blink while connecting
    delay(250);
    Serial.print(".");
  }
  digitalWrite(LED_PIN, LOW);
  Serial.printf("\nConnected, my IP is %s\n", WiFi.localIP().toString().c_str());
}

// Works out the server's address once Wi-Fi is up: the fixed IP if one is set,
// otherwise looks up "todopi.local" on the network.
bool findServer() {
  IPAddress ip;
  if (strlen(SERVER_IP) > 0) {
    ip.fromString(SERVER_IP);
  } else {
    MDNS.begin("blankpage-device");
    ip = MDNS.queryHost(SERVER_NAME, 3000);
    if (ip[0] == 0) {
      Serial.printf("Couldn't find %s.local - is the server Pi on the same Wi-Fi?\n", SERVER_NAME);
      return false;
    }
  }
  serverBase = "http://" + ip.toString() + ":" + String(SERVER_PORT);
  Serial.println("Server: " + serverBase);
  return true;
}

void startRinging(int id, const char* title) {
  ringingId = id;
  ringingTitle = title;
  ringStarted = millis();
  Serial.println("Reminder: " + ringingTitle);
}

void stopRinging() {
  ringingId = -1;
  setBuzzer(false);
}

// Tells the server the button was pressed: action is "done" or "dismiss".
void finishReminder(const char* action) {
  HTTPClient http;
  http.begin(serverBase + "/api/device/reminders/" + String(ringingId) + "/" + action);
  http.addHeader("X-Device-Key", DEVICE_KEY);
  int code = http.POST("");
  http.end();
  Serial.printf("%s \"%s\" -> %d\n", action, ringingTitle.c_str(), code);
  stopRinging();
}

void poll() {
  HTTPClient http;
  http.begin(serverBase + "/api/device/poll");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  int code = http.GET();
  if (code != 200) {
    if (code == 401) Serial.println("The server doesn't know this DEVICE_KEY - copy it from the website again.");
    else Serial.printf("Couldn't reach the server (%d)\n", code);
    http.end();
    return;
  }
  String body = http.getString();
  http.end();

  JsonDocument doc;
  if (deserializeJson(doc, body)) {
    Serial.println("Got a reply I couldn't read");
    return;
  }

  startBeacon(doc["beacon"] | "");

  if (doc["test"] | false) {
    Serial.println("Test beep!");
    beep(150);
    delay(150);
    beep(150);
  }

  JsonArray reminders = doc["reminders"].as<JsonArray>();
  bool stillDue = false;
  for (JsonObject r : reminders) {
    if (r["id"].as<int>() == ringingId) stillDue = true;
  }
  // Someone ticked it off on their phone or another device: go quiet.
  if (ringingId != -1 && !stillDue) stopRinging();
  if (ringingId == -1 && reminders.size() > 0) {
    startRinging(reminders[0]["id"].as<int>(), reminders[0]["title"] | "Reminder");
  }
}

// Beep-beep, pause, beep-beep... without blocking, so the button still works.
void ringPattern() {
  unsigned long phase = (millis() - ringStarted) % 1000;
  setBuzzer(phase < 150 || (phase > 300 && phase < 450));
}

void checkButton() {
  bool pressed = digitalRead(BUTTON_PIN) == LOW;
  if (pressed && !wasPressed) pressStarted = millis();
  if (!pressed && wasPressed && ringingId != -1) {
    unsigned long held = millis() - pressStarted;
    if (held > 30) finishReminder(held >= HOLD_MS ? "dismiss" : "done");  // ignore switch bounce
  }
  wasPressed = pressed;
}

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  setBuzzer(false);

  connectWifi();
  while (!findServer()) delay(5000);
  beep(80);  // one short beep: ready
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    stopRinging();
    connectWifi();
  }

  if (millis() - lastPoll >= POLL_MS) {
    lastPoll = millis();
    poll();
  }

  if (ringingId != -1) {
    ringPattern();
    checkButton();
    if (millis() - ringStarted > RING_TIMEOUT_MS) finishReminder("dismiss");
  } else {
    wasPressed = digitalRead(BUTTON_PIN) == LOW;
  }

  delay(10);
}

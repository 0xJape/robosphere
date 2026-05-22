#include <DHT.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ESPmDNS.h>

// ===== Wi-Fi Credentials =====
const char* ssid = "GoOneMore";
const char* password = "P@rtwor10.";

// ===== Backend Server URL =====
const char* serverName = "http://192.168.1.61:3001/api/sensors";


// ===== MH-Z19B Serial Pins =====
#define RXD2 16
#define TXD2 17

HardwareSerial mySerial(2);

// ===== Sensor Pins =====
#define SMOKE_PIN 33
#define GAS_PIN   32   // IMPORTANT: Moved from 25 to 32. Pin 25 is ADC2 which fails when Wi-Fi is active! ADC1 (Pins 32-35) must be used.
#define FLAME_PIN 26
#define DHT_PIN   27

// ===== DHT Setup =====
#define DHTTYPE DHT11
DHT dht(DHT_PIN, DHTTYPE);

// ===== MH-Z19B Command =====
byte cmd[9] = {0xFF, 0x01, 0x86, 0, 0, 0, 0, 0, 0x79};
byte response[9];

// ===== Variables =====
unsigned long lastRead = 0;
const unsigned long interval = 2000;

int lastValidCO2 = -1;

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  mySerial.begin(9600, SERIAL_8N1, RXD2, TXD2);

  pinMode(FLAME_PIN, INPUT);
  dht.begin();

  Serial.println("=== MULTI-SENSOR SYSTEM STARTING ===");

  // Connect to Wi-Fi
  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi network with IP Address: ");
  Serial.println(WiFi.localIP());

  // Setup mDNS to correctly resolve .local addresses (Bonjour/Avahi)
  if(!MDNS.begin("esp32-sensor")) {
      Serial.println("Error starting mDNS");
  } else {
      Serial.println("mDNS started successfully");
  }

  delay(5000); // allow MH-Z19B to stabilize

  // Clear serial buffer
  while (mySerial.available()) {
    mySerial.read();
  }

  Serial.println("=== SYSTEM READY ===\n");
}

// ================= LOOP =================
void loop() {
  if (millis() - lastRead >= interval) {
    lastRead = millis();

    int co2 = readCO2();

    // Keep last valid CO2 value
    if (co2 != -1) {
      lastValidCO2 = co2;
    }

    int smokeValue = analogRead(SMOKE_PIN);
    int gasValue   = analogRead(GAS_PIN);
    int flameState = digitalRead(FLAME_PIN);

    float temp = dht.readTemperature();
    float hum  = dht.readHumidity();

    sendData(lastValidCO2, smokeValue, gasValue, flameState, temp, hum);
  }
}

// ================= HTTP POST =================
void sendData(int co2, int smoke, int gas, int flame, float temp, float hum) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverName);
    http.addHeader("Content-Type", "application/json");

    String jsonPayload = "{";
    jsonPayload += "\"co2\":" + String(co2) + ",";
    jsonPayload += "\"smoke\":" + String(smoke) + ",";
    jsonPayload += "\"gas\":" + String(gas) + ",";
    jsonPayload += "\"flame\":" + String(flame) + ",";
    jsonPayload += "\"temperature\":" + String(temp) + ",";
    jsonPayload += "\"humidity\":" + String(hum);
    jsonPayload += "}";

    int httpResponseCode = http.POST(jsonPayload);
    
    if (httpResponseCode == 201 || httpResponseCode == 200) {
      Serial.print("✅ Data Sent Successfully! HTTP Code: ");
      Serial.println(httpResponseCode);
    } else if (httpResponseCode > 0) {
      Serial.print("⚠️ HTTP Warning/Error Code: ");
      Serial.println(httpResponseCode);
    } else {
      Serial.print("❌ Error sending POST: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  } else {
    Serial.println("Error in WiFi connection");
  }
}

// ================= CO2 FUNCTION =================
int readCO2() {
  // Clear buffer
  while (mySerial.available()) mySerial.read();

  // Send request
  mySerial.write(cmd, 9);

  unsigned long startTime = millis();

  while (millis() - startTime < 1000) {
    if (mySerial.available() >= 9) {

      if (mySerial.read() == 0xFF) {
        response[0] = 0xFF;
        mySerial.readBytes(&response[1], 8);

        // Validate command
        if (response[1] != 0x86) return -1;

        // Checksum validation
        byte checksum = 0;
        for (int i = 1; i < 8; i++) {
          checksum += response[i];
        }
        checksum = 0xFF - checksum + 1;

        if (checksum != response[8]) return -1;

        int co2 = (response[2] << 8) | response[3];

        // Reject invalid values
        if (co2 == 5000 || co2 < 300) return -1;

        return co2;
      }
    }
  }

  return -1; // timeout
}

// ================= PRINT FUNCTION =================
void printData(int co2, int smoke, int gas, int flame, float temp, float hum) {

  Serial.println("------ SENSOR READINGS ------");

  // CO2
  Serial.print("CO2: ");
  if (co2 != -1) {
    Serial.print(co2);
    Serial.println(" ppm");
  } else {
    Serial.println("Stabilizing...");
  }

  // Smoke
  Serial.print("Smoke (Analog): ");
  Serial.println(smoke);

  // Gas
  Serial.print("Gas (Analog): ");
  Serial.println(gas);

  // Flame
  Serial.print("Flame: ");
  if (flame == HIGH) {
    Serial.println("DETECTED 🔥");
  } else {
    Serial.println("SAFE");
  }

  // DHT11
  if (isnan(temp) || isnan(hum)) {
    Serial.println("DHT11: Failed to read");
  } else {
    Serial.print("Temp: ");
    Serial.print(temp);
    Serial.println(" °C");

    Serial.print("Humidity: ");
    Serial.print(hum);
    Serial.println(" %");
  }

  Serial.println("-----------------------------\n");
}
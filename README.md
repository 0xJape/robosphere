<div align="center">

# RoboSphere

**Smart home monitoring with real-time sensors, alerts, and a voice-enabled AI assistant.**

ESP32 sensor nodes → Node.js + SQLite backend → React dashboard with charts, maps, anomaly detection, and **Kyle**, a voice-driven AI assistant.

</div>

---

## Contents

- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Project layout](#project-layout)
- [AI and voice models](#ai-and-voice-models)
- [Backend](#backend)
- [Frontend](#frontend)
- [ESP32 firmware](#esp32-firmware)
- [Alert thresholds](#alert-thresholds)
- [API reference](#api-reference)
- [WebSocket events](#websocket-events)
- [Tech stack](#tech-stack)

---

## Architecture

```
                ┌──────────────────┐
                │   ESP32 Node     │
                │  CO2, Smoke,     │
                │  Gas, Flame,     │
                │  Temp, Humidity  │
                └────────┬─────────┘
                         │  HTTP POST /api/sensors
                         ▼
   ┌─────────────────────────────────────────┐
   │  Backend  (Node.js + Express + SQLite)  │
   │  • hazard rules                         │
   │  • alert engine                         │
   │  • chat proxy → cx/gpt-5.5              │
   └────────┬────────────────┬───────────────┘
            │ Socket.IO      │ REST
            ▼                ▼
       ┌─────────────────────────┐         ┌────────────────────┐
       │  React Dashboard        │ ──────► │  Local AI Gateway  │
       │  • live charts + map    │  TTS/   │  cx/gpt-5.5        │
       │  • alerts + anomalies   │  STT    │  dg/aura-2-orion   │
       │  • Kyle voice assistant │         │  dg/nova-3         │
       └─────────────────────────┘         └────────────────────┘
```

---

## Quick start

```bash
# 1. backend
cd backend
npm install
cp .env.example .env       # then fill in AI_API_KEY
npm run dev                # http://localhost:3001

# 2. frontend (in a new terminal)
cd frontend
npm install
npm run dev                # http://localhost:5173

# 3. flash ESP32
#    open ROBOSPHEREE.ino in Arduino IDE, set wifi + serverName, upload
```

> **Windows shortcut:** run [start.bat](start.bat) from the repo root to launch backend and frontend together.

---

## Project layout

```
robosphere/
├── backend/                       Express API, SQLite, Socket.IO
│   ├── config.js                  loads env, defines alert thresholds
│   ├── db.js                      sqlite schema and queries
│   ├── gemini.js                  chat client + Kyle's persona
│   ├── hazards.js                 threshold rules and alert builder
│   ├── index.js                   HTTP routes and websocket
│   ├── data/                      sqlite db files (gitignored)
│   ├── uploads/                   user-uploaded files
│   ├── .env                       runtime secrets (gitignored)
│   └── .env.example               template
│
├── frontend/                      React + Vite dashboard
│   └── src/
│       ├── App.jsx                dashboard shell
│       ├── api.js                 REST + TTS/STT clients
│       ├── mapIcons.js
│       └── components/
│           ├── AlertsPanel.jsx
│           ├── AnomalyPanel.jsx
│           ├── ArchivesPanel.jsx
│           ├── ChartPanel.jsx
│           ├── ChatPanel.jsx              text chat with Kyle
│           ├── MapPanel.jsx
│           ├── MetricCard.jsx
│           ├── PredictionPanel.jsx
│           ├── StatusPill.jsx
│           ├── VoiceAssistant.jsx         voice mode (push-to-talk)
│           └── VoiceTestPanel.jsx         raw TTS/STT debugging
│
├── ROBOSPHEREE.ino                ESP32 firmware
├── start.bat                      one-shot launcher (Windows)
├── architecture.md
└── design.md
```

---

## AI and voice models

Kyle's chat and voice pipeline goes through a local OpenAI-compatible gateway at `http://localhost:20128`.

| Capability       | Model                                  | Endpoint                     |
| ---------------- | -------------------------------------- | ---------------------------- |
| Chat / reasoning | `cx/gpt-5.5`                           | `/v1/chat/completions`       |
| Text-to-speech   | `dg/aura-2-orion-en` *(Deepgram Aura-2, Orion voice)* | `/v1/audio/speech`           |
| Speech-to-text   | `dg/nova-3` *(Deepgram Nova-3, multilingual auto-detect)* | `/v1/audio/transcriptions`   |

- Chat client: [backend/gemini.js](backend/gemini.js)
- TTS + STT clients: [frontend/src/api.js](frontend/src/api.js)
- Voice UI: [frontend/src/components/VoiceAssistant.jsx](frontend/src/components/VoiceAssistant.jsx)

> Kyle's persona, response style, and conversational thresholds are defined in the system prompt inside [backend/gemini.js](backend/gemini.js).

---

## Backend

```bash
cd backend
npm install
npm run dev
```

### Environment variables

```ini
PORT=3001
DB_PATH=./data/robosphere.db
AI_API_KEY=your_gateway_api_key
MAP_LAT=6.328792
MAP_LNG=124.955213
MAP_ZOOM=13
```

`AI_API_KEY` is the bearer token for the chat gateway. The TTS / STT keys are currently embedded in the frontend client and can be swapped out in [frontend/src/api.js](frontend/src/api.js).

---

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard runs at `http://localhost:5173` and talks to the backend at `http://localhost:3001`. The voice models are reached directly from the browser at `http://localhost:20128`.

### Frontend env

```ini
VITE_API_URL=http://localhost:3001
```

---

## ESP32 firmware

### Hardware

| Component           | Model        |
| ------------------- | ------------ |
| Microcontroller     | ESP32 dev board |
| CO2                 | MH-Z19B      |
| Smoke               | MQ-2         |
| Gas                 | MQ-5         |
| Flame               | flame sensor module |
| Temperature + humidity | DHT11     |

### Configuration

Edit the top of [ROBOSPHEREE.ino](ROBOSPHEREE.ino):

```cpp
const char* ssid       = "your_wifi_ssid";
const char* password   = "your_wifi_password";
const char* serverName = "http://<your-server-ip>:3001/api/sensors";
```

### Pin map

| Sensor         | Pin            |
| -------------- | -------------- |
| CO2 (MH-Z19B)  | RX = 16, TX = 17 |
| Smoke          | GPIO 33        |
| Gas            | GPIO 32        |
| Flame          | GPIO 26        |
| DHT11          | GPIO 27        |

---

## Alert thresholds

There are two sets of thresholds — Kyle's conversational rules (used when chatting with the user) and the backend alert engine (used to actually fire alerts and websocket events). They overlap but are not identical, mainly on CO2.

### Backend alert engine

Defined in [backend/config.js](backend/config.js), evaluated by [backend/hazards.js](backend/hazards.js).

| Sensor          | Warning            | Danger        |
| --------------- | ------------------ | ------------- |
| CO2 (ppm)       | ≥ 2500             | ≥ 4000        |
| Smoke           | ≥ 300              | ≥ 600         |
| Gas             | ≥ 300              | ≥ 600         |
| Temperature     | ≥ 35 °C            | ≥ 45 °C       |
| Humidity (low)  | ≤ 25 %             | ≤ 15 %        |
| Humidity (high) | ≥ 75 %             | ≥ 85 %        |
| Flame           | —                  | any detection |

### Kyle's conversational rules

Defined in the system prompt at [backend/gemini.js](backend/gemini.js). These shape how Kyle describes readings in chat — they are intentionally stricter on CO2 so Kyle warns earlier than the alert engine fires.

| Sensor      | Normal      | Warning       | Danger     |
| ----------- | ----------- | ------------- | ---------- |
| CO2 (ppm)   | < 1750      | 1750 – 2500   | > 2500     |
| Temperature | < 35 °C     | 35 – 45 °C    | > 45 °C    |
| Gas / Smoke | < 300       | 300 – 600     | > 600      |
| Flame       | none        | —             | any detection |

---

## API reference

### Sensor data

| Method | Path                   | Description                    |
| ------ | ---------------------- | ------------------------------ |
| POST   | `/api/sensors`         | Submit a new sensor reading    |
| GET    | `/api/sensors`         | Historical readings (limit 200)|
| GET    | `/api/sensors/latest`  | Most recent reading            |

### Alerts

| Method | Path               | Description                |
| ------ | ------------------ | -------------------------- |
| GET    | `/api/alerts`      | Alert history              |
| DELETE | `/api/alerts/:id`  | Remove a single alert      |
| DELETE | `/api/alerts`      | Clear all alerts           |

### System

| Method | Path           | Description                     |
| ------ | -------------- | ------------------------------- |
| GET    | `/api/summary` | Latest reading, totals, map cfg |
| GET    | `/api/health`  | Health check                    |
| POST   | `/api/chat`    | Kyle (text chat)                |

### Files

| Method | Path                     | Description       |
| ------ | ------------------------ | ----------------- |
| GET    | `/api/files`             | List uploads      |
| POST   | `/api/upload`            | Upload file       |
| DELETE | `/api/files/:filename`   | Delete file       |

---

## WebSocket events

Real-time updates over Socket.IO at the same origin as the backend.

| Event          | Payload              | Fires when                            |
| -------------- | -------------------- | ------------------------------------- |
| `status`       | `{ ok, serverTime }` | Client connects                       |
| `reading`      | sensor reading row   | New reading saved                     |
| `alert`        | alert object         | Hazard threshold crossed              |
| `alertCleared` | `{ flag }`           | Hazard condition resolves (e.g. flame) |

---

## Tech stack

| Layer    | Tools                                                                 |
| -------- | --------------------------------------------------------------------- |
| Backend  | Node.js, Express, SQLite (`sqlite` + `sqlite3`), Socket.IO, dotenv    |
| Frontend | React, Vite, Leaflet, Google Charts, Web Audio API, MediaRecorder     |
| Firmware | Arduino ESP32, WiFi, HTTP client                                      |
| AI       | `cx/gpt-5.5` (chat), Deepgram Aura-2 (TTS), Deepgram Nova-3 (STT)     |

---

## License

MIT

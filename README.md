# RoboSphere

RoboSphere is a realtime IoT monitoring system with an ESP32 sensor node, a Node.js + SQLite backend, and a React dashboard.

## Project layout

- backend: Express API, SQLite storage, Socket.IO events
- frontend: React dashboard (Vite), charts, map, chatbot
- ROBOSPHEREE.ino: ESP32 firmware

## Backend setup

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Update `.env` with your `GEMINI_API_KEY` if you want chatbot responses from Gemini.

## Frontend setup

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

The dashboard expects the backend at `http://localhost:3001` by default. Update `VITE_API_URL` if needed.

## ESP32 firmware

Update the backend URL in `ROBOSPHEREE.ino` to match your machine IP:

```cpp
const char* serverName = "http://<your-ip>:3001/api/sensors";
```

## API endpoints

- POST /api/sensors
- GET /api/sensors
- GET /api/sensors/latest
- GET /api/alerts
- GET /api/summary
- POST /api/chat

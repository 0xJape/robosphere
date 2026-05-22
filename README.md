# HomeGuard - Smart Home Monitoring System

HomeGuard is a comprehensive real-time home monitoring system with ESP32 sensor nodes, a Node.js + SQLite backend, and a React dashboard for complete home safety and environmental monitoring.

## Overview

HomeGuard provides 24/7 monitoring of your home environment with:
- **Air Quality Monitoring**: CO2, smoke, and gas detection
- **Fire Detection**: Flame sensor with instant alerts
- **Climate Control**: Temperature and humidity tracking
- **Real-time Alerts**: Instant notifications for hazardous conditions
- **Historical Data**: Track trends and patterns over time
- **AI Assistant**: Get safety recommendations and risk assessments
- **Multi-room Support**: Monitor multiple locations with GPS tracking

## Project layout

- **backend**: Express API, SQLite storage, Socket.IO for real-time events
- **frontend**: React dashboard (Vite), charts, interactive map, AI chatbot
- **ROBOSPHEREE.ino**: ESP32 firmware for sensor nodes

## Backend setup

```bash
cd backend
npm install
# Create .env file with your configuration
npm run dev
```

Update `.env` with your `GEMINI_API_KEY` for AI-powered chat responses.

### Environment Variables
```
PORT=3001
DB_PATH=./data/robosphere.db
GEMINI_API_KEY=your_api_key_here
MAP_LAT=your_home_latitude
MAP_LNG=your_home_longitude
MAP_ZOOM=15
```

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The dashboard runs on `http://localhost:5173` and connects to the backend at `http://localhost:3001`.

## ESP32 Sensor Node Setup

### Hardware Requirements
- ESP32 Development Board
- MH-Z19B CO2 Sensor
- MQ-2 Smoke Sensor
- MQ-5 Gas Sensor
- Flame Sensor Module
- DHT11 Temperature & Humidity Sensor

### Firmware Configuration

Update your WiFi credentials and backend URL in `ROBOSPHEREE.ino`:

```cpp
const char* ssid = "your_wifi_ssid";
const char* password = "your_wifi_password";
const char* serverName = "http://<your-server-ip>:3001/api/sensors";
```

### Pin Configuration
- CO2 Sensor (MH-Z19B): RX=16, TX=17
- Smoke Sensor: GPIO 33
- Gas Sensor: GPIO 32
- Flame Sensor: GPIO 26
- DHT11: GPIO 27

## Features

### Dashboard Panels
- **Live Metrics**: Real-time sensor readings with status indicators
- **Interactive Map**: Visualize sensor locations in your home
- **Alerts Panel**: View and manage safety alerts
- **Charts**: Historical data visualization and trends
- **AI Assistant**: Get personalized safety guidance
- **Predictions**: Forecast potential hazards
- **Archives**: Access historical data and reports

### Alert Thresholds
- **CO2**: Warning at 2000ppm, Danger at 4000ppm
- **Smoke**: Warning at 300, Danger at 600
- **Gas**: Warning at 300, Danger at 600
- **Temperature**: Warning at 35°C, Danger at 45°C
- **Humidity**: Low warning at 25%, High warning at 75%
- **Flame**: Immediate danger alert

## API Endpoints

### Sensor Data
- `POST /api/sensors` - Submit new sensor reading
- `GET /api/sensors` - Get historical readings (limit: 200)
- `GET /api/sensors/latest` - Get most recent reading

### Alerts
- `GET /api/alerts` - Get alert history

### System
- `GET /api/summary` - Get system overview
- `GET /api/health` - Health check
- `POST /api/chat` - AI assistant chat

### File Management
- `GET /api/files` - List uploaded files
- `POST /api/upload` - Upload file
- `DELETE /api/files/:filename` - Delete file

## WebSocket Events

Real-time updates via Socket.IO:
- `reading` - New sensor data received
- `alert` - New alert triggered
- `status` - Server status updates

## Technology Stack

- **Backend**: Node.js, Express, SQLite, Socket.IO
- **Frontend**: React, Vite, Leaflet Maps, Google Charts
- **Firmware**: Arduino (ESP32), WiFi, HTTP Client
- **AI**: Google Gemini API

## Safety Features

- Automatic hazard detection
- Multi-level alert system (safe, warning, danger, critical)
- Real-time notifications
- Historical trend analysis
- AI-powered risk assessment
- Emergency response guidance

## License

MIT

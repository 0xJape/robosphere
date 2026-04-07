import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { config } from "./config.js";
import {
  initDb,
  insertReading,
  listReadings,
  getLatestReading,
  insertAlert,
  listAlerts,
  countReadings,
  countAlerts,
  getLatestAlert,
  insertChat
} from "./db.js";
import { evaluateHazards, buildAlert } from "./hazards.js";
import { generateChatResponse } from "./gemini.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeReading = (payload) => {
  const now = Date.now();
  return {
    ts: now,
    co2: toNumber(payload.co2),
    smoke: toNumber(payload.smoke),
    gas: toNumber(payload.gas),
    flame: toNumber(payload.flame),
    temperature: toNumber(payload.temperature),
    humidity: toNumber(payload.humidity),
    lat: toNumber(payload.lat),
    lng: toNumber(payload.lng)
  };
};

const sendError = (res, error) => {
  res.status(500).json({ ok: false, error: error.message });
};

const startServer = async () => {
  const db = await initDb(config.dbPath);
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });

  io.on("connection", (socket) => {
    socket.emit("status", { ok: true, serverTime: Date.now() });
  });

  app.get("/api/health", (req, res) => {
    res.json({ ok: true, time: Date.now() });
  });

  app.get("/api/summary", async (req, res) => {
    try {
      const latest = (await getLatestReading(db)) || null;
      const latestAlert = (await getLatestAlert(db)) || null;
      const totalReadings = (await countReadings(db)).total;
      const totalAlerts = (await countAlerts(db)).total;

      res.json({
        ok: true,
        summary: {
          totalReadings,
          totalAlerts,
          lastReading: latest,
          lastAlert: latestAlert,
          lastUpdated: latest?.ts || null,
          map: config.map
        }
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/sensors/latest", async (req, res) => {
    try {
      const latest = await getLatestReading(db);
      res.json({ ok: true, reading: latest || null });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/sensors", async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 200;
      const readings = await listReadings(db, Math.min(Math.max(limit, 1), 2000));
      res.json({ ok: true, readings });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/alerts", async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 200;
      const alerts = await listAlerts(db, Math.min(Math.max(limit, 1), 2000));
      res.json({ ok: true, alerts });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/sensors", async (req, res) => {
    try {
      const reading = normalizeReading(req.body || {});
      const hazard = evaluateHazards(reading, config.alerts);
      const saved = await insertReading(db, {
        ...reading,
        hazard_level: hazard.level,
        hazard_flags: hazard.flags
      });

      let alert = null;
      if (hazard.level !== "safe") {
        alert = await insertAlert(db, buildAlert(reading, hazard));
        io.emit("alert", alert);
      }

      io.emit("reading", saved);
      res.status(201).json({ ok: true, reading: saved, alert });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/chat", async (req, res) => {
    const message = String(req.body?.message || "").trim();
    const mode = req.body?.mode === "risk" ? "risk" : "guidance";

    if (!message) {
      return res.status(400).json({ ok: false, error: "Message is required." });
    }

    try {
      const latest = (await getLatestReading(db)) || null;
      const response = await generateChatResponse({
        apiKey: config.geminiApiKey,
        message,
        mode,
        latestReading: latest
      });

      await insertChat(db, {
        ts: Date.now(),
        mode,
        prompt: message,
        response
      });

      res.json({ ok: true, response });
    } catch (error) {
      sendError(res, error);
    }
  });

  server.listen(config.port, () => {
    console.log(`RoboSphere backend running on port ${config.port}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start RoboSphere backend:", error);
  process.exit(1);
});

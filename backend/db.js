import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

export const initDb = async (dbPath) => {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec("PRAGMA journal_mode = WAL");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      co2 INTEGER,
      smoke INTEGER,
      gas INTEGER,
      flame INTEGER,
      temperature REAL,
      humidity REAL,
      lat REAL,
      lng REAL,
      hazard_level TEXT NOT NULL,
      hazard_flags TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      level TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      meta TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      mode TEXT NOT NULL,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL
    );
  `);

  return db;
};

export const insertReading = async (db, reading) => {
  const info = await db.run(
    `
      INSERT INTO readings (
        ts, co2, smoke, gas, flame, temperature, humidity, lat, lng, hazard_level, hazard_flags
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `,
    [
      reading.ts,
      reading.co2,
      reading.smoke,
      reading.gas,
      reading.flame,
      reading.temperature,
      reading.humidity,
      reading.lat,
      reading.lng,
      reading.hazard_level,
      JSON.stringify(reading.hazard_flags)
    ]
  );

  return db.get("SELECT * FROM readings WHERE id = ?", info.lastID);
};

export const getLatestReading = (db) =>
  db.get("SELECT * FROM readings ORDER BY ts DESC LIMIT 1");

export const listReadings = (db, limit) =>
  db.all("SELECT * FROM readings ORDER BY ts DESC LIMIT ?", limit);

export const insertAlert = async (db, alert) => {
  const info = await db.run(
    `
      INSERT INTO alerts (ts, level, title, message, meta)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      alert.ts,
      alert.level,
      alert.title,
      alert.message,
      JSON.stringify(alert.meta)
    ]
  );

  return db.get("SELECT * FROM alerts WHERE id = ?", info.lastID);
};

export const listAlerts = (db, limit) =>
  db.all("SELECT * FROM alerts ORDER BY ts DESC LIMIT ?", limit);

export const insertChat = (db, record) =>
  db.run(
    "INSERT INTO chats (ts, mode, prompt, response) VALUES (?, ?, ?, ?)",
    [record.ts, record.mode, record.prompt, record.response]
  );

export const countReadings = (db) =>
  db.get("SELECT COUNT(1) as total FROM readings");

export const countAlerts = (db) =>
  db.get("SELECT COUNT(1) as total FROM alerts");

export const getLatestAlert = (db) =>
  db.get("SELECT * FROM alerts ORDER BY ts DESC LIMIT 1");

export const deleteAlert = (db, id) =>
  db.run("DELETE FROM alerts WHERE id = ?", id);

export const clearAlerts = (db) =>
  db.run("DELETE FROM alerts");

export const clearAlertsByFlag = (db, flag) =>
  db.run("DELETE FROM alerts WHERE message LIKE ?", [`%${flag}%`]);

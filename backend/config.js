const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: toNumber(process.env.PORT, 3001),
  dbPath: process.env.DB_PATH || "./data/robosphere.db",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  map: {
    lat: toNumber(process.env.MAP_LAT, 37.7749),
    lng: toNumber(process.env.MAP_LNG, -122.4194),
    zoom: toNumber(process.env.MAP_ZOOM, 13)
  },
  alerts: {
    co2: { warn: 1000, danger: 2000 },
    smoke: { warn: 300, danger: 600 },
    gas: { warn: 300, danger: 600 },
    temperature: { warn: 35, danger: 45 },
    humidity: { lowWarn: 25, highWarn: 75, lowDanger: 15, highDanger: 85 },
    flame: { danger: 1 }
  }
};

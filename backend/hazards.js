const pushFlag = (flags, key) => {
  if (!flags.includes(key)) {
    flags.push(key);
  }
};

export const evaluateHazards = (reading, thresholds) => {
  const flags = [];
  let level = "safe";

  if (reading.flame === 1) {
    pushFlag(flags, "flame");
    level = "danger";
  }

  if (Number.isFinite(reading.co2)) {
    if (reading.co2 >= thresholds.co2.danger) {
      pushFlag(flags, "co2_high");
      level = "danger";
    } else if (reading.co2 >= thresholds.co2.warn) {
      pushFlag(flags, "co2_warn");
      if (level !== "danger") level = "warning";
    }
  }

  if (Number.isFinite(reading.smoke)) {
    if (reading.smoke >= thresholds.smoke.danger) {
      pushFlag(flags, "smoke_high");
      level = "danger";
    } else if (reading.smoke >= thresholds.smoke.warn) {
      pushFlag(flags, "smoke_warn");
      if (level !== "danger") level = "warning";
    }
  }

  if (Number.isFinite(reading.gas)) {
    if (reading.gas >= thresholds.gas.danger) {
      pushFlag(flags, "gas_high");
      level = "danger";
    } else if (reading.gas >= thresholds.gas.warn) {
      pushFlag(flags, "gas_warn");
      if (level !== "danger") level = "warning";
    }
  }

  if (Number.isFinite(reading.temperature)) {
    if (reading.temperature >= thresholds.temperature.danger) {
      pushFlag(flags, "temp_high");
      level = "danger";
    } else if (reading.temperature >= thresholds.temperature.warn) {
      pushFlag(flags, "temp_warn");
      if (level !== "danger") level = "warning";
    }
  }

  if (Number.isFinite(reading.humidity)) {
    if (reading.humidity <= thresholds.humidity.lowDanger) {
      pushFlag(flags, "humidity_low_danger");
      level = "danger";
    } else if (reading.humidity <= thresholds.humidity.lowWarn) {
      pushFlag(flags, "humidity_low_warn");
      if (level !== "danger") level = "warning";
    }

    if (reading.humidity >= thresholds.humidity.highDanger) {
      pushFlag(flags, "humidity_high_danger");
      level = "danger";
    } else if (reading.humidity >= thresholds.humidity.highWarn) {
      pushFlag(flags, "humidity_high_warn");
      if (level !== "danger") level = "warning";
    }
  }

  return { level, flags };
};

const flagLabel = (flag) => {
  switch (flag) {
    case "flame":
      return "Flame detected";
    case "co2_high":
      return "CO2 is very high";
    case "co2_warn":
      return "CO2 is elevated";
    case "smoke_high":
      return "Smoke is very high";
    case "smoke_warn":
      return "Smoke is elevated";
    case "gas_high":
      return "Gas is very high";
    case "gas_warn":
      return "Gas is elevated";
    case "temp_high":
      return "Temperature is very high";
    case "temp_warn":
      return "Temperature is elevated";
    case "humidity_low_danger":
      return "Humidity is dangerously low";
    case "humidity_low_warn":
      return "Humidity is low";
    case "humidity_high_danger":
      return "Humidity is dangerously high";
    case "humidity_high_warn":
      return "Humidity is high";
    default:
      return "Sensor risk detected";
  }
};

export const buildAlert = (reading, hazard) => {
  const levelLabel = hazard.level === "danger" ? "Critical hazard" : "Warning";
  const title = levelLabel;
  const message = hazard.flags.length
    ? hazard.flags.map(flagLabel).join("; ")
    : "Sensor risk detected";

  return {
    ts: reading.ts,
    level: hazard.level,
    title,
    message,
    meta: {
      co2: reading.co2,
      smoke: reading.smoke,
      gas: reading.gas,
      flame: reading.flame,
      temperature: reading.temperature,
      humidity: reading.humidity
    }
  };
};

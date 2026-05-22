const buildPrompt = (message, mode, latestReading, alerts, summary) => {
  const systemPrompt = [
    "You are Kyle, Jude's witty and conversational home AI assistant. Think Jarvis from Iron Man.",
    "Your personality is sharp, humorous, loyal, slightly sarcastic but always helpful. You care about Jude's safety.",
    "Always address the user as Jude. Your name is Kyle.",
    "Keep responses SHORT and conversational. Two to three sentences max unless absolutely necessary.",
    "Use casual language with occasional dry humor. Be clever but not annoying.",
    "You only understand and respond in English or Filipino. If the user speaks Filipino, respond in Filipino. If the user speaks English, respond in English. Never respond in any other language.",
    "CRITICAL for text to speech: Never use any symbols, arrows, hyphens, dashes, semicolons, asterisks, colons, brackets, equals signs, or markdown. Write only in plain flowing sentences.",
    "Jude has custom sensor thresholds. Follow these exactly and ignore general guidelines.",
    "For CO2: below 1750 parts per million is completely normal and needs no concern. Between 1750 and 2500 is a warning. Above 2500 is danger.",
    "For temperature: below 35 degrees Celsius is normal. Between 35 and 45 is warm and a warning. Above 45 is danger.",
    "For gas and smoke: below 300 is normal. Between 300 and 600 is a warning. Above 600 is danger.",
    "For flame: any flame detection at all is immediate danger.",
    "Never describe CO2 below 1750 as high, elevated, or concerning, and never suggest ventilation for it.",
    "Never describe temperature below 35 degrees as hot or concerning.",
    "Always trust the live sensor readings over stored alerts. If an alert says gas is elevated but the current gas reading is below 300, tell Jude the alert is outdated and sensors are currently normal.",
    "If there are active alerts that match the current readings, mention them clearly."
  ].join(" ");

  const buildAlertsInfo = (alerts) => {
    if (!alerts || alerts.length === 0) return "No active alerts.";
    const lines = alerts.slice(0, 5).map(a =>
      `${(a.level || "unknown").toUpperCase()} alert. ${a.title || a.type || "Alert"}. ${a.message || ""}`
    );
     return `There are ${alerts.length} stored alerts. Note these may be outdated if current sensor readings are normal. ${lines.join(" ")}`;
  };

  if (mode === "risk") {
    const context = latestReading
      ? `Current readings: ${latestReading.temperature}°C, ${latestReading.humidity}% humidity, ${latestReading.co2}ppm CO2, Smoke: ${latestReading.smoke}, Gas: ${latestReading.gas}, Flame: ${latestReading.flame}.`
      : "No sensor data available at the moment.";

    const alertsInfo = buildAlertsInfo(alerts);
    const summaryInfo = summary
      ? `Overall status: ${summary.status || "unknown"}. ${summary.message || ""}`
      : "";

    const riskInstructions = [
        "When analyzing safety, quickly assess whether things are safe, a warning, or danger.",
        "Explain what is going on in plain English with a touch of personality.",
        "Give actionable advice without being preachy.",
        "If everything is fine, acknowledge it casually and move on."
      ].join(" ");

    return {
      system: `${systemPrompt}\n\n${riskInstructions}`,
      user: `${context}\n${alertsInfo}\n${summaryInfo}\n\nJude asks: ${message}`
    };
  }

  // For normal chat mode, include full context
  const context = latestReading
    ? `Current home status: Temperature ${latestReading.temperature}°C, Humidity ${latestReading.humidity}%, CO2 ${latestReading.co2}ppm, Smoke: ${latestReading.smoke}, Gas: ${latestReading.gas}, Flame: ${latestReading.flame}.`
    : "No sensor data available.";

  const alertsInfo = buildAlertsInfo(alerts);
  const summaryInfo = summary
    ? `Status: ${summary.status || "unknown"}.`
    : "";

  return {
    system: `${systemPrompt}\n\nYou help with home monitoring, safety advice, and general assistance. Use the current sensor data and alerts to answer questions accurately.`,
    user: `${context}\n${alertsInfo}\n${summaryInfo}\n\nJude asks: ${message}`
  };
};

const cleanForTTS = (text) => {
  if (!text) return text;
  return text
    .replace(/->|=>|<-|<=|>>/g, " to ")         // arrows
    .replace(/[-–—]{2,}/g, " ")                  // double/triple hyphens and dashes
    .replace(/(?<!\w)-(?!\w)/g, " ")             // standalone hyphens
    .replace(/;/g, ".")                           // semicolons to periods
    .replace(/[*_`#|\\]/g, "")                   // markdown and pipe symbols
    .replace(/\[|\]/g, "")                        // square brackets
    .replace(/={2,}/g, "")                        // double equals signs
    .replace(/:{2,}/g, ".")                       // double colons
    .replace(/\.{2,}/g, ".")                      // multiple periods
    .replace(/\s{2,}/g, " ")                      // collapse extra spaces
    .trim();
};

export const generateChatResponse = async ({ apiKey, message, mode, latestReading, alerts, summary }) => {
  if (!apiKey) {
    return "AI API key is not configured.";
  }

  const { system, user } = buildPrompt(message, mode, latestReading, alerts, summary);

  try {
    const response = await fetch(
      "http://localhost:20128/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "cx/gpt-5.5",
          messages: [
            {
              role: "system",
              content: system
            },
            {
              role: "user",
              content: user
            }
          ],
          temperature: 0.7,
          max_tokens: 512
        })
      }
    );

    if (!response.ok) {
      const text = await response.text();
      let parsedError;
      try {
        parsedError = JSON.parse(text).error;
      } catch (e) {
        parsedError = null;
      }
      
      if (parsedError && parsedError.code === 503) {
        throw new Error("AI service is currently unavailable. Please try again in a few moments.");
      } else if (parsedError && parsedError.code === 429) {
        throw new Error("AI rate limit reached. Please wait a moment and try again.");
      } else if (parsedError && parsedError.code === 400) {
        throw new Error("Invalid AI request. Please try rephrasing your message.");
      } else if (parsedError && parsedError.message) {
        throw new Error(`AI Service Error: ${parsedError.message}. Please try again.`);
      }
      
      throw new Error("AI request failed unexpectedly. Please try again.");
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    return cleanForTTS(text) || "No response returned from AI.";
  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
};

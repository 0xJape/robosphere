const buildPrompt = (message, mode, latestReading) => {
  if (mode === "risk") {
    const context = latestReading
      ? `Sensor readings: Temperature ${latestReading.temperature} C, Humidity ${latestReading.humidity} %, CO2 ${latestReading.co2} ppm, Smoke ${latestReading.smoke}, Gas ${latestReading.gas}, Flame ${latestReading.flame}.`
      : "No sensor readings are available yet.";

    return [
      "You are RoboSphere AI, an intelligent environmental risk assessment assistant integrated into a real-time IoT monitoring system.",
      "Your role is to analyze sensor data and clearly assess environmental risks based on the given inputs.",
      "You will receive sensor readings such as Temperature (C), Humidity (%), CO2 level (ppm), Smoke level, Gas level.",
      "Your responsibilities:",
      "1. Assess the overall risk level: SAFE, WARNING, DANGER.",
      "2. Explain the situation in simple, clear language: what is happening, which values are abnormal, why it is risky.",
      "3. Provide actionable recommendations: immediate actions and preventive measures.",
      "4. Be concise but informative. Avoid long paragraphs. Use bullet points when needed.",
      "5. Be accurate and realistic. Do not exaggerate. Only flag danger when thresholds are clearly exceeded.",
      "6. Maintain a professional and calm tone. Do not use emojis.",
      "7. If all values are normal, clearly state conditions are safe and suggest routine monitoring.",
      "Output format:",
      "Risk Level: <SAFE | WARNING | DANGER>",
      "Summary: <1-2 sentences>",
      "Details:",
      "- <bullet list of abnormal readings>",
      "Recommendation:",
      "- <bullet list of actions>",
      context,
      `User request: ${message}`
    ].join("\n");
  }

  return [
    "You are RoboSphere, a concise robotics mentor.",
    "Provide project ideas, materials, and step-by-step guidance.",
    `User request: ${message}`,
    "Respond with a short overview and then numbered steps."
  ].join("\n");
};

const MODEL_CANDIDATES = ["gemini-3-flash-preview"];

export const generateChatResponse = async ({ apiKeys, apiKey, message, mode, latestReading }) => {
  const keys = Array.isArray(apiKeys)
    ? apiKeys
    : [apiKey].filter(Boolean);

  if (keys.length === 0) {
    return "Gemini API key is not configured.";
  }

  const prompt = buildPrompt(message, mode, latestReading);

  let lastError = null;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.4,
      topP: 0.8,
      maxOutputTokens: 768
    }
  };

  for (const key of keys) {
    for (const model of MODEL_CANDIDATES) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": key
            },
            body: JSON.stringify(body)
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
            console.warn("AI service unavailable (503), trying next model/key if available...");
            throw new Error("This AI model is currently experiencing high demand. Please try again in a few moments.");
          } else if (parsedError && parsedError.code === 429) {
            console.warn("API token limit reached (429), switching to backup API key...");
            throw new Error("We've hit the AI rate limit. Please wait a moment and try again.");
          } else if (parsedError && parsedError.code === 400) {
            throw new Error("Invalid AI request. Please try rephrasing your message.");
          } else if (parsedError && parsedError.message) {
            throw new Error(`AI Service Error: ${parsedError.message}. Please try again.`);
          }
          
          throw new Error("AI request failed unexpectedly. Please try again.");
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || "No response returned from Gemini.";
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError || new Error("Gemini request failed.");
};

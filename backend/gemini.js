const buildPrompt = (message, mode, latestReading) => {
  if (mode === "risk") {
    const context = latestReading
      ? `Latest reading: CO2 ${latestReading.co2}, smoke ${latestReading.smoke}, gas ${latestReading.gas}, flame ${latestReading.flame}, temp ${latestReading.temperature}, humidity ${latestReading.humidity}.`
      : "No sensor readings are available yet.";

    return [
      "You are RoboSphere, a concise safety assistant for robotics labs.",
      "Analyze risk and provide safety recommendations.",
      context,
      `User request: ${message}`,
      "Respond in 4-6 bullet points, keep it practical."
    ].join("\n");
  }

  return [
    "You are RoboSphere, a concise robotics mentor.",
    "Provide project ideas, materials, and step-by-step guidance.",
    `User request: ${message}`,
    "Respond with a short overview and then numbered steps."
  ].join("\n");
};

export const generateChatResponse = async ({ apiKey, message, mode, latestReading }) => {
  if (!apiKey) {
    return "Gemini API key is not configured.";
  }

  const prompt = buildPrompt(message, mode, latestReading);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          topP: 0.8,
          maxOutputTokens: 512
        }
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini request failed: ${text}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || "No response returned from Gemini.";
};

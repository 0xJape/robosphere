const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const apiGet = async (path) => {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
};

export const getSummary = () => apiGet("/api/summary");
export const getReadings = (limit = 200) => apiGet(`/api/sensors?limit=${limit}`);
export const getAlerts = (limit = 200) => apiGet(`/api/alerts?limit=${limit}`);
export const deleteAlert = (id) => fetch(`${API_URL}/api/alerts/${id}`, { method: "DELETE" }).then((res) => res.json());
export const clearAlerts = () => fetch(`${API_URL}/api/alerts`, { method: "DELETE" }).then((res) => res.json());
export const getFiles = () => apiGet(`/api/files`);
export const deleteFile = (filename) => fetch(`${API_URL}/api/files/${encodeURIComponent(filename)}`, { method: "DELETE" }).then((res) => res.json());

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "File upload failed.");
  }
  return response.json();
};

export const postChat = async (payload) => {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      model: "fastest-available-model" // Specify the fastest AI model
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Chat request failed.");
  }

  return response.json();
};

export const textToSpeech = async (text) => {
  const response = await fetch("http://localhost:20128/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer sk-7db41d1bc1f89095-ibczt2-82dcd15f"
    },
    body: JSON.stringify({
      model: "dg/aura-2-orion-en",
      input: text
    })
  });

  if (!response.ok) {
     const errText = await response.text().catch(() => "");
     throw new Error(`Text-to-speech failed (${response.status}): ${errText}`);
  }

  return response.blob();
};

export const speechToText = async (audioBlob) => {
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("model", "dg/nova-3");
  formData.append("language", "multi");
  formData.append("detect_language", "true");

  const response = await fetch("http://localhost:20128/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer sk-7db41d1bc1f89095-ibczt2-82dcd15f"
    },
    body: formData
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Speech-to-text failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.text || "";
};

export { API_URL };

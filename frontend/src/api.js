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
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Chat request failed.");
  }

  return response.json();
};

export { API_URL };

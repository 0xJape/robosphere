import { useState, useEffect, useRef } from "react";
import { getFiles, uploadFile, deleteFile, API_URL } from "../api";

export default function ArchivesPanel() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await getFiles();
      setFiles(res.files || []);
      setError(null);
    } catch (err) {
      setError("Failed to load archive files.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      await uploadFile(file);
      await fetchFiles();
    } catch (err) {
      setError(err.message || "Failed to upload file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };
  const handleDelete = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;
    try {
      setError(null);
      await deleteFile(filename);
      await fetchFiles();
    } catch (err) {
      setError(err.message || "Failed to delete file.");
    }
  };
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const formatSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (ts) => {
    if (!ts) return "--";
    return new Date(ts).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="panel" style={{ flex: 1, minHeight: '500px' }}>
      <div className="panel-header">
        <div>
          <h3>Document Archives</h3>
          <p className="muted">Shared manuals, protocols, and safety logs</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            style={{ display: "none" }}
            accept=".pdf,.doc,.docx,.txt,.csv,.png,.jpg,.jpeg"
          />
          <button
            className="chat-send-btn"
            onClick={triggerFileInput}
            disabled={uploading}
            style={{ minWidth: '120px' }}
          >
            {uploading ? "Uploading..." : "Upload File"}
          </button>
        </div>
      </div>
      
      {error && (
        <div style={{ padding: '12px', background: 'rgba(255, 77, 77, 0.1)', color: 'var(--danger)', marginBottom: '16px', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="empty-state">Loading archives...</div>
      ) : files.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <div>No files have been archived yet.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {files.map((f, i) => {
            const ext = f.name.split('.').pop()?.toUpperCase() || "FILE";
            return (
              <div key={i} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '16px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ 
                    background: 'rgba(91, 141, 238, 0.1)', 
                    color: 'var(--accent)', 
                    padding: '10px', 
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    width: '45px',
                    textAlign: 'center'
                  }}>
                    {ext}
                  </div>
                  <div>
                    <div style={{ fontWeight: '500', marginBottom: '4px', wordBreak: 'break-all' }}>{f.name}</div>
                    <div className="muted" style={{ fontSize: '12px', display: 'flex', gap: '16px' }}>
                      <span>{formatSize(f.size)}</span>
                      <span>Uploaded {formatDate(f.ts)}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <a 
                    href={`${API_URL}${f.url}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      color: 'var(--text)',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 500,
                      display: 'inline-block'
                    }}
                  >
                    Download
                  </a>
                  <button 
                    onClick={() => handleDelete(f.name)}
                    style={{
                      background: 'rgba(255,99,132,0.1)',
                      border: '1px solid rgba(255,99,132,0.3)',
                      color: '#ff6384',
                      padding: '7px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                      marginLeft: '8px',
                      display: 'inline-block'
                    }}
                    title="Delete File"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

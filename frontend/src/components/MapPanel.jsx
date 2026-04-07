import "../mapIcons.js";
import { MapContainer, TileLayer, Marker, Circle, Popup } from "react-leaflet";

const DEFAULT_MAP = { lat: 37.7749, lng: -122.4194, zoom: 13 };

export default function MapPanel({ map, latest }) {
  const config = map || DEFAULT_MAP;

  // Determine circle color and radius based on hazard level
  let circleColor = "#1a9c8b"; // safe (greenish)
  let circleRadius = 200;
  
  if (latest?.hazard_level === "danger") {
    circleColor = "#ff4d4d"; // danger
    circleRadius = 500;
  } else if (latest?.hazard_level === "warning") {
    circleColor = "#ffc857"; // warning
    circleRadius = 350;
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>Facility Map</h3>
          <p className="muted">Satellite view</p>
        </div>
      </div>
      <div className="map-wrap">
        <MapContainer
          center={[config.lat, config.lng]}
          zoom={config.zoom}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution="Tiles © Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <Circle 
            center={[config.lat, config.lng]} 
            pathOptions={{ color: circleColor, fillColor: circleColor, fillOpacity: 0.3 }} 
            radius={circleRadius} 
          />
          <Marker position={[config.lat, config.lng]}>
            <Popup>
              <div style={{ padding: '4px', textAlign: 'center' }}>
                <strong style={{ color: circleColor, textTransform: 'uppercase' }}>
                  {latest?.hazard_level || "SAFE"} ZONE
                </strong>
                {latest && (
                  <div style={{ marginTop: '8px', fontSize: '13px' }}>
                    <div>Temp: {latest.temperature}°C</div>
                    <div>CO2: {latest.co2} ppm</div>
                    {latest.smoke > 0 && <div>Smoke: {latest.smoke}%</div>}
                    {latest.gas > 0 && <div>Gas: {latest.gas} ppm</div>}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
}

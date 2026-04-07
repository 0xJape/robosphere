import "../mapIcons.js";
import { MapContainer, TileLayer, Marker } from "react-leaflet";

const DEFAULT_MAP = { lat: 37.7749, lng: -122.4194, zoom: 13 };

export default function MapPanel({ map }) {
  const config = map || DEFAULT_MAP;

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
          <Marker position={[config.lat, config.lng]} />
        </MapContainer>
      </div>
    </div>
  );
}

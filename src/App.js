import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  CircleMarker
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { getDistance, getRhumbLineBearing } from "geolib";
import { LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import "./App.css";

const API = "https://twistable-reach-decorator.ngrok-free.dev";

// 🔥 Heatmap
function Heatmap({ events }) {
  const map = useMap();

  useEffect(() => {
    if (!events.length) return;

    const heat = L.heatLayer(
      events.map(e => [e.lat, e.lng, e.severity]),
      { radius: 30, blur: 20 }
    ).addTo(map);

    return () => map.removeLayer(heat);
  }, [events, map]);

  return null;
}

// 🚗 Follow user
function FollowUser({ route }) {
  const map = useMap();

  useEffect(() => {
    if (route.length > 0) {
      map.flyTo(route[route.length - 1], 17);
    }
  }, [route, map]);

  return null;
}

// 🚗 Car icon
const carIcon = (angle) =>
  L.divIcon({
    className: "car-icon",
    html: `<div style="transform: rotate(${angle}deg); font-size:28px;">🚗</div>`
  });

function App() {
  const [isDriving, setIsDriving] = useState(false);
  const [route, setRoute] = useState([]);
  const [events, setEvents] = useState([]);
  const [watchId, setWatchId] = useState(null);

  const [speed, setSpeed] = useState("...");
  const [distance, setDistance] = useState(0);
  const [heading, setHeading] = useState(0);
  const [instruction, setInstruction] = useState("Ready");

  const [showReport, setShowReport] = useState(false);
  const [speedData, setSpeedData] = useState([]);

  const reportRef = useRef();

  // 🚗 Start
  const startDriving = () => {
    setIsDriving(true);
    setRoute([]);
    setEvents([]);
    setDistance(0);
    setSpeedData([]);

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;

        const point = [latitude, longitude];

        setRoute(prev => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];

            const prevPoint = {
              latitude: last[0],
              longitude: last[1]
            };

            const currPoint = { latitude, longitude };

            const dist = getDistance(prevPoint, currPoint);
            if (dist < 3) return prev;

            setDistance(d => d + dist);

            const angle = getRhumbLineBearing(prevPoint, currPoint);
            setHeading(angle);
          }

          return [...prev, point];
        });

        const sp = speed ? (speed * 3.6).toFixed(1) : 0;
        setSpeed(sp);

        setSpeedData(prev => [
          ...prev,
          { time: prev.length, speed: Number(sp) }
        ]);
      },
      (err) => console.log(err),
      { enableHighAccuracy: true }
    );

    setWatchId(id);
  };

  // 🛑 Stop
  const endDriving = async () => {
    if (watchId) navigator.geolocation.clearWatch(watchId);

    setIsDriving(false);
    setShowReport(true);

    try {
      await axios.post(`${API}/save-session`, {
        path: route,
        events
      });
    } catch {}
  };

  // ➕ Event
  const addEvent = (type) => {
    if (!route.length) return;

    const last = route[route.length - 1];

    setEvents(prev => [
      ...prev,
      { lat: last[0], lng: last[1], type, severity: 5 }
    ]);
  };

  // 📄 PDF
  const downloadPDF = async () => {
    const canvas = await html2canvas(reportRef.current);
    const img = canvas.toDataURL("image/png");

    const pdf = new jsPDF();
    pdf.addImage(img, "PNG", 10, 10, 180, 0);
    pdf.save("trip-report.pdf");
  };

  // 🎥 Replay
  const replayRoute = () => {
    let i = 0;
    const interval = setInterval(() => {
      if (i >= route.length) return clearInterval(interval);
      setRoute(prev => [...prev.slice(0, i + 1)]);
      i++;
    }, 300);
  };

  return (
    <div className="app">
      <h1 className="title">
        RoadSense AI
        <span>– A Pothole Detection System</span>
      </h1>

      <div className="panel glass">
        <div className="controls">
          {!isDriving ? (
            <button className="btn primary" onClick={startDriving}>
              🚗 Start Drive
            </button>
          ) : (
            <>
              <button className="btn warn" onClick={() => addEvent("pothole")}>
                🚧 Pothole
              </button>

              <button className="btn warn" onClick={() => addEvent("breaker")}>
                ⚠️ Breaker
              </button>

              <button className="btn danger" onClick={endDriving}>
                🛑 End
              </button>
            </>
          )}
        </div>

        <div className="stats">
          <div className="card">⚡ {speed} km/h</div>
          <div className="card">📏 {(distance / 1000).toFixed(2)} km</div>
          <div className="card">🧭 {instruction}</div>
        </div>
      </div>

      <MapContainer center={[26.85, 80.95]} zoom={13} className="map">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <FollowUser route={route} />

        <Polyline positions={route} color="cyan" />

        {route.length > 0 && (
          <>
            {/* 🔵 Blue Dot */}
            <CircleMarker center={route.at(-1)} radius={8} color="#3b82f6" />
            <CircleMarker center={route.at(-1)} radius={18} opacity={0.3} />

            {/* 🚗 Car */}
            <Marker position={route.at(-1)} icon={carIcon(heading)}>
              <Popup>You are here 🚗</Popup>
            </Marker>
          </>
        )}

        <Heatmap events={events} />
      </MapContainer>

      {/* 📊 REPORT */}
      {showReport && (
        <div className="report glass" ref={reportRef}>
          <h2>📊 Trip Summary</h2>

          <p>📏 Distance: {(distance / 1000).toFixed(2)} km</p>
          <p>⚡ Speed: {speed} km/h</p>
          <p>🚧 Events: {events.length}</p>

          <LineChart width={300} height={200} data={speedData}>
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="speed" stroke="#38bdf8" />
          </LineChart>

          <div className="report-buttons">
            <button className="btn primary" onClick={downloadPDF}>
              📄 PDF
            </button>
            <button className="btn primary" onClick={replayRoute}>
              🎥 Replay
            </button>
            <button className="btn" onClick={() => setShowReport(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
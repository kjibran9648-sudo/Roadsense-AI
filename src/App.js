import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  CircleMarker,
  useMap
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { getDistance, getRhumbLineBearing } from "geolib";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import jsPDF from "jspdf";
import "./App.css";

/* 📍 FOLLOW USER */
function FollowUser({ route }) {
  const map = useMap();

  useEffect(() => {
    if (route.length > 0) {
      map.flyTo(route[route.length - 1], 17);
    }
  }, [route, map]);

  return null;
}

/* 🚗 Car icon */
const carIcon = angle =>
  L.divIcon({
    html: `<div style="transform: rotate(${angle}deg); font-size:22px;">🚗</div>`
  });

function App() {
  const [route, setRoute] = useState([]);
  const [events, setEvents] = useState([]);
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [heading, setHeading] = useState(0);
  const [watchId, setWatchId] = useState(null);
  const [isDriving, setIsDriving] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [speedData, setSpeedData] = useState([]);

  /* 🚗 START */
  const startDriving = () => {
    setIsDriving(true);
    setRoute([]);
    setEvents([]);
    setDistance(0);
    setSpeedData([]);

    const id = navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude, speed } = pos.coords;
        const point = [latitude, longitude];

        setRoute(prev => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];

            const dist = getDistance(
              { latitude: last[0], longitude: last[1] },
              { latitude, longitude }
            );

            if (dist < 2) return prev;

            setDistance(d => d + dist);

            const angle = getRhumbLineBearing(
              { latitude: last[0], longitude: last[1] },
              { latitude, longitude }
            );

            setHeading(angle);
          }

          return [...prev, point];
        });

        const sp = speed ? speed * 3.6 : 0;
        const fixed = Number(sp.toFixed(1));

        setSpeed(fixed);

        setSpeedData(prev => [
          ...prev,
          { time: prev.length + 1, speed: fixed }
        ]);
      },
      err => {
        console.error(err);
        alert("Enable GPS permission");
      },
      { enableHighAccuracy: true }
    );

    setWatchId(id);
  };

  /* 🛑 STOP */
  const endDriving = () => {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    setIsDriving(false);
    setShowReport(true);
  };

  /* ➕ ADD EVENT */
  const addEvent = type => {
    if (!route.length) return;

    const last = route[route.length - 1];

    setEvents(prev => [
      ...prev,
      {
        lat: last[0],
        lng: last[1],
        type
      }
    ]);
  };

  /* 🎨 ROUTE IMAGE (PDF) */
  const generateRouteImage = () => {
    if (route.length < 2) return null;

    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const lats = route.map(p => p[0]);
    const lngs = route.map(p => p[1]);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const scaleX = canvas.width / (maxLng - minLng || 1);
    const scaleY = canvas.height / (maxLat - minLat || 1);

    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 4;
    ctx.beginPath();

    route.forEach((p, i) => {
      const x = (p[1] - minLng) * scaleX;
      const y = canvas.height - (p[0] - minLat) * scaleY;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    events.forEach(e => {
      const x = (e.lng - minLng) * scaleX;
      const y = canvas.height - (e.lat - minLat) * scaleY;

      ctx.fillStyle =
        e.type === "pothole"
          ? "red"
          : e.type === "breaker"
          ? "yellow"
          : "purple";

      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();
    });

    return canvas.toDataURL("image/png");
  };

  /* 📄 PDF */
  const downloadPDF = () => {
    if (route.length < 2) {
      alert("Drive first to generate report");
      return;
    }

    const pdf = new jsPDF();

    pdf.text("RoadSense AI Report", 10, 10);

    const img = generateRouteImage();
    pdf.addImage(img, "PNG", 10, 20, 180, 80);

    pdf.text(`Distance: ${(distance / 1000).toFixed(2)} km`, 10, 110);
    pdf.text(`Events: ${events.length}`, 10, 120);

    pdf.save("RoadSense_Report.pdf");
  };

  return (
    <div className="app">
      <div className="nav-bar">🚗 RoadSense AI</div>

      {/* MAP */}
      <MapContainer center={[26.85, 80.95]} zoom={13} className="map">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FollowUser route={route} />
        <Polyline positions={route} color="#3b82f6" />

        {route.length > 0 && (
          <>
            <CircleMarker center={route.at(-1)} radius={8} color="blue" />
            <Marker position={route.at(-1)} icon={carIcon(heading)} />
          </>
        )}
      </MapContainer>

      {/* CONTROLS */}
      <div className="floating-panel">
        {!isDriving ? (
          <button className="start-btn" onClick={startDriving}>🚗</button>
        ) : (
          <>
            <button className="pothole-btn" onClick={() => addEvent("pothole")}>🚧</button>
            <button className="breaker-btn" onClick={() => addEvent("breaker")}>⚠️</button>
            <button className="stop-btn" onClick={endDriving}>🛑</button>
          </>
        )}
      </div>

      {/* REPORT */}
      {showReport && (
        <div className="report premium">
          <h2>📊 Drive Analytics</h2>

          <div className="report-grid">
            <div className="report-card">
              <h3>Distance</h3>
              <p>{(distance / 1000).toFixed(2)} km</p>
            </div>

            <div className="report-card">
              <h3>Speed</h3>
              <p>{speed} km/h</p>
            </div>

            <div className="report-card">
              <h3>Events</h3>
              <p>{events.length}</p>
            </div>

            <div className="report-card">
              <h3>Road Score</h3>
              <p>{Math.max(100 - events.length * 2, 0)}</p>
            </div>
          </div>

          {/* ROUTE PREVIEW */}
          <h3>🗺 Route Overview</h3>
          <div className="report-map">
            <MapContainer
              center={route[0] || [26.85, 80.95]}
              zoom={14}
              style={{ height: "200px", width: "100%" }}
              dragging={false}
              zoomControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Polyline positions={route} color="#3b82f6" />

              {events.map((e, i) => (
                <CircleMarker
                  key={i}
                  center={[e.lat, e.lng]}
                  radius={5}
                  color={e.type === "pothole" ? "red" : "yellow"}
                />
              ))}
            </MapContainer>
          </div>

          {/* GRAPH */}
          <h3>📈 Speed Graph</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={speedData}>
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line dataKey="speed" stroke="#3b82f6" />
            </LineChart>
          </ResponsiveContainer>

          <div className="report-buttons">
            <button onClick={downloadPDF}>📄 Export PDF</button>
            <button onClick={() => setShowReport(false)}>⬅ Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
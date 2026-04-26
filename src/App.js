import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
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
import { LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import polyline from "@mapbox/polyline";
import "./App.css";

const API = "https://roadsense-backend-gdsm.onrender.com";
const MAPBOX_TOKEN = "YOUR_MAPBOX_TOKEN"; // 🔑 replace

/* 🔥 HEATMAP */
function Heatmap({ events }) {
  const map = useMap();

  useEffect(() => {
    if (!events.length) return;

    const heat = L.heatLayer(
      events.map(e => [e.lat, e.lng, e.severity]),
      { radius: 25 }
    ).addTo(map);

    return () => map.removeLayer(heat);
  }, [events, map]);

  return null;
}

/* 🚗 CAR ICON */
const carIcon = (angle) =>
  L.divIcon({
    html: `<div style="transform: rotate(${angle}deg); font-size:26px;">🚗</div>`
  });

function App() {
  const [route, setRoute] = useState([]);
  const [events, setEvents] = useState([]);
  const [watchId, setWatchId] = useState(null);
  const [speed, setSpeed] = useState("0");
  const [distance, setDistance] = useState(0);
  const [heading, setHeading] = useState(0);
  const [isDriving, setIsDriving] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [speedData, setSpeedData] = useState([]);

  const reportRef = useRef();

  /* 🚗 START */
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
            const last = prev.at(-1);

            const dist = getDistance(
              { latitude: last[0], longitude: last[1] },
              { latitude, longitude }
            );

            if (dist < 3) return prev;

            setDistance(d => d + dist);

            const angle = getRhumbLineBearing(
              { latitude: last[0], longitude: last[1] },
              { latitude, longitude }
            );

            setHeading(angle);
          }

          return [...prev, point];
        });

        const sp = speed ? (speed * 3.6).toFixed(1) : "0";
        setSpeed(sp);

        setSpeedData(prev => [
          ...prev,
          { time: prev.length, speed: Number(sp) }
        ]);
      },
      () => alert("Enable GPS"),
      { enableHighAccuracy: true }
    );

    setWatchId(id);
  };

  /* 🛑 STOP */
  const endDriving = async () => {
    if (watchId) navigator.geolocation.clearWatch(watchId);

    setIsDriving(false);
    setShowReport(true);

    try {
      await axios.post(`${API}/save-session`, { path: route, events });
    } catch {}
  };

  /* ➕ ADD EVENT */
  const addEvent = (type) => {
    if (!route.length) return;

    const last = route.at(-1);

    setEvents(prev => [
      ...prev,
      {
        lat: last[0],
        lng: last[1],
        type,
        severity:
          type === "streetlight"
            ? 1
            : Math.floor(Math.random() * 10) + 1
      }
    ]);
  };

  /* 🗺️ STATIC ROUTE IMAGE (FOR REPORT + PDF ✅) */
  const getRouteImage = () => {
    if (route.length < 2) return "";

    const coords = route.map(p => [p[0], p[1]]);
    const encoded = polyline.encode(coords);

    const markers = events.map(e => {
      let color = "ff0000"; // pothole
      if (e.type === "breaker") color = "ffff00";
      if (e.type === "streetlight") color = "800080";

      return `pin-s+${color}(${e.lng},${e.lat})`;
    }).join(",");

    return `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/path-5+0000ff(${encoded})/${markers}/${coords[0][1]},${coords[0][0]},13/700x300?access_token=${MAPBOX_TOKEN}`;
  };

  /* 📄 PDF */
  const downloadPDF = async () => {
    const canvas = await html2canvas(reportRef.current);
    const img = canvas.toDataURL("image/png");

    const pdf = new jsPDF();
    pdf.addImage(img, "PNG", 10, 10, 180, 0);
    pdf.save("RoadSense_Report.pdf");
  };

  /* 🎥 REPLAY */
  const replayRoute = () => {
    const original = [...route];
    let i = 0;
    setRoute([]);

    const interval = setInterval(() => {
      if (i >= original.length) return clearInterval(interval);
      setRoute(prev => [...prev, original[i]]);
      i++;
    }, 200);
  };

  return (
    <div className="app">
      <h1 className="title">
        RoadSense AI <span>– Pothole Detection System</span>
      </h1>

      {/* 🎮 CONTROLS */}
      <div className="controls">
        {!isDriving ? (
          <button className="btn start" onClick={startDriving}>
            🚗 Start Driving
          </button>
        ) : (
          <div className="drive-controls">
            <button className="btn pothole" onClick={() => addEvent("pothole")}>
              🚧
            </button>

            <button className="btn breaker" onClick={() => addEvent("breaker")}>
              ⚠️
            </button>

            <button className="btn light" onClick={() => addEvent("streetlight")}>
              💡
            </button>

            <button className="btn end" onClick={endDriving}>
              🛑
            </button>
          </div>
        )}
      </div>

      {/* 🗺️ MAP */}
      <MapContainer center={[26.85, 80.95]} zoom={13} className="map">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <Polyline positions={route} color="#38bdf8" />

        {route.length > 0 && (
          <>
            <CircleMarker center={route.at(-1)} radius={8} color="blue" />
            <Marker position={route.at(-1)} icon={carIcon(heading)} />
          </>
        )}

        <Heatmap events={events} />
      </MapContainer>

      {/* 📊 REPORT */}
      {showReport && (
        <div ref={reportRef} className="report premium">
          <h2>📊 Drive Analytics</h2>

          <div className="report-grid">
            <div className="card">
              <h4>Distance</h4>
              <p>{(distance / 1000).toFixed(2)} km</p>
            </div>

            <div className="card">
              <h4>Speed</h4>
              <p>{speed} km/h</p>
            </div>

            <div className="card">
              <h4>Events</h4>
              <p>{events.length}</p>
            </div>

            <div className="card">
              <h4>Road Score</h4>
              <p>{Math.max(0, 100 - events.length * 5)}</p>
            </div>
          </div>

          <h3>🗺️ Route Overview</h3>
          <img
            src={getRouteImage()}
            alt="Route"
            style={{ width: "100%", borderRadius: "12px" }}
          />

          <h3>📈 Speed Graph</h3>
          <LineChart width={350} height={200} data={speedData}>
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line dataKey="speed" stroke="#38bdf8" />
          </LineChart>

          <div className="report-buttons">
            <button onClick={downloadPDF}>📄 Export</button>
            <button onClick={replayRoute}>🎥 Replay</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
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

const API = "https://roadsense-backend-gdsm.onrender.com";

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

/* 📍 AUTO ZOOM */
function FitBounds({ route }) {
  const map = useMap();

  useEffect(() => {
    if (route.length > 1) {
      const bounds = L.latLngBounds(route);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [route, map]);

  return null;
}

/* 🗺️ REPORT MAP */
function ReportMap({ route, events }) {
  return (
    <MapContainer
      center={route[0] || [26.85, 80.95]}
      zoom={14}
      style={{ height: "250px", width: "100%", borderRadius: "10px" }}
      dragging={false}
      zoomControl={false}
      scrollWheelZoom={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      <FitBounds route={route} />

      <Polyline positions={route} color="cyan" />

      {/* 🧠 AI severity coloring */}
      {events.map((e, i) => {
        let color = "green";
        if (e.severity > 6) color = "red";
        else if (e.severity > 3) color = "orange";

        return (
          <CircleMarker
            key={i}
            center={[e.lat, e.lng]}
            radius={6}
            pathOptions={{ color, fillOpacity: 1 }}
          />
        );
      })}

      <Heatmap events={events} />
    </MapContainer>
  );
}

/* 🚗 CAR ICON */
const carIcon = (angle) =>
  L.divIcon({
    html: `<div style="transform: rotate(${angle}deg); font-size:28px;">🚗</div>`
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
            const last = prev[prev.length - 1];

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
      (err) => alert("GPS error"),
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

  /* ➕ EVENT */
  const addEvent = (type) => {
    if (!route.length) return;

    const last = route.at(-1);

    setEvents(prev => [
      ...prev,
      {
        lat: last[0],
        lng: last[1],
        type,
        severity: Math.floor(Math.random() * 10) + 1
      }
    ]);
  };

  /* 📄 PDF */
  const downloadPDF = async () => {
    const canvas = await html2canvas(reportRef.current, { scale: 2 });
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
    }, 300);
  };

  return (
    <div className="app">
      <h1 className="title">
        RoadSense AI
        <span> – A Pothole Detection System</span>
      </h1>

      <div className="controls">
        {!isDriving ? (
          <button onClick={startDriving}>Start</button>
        ) : (
          <>
            <button onClick={() => addEvent("pothole")}>🚧</button>
            <button onClick={() => addEvent("breaker")}>⚠️</button>
            <button onClick={endDriving}>Stop</button>
          </>
        )}
      </div>

      <MapContainer center={[26.85, 80.95]} zoom={13} className="map">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <Polyline positions={route} color="cyan" />

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
        <div ref={reportRef} className="report">
          <h2>Trip Report</h2>

          <p>Distance: {(distance / 1000).toFixed(2)} km</p>
          <p>Speed: {speed} km/h</p>

          {/* 🗺️ MAP SNAPSHOT */}
          <h3>🗺️ Route Overview</h3>
          <ReportMap route={route} events={events} />

          {/* 📊 GRAPH */}
          <LineChart width={300} height={200} data={speedData}>
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line dataKey="speed" stroke="#00f" />
          </LineChart>

          <button onClick={downloadPDF}>📄 PDF</button>
          <button onClick={replayRoute}>🎥 Replay</button>
        </div>
      )}
    </div>
  );
}

export default App;
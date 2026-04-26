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
import "./App.css";

const API = "https://roadsense-backend-gdsm.onrender.com";

/* 🔥 Heatmap */
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

/* 🚗 Car icon */
const carIcon = angle =>
  L.divIcon({
    html: `<div style="transform: rotate(${angle}deg); font-size:24px;">🚗</div>`
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

  /* 🚗 Start Driving */
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
      () => alert("❌ Enable GPS permission"),
      { enableHighAccuracy: true }
    );

    setWatchId(id);
  };

  /* 🛑 Stop Driving */
  const endDriving = async () => {
    if (watchId) navigator.geolocation.clearWatch(watchId);

    setIsDriving(false);
    setShowReport(true);

    try {
      await axios.post(`${API}/save-session`, { path: route, events });
    } catch {}
  };

  /* ➕ Add Event */
  const addEvent = type => {
    if (!route.length) return;

    const last = route[route.length - 1];

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

  /* 📄 Export PDF (FULL FIX) */
  const downloadPDF = async () => {
    const element = reportRef.current;

    // wait for map tiles
    await new Promise(res => setTimeout(res, 1500));

    const canvas = await html2canvas(element, {
      useCORS: true,
      allowTaint: true,
      scale: 2
    });

    const img = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");

    const width = 190;
    const height = (canvas.height * width) / canvas.width;

    pdf.addImage(img, "PNG", 10, 10, width, height);
    pdf.save("RoadSense_Report.pdf");
  };

  /* 🎥 Replay */
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
        RoadSense AI <span>Pothole Detection System</span>
      </h1>

      {/* CONTROLS */}
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
            <button
              className="btn light"
              onClick={() => addEvent("streetlight")}
            >
              💡
            </button>
            <button className="btn end" onClick={endDriving}>
              🛑
            </button>
          </div>
        )}
      </div>

      {/* REPORT (MAP INSIDE 🔥) */}
      <div ref={reportRef} className="report">

        {/* MAP INSIDE REPORT */}
        <MapContainer
          center={[26.85, 80.95]}
          zoom={13}
          className="map"
        >
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

        {showReport && (
          <>
            <h2>📊 Drive Analytics</h2>

            <p>Distance: {(distance / 1000).toFixed(2)} km</p>
            <p>Speed: {speed} km/h</p>
            <p>Events: {events.length}</p>

            <h3>📈 Speed Graph</h3>
            <LineChart width={350} height={200} data={speedData}>
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line dataKey="speed" stroke="cyan" />
            </LineChart>

            <div className="report-buttons">
              <button onClick={downloadPDF}>📄 Export PDF</button>
              <button onClick={replayRoute}>🎥 Replay</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
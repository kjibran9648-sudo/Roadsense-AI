import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getDistance, getRhumbLineBearing } from "geolib";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import jsPDF from "jspdf";

/* ─── Follow user on map ─── */
function FollowUser({ route }) {
  const map = useMap();
  useEffect(() => {
    if (route.length > 0) map.flyTo(route[route.length - 1], 17);
  }, [route]);
  return null;
}

/* ─── Rotating car icon ─── */
const carIcon = (angle) =>
  L.divIcon({
    className: "",
    html: `<div style="transform:rotate(${angle}deg);font-size:26px;filter:drop-shadow(0 0 6px #38bdf8)">🚗</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

/* ─── Speed Gauge ─── */
function SpeedGauge({ speed }) {
  const max = 120;
  const pct = Math.min(speed / max, 1);
  const angle = -135 + pct * 270;
  const color = speed < 40 ? "#22c55e" : speed < 80 ? "#f59e0b" : "#ef4444";

  return (
    <div style={styles.gaugeWrap}>
      <svg viewBox="0 0 120 80" width="140" height="95">
        <path d="M10,75 A55,55 0 1,1 110,75" fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M10,75 A55,55 0 1,1 110,75"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${pct * 173} 173`}
          style={{ transition: "stroke-dasharray 0.4s ease, stroke 0.4s ease" }}
        />
        <line
          x1="60" y1="75"
          x2={60 + 38 * Math.cos(((angle - 90) * Math.PI) / 180)}
          y2={75 + 38 * Math.sin(((angle - 90) * Math.PI) / 180)}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          style={{ transition: "all 0.4s ease" }}
        />
        <circle cx="60" cy="75" r="5" fill={color} />
      </svg>
      <div style={{ ...styles.speedNum, color }}>{speed}</div>
      <div style={styles.speedUnit}>km/h</div>
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ icon, label, value, accent }) {
  return (
    <div style={{ ...styles.statCard, borderColor: accent + "40" }}>
      <div style={{ ...styles.statIcon, color: accent }}>{icon}</div>
      <div style={styles.statVal}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

/* ─── Event Button ─── */
function EventBtn({ emoji, label, color, count, onClick }) {
  return (
    <button style={{ ...styles.evtBtn, borderColor: color }} onClick={onClick}>
      <span style={styles.evtEmoji}>{emoji}</span>
      <span style={styles.evtLabel}>{label}</span>
      {count > 0 && <span style={{ ...styles.evtBadge, background: color }}>{count}</span>}
    </button>
  );
}

/* ─── Custom Tooltip ─── */
function CustomTooltip({ active, payload }) {
  if (active && payload?.length) {
    return (
      <div style={styles.chartTip}>
        <div style={{ color: "#38bdf8", fontWeight: 700 }}>{payload[0].value} km/h</div>
      </div>
    );
  }
  return null;
}

/* ═══════════════════ MAIN APP ═══════════════════ */
export default function App() {
  const [route, setRoute] = useState([]);
  const [events, setEvents] = useState([]);
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [heading, setHeading] = useState(0);
  const [watchId, setWatchId] = useState(null);
  const [isDriving, setIsDriving] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [speedData, setSpeedData] = useState([]);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [avgSpeed, setAvgSpeed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const timerRef = useRef(null);

  /* timer */
  useEffect(() => {
    if (isDriving) {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isDriving]);

  const fmtTime = (s) =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const countEvents = (type) => events.filter((e) => e.type === type).length;

  /* ─── START ─── */
  const startDriving = () => {
    setIsDriving(true);
    setRoute([]);
    setEvents([]);
    setDistance(0);
    setSpeedData([]);
    setMaxSpeed(0);
    setAvgSpeed(0);
    setDuration(0);
    setStartTime(Date.now());
    setShowReport(false);

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed: rawSpeed } = pos.coords;
        const point = [latitude, longitude];

        setRoute((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const dist = getDistance(
              { latitude: last[0], longitude: last[1] },
              { latitude, longitude }
            );
            if (dist < 2) return prev;
            setDistance((d) => d + dist);
            const angle = getRhumbLineBearing(
              { latitude: last[0], longitude: last[1] },
              { latitude, longitude }
            );
            setHeading(angle);
          }
          return [...prev, point];
        });

        const sp = rawSpeed ? Number((rawSpeed * 3.6).toFixed(1)) : 0;
        setSpeed(sp);
        setMaxSpeed((m) => Math.max(m, sp));
        setSpeedData((prev) => {
          const updated = [...prev, { t: prev.length + 1, speed: sp }];
          const avg = updated.reduce((a, b) => a + b.speed, 0) / updated.length;
          setAvgSpeed(Number(avg.toFixed(1)));
          return updated;
        });
      },
      () => alert("Please enable GPS / location access."),
      { enableHighAccuracy: true }
    );

    setWatchId(id);
  };

  /* ─── STOP ─── */
  const endDriving = () => {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    setIsDriving(false);
    setShowReport(true);
  };

  /* ─── ADD EVENT ─── */
  const addEvent = (type) => {
    if (!route.length) return;
    const last = route[route.length - 1];
    setEvents((prev) => [...prev, { lat: last[0], lng: last[1], type }]);
  };

  /* ─── ROUTE CANVAS FOR PDF ─── */
  const generateRouteImage = () => {
    if (route.length < 2) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const lats = route.map((p) => p[0]);
    const lngs = route.map((p) => p[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const pad = 40;
    const scaleX = (canvas.width - pad * 2) / (maxLng - minLng || 0.001);
    const scaleY = (canvas.height - pad * 2) / (maxLat - minLat || 0.001);

    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    route.forEach((p, i) => {
      const x = pad + (p[1] - minLng) * scaleX;
      const y = canvas.height - pad - (p[0] - minLat) * scaleY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    events.forEach((e) => {
      const x = pad + (e.lng - minLng) * scaleX;
      const y = canvas.height - pad - (e.lat - minLat) * scaleY;
      ctx.shadowColor = e.type === "pothole" ? "#ef4444" : e.type === "breaker" ? "#f59e0b" : "#22c55e";
      ctx.shadowBlur = 10;
      ctx.fillStyle = ctx.shadowColor;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();
    });

    return canvas.toDataURL("image/png");
  };

  /* ─── PDF ─── */
  const downloadPDF = () => {
    const pdf = new jsPDF();
    const W = pdf.internal.pageSize.getWidth();

    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, W, 297, "F");

    pdf.setFillColor(14, 116, 144);
    pdf.rect(0, 0, W, 32, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text("RoadSense AI — Trip Report", 10, 20);

    pdf.setFontSize(9);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 10, 28);

    const img = generateRouteImage();
    if (img) pdf.addImage(img, "PNG", 10, 38, W - 20, 70);

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(56, 189, 248);
    pdf.text("Trip Statistics", 10, 120);

    const stats = [
      ["Distance", `${(distance / 1000).toFixed(2)} km`],
      ["Duration", fmtTime(duration)],
      ["Max Speed", `${maxSpeed} km/h`],
      ["Avg Speed", `${avgSpeed} km/h`],
      ["Potholes", countEvents("pothole")],
      ["Speed Breakers", countEvents("breaker")],
      ["Street Lights", countEvents("light")],
      ["Total Events", events.length],
    ];

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    stats.forEach(([k, v], i) => {
      const col = i % 2 === 0 ? 10 : 110;
      const row = 128 + Math.floor(i / 2) * 10;
      pdf.setTextColor(148, 163, 184);
      pdf.text(k + ":", col, row);
      pdf.setTextColor(255, 255, 255);
      pdf.text(String(v), col + 45, row);
    });

    pdf.setFontSize(8);
    pdf.setTextColor(51, 65, 85);
    pdf.text("RoadSense AI — Smart Drive Analytics", 10, 290);

    pdf.save("RoadSense_Report.pdf");
  };

  const eventColor = { pothole: "#ef4444", breaker: "#f59e0b", light: "#22c55e" };

  return (
    <div style={styles.root}>
      {/* ── HEADER ── */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🚗</span>
          <span style={styles.logoText}>RoadSense <span style={styles.logoAI}>AI</span></span>
        </div>
        {isDriving && (
          <div style={styles.liveChip}>
            <span style={styles.liveDot} />
            LIVE
          </div>
        )}
        {isDriving && (
          <div style={styles.timerPill}>{fmtTime(duration)}</div>
        )}
      </header>

      {/* ── MAP ── */}
      <div style={styles.mapWrap}>
        <MapContainer center={[26.85, 80.95]} zoom={13} style={{ width: "100%", height: "100%" }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          <FollowUser route={route} />
          <Polyline positions={route} color="#38bdf8" weight={4} opacity={0.9} />
          {events.map((e, i) => (
            <CircleMarker
              key={i}
              center={[e.lat, e.lng]}
              radius={7}
              color={eventColor[e.type]}
              fillColor={eventColor[e.type]}
              fillOpacity={0.8}
              weight={2}
            />
          ))}
          {route.length > 0 && (
            <Marker position={route.at(-1)} icon={carIcon(heading)} />
          )}
        </MapContainer>

        {/* map legend */}
        <div style={styles.legend}>
          {[["🔴", "Pothole"], ["🟡", "Breaker"], ["🟢", "Light"]].map(([dot, lbl]) => (
            <div key={lbl} style={styles.legendItem}><span>{dot}</span><span style={styles.legendTxt}>{lbl}</span></div>
          ))}
        </div>
      </div>

      {/* ── BOTTOM PANEL ── */}
      <div style={styles.panel}>
        {/* Live stats row */}
        <div style={styles.statsRow}>
          <SpeedGauge speed={speed} />
          <div style={styles.miniStats}>
            <StatCard icon="📍" label="Distance" value={`${(distance / 1000).toFixed(2)} km`} accent="#38bdf8" />
            <StatCard icon="⚡" label="Max Speed" value={`${maxSpeed} km/h`} accent="#f59e0b" />
            <StatCard icon="📊" label="Avg Speed" value={`${avgSpeed} km/h`} accent="#a78bfa" />
            <StatCard icon="🚨" label="Events" value={events.length} accent="#ef4444" />
          </div>
        </div>

        {/* Controls */}
        <div style={styles.controls}>
          {!isDriving ? (
            <button style={styles.startBtn} onClick={startDriving}>
              <span style={{ fontSize: 22 }}>🚗</span> Start Drive
            </button>
          ) : (
            <>
              <EventBtn emoji="🚧" label="Pothole" color="#ef4444" count={countEvents("pothole")} onClick={() => addEvent("pothole")} />
              <EventBtn emoji="⚠️" label="Breaker" color="#f59e0b" count={countEvents("breaker")} onClick={() => addEvent("breaker")} />
              <EventBtn emoji="💡" label="Light" color="#22c55e" count={countEvents("light")} onClick={() => addEvent("light")} />
              <button style={styles.stopBtn} onClick={endDriving}>
                <span style={{ fontSize: 18 }}>🛑</span> End
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── REPORT MODAL ── */}
      {showReport && (
        <div style={styles.overlay} onClick={() => setShowReport(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Trip Summary</h2>
              <button style={styles.closeBtn} onClick={() => setShowReport(false)}>✕</button>
            </div>

            {/* stats grid */}
            <div style={styles.reportGrid}>
              {[
                ["📍", "Distance", `${(distance / 1000).toFixed(2)} km`, "#38bdf8"],
                ["⏱", "Duration", fmtTime(duration), "#a78bfa"],
                ["⚡", "Max Speed", `${maxSpeed} km/h`, "#f59e0b"],
                ["📊", "Avg Speed", `${avgSpeed} km/h`, "#22c55e"],
                ["🚧", "Potholes", countEvents("pothole"), "#ef4444"],
                ["⚠️", "Breakers", countEvents("breaker"), "#f59e0b"],
                ["💡", "Lights", countEvents("light"), "#22c55e"],
                ["🚨", "Total Events", events.length, "#f472b6"],
              ].map(([icon, label, val, accent]) => (
                <div key={label} style={{ ...styles.reportCard, borderTop: `3px solid ${accent}` }}>
                  <div style={styles.reportIcon}>{icon}</div>
                  <div style={{ ...styles.reportVal, color: accent }}>{val}</div>
                  <div style={styles.reportLabel}>{label}</div>
                </div>
              ))}
            </div>

            {/* speed chart */}
            <div style={styles.chartWrap}>
              <div style={styles.chartTitle}>Speed Profile</div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={speedData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="speed" stroke="#38bdf8" fill="url(#speedGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <button style={styles.pdfBtn} onClick={downloadPDF}>
              📄 Export PDF Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ STYLES ═══ */
const styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
    background: "#0f172a",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    color: "#f1f5f9",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 16px",
    background: "#0f172a",
    borderBottom: "1px solid #1e293b",
    zIndex: 10,
  },
  logo: { display: "flex", alignItems: "center", gap: 8, flex: 1 },
  logoIcon: { fontSize: 22 },
  logoText: { fontSize: 18, fontWeight: 700, letterSpacing: "-0.5px" },
  logoAI: { color: "#38bdf8" },
  liveChip: {
    display: "flex", alignItems: "center", gap: 5,
    background: "#ef444420", color: "#ef4444",
    borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700,
  },
  liveDot: {
    width: 7, height: 7, borderRadius: "50%", background: "#ef4444",
    animation: "pulse 1.2s infinite",
  },
  timerPill: {
    background: "#1e293b", borderRadius: 20, padding: "4px 12px",
    fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums",
    color: "#94a3b8", letterSpacing: "0.5px",
  },
  mapWrap: { flex: 1, position: "relative", overflow: "hidden" },
  legend: {
    position: "absolute", bottom: 12, left: 12, zIndex: 999,
    background: "#0f172aCC", backdropFilter: "blur(8px)",
    borderRadius: 10, padding: "8px 12px",
    display: "flex", flexDirection: "column", gap: 4,
    border: "1px solid #1e293b",
  },
  legendItem: { display: "flex", alignItems: "center", gap: 6 },
  legendTxt: { fontSize: 11, color: "#94a3b8" },
  panel: {
    background: "#0f172a",
    borderTop: "1px solid #1e293b",
    padding: "12px 16px",
    display: "flex", flexDirection: "column", gap: 12,
  },
  statsRow: {
    display: "flex", gap: 12, alignItems: "center",
  },
  gaugeWrap: {
    display: "flex", flexDirection: "column", alignItems: "center",
    minWidth: 110,
  },
  speedNum: {
    fontSize: 28, fontWeight: 800, lineHeight: 1,
    marginTop: -8, fontVariantNumeric: "tabular-nums",
  },
  speedUnit: { fontSize: 11, color: "#64748b", marginTop: 2 },
  miniStats: {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    gap: 8, flex: 1,
  },
  statCard: {
    background: "#1e293b", borderRadius: 10, padding: "8px 10px",
    border: "1px solid",
    display: "flex", flexDirection: "column", gap: 2,
  },
  statIcon: { fontSize: 14 },
  statVal: { fontSize: 15, fontWeight: 700, lineHeight: 1.2 },
  statLabel: { fontSize: 10, color: "#64748b" },
  controls: {
    display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2,
  },
  startBtn: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
    gap: 8, background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
    color: "#fff", border: "none", borderRadius: 12, padding: "12px 20px",
    fontSize: 15, fontWeight: 700, cursor: "pointer",
  },
  stopBtn: {
    display: "flex", alignItems: "center", gap: 6,
    background: "#ef44441a", color: "#ef4444",
    border: "1px solid #ef4444", borderRadius: 12, padding: "10px 16px",
    fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
  },
  evtBtn: {
    position: "relative", display: "flex", flexDirection: "column",
    alignItems: "center", gap: 2,
    background: "#1e293b", border: "1px solid",
    borderRadius: 12, padding: "8px 14px",
    fontSize: 12, color: "#e2e8f0", fontWeight: 600, cursor: "pointer",
    whiteSpace: "nowrap",
  },
  evtEmoji: { fontSize: 20 },
  evtLabel: { fontSize: 10, color: "#94a3b8" },
  evtBadge: {
    position: "absolute", top: -6, right: -6,
    borderRadius: "50%", width: 18, height: 18,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 10, fontWeight: 700, color: "#fff",
  },
  overlay: {
    position: "fixed", inset: 0, zIndex: 1000,
    background: "#00000090", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "flex-end",
  },
  modal: {
    width: "100%", maxHeight: "90dvh", overflowY: "auto",
    background: "#0f172a", borderRadius: "20px 20px 0 0",
    border: "1px solid #1e293b", padding: "20px 16px 32px",
    display: "flex", flexDirection: "column", gap: 16,
  },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 20, fontWeight: 700, margin: 0 },
  closeBtn: {
    background: "#1e293b", border: "none", color: "#94a3b8",
    borderRadius: "50%", width: 30, height: 30,
    fontSize: 14, cursor: "pointer",
  },
  reportGrid: {
    display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
  },
  reportCard: {
    background: "#1e293b", borderRadius: 10, padding: "10px 8px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
  },
  reportIcon: { fontSize: 18 },
  reportVal: { fontSize: 15, fontWeight: 800 },
  reportLabel: { fontSize: 9, color: "#64748b", textAlign: "center" },
  chartWrap: { display: "flex", flexDirection: "column", gap: 6 },
  chartTitle: { fontSize: 12, fontWeight: 600, color: "#64748b" },
  chartTip: {
    background: "#1e293b", borderRadius: 8, padding: "6px 10px",
    border: "1px solid #334155",
  },
  pdfBtn: {
    width: "100%", background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
    color: "#fff", border: "none", borderRadius: 12, padding: "13px",
    fontSize: 15, fontWeight: 700, cursor: "pointer",
  },
};

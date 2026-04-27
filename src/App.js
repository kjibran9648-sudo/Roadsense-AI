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
  ReferenceLine,
} from "recharts";
import jsPDF from "jspdf";

/* ═══════════════════════════════════════════
   GLOBAL STYLES
═══════════════════════════════════════════ */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; overflow: hidden; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #0a0f1e; }
  ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 4px; }
  @keyframes pulse-red {
    0%,100% { opacity:1; box-shadow: 0 0 0 0 #ef444440; }
    50%      { opacity:.7; box-shadow: 0 0 0 6px #ef444400; }
  }
  @keyframes fadeUp {
    from { opacity:0; transform:translateY(24px); }
    to   { opacity:1; transform:translateY(0); }
  }
  .fadeup   { animation: fadeUp 0.45s cubic-bezier(.22,1,.36,1) both; }
  .fadeup-1 { animation: fadeUp 0.45s 0.06s cubic-bezier(.22,1,.36,1) both; }
  .fadeup-2 { animation: fadeUp 0.45s 0.12s cubic-bezier(.22,1,.36,1) both; }
  .fadeup-3 { animation: fadeUp 0.45s 0.18s cubic-bezier(.22,1,.36,1) both; }
  .fadeup-4 { animation: fadeUp 0.45s 0.24s cubic-bezier(.22,1,.36,1) both; }
`;

function InjectStyles() {
  useEffect(() => {
    const tag = document.createElement("style");
    tag.textContent = GLOBAL_CSS;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);
  return null;
}

/* ═══════════════════════════════════════════
   MAP HELPERS
═══════════════════════════════════════════ */
function FollowUser({ route }) {
  const map = useMap();
  useEffect(() => {
    if (route.length > 0) map.flyTo(route[route.length - 1], 17, { duration: 1 });
  }, [route]);
  return null;
}

function FitRoute({ route }) {
  const map = useMap();
  useEffect(() => {
    if (route.length > 1) {
      map.fitBounds(L.latLngBounds(route), { padding: [40, 40] });
    }
  }, []);
  return null;
}

const carIcon = (angle) =>
  L.divIcon({
    className: "",
    html: `<div style="transform:rotate(${angle}deg);font-size:26px;filter:drop-shadow(0 0 8px #38bdf8);">🚗</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

const startPinIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:20px;filter:drop-shadow(0 0 6px #22c55e);">🟢</div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
});

const endPinIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:20px;filter:drop-shadow(0 0 6px #ef4444);">🔴</div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
});

/* ═══════════════════════════════════════════
   SPEED GAUGE
═══════════════════════════════════════════ */
function SpeedGauge({ speed }) {
  const MAX = 120;
  const pct = Math.min(speed / MAX, 1);
  const totalArc = 251.2;
  const dash = pct * totalArc;
  const color = speed < 40 ? "#22c55e" : speed < 80 ? "#f59e0b" : "#ef4444";
  const needleAngle = -135 + pct * 270;
  const rad = (a) => (a * Math.PI) / 180;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, minWidth: 105 }}>
      <svg width="105" height="68" viewBox="0 0 120 80">
        <path d="M12,74 A50,50 0 1,1 108,74" fill="none" stroke="#0a1628" strokeWidth="10" strokeLinecap="round" />
        <path d="M12,74 A50,50 0 1,1 108,74" fill="none" stroke={color + "28"} strokeWidth="14" strokeLinecap="round" />
        <path
          d="M12,74 A50,50 0 1,1 108,74" fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${totalArc}`}
          style={{ transition: "stroke-dasharray 0.35s ease, stroke 0.35s ease" }}
        />
        <line
          x1="60" y1="74"
          x2={60 + 33 * Math.cos(rad(needleAngle - 90))}
          y2={74 + 33 * Math.sin(rad(needleAngle - 90))}
          stroke={color} strokeWidth="2.5" strokeLinecap="round"
          style={{ transition: "all 0.35s ease" }}
        />
        <circle cx="60" cy="74" r="5" fill={color} />
        <circle cx="60" cy="74" r="2.5" fill="#060d1a" />
      </svg>
      <div style={{
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 26, fontWeight: 600, color, lineHeight: 1, marginTop: -4,
        transition: "color 0.35s ease",
      }}>{speed}</div>
      <div style={{ fontSize: 9, color: "#3a5070", letterSpacing: 2, textTransform: "uppercase", marginTop: 2 }}>km/h</div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CHIP
═══════════════════════════════════════════ */
function Chip({ icon, label, value, accent = "#38bdf8" }) {
  return (
    <div style={{
      background: "#060d1a", border: `1px solid ${accent}1a`,
      borderRadius: 11, padding: "7px 10px",
      display: "flex", flexDirection: "column", gap: 2, flex: 1,
    }}>
      <div style={{ fontSize: 10, color: "#3a5070", display: "flex", alignItems: "center", gap: 4 }}>
        <span>{icon}</span><span style={{ letterSpacing: 0.3 }}>{label}</span>
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 14, fontWeight: 600, color: accent,
      }}>{value}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   EVENT BUTTON
═══════════════════════════════════════════ */
function EvtBtn({ emoji, label, color, count, onClick }) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <button
      onClick={() => { setPressed(true); setTimeout(() => setPressed(false), 200); onClick(); }}
      style={{
        position: "relative",
        background: pressed ? `${color}30` : `${color}10`,
        border: `1px solid ${color}${pressed ? "80" : "35"}`,
        borderRadius: 13, padding: "9px 12px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        color: "#e2e8f0", cursor: "pointer",
        transition: "all 0.15s",
        flex: 1,
        transform: pressed ? "scale(0.93)" : "scale(1)",
      }}
    >
      <span style={{ fontSize: 21 }}>{emoji}</span>
      <span style={{ fontSize: 9, color: "#607080", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</span>
      {count > 0 && (
        <span style={{
          position: "absolute", top: -7, right: -7,
          background: color, color: "#fff",
          borderRadius: "50%", width: 19, height: 19,
          fontSize: 10, fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 10px ${color}80`,
        }}>{count}</span>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════
   SECTION LABEL
═══════════════════════════════════════════ */
function SLabel({ children }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, letterSpacing: 2.5,
      textTransform: "uppercase", color: "#2a4060", marginBottom: 10,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span>{children}</span>
      <span style={{ flex: 1, height: 1, background: "#0d2a45" }} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   BIG STAT CARD
═══════════════════════════════════════════ */
function BigStat({ icon, label, value, unit, accent }) {
  return (
    <div style={{
      background: "#080f1c", border: `1px solid ${accent}15`,
      borderRadius: 14, padding: "14px",
    }}>
      <div style={{ fontSize: 10, color: "#2a4060", display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
        <span>{icon}</span><span style={{ letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 22, fontWeight: 600, color: accent,
        }}>{value}</span>
        {unit && <span style={{ fontSize: 10, color: "#2a4060" }}>{unit}</span>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   EVENT STAT CARD
═══════════════════════════════════════════ */
function EventStatCard({ emoji, label, count, color }) {
  return (
    <div style={{
      background: "#080f1c", border: `1px solid ${color}18`,
      borderRadius: 14, padding: "14px 8px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
    }}>
      <div style={{ fontSize: 22 }}>{emoji}</div>
      <div style={{
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 30, fontWeight: 700, color, lineHeight: 1,
      }}>{count}</div>
      <div style={{ fontSize: 9, color: "#2a4060", letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   ROUTE MAP IN REPORT
═══════════════════════════════════════════ */
function ReportRouteMap({ route, events }) {
  if (route.length < 2) return (
    <div style={{
      height: 180, borderRadius: 16, background: "#080f1c",
      border: "1px solid #0d2a45", display: "flex",
      alignItems: "center", justifyContent: "center",
      color: "#2a4060", fontSize: 13,
    }}>No route data</div>
  );

  const center = route[Math.floor(route.length / 2)];
  const EC = { pothole: "#ef4444", breaker: "#f59e0b", light: "#22c55e" };

  return (
    <div style={{
      height: 220, borderRadius: 16, overflow: "hidden",
      border: "1px solid #0d2a45",
      boxShadow: "inset 0 0 40px #000a",
    }}>
      <MapContainer
        center={center} zoom={14}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false} dragging={false}
        scrollWheelZoom={false} doubleClickZoom={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <FitRoute route={route} />
        <Polyline positions={route} color="#38bdf8" weight={4} opacity={0.9} />
        <Marker position={route[0]} icon={startPinIcon} />
        <Marker position={route[route.length - 1]} icon={endPinIcon} />
        {events.map((e, i) => (
          <CircleMarker key={i} center={[e.lat, e.lng]} radius={7}
            color={EC[e.type]} fillColor={EC[e.type]} fillOpacity={0.9} weight={2} />
        ))}
      </MapContainer>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CHART TOOLTIP
═══════════════════════════════════════════ */
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#060d1a", border: "1px solid #0d2a45",
      borderRadius: 10, padding: "7px 11px",
      fontFamily: "'JetBrains Mono',monospace",
    }}>
      <div style={{ color: "#2a4060", fontSize: 9 }}>t={label}</div>
      <div style={{ color: "#38bdf8", fontSize: 14, fontWeight: 600 }}>{payload[0].value} km/h</div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PDF GENERATOR
═══════════════════════════════════════════ */
function generatePDF({ route, events, distance, duration, maxSpeed, avgSpeed, speedData }) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297;
  const fmtTime = (s) =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const count = (t) => events.filter((e) => e.type === t).length;
  const score = Math.max(0, 100 - count("pothole") * 10 - count("breaker") * 5);
  const sCol = score >= 80 ? [34, 197, 94] : score >= 50 ? [245, 158, 11] : [239, 68, 68];
  const sLabel = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Poor";

  // BG
  pdf.setFillColor(6, 13, 26); pdf.rect(0, 0, W, H, "F");

  // Header band
  pdf.setFillColor(8, 28, 58); pdf.rect(0, 0, W, 36, "F");
  pdf.setDrawColor(14, 116, 144); pdf.setLineWidth(0.5); pdf.line(0, 36, W, 36);

  // Logo
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(20);
  pdf.setTextColor(56, 189, 248); pdf.text("RoadSense AI", 12, 16);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
  pdf.setTextColor(42, 64, 96); pdf.text("Smart Drive Analytics Report", 12, 24);
  pdf.setFontSize(7.5); pdf.setTextColor(58, 80, 112);
  pdf.text(new Date().toLocaleString("en-IN"), 12, 32);

  // Score
  pdf.setFillColor(...sCol); pdf.roundedRect(W - 52, 6, 40, 22, 4, 4, "F");
  pdf.setFillColor(0, 0, 0, 30); pdf.roundedRect(W - 52, 6, 40, 22, 4, 4, "F");
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(20);
  pdf.setTextColor(255, 255, 255); pdf.text(`${score}`, W - 32, 20, { align: "center" });
  pdf.setFontSize(6); pdf.text(sLabel.toUpperCase(), W - 32, 26, { align: "center" });

  // Route section title
  let y = 44;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(9.5);
  pdf.setTextColor(56, 189, 248); pdf.text("ROUTE COVERED", 12, y);
  pdf.setDrawColor(14, 60, 96); pdf.setLineWidth(0.3); pdf.line(12, y + 2, W - 12, y + 2);

  // Route canvas
  if (route.length > 1) {
    const canvas = document.createElement("canvas");
    canvas.width = 1000; canvas.height = 340;
    const ctx = canvas.getContext("2d");

    // BG
    ctx.fillStyle = "#080f1c"; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = "#0d2a4535"; ctx.lineWidth = 1;
    for (let gx = 0; gx < canvas.width; gx += 70) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height); ctx.stroke(); }
    for (let gy = 0; gy < canvas.height; gy += 70) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy); ctx.stroke(); }

    const pad = 55;
    const lats = route.map(p => p[0]), lngs = route.map(p => p[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const sX = (canvas.width - pad * 2) / (maxLng - minLng || 0.001);
    const sY = (canvas.height - pad * 2) / (maxLat - minLat || 0.001);
    const toXY = (lat, lng) => [pad + (lng - minLng) * sX, canvas.height - pad - (lat - minLat) * sY];

    // Route glow
    ctx.shadowColor = "#38bdf870"; ctx.shadowBlur = 20;
    ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    route.forEach((p, i) => { const [x, y] = toXY(p[0], p[1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();

    // Start
    const [sx, sy] = toXY(route[0][0], route[0][1]);
    ctx.shadowColor = "#22c55e"; ctx.shadowBlur = 14;
    ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.arc(sx, sy, 12, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("S", sx, sy);

    // End
    const [ex, ey] = toXY(route[route.length - 1][0], route[route.length - 1][1]);
    ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 14;
    ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(ex, ey, 12, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText("E", ex, ey);

    // Events
    const EC = { pothole: "#ef4444", breaker: "#f59e0b", light: "#22c55e" };
    events.forEach(e => {
      const [x, y] = toXY(e.lat, e.lng);
      ctx.shadowColor = EC[e.type]; ctx.shadowBlur = 10;
      ctx.fillStyle = EC[e.type]; ctx.beginPath(); ctx.arc(x, y, 8, 0, 2 * Math.PI); ctx.fill();
    });

    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 10, y + 6, W - 20, 62);

    // Legend
    pdf.setFontSize(7); pdf.setFont("helvetica", "normal");
    const leg = [[[34,197,94], "Start (S)"], [[239,68,68], "End (E)"], [[239,68,68], "Pothole"], [[245,158,11], "Breaker"], [[34,197,94], "Light"]];
    let lx = 12;
    leg.forEach(([col, lbl]) => {
      pdf.setFillColor(...col); pdf.circle(lx + 2, y + 72, 2, "F");
      pdf.setTextColor(74, 96, 128); pdf.text(lbl, lx + 6, y + 73.5);
      lx += 34;
    });
  }

  // Stats
  y += 84;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(9.5);
  pdf.setTextColor(56, 189, 248); pdf.text("TRIP STATISTICS", 12, y);
  pdf.setDrawColor(14, 60, 96); pdf.setLineWidth(0.3); pdf.line(12, y + 2, W - 12, y + 2);

  const stats = [
    ["📍 Distance", `${(distance / 1000).toFixed(2)} km`, "⏱ Duration", fmtTime(duration)],
    ["⚡ Max Speed", `${maxSpeed} km/h`, "📊 Avg Speed", `${avgSpeed} km/h`],
    ["🚧 Potholes", count("pothole"), "⚠️ Breakers", count("breaker")],
    ["💡 Street Lights", count("light"), "🏁 Total Events", events.length],
  ];

  stats.forEach(([k1, v1, k2, v2], i) => {
    const ry = y + 10 + i * 13;
    pdf.setFillColor(i % 2 === 0 ? 8 : 10, i % 2 === 0 ? 14 : 16, i % 2 === 0 ? 28 : 32);
    pdf.roundedRect(10, ry - 4.5, 92, 10, 2, 2, "F");
    pdf.roundedRect(108, ry - 4.5, 92, 10, 2, 2, "F");
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5);
    pdf.setTextColor(58, 80, 112); pdf.text(String(k1), 14, ry);
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(56, 189, 248); pdf.text(String(v1), 98, ry, { align: "right" });
    pdf.setFont("helvetica", "normal"); pdf.setTextColor(58, 80, 112); pdf.text(String(k2), 112, ry);
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(56, 189, 248); pdf.text(String(v2), 196, ry, { align: "right" });
  });

  // Score card
  y += 68;
  pdf.setFillColor(8, 20, 42); pdf.roundedRect(10, y, 56, 28, 4, 4, "F");
  pdf.setDrawColor(...sCol); pdf.setLineWidth(0.6); pdf.roundedRect(10, y, 56, 28, 4, 4, "S");
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(42, 64, 96);
  pdf.text("ROAD QUALITY SCORE", 38, y + 7, { align: "center" });
  pdf.setFontSize(22); pdf.setTextColor(...sCol); pdf.text(`${score}`, 28, y + 22, { align: "center" });
  pdf.setFontSize(7); pdf.setTextColor(...sCol); pdf.text(sLabel, 47, y + 22);

  // Speed chart
  y += 36;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(9.5);
  pdf.setTextColor(56, 189, 248); pdf.text("SPEED PROFILE", 12, y);
  pdf.setDrawColor(14, 60, 96); pdf.setLineWidth(0.3); pdf.line(12, y + 2, W - 12, y + 2);

  if (speedData.length > 1) {
    const sc = document.createElement("canvas");
    sc.width = 900; sc.height = 240;
    const ctx = sc.getContext("2d");
    ctx.fillStyle = "#080f1c"; ctx.fillRect(0, 0, sc.width, sc.height);
    ctx.strokeStyle = "#0d2a4540"; ctx.lineWidth = 1;
    for (let gy = 0; gy < sc.height; gy += 48) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(sc.width, gy); ctx.stroke(); }

    const sp = speedData.map(d => d.speed);
    const mxSp = Math.max(...sp) || 1;
    const pd = 24;
    const cW = sc.width - pd * 2, cH = sc.height - pd * 2;
    const toP = (v, i) => [pd + (i / (sp.length - 1)) * cW, pd + (1 - v / mxSp) * cH];

    const grad = ctx.createLinearGradient(0, pd, 0, sc.height - pd);
    grad.addColorStop(0, "#38bdf835"); grad.addColorStop(1, "#38bdf800");
    ctx.fillStyle = grad; ctx.beginPath();
    sp.forEach((v, i) => { const [x, y] = toP(v, i); if (i === 0) { ctx.moveTo(x, sc.height - pd); ctx.lineTo(x, y); } else ctx.lineTo(x, y); });
    ctx.lineTo(...toP(sp[sp.length - 1], sp.length - 1)); ctx.lineTo(pd + cW, sc.height - pd); ctx.closePath(); ctx.fill();

    ctx.shadowColor = "#38bdf8"; ctx.shadowBlur = 8;
    ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    sp.forEach((v, i) => { const [x, y] = toP(v, i); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();

    if (avgSpeed) {
      const avgY = pd + (1 - avgSpeed / mxSp) * cH;
      ctx.shadowBlur = 0; ctx.strokeStyle = "#818cf880"; ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(pd, avgY); ctx.lineTo(pd + cW, avgY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#818cf880"; ctx.font = "20px monospace"; ctx.textAlign = "left";
      ctx.fillText(`avg ${avgSpeed}`, pd + 6, avgY - 8);
    }

    pdf.addImage(sc.toDataURL("image/png"), "PNG", 10, y + 6, W - 20, 46);
  }

  // Footer
  pdf.setFillColor(6, 10, 20); pdf.rect(0, H - 12, W, 12, "F");
  pdf.setDrawColor(10, 30, 55); pdf.line(0, H - 12, W, H - 12);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5);
  pdf.setTextColor(30, 50, 75); pdf.text("© RoadSense AI · Smart Drive Analytics", 12, H - 4.5);
  pdf.text("Confidential Report", W - 12, H - 4.5, { align: "right" });

  pdf.save("RoadSense_Report.pdf");
}

/* ═══════════════════════════════════════════
   REPORT MODAL
═══════════════════════════════════════════ */
function ReportModal({ data, onClose, onPDF }) {
  const { route, events, distance, duration, maxSpeed, avgSpeed, speedData } = data;
  const fmtTime = (s) =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const count = (t) => events.filter((e) => e.type === t).length;
  const score = Math.max(0, 100 - count("pothole") * 10 - count("breaker") * 5);
  const scoreColor = score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Poor";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(2,6,18,0.92)",
        backdropFilter: "blur(12px)",
        display: "flex", alignItems: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        className="fadeup"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxHeight: "94dvh", overflowY: "auto",
          background: "#060d1a",
          borderRadius: "22px 22px 0 0",
          border: "1px solid #0d2a45",
          borderBottom: "none",
          paddingBottom: 40,
        }}
      >
        {/* ── Sticky header ── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "#060d1a",
          borderBottom: "1px solid #0d2a45",
          padding: "18px 18px 14px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{
                fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22,
                background: "linear-gradient(90deg,#38bdf8 0%,#818cf8 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                letterSpacing: "-0.5px",
              }}>Trip Report</div>
              <div style={{ fontSize: 10, color: "#2a4060", marginTop: 3 }}>
                {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "#0a1628", border: "1px solid #1e3a5f",
                borderRadius: "50%", width: 34, height: 34,
                color: "#3a5070", fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >✕</button>
          </div>

          {/* Score banner */}
          <div style={{
            background: "#080f1c",
            border: `1px solid ${scoreColor}25`,
            borderRadius: 14, padding: "12px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 9, color: "#2a4060", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 5 }}>
                Road Quality Score
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 38, fontWeight: 700, color: scoreColor, lineHeight: 1,
              }}>
                {score}<span style={{ fontSize: 16, color: "#2a4060" }}>/100</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <div style={{
                background: `${scoreColor}18`, color: scoreColor,
                borderRadius: 20, padding: "5px 14px",
                fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
              }}>{scoreLabel}</div>
              <div style={{ fontSize: 9, color: "#2a4060" }}>{events.length} events recorded</div>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 22, marginTop: 20 }}>

          {/* Overview stats */}
          <div className="fadeup-1">
            <SLabel>Overview</SLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <BigStat icon="📍" label="Total Distance" value={`${(distance / 1000).toFixed(2)}`} unit="km" accent="#38bdf8" />
              <BigStat icon="⏱" label="Duration" value={fmtTime(duration)} unit="" accent="#818cf8" />
              <BigStat icon="⚡" label="Max Speed" value={`${maxSpeed}`} unit="km/h" accent="#f59e0b" />
              <BigStat icon="📊" label="Avg Speed" value={`${avgSpeed}`} unit="km/h" accent="#22c55e" />
            </div>
          </div>

          {/* Route map */}
          <div className="fadeup-2">
            <SLabel>Route Covered</SLabel>
            <ReportRouteMap route={route} events={events} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, justifyContent: "center" }}>
              {[["#22c55e", "Start"], ["#ef4444", "End"], ["#ef4444", "Pothole"], ["#f59e0b", "Breaker"], ["#22c55e", "Light"]].map(([col, lbl]) => (
                <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{
                    width: 9, height: 9, borderRadius: "50%", background: col,
                    display: "inline-block", boxShadow: `0 0 5px ${col}`,
                  }} />
                  <span style={{ fontSize: 10, color: "#3a5070" }}>{lbl}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Events */}
          <div className="fadeup-2">
            <SLabel>Road Events</SLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <EventStatCard emoji="🚧" label="Potholes" count={count("pothole")} color="#ef4444" />
              <EventStatCard emoji="⚠️" label="Breakers" count={count("breaker")} color="#f59e0b" />
              <EventStatCard emoji="💡" label="Lights" count={count("light")} color="#22c55e" />
            </div>
          </div>

          {/* Speed chart */}
          <div className="fadeup-3">
            <SLabel>Speed Profile</SLabel>
            <div style={{
              background: "#080f1c", borderRadius: 16,
              border: "1px solid #0d2a45", padding: "16px 6px 8px",
            }}>
              <ResponsiveContainer width="100%" height={155}>
                <AreaChart data={speedData} margin={{ top: 0, right: 8, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0d2a45" />
                  <XAxis dataKey="t" tick={{ fill: "#2a4060", fontSize: 9 }} />
                  <YAxis tick={{ fill: "#2a4060", fontSize: 9 }} />
                  <Tooltip content={<ChartTip />} />
                  {avgSpeed > 0 && (
                    <ReferenceLine y={avgSpeed} stroke="#818cf860" strokeDasharray="5 4" strokeWidth={1.5}
                      label={{ value: `avg`, fill: "#818cf860", fontSize: 9, position: "insideTopLeft" }} />
                  )}
                  <Area type="monotone" dataKey="speed" stroke="#38bdf8" fill="url(#spG)"
                    strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#38bdf8", stroke: "#060d1a", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Export */}
          <div className="fadeup-4">
            <button
              onClick={onPDF}
              style={{
                width: "100%",
                background: "linear-gradient(130deg, #0ea5e9 0%, #6366f1 100%)",
                border: "none", borderRadius: 16, padding: "15px",
                fontFamily: "'Syne',sans-serif",
                fontSize: 16, fontWeight: 800, color: "#fff",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 6px 28px #38bdf828, 0 2px 8px #6366f120",
                letterSpacing: 0.3,
              }}
            >
              <span style={{ fontSize: 18 }}>📄</span>
              Export PDF Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════ */
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
  const timerRef = useRef(null);

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

  const countEv = (t) => events.filter((e) => e.type === t).length;
  const EC = { pothole: "#ef4444", breaker: "#f59e0b", light: "#22c55e" };

  const startDriving = () => {
    setIsDriving(true);
    setRoute([]); setEvents([]); setDistance(0);
    setSpeedData([]); setMaxSpeed(0); setAvgSpeed(0);
    setDuration(0); setShowReport(false);

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed: raw } = pos.coords;
        const point = [latitude, longitude];

        setRoute((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const dist = getDistance({ latitude: last[0], longitude: last[1] }, { latitude, longitude });
            if (dist < 2) return prev;
            setDistance((d) => d + dist);
            setHeading(getRhumbLineBearing(
              { latitude: last[0], longitude: last[1] },
              { latitude, longitude }
            ));
          }
          return [...prev, point];
        });

        const sp = raw ? Number((raw * 3.6).toFixed(1)) : 0;
        setSpeed(sp);
        setMaxSpeed((m) => Math.max(m, sp));
        setSpeedData((prev) => {
          const updated = [...prev, { t: prev.length + 1, speed: sp }];
          setAvgSpeed(Number((updated.reduce((a, b) => a + b.speed, 0) / updated.length).toFixed(1)));
          return updated;
        });
      },
      () => alert("Please enable GPS / location access."),
      { enableHighAccuracy: true }
    );
    setWatchId(id);
  };

  const endDriving = () => {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    setIsDriving(false);
    setShowReport(true);
  };

  const addEvent = (type) => {
    if (!route.length) return;
    const last = route[route.length - 1];
    setEvents((prev) => [...prev, { lat: last[0], lng: last[1], type }]);
  };

  const reportData = { route, events, distance, duration, maxSpeed, avgSpeed, speedData };

  return (
    <>
      <InjectStyles />
      <div style={{
        display: "flex", flexDirection: "column", height: "100dvh",
        background: "#060d1a",
        fontFamily: "'Syne','Segoe UI',sans-serif",
        color: "#e2e8f0", overflow: "hidden",
      }}>

        {/* ── HEADER ── */}
        <header style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px",
          background: "#060d1a",
          borderBottom: "1px solid #0a1e36",
        }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 24 }}>🚗</span>
            <div>
              <div style={{
                fontWeight: 800, fontSize: 18, letterSpacing: "-0.5px",
                background: "linear-gradient(90deg,#38bdf8,#818cf8)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>RoadSense AI</div>
              <div style={{ fontSize: 8, color: "#2a4060", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 1 }}>
                Smart Drive Analytics
              </div>
            </div>
          </div>

          {isDriving && (
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "#ef444415", color: "#ef4444",
              borderRadius: 20, padding: "4px 10px",
              fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
              border: "1px solid #ef444430",
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: "#ef4444", display: "inline-block",
                animation: "pulse-red 1.2s infinite",
              }} />
              LIVE
            </div>
          )}

          {isDriving && (
            <div style={{
              fontFamily: "'JetBrains Mono',monospace",
              background: "#080f1c", borderRadius: 9,
              padding: "4px 10px", fontSize: 13, fontWeight: 600,
              color: "#3a5070", letterSpacing: 1.2,
              border: "1px solid #0d2a45",
            }}>{fmtTime(duration)}</div>
          )}
        </header>

        {/* ── MAP ── */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <MapContainer center={[26.85, 80.95]} zoom={13} style={{ width: "100%", height: "100%" }} zoomControl={false}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <FollowUser route={route} />
            <Polyline positions={route} color="#38bdf8" weight={4} opacity={0.9} />
            {events.map((e, i) => (
              <CircleMarker key={i} center={[e.lat, e.lng]} radius={7}
                color={EC[e.type]} fillColor={EC[e.type]} fillOpacity={0.9} weight={2} />
            ))}
            {route.length > 0 && <Marker position={route.at(-1)} icon={carIcon(heading)} />}
          </MapContainer>

          {/* Map legend */}
          <div style={{
            position: "absolute", bottom: 12, left: 12, zIndex: 999,
            background: "#060d1adf", backdropFilter: "blur(12px)",
            borderRadius: 12, padding: "8px 12px",
            border: "1px solid #0d2a45",
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            {[["#ef4444", "🚧 Pothole"], ["#f59e0b", "⚠️ Breaker"], ["#22c55e", "💡 Light"]].map(([c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block", boxShadow: `0 0 6px ${c}80` }} />
                <span style={{ fontSize: 10, color: "#3a5070" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── BOTTOM PANEL ── */}
        <div style={{
          background: "#060d1a",
          borderTop: "1px solid #0a1e36",
          padding: "12px 14px 16px",
          display: "flex", flexDirection: "column", gap: 11,
        }}>
          {/* Stats row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SpeedGauge speed={speed} />
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              <Chip icon="📍" label="Distance" value={`${(distance / 1000).toFixed(2)} km`} accent="#38bdf8" />
              <Chip icon="⚡" label="Max" value={`${maxSpeed} km/h`} accent="#f59e0b" />
              <Chip icon="📊" label="Avg" value={`${avgSpeed} km/h`} accent="#818cf8" />
              <Chip icon="🚨" label="Events" value={events.length} accent="#ef4444" />
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: 8 }}>
            {!isDriving ? (
              <button
                onClick={startDriving}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  background: "linear-gradient(130deg,#0ea5e9 0%,#6366f1 100%)",
                  border: "none", borderRadius: 14, padding: "13px",
                  fontFamily: "'Syne',sans-serif",
                  fontSize: 15, fontWeight: 800, color: "#fff", cursor: "pointer",
                  boxShadow: "0 4px 24px #38bdf825",
                  letterSpacing: 0.3,
                }}
              >🚗 Start Drive</button>
            ) : (
              <>
                <EvtBtn emoji="🚧" label="Pothole" color="#ef4444" count={countEv("pothole")} onClick={() => addEvent("pothole")} />
                <EvtBtn emoji="⚠️" label="Breaker" color="#f59e0b" count={countEv("breaker")} onClick={() => addEvent("breaker")} />
                <EvtBtn emoji="💡" label="Light" color="#22c55e" count={countEv("light")} onClick={() => addEvent("light")} />
                <button
                  onClick={endDriving}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "#ef444412", border: "1px solid #ef444440",
                    borderRadius: 13, padding: "10px 13px",
                    color: "#ef4444", fontWeight: 800, fontSize: 13,
                    cursor: "pointer", whiteSpace: "nowrap",
                    fontFamily: "'Syne',sans-serif",
                  }}
                >🛑 End</button>
              </>
            )}
          </div>
        </div>

        {/* ── REPORT ── */}
        {showReport && (
          <ReportModal
            data={reportData}
            onClose={() => setShowReport(false)}
            onPDF={() => generatePDF(reportData)}
          />
        )}
      </div>
    </>
  );
}

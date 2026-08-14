import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { ChevronRight } from "lucide-react";

// Set via Vite env var, not hardcoded -- lets the default target change
// (Vercel dashboard edit + redeploy) without a source commit. Falls
// back to localhost:8080 if unset, for local dev against a server
// running on the usual port. ?target= in the URL still overrides
// this at runtime either way, same as before.
const DEFAULT_TARGET = import.meta.env.VITE_DEFAULT_TARGET || "http://localhost:8080";
const METRICS_URL = `${new URLSearchParams(window.location.search).get("target") ?? DEFAULT_TARGET}/api/metrics`;
const POLL_INTERVAL_MS = 3000;
const RPS_HISTORY_LENGTH = 30;

// ── Live data ────────────────────────────────────────────────────────
// Polls the real /api/metrics endpoint. Also derives a rolling
// requests-per-second history client-side by comparing requestCount
// between polls — the server doesn't track rps history itself, so
// this is the only honest way to get it without adding server state.
function useMetrics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [rpsHistory, setRpsHistory] = useState(() =>
    Array.from({ length: RPS_HISTORY_LENGTH }, () => ({ rps: 0 }))
  );
  const lastCountRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId;

    async function poll() {
      try {
        const res = await fetch(METRICS_URL);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        if (cancelled) return;

        setData(json);
        setError(null);

        const prevCount = lastCountRef.current;
        if (prevCount !== null) {
          const delta = Math.max(0, json.requestCount - prevCount);
          const rps = delta / (POLL_INTERVAL_MS / 1000);
          setRpsHistory((prev) => [...prev.slice(1), { rps }]);
        }
        lastCountRef.current = json.requestCount;
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  return { data, error, rpsHistory };
}

// ── UI ────────────────────────────────────────────────────────────────

const statusColor = (s) => (s >= 400 ? "#F5A623" : "#5EEAD4");

function Sparkline({ data }) {
  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data}>
        <YAxis hide domain={[0, "dataMax + 2"]} />
        <Line
          type="monotone"
          dataKey="rps"
          stroke="#5EEAD4"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function App() {
  const { data, error, rpsHistory } = useMetrics();
  const [selectedKey, setSelectedKey] = useState(null);

  const requests = useMemo(() => {
    if (!data) return [];
    return [...data.recentRequests].reverse().map((r, i) => ({ ...r, key: `${r.timestamp}-${i}` }));
  }, [data]);

  const shown = requests.find((r) => r.key === selectedKey) ?? requests[0] ?? null;
  const currentRps = rpsHistory[rpsHistory.length - 1]?.rps ?? 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B0E11",
        color: "#E5E7EB",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "20px 16px 40px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: error ? "#F5A623" : "#5EEAD4",
            boxShadow: error ? "0 0 8px #F5A623" : "0 0 8px #5EEAD4",
          }}
        />
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, letterSpacing: "0.02em" }}>
          falconeye <span style={{ color: "#6B7280" }}>· {error ? "connection lost" : "metrics"}</span>
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "ui-monospace, monospace",
            fontSize: 12,
            color: "#5EEAD4",
          }}
        >
          {currentRps.toFixed(1)} req/s
        </span>
      </div>

      {error && (
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 12,
            color: "#F5A623",
            marginBottom: 12,
          }}
        >
          Can't reach {METRICS_URL} ({error}). Showing the last known data below.
        </div>
      )}

      {/* Throughput sparkline */}
      <div
        style={{
          background: "#12161B",
          border: "1px solid #1A1F26",
          borderRadius: 10,
          padding: "12px 12px 0",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          throughput
        </div>
        <Sparkline data={rpsHistory} />
      </div>

      {/* Summary stats — real fields from /api/metrics only.
          The reference design's FileCache/pool-thread gauges are
          dropped: nothing in our JSON contract backs those numbers,
          and faking them would just be decoration wearing data's
          clothes. */}
      <div
        style={{
          background: "#12161B",
          border: "1px solid #1A1F26",
          borderRadius: 10,
          padding: 14,
          marginBottom: 12,
          display: "flex",
          gap: 20,
        }}
      >
        <Stat label="requests" value={data?.requestCount ?? "—"} />
        <Stat label="errors" value={data?.errorCount ?? "—"} accent={data?.errorCount ? "#F5A623" : undefined} />
        <Stat label="avg response" value={data ? `${data.avgResponseMs.toFixed(2)}ms` : "—"} />
      </div>

      {/* Request log */}
      <div
        style={{
          background: "#12161B",
          border: "1px solid #1A1F26",
          borderRadius: 10,
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            fontSize: 11,
            color: "#6B7280",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            borderBottom: "1px solid #1A1F26",
          }}
        >
          recent requests
        </div>

        {requests.length === 0 ? (
          <div style={{ padding: 14, fontSize: 12, color: "#6B7280" }}>
            {data ? "No requests recorded yet." : "Connecting…"}
          </div>
        ) : (
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {requests.map((r) => (
            <button
              key={r.key}
              onClick={() => setSelectedKey(r.key)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 14px",
                background: shown?.key === r.key ? "#171C22" : "transparent",
                border: "none",
                borderBottom: "1px solid #1A1F26",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 11,
                  color: statusColor(r.status),
                  width: 30,
                  flexShrink: 0,
                }}
              >
                {r.status}
              </span>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6B7280", width: 44 }}>
                {r.method}
              </span>
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 12.5,
                  color: "#E5E7EB",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.route}
              </span>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5, color: "#6B7280" }}>
                {r.totalMs.toFixed(2)}ms
              </span>
              <ChevronRight size={13} color="#3A4149" />
            </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected request breakdown — only real fields. When
          breakdown is empty (no DB call made), we say so rather than
          show a blank box. */}
      {shown && (
        <div
          style={{
            background: "#12161B",
            border: "1px solid #1A1F26",
            borderRadius: 10,
            padding: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 12,
            }}
          >
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, color: "#E5E7EB" }}>
              {shown.method} {shown.route}
            </span>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#6B7280" }}>
              {shown.totalMs.toFixed(2)}ms total
            </span>
          </div>

          {shown.breakdown.length === 0 ? (
            <div style={{ fontSize: 11.5, color: "#6B7280" }}>No DB calls recorded for this request.</div>
          ) : (
            shown.breakdown.map((m) => (
              <div key={m.name} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: "#5EEAD4" }}>{m.name}</span>
                  <span style={{ color: "#5EEAD4", fontFamily: "ui-monospace, monospace" }}>{m.ms.toFixed(2)}ms</span>
                </div>
                <div style={{ height: 4, background: "#1A1F26", borderRadius: 2, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, (m.ms / shown.totalMs) * 100)}%`,
                      height: "100%",
                      background: "#5EEAD4",
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div
        style={{
          marginTop: 16,
          fontSize: 11,
          color: "#4B5563",
          textAlign: "center",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        live from {METRICS_URL} — tap a request to see its DB timing breakdown
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "#6B7280", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 18, color: accent ?? "#E5E7EB" }}>{value}</div>
    </div>
  );
}

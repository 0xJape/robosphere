import { useMemo } from "react";
import { Chart } from "react-google-charts";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toChartRows = (readings) =>
  readings
    .filter((reading) => reading && Number.isFinite(Number(reading.ts)))
    .slice(0, 60)
    .map((reading) => ([
      new Date(Number(reading.ts)),
      toNumber(reading.co2),
      toNumber(reading.temperature),
      toNumber(reading.humidity),
      toNumber(reading.smoke),
      toNumber(reading.gas)
    ]))
    .reverse();

const getCssVar = (name, fallback) => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
};

export default function ChartPanel({ readings }) {
  const rows = useMemo(() => toChartRows(readings || []), [readings]);
  const data = useMemo(
    () => [["Time", "CO2 (ppm)", "Temperature (C)", "Humidity (%)", "Smoke (%)", "Gas (ppm)"], ...rows],
    [rows]
  );
  const showPoints = rows.length < 18;
  const textSub = getCssVar("--text-sub", "#8b949e");
  const textMain = getCssVar("--text", "#e6edf3");
  const border = getCssVar("--border", "rgba(255,255,255,0.12)");
  const panel = getCssVar("--panel", "#121821");

  if (rows.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Environmental Trends</h3>
            <p className="muted">Last 60 readings</p>
          </div>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">⏱</div>
          <div>No readings yet. Send sensor data to start the trend line.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>Environmental Trends</h3>
          <p className="muted">Last 60 readings</p>
        </div>
      </div>
      <div className="chart-wrap" style={{ height: 260, width: "100%", marginTop: "auto" }}>
        <Chart
          chartType="LineChart"
          width="100%"
          height="260px"
          data={data}
          loader={<div className="empty-state">Loading chart...</div>}
          options={{
            backgroundColor: "transparent",
            legend: {
              position: "top",
              alignment: "center",
              textStyle: { color: textSub, fontSize: 12 }
            },
            curveType: "function",
            chartArea: { left: 44, right: 52, top: 28, bottom: 24, width: "100%", height: "70%" },
            hAxis: {
              format: "HH:mm:ss",
              textStyle: { color: textSub, fontSize: 11 },
              gridlines: { color: border },
              minorGridlines: { color: "transparent" }
            },
            vAxes: {
              0: {
                textStyle: { color: textSub, fontSize: 11 },
                gridlines: { color: border },
                minorGridlines: { color: "transparent" }
              },
              1: {
                textStyle: { color: textSub, fontSize: 11 },
                gridlines: { color: "transparent" }
              }
            },
            series: {
              0: { targetAxisIndex: 1, color: "#1a9c8b", lineWidth: 2, pointSize: showPoints ? 3 : 0 },
              1: { targetAxisIndex: 0, color: "#f0a52b", lineWidth: 2, pointSize: showPoints ? 3 : 0 },
              2: { targetAxisIndex: 0, color: "#3b70d8", lineWidth: 2, pointSize: showPoints ? 3 : 0 },
              3: { targetAxisIndex: 0, color: "#e35d6a", lineWidth: 2, pointSize: showPoints ? 3 : 0 }, // Smoke
              4: { targetAxisIndex: 1, color: "#9b59b6", lineWidth: 2, pointSize: showPoints ? 3 : 0 }  // Gas
            },
            tooltip: {
              textStyle: { color: textMain, fontSize: 12 },
              showColorCode: true,
              isHtml: false
            }
          }}
        />
      </div>
    </div>
  );
}

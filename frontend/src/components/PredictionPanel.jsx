import { useMemo } from "react";
import { Chart } from "react-google-charts";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// Simple Linear Regression
const predictFuture = (dataList, accessor, futureSteps = 5, stepMs = 60000) => {
  const N = dataList.length;
  if (N < 2) return [];

  // Normalize X to start at 0 for stability, in minutes relative to start
  const startX = dataList[0].ts;
  
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  const points = [];

  for (let i = 0; i < N; i++) {
    const x = (dataList[i].ts - startX) / 60000; // time in minutes
    const y = accessor(dataList[i]);
    if (y !== null) {
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      points.push({ x, y });
    }
  }

  const nPoints = points.length;
  if (nPoints < 2) return [];

  const denominator = nPoints * sumX2 - sumX * sumX;
  // If denominator is suspiciously close to 0, avoid Infinity/NaN
  if (Math.abs(denominator) < 1e-10) return [];

  const m = (nPoints * sumXY - sumX * sumY) / denominator;
  const b = (sumY - m * sumX) / nPoints;

  if (!Number.isFinite(m) || !Number.isFinite(b)) return [];

  const lastX = points[nPoints - 1].x;
  const lastTs = dataList[N - 1].ts;
  const future = [];

  for (let i = 1; i <= futureSteps; i++) {
    const projX = lastX + i * (stepMs / 60000);
    const projY = Math.max(0, m * projX + b); // Keep predictions >= 0
    if (Number.isFinite(projY)) {
      future.push({ ts: lastTs + i * stepMs, value: projY });
    }
  }

  return future;
};

export default function PredictionPanel({ readings }) {
  // Use last 30 readings to predict the next 5 intervals (e.g. next 5 minutes)
  const rows = useMemo(() => {
    const recent = readings
      .filter((r) => r && Number.isFinite(Number(r.ts)))
      .slice(0, 30) // Take latest 30 points
      .reverse();   // Order chronologically

    if (recent.length < 5) return [];

    const tempFuture = predictFuture(recent, (r) => toNumber(r.temperature), 5, 60000);
    const co2Future = predictFuture(recent, (r) => toNumber(r.co2), 5, 60000);
    const smokeFuture = predictFuture(recent, (r) => toNumber(r.smoke), 5, 60000);
    const gasFuture = predictFuture(recent, (r) => toNumber(r.gas), 5, 60000);

    // Merge history and future for the chart
    // We will plot: [Time, Temp Act, Temp Pred, CO2 Act, CO2 Pred, Smoke Act, Smoke Pred, Gas Act, Gas Pred]
    const chartData = [["Time", "Temp actual", "Temp predict", "CO2 actual", "CO2 predict", "Smoke actual", "Smoke predict", "Gas actual", "Gas predict"]];

    recent.forEach((r) => {
      chartData.push([
        new Date(Number(r.ts)),
        toNumber(r.temperature), null,
        toNumber(r.co2), null,
        toNumber(r.smoke), null,
        toNumber(r.gas), null
      ]);
    });

    // Add a bridging point to connect the lines smoothly
    const lastR = recent[recent.length - 1];
    chartData.push([
      new Date(Number(lastR.ts)),
      null, toNumber(lastR.temperature),
      null, toNumber(lastR.co2),
      null, toNumber(lastR.smoke),
      null, toNumber(lastR.gas)
    ]);

    for (let i = 0; i < Math.max(tempFuture.length, smokeFuture.length); i++) {
      chartData.push([
        new Date(tempFuture[i]?.ts || smokeFuture[i]?.ts),
        null, tempFuture[i]?.value || null,
        null, co2Future[i]?.value || null,
        null, smokeFuture[i]?.value || null,
        null, gasFuture[i]?.value || null
      ]);
    }

    return chartData;
  }, [readings]);

  // Determine if a warning is predicted
  const predictions = rows.filter(r => r[2] !== null || r[4] !== null || r[6] !== null || r[8] !== null).slice(1); // skip header and bridge
  const predictedTempWarning = predictions.some(r => r[2] !== null && r[2] > 35); // Temp > 35C
  const predictedCo2Warning = predictions.some(r => r[4] !== null && r[4] > 2000); // CO2 > 2000ppm
  const predictedSmokeWarning = predictions.some(r => r[6] !== null && r[6] > 10); // Smoke > 10%
  const predictedGasWarning = predictions.some(r => r[8] !== null && r[8] > 500); // Gas > 500ppm

  let warningMessage = "Sensors are forecasted to remain within safe bounds.";
  let warningClass = "safe";

  if (predictedTempWarning || predictedCo2Warning || predictedSmokeWarning || predictedGasWarning) {
    warningClass = "warning";
    const issues = [];
    if (predictedTempWarning) issues.push("Temperature > 35°C");
    if (predictedCo2Warning) issues.push("CO2 > 2000 ppm");
    if (predictedSmokeWarning) issues.push("Smoke > 10%");
    if (predictedGasWarning) issues.push("Gas > 500 ppm");
    warningMessage = `Warning: Predicted threshold breach in the next 5 mins (${issues.join(" & ")}). AI recommends preemptive action.`;
  }

  if (rows.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Predictive Analysis</h3>
            <p className="muted">Forecasting next 5 minutes</p>
          </div>
        </div>
        <div className="empty-state" style={{ minHeight: '260px' }}>
          <div>Gathering data to build prediction model...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">
        <div>
          <h3>Predictive Analysis Model</h3>
          <p className="muted">+5 Min Forecasting Horizon</p>
        </div>
        <span className={`pill ${warningClass}`}>
          {warningClass === "warning" ? "Predicted Issue" : "Forecast Stable"}
        </span>
      </div>
      
      {warningClass === "warning" && (
        <div style={{
          padding: '8px 12px', 
          background: 'rgba(255, 200, 87, 0.1)', 
          borderLeft: '3px solid var(--warning)',
          color: 'var(--warning)',
          fontSize: '12px',
          fontWeight: 600,
          marginTop: '10px'
        }}>
          {warningMessage}
        </div>
      )}

      <div className="chart-wrap" style={{ flex: 1, minHeight: '240px', marginTop: '12px' }}>
        <Chart
          chartType="LineChart"
          width="100%"
          height="100%"
          data={rows}
          options={{
            backgroundColor: "transparent",
            legend: { position: "bottom", textStyle: { color: "#8b949e", fontSize: 11 } },
            curveType: "function",
            chartArea: { left: 40, right: 60, top: 10, bottom: 40, width: "100%", height: "100%" },
            hAxis: { format: "HH:mm", textStyle: { color: "#8b949e", fontSize: 10 }, gridlines: { color: "transparent" } },
            vAxes: {
              0: { textStyle: { color: "#8b949e", fontSize: 10 }, gridlines: { color: "rgba(255,255,255,0.05)" } },
              1: { textStyle: { color: "#8b949e", fontSize: 10 }, gridlines: { color: "transparent" } }
            },
            series: {
              0: { targetAxisIndex: 0, color: "#1a9c8b", lineWidth: 2, lineDashStyle: [1, 0] },     // Temp Actual
              1: { targetAxisIndex: 0, color: "#1a9c8b", lineWidth: 2, lineDashStyle: [4, 4] },     // Temp Predict
              2: { targetAxisIndex: 1, color: "#5b8dee", lineWidth: 2, lineDashStyle: [1, 0] },     // CO2 Actual
              3: { targetAxisIndex: 1, color: "#5b8dee", lineWidth: 2, lineDashStyle: [4, 4] },     // CO2 Predict
              4: { targetAxisIndex: 0, color: "#e35d6a", lineWidth: 2, lineDashStyle: [1, 0] },     // Smoke Actual
              5: { targetAxisIndex: 0, color: "#e35d6a", lineWidth: 2, lineDashStyle: [4, 4] },     // Smoke Predict
              6: { targetAxisIndex: 1, color: "#9b59b6", lineWidth: 2, lineDashStyle: [1, 0] },     // Gas Actual
              7: { targetAxisIndex: 1, color: "#9b59b6", lineWidth: 2, lineDashStyle: [4, 4] }      // Gas Predict
            },
            tooltip: { trigger: 'selection' } // allow hovering
          }}
        />
      </div>
    </div>
  );
}

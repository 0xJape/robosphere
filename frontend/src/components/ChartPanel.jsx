import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";

const toChartData = (readings) =>
  readings
    .slice(0, 60)
    .map((reading) => ({
      time: new Date(reading.ts).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
      }),
      co2: reading.co2,
      temperature: reading.temperature,
      humidity: reading.humidity
    }))
    .reverse();

export default function ChartPanel({ readings }) {
  const data = toChartData(readings || []);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>Environmental Trends</h3>
          <p className="muted">Last 60 readings</p>
        </div>
        <div className="legend-row">
          <span><i className="legend-dot co2" />CO2</span>
          <span><i className="legend-dot temp" />Temp</span>
          <span><i className="legend-dot humidity" />Humidity</span>
        </div>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" />
            <XAxis dataKey="time" tick={{ fill: "#5F6B7A", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#5F6B7A", fontSize: 12 }} axisLine={false} tickLine={false} width={42} />
            <Tooltip
              contentStyle={{
                background: "#FFFFFF",
                border: "1px solid #D5DEE9",
                borderRadius: 8,
                boxShadow: "0 12px 24px rgba(25, 36, 52, 0.12)"
              }}
              labelStyle={{ color: "#1D2633" }}
            />
            <Line type="monotone" dataKey="co2" stroke="#00F5A0" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="temperature" stroke="#FFC857" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="humidity" stroke="#6CC3FF" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

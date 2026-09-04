"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function Home() {
  const [config, setConfig] = useState({
    tasks: 200,
    arrivalRate: 20,
    edgeCapacity: 30,
    vmCapacity: 50,
    initialVMs: 1,
    maxVMs: 6,
    threshold: 0.75,
  });

  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const response = await fetch("/api/simulations");

      if (!response.ok) {
        throw new Error("Failed to load simulation history");
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setHistory(data);
      } else if (Array.isArray(data.simulations)) {
        setHistory(data.simulations);
      } else if (Array.isArray(data.results)) {
        setHistory(data.results);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error(err);
      setHistory([]);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;

    setConfig((previous) => ({
      ...previous,
      [name]: Number(value),
    }));
  }

  async function runSimulation() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Simulation failed");
      }

      /*
       * The API may return:
       * { results: [...] }
       * or simply [...]
       */
      let simulationResults = [];

      if (Array.isArray(data)) {
        simulationResults = data;
      } else if (Array.isArray(data.results)) {
        simulationResults = data.results;
      } else if (Array.isArray(data.simulations)) {
        simulationResults = data.simulations;
      }

      setResults(simulationResults);

      await loadHistory();
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  /*
   * Normalize the API response before sending it to Recharts.
   *
   * This fixes:
   * 1. "Unknown" algorithm labels
   * 2. ECLO being shown as 6400 instead of 64
   * 3. Utilization being shown as 1300 instead of 13
   */
  const chartData = (Array.isArray(results) ? results : []).map(
    (item, index) => {
      const algorithm =
        item?.algorithm ||
        item?.name ||
        item?.policy ||
        `Algorithm ${index + 1}`;

      const latency = Number(
        item?.latency ??
          item?.averageLatency ??
          item?.avgLatency ??
          0
      );

      const waitingTime = Number(
        item?.waitingTime ??
          item?.waiting ??
          item?.averageWaitingTime ??
          0
      );

      const throughput = Number(
        item?.throughput ??
          item?.edgeThroughput ??
          0
      );

      /*
       * Backend values may be:
       * 64.77  -> already percentage
       * 0.6477 -> decimal percentage
       *
       * Normalize both to 0-100.
       */
      let eclo = Number(
        item?.eclo ??
          item?.ecloScore ??
          item?.ECLO ??
          0
      );

      if (eclo > 0 && eclo <= 1) {
        eclo = eclo * 100;
      }

      let utilization = Number(
        item?.utilization ??
          item?.utilizationPercent ??
          item?.vmUtilization ??
          0
      );

      if (utilization > 0 && utilization <= 1) {
        utilization = utilization * 100;
      }

      const vms = Number(
        item?.vms ??
          item?.vmCount ??
          item?.maxVMCount ??
          item?.maximumVMCount ??
          1
      );

      return {
        algorithm,
        latency: Number(latency.toFixed(4)),
        waitingTime: Number(waitingTime.toFixed(4)),
        throughput: Number(throughput.toFixed(4)),
        eclo: Number(eclo.toFixed(2)),
        utilization: Number(utilization.toFixed(2)),
        vms,
      };
    }
  );

  const bestECLO =
    chartData.length > 0
      ? Math.max(...chartData.map((item) => item.eclo))
      : 0;

  const lowestLatency =
    chartData.length > 0
      ? Math.min(...chartData.map((item) => item.latency))
      : 0;

  const highestThroughput =
    chartData.length > 0
      ? Math.max(...chartData.map((item) => item.throughput))
      : 0;

  const maximumVMCount =
    chartData.length > 0
      ? Math.max(...chartData.map((item) => item.vms))
      : 0;

  const bestAlgorithm =
    chartData.length > 0
      ? chartData.reduce((best, current) =>
          current.eclo > best.eclo ? current : best
        ).algorithm
      : "-";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "30px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            background: "#ffffff",
            padding: "30px",
            borderRadius: "14px",
            marginBottom: "25px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          }}
        >
          <h1
            style={{
              margin: "0 0 10px",
              fontSize: "34px",
            }}
          >
            Edge-Cloud ECLO Scheduler
          </h1>

          <p
            style={{
              margin: 0,
              color: "#555",
              fontSize: "17px",
            }}
          >
            Priority-Based Scheduling with Dynamic VM Allocation
          </p>
        </div>

        {/* CONFIGURATION */}
        <section
          style={{
            background: "#ffffff",
            padding: "25px",
            borderRadius: "14px",
            marginBottom: "25px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          }}
        >
          <h2>Simulation Configuration</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "18px",
            }}
          >
            <InputField
              label="Number of Tasks"
              name="tasks"
              value={config.tasks}
              onChange={handleChange}
            />

            <InputField
              label="Arrival Rate (tasks/sec)"
              name="arrivalRate"
              value={config.arrivalRate}
              onChange={handleChange}
            />

            <InputField
              label="Edge Capacity (tasks/sec)"
              name="edgeCapacity"
              value={config.edgeCapacity}
              onChange={handleChange}
            />

            <InputField
              label="VM Capacity (tasks/sec)"
              name="vmCapacity"
              value={config.vmCapacity}
              onChange={handleChange}
            />

            <InputField
              label="Initial VMs"
              name="initialVMs"
              value={config.initialVMs}
              onChange={handleChange}
            />

            <InputField
              label="Maximum VMs"
              name="maxVMs"
              value={config.maxVMs}
              onChange={handleChange}
            />

            <InputField
              label="VM Threshold"
              name="threshold"
              value={config.threshold}
              step="0.05"
              onChange={handleChange}
            />
          </div>

          <button
            onClick={runSimulation}
            disabled={loading}
            style={{
              marginTop: "25px",
              padding: "13px 25px",
              border: "none",
              borderRadius: "8px",
              background: loading ? "#999" : "#2563eb",
              color: "white",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Running Simulation..." : "Run Simulation"}
          </button>

          {error && (
            <div
              style={{
                marginTop: "15px",
                padding: "12px",
                background: "#fee2e2",
                color: "#b91c1c",
                borderRadius: "8px",
              }}
            >
              {error}
            </div>
          )}
        </section>

        {/* RESULTS */}
        {chartData.length > 0 && (
          <>
            <section
              style={{
                background: "#ffffff",
                padding: "25px",
                borderRadius: "14px",
                marginBottom: "25px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
              }}
            >
              <h2>Simulation Results</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: "15px",
                }}
              >
                <MetricCard
                  title="Best ECLO Score"
                  value={`${bestECLO.toFixed(2)}%`}
                />

                <MetricCard
                  title="Best Algorithm"
                  value={bestAlgorithm}
                />

                <MetricCard
                  title="Lowest Latency"
                  value={lowestLatency.toFixed(4)}
                />

                <MetricCard
                  title="Highest Throughput"
                  value={highestThroughput.toFixed(4)}
                />

                <MetricCard
                  title="Maximum VM Count"
                  value={maximumVMCount}
                />
              </div>
            </section>

            {/* LATENCY */}
            <ChartCard title="Latency & Waiting Time Comparison">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis
                    dataKey="algorithm"
                    interval={0}
                  />

                  <YAxis />

                  <Tooltip />

                  <Legend />

                  <Bar
                    dataKey="latency"
                    name="Latency"
                  />

                  <Bar
                    dataKey="waitingTime"
                    name="Waiting Time"
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* THROUGHPUT */}
            <ChartCard title="Throughput Comparison">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis
                    dataKey="algorithm"
                    interval={0}
                  />

                  <YAxis />

                  <Tooltip />

                  <Legend />

                  <Bar
                    dataKey="throughput"
                    name="Throughput"
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* ECLO */}
            <ChartCard title="ECLO Score Comparison">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis
                    dataKey="algorithm"
                    interval={0}
                  />

                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />

                  <Tooltip
                    formatter={(value) =>
                      `${Number(value).toFixed(2)}%`
                    }
                  />

                  <Legend />

                  <Bar
                    dataKey="eclo"
                    name="ECLO Score (%)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* UTILIZATION */}
            <ChartCard title="VM Utilization Comparison">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis
                    dataKey="algorithm"
                    interval={0}
                  />

                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />

                  <Tooltip
                    formatter={(value) =>
                      `${Number(value).toFixed(2)}%`
                    }
                  />

                  <Legend />

                  <Bar
                    dataKey="utilization"
                    name="Utilization (%)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* VM COUNT */}
            <ChartCard title="VM Count Comparison">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis
                    dataKey="algorithm"
                    interval={0}
                  />

                  <YAxis allowDecimals={false} />

                  <Tooltip />

                  <Legend />

                  <Bar
                    dataKey="vms"
                    name="VM Count"
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* TABLE */}
            <section
              style={{
                background: "#ffffff",
                padding: "25px",
                borderRadius: "14px",
                marginBottom: "25px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                overflowX: "auto",
              }}
            >
              <h2>Detailed Results</h2>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "800px",
                }}
              >
                <thead>
                  <tr>
                    <TableHeader>Algorithm</TableHeader>
                    <TableHeader>Latency</TableHeader>
                    <TableHeader>Waiting Time</TableHeader>
                    <TableHeader>Throughput</TableHeader>
                    <TableHeader>Utilization</TableHeader>
                    <TableHeader>VMs</TableHeader>
                    <TableHeader>ECLO</TableHeader>
                  </tr>
                </thead>

                <tbody>
                  {chartData.map((item, index) => (
                    <tr key={`${item.algorithm}-${index}`}>
                      <TableCell>
                        {item.algorithm}
                      </TableCell>

                      <TableCell>
                        {item.latency.toFixed(4)}
                      </TableCell>

                      <TableCell>
                        {item.waitingTime.toFixed(4)}
                      </TableCell>

                      <TableCell>
                        {item.throughput.toFixed(4)}
                      </TableCell>

                      <TableCell>
                        {item.utilization.toFixed(2)}%
                      </TableCell>

                      <TableCell>
                        {item.vms}
                      </TableCell>

                      <TableCell>
                        {item.eclo.toFixed(2)}%
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        {/* HISTORY */}
        <section
          style={{
            background: "#ffffff",
            padding: "25px",
            borderRadius: "14px",
            marginBottom: "25px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            overflowX: "auto",
          }}
        >
          <h2>MongoDB Simulation History</h2>

          {history.length === 0 ? (
            <p>No simulations saved yet.</p>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "700px",
              }}
            >
              <thead>
                <tr>
                  <TableHeader>Algorithm</TableHeader>
                  <TableHeader>Latency</TableHeader>
                  <TableHeader>ECLO Score</TableHeader>
                  <TableHeader>VMs</TableHeader>
                  <TableHeader>Date</TableHeader>
                </tr>
              </thead>

              <tbody>
                {history.map((item, index) => {
                  const metrics = item.metrics || item;

                  const latency = Number(
                    metrics?.latency ??
                      metrics?.averageLatency ??
                      0
                  );

                  let eclo = Number(
                    metrics?.eclo ??
                      metrics?.ecloScore ??
                      item?.eclo ??
                      0
                  );

                  if (eclo > 0 && eclo <= 1) {
                    eclo *= 100;
                  }

                  const vms = Number(
                    metrics?.vms ??
                      metrics?.vmCount ??
                      item?.vms ??
                      1
                  );

                  return (
                    <tr key={item._id || index}>
                      <TableCell>
                        {item.algorithm || "Unknown"}
                      </TableCell>

                      <TableCell>
                        {latency.toFixed(4)}
                      </TableCell>

                      <TableCell>
                        {eclo.toFixed(2)}%
                      </TableCell>

                      <TableCell>{vms}</TableCell>

                      <TableCell>
                        {item.createdAt
                          ? new Date(
                              item.createdAt
                            ).toLocaleString()
                          : "-"}
                      </TableCell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <footer
          style={{
            textAlign: "center",
            padding: "20px",
            color: "#666",
          }}
        >
          Edge-Cloud Latency Optimization Simulation
        </footer>
      </div>
    </main>
  );
}

/* ---------------- COMPONENTS ---------------- */

function InputField({
  label,
  name,
  value,
  onChange,
  step = "1",
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          marginBottom: "7px",
          fontWeight: "bold",
        }}
      >
        {label}
      </label>

      <input
        type="number"
        name={name}
        value={value}
        step={step}
        min="0"
        onChange={onChange}
        style={{
          width: "100%",
          padding: "11px",
          border: "1px solid #ccc",
          borderRadius: "7px",
          boxSizing: "border-box",
          fontSize: "15px",
        }}
      />
    </div>
  );
}

function MetricCard({ title, value }) {
  return (
    <div
      style={{
        padding: "20px",
        borderRadius: "10px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "14px",
          marginBottom: "8px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "24px",
          fontWeight: "bold",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <section
      style={{
        background: "#ffffff",
        padding: "25px",
        borderRadius: "14px",
        marginBottom: "25px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
      }}
    >
      <h2>{title}</h2>

      <div
        style={{
          width: "100%",
          height: "400px",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function TableHeader({ children }) {
  return (
    <th
      style={{
        padding: "13px",
        textAlign: "left",
        borderBottom: "2px solid #ddd",
        background: "#f8fafc",
      }}
    >
      {children}
    </th>
  );
}

function TableCell({ children }) {
  return (
    <td
      style={{
        padding: "13px",
        borderBottom: "1px solid #eee",
      }}
    >
      {children}
    </td>
  );
}

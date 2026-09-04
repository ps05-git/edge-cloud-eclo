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
        throw new Error("Could not load simulation history");
      }

      const data = await response.json();

      setHistory(data.simulations || data || []);
    } catch (err) {
      console.error(err);
    }
  }

  function updateConfig(field, value) {
    setConfig((prev) => ({
      ...prev,
      [field]: Number(value),
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

      const simulationResults =
        data.results ||
        data.simulations ||
        data.data ||
        [];

      setResults(simulationResults);

      await loadHistory();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const bestResult =
    results.length > 0
      ? results.reduce((best, current) =>
          Number(current.eclo ?? current.ECLO ?? 0) >
          Number(best.eclo ?? best.ECLO ?? 0)
            ? current
            : best
        )
      : null;

  const chartData = results.map((item) => ({
    algorithm: item.algorithm,
    latency: Number(
      item.latency ??
        item.averageLatency ??
        item.avgLatency ??
        0
    ),
    throughput: Number(item.throughput ?? 0),
    eclo: Number(item.eclo ?? item.ECLO ?? 0) * 100,
    utilization:
      Number(item.utilization ?? item.vmUtilization ?? 0) * 100,
  }));

  return (
    <main className="dashboard">
      <header className="hero">
        <div>
          <div className="badge">CLOUD COMPUTING PROJECT</div>

          <h1>Edge-Cloud ECLO Scheduler</h1>

          <p>
            Priority-Based Scheduling with Dynamic VM Allocation
          </p>

          <div className="heroInfo">
            <span>⚡ Edge Computing</span>
            <span>☁️ Cloud Computing</span>
            <span>🧠 Priority Scheduling</span>
            <span>🔄 Dynamic VM Allocation</span>
          </div>
        </div>
      </header>

      <section className="content">
        {/* CONFIGURATION */}

        <div className="card">
          <div className="sectionTitle">
            <div>
              <h2>Simulation Configuration</h2>
              <p>
                Configure workload and cloud resources before running
                the simulation.
              </p>
            </div>
          </div>

          <div className="configGrid">
            <ConfigInput
              label="Number of Tasks"
              value={config.tasks}
              onChange={(e) =>
                updateConfig("tasks", e.target.value)
              }
            />

            <ConfigInput
              label="Arrival Rate (tasks/sec)"
              value={config.arrivalRate}
              onChange={(e) =>
                updateConfig("arrivalRate", e.target.value)
              }
            />

            <ConfigInput
              label="Edge Capacity (tasks/sec)"
              value={config.edgeCapacity}
              onChange={(e) =>
                updateConfig("edgeCapacity", e.target.value)
              }
            />

            <ConfigInput
              label="VM Capacity (tasks/sec)"
              value={config.vmCapacity}
              onChange={(e) =>
                updateConfig("vmCapacity", e.target.value)
              }
            />

            <ConfigInput
              label="Initial VMs"
              value={config.initialVMs}
              onChange={(e) =>
                updateConfig("initialVMs", e.target.value)
              }
            />

            <ConfigInput
              label="Maximum VMs"
              value={config.maxVMs}
              onChange={(e) =>
                updateConfig("maxVMs", e.target.value)
              }
            />

            <ConfigInput
              label="VM Threshold"
              value={config.threshold}
              step="0.05"
              onChange={(e) =>
                updateConfig("threshold", e.target.value)
              }
            />
          </div>

          <button
            className="runButton"
            onClick={runSimulation}
            disabled={loading}
          >
            {loading ? "Running Simulation..." : "▶ Run Simulation"}
          </button>

          {error && <div className="error">{error}</div>}
        </div>

        {/* RESULTS */}

        {results.length > 0 && (
          <>
            <div className="sectionHeading">
              <h2>Simulation Results</h2>
              <p>
                Performance comparison of the scheduling algorithms.
              </p>
            </div>

            <div className="statsGrid">
              <StatCard
                title="Best ECLO Score"
                value={
                  bestResult
                    ? `${(
                        Number(
                          bestResult.eclo ??
                            bestResult.ECLO ??
                            0
                        ) * 100
                      ).toFixed(2)}%`
                    : "-"
                }
                icon="🏆"
              />

              <StatCard
                title="Lowest Latency"
                value={
                  results.length
                    ? `${Math.min(
                        ...results.map((r) =>
                          Number(
                            r.latency ??
                              r.averageLatency ??
                              0
                          )
                        )
                      ).toFixed(4)} s`
                    : "-"
                }
                icon="⚡"
              />

              <StatCard
                title="Highest Throughput"
                value={
                  results.length
                    ? Math.max(
                        ...results.map((r) =>
                          Number(r.throughput ?? 0)
                        )
                      ).toFixed(4)
                    : "-"
                }
                icon="🚀"
              />

              <StatCard
                title="Maximum VM Count"
                value={
                  results.length
                    ? Math.max(
                        ...results.map((r) =>
                          Number(
                            r.vms ??
                              r.vmCount ??
                              r.maxVMs ??
                              1
                          )
                        )
                      )
                    : "-"
                }
                icon="☁️"
              />
            </div>

            {/* CHARTS */}

            <div className="chartGrid">
              <div className="card chartCard">
                <h3>Latency Comparison</h3>

                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="algorithm" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="latency"
                      name="Latency (seconds)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card chartCard">
                <h3>Throughput Comparison</h3>

                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="algorithm" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="throughput"
                      name="Throughput"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card chartCard">
                <h3>ECLO Score Comparison</h3>

                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="algorithm" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="eclo"
                      name="ECLO Score (%)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card chartCard">
                <h3>VM Utilization Comparison</h3>

                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="algorithm" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="utilization"
                      name="Utilization (%)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* TABLE */}

            <div className="card">
              <h2>Detailed Results</h2>

              <div className="tableWrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Algorithm</th>
                      <th>Latency</th>
                      <th>Waiting Time</th>
                      <th>Throughput</th>
                      <th>Utilization</th>
                      <th>VMs</th>
                      <th>ECLO</th>
                    </tr>
                  </thead>

                  <tbody>
                    {results.map((item, index) => (
                      <tr key={index}>
                        <td>
                          <strong>{item.algorithm}</strong>
                        </td>

                        <td>
                          {Number(
                            item.latency ??
                              item.averageLatency ??
                              0
                          ).toFixed(4)}
                        </td>

                        <td>
                          {Number(
                            item.waitingTime ??
                              item.waiting ??
                              0
                          ).toFixed(4)}
                        </td>

                        <td>
                          {Number(
                            item.throughput ?? 0
                          ).toFixed(4)}
                        </td>

                        <td>
                          {(
                            Number(
                              item.utilization ??
                                item.vmUtilization ??
                                0
                            ) * 100
                          ).toFixed(2)}
                          %
                        </td>

                        <td>
                          {item.vms ??
                            item.vmCount ??
                            item.maxVMs ??
                            1}
                        </td>

                        <td>
                          {(
                            Number(
                              item.eclo ??
                                item.ECLO ??
                                0
                            ) * 100
                          ).toFixed(2)}
                          %
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* HISTORY */}

        <div className="card">
          <div className="sectionTitle">
            <div>
              <h2>MongoDB Simulation History</h2>
              <p>
                Previous simulations stored in MongoDB Atlas.
              </p>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="empty">
              No simulations saved yet.
            </div>
          ) : (
            <div className="tableWrapper">
              <table>
                <thead>
                  <tr>
                    <th>Algorithm</th>
                    <th>Latency</th>
                    <th>ECLO Score</th>
                    <th>VMs</th>
                    <th>Date</th>
                  </tr>
                </thead>

                <tbody>
                  {history.map((item, index) => (
                    <tr key={item._id || index}>
                      <td>
                        <strong>{item.algorithm}</strong>
                      </td>

                      <td>
                        {Number(
                          item.latency ??
                            item.averageLatency ??
                            0
                        ).toFixed(4)}
                      </td>

                      <td>
                        {(
                          Number(
                            item.eclo ??
                              item.ECLO ??
                              0
                          ) * 100
                        ).toFixed(2)}
                        %
                      </td>

                      <td>
                        {item.vms ??
                          item.vmCount ??
                          item.maxVMs ??
                          1}
                      </td>

                      <td>
                        {item.createdAt
                          ? new Date(
                              item.createdAt
                            ).toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer>
          <strong>Edge-Cloud Latency Optimization (ECLO)</strong>
          <span>
            Priority-Based Scheduling + Dynamic VM Allocation
          </span>
        </footer>
      </section>
    </main>
  );
}

function ConfigInput({
  label,
  value,
  onChange,
  step = "1",
}) {
  return (
    <label className="inputGroup">
      <span>{label}</span>

      <input
        type="number"
        value={value}
        step={step}
        min="0"
        onChange={onChange}
      />
    </label>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="statCard">
      <div className="statIcon">{icon}</div>

      <div>
        <p>{title}</p>
        <h3>{value}</h3>
      </div>
    </div>
  );
}

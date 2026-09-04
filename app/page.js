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
        return;
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setHistory(data);
      } else if (Array.isArray(data.simulations)) {
        setHistory(data.simulations);
      } else if (Array.isArray(data.data)) {
        setHistory(data.data);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error("History error:", err);
    }
  }

  function updateConfig(field, value) {
    setConfig((previous) => ({
      ...previous,
      [field]: Number(value),
    }));
  }

  function extractResults(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data.results)) {
      return data.results;
    }

    if (
      data.results &&
      typeof data.results === "object"
    ) {
      return Object.values(data.results);
    }

    if (Array.isArray(data.simulations)) {
      return data.simulations;
    }

    if (Array.isArray(data.data)) {
      return data.data;
    }

    return [];
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
        throw new Error(
          data.error || "Simulation failed"
        );
      }

      const simulationResults = extractResults(data);

      if (!simulationResults.length) {
        throw new Error(
          "Simulation completed, but no results were returned."
        );
      }

      setResults(simulationResults);

      await loadHistory();
    } catch (err) {
      console.error(err);
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function getLatency(item) {
    return Number(
      item.latency ??
        item.averageLatency ??
        item.avgLatency ??
        0
    );
  }

  function getWaiting(item) {
    return Number(
      item.waitingTime ??
        item.waiting ??
        item.averageWaitingTime ??
        0
    );
  }

  function getThroughput(item) {
    return Number(item.throughput ?? 0);
  }

  function getUtilization(item) {
    return Number(
      item.utilization ??
        item.vmUtilization ??
        item.cloudUtilization ??
        0
    );
  }

  function getVMs(item) {
    return Number(
      item.vms ??
        item.vmCount ??
        item.maxVMs ??
        item.maximumVMs ??
        1
    );
  }

  function getECLO(item) {
    return Number(
      item.eclo ??
        item.ECLO ??
        item.ecloScore ??
        0
    );
  }

  const bestResult =
    results.length > 0
      ? results.reduce((best, current) =>
          getECLO(current) > getECLO(best)
            ? current
            : best
        )
      : null;

  const chartData = Array.isArray(results)
    ? results.map((item) => ({
        algorithm: String(
          item.algorithm ?? "Unknown"
        ),
        latency: getLatency(item),
        throughput: getThroughput(item),
        eclo: getECLO(item) * 100,
        utilization: getUtilization(item) * 100,
      }))
    : [];

  const lowestLatency =
    results.length > 0
      ? Math.min(
          ...results.map((item) =>
            getLatency(item)
          )
        )
      : 0;

  const highestThroughput =
    results.length > 0
      ? Math.max(
          ...results.map((item) =>
            getThroughput(item)
          )
        )
      : 0;

  const maximumVMs =
    results.length > 0
      ? Math.max(
          ...results.map((item) =>
            getVMs(item)
          )
        )
      : 0;

  return (
    <main className="dashboard">

      {/* HEADER */}

      <header className="hero">
        <div className="heroContent">

          <div className="badge">
            CLOUD COMPUTING PROJECT
          </div>

          <h1>
            Edge-Cloud ECLO Scheduler
          </h1>

          <p>
            Priority-Based Scheduling with
            Dynamic VM Allocation
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
              <h2>
                Simulation Configuration
              </h2>

              <p>
                Configure the workload and
                cloud resources for the simulation.
              </p>
            </div>
          </div>

          <div className="configGrid">

            <ConfigInput
              label="Number of Tasks"
              value={config.tasks}
              onChange={(event) =>
                updateConfig(
                  "tasks",
                  event.target.value
                )
              }
            />

            <ConfigInput
              label="Arrival Rate (tasks/sec)"
              value={config.arrivalRate}
              onChange={(event) =>
                updateConfig(
                  "arrivalRate",
                  event.target.value
                )
              }
            />

            <ConfigInput
              label="Edge Capacity (tasks/sec)"
              value={config.edgeCapacity}
              onChange={(event) =>
                updateConfig(
                  "edgeCapacity",
                  event.target.value
                )
              }
            />

            <ConfigInput
              label="VM Capacity (tasks/sec)"
              value={config.vmCapacity}
              onChange={(event) =>
                updateConfig(
                  "vmCapacity",
                  event.target.value
                )
              }
            />

            <ConfigInput
              label="Initial VMs"
              value={config.initialVMs}
              onChange={(event) =>
                updateConfig(
                  "initialVMs",
                  event.target.value
                )
              }
            />

            <ConfigInput
              label="Maximum VMs"
              value={config.maxVMs}
              onChange={(event) =>
                updateConfig(
                  "maxVMs",
                  event.target.value
                )
              }
            />

            <ConfigInput
              label="VM Threshold"
              value={config.threshold}
              step="0.05"
              onChange={(event) =>
                updateConfig(
                  "threshold",
                  event.target.value
                )
              }
            />

          </div>

          <button
            className="runButton"
            onClick={runSimulation}
            disabled={loading}
          >
            {loading
              ? "Running Simulation..."
              : "▶ Run Simulation"}
          </button>

          {error && (
            <div className="error">
              {error}
            </div>
          )}

        </div>

        {/* RESULTS */}

        {results.length > 0 && (
          <>
            <div className="sectionHeading">
              <h2>
                Simulation Results
              </h2>

              <p>
                Performance comparison of all
                scheduling algorithms.
              </p>
            </div>

            {/* STATISTICS */}

            <div className="statsGrid">

              <StatCard
                title="Best ECLO Score"
                value={
                  bestResult
                    ? `${(
                        getECLO(bestResult) *
                        100
                      ).toFixed(2)}%`
                    : "-"
                }
                icon="🏆"
              />

              <StatCard
                title="Lowest Latency"
                value={
                  `${lowestLatency.toFixed(
                    4
                  )} s`
                }
                icon="⚡"
              />

              <StatCard
                title="Highest Throughput"
                value={
                  highestThroughput.toFixed(4)
                }
                icon="🚀"
              />

              <StatCard
                title="Maximum VM Count"
                value={maximumVMs}
                icon="☁️"
              />

            </div>

            {/* CHARTS */}

            <div className="chartGrid">

              <div className="card chartCard">

                <h3>
                  Latency Comparison
                </h3>

                <ResponsiveContainer
                  width="100%"
                  height={320}
                >
                  <BarChart data={chartData}>

                    <CartesianGrid
                      strokeDasharray="3 3"
                    />

                    <XAxis
                      dataKey="algorithm"
                    />

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

                <h3>
                  Throughput Comparison
                </h3>

                <ResponsiveContainer
                  width="100%"
                  height={320}
                >
                  <BarChart data={chartData}>

                    <CartesianGrid
                      strokeDasharray="3 3"
                    />

                    <XAxis
                      dataKey="algorithm"
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

              </div>

              <div className="card chartCard">

                <h3>
                  ECLO Score Comparison
                </h3>

                <ResponsiveContainer
                  width="100%"
                  height={320}
                >
                  <BarChart data={chartData}>

                    <CartesianGrid
                      strokeDasharray="3 3"
                    />

                    <XAxis
                      dataKey="algorithm"
                    />

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

                <h3>
                  VM Utilization Comparison
                </h3>

                <ResponsiveContainer
                  width="100%"
                  height={320}
                >
                  <BarChart data={chartData}>

                    <CartesianGrid
                      strokeDasharray="3 3"
                    />

                    <XAxis
                      dataKey="algorithm"
                    />

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

            {/* DETAILED TABLE */}

            <div className="card">

              <h2>
                Detailed Results
              </h2>

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

                    {results.map(
                      (item, index) => (
                        <tr key={index}>

                          <td>
                            <strong>
                              {item.algorithm ??
                                "Unknown"}
                            </strong>
                          </td>

                          <td>
                            {getLatency(
                              item
                            ).toFixed(4)}
                          </td>

                          <td>
                            {getWaiting(
                              item
                            ).toFixed(4)}
                          </td>

                          <td>
                            {getThroughput(
                              item
                            ).toFixed(4)}
                          </td>

                          <td>
                            {(
                              getUtilization(
                                item
                              ) * 100
                            ).toFixed(2)}
                            %
                          </td>

                          <td>
                            {getVMs(item)}
                          </td>

                          <td>
                            {(
                              getECLO(item) *
                              100
                            ).toFixed(2)}
                            %
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>

            </div>

          </>
        )}

        {/* MONGODB HISTORY */}

        <div className="card">

          <div className="sectionTitle">

            <div>
              <h2>
                MongoDB Simulation History
              </h2>

              <p>
                Previous simulation results
                stored in MongoDB Atlas.
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

                  {history.map(
                    (item, index) => (
                      <tr
                        key={
                          item._id ||
                          index
                        }
                      >

                        <td>
                          <strong>
                            {item.algorithm ??
                              "Unknown"}
                          </strong>
                        </td>

                        <td>
                          {getLatency(
                            item
                          ).toFixed(4)}
                        </td>

                        <td>
                          {(
                            getECLO(item) *
                            100
                          ).toFixed(2)}
                          %
                        </td>

                        <td>
                          {getVMs(item)}
                        </td>

                        <td>
                          {item.createdAt
                            ? new Date(
                                item.createdAt
                              ).toLocaleString()
                            : "-"}
                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </div>

        {/* FOOTER */}

        <footer>

          <strong>
            Edge-Cloud Latency Optimization
            (ECLO)
          </strong>

          <span>
            Priority-Based Scheduling +
            Dynamic VM Allocation
          </span>

        </footer>

      </section>

    </main>
  );
}


/* CONFIG INPUT */

function ConfigInput({
  label,
  value,
  onChange,
  step = "1",
}) {
  return (
    <label className="inputGroup">

      <span>
        {label}
      </span>

      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={onChange}
      />

    </label>
  );
}


/* STAT CARD */

function StatCard({
  title,
  value,
  icon,
}) {
  return (
    <div className="statCard">

      <div className="statIcon">
        {icon}
      </div>

      <div>

        <p>
          {title}
        </p>

        <h3>
          {value}
        </h3>

      </div>

    </div>
  );
}

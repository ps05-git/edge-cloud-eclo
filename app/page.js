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
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState("");

  /*
   * Load saved MongoDB simulations when the page opens.
   */
  useEffect(() => {
    loadHistory();
  }, []);

  /*
   * Convert MongoDB/API records into a common format.
   *
   * The backend may return:
   *
   * {
   *   algorithm: "Static",
   *   metrics: {
   *      latency: ...,
   *      throughput: ...,
   *      eclo: ...
   *   }
   * }
   *
   * OR:
   *
   * {
   *   algorithm: "Static",
   *   latency: ...
   * }
   */
  function normalizeResult(item, index = 0) {
    const metrics =
      item?.metrics && typeof item.metrics === "object"
        ? item.metrics
        : item || {};

    const algorithm =
      item?.algorithm ||
      metrics?.algorithm ||
      item?.name ||
      metrics?.name ||
      item?.policy ||
      metrics?.policy ||
      `Algorithm ${index + 1}`;

    const latency = Number(
      metrics?.latency ??
        metrics?.averageLatency ??
        metrics?.avgLatency ??
        item?.latency ??
        item?.averageLatency ??
        0
    );

    const waitingTime = Number(
      metrics?.waitingTime ??
        metrics?.waiting ??
        metrics?.averageWaitingTime ??
        item?.waitingTime ??
        item?.waiting ??
        0
    );

    const throughput = Number(
      metrics?.throughput ??
        metrics?.edgeThroughput ??
        item?.throughput ??
        item?.edgeThroughput ??
        0
    );

    let eclo = Number(
      metrics?.eclo ??
        metrics?.ecloScore ??
        metrics?.ECLO ??
        item?.eclo ??
        item?.ecloScore ??
        item?.ECLO ??
        0
    );

    /*
     * Convert decimal ECLO to percentage.
     *
     * Example:
     * 0.6477 -> 64.77
     */
    if (eclo > 0 && eclo <= 1) {
      eclo *= 100;
    }

    let utilization = Number(
      metrics?.utilization ??
      metrics?.utilizationPercent ??
      metrics?.vmUtilization ??
      item?.utilization ??
      item?.utilizationPercent ??
      item?.vmUtilization ??
      metrics?.cloudUtilization ??
      metrics?.resourceUtilization ??
      item?.cloudUtilization ??
      item?.resourceUtilization ??
      0
    );

    /*
     * Convert decimal utilization to percentage.
     *
     * Example:
     * 0.1366 -> 13.66
     */
    if (utilization > 0 && utilization <= 1) {
      utilization *= 100;
    }

    const vms = Number(
      metrics?.vms ??
        metrics?.vmCount ??
        metrics?.maxVMCount ??
        metrics?.maximumVMCount ??
        item?.vms ??
        item?.vmCount ??
        item?.maxVMCount ??
        item?.maximumVMCount ??
        1
    );

    return {
      algorithm,
      latency: Number.isFinite(latency)
        ? Number(latency.toFixed(4))
        : 0,

      waitingTime: Number.isFinite(waitingTime)
        ? Number(waitingTime.toFixed(4))
        : 0,

      throughput: Number.isFinite(throughput)
        ? Number(throughput.toFixed(4))
        : 0,

      eclo: Number.isFinite(eclo)
        ? Number(eclo.toFixed(2))
        : 0,

      utilization: Number.isFinite(utilization)
        ? Number(utilization.toFixed(2))
        : 0,

      vms: Number.isFinite(vms) ? vms : 1,
    };
  }

  /*
   * Load simulation history from MongoDB.
   *
   * IMPORTANT:
   * We also restore the latest simulation into `results`.
   * This is what prevents the charts/results from disappearing
   * after refreshing the page.
   */
  async function loadHistory() {
    setLoadingHistory(true);

    try {
      const response = await fetch("/api/simulations", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to load simulation history"
        );
      }

      let savedSimulations = [];

      if (Array.isArray(data)) {
        savedSimulations = data;
      } else if (Array.isArray(data.simulations)) {
        savedSimulations = data.simulations;
      } else if (Array.isArray(data.results)) {
        savedSimulations = data.results;
      }

      setHistory(savedSimulations);

      /*
       * Restore the latest simulation.
       *
       * The API returns newest records first.
       * Each simulation run currently creates four records:
       *
       * Static
       * Dynamic
       * Integrated
       * Adaptive Integrated
       *
       * Therefore the newest four records represent
       * the latest run.
       */
      if (savedSimulations.length > 0) {
        const latestRecords = savedSimulations.slice(0, 4);

        const restoredResults = latestRecords.map(
          (item, index) => normalizeResult(item, index)
        );

        setResults(restoredResults);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error("History loading error:", err);

      setHistory([]);
      setResults([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  /*
   * Input change handler.
   */
  function handleChange(e) {
    const { name, value } = e.target;

    setConfig((previous) => ({
      ...previous,
      [name]: Number(value),
    }));
  }

  /*
   * Run a new simulation.
   */
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
          data?.error || "Simulation failed"
        );
      }

      let simulationResults = [];

      if (Array.isArray(data)) {
        simulationResults = data;
      } else if (Array.isArray(data.results)) {
        simulationResults = data.results;
      } else if (Array.isArray(data.simulations)) {
        simulationResults = data.simulations;
      }

      /*
       * Normalize the returned simulation results.
       */
      const normalizedResults = simulationResults.map(
        (item, index) => normalizeResult(item, index)
      );

      setResults(normalizedResults);

      /*
       * Reload MongoDB history.
       *
       * This also restores the latest run.
       */
      await loadHistory();
    } catch (err) {
      console.error("Simulation error:", err);

      setError(
        err?.message || "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Chart data is already normalized.
   */
  const chartData = Array.isArray(results)
    ? results
    : [];

  /*
   * Best ECLO.
   */
  const bestECLO =
    chartData.length > 0
      ? Math.max(
          ...chartData.map((item) => item.eclo)
        )
      : 0;

  /*
   * Lowest latency.
   */
  const lowestLatency =
    chartData.length > 0
      ? Math.min(
          ...chartData.map((item) => item.latency)
        )
      : 0;

  /*
   * Highest throughput.
   */
  const highestThroughput =
    chartData.length > 0
      ? Math.max(
          ...chartData.map((item) => item.throughput)
        )
      : 0;

  /*
   * Maximum VM count.
   */
  const maximumVMCount =
    chartData.length > 0
      ? Math.max(
          ...chartData.map((item) => item.vms)
        )
      : 0;

  /*
   * Best algorithm.
   */
  const bestAlgorithm =
    chartData.length > 0
      ? chartData.reduce((best, current) =>
          current.eclo > best.eclo
            ? current
            : best
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

        {/* ================= HEADER ================= */}

        <div
          style={{
            background: "#ffffff",
            padding: "30px",
            borderRadius: "14px",
            marginBottom: "25px",
            boxShadow:
              "0 2px 10px rgba(0,0,0,0.08)",
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
            Priority-Based Scheduling with Dynamic
            VM Allocation
          </p>
        </div>

        {/* ================= CONFIGURATION ================= */}

        <section
          style={{
            background: "#ffffff",
            padding: "25px",
            borderRadius: "14px",
            marginBottom: "25px",
            boxShadow:
              "0 2px 10px rgba(0,0,0,0.08)",
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
              background: loading
                ? "#999"
                : "#2563eb",
              color: "white",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: loading
                ? "not-allowed"
                : "pointer",
            }}
          >
            {loading
              ? "Running Simulation..."
              : "Run Simulation"}
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

        {/* ================= RESULTS ================= */}

        {chartData.length > 0 && (
          <>
            {/* SUMMARY */}

            <section
              style={{
                background: "#ffffff",
                padding: "25px",
                borderRadius: "14px",
                marginBottom: "25px",
                boxShadow:
                  "0 2px 10px rgba(0,0,0,0.08)",
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
              <ResponsiveContainer
                width="100%"
                height={400}
              >
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

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
              <ResponsiveContainer
                width="100%"
                height={400}
              >
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

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
              <ResponsiveContainer
                width="100%"
                height={400}
              >
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    dataKey="algorithm"
                    interval={0}
                  />

                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(value) =>
                      `${value}%`
                    }
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
              <ResponsiveContainer
                width="100%"
                height={400}
              >
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    dataKey="algorithm"
                    interval={0}
                  />

                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(value) =>
                      `${value}%`
                    }
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
              <ResponsiveContainer
                width="100%"
                height={400}
              >
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

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

            {/* DETAILED TABLE */}

            <section
              style={{
                background: "#ffffff",
                padding: "25px",
                borderRadius: "14px",
                marginBottom: "25px",
                boxShadow:
                  "0 2px 10px rgba(0,0,0,0.08)",
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
                    <TableHeader>
                      Algorithm
                    </TableHeader>

                    <TableHeader>
                      Latency
                    </TableHeader>

                    <TableHeader>
                      Waiting Time
                    </TableHeader>

                    <TableHeader>
                      Throughput
                    </TableHeader>

                    <TableHeader>
                      Utilization
                    </TableHeader>

                    <TableHeader>
                      VMs
                    </TableHeader>

                    <TableHeader>
                      ECLO
                    </TableHeader>
                  </tr>
                </thead>

                <tbody>
                  {chartData.map((item, index) => (
                    <tr
                      key={`${item.algorithm}-${index}`}
                    >
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

        {/* ================= MONGODB HISTORY ================= */}

        <section
          style={{
            background: "#ffffff",
            padding: "25px",
            borderRadius: "14px",
            marginBottom: "25px",
            boxShadow:
              "0 2px 10px rgba(0,0,0,0.08)",
            overflowX: "auto",
          }}
        >
          <h2>MongoDB Simulation History</h2>

          {loadingHistory ? (
            <p>Loading simulation history...</p>
          ) : history.length === 0 ? (
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
                  <TableHeader>
                    Algorithm
                  </TableHeader>

                  <TableHeader>
                    Latency
                  </TableHeader>

                  <TableHeader>
                    ECLO Score
                  </TableHeader>

                  <TableHeader>
                    VMs
                  </TableHeader>

                  <TableHeader>
                    Date
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {history.map((item, index) => {
                  const normalized =
                    normalizeResult(
                      item,
                      index
                    );

                  return (
                    <tr
                      key={
                        item?._id ||
                        `${item.algorithm}-${index}`
                      }
                    >
                      <TableCell>
                        {normalized.algorithm}
                      </TableCell>

                      <TableCell>
                        {normalized.latency.toFixed(4)}
                      </TableCell>

                      <TableCell>
                        {normalized.eclo.toFixed(2)}%
                      </TableCell>

                      <TableCell>
                        {normalized.vms}
                      </TableCell>

                      <TableCell>
                        {item?.createdAt
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

        {/* ================= FOOTER ================= */}

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

/* =====================================================
   INPUT FIELD
===================================================== */

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

/* =====================================================
   METRIC CARD
===================================================== */

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

/* =====================================================
   CHART CARD
===================================================== */

function ChartCard({ title, children }) {
  return (
    <section
      style={{
        background: "#ffffff",
        padding: "25px",
        borderRadius: "14px",
        marginBottom: "25px",
        boxShadow:
          "0 2px 10px rgba(0,0,0,0.08)",
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

/* =====================================================
   TABLE HEADER
===================================================== */

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

/* =====================================================
   TABLE CELL
===================================================== */

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

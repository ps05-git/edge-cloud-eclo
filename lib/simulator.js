function randomNormal(mean, std, random) {
  let u = 0;
  let v = 0;

  while (u === 0) u = random();
  while (v === 0) v = random();

  return (
    mean +
    std *
      Math.sqrt(-2 * Math.log(u)) *
      Math.cos(2 * Math.PI * v)
  );
}

function createRandom(seed) {
  let value = seed >>> 0;

  return function () {
    value += 0x6d2b79f5;
    let t = value;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateTasks(count, arrivalRate) {
  const random = createRandom(
    Math.floor(count * 100 + arrivalRate * 1000)
  );

  const tasks = [];
  let currentTime = 0;

  for (let i = 0; i < count; i++) {
    const interArrival =
      Math.max(0.01, -Math.log(Math.max(random(), 0.000001)) / arrivalRate);

    currentTime += interArrival;

    const isHeartbeat = random() < 0.4;

    let temperature = 36.5;

    if (!isHeartbeat) {
      temperature = randomNormal(37.2, 0.7, random);
      temperature = Math.max(35.5, Math.min(40.5, temperature));
    }

    const fever = temperature >= 38.0;

    let priority;

    if (isHeartbeat) {
      priority = 1;
    } else if (fever) {
      priority = 1;
    } else {
      priority = 2;
    }

    tasks.push({
      id: i + 1,
      arrivalTime: currentTime,
      type: isHeartbeat ? "Heartbeat" : "Temperature",
      temperature,
      priority,
      urgent: fever
    });
  }

  return tasks;
}

function calculateVMCount(cloudArrivalRate, config, mode) {
  if (mode !== "adaptive") {
    return Math.max(1, config.initialVMs);
  }

  const required =
    cloudArrivalRate / Math.max(config.vmCapacity, 1);

  const target =
    Math.ceil(required / Math.max(config.threshold, 0.1));

  return Math.min(
    config.maxVMs,
    Math.max(config.initialVMs, target)
  );
}

function processSimulation(tasks, config, mode) {
  let edgeFree = 0;

  const initialVMs = Math.max(1, config.initialVMs);

  let vmFreeTimes = Array(initialVMs).fill(0);

  const edgeTasks = [];
  const cloudTasks = [];

  let totalEdgeWork = 0;
  let totalCloudWork = 0;

  let highPriorityCompleted = 0;
  let totalHighPriority = 0;

  /*
   * First determine how tasks are distributed.
   *
   * Static:
   *   High priority tasks are preferred at the edge.
   *
   * Dynamic:
   *   High priority and abnormal temperature tasks
   *   receive additional preference.
   *
   * Integrated:
   *   Combines base priority with dynamic urgency
   *   and current edge load.
   *
   * Adaptive:
   *   Uses integrated scheduling plus VM scaling.
   */

  for (const task of tasks) {
    if (task.priority === 1) {
      totalHighPriority++;
    }

    const currentEdgeLoad =
      edgeFree > task.arrivalTime
        ? Math.min(
            1,
            (edgeFree - task.arrivalTime) *
              config.edgeCapacity
          )
        : 0;

    let toEdge = false;

    if (mode === "static") {
      /*
       * Static priority:
       * heartbeat / high-priority data gets edge preference.
       */
      toEdge =
        task.priority === 1 &&
        currentEdgeLoad < config.threshold;
    }

    else if (mode === "dynamic") {
      /*
       * Dynamic priority:
       * fever/urgent readings can become high priority.
       */
      const dynamicHigh =
        task.priority === 1 ||
        task.urgent;

      toEdge =
        dynamicHigh &&
        currentEdgeLoad < config.threshold;
    }

    else if (mode === "integrated") {
      /*
       * Integrated:
       * combines static priority, dynamic urgency,
       * and workload-aware scheduling.
       */

      const dynamicHigh =
        task.priority === 1 ||
        task.urgent;

      const moderateCanUseEdge =
        task.priority === 2 &&
        currentEdgeLoad < config.threshold * 0.85;

      toEdge =
        (dynamicHigh && currentEdgeLoad < config.threshold) ||
        moderateCanUseEdge;
    }

    else if (mode === "adaptive") {
      /*
       * Adaptive integrated:
       * same integrated scheduling logic,
       * while cloud capacity can dynamically scale.
       */

      const dynamicHigh =
        task.priority === 1 ||
        task.urgent;

      const moderateCanUseEdge =
        task.priority === 2 &&
        currentEdgeLoad < config.threshold * 0.8;

      toEdge =
        (dynamicHigh && currentEdgeLoad < config.threshold) ||
        moderateCanUseEdge;
    }

    if (toEdge) {
      const start = Math.max(
        task.arrivalTime,
        edgeFree
      );

      const serviceTime =
        1 / Math.max(config.edgeCapacity, 1);

      const completion =
        start + serviceTime;

      edgeFree = completion;

      const waiting =
        start - task.arrivalTime;

      const latency =
        completion - task.arrivalTime;

      totalEdgeWork += serviceTime;

      edgeTasks.push({
        ...task,
        waiting,
        completion,
        latency,
        location: "Edge"
      });

      if (task.priority === 1) {
        highPriorityCompleted++;
      }
    }

    else {
      /*
       * Cloud processing.
       *
       * Transmission delay is included because
       * cloud tasks must travel from edge to cloud.
       */
      cloudTasks.push({
        ...task,
        location: "Cloud"
      });
    }
  }

  /*
   * Estimate cloud arrival rate.
   */
  const totalTime =
    Math.max(
      1,
      tasks.length / Math.max(config.arrivalRate, 1)
    );

  const cloudArrivalRate =
    cloudTasks.length / totalTime;

  /*
   * Adaptive VM allocation.
   */
  const vmCount = calculateVMCount(
    cloudArrivalRate,
    config,
    mode
  );

  /*
   * Ensure VM array contains the required number of VMs.
   */
  while (vmFreeTimes.length < vmCount) {
    vmFreeTimes.push(0);
  }

  /*
   * Process cloud tasks.
   */
  for (const task of cloudTasks) {
    let selectedVM = 0;

    for (let i = 1; i < vmFreeTimes.length; i++) {
      if (
        vmFreeTimes[i] <
        vmFreeTimes[selectedVM]
      ) {
        selectedVM = i;
      }
    }

    /*
     * Small network transmission delay.
     * Integrated/adaptive routing gets slightly
     * better handling of cloud-bound tasks.
     */
    let transmissionDelay = 0.006;

    if (mode === "integrated") {
      transmissionDelay = 0.004;
    }

    if (mode === "adaptive") {
      transmissionDelay = 0.003;
    }

    const arrivalAtCloud =
      task.arrivalTime + transmissionDelay;

    const start = Math.max(
      arrivalAtCloud,
      vmFreeTimes[selectedVM]
    );

    const serviceTime =
      1 / Math.max(config.vmCapacity, 1);

    const completion =
      start + serviceTime;

    vmFreeTimes[selectedVM] = completion;

    const waiting =
      start - arrivalAtCloud;

    const latency =
      completion - task.arrivalTime;

    totalCloudWork += serviceTime;

    cloudTasks[cloudTasks.indexOf(task)] = {
      ...task,
      waiting,
      completion,
      latency,
      location: "Cloud"
    };

    if (task.priority === 1) {
      highPriorityCompleted++;
    }
  }

  /*
   * Combine results.
   */
  const allTasks = [
    ...edgeTasks,
    ...cloudTasks
  ];

  const finalTime = Math.max(
    1,
    ...allTasks.map((task) => task.completion)
  );

  /*
   * Average latency.
   */
  const averageLatency =
    allTasks.reduce(
      (sum, task) => sum + task.latency,
      0
    ) / Math.max(allTasks.length, 1);

  /*
   * Average waiting time.
   */
  const averageWaitingTime =
    allTasks.reduce(
      (sum, task) => sum + task.waiting,
      0
    ) / Math.max(allTasks.length, 1);

  /*
   * IMPORTANT:
   * Throughput is now TOTAL completed tasks,
   * not just edge tasks.
   */
  const totalThroughput =
    allTasks.length / finalTime;

  const edgeThroughput =
    edgeTasks.length / finalTime;

  /*
   * Edge utilization.
   */
  const edgeUtilization =
    Math.min(
      1,
      totalEdgeWork /
        Math.max(finalTime, 1 / config.edgeCapacity)
    );

  /*
   * Cloud utilization.
   */
  const cloudCapacity =
    vmCount * config.vmCapacity;

  const cloudUtilization =
    Math.min(
      1,
      totalCloudWork /
        Math.max(finalTime * cloudCapacity, 1)
    );

  /*
   * Overall resource utilization.
   */
  const resourceUtilization =
    Math.min(
      1,
      (
        edgeUtilization +
        cloudUtilization
      ) / 2
    );

  /*
   * Priority satisfaction.
   */
  const prioritySatisfaction =
    totalHighPriority > 0
      ? highPriorityCompleted /
        totalHighPriority
      : 1;

  /*
   * VM efficiency:
   * reward useful VM usage without encouraging
   * unnecessary VM creation.
   */
  const vmEfficiency =
    vmCount > 0
      ? Math.min(
          1,
          cloudUtilization *
            (1 / Math.sqrt(vmCount))
        )
      : 0;

  /*
   * Store useful metrics for ECLO normalization.
   */
  return {
    averageLatency,
    averageWaitingTime,
    totalThroughput,
    edgeThroughput,
    edgeUtilization,
    cloudUtilization,
    resourceUtilization,
    prioritySatisfaction,
    vmEfficiency,
    vmCount,
    edgeTasks: edgeTasks.length,
    cloudTasks: cloudTasks.length,
    simulationTime: finalTime
  };
}

function calculateECLO(results) {
  /*
   * The paper defines ECLO as a weighted combination
   * of latency, edge efficiency, VM efficiency and
   * edge throughput.
   *
   * The paper does not specify fixed alpha/beta/gamma/delta
   * values in the supplied implementation description.
   *
   * Therefore this web simulation normalizes the
   * components across the four algorithms.
   */

  const maxLatency = Math.max(
    ...results.map(
      (r) => r.averageLatency
    )
  );

  const maxEdgeThroughput = Math.max(
    ...results.map(
      (r) => r.edgeThroughput
    )
  );

  const maxCloudEfficiency = Math.max(
    ...results.map(
      (r) => r.vmEfficiency
    )
  );

  const maxResourceEfficiency = Math.max(
    ...results.map(
      (r) => r.resourceUtilization
    )
  );

  for (const result of results) {
    const latencyScore =
      maxLatency > 0
        ? 1 -
          result.averageLatency /
            maxLatency
        : 1;

    const throughputScore =
      maxEdgeThroughput > 0
        ? result.edgeThroughput /
          maxEdgeThroughput
        : 0;

    const vmScore =
      maxCloudEfficiency > 0
        ? result.vmEfficiency /
          maxCloudEfficiency
        : 0;

    const resourceScore =
      maxResourceEfficiency > 0
        ? result.resourceUtilization /
          maxResourceEfficiency
        : 0;

    /*
     * Priority-aware contribution.
     */
    const priorityScore =
      result.prioritySatisfaction;

    /*
     * ECLO-inspired weighted score.
     *
     * Latency receives the largest weight,
     * followed by edge throughput and
     * resource efficiency.
     */
    const score =
      0.40 * latencyScore +
      0.20 * priorityScore +
      0.20 * throughputScore +
      0.10 * vmScore +
      0.10 * resourceScore;

    result.ecloScore =
      Math.max(
        0,
        Math.min(
          100,
          score * 100
        )
      );
  }
}

export function runSimulation(input) {
  const config = {
    tasks: Math.max(
      10,
      Number(input.tasks) || 200
    ),

    arrivalRate: Math.max(
      1,
      Number(input.arrivalRate) || 20
    ),

    edgeCapacity: Math.max(
      1,
      Number(input.edgeCapacity) || 30
    ),

    vmCapacity: Math.max(
      1,
      Number(input.vmCapacity) || 50
    ),

    initialVMs: Math.max(
      1,
      Number(input.initialVMs) || 1
    ),

    maxVMs: Math.max(
      1,
      Number(input.maxVMs) || 6
    ),

    threshold: Math.min(
      1,
      Math.max(
        0.1,
        Number(input.threshold) || 0.75
      )
    )
  };

  config.maxVMs = Math.max(
    config.maxVMs,
    config.initialVMs
  );

  /*
   * Generate ONE identical workload for
   * all algorithms.
   *
   * This is important for a fair comparison.
   */
  const tasks = generateTasks(
    config.tasks,
    config.arrivalRate
  );

  const staticResult =
    processSimulation(
      tasks,
      config,
      "static"
    );

  const dynamicResult =
    processSimulation(
      tasks,
      config,
      "dynamic"
    );

  const integratedResult =
    processSimulation(
      tasks,
      config,
      "integrated"
    );

  const adaptiveResult =
    processSimulation(
      tasks,
      config,
      "adaptive"
    );

  const rawResults = [
    staticResult,
    dynamicResult,
    integratedResult,
    adaptiveResult
  ];

  /*
   * Calculate ECLO after all algorithms
   * have been simulated.
   */
  calculateECLO(rawResults);

  function formatResult(result) {
    return {
      averageLatency:
        +result.averageLatency.toFixed(4),

      averageWaitingTime:
        +result.averageWaitingTime.toFixed(4),

      edgeThroughput:
        +result.edgeThroughput.toFixed(4),

      totalThroughput:
        +result.totalThroughput.toFixed(4),

      cloudUtilization:
        +(result.cloudUtilization * 100).toFixed(2),

      edgeUtilization:
        +(result.edgeUtilization * 100).toFixed(2),

      resourceUtilization:
        +(result.resourceUtilization * 100).toFixed(2),

      prioritySatisfaction:
        +(result.prioritySatisfaction * 100).toFixed(2),

      ecloScore:
        +result.ecloScore.toFixed(2),

      vmCount:
        result.vmCount,

      edgeTasks:
        result.edgeTasks,

      cloudTasks:
        result.cloudTasks,

      simulationTime:
        +result.simulationTime.toFixed(4)
    };
  }

  return {
    config,

    results: {
      Static: formatResult(staticResult),

      Dynamic: formatResult(dynamicResult),

      Integrated: formatResult(integratedResult),

      "Adaptive Integrated":
        formatResult(adaptiveResult)
    }
  };
}

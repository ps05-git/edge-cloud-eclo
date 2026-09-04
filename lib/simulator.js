function generateTasks(count, arrivalRate) {
  const tasks = [];
  let t = 0;
  for (let i = 0; i < count; i++) {
    t += Math.max(0.1, -Math.log(Math.random()) / Math.max(arrivalRate, 0.1));
    tasks.push({
      id: i + 1,
      arrivalTime: t,
      priority: Math.random() < 0.25 ? 1 : Math.random() < 0.47 ? 2 : 3
    });
  }
  return tasks;
}

function process(tasks, config, mode) {
  const edge = [];
  const cloud = [];
  let edgeFree = 0;
  let vmTimes = Array(Math.max(1, config.initialVMs)).fill(0);

  for (const task of tasks) {
    const high = task.priority === 1;
    let toEdge;

    if (mode === "static") toEdge = high;
    else if (mode === "dynamic") toEdge = task.priority <= 2;
    else if (mode === "integrated") toEdge = high || Math.random() < 0.55;
    else toEdge = high || vmTimes.reduce((a,b) => a+b, 0) / vmTimes.length < config.edgeCapacity * config.threshold;

    if (toEdge) {
      const start = Math.max(task.arrivalTime, edgeFree);
      const completion = start + 1 / config.edgeCapacity;
      edgeFree = completion;
      edge.push({ ...task, waiting: start-task.arrivalTime, completion, latency: completion-task.arrivalTime });
    } else {
      if (mode === "adaptive" && vmTimes.reduce((a,b) => a+b, 0) / vmTimes.length > config.vmCapacity * config.threshold && vmTimes.length < config.maxVMs) {
        vmTimes.push(0);
      }
      let v = 0;
      for (let i=1; i<vmTimes.length; i++) if (vmTimes[i] < vmTimes[v]) v=i;
      const start = Math.max(task.arrivalTime, vmTimes[v]);
      const completion = start + 1 / config.vmCapacity;
      vmTimes[v] = completion;
      cloud.push({ ...task, waiting: start-task.arrivalTime, completion, latency: completion-task.arrivalTime });
    }
  }

  const all = [...edge, ...cloud];
  const latency = all.reduce((s,t)=>s+t.latency,0) / Math.max(all.length,1);
  const waiting = all.reduce((s,t)=>s+t.waiting,0) / Math.max(all.length,1);
  const simTime = Math.max(...all.map(t=>t.completion),1);
  const throughput = edge.length / simTime;
  const work = cloud.reduce((s,t)=>s+(t.completion-t.waiting-t.arrivalTime),0);
  const utilization = Math.min(1, work / Math.max(simTime * vmTimes.length,1));
  const score = Math.max(0, Math.min(100, (0.6*Math.max(0,1-latency/2)+0.4*utilization)*100));

  return {
    averageLatency: +latency.toFixed(4),
    averageWaitingTime: +waiting.toFixed(4),
    edgeThroughput: +throughput.toFixed(4),
    cloudUtilization: +(utilization*100).toFixed(2),
    ecloScore: +score.toFixed(2),
    vmCount: vmTimes.length,
    edgeTasks: edge.length,
    cloudTasks: cloud.length
  };
}

export function runSimulation(input) {
  const config = {
    tasks: Math.max(10, Number(input.tasks)||200),
    arrivalRate: Math.max(1, Number(input.arrivalRate)||20),
    edgeCapacity: Math.max(1, Number(input.edgeCapacity)||30),
    vmCapacity: Math.max(1, Number(input.vmCapacity)||50),
    initialVMs: Math.max(1, Number(input.initialVMs)||1),
    maxVMs: Math.max(1, Number(input.maxVMs)||6),
    threshold: Math.min(1, Math.max(0.1, Number(input.threshold)||0.75))
  };
  config.maxVMs = Math.max(config.maxVMs, config.initialVMs);
  const tasks = generateTasks(config.tasks, config.arrivalRate);
  return {
    config,
    results: {
      Static: process(tasks, config, "static"),
      Dynamic: process(tasks, config, "dynamic"),
      Integrated: process(tasks, config, "integrated"),
      "Adaptive Integrated": process(tasks, config, "adaptive")
    }
  };
}
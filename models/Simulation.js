import mongoose from "mongoose";

const SimulationSchema = new mongoose.Schema(
  {
    algorithm: { type: String, required: true },
    config: {
      tasks: Number,
      arrivalRate: Number,
      edgeCapacity: Number,
      vmCapacity: Number,
      initialVMs: Number,
      maxVMs: Number,
      threshold: Number
    },
    metrics: {
      averageLatency: Number,
      averageWaitingTime: Number,
      edgeThroughput: Number,
      cloudUtilization: Number,
      ecloScore: Number,
      vmCount: Number,
      edgeTasks: Number,
      cloudTasks: Number
    }
  },
  { timestamps: true }
);

export default mongoose.models.Simulation ||
  mongoose.model("Simulation", SimulationSchema);
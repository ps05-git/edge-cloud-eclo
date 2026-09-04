import { NextResponse } from "next/server";
import connectDB from "../../../lib/mongodb";
import Simulation from "../../../models/Simulation";
import { runSimulation } from "../../../lib/simulator";

export async function POST(request) {
  try {
    const simulation = runSimulation(await request.json());
    await connectDB();
    for (const [algorithm, metrics] of Object.entries(simulation.results)) {
      await Simulation.create({ algorithm, config: simulation.config, metrics });
    }
    return NextResponse.json({ success: true, ...simulation });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
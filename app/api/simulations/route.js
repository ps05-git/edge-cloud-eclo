import { NextResponse } from "next/server";
import connectDB from "../../../lib/mongodb";
import Simulation from "../../../models/Simulation";

export async function GET() {
  try {
    await connectDB();
    const simulations = await Simulation.find().sort({ createdAt: -1 }).limit(20).lean();
    return NextResponse.json({ success: true, simulations });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
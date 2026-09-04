"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const initial = { tasks:200, arrivalRate:20, edgeCapacity:30, vmCapacity:50, initialVMs:1, maxVMs:6, threshold:0.75 };

export default function Home() {
  const [config,setConfig]=useState(initial), [results,setResults]=useState(null), [history,setHistory]=useState([]), [loading,setLoading]=useState(false), [error,setError]=useState("");

  async function loadHistory() {
    try { const r=await fetch("/api/simulations"); const d=await r.json(); if(d.success)setHistory(d.simulations); }
    catch(e){ console.error(e); }
  }

  async function runSimulation() {
    setLoading(true); setError("");
    try {
      const r=await fetch("/api/simulate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(config)});
      const d=await r.json();
      if(!r.ok||!d.success) throw new Error(d.error||"Simulation failed");
      setResults(d.results); await loadHistory();
    } catch(e){ setError(e.message); } finally { setLoading(false); }
  }

  useEffect(()=>{loadHistory()},[]);

  function set(field,value){setConfig(c=>({...c,[field]:Number(value)}));}

  const chart = results ? Object.entries(results).map(([algorithm,m])=>({algorithm,latency:m.averageLatency,waiting:m.averageWaitingTime,score:m.ecloScore})) : [];

  return <><header className="header"><div className="container"><h1>Edge-Cloud ECLO Scheduler</h1><p>Priority-Based Scheduling with Dynamic VM Allocation</p></div></header>
  <main className="container">
    <section className="card"><h2>Simulation Configuration</h2><div className="grid">
      {[
        ["Number of Tasks","tasks",10],["Arrival Rate (tasks/sec)","arrivalRate",1],["Edge Capacity (tasks/sec)","edgeCapacity",1],
        ["VM Capacity (tasks/sec)","vmCapacity",1],["Initial VMs","initialVMs",1],["Maximum VMs","maxVMs",1]
      ].map(([label,key,min])=><div className="field" key={key}><label>{label}</label><input type="number" min={min} value={config[key]} onChange={e=>set(key,e.target.value)}/></div>)}
      <div className="field"><label>VM Threshold</label><input type="number" min=".1" max="1" step=".05" value={config.threshold} onChange={e=>set("threshold",e.target.value)}/></div>
    </div><div className="button-row"><button className="primary-button" onClick={runSimulation} disabled={loading}>{loading?"Running Simulation...":"Run Simulation"}</button></div>{error&&<div className="error">{error}</div>}</section>

    {results&&<><section className="card"><h2>Simulation Results</h2><div className="metrics">
      <Metric title="Best ECLO Score" value={Math.max(...Object.values(results).map(x=>x.ecloScore))+"%"}/>
      <Metric title="Lowest Latency" value={Math.min(...Object.values(results).map(x=>x.averageLatency))+" s"}/>
      <Metric title="Highest Throughput" value={Math.max(...Object.values(results).map(x=>x.edgeThroughput))}/>
      <Metric title="Maximum VM Count" value={Math.max(...Object.values(results).map(x=>x.vmCount))}/>
    </div></section>
    <section className="card"><h2>Latency & Waiting Time Comparison</h2><div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="algorithm"/><YAxis/><Tooltip/><Legend/><Bar dataKey="latency" name="Latency"/><Bar dataKey="waiting" name="Waiting Time"/></BarChart></ResponsiveContainer></div></section>
    <section className="card"><h2>ECLO Score Comparison</h2><div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="algorithm"/><YAxis/><Tooltip/><Legend/><Bar dataKey="score" name="ECLO Score"/></BarChart></ResponsiveContainer></div></section>
    <section className="card"><h2>Detailed Results</h2><table className="history-table"><thead><tr><th>Algorithm</th><th>Latency</th><th>Waiting</th><th>Throughput</th><th>Utilization</th><th>VMs</th><th>ECLO</th></tr></thead><tbody>{Object.entries(results).map(([a,m])=><tr key={a}><td>{a}</td><td>{m.averageLatency}</td><td>{m.averageWaitingTime}</td><td>{m.edgeThroughput}</td><td>{m.cloudUtilization}%</td><td>{m.vmCount}</td><td>{m.ecloScore}%</td></tr>)}</tbody></table></section></>}

    <section className="card"><h2>MongoDB Simulation History</h2>{history.length===0?<p>No simulations saved yet.</p>:<table className="history-table"><thead><tr><th>Algorithm</th><th>Latency</th><th>ECLO Score</th><th>VMs</th><th>Date</th></tr></thead><tbody>{history.map(x=><tr key={x._id}><td>{x.algorithm}</td><td>{x.metrics?.averageLatency}</td><td>{x.metrics?.ecloScore}%</td><td>{x.metrics?.vmCount}</td><td>{x.createdAt?new Date(x.createdAt).toLocaleString():"-"}</td></tr>)}</tbody></table>}</section>
    <footer className="footer">Edge-Cloud Latency Optimization Simulation</footer>
  </main></>;
}

function Metric({title,value}){return <div className="metric"><div className="metric-title">{title}</div><div className="metric-value">{value}</div></div>}

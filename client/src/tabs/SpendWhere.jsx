import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { api, money } from '../api.js';
const COLORS=['#3E2F25','#5A4636','#8A7259','#C9A24B','#A88C6A','#6B5744'];
export default function SpendWhere() {
  const [data,setData]=useState(null),[est,setEst]=useState(null),[net,setNet]=useState('');
  useEffect(()=>{ api.get('/spend').then(setData); },[]);
  const run=async()=>setEst(await api.post('/tax/estimate',{ netSelfEmploymentCents:Math.round(Number(net)*100) }));
  if(!data) return <p className="text-sand">Loading…</p>;
  const pie=data.routing.map(r=>({ name:r.division, value:r.expenseCents/100 }));
  return (
    <div className="fade-in grid md:grid-cols-2 gap-6">
      <section className="card">
        <h2 className="text-xl mb-2">Spend Routing</h2>
        <p className="text-sand text-sm mb-3">Which division each dollar serves.</p>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
            {pie.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie>
            <Tooltip formatter={(v)=>`$${v.toLocaleString()}`}/></PieChart>
        </ResponsiveContainer>
      </section>
      <section className="card">
        <h2 className="text-xl mb-2">Michigan Quarterly Tax Estimator</h2>
        <input value={net} onChange={e=>setNet(e.target.value)} placeholder="Net self-employment income ($)"
          className="w-full border border-sand/30 rounded px-3 py-2 mb-3 bg-white/70"/>
        <button onClick={run} className="bg-espresso text-cream px-4 py-2 rounded">Estimate</button>
        {est && <div className="mt-4 text-sm space-y-1">
          <div>SE tax (15.3%): <b>{money(est.seTaxCents)}</b></div>
          <div>Federal income: <b>{money(est.federalIncomeCents)}</b></div>
          <div>Michigan (4.25%): <b>{money(est.michiganCents)}</b></div>
          <div className="text-gold">Per quarter: <b>{money(est.quarterlyCents)}</b></div>
          <div className="text-xs text-sand mt-2">Due: {est.dueDates.join(' · ')}</div>
          <p className="text-xs text-sand mt-2 italic">{est.disclaimer}</p>
        </div>}
      </section>
    </div>
  );
}

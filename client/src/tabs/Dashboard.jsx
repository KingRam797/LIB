import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api, money } from '../api.js';

export default function Dashboard() {
  const [nw,setNw]=useState(null),[inc,setInc]=useState(null),[mrr,setMrr]=useState(null),[xrp,setXrp]=useState(null);
  useEffect(()=>{ api.get('/networth').then(setNw); api.get('/income').then(setInc);
    api.get('/mrr').then(setMrr); api.get('/xrp').then(setXrp); },[]);
  if(!nw||!inc||!mrr) return <p className="text-sand">Counting…</p>;
  const data = nw.entries.map(e=>({ date:e.as_of, worth:e.amount_cents/100 }));
  data.push({ date:`${nw.targetYear}`, worth:nw.targetCents/100, target:true });
  return (
    <div className="fade-in grid md:grid-cols-2 gap-6">
      <section className="card md:col-span-2">
        <h2 className="text-2xl mb-1">The Trajectory</h2>
        <p className="text-sand text-sm mb-4">Toward $1,000,000 by {nw.targetYear} (age 55).</p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data}><XAxis dataKey="date" stroke="#8A7259"/><YAxis stroke="#8A7259"/>
            <Tooltip formatter={(v)=>`$${v.toLocaleString()}`}/>
            <Line type="monotone" dataKey="worth" stroke="#C9A24B" strokeWidth={3} dot/></LineChart>
        </ResponsiveContainer>
      </section>
      <section className="card">
        <h2 className="text-xl mb-2">Ownership vs. Income</h2>
        <p className="text-sand text-sm mb-3">Piketty tracker — asset income share should climb.</p>
        <div className="flex items-end gap-6">
          <div><div className="text-3xl text-gold">{inc.assetPct}%</div><div className="text-xs text-sand">Asset (r)</div></div>
          <div><div className="text-3xl text-mocha">{inc.laborPct}%</div><div className="text-xs text-sand">Labor</div></div>
        </div>
        <p className="mt-3 text-xs text-sand italic">{inc.note}</p>
      </section>
      <section className="card">
        <h2 className="text-xl mb-2">Voice MRR</h2>
        <div className="text-3xl text-gold">{money(mrr.latestCents)}</div>
        <p className="text-xs text-sand mt-1">Goal band {money(mrr.floorCents)}–{money(mrr.ceilCents)}/mo</p>
        <div className="mt-3 h-2 bg-sand/20 rounded"><div className="h-2 bg-gold rounded"
          style={{width:`${Math.min(100,mrr.latestCents/mrr.ceilCents*100)}%`}}/></div>
      </section>
      <section className="card md:col-span-2">
        <h2 className="text-xl mb-2">XRP Position</h2>
        {xrp?.position ? <p>{xrp.position.units} XRP · basis {money(xrp.position.cost_basis_cents||0)}</p>
          : <p className="text-sand">No position logged.</p>}
        <button className="mt-2 text-sm text-gold underline"
          onClick={()=>api.get('/xrp/price').then(d=>alert(d.usd?`XRP: $${d.usd}`:'Enter manually'))}>
          Fetch live price (CoinGecko free tier)</button>
      </section>
    </div>
  );
}

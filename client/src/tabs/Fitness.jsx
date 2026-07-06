import React, { useState } from 'react';
import { api } from '../api.js';
const DAYS=['Day 1 — Upper Density','Day 2 — Lower + Plyo','Day 3 — Conditioning / EMOM',
  'Day 4 — Full-Body Tempo','Day 5 — Optional Circuits'];
export default function Fitness() {
  const [plan,setPlan]=useState(null);
  const gen=async(dayType)=>setPlan(await api.post('/fitness/generate',{ dayType }));
  return (
    <div className="fade-in">
      <h2 className="text-2xl mb-1">Fitness</h2>
      <p className="text-mocha italic mb-5">RESPECT the body. RETURN daily. Make it RITUAL.</p>
      {/* Higgsfield iconography: client/public/assets/icon-respect.svg, icon-return.svg, icon-ritual.svg */}
      <div className="flex gap-2 flex-wrap mb-6">{DAYS.map(d=>(
        <button key={d} onClick={()=>gen(d)} className="border border-sand/30 rounded-full px-4 py-2 text-sm hover:bg-espresso hover:text-cream">{d}</button>))}</div>
      {plan?.workout && <div className="grid md:grid-cols-2 gap-6">
        <section className="card">
          <h3 className="text-xl mb-3">{plan.workout.day_type}</h3>
          {plan.workout.blocks.map((b,i)=>(<div key={i} className="mb-3">
            <div className="text-mocha font-medium">{b.name} · {b.sets}×</div>
            <ul className="text-sm text-espresso/90 list-disc ml-5">{b.items.map((it,j)=><li key={j}>{it}</li>)}</ul>
            <div className="text-xs text-sand">tempo {b.tempo} · rest {b.rest}</div></div>))}
        </section>
        <section className="card">
          <h3 className="text-xl mb-3">Fuel — ~{plan.totals.kcal} kcal / {plan.totals.protein} g protein</h3>
          {plan.meals.map(m=>(<div key={m.id} className="mb-2">
            <div className="text-mocha">{m.name}</div>
            <div className="text-xs text-sand">{m.kcal} kcal · {m.protein_g}g P · {m.carbs_g}g C · {m.fat_g}g F</div></div>))}
          <p className="text-xs text-sand mt-3 italic">{plan.pillars}</p>
        </section>
      </div>}
    </div>
  );
}

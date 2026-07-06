import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
export default function WealthMechanics() {
  const [cards,setCards]=useState([]),[i,setI]=useState(0);
  useEffect(()=>{ api.get('/facts').then(setCards); },[]);
  useEffect(()=>{ if(!cards.length) return;
    const t=setInterval(()=>setI(p=>(p+1)%cards.length),7000); return ()=>clearInterval(t); },[cards]);
  if(!cards.length) return <p className="text-sand">Loading the mechanics…</p>;
  const c=cards[i];
  return (
    <div className="fade-in">
      <h2 className="text-2xl mb-4">Wealth Mechanics</h2>
      {/* Higgsfield fact-card background: client/public/assets/factcard-bg.jpg */}
      <div key={i} className="card fade-in relative overflow-hidden min-h-[220px]"
        style={{backgroundImage:'url(/assets/factcard-bg.jpg)',backgroundSize:'cover'}}>
        <div className="relative">
          <p className="text-2xl leading-snug text-espresso">{c.fact}</p>
          <p className="mt-4 text-mocha italic">{c.principle}</p>
          <div className="mt-4 flex gap-3 text-xs text-sand">
            <span className="uppercase tracking-widest">{c.documentary}</span>
            <span>· pursuit: {c.pursuit}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-1 mt-4">{cards.map((_,idx)=>(
        <span key={idx} className={`h-1 flex-1 rounded ${idx===i?'bg-gold':'bg-sand/20'}`}/>))}</div>
    </div>
  );
}

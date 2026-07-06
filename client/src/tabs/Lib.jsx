import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
export default function Lib() {
  const [docs,setDocs]=useState([]),[open,setOpen]=useState(null);
  useEffect(()=>{ api.get('/lib').then(setDocs); },[]);
  const view=async(id)=>setOpen(await api.get(`/lib/${id}`));
  return (
    <div className="fade-in grid md:grid-cols-3 gap-6">
      <aside className="card">
        <h2 className="text-xl mb-3">LIB</h2>
        {docs.map(d=>(<button key={d.id} onClick={()=>view(d.id)}
          className="block text-left w-full py-2 text-mocha hover:text-espresso border-b border-sand/10">
          {d.title}<span className="block text-xs text-sand">{d.pursuit_tag}</span></button>))}
      </aside>
      <section className="card md:col-span-2">
        {open ? <><h3 className="text-2xl mb-3">{open.title}</h3>
          {open.sections.map(s=>(<div key={s.id} className="mb-4">
            <h4 className="text-lg text-mocha">{s.heading}</h4><p className="text-espresso/90">{s.body_md}</p></div>))}</>
          : <p className="text-sand">Select a living document. LIB surfaces knowledge by the pursuit you're working.</p>}
      </section>
    </div>
  );
}

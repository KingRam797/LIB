import React, { useState } from 'react';
import Dashboard from './tabs/Dashboard.jsx';
import WealthMechanics from './tabs/WealthMechanics.jsx';
import SpendWhere from './tabs/SpendWhere.jsx';
import Lib from './tabs/Lib.jsx';
import Fitness from './tabs/Fitness.jsx';

const TABS = [['Dashboard',Dashboard],['Wealth Mechanics',WealthMechanics],
  ['SpendWHERE',SpendWhere],['LIB',Lib],['Fitness',Fitness]];

export default function App() {
  const [i, setI] = useState(0);
  const Active = TABS[i][1];
  return (
    <div className="min-h-screen">
      {/* Higgsfield hero animation: client/public/assets/hero-counting-house.mp4 (poster hero-poster.jpg) */}
      <header className="relative overflow-hidden">
        <video className="absolute inset-0 w-full h-full object-cover opacity-40" autoPlay muted loop
          poster="/assets/hero-poster.jpg"><source src="/assets/hero-counting-house.mp4" type="video/mp4" /></video>
        <div className="relative px-8 py-14">
          <h1 className="text-5xl md:text-6xl text-espresso">The Counting House</h1>
          <p className="mt-2 text-mocha text-lg italic">Here, We Can Build.</p>
        </div>
      </header>
      <nav className="flex gap-1 px-8 border-b border-sand/20 flex-wrap">
        {TABS.map(([name],idx)=>(
          <button key={name} onClick={()=>setI(idx)}
            className={`px-5 py-3 text-sm tracking-wide ${i===idx?'border-b-2 border-gold text-espresso':'text-sand hover:text-mocha'}`}>
            {name}</button>))}
      </nav>
      <main className="px-8 py-8 max-w-6xl mx-auto"><Active /></main>
    </div>
  );
}

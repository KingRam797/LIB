import { Router } from 'express';
import { all } from '../db/index.js';
const r = Router();
// Day types map to seeded day_plans; meals assembled to hit ~2,700 kcal / ~160 g protein.
r.get('/exercises', async (_q,res)=> res.json(await all('SELECT * FROM workouts ORDER BY muscle_group')));
r.get('/week', async (_q,res)=> res.json(await all('SELECT * FROM day_plans')));
r.post('/generate', async (req, res) => {
  const { dayType, goal = 'endurance+lean-muscle' } = req.body;
  const plan = (await all('SELECT * FROM day_plans WHERE day_type=?', [dayType]))[0];
  const meals = await all('SELECT * FROM meals ORDER BY slot');
  // Pick one meal per slot to build a ~2,700 kcal / ~160 g protein day.
  const slots = ['breakfast','lunch','dinner','snack'];
  const chosen = slots.map(s => meals.find(m => m.slot === s)).filter(Boolean);
  const totals = chosen.reduce((t,m)=>({kcal:t.kcal+m.kcal,protein:t.protein+m.protein_g}),{kcal:0,protein:0});
  res.json({
    dayType, goal,
    workout: plan ? { ...plan, blocks: JSON.parse(plan.blocks_json) } : null,
    meals: chosen, totals,
    pillars: 'RESPECT the body you were given. RETURN to it daily. Make it RITUAL.'
  });
});
export default r;

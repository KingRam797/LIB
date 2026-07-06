// 25 lb DBs + bodyweight, advanced 170 lb trainee, endurance + lean muscle, 4–5 d/wk.
// Load-capped → density, tempo (e.g., 4-1-2 = 4s eccentric, 1s pause, 2s concentric),
// unilateral loading, mechanical drop sets, supersets/giant sets, high-rep thresholds,
// plyometrics, conditioning (EMOM/AMRAP/intervals). Basis: Schoenfeld et al. 2017 —
// hypertrophy "can be equally achieved across a spectrum of loading ranges" when taken near failure.
export const EXERCISES = [
  { name:'DB Floor Press', group:'chest', equipment:'25lb DBs', bw:false, progression:'Add reps to 20, then slow eccentric to 4-1-2, then 1.5-reps.' },
  { name:'Deficit Push-Up', group:'chest', equipment:'bodyweight', bw:true, progression:'Elevate feet → add tempo → rings/archer.' },
  { name:'DB Renegade Row', group:'back', equipment:'25lb DBs', bw:false, progression:'Add reps → pause at top → feet narrow.' },
  { name:'Inverted Row (under table/bar)', group:'back', equipment:'bodyweight', bw:true, progression:'Lower angle → tempo → single-arm.' },
  { name:'DB Bulgarian Split Squat', group:'legs', equipment:'25lb DBs', bw:false, progression:'Add reps → 4-1-2 tempo → deficit → 1.5-reps.' },
  { name:'DB Romanian Deadlift', group:'hamstrings', equipment:'25lb DBs', bw:false, progression:'Reps to 20 → single-leg → 3s eccentric.' },
  { name:'Pistol Squat Progression', group:'legs', equipment:'bodyweight', bw:true, progression:'Box → assisted → full → weighted with DB.' },
  { name:'DB Shoulder Press', group:'shoulders', equipment:'25lb DBs', bw:false, progression:'Reps → mechanical drop to lateral raise.' },
  { name:'Pike Push-Up', group:'shoulders', equipment:'bodyweight', bw:true, progression:'Elevate → tempo → wall handstand.' },
  { name:'DB Curl → Hammer Mechanical Drop', group:'arms', equipment:'25lb DBs', bw:false, progression:'Curl to failure, drop to hammer, drop to reverse.' },
  { name:'Bench Dip', group:'arms', equipment:'bodyweight', bw:true, progression:'Feet elevated → DB on lap → rings.' },
  { name:'DB Thruster', group:'full', equipment:'25lb DBs', bw:false, progression:'EMOM density → higher reps/min.' },
  { name:'Burpee', group:'conditioning', equipment:'bodyweight', bw:true, progression:'Add push-up → tuck jump → lateral.' },
  { name:'Jump Squat', group:'plyo', equipment:'bodyweight', bw:true, progression:'Height → single-leg → depth jump.' },
  { name:'Broad Jump', group:'plyo', equipment:'bodyweight', bw:true, progression:'Distance → consecutive → single-leg.' },
  { name:'DB Suitcase Carry', group:'core', equipment:'25lb DBs', bw:false, progression:'Distance → single 25 for anti-lateral flexion.' },
  { name:'Hollow Body Hold', group:'core', equipment:'bodyweight', bw:true, progression:'Time → hollow rocks → DB overhead.' },
  { name:'Interval Run', group:'conditioning', equipment:'none', bw:true, progression:'400m repeats → shorten rest → add reps.' }
];

export const DAY_PLANS = [
  { day_type:'Day 1 — Upper Density', goal:'endurance+lean-muscle', blocks:[
    { name:'Superset A', items:['DB Floor Press x15', 'Inverted Row x15'], sets:4, tempo:'3-1-1', rest:'60s' },
    { name:'Superset B', items:['DB Shoulder Press x12', 'Renegade Row x10/side'], sets:3, tempo:'2-0-2', rest:'60s' },
    { name:'Mechanical Drop', items:['DB Curl→Hammer→Reverse to failure'], sets:3, tempo:'controlled', rest:'75s' },
    { name:'Finisher EMOM 8', items:['Deficit Push-Up x8 every minute'], sets:8, tempo:'fast', rest:'remainder of minute' } ] },
  { day_type:'Day 2 — Lower + Plyo', goal:'endurance+lean-muscle', blocks:[
    { name:'A', items:['DB Bulgarian Split Squat x12/side'], sets:4, tempo:'4-1-2', rest:'75s' },
    { name:'B', items:['DB Romanian Deadlift x15'], sets:4, tempo:'3-1-1', rest:'75s' },
    { name:'Plyo Contrast', items:['Jump Squat x8','Broad Jump x5'], sets:4, tempo:'explosive', rest:'90s' },
    { name:'Core', items:['DB Suitcase Carry 40m','Hollow Hold 45s'], sets:3, tempo:'steady', rest:'45s' } ] },
  { day_type:'Day 3 — Conditioning / EMOM', goal:'endurance+lean-muscle', blocks:[
    { name:'EMOM 20 (alternating)', items:['Min1: DB Thruster x12','Min2: Burpee x12'], sets:10, tempo:'fast', rest:'remainder' },
    { name:'AMRAP 10', items:['Inverted Row x10','Push-Up x10','Jump Squat x10'], sets:1, tempo:'sustained', rest:'as needed' } ] },
  { day_type:'Day 4 — Full-Body Tempo', goal:'endurance+lean-muscle', blocks:[
    { name:'Giant Set', items:['DB Floor Press x12','Bulgarian Split Squat x10/side','Renegade Row x10/side'], sets:4, tempo:'4-1-2', rest:'90s' },
    { name:'Pike/Pistol Pair', items:['Pike Push-Up x10','Pistol Progression x6/side'], sets:3, tempo:'3-0-1', rest:'75s' },
    { name:'Core Finisher', items:['Hollow Rocks x20','Suitcase Carry 40m'], sets:3, tempo:'steady', rest:'45s' } ] },
  { day_type:'Day 5 — Optional Circuits', goal:'endurance+lean-muscle', blocks:[
    { name:'Interval Run', items:['6 x 400m'], sets:6, tempo:'hard', rest:'90s jog' },
    { name:'Bodyweight Circuit x3', items:['Burpee x12','Broad Jump x6','Bench Dip x15','Hollow Hold 40s'], sets:3, tempo:'flow', rest:'60s' } ] }
];

// Meals: day of one from each slot sums to ~2,700 kcal / ~160 g protein (0.9-1.0 g/lb at 170 lb;
// evidence: 1.6 g/kg ≈ 0.72-0.82 g/lb is the point of diminishing returns — this sits deliberately
// at the practical upper band for an advanced trainee).
export const MEALS = [
  { name:'Eggs + oats + Greek yogurt + berries', kcal:680, protein:45, carbs:70, fat:22, slot:'breakfast' },
  { name:'Chicken/rice bowl + avocado + veg', kcal:820, protein:55, carbs:80, fat:28, slot:'lunch' },
  { name:'Salmon or lean beef + potatoes + greens', kcal:850, protein:50, carbs:70, fat:34, slot:'dinner' },
  { name:'Protein shake + banana + almonds', kcal:360, protein:35, carbs:35, fat:12, slot:'snack' }
];

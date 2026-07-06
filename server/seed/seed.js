import { run } from '../db/index.js';
import { FACT_CARDS } from './factcards.js';
import { EXERCISES, DAY_PLANS, MEALS } from './fitness.js';
import { LIB_DOCS } from './lib.js';

export async function seed() {
  const pursuits = [
    ['mmm','MMM! multivitamin launch'],['spendwhere','SpendWHERE fintech'],
    ['voice','Voice architecture MRR'],['xrp','XRP position'],
    ['realestate','Michigan real estate license'],['linkedin','LinkedIn strategy'],
    ['grades','GRADES Act'],['retire55','Retirement at 55']
  ];
  for (const [key,name] of pursuits)
    await run('INSERT INTO pursuits (key,name,active) VALUES (?,?,1)', [key,name]);

  // Anchor data
  await run('INSERT INTO net_worth_entries (as_of,amount_cents,note) VALUES (?,?,?)',
    ['2026-01-01', 4200000, 'Opening snapshot']);
  await run('INSERT INTO net_worth_entries (as_of,amount_cents,note) VALUES (?,?,?)',
    ['2026-07-01', 5100000, 'Mid-year']);
  await run('INSERT INTO income_events (occurred_on,amount_cents,source_type,label) VALUES (?,?,?,?)',
    ['2026-06-01', 480000, 'labor', 'Voice architecture retainer']);
  await run('INSERT INTO income_events (occurred_on,amount_cents,source_type,label) VALUES (?,?,?,?)',
    ['2026-06-01', 90000, 'asset', 'XRP appreciation (realized)']);
  await run('INSERT INTO mrr_entries (as_of,mrr_cents,note) VALUES (?,?,?)', ['2026-06-01', 1800000, 'Voice MRR']);
  await run('INSERT INTO xrp_positions (units,cost_basis_cents,updated_at) VALUES (?,?,?)',
    [2500, 150000, '2026-06-01']);
  for (const d of ['Properties','Productions','Producers','Professionals','Projects','Products'])
    await run('INSERT INTO transactions (occurred_on,amount_cents,direction,division,memo) VALUES (?,?,?,?,?)',
      ['2026-06-15', 25000, 'expense', d, `Seed: ${d} ops`]);

  for (const f of FACT_CARDS)
    await run('INSERT INTO fact_cards (fact,documentary,principle,pursuit) VALUES (?,?,?,?)',
      [f.fact, f.documentary, f.principle, f.pursuit]);
  for (const e of EXERCISES)
    await run('INSERT INTO workouts (name,muscle_group,equipment,is_bodyweight,progression) VALUES (?,?,?,?,?)',
      [e.name, e.group, e.equipment, e.bw?1:0, e.progression]);
  for (const m of MEALS)
    await run('INSERT INTO meals (name,kcal,protein_g,carbs_g,fat_g,slot) VALUES (?,?,?,?,?,?)',
      [m.name, m.kcal, m.protein, m.carbs, m.fat, m.slot]);
  for (const d of DAY_PLANS)
    await run('INSERT INTO day_plans (day_type,goal,blocks_json) VALUES (?,?,?)',
      [d.day_type, d.goal, JSON.stringify(d.blocks)]);
  for (const doc of LIB_DOCS) {
    const res = await run('INSERT INTO lib_docs (title,pursuit_tag,updated_at) VALUES (?,?,?)',
      [doc.title, doc.pursuit, '2026-07-01']);
    const id = res.lastInsertRowid ?? res.rows?.[0]?.id ?? doc.id;
    let ord = 0;
    for (const s of doc.sections)
      await run('INSERT INTO lib_sections (doc_id,heading,body_md,ord) VALUES (?,?,?,?)',
        [id, s.heading, s.body, ord++]);
  }
}

import { Router } from 'express';
import { all } from '../db/index.js';
const r = Router();
r.get('/', async (req, res) => {
  const { pursuit } = req.query;
  const cards = pursuit
    ? await all('SELECT * FROM fact_cards WHERE pursuit=?', [pursuit])
    : await all('SELECT * FROM fact_cards');
  res.json(cards);
});
export default r;

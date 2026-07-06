import { Router } from 'express';
import { all } from '../db/index.js';
import { ah } from '../lib/http.js';
const r = Router();
r.get('/', ah(async (req, res) => {
  const { pursuit } = req.query;
  const cards = pursuit
    ? await all('SELECT * FROM fact_cards WHERE pursuit=?', [String(pursuit)])
    : await all('SELECT * FROM fact_cards');
  res.json(cards);
}));
export default r;

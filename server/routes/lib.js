import { Router } from 'express';
import { all } from '../db/index.js';
import { ah } from '../lib/http.js';
const r = Router();
r.get('/', ah(async (req, res) => {
  const { pursuit } = req.query;
  const docs = pursuit
    ? await all('SELECT * FROM lib_docs WHERE pursuit_tag=? ORDER BY updated_at DESC', [String(pursuit)])
    : await all('SELECT * FROM lib_docs ORDER BY updated_at DESC');
  res.json(docs);
}));
r.get('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'not found' });
  const doc = (await all('SELECT * FROM lib_docs WHERE id=?', [id]))[0];
  if (!doc) return res.status(404).json({ error: 'not found' });
  const sections = await all('SELECT * FROM lib_sections WHERE doc_id=? ORDER BY ord', [id]);
  res.json({ ...doc, sections });
}));
export default r;

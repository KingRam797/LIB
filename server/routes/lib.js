import { Router } from 'express';
import { all } from '../db/index.js';
const r = Router();
r.get('/', async (req, res) => {
  const { pursuit } = req.query;
  const docs = pursuit
    ? await all('SELECT * FROM lib_docs WHERE pursuit_tag=? ORDER BY updated_at DESC', [pursuit])
    : await all('SELECT * FROM lib_docs ORDER BY updated_at DESC');
  res.json(docs);
});
r.get('/:id', async (req, res) => {
  const doc = (await all('SELECT * FROM lib_docs WHERE id=?', [req.params.id]))[0];
  const sections = await all('SELECT * FROM lib_sections WHERE doc_id=? ORDER BY ord', [req.params.id]);
  res.json({ ...doc, sections });
});
export default r;

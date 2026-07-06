import { Router } from 'express';
import multer from 'multer';
import { all, run } from '../db/index.js';
const r = Router();
const upload = multer({ dest: 'server/uploads/' });
r.get('/', async (_q,res)=> res.json(await all('SELECT * FROM documents ORDER BY uploaded_at DESC')));
r.post('/', upload.single('file'), async (req, res) => {
  await run('INSERT INTO documents (filename,original_name,division,category,uploaded_at,size_bytes) VALUES (?,?,?,?,?,?)',
    [req.file.filename, req.file.originalname, req.body.division||null, req.body.category||null,
     new Date().toISOString().slice(0,10), req.file.size]);
  res.json({ ok: true });
});
export default r;

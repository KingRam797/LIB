import { Router } from 'express';
import multer from 'multer';
import { all, run } from '../db/index.js';
import { ah, bad } from '../lib/http.js';
const r = Router();
const upload = multer({ dest: 'server/uploads/', limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
r.get('/', ah(async (_q,res)=> res.json(await all('SELECT * FROM documents ORDER BY uploaded_at DESC'))));
r.post('/', upload.single('file'), ah(async (req, res) => {
  if (!req.file) return bad(res, "multipart field 'file' is required");
  await run('INSERT INTO documents (filename,original_name,division,category,uploaded_at,size_bytes) VALUES (?,?,?,?,?,?)',
    [req.file.filename, req.file.originalname, req.body.division||null, req.body.category||null,
     new Date().toISOString().slice(0,10), req.file.size]);
  res.json({ ok: true });
}));
export default r;

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import net from './routes/networth.js';
import income from './routes/income.js';
import mrr from './routes/mrr.js';
import xrp from './routes/xrp.js';
import spend from './routes/spend.js';
import tax from './routes/tax.js';
import docs from './routes/documents.js';
import lib from './routes/lib.js';
import facts from './routes/facts.js';
import fitness from './routes/fitness.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'The Counting House' }));

// Single-user auth: when APP_TOKEN is set (always set it in production),
// every /api route except /health requires Authorization: Bearer <token>.
// Runs before body parsing so unauthenticated payloads are never processed.
const APP_TOKEN = process.env.APP_TOKEN;
app.use('/api', (req, res, next) => {
  if (!APP_TOKEN) return next();
  const got = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (got === APP_TOKEN) return next();
  res.status(401).json({ error: 'unauthorized' });
});

app.use(express.json({ limit: '100kb' }));

app.use('/api/networth', net);
app.use('/api/income', income);
app.use('/api/mrr', mrr);
app.use('/api/xrp', xrp);
app.use('/api/spend', spend);
app.use('/api/tax', tax);
app.use('/api/documents', docs);
app.use('/api/lib', lib);
app.use('/api/facts', facts);
app.use('/api/fitness', fitness);

app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

// Central error handler: malformed JSON and multer limit violations are the
// client's fault (400); everything else logs and returns a generic 500.
app.use((err, _req, res, _next) => {
  const clientFault = err.type === 'entity.parse.failed' || err.name === 'MulterError';
  if (!clientFault) console.error(err);
  if (res.headersSent) return;
  if (clientFault) return res.status(400).json({ error: err.message });
  res.status(err.status || 500).json({ error: 'internal error' });
});

// Last-resort nets: log instead of letting Node terminate the process.
process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
process.on('uncaughtException', (e) => console.error('uncaughtException', e));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Counting House API on :${port}`));

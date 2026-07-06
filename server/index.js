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
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'The Counting House' }));
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

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Counting House API on :${port}`));

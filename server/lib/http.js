// Route hardening helpers. Express 4 does not catch rejected promises from
// async handlers — an uncaught rejection takes down the whole process — so
// every async route is wrapped with ah() to forward errors to the error
// middleware in server/index.js.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const bad = (res, msg) => res.status(400).json({ error: msg });

export const isIsoDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isIntCents = (n) => Number.isInteger(n) && Math.abs(n) <= 1e13; // |$100B| sanity ceiling

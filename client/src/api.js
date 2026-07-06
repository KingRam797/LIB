// When the server runs with APP_TOKEN set, every request needs the bearer
// token. It lives in localStorage; a 401 prompts once and retries.
const TOKEN_KEY = 'ch_token';
const headers = (extra = {}) => {
  const t = localStorage.getItem(TOKEN_KEY);
  return { ...extra, ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};
async function request(p, opts, retried = false) {
  const r = await fetch(`/api${p}`, { ...opts, headers: headers(opts.headers) });
  if (r.status === 401 && !retried) {
    const t = window.prompt('The Counting House — enter your access token:');
    if (t) { localStorage.setItem(TOKEN_KEY, t.trim()); return request(p, opts, true); }
  }
  return r.json();
}
export const api = {
  get: (p) => request(p, {}),
  post: (p, body) => request(p, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
};
export const money = (cents) => `$${(cents/100).toLocaleString(undefined,{maximumFractionDigits:0})}`;

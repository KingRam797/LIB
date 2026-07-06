export const api = {
  get: (p) => fetch(`/api${p}`).then(r => r.json()),
  post: (p, body) => fetch(`/api${p}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r => r.json())
};
export const money = (cents) => `$${(cents/100).toLocaleString(undefined,{maximumFractionDigits:0})}`;

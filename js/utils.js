export function $(id){ return document.getElementById(id); }

export function fmtTime(ts){
  try{ return new Date(ts).toLocaleString(); }catch(_){ return String(ts); }
}

export function safeText(v){
  const s = String(v ?? "").trim();
  return s ? s : "-";
}

export function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

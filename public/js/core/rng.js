let _seed = (Date.now() ^ 0x9e3779b9) >>> 0;

export function seed(n) {
  const v = Number(n);
  _seed = (isFinite(v) ? v : Date.now()) >>> 0;
  // Гарантируем, что _seed !== 0, иначе random() может вернуть 0 и gauss зациклится
  if (_seed === 0) _seed = 1;
}

export function random() {
  _seed = (_seed * 1664525 + 1013904223) >>> 0;
  // Защита: никогда не возвращаем 0 (иначе log(0) = -Infinity в gauss)
  return (_seed / 4294967296) || 1e-10;
}

export const randInt = (min, max) => {
  let lo = Number.isFinite(min) ? Math.ceil(min) : 0;
  let hi = Number.isFinite(max) ? Math.floor(max) : lo;
  if (lo > hi) [lo, hi] = [hi, lo];
  return Math.floor(random() * (hi - lo + 1)) + lo;
};

export const randFloat = (min, max) => {
  const lo = Number.isFinite(min) ? min : 0;
  const hi = Number.isFinite(max) ? max : lo + 1;
  return random() * (hi - lo) + lo;
};

export const pick = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  return arr[Math.floor(random() * arr.length)];
};

export function pickMany(arr, n) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const count = Math.min(Math.max(0, Math.floor(n) || 0), arr.length);
  if (count === 0) return [];
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(copy.splice(Math.floor(random() * copy.length), 1)[0]);
  }
  return out;
}

export const chance = (p) => {
  const prob = Number.isFinite(p) ? p : 0.5;
  return random() < prob;
};

export function gauss(mean = 0, sd = 1) {
  const m = Number.isFinite(mean) ? mean : 0;
  const s = Number.isFinite(sd) ? sd : 1;
  // Box-Muller с защитой от log(0) и деления на 0
  let u = random();
  let v = random();
  // random() уже гарантирует > 0, но на всякий случай
  if (u <= 0) u = 1e-10;
  if (v <= 0) v = 1e-10;
  return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function shuffle(arr) {
  if (!Array.isArray(arr)) return [];
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
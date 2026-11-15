export const clamp = (v, min, max) => {
  const n = typeof v === 'number' && isFinite(v) ? v : min;
  return Math.min(max, Math.max(min, n));
};

export const lerp = (a, b, t) => {
  const sa = typeof a === 'number' && isFinite(a) ? a : 0;
  const sb = typeof b === 'number' && isFinite(b) ? b : 0;
  const st = typeof t === 'number' && isFinite(t) ? t : 0;
  return sa + (sb - sa) * st;
};

export const round = (v, d = 2) => {
  if (!isFinite(v)) return 0;
  const p = 10 ** d;
  return Math.round(v * p) / p;
};

export function num(n) {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  const abs = Math.abs(n);
  const s = n < 0 ? '−' : '';
  if (abs >= 1e9) return s + (abs / 1e9).toFixed(2) + ' млрд';
  if (abs >= 1e6) return s + (abs / 1e6).toFixed(2) + ' млн';
  if (abs >= 1e3) return s + (abs / 1e3).toFixed(1) + ' тыс.';
  return s + Math.round(abs).toString();
}

export const int = (n) => {
  if (!isFinite(n)) return '—';
  return Math.round(n).toLocaleString('ru-RU');
};

export const money = (n) => {
  if (!isFinite(n)) return '—';
  return (n < 0 ? '−' : '') + '$ ' + num(Math.abs(n));
};

export const pct = (v, d = 1) => {
  if (!isFinite(v)) return '—';
  return (v * 100).toFixed(d) + '%';
};

export const pctRaw = (v, d = 1) => {
  if (!isFinite(v)) return '—';
  return v.toFixed(d) + '%';
};

export const signNum = (n, d = 2) => {
  if (!isFinite(n)) return '—';
  return (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(d);
};

export const deepClone = (o) => {
  if (o === undefined) return undefined;
  if (o === null) return null;
  try {
    return JSON.parse(JSON.stringify(o));
  } catch {
    return o;
  }
};

export const uid = () => Math.random().toString(36).slice(2, 10);

// ============================================================
// ДАТЫ — HOI4-стиль (с днями)
// ============================================================
export const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

// Родительный падеж — для отображения "1 января"
export const MONTHS_GENITIVE = [
  'января','февраля','марта','апреля','мая','июня',
  'июля','августа','сентября','октября','ноября','декабря'
];

// Короткие названия — именительный падеж
export const MONTHS_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

const safeMonth = (m) => {
  const v = Math.round(m);
  if (!isFinite(v) || v < 1 || v > 12) return 1;
  return v;
};

const safeDay = (d) => {
  const v = Math.round(d);
  if (!isFinite(v) || v < 1) return 1;
  return v;
};

/**
 * Полная дата с днём: "15 января 1936"
 * Если day отсутствует — "Январь 1936"
 */
export const dateStr = (d) => {
  if (!d) return '—';
  const m = safeMonth(d.month);
  const year = d.year || '—';
  if (d.day) {
    return `${safeDay(d.day)} ${MONTHS_GENITIVE[m - 1]} ${year}`;
  }
  return `${MONTHS[m - 1]} ${year}`;
};

/**
 * Короткая дата: "15 янв 1936"
 */
export const dateShort = (d) => {
  if (!d) return '—';
  const m = safeMonth(d.month);
  const year = d.year || '—';
  if (d.day) {
    return `${safeDay(d.day)} ${MONTHS_SHORT[m - 1]} ${year}`;
  }
  return `${MONTHS_SHORT[m - 1]} ${year}`;
};

/**
 * Количество дней в месяце (учитывает високосные годы)
 */
export const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

// ============================================================
// СУММЫ
// ============================================================
export const sum = (arr, f = (x) => x) => {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((a, b) => {
    const v = f(b);
    return a + (typeof v === 'number' && isFinite(v) ? v : 0);
  }, 0);
};

export const avg = (arr, f = (x) => x) => {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  return sum(arr, f) / arr.length;
};

// ============================================================
// ФЛАГИ
// ============================================================
export function flagStyle(flag) {
  const DEFAULT = { colors: ['#1e3a8a', '#ffffff', '#b91c1c'], pattern: 'horizontal' };
  const f = (flag && flag.colors && flag.colors.length >= 3) ? flag : DEFAULT;
  const [a, b, c] = f.colors;
  switch (f.pattern) {
    case 'vertical':   return `linear-gradient(90deg, ${a} 0 33.3%, ${b} 33.3% 66.6%, ${c} 66.6% 100%)`;
    case 'horizontal': return `linear-gradient(180deg, ${a} 0 33.3%, ${b} 33.3% 66.6%, ${c} 66.6% 100%)`;
    case 'bands':      return `linear-gradient(180deg, ${a} 0 25%, ${b} 25% 50%, ${a} 50% 75%, ${b} 75% 100%)`;
    case 'cross':      return `linear-gradient(90deg, transparent 42%, ${b} 42% 58%, transparent 58%), linear-gradient(180deg, transparent 42%, ${b} 42% 58%, transparent 58%), ${a}`;
    case 'canton':     return `linear-gradient(90deg, ${b} 0 38%, transparent 38%), linear-gradient(180deg, ${b} 0 52%, ${a} 52%)`;
    default:           return `linear-gradient(135deg, ${a}, ${b} 55%, ${c})`;
  }
}

// ============================================================
// СПАРКЛАЙН
// ============================================================
export function sparklineSVG(values, { width = 260, height = 56, color = '#e6b84c' } = {}) {
  if (!Array.isArray(values)) return '';
  const clean = values.filter(v => typeof v === 'number' && isFinite(v));
  if (clean.length < 2) return '';

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  const stepX = width / (clean.length - 1);
  const pts = clean.map((v, i) => [i * stepX, height - 4 - ((v - min) / range) * (height - 10)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${d} L ${width} ${height} L 0 ${height} Z`;

  const gradId = 'sg-' + uid();

  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#${gradId})"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;
}
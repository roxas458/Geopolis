import { el } from '../core/dom.js';
import { flagStyle, num, money, pct, sparklineSVG, int } from '../core/util.js';

const DEFAULT_FLAG = { colors: ['#1e3a8a', '#ffffff', '#b91c1c'], pattern: 'horizontal' };

function safeNum(v, fallback = 0) {
  return typeof v === 'number' && isFinite(v) ? v : fallback;
}

export function flagBox(country, cls = 'flag-box') {
  const flag = (country && country.flag) ? country.flag : DEFAULT_FLAG;
  let bg;
  try {
    bg = flagStyle(flag);
  } catch (err) {
    bg = flagStyle(DEFAULT_FLAG);
  }
  return el('div', { class: cls, style: { background: bg } });
}

export function card(title, ...children) {
  return el('div', { class: 'card' }, el('h3', {}, title), ...children);
}

export function statBig(value, label, delta) {
  return el('div', {},
    el('div', { class: 'stat-big' }, value),
    el('div', { class: 'stat-sub' }, label),
    delta !== undefined && delta !== null && isFinite(delta)
      ? el('div', { class: `stat-delta ${delta > 0 ? 'pos' : delta < 0 ? 'neg' : ''}` }, delta)
      : null
  );
}

export function kv(k, v) {
  return el('div', { class: 'kv' }, el('span', { class: 'k' }, k), el('span', { class: 'v' }, v));
}

export function bar(value, cls = '', max = 100) {
  const v = safeNum(value, 0);
  const m = safeNum(max, 100) || 1;
  const pctWidth = Math.max(0, Math.min(100, (v / m) * 100));
  return el('div', { class: `bar ${cls}` }, el('i', { style: { width: `${pctWidth}%` } }));
}

export function slider(label, value, max, onChange, format = (v) => v) {
  const safeValue = safeNum(value, 0);
  const safeMax = safeNum(max, 100) || 1;
  const head = el('div', { class: 'sr-head' },
    el('span', {}, label),
    el('span', { class: 'v' }, format(safeValue))
  );
  const input = el('input', {
    type: 'range',
    min: 0,
    max: Math.round(safeMax * 1000),
    value: Math.round(safeValue * 1000),
    oninput: (e) => {
      const v = Number(e.target.value) / 1000;
      if (Number.isFinite(v)) {
        const vLabel = head.querySelector('.v');
        if (vLabel) vLabel.textContent = format(v);
        onChange(v);
      }
    },
    onchange: () => { window.__uiBusy = false; },
  });

  const row = el('div', { class: 'slider-row' }, head, input);

  // Используем pointerdown/pointerup на window, чтобы __uiBusy гарантированно сбрасывался
  row.addEventListener('pointerdown', () => { window.__uiBusy = true; });
  return row;
}

// Глобальный сброс __uiBusy при отпускании указателя / потере фокуса / скрытии вкладки
if (typeof window !== 'undefined' && !window.__uiBusyHandlerAttached) {
  window.addEventListener('pointerup', () => { window.__uiBusy = false; }, true);
  window.addEventListener('pointercancel', () => { window.__uiBusy = false; }, true);
  window.addEventListener('blur', () => { window.__uiBusy = false; }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) window.__uiBusy = false;
  }, true);
  window.__uiBusyHandlerAttached = true;
}

export function sparkline(values) {
  const safeValues = Array.isArray(values) ? values.filter(v => typeof v === 'number' && isFinite(v)) : [];
  return el('div', { html: sparklineSVG(safeValues) });
}

export function listRow(left, right) {
  return el('div', { class: 'list-row' }, left, right);
}

export { num, money, pct, int, sparklineSVG };
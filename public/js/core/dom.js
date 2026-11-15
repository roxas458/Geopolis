export const qs = (sel, root = document) => {
  if (!root || !sel) return null;
  try { return root.querySelector(sel); } catch { return null; }
};

export const qsa = (sel, root = document) => {
  if (!root || !sel) return [];
  try { return [...root.querySelectorAll(sel)]; } catch { return []; }
};

function append(node, children) {
  if (!node) return;
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    try {
      node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    } catch (err) {
      console.warn('[Geopolis] append error:', err);
    }
  }
}

// FIX: свойства, которые надо ставить через node[k] = v, а не setAttribute
const DOM_PROPERTIES = new Set([
  'value', 'checked', 'selected', 'disabled', 'readOnly', 'multiple', 'textContent',
]);

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  if (!attrs || typeof attrs !== 'object') attrs = {};

  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;

    if (k === 'class') {
      node.className = v;
    } else if (k === 'html') {
      node.innerHTML = v;
    } else if (k === 'text') {
      node.textContent = v;
    } else if (k === 'style' && typeof v === 'object') {
      try { Object.assign(node.style, v); } catch (err) { /* ignore */ }
    } else if (k === 'dataset' && typeof v === 'object') {
      try { Object.assign(node.dataset, v); } catch (err) { /* ignore */ }
    } else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k.startsWith('on')) {
      // БЕЗОПАСНОСТЬ: не устанавливаем on* как строку (XSS)
      console.warn('[Geopolis] Пропущен не-функциональный обработчик:', k);
    } else if (DOM_PROPERTIES.has(k)) {
      // FIX: value/checked/disabled и т.п. — через свойство, а не атрибут
      try { node[k] = v; } catch (err) { /* ignore */ }
    } else {
      try { node.setAttribute(k, v); } catch (err) { /* ignore */ }
    }
  }

  append(node, children);
  return node;
}

export function clear(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function mount(parent, ...children) {
  if (!parent) return null;
  clear(parent);
  append(parent, children);
  return parent;
}

const MAX_TOASTS = 5;
const activeToasts = [];

export function toast(message, type = 'info', ms = 3400) {
  const box = document.getElementById('toast-container');
  if (!box) {
    console.log(`[toast:${type}] ${message}`);
    return;
  }

  // Ограничиваем количество одновременных тостов
  while (activeToasts.length >= MAX_TOASTS) {
    const old = activeToasts.shift();
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }

  const t = el('div', { class: `toast ${type}` }, message);
  box.appendChild(t);
  activeToasts.push(t);

  const removeToast = () => {
    const idx = activeToasts.indexOf(t);
    if (idx !== -1) activeToasts.splice(idx, 1);
    if (t.parentNode) t.parentNode.removeChild(t);
  };

  setTimeout(() => {
    // FIX: transition до opacity/transform + reflow, иначе анимация не играет
    t.style.transition = 'opacity .25s ease, transform .25s ease';
    void t.offsetWidth; // force reflow
    t.style.opacity = '0';
    t.style.transform = 'translateX(40px)';
  }, ms);
  setTimeout(removeToast, ms + 320);
}
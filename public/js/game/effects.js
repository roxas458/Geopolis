import { clamp } from '../core/util.js';

const CLAMP_100 = [
  'approval', 'discontent', 'stability', 'corruption', 'judicialIndependence',
  'pressFreedom', 'humanRights', 'minorityRights', 'educationLevel',
  'healthcareLevel', 'crimeRate', 'infrastructure', 'technology', 'happiness',
  'reputation', 'influence', 'presidentApproval',
];

const CLAMP_1 = ['literacy', 'inequality', 'shadowEconomy', 'poverty', 'unemployment'];

// ============================================================
// РЕЗОЛВЕР ВЛОЖЕННЫХ ПУТЕЙ (v2.6)
// 'taxes.income' → { obj: c.taxes, key: 'income' }
// 'goldStandard'  → { obj: c, key: 'goldStandard' }
// ============================================================
function resolvePath(c, path) {
  if (typeof path !== 'string' || !path.includes('.')) {
    return { obj: c, key: path };
  }
  const parts = path.split('.');
  let obj = c;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    // FIX: guard от массивов и примитивов
    if (!obj[part] || typeof obj[part] !== 'object' || Array.isArray(obj[part])) {
      obj[part] = {};
    }
    obj = obj[part];
  }
  return { obj, key: parts[parts.length - 1] };
}

// Очистка мусорных ключей с точкой (наследие старого бага set:{'taxes.income':...})
function cleanupDottedKeys(c) {
  for (const k of Object.keys(c)) {
    if (k.includes('.')) {
      try { delete c[k]; } catch (e) { /* ignore */ }
    }
  }
}

function applyToMilitary(c, effects) {
  if (!effects) return;
  if (!c.military) c.military = { personnel: 0, industry: 0, readiness: 0, mobilization: 0, budgetShare: 0 };

  if (effects.add) {
    for (const [k, v] of Object.entries(effects.add)) {
      if (typeof v === 'number' && isFinite(v)) {
        const cur = (c.military[k] || 0) + v;
        // FIX: budgetShare — доля 0–1, остальное 0–100
        if (k === 'personnel') c.military[k] = Math.max(0, cur);
        else if (k === 'budgetShare') c.military[k] = clamp(cur, 0, 1);
        else c.military[k] = clamp(cur, 0, 100);
      }
    }
  }
  if (effects.mul) {
    for (const [k, v] of Object.entries(effects.mul)) {
      if (typeof v === 'number' && isFinite(v)) {
        const cur = (c.military[k] || 0) * v;
        if (k === 'personnel') c.military[k] = Math.max(0, cur);
        else if (k === 'budgetShare') c.military[k] = clamp(cur, 0, 1);
        else c.military[k] = clamp(cur, 0, 100);
      }
    }
  }
}

export function applyEffects(c, effects = {}) {
  if (!c || !effects) return c;

  // === ADD ===
  if (effects.add) {
    for (const [k, v] of Object.entries(effects.add)) {
      if (k === 'military' && typeof v === 'object' && v !== null) {
        applyToMilitary(c, { add: v });
        continue;
      }

      if (!(typeof v === 'number' && isFinite(v))) continue;

      const { obj, key } = resolvePath(c, k);
      if (typeof obj[key] === 'number' || obj[key] === undefined) {
        obj[key] = (typeof obj[key] === 'number' ? obj[key] : 0) + v;
      }
    }
  }

  // === MUL ===
  if (effects.mul) {
    for (const [k, v] of Object.entries(effects.mul)) {
      if (k === 'military' && typeof v === 'object' && v !== null) {
        applyToMilitary(c, { mul: v });
        continue;
      }

      if (!(typeof v === 'number' && isFinite(v))) continue;

      const { obj, key } = resolvePath(c, k);
      if (typeof obj[key] === 'number') {
        obj[key] *= v;
      }
    }
  }

  // === SET ===
  if (effects.set) {
    for (const [k, v] of Object.entries(effects.set)) {
      if (k === 'military' && typeof v === 'object' && v !== null) {
        c.military = { ...c.military };
        for (const [mk, mv] of Object.entries(v)) {
          if (typeof mv === 'number' && isFinite(mv)) {
            if (mk === 'personnel') c.military[mk] = Math.max(0, mv);
            else if (mk === 'budgetShare') c.military[mk] = clamp(mv, 0, 1);
            else c.military[mk] = clamp(mv, 0, 100);
          }
        }
      } else if (typeof v === 'number' && isFinite(v)) {
        const { obj, key } = resolvePath(c, k);
        obj[key] = v;
      } else if (typeof v === 'boolean' || typeof v === 'string') {
        const { obj, key } = resolvePath(c, k);
        obj[key] = v;
      }
    }
  }

  // === НОРМАЛИЗАЦИЯ ===
  // 0–100
  for (const k of CLAMP_100) {
    if (typeof c[k] === 'number') c[k] = clamp(c[k], 0, 100);
  }

  // 0–1
  for (const k of CLAMP_1) {
    if (typeof c[k] === 'number') c[k] = clamp(c[k], 0, 1);
  }

  // Экономические показатели
  if (typeof c.inflation === 'number') c.inflation = clamp(c.inflation, -0.5, 3);
  // FIX: unemployment/poverty/literacy уже в CLAMP_1 — дубли убраны

  // Защита от NaN
  for (const k of ['gdp', 'gdpPerCapita', 'treasury', 'debt', 'wage', 'pension', 'socialBenefits', 'exports', 'imports', 'fdi', 'growth']) {
    if (typeof c[k] !== 'number' || !isFinite(c[k])) {
      c[k] = k === 'gdp' ? 1 : (k === 'gdpPerCapita' ? 100 : 0);
    }
  }

  // Население и площадь — не должны уходить в минус
  if (typeof c.population === 'number') c.population = Math.max(1000, c.population);
  if (typeof c.area === 'number') c.area = Math.max(100, c.area);

  // Treasury не должен уходить слишком глубоко в минус
  const gdpSafe = Math.max(c.gdp || 0, 0.001);
  if (typeof c.treasury === 'number') {
    c.treasury = Math.max(-gdpSafe * 0.2, c.treasury);
  }

  // Очистка мусорных ключей 'taxes.income' (наследие старого бага)
  cleanupDottedKeys(c);

  return c;
}
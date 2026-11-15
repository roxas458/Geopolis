// ============================================================
// v3.15: ИИ ДЛЯ AI-СТРАН
// Вызывается из engine.js runMonthlySystems для всех !isPlayer.
// ============================================================
import { setTax, setSpending, startProject, PROJECTS } from './economy.js';
import {
  setPoliceFunding, launchAntiCorruption, protestAction, strikeAction,
} from './society.js';
import { improveRelations, imposeSanctions, liftSanctions } from './diplomacy.js';
import { clamp } from '../core/util.js';

// ============================================================
// ЦЕЛЕВЫЕ ЗНАЧЕНИЯ ПО ИДЕОЛОГИИ
// ============================================================
const IDEOLOGY_TARGETS = {
  communist: {
    taxes: { income: 0.45, corporate: 0.35, vat: 0.15, property: 0.06, tariff: 0.20 },
    spending: { social: 0.060, education: 0.030, healthcare: 0.025, military: 0.020, infrastructure: 0.015, science: 0.008, agriculture: 0.012, industry: 0.015, other: 0.010 },
    policeFunding: 0.012,
    antiCorruption: false,
    protest: 'repress',
    strike: 'break',
    nationalize: true,
  },
  socialist: {
    taxes: { income: 0.40, corporate: 0.30, vat: 0.14, property: 0.05, tariff: 0.18 },
    spending: { social: 0.055, education: 0.028, healthcare: 0.022, military: 0.018, infrastructure: 0.014, science: 0.006, agriculture: 0.011, industry: 0.012, other: 0.009 },
    policeFunding: 0.010,
    antiCorruption: false,
    protest: 'concede',
    strike: 'negotiate',
    nationalize: true,
  },
  social_democrat: {
    taxes: { income: 0.35, corporate: 0.25, vat: 0.12, property: 0.04, tariff: 0.14 },
    spending: { social: 0.050, education: 0.025, healthcare: 0.020, military: 0.014, infrastructure: 0.014, science: 0.006, agriculture: 0.011, industry: 0.011, other: 0.009 },
    policeFunding: 0.009,
    antiCorruption: true,
    protest: 'concede',
    strike: 'negotiate',
    nationalize: false,
  },
  liberal: {
    taxes: { income: 0.20, corporate: 0.15, vat: 0.08, property: 0.02, tariff: 0.08 },
    spending: { social: 0.020, education: 0.018, healthcare: 0.014, military: 0.012, infrastructure: 0.015, science: 0.006, agriculture: 0.008, industry: 0.010, other: 0.008 },
    policeFunding: 0.007,
    antiCorruption: true,
    protest: 'concede',
    strike: 'negotiate',
    nationalize: false,
  },
  conservative: {
    taxes: { income: 0.22, corporate: 0.18, vat: 0.09, property: 0.03, tariff: 0.16 },
    spending: { social: 0.025, education: 0.016, healthcare: 0.013, military: 0.020, infrastructure: 0.014, science: 0.005, agriculture: 0.010, industry: 0.011, other: 0.009 },
    policeFunding: 0.010,
    antiCorruption: true,
    protest: 'repress',
    strike: 'break',
    nationalize: false,
  },
  nationalist: {
    taxes: { income: 0.25, corporate: 0.22, vat: 0.10, property: 0.03, tariff: 0.25 },
    spending: { social: 0.025, education: 0.015, healthcare: 0.012, military: 0.025, infrastructure: 0.014, science: 0.005, agriculture: 0.010, industry: 0.014, other: 0.008 },
    policeFunding: 0.012,
    antiCorruption: false,
    protest: 'repress',
    strike: 'break',
    nationalize: true,
  },
  centrist: {
    taxes: { income: 0.25, corporate: 0.22, vat: 0.10, property: 0.03, tariff: 0.15 },
    spending: { social: 0.030, education: 0.015, healthcare: 0.012, military: 0.015, infrastructure: 0.012, science: 0.004, agriculture: 0.010, industry: 0.010, other: 0.008 },
    policeFunding: 0.008,
    antiCorruption: true,
    protest: 'concede',
    strike: 'negotiate',
    nationalize: false,
  },
  monarchist: {
    taxes: { income: 0.28, corporate: 0.24, vat: 0.11, property: 0.05, tariff: 0.18 },
    spending: { social: 0.028, education: 0.014, healthcare: 0.012, military: 0.022, infrastructure: 0.013, science: 0.004, agriculture: 0.012, industry: 0.011, other: 0.008 },
    policeFunding: 0.011,
    antiCorruption: false,
    protest: 'repress',
    strike: 'break',
    nationalize: false,
  },
  agrarian: {
    taxes: { income: 0.22, corporate: 0.20, vat: 0.08, property: 0.03, tariff: 0.20 },
    spending: { social: 0.030, education: 0.014, healthcare: 0.011, military: 0.012, infrastructure: 0.012, science: 0.003, agriculture: 0.020, industry: 0.008, other: 0.008 },
    policeFunding: 0.007,
    antiCorruption: true,
    protest: 'concede',
    strike: 'negotiate',
    nationalize: false,
  },
  libertarian: {
    taxes: { income: 0.15, corporate: 0.10, vat: 0.05, property: 0.01, tariff: 0.05 },
    spending: { social: 0.010, education: 0.010, healthcare: 0.008, military: 0.008, infrastructure: 0.010, science: 0.004, agriculture: 0.006, industry: 0.008, other: 0.006 },
    policeFunding: 0.005,
    antiCorruption: true,
    protest: 'concede',
    strike: 'negotiate',
    nationalize: false,
  },
};

const DEFAULT_TARGET = IDEOLOGY_TARGETS.centrist;

function getTarget(c) {
  return IDEOLOGY_TARGETS[c.ideology] || DEFAULT_TARGET;
}

// ============================================================
// ЭКОНОМИКА: медленно двигаем налоги/расходы к цели
// ============================================================
const TAX_STEP = 0.01;
const SPEND_STEP = 0.001;

function moveTo(cur, target, step) {
  if (!Number.isFinite(cur)) return target;
  if (Math.abs(cur - target) < step) return target;
  return cur + Math.sign(target - cur) * step;
}

function aiEconomy(c) {
  const t = getTarget(c);
  if (!c.taxes) c.taxes = {};
  if (!c.spending) c.spending = {};

  for (const [k, v] of Object.entries(t.taxes)) {
    if (c.taxes[k] === undefined) c.taxes[k] = v;
    else c.taxes[k] = clamp(moveTo(c.taxes[k], v, TAX_STEP), 0, 0.75);
  }
  for (const [k, v] of Object.entries(t.spending)) {
    if (c.spending[k] === undefined) c.spending[k] = v;
    else c.spending[k] = clamp(moveTo(c.spending[k], v, SPEND_STEP), 0, 0.30);
  }
}

// ============================================================
// ПРОЕКТЫ: иногда запускаем
// ============================================================
function aiProjects(c) {
  if (!Array.isArray(PROJECTS) || !PROJECTS.length) return;
  if (Math.random() > 0.10) return; // 10% шанс в месяц
  const affordable = PROJECTS.filter(p => (c.treasury || 0) >= (p.cost || 0) * 1.5);
  if (!affordable.length) return;
  const pick = affordable[Math.floor(Math.random() * affordable.length)];
  try { startProject(c, pick.id); } catch (e) { /* ignore */ }
}

// ============================================================
// ПРОТЕСТЫ / ЗАБАСТОВКИ: реагируем по идеологии
// ============================================================
function aiUnrest(c) {
  const t = getTarget(c);
  for (const p of (c.protests || []).slice()) {
    // реагируем не на все, а с шансом 50% (чтобы не было мгновенно)
    if (Math.random() < 0.5) {
      try { protestAction(c, p.id, t.protest); } catch (e) { /* ignore */ }
    }
  }
  for (const s of (c.strikes || []).slice()) {
    if (Math.random() < 0.5) {
      try { strikeAction(c, s.id, t.strike); } catch (e) { /* ignore */ }
    }
  }
}

// ============================================================
// БЕЗОПАСНОСТЬ: полиция и антикоррупция
// ============================================================
function aiSecurity(c) {
  const t = getTarget(c);

  // полиция — медленно к цели
  const pf = Number.isFinite(c.policeFunding) ? c.policeFunding : 0.008;
  const newPf = clamp(moveTo(pf, t.policeFunding, 0.001), 0, 0.05);
  if (newPf !== pf) {
    try { setPoliceFunding(c, newPf); } catch (e) { /* ignore */ }
  }

  // антикоррупция — если коррупция > 50 и есть деньги, раз в 6 месяцев
  if (t.antiCorruption && (c.corruption || 0) > 50 && (c.treasury || 0) > (c.gdp || 1) * 0.01) {
    if (Math.random() < 0.15) {
      try { launchAntiCorruption(c); } catch (e) { /* ignore */ }
    }
  }
}

// ============================================================
// ДИПЛОМАТИЯ: раз в 2-3 месяца
// ============================================================
function aiDiplomacy(c, game) {
  if (Math.random() > 0.35) return; // ~35% шанс в месяц
  const others = (game.world.countries || []).filter(o => o.id !== c.id);
  if (!others.length) return;

  // союзники / друзья — улучшаем отношения
  const friends = others.filter(o => (c.relations?.[o.id] || 0) > 30);
  if (friends.length && Math.random() < 0.5) {
    const f = friends[Math.floor(Math.random() * friends.length)];
    try { improveRelations(c, f); } catch (e) { /* ignore */ }
    return;
  }

  // враги — санкции (если ещё нет)
  const enemies = others.filter(o => (c.relations?.[o.id] || 0) < -40);
  if (enemies.length && Math.random() < 0.3) {
    const e = enemies[Math.floor(Math.random() * enemies.length)];
    const hasSanctions = (c.sanctions || []).some(s => s.against === e.id);
    if (!hasSanctions) {
      try { imposeSanctions(c, e, game); } catch (err) { /* ignore */ }
    }
  }
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================
export function tickAI(c, game) {
  if (!c || !game) return;
  if (game.isPlayer(c.id)) return;
  // AI не должен трогать страны, у которых нет экономики
  if (!c.taxes || !c.spending) return;

  try { aiEconomy(c); } catch (e) { console.warn('[AI] economy error:', e); }
  try { aiProjects(c); } catch (e) { console.warn('[AI] projects error:', e); }
  try { aiUnrest(c); } catch (e) { console.warn('[AI] unrest error:', e); }
  try { aiSecurity(c); } catch (e) { console.warn('[AI] security error:', e); }
  try { aiDiplomacy(c, game); } catch (e) { console.warn('[AI] diplomacy error:', e); }
}
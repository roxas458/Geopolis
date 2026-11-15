import { clamp, lerp } from '../core/util.js';
import { random } from '../core/rng.js';

export const TAX_KEYS = ['income', 'corporate', 'vat', 'property', 'tariff'];
export const TAX_LABELS = {
  income: 'Подоходный налог',
  corporate: 'Налог на прибыль',
  vat: 'НДС / акцизы',
  property: 'Налог на имущество',
  tariff: 'Таможенные тарифы',
};

export const SPEND_KEYS = ['social', 'education', 'healthcare', 'military', 'infrastructure', 'science', 'agriculture', 'industry', 'other'];
export const SPEND_LABELS = {
  social: 'Социальные расходы',
  education: 'Образование',
  healthcare: 'Здравоохранение',
  military: 'Оборона',
  infrastructure: 'Инфраструктура',
  science: 'Наука',
  agriculture: 'Сельское хозяйство',
  industry: 'Промышленность',
  other: 'Прочие',
};

const DEFAULT_TAXES = { income: 0.25, corporate: 0.25, vat: 0.10, property: 0.03, tariff: 0.15 };

const DEFAULT_SPENDING = {
  social: 0.030,
  education: 0.015,
  healthcare: 0.012,
  military: 0.015,
  infrastructure: 0.012,
  science: 0.004,
  agriculture: 0.010,
  industry: 0.010,
  other: 0.008,
};

function safeNum(v, fallback = 0) {
  return typeof v === 'number' && isFinite(v) ? v : fallback;
}

function sanitizeCountry(c) {
  c.gdp = Math.max(0.001, safeNum(c.gdp, 1));
  c.gdpPerCapita = Math.max(0, safeNum(c.gdpPerCapita, 100));
  c.population = Math.max(1000, safeNum(c.population, 1000000));
  c.growth = clamp(safeNum(c.growth, 0), -0.5, 0.5);
  c.treasury = safeNum(c.treasury, 0);
  c.debt = Math.max(0, safeNum(c.debt, 0));
  c.inflation = clamp(safeNum(c.inflation, 0.005), -0.9, 5);
  c.unemployment = clamp(safeNum(c.unemployment, 0.05), 0, 1);
  c.poverty = clamp(safeNum(c.poverty, 0.3), 0, 1);
  c.wage = Math.max(0, safeNum(c.wage, 50));
  c.pension = Math.max(0, safeNum(c.pension, 20));
  c.socialBenefits = Math.max(0, safeNum(c.socialBenefits, 5));
  c.exports = Math.max(0, safeNum(c.exports, 0));
  c.imports = Math.max(0, safeNum(c.imports, 0));
  c.fdi = Math.max(0, safeNum(c.fdi, 0));
  c.interestRate = clamp(safeNum(c.interestRate, 0.02), 0, 0.5);
  c.budget = safeNum(c.budget, 0);
  c.shadowEconomy = clamp(safeNum(c.shadowEconomy, 0.15), 0, 1);
  c.corruption = clamp(safeNum(c.corruption, 30), 0, 100);

  c.goldReserves = Math.max(0, safeNum(c.goldReserves, c.gdp * 0.05));
  c.goldStandard = c.goldStandard !== false;
  c.foreignDebt = Math.max(0, safeNum(c.foreignDebt, c.gdp * 0.1));
  c.creditRating = clamp(safeNum(c.creditRating, 50), 0, 100);
  c.bankReserveRatio = clamp(safeNum(c.bankReserveRatio, 0.15), 0.05, 0.5);
  c.publicSectorShare = clamp(safeNum(c.publicSectorShare, 0.25), 0, 1);
  c.agricultureShare = clamp(safeNum(c.agricultureShare, 0.4), 0, 1);
  c.industryShare = clamp(safeNum(c.industryShare, 0.35), 0, 1);
  c.servicesShare = clamp(safeNum(c.servicesShare, 0.25), 0, 1);
  c.economicCycle = safeNum(c.economicCycle, 0);
  c.cyclePhase = c.cyclePhase || 'recovery';

  c.minimumWage = Math.max(0, safeNum(c.minimumWage, (c.wage || 50) * 0.4));
  c.pensionAge = clamp(safeNum(c.pensionAge, 65), 50, 80);
  c.pensionRate = clamp(safeNum(c.pensionRate, 0.35), 0.1, 0.8);
  c.exchangeRate = clamp(safeNum(c.exchangeRate, 1.0), 0.3, 3.0);
  c.cbIndependence = clamp(safeNum(c.cbIndependence, 50), 0, 100);
  c.cbRate = clamp(safeNum(c.cbRate, c.interestRate || 0.02), 0, 0.5);

  if (!c.taxes) c.taxes = { ...DEFAULT_TAXES };
  if (!c.spending) c.spending = { ...DEFAULT_SPENDING };
  for (const k of TAX_KEYS) c.taxes[k] = clamp(safeNum(c.taxes[k], DEFAULT_TAXES[k]), 0, 0.75);
  for (const k of SPEND_KEYS) c.spending[k] = clamp(safeNum(c.spending[k], DEFAULT_SPENDING[k]), 0, 0.30);
}

export function effectiveTaxRate(c) {
  const t = c.taxes || DEFAULT_TAXES;
  return (
    safeNum(t.income, 0.25) * 0.35 +
    safeNum(t.corporate, 0.25) * 0.25 +
    safeNum(t.vat, 0.10) * 0.20 +
    safeNum(t.property, 0.03) * 0.08 +
    safeNum(t.tariff, 0.15) * 0.12
  );
}

export function collectionEfficiency(c) {
  return clamp(
    0.96 - safeNum(c.corruption, 30) * 0.0055 - safeNum(c.shadowEconomy, 0.15) * 0.35,
    0.25, 1
  );
}

export function revenue(c) {
  const gdp = Math.max(0, safeNum(c.gdp, 0));
  let rev = gdp * effectiveTaxRate(c) * collectionEfficiency(c);
  const tariffShare = safeNum(c.taxes?.tariff, 0) * safeNum(c.imports, 0);
  rev += tariffShare * 0.5;
  return rev;
}

export function totalSpendingRate(c) {
  const s = c.spending || DEFAULT_SPENDING;
  return SPEND_KEYS.reduce((a, k) => a + safeNum(s[k], 0), 0);
}

export function spending(c) {
  return Math.max(0, safeNum(c.gdp, 0)) * totalSpendingRate(c);
}

export function interest(c) {
  return Math.max(0, safeNum(c.debt, 0)) * clamp(safeNum(c.interestRate, 0.02), 0, 0.5);
}

export function foreignInterest(c) {
  return Math.max(0, safeNum(c.foreignDebt, 0)) * 0.03;
}

export function annualBalance(c) {
  return revenue(c) - spending(c) - interest(c) - foreignInterest(c);
}

// ============================================================
// ЭКОНОМИЧЕСКИЙ ЦИКЛ
// ============================================================
export function tickCycle(c) {
  c.cyclePhase = c.cyclePhase || 'recovery';
  c.economicCycle = safeNum(c.economicCycle, 0);

  const drift = (random() - 0.5) * 0.02;
  c.economicCycle = clamp(c.economicCycle + drift, -1, 1);

  if (c.economicCycle > 0.5) c.cyclePhase = 'boom';
  else if (c.economicCycle > 0) c.cyclePhase = 'recovery';
  else if (c.economicCycle > -0.5) c.cyclePhase = 'recession';
  else c.cyclePhase = 'depression';
}

// ============================================================
// ОСНОВНОЙ ТИК
// ============================================================
export function tickEconomy(c, game) {
  sanitizeCountry(c);
  tickCycle(c);

  const stability = clamp(safeNum(c.stability, 50) / 100, 0, 1);
  const edu = clamp(safeNum(c.educationLevel, 30) / 100, 0, 1);
  const health = clamp(safeNum(c.healthcareLevel, 30) / 100, 0, 1);
  const corr = clamp(safeNum(c.corruption, 40) / 100, 0, 1);
  const infra = clamp(safeNum(c.infrastructure, 30) / 100, 0, 1);
  const tech = clamp(safeNum(c.technology, 30) / 100, 0, 1);
  const openness = (safeNum(c.exports, 0) + safeNum(c.imports, 0)) / Math.max(c.gdp, 1);

  // v3.15: демография и верховенство права
  const workforce = clamp(safeNum(c.ageStructure?.adults, 55) / 100, 0, 1);
  const elderly = clamp(safeNum(c.ageStructure?.elderly, 15) / 100, 0, 1);
  const rol = clamp(safeNum(c.ruleOfLaw, 50) / 100, 0, 1);
  const jud = clamp(safeNum(c.judicialIndependence, 40) / 100, 0, 1);
  const press = clamp(safeNum(c.pressFreedom, 40) / 100, 0, 1);

  const cycleEffect = c.economicCycle * 0.004;
  const goldEffect = c.goldStandard ? -0.0005 : 0.0008;

  let growth =
    0.0016 +
    edu * 0.0014 +
    health * 0.0010 +
    infra * 0.0016 +
    tech * 0.0016 -
    corr * 0.0018 +
    Math.min(openness, 1) * 0.0009 +
    (stability - 0.5) * 0.0022 +
    safeNum(c.spending.science, 0) * 0.05 +
    safeNum(c.spending.industry, 0) * 0.02 +
    safeNum(c.spending.agriculture, 0) * 0.01 +
    cycleEffect +
    goldEffect;

  // v3.15: демография → рост (рабочая сила)
  growth += (workforce - 0.55) * 0.0015;      // ±0.0007
  // v3.15: верховенство права → рост (доверие инвесторов)
  growth += (rol - 0.5) * 0.0012;             // ±0.0006
  // v3.15: независимость судов → рост
  growth += (jud - 0.4) * 0.0006;             // ±0.0004
  // v3.15: свобода прессы → рост (прозрачность)
  growth += (press - 0.4) * 0.0004;           // ±0.0003

  if (safeNum(c.inflation, 0) > 0.15) growth -= 0.002;
  if (c.gdp > 0 && c.debt > c.gdp * 1.2) growth -= 0.0015;
  if (c.gdp > 0 && c.foreignDebt > c.gdp * 0.5) growth -= 0.001;
  if (c.publicSectorShare > 0.5) growth -= 0.0008;

  const tariffLevel = safeNum(c.taxes?.tariff, 0.15);
  if (tariffLevel > 0.3) growth -= 0.0005 * (tariffLevel - 0.3) * 10;

  growth = clamp(growth, -0.03, 0.035);

  c.gdp = Math.max(0.001, c.gdp * (1 + growth));
  c.growth = growth;
  c.gdpPerCapita = (c.gdp * 1e9) / Math.max(c.population, 1);

  // бюджет
  const rev = revenue(c);
  const exp = spending(c);
  const intr = interest(c);
  const fintr = foreignInterest(c);
  c.budget = rev - exp - intr - fintr;
  const monthly = c.budget / 12;

  c.treasury += monthly;
  if (c.treasury < 0) {
    c.debt += -c.treasury;
    c.treasury = 0;
  } else if (c.debt > 0) {
    const repay = Math.min(c.treasury, c.debt * 0.02);
    c.debt -= repay;
    c.treasury -= repay;
  }
  c.debt = Math.max(0, c.debt);

  // инфляция
  const deficitRatio = -c.budget / Math.max(c.gdp, 1);
  let targetInflation =
    0.005 +
    deficitRatio * 0.35 -
    (c.interestRate - 0.02) * 0.25 +
    (c.growth < 0 ? 0.01 : 0) -
    0.01 * (safeNum(c.technology, 30) / 100);

  if (c.goldStandard) targetInflation -= 0.005;

  targetInflation = clamp(targetInflation, -0.04, 0.6);
  c.inflation = lerp(c.inflation, targetInflation, 0.12);

  // безработица
  const natural = 0.045 + safeNum(c.corruption, 30) * 0.0006 + (1 - edu) * 0.03;
  const cycleUnemp = c.economicCycle < 0 ? -c.economicCycle * 0.05 : 0;
  const targetUnemp = clamp(natural - c.growth * 1.8 + (1 - stability) * 0.04 + cycleUnemp, 0.015, 0.45);
  c.unemployment = lerp(c.unemployment, targetUnemp, 0.1);

  // v3.15: верховенство права → безработица (формальная занятость)
  c.unemployment = clamp(c.unemployment - (rol - 0.5) * 0.02, 0, 1);

  // зарплаты, пенсии
  const realWageTarget = c.gdpPerCapita * (0.42 + (1 - c.unemployment) * 0.12);
  c.wage = lerp(c.wage, realWageTarget, 0.08);
  c.pension = lerp(c.pension, c.wage * (0.28 + safeNum(c.spending.social, 0) * 3.5), 0.08);
  c.socialBenefits = lerp(c.socialBenefits, c.wage * (0.08 + safeNum(c.spending.social, 0) * 2), 0.08);

  const povertyTarget = clamp(
    0.65 - c.gdpPerCapita / 16000 - safeNum(c.spending.social, 0) * 2.4 + c.unemployment * 0.55 + c.inflation * 0.25,
    0.01, 0.85
  );
  c.poverty = lerp(c.poverty, povertyTarget, 0.08);

  // торговля
  const tariffEffect = 1 - safeNum(c.taxes?.tariff, 0.15) * 0.8;
  const exportTarget = c.gdp * (0.07 + (safeNum(c.technology, 30) / 100) * 0.06 + Math.min(openness, 1) * 0.03);
  const importTarget = c.gdp * (0.06 + (c.gdpPerCapita / 30000) * 0.09) * tariffEffect;
  c.exports = lerp(c.exports, exportTarget, 0.1);
  c.imports = lerp(c.imports, importTarget, 0.1);
  c.fdi = lerp(c.fdi, c.gdp * (0.008 + (1 - safeNum(c.corruption, 30) / 100) * 0.025), 0.05);

  // золото
  const goldTarget = c.goldStandard ? c.gdp * 0.05 : c.gdp * 0.02;
  c.goldReserves = lerp(c.goldReserves, goldTarget, 0.02);

  // рейтинг (FIX: cbIndependence влияет здесь, а не отдельно)
  const ratingTarget = clamp(
    50 +
    (1 - c.debt / Math.max(c.gdp, 1)) * 30 +
    (c.budget >= 0 ? 10 : -10) +
    (c.goldStandard ? 5 : 0) -
    (c.foreignDebt / Math.max(c.gdp, 1)) * 20 +
    ((c.cbIndependence || 50) - 50) * 0.02,
    5, 95
  );
  c.creditRating = lerp(c.creditRating, ratingTarget, 0.01);

  // структура
  const devLevel = clamp(c.gdpPerCapita / 15000, 0, 1);
  const agTarget = clamp(0.5 - devLevel * 0.3, 0.05, 0.6);
  const indTarget = clamp(0.3 + devLevel * 0.1, 0.2, 0.45);
  const servTarget = clamp(1 - agTarget - indTarget, 0.15, 0.6);
  c.agricultureShare = lerp(c.agricultureShare, agTarget, 0.005);
  c.industryShare = lerp(c.industryShare, indTarget, 0.005);
  c.servicesShare = lerp(c.servicesShare, servTarget, 0.005);

  // ============================================================
  // МИНИМАЛЬНАЯ ЗАРПЛАТА
  // ============================================================
  const mwTarget = c.wage * 0.4;
  c.minimumWage = lerp(c.minimumWage || mwTarget, mwTarget, 0.05);
  const mwRatio = (c.minimumWage || 0) / Math.max(c.wage || 1, 1);
  c.poverty = clamp(c.poverty - (mwRatio - 0.4) * 0.05, 0, 1);
  c.unemployment = clamp(c.unemployment + (mwRatio - 0.4) * 0.03, 0, 1);
  c.approval = clamp((c.approval || 50) + (mwRatio - 0.4) * 2, 0, 100);

  // ============================================================
  // ПЕНСИОННАЯ СИСТЕМА
  // ============================================================
  const pensionTarget = c.wage * (c.pensionRate || 0.35) * (c.pensionAge <= 65 ? 1.1 : 0.95);
  c.pension = lerp(c.pension || 0, pensionTarget, 0.08);
  c.approval = clamp((c.approval || 50) + (c.pensionRate - 0.35) * 8, 0, 100);
  c.lifeExpectancy = clamp((c.lifeExpectancy || 50) + (c.pensionAge - 65) * 0.02, 20, 100);

  // v3.15: демография → пенсионная нагрузка на бюджет
  // (elderly > 15% → расходы social растут медленно, чтобы покрыть пенсии)
  const pensionPressure = (elderly - 0.15) * 0.5; // ±0.075
  if (pensionPressure > 0) {
    c.treasury = Math.max(0, c.treasury - c.gdp * pensionPressure * 0.001);
  }

  // ============================================================
  // КУРС ВАЛЮТЫ
  // ============================================================
  const erTarget = c.goldStandard ? 1.0 : (c.inflation > 0.1 ? 0.8 : 1.0);
  c.exchangeRate = lerp(c.exchangeRate || 1.0, erTarget, 0.01);
  const erDelta = (c.exchangeRate || 1.0) - 1.0;
  c.exports = (c.exports || 0) * (1 - erDelta * 0.3);
  c.imports = (c.imports || 0) * (1 + erDelta * 0.2);

  // ============================================================
  // ЦЕНТРАЛЬНЫЙ БАНК
  // ============================================================
  const cbTargetInflation = 0.02 + (100 - (c.cbIndependence || 50)) * 0.0005;
  const cbInflationEffect = (cbTargetInflation - (c.inflation || 0)) * ((c.cbIndependence || 50) / 100) * 0.1;
  c.inflation = clamp((c.inflation || 0) + cbInflationEffect, -0.9, 5);

  sanitizeCountry(c);
}

// ============================================================
// СЕТТЕРЫ
// ============================================================
export function setTax(c, key, value) {
  if (!TAX_KEYS.includes(key)) return;
  if (!c.taxes) c.taxes = { ...DEFAULT_TAXES };
  c.taxes[key] = clamp(value, 0, 0.75);
}

export function setSpending(c, key, value) {
  if (!SPEND_KEYS.includes(key)) return;
  if (!c.spending) c.spending = { ...DEFAULT_SPENDING };
  c.spending[key] = clamp(value, 0, 0.30);
}

export function setInterestRate(c, value) {
  c.interestRate = clamp(value, 0, 0.5);
}

export function setGoldStandard(c, on) {
  c.goldStandard = !!on;
}

export function setBankReserveRatio(c, value) {
  c.bankReserveRatio = clamp(value, 0.05, 0.5);
}

export function setMinimumWage(c, value) {
  c.minimumWage = clamp(value, 0, (c.wage || 100) * 1.5);
}

export function setPensionAge(c, value) {
  c.pensionAge = clamp(value, 50, 80);
}

export function setPensionRate(c, value) {
  c.pensionRate = clamp(value, 0.1, 0.8);
}

export function setCbIndependence(c, value) {
  c.cbIndependence = clamp(value, 0, 100);
}

export function setCbChairman(c, person) {
  c.cbChairman = person || null;
}

export function devalueCurrency(c, percent = 10) {
  const p = clamp(percent, 1, 50) / 100;
  c.exchangeRate = clamp((c.exchangeRate || 1) * (1 - p), 0.3, 3.0);
  c.inflation = clamp((c.inflation || 0) + p * 0.5, -0.9, 5);
  c.exports = (c.exports || 0) * (1 + p * 0.5);
  c.imports = (c.imports || 0) * (1 + p * 0.3);
  c.approval = clamp((c.approval || 50) - 3, 0, 100);
  return { ok: true };
}

export function revalueCurrency(c, percent = 10) {
  const p = clamp(percent, 1, 50) / 100;
  c.exchangeRate = clamp((c.exchangeRate || 1) * (1 + p), 0.3, 3.0);
  c.inflation = clamp((c.inflation || 0) - p * 0.3, -0.9, 5);
  c.exports = (c.exports || 0) * (1 - p * 0.3);
  c.imports = (c.imports || 0) * (1 - p * 0.2);
  c.approval = clamp((c.approval || 50) + 2, 0, 100);
  return { ok: true };
}

export function adjustBudgetBalanced(c) {
  const rev = revenue(c);
  if (!c.spending) c.spending = { ...DEFAULT_SPENDING };
  const others = SPEND_KEYS.filter(k => k !== 'other');
  const sumOthers = others.reduce((a, k) => a + safeNum(c.spending[k], 0), 0);
  c.spending.other = clamp(rev / Math.max(c.gdp, 1) - sumOthers, 0, 0.3);
}

// ============================================================
// ГОСУДАРСТВЕННЫЕ ПРОЕКТЫ
// ============================================================
export const PROJECTS = [
  { id: 'dam',      name: 'Плотина',    cost: 0.05, effect: { infrastructure: 5, growth: 0.0005 }, desc: 'Строительство плотины: +5 инфраструктуры, ускорение роста' },
  { id: 'road',     name: 'Шоссе',      cost: 0.02, effect: { infrastructure: 3 },                 desc: 'Строительство дорог: +3 инфраструктуры' },
  { id: 'factory',  name: 'Завод',      cost: 0.10, effect: { technology: 3, growth: 0.001 },      desc: 'Промышленный завод: +3 технологий, +0.1% рост' },
  { id: 'school',   name: 'Школа',      cost: 0.02, effect: { educationLevel: 2 },                 desc: 'Новая школа: +2 образование' },
  { id: 'hospital', name: 'Больница',   cost: 0.03, effect: { healthcareLevel: 2 },                desc: 'Новая больница: +2 здравоохранение' },
  { id: 'port',     name: 'Порт',       cost: 0.06, effect: { exports: 0.02, growth: 0.0005 },     desc: 'Морской порт: +2% экспорт, ускорение роста' },
];

export function startProject(c, projectId) {
  const project = PROJECTS.find(p => p.id === projectId);
  if (!project) return { ok: false, reason: 'Проект не найден' };
  if ((c.treasury || 0) < project.cost) return { ok: false, reason: 'Недостаточно средств в казне' };

  c.treasury -= project.cost;
  if (project.effect.infrastructure) c.infrastructure = clamp((c.infrastructure || 0) + project.effect.infrastructure, 0, 100);
  if (project.effect.technology) c.technology = clamp((c.technology || 0) + project.effect.technology, 0, 100);
  if (project.effect.educationLevel) c.educationLevel = clamp((c.educationLevel || 0) + project.effect.educationLevel, 0, 100);
  if (project.effect.healthcareLevel) c.healthcareLevel = clamp((c.healthcareLevel || 0) + project.effect.healthcareLevel, 0, 100);
  if (project.effect.growth) c.growth = (c.growth || 0) + project.effect.growth;
  if (project.effect.exports) {
    const e = project.effect.exports;
    if (e > 1) {
      c.exports = (c.exports || 0) + e;
    } else {
      c.exports = Math.max(0, (c.exports || 0)) * (1 + e);
    }
  }

  return { ok: true, project };
}

// ============================================================
// НАЦИОНАЛИЗАЦИЯ / ПРИВАТИЗАЦИЯ
// ============================================================
export function nationalize(c) {
  if ((c.treasury || 0) < 0.05) return { ok: false, reason: 'Недостаточно средств' };
  c.treasury -= 0.05;
  c.publicSectorShare = clamp((c.publicSectorShare || 0.25) + 0.1, 0, 1);
  c.corruption = clamp((c.corruption || 30) + 2, 0, 100);
  c.unemployment = clamp((c.unemployment || 0.07) + 0.005, 0, 1);
  c.approval = clamp((c.approval || 50) + 2, 0, 100);
  return { ok: true };
}

export function privatize(c) {
  if ((c.publicSectorShare || 0.25) <= 0.1) return { ok: false, reason: 'Нечего приватизировать' };
  c.treasury = (c.treasury || 0) + 0.15;
  c.publicSectorShare = clamp((c.publicSectorShare || 0.25) - 0.1, 0, 1);
  c.unemployment = clamp((c.unemployment || 0.07) + 0.01, 0, 1);
  c.inequality = clamp((c.inequality || 0.4) + 0.02, 0, 1);
  c.approval = clamp((c.approval || 50) - 2, 0, 100);
  return { ok: true };
}

// ============================================================
// СТАТИСТИКА
// ============================================================
export function computeEconomicStats(c) {
  return {
    gdp: c.gdp,
    gdpPerCapita: c.gdpPerCapita,
    growth: c.growth,
    inflation: c.inflation,
    unemployment: c.unemployment,
    poverty: c.poverty,
    debtRatio: (c.debt || 0) / Math.max(c.gdp, 1),
    foreignDebtRatio: (c.foreignDebt || 0) / Math.max(c.gdp, 1),
    goldReserves: c.goldReserves,
    goldStandard: c.goldStandard,
    creditRating: c.creditRating,
    publicSectorShare: c.publicSectorShare,
    agricultureShare: c.agricultureShare,
    industryShare: c.industryShare,
    servicesShare: c.servicesShare,
    cyclePhase: c.cyclePhase,
    economicCycle: c.economicCycle,
    minimumWage: c.minimumWage,
    pensionAge: c.pensionAge,
    pensionRate: c.pensionRate,
    exchangeRate: c.exchangeRate,
    cbIndependence: c.cbIndependence,
    cbRate: c.cbRate,
  };
}

export { safeNum, sanitizeCountry, DEFAULT_TAXES, DEFAULT_SPENDING };
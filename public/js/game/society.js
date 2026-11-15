import { clamp, lerp } from '../core/util.js';
import { gauss } from '../core/rng.js';

function safeNum(v, fallback = 0) {
  return typeof v === 'number' && isFinite(v) ? v : fallback;
}

// ============================================================
// v3.14: ВНУТРЕННЯЯ БЕЗОПАСНОСТЬ И ПРАВОВАЯ СИСТЕМА
// ============================================================
const IMMIGRATION_POLICIES = ['open', 'balanced', 'restricted', 'closed'];
const PROTEST_CAUSES = ['poverty', 'unemployment', 'corruption', 'repression', 'inequality', 'war'];
const STRIKE_SECTORS = ['industry', 'transport', 'mining', 'agriculture', 'services'];

// v3.15: export — вызывается из state.js (sanitizeCountry)
export function sanitizeSociety(c) {
  c.population = Math.max(1000, safeNum(c.population, 1000000));
  c.birthRate = clamp(safeNum(c.birthRate, 20), 0, 60);
  c.deathRate = clamp(safeNum(c.deathRate, 15), 0, 60);
  c.migrationRate = clamp(safeNum(c.migrationRate, 0), -10, 10);
  c.lifeExpectancy = clamp(safeNum(c.lifeExpectancy, 50), 20, 100);
  c.literacy = clamp(safeNum(c.literacy, 0.7), 0, 1);
  c.educationLevel = clamp(safeNum(c.educationLevel, 30), 0, 100);
  c.healthcareLevel = clamp(safeNum(c.healthcareLevel, 30), 0, 100);
  c.crimeRate = clamp(safeNum(c.crimeRate, 40), 0, 100);
  c.inequality = clamp(safeNum(c.inequality, 0.4), 0, 1);
  c.infrastructure = clamp(safeNum(c.infrastructure, 30), 0, 100);
  c.technology = clamp(safeNum(c.technology, 30), 0, 100);
  c.approval = clamp(safeNum(c.approval, 50), 0, 100);
  c.discontent = clamp(safeNum(c.discontent, 40), 0, 100);
  c.stability = clamp(safeNum(c.stability, 55), 0, 100);
  c.happiness = clamp(safeNum(c.happiness, 50), 0, 100);
  c.poverty = clamp(safeNum(c.poverty, 0.3), 0, 1);
  c.shadowEconomy = clamp(safeNum(c.shadowEconomy, 0.15), 0, 1);
  c.pressFreedom = clamp(safeNum(c.pressFreedom, 40), 0, 100);
  c.judicialIndependence = clamp(safeNum(c.judicialIndependence, 40), 0, 100);
  c.corruption = clamp(safeNum(c.corruption, 40), 0, 100);
  c.gdpPerCapita = Math.max(0, safeNum(c.gdpPerCapita, 1000));
  c.growth = safeNum(c.growth, 0);
  c.unemployment = clamp(safeNum(c.unemployment, 0.07), 0, 1);
  c.inflation = clamp(safeNum(c.inflation, 0.005), -0.9, 5);
  c.fdi = Math.max(0, safeNum(c.fdi, 0));
  c.gdp = Math.max(0.001, safeNum(c.gdp, 1));

  // v3.14: новые поля внутренней безопасности
  c.policeFunding = clamp(safeNum(c.policeFunding, 0.008), 0, 0.05);
  c.ruleOfLaw = clamp(safeNum(c.ruleOfLaw, 50), 0, 100);
  c.localAutonomy = clamp(safeNum(c.localAutonomy, 50), 0, 100);
  if (!Array.isArray(c.protests)) c.protests = [];
  if (!Array.isArray(c.strikes)) c.strikes = [];

  // санитизация активных протестов/забастовок
  c.protests = c.protests.filter(p => p && typeof p === 'object').map(p => ({
    id: p.id || Math.random().toString(36).slice(2),
    cause: PROTEST_CAUSES.includes(p.cause) ? p.cause : 'poverty',
    scale: clamp(safeNum(p.scale, 20), 1, 100),
    daysLeft: Math.max(1, safeNum(p.daysLeft, 5)),
    region: p.region || 'Столица',
  }));
  c.strikes = c.strikes.filter(s => s && typeof s === 'object').map(s => ({
    id: s.id || Math.random().toString(36).slice(2),
    sector: STRIKE_SECTORS.includes(s.sector) ? s.sector : 'industry',
    scale: clamp(safeNum(s.scale, 15), 1, 100),
    daysLeft: Math.max(1, safeNum(s.daysLeft, 4)),
  }));

  // v3.15: журнал действий
  if (!Array.isArray(c.actionLog)) c.actionLog = [];
  c.actionLog = c.actionLog.filter(a => a && typeof a === 'object').slice(0, 100);

  if (!c.ageStructure) c.ageStructure = { children: 30, adults: 55, elderly: 15 };
  if (!c.spending) c.spending = {
    social: 0.030, education: 0.015, healthcare: 0.012,
    military: 0.015, infrastructure: 0.012, science: 0.004,
    agriculture: 0.010, industry: 0.010, other: 0.008,
  };
  if (!c.wars) c.wars = [];
  if (!c.embargoes) c.embargoes = [];
}

// ============================================================
// v3.14: СЕТТЕРЫ ВНУТРЕННЕЙ БЕЗОПАСНОСТИ
// ============================================================
export function setPoliceFunding(c, value) {
  c.policeFunding = clamp(Number(value) || 0, 0, 0.05);
  return { ok: true };
}

export function setJudicialReform(c, value) {
  c.judicialIndependence = clamp(Number(value) || 0, 0, 100);
  return { ok: true };
}

export function launchAntiCorruption(c) {
  const cost = Math.max(0.01, (c.gdp || 1) * 0.002);
  if ((c.treasury || 0) < cost) return { ok: false, reason: 'Недостаточно средств' };
  c.treasury -= cost;
  c.corruption = clamp((c.corruption || 40) - 6, 0, 100);
  c.judicialIndependence = clamp((c.judicialIndependence || 40) + 3, 0, 100);
  c.approval = clamp((c.approval || 50) + 2, 0, 100);
  return { ok: true };
}

export function setLocalAutonomy(c, value) {
  c.localAutonomy = clamp(Number(value) || 0, 0, 100);
  return { ok: true };
}

export function protestAction(c, id, action) {
  const p = (c.protests || []).find(x => x.id === id);
  if (!p) return { ok: false, reason: 'Протест не найден' };
  if (action === 'concede') {
    const cost = Math.max(0.005, (c.gdp || 1) * 0.001);
    if ((c.treasury || 0) < cost) return { ok: false, reason: 'Недостаточно средств' };
    c.treasury -= cost;
    c.discontent = clamp((c.discontent || 40) - 4, 0, 100);
    c.approval = clamp((c.approval || 50) + 2, 0, 100);
    c.protests = c.protests.filter(x => x.id !== id);
    return { ok: true };
  }
  if (action === 'repress') {
    c.approval = clamp((c.approval || 50) - 3, 0, 100);
    c.humanRights = clamp((c.humanRights || 50) - 4, 0, 100);
    c.stability = clamp((c.stability || 50) + 2, 0, 100);
    c.discontent = clamp((c.discontent || 40) + 2, 0, 100);
    c.protests = c.protests.filter(x => x.id !== id);
    return { ok: true };
  }
  return { ok: false, reason: 'Неверное действие' };
}

export function strikeAction(c, id, action) {
  const s = (c.strikes || []).find(x => x.id === id);
  if (!s) return { ok: false, reason: 'Забастовка не найдена' };
  if (action === 'negotiate') {
    const cost = Math.max(0.005, (c.gdp || 1) * 0.001);
    if ((c.treasury || 0) < cost) return { ok: false, reason: 'Недостаточно средств' };
    c.treasury -= cost;
    c.wage = (c.wage || 0) * 1.02;
    c.approval = clamp((c.approval || 50) + 1, 0, 100);
    c.strikes = c.strikes.filter(x => x.id !== id);
    return { ok: true };
  }
  if (action === 'break') {
    c.approval = clamp((c.approval || 50) - 3, 0, 100);
    c.humanRights = clamp((c.humanRights || 50) - 3, 0, 100);
    c.stability = clamp((c.stability || 50) + 1, 0, 100);
    c.strikes = c.strikes.filter(x => x.id !== id);
    return { ok: true };
  }
  return { ok: false, reason: 'Неверное действие' };
}

// ============================================================
// ТИК ОБЩЕСТВА
// ============================================================
export function tickSociety(c, game) {
  sanitizeSociety(c);
  const sp = c.spending;

  // --- демография (месячный шаг) ---
  const births = (c.population * c.birthRate) / 1000 / 12;
  const deaths = (c.population * c.deathRate) / 1000 / 12;
  const netMig = (c.population * c.migrationRate) / 1000 / 12;
  c.population = Math.max(1000, c.population + births - deaths + netMig);

  // --- дрейф демографических показателей ---
  const dev = clamp((c.educationLevel + c.healthcareLevel + (100 - c.poverty * 100)) / 300, 0, 1);

  const birthTarget = clamp(12 + (1 - dev) * 26 - c.healthcareLevel * 0.03, 6, 48);
  c.birthRate = lerp(c.birthRate, birthTarget, 0.006);

  const deathTarget = clamp(24 - c.healthcareLevel * 0.16 - c.educationLevel * 0.04 + c.poverty * 12, 4, 38);
  c.deathRate = lerp(c.deathRate, deathTarget, 0.006);

  const lifeTarget = clamp(34 + c.healthcareLevel * 0.42 + c.educationLevel * 0.16 - c.poverty * 12 + c.gdpPerCapita / 900, 30, 92);
  c.lifeExpectancy = lerp(c.lifeExpectancy, lifeTarget, 0.006);

  // Миграция: учитываем войны, санкции, безработицу
  const warPenalty = (c.wars || []).length * 2.0;
  const sanctionsPenalty = (c.embargoes || []).length * 0.4;
  const migTarget = clamp(
    (c.approval - 50) * 0.08 +
    (c.gdpPerCapita - 3000) / 4000 -
    c.crimeRate * 0.01 -
    c.unemployment * 4 +
    (c.pressFreedom - 50) * 0.02 -
    warPenalty -
    sanctionsPenalty,
    -8, 8
  );
  c.migrationRate = lerp(c.migrationRate, migTarget, 0.02);

  // --- возрастная структура (медленный дрейф) ---
  const lifeNorm = clamp((c.lifeExpectancy - 30) / 60, 0, 1);
  const childTarget = 35 - lifeNorm * 18 - c.healthcareLevel * 0.03 + c.poverty * 10;
  const elderlyTarget = 5 + lifeNorm * 25 + c.healthcareLevel * 0.05;
  const adultTarget = 100 - childTarget - elderlyTarget;
  c.ageStructure.children = lerp(c.ageStructure.children, clamp(childTarget, 5, 50), 0.005);
  c.ageStructure.elderly = lerp(c.ageStructure.elderly, clamp(elderlyTarget, 2, 35), 0.005);
  c.ageStructure.adults = clamp(adultTarget, 40, 75);

  // --- образование / здравоохранение ---
  const eduTarget = clamp(20 + safeNum(sp.education, 0.015) * 2500 + c.literacy * 25 - c.poverty * 15, 5, 99);
  c.educationLevel = lerp(c.educationLevel, eduTarget, 0.02);
  const healthTarget = clamp(18 + safeNum(sp.healthcare, 0.012) * 5000 - c.poverty * 18 + c.gdpPerCapita / 400, 5, 99);
  c.healthcareLevel = lerp(c.healthcareLevel, healthTarget, 0.02);

  c.literacy = lerp(c.literacy, clamp(0.45 + c.educationLevel / 180, 0.3, 0.999), 0.01);

  // --- преступность и неравенство (v3.14: + policeFunding) ---
  const policeEffect = safeNum(c.policeFunding, 0.008) * 3000;
  const crimeTarget = clamp(
    70 - c.educationLevel * 0.4 - c.gdpPerCapita / 300 + c.unemployment * 120 + c.inequality * 60 - policeEffect,
    2, 95
  );
  c.crimeRate = lerp(c.crimeRate, crimeTarget, 0.02);
  const ineqTarget = clamp(0.62 - safeNum(sp.social, 0.030) * 3 - c.educationLevel * 0.002 + c.corruption * 0.001, 0.2, 0.7);
  c.inequality = lerp(c.inequality, ineqTarget, 0.015);

  // --- инфраструктура и технологии ---
  c.infrastructure = lerp(c.infrastructure, clamp(20 + safeNum(sp.infrastructure, 0.012) * 1000 + c.educationLevel * 0.2, 5, 99), 0.012);
  c.technology = lerp(c.technology, clamp(15 + safeNum(sp.science, 0.004) * 1500 + c.educationLevel * 0.45 + (c.fdi / Math.max(c.gdp, 1)) * 200, 5, 99), 0.01);

  // --- общественное одобрение ---
  const econScore =
    c.growth * 22 +
    (1 - c.unemployment) * 0.35 +
    (1 - Math.min(c.inflation, 0.5)) * 0.2 +
    (1 - c.poverty) * 0.25;
  const socialScore = (c.educationLevel + c.healthcareLevel) / 200 - c.corruption / 120 - c.crimeRate / 200;
  const targetApproval = clamp(38 + econScore * 22 + socialScore * 30 - c.discontent * 0.15 + gauss(0, 1.2), 2, 96);
  c.approval = lerp(c.approval, targetApproval, 0.05);

  // --- недовольство ---
  const discontentTarget = clamp(100 - c.approval + c.inequality * 50 + c.corruption * 0.2 - c.pressFreedom * 0.1, 2, 98);
  c.discontent = lerp(c.discontent, discontentTarget, 0.04);

  // ============================================================
  // v3.14: ВЕРХОВЕНСТВО ПРАВА (ruleOfLaw)
  // ============================================================
  const rolTarget = clamp(
    c.judicialIndependence * 0.45 +
    (100 - c.corruption) * 0.30 +
    c.pressFreedom * 0.15 +
    c.educationLevel * 0.10,
    5, 99
  );
  c.ruleOfLaw = lerp(c.ruleOfLaw, rolTarget, 0.02);

  // ============================================================
  // v3.14: РЕГИОНАЛЬНОЕ САМОУПРАВЛЕНИЕ → стабильность
  // ============================================================
  const autonomyBalance = 100 - Math.abs(c.localAutonomy - 50) * 1.2;

  // --- стабильность ---
  const protestPressure = (c.protests || []).reduce((a, p) => a + p.scale, 0) * 0.06;
  const strikePressure = (c.strikes || []).reduce((a, s) => a + s.scale, 0) * 0.04;
  const stabTarget = clamp(
    45 + (c.approval - 50) * 0.6 - c.discontent * 0.15 - c.inequality * 35 +
    c.judicialIndependence * 0.12 - c.crimeRate * 0.08 +
    c.ruleOfLaw * 0.10 + autonomyBalance * 0.05 -
    protestPressure - strikePressure + gauss(0, 1),
    2, 98
  );
  c.stability = lerp(c.stability, stabTarget, 0.045);

  // --- счастье ---
  const happyTarget = clamp(
    25 + (c.gdpPerCapita / 200) + c.educationLevel * 0.15 + c.healthcareLevel * 0.15 -
    c.crimeRate * 0.1 - c.inequality * 30 + (c.approval - 50) * 0.2,
    2, 98
  );
  c.happiness = lerp(c.happiness, happyTarget, 0.02);

  // --- теневая экономика ---
  c.shadowEconomy = clamp(0.42 - c.educationLevel * 0.002 - c.gdpPerCapita / 40000 + c.corruption * 0.002, 0.03, 0.7);

  // ============================================================
  // v3.14: ПРОТЕСТЫ — зарождение и тик
  // ============================================================
  if (c.discontent > 55 && c.stability < 55 && Math.random() < 0.08) {
    const cause = c.poverty > 0.4 ? 'poverty'
      : c.unemployment > 0.12 ? 'unemployment'
      : c.corruption > 60 ? 'corruption'
      : c.inequality > 0.5 ? 'inequality'
      : 'repression';
    const scale = clamp(15 + (c.discontent - 50) * 0.6 + Math.random() * 10, 5, 80);
    c.protests.push({
      id: Math.random().toString(36).slice(2),
      cause,
      scale,
      daysLeft: 4 + Math.floor(Math.random() * 5),
      region: 'Столица',
    });
  }

  for (const p of c.protests) {
    p.daysLeft -= 1;
    c.approval = clamp(c.approval - p.scale * 0.02, 0, 100);
    c.stability = clamp(c.stability - p.scale * 0.01, 0, 100);
    if (p.cause === 'poverty') c.poverty = clamp(c.poverty + 0.0005, 0, 1);
  }
  c.protests = c.protests.filter(p => p.daysLeft > 0);

  // ============================================================
  // v3.14: ЗАБАСТОВКИ — зарождение и тик
  // ============================================================
  const opposedUnions = (c.unions || []).filter(u => u.stance === 'opposed').length;
  if (opposedUnions > 0 && c.unemployment > 0.08 && Math.random() < 0.05 * opposedUnions) {
    const sector = STRIKE_SECTORS[Math.floor(Math.random() * STRIKE_SECTORS.length)];
    const scale = clamp(10 + opposedUnions * 8 + Math.random() * 10, 5, 70);
    c.strikes.push({
      id: Math.random().toString(36).slice(2),
      sector,
      scale,
      daysLeft: 3 + Math.floor(Math.random() * 4),
    });
  }

  let strikeGdpLoss = 0;
  for (const s of c.strikes) {
    s.daysLeft -= 1;
    strikeGdpLoss += s.scale * 0.0002;
    c.approval = clamp(c.approval - s.scale * 0.015, 0, 100);
  }
  if (strikeGdpLoss > 0) {
    c.gdp = Math.max(0.001, c.gdp * (1 - strikeGdpLoss));
    c.exports = Math.max(0, c.exports * (1 - strikeGdpLoss));
  }
  c.strikes = c.strikes.filter(s => s.daysLeft > 0);

  // ============================================================
  // v3.14: ФИНАНСИРОВАНИЕ ПОЛИЦИИ — списание из казны
  // ============================================================
  if (c.policeFunding > 0) {
    const policeCost = (c.gdp || 1) * c.policeFunding / 12;
    c.treasury = Math.max(0, (c.treasury || 0) - policeCost);
  }

  // финальная защита от NaN
  sanitizeSociety(c);
}

// ============================================================
// v3.15: ЖУРНАЛ ДЕЙСТВИЙ
// ============================================================
export function logAction(c, type, text, kind = 'info') {
  if (!c) return;
  if (!Array.isArray(c.actionLog)) c.actionLog = [];
  c.actionLog.unshift({
    date: { ...(c._date || { year: 1936, month: 1, day: 1 }) },
    type: String(type || 'action'),
    text: String(text || ''),
    kind: kind || 'info',
  });
  if (c.actionLog.length > 100) c.actionLog.length = 100;
}
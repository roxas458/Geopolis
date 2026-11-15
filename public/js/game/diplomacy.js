import { clamp, lerp, uid } from '../core/util.js';
import { gauss, chance, pick, randInt } from '../core/rng.js';

// ============================================================
// УРОВНИ ОТНОШЕНИЙ
// ============================================================
export const RELATION_LEVELS = [
  { min: 80,  id: 'alliance',  name: 'Союз',           color: '#3ecf8e', icon: '🤝' },
  { min: 50,  id: 'friendly',  name: 'Дружба',         color: '#7ee3a8', icon: '😊' },
  { min: 20,  id: 'cordial',   name: 'Тёплые',         color: '#b5d96a', icon: '🙂' },
  { min: -20, id: 'neutral',   name: 'Нейтралитет',    color: '#8b97b8', icon: '😐' },
  { min: -50, id: 'tense',     name: 'Напряжённые',    color: '#e6b84c', icon: '😠' },
  { min: -80, id: 'hostile',   name: 'Враждебные',     color: '#e08a3c', icon: '😡' },
  { min: -101,id: 'enemy',     name: 'Враг',           color: '#f0596b', icon: '💀' },
];

export const DIPLOMATIC_RANKS = {
  none:      { name: 'Нет отношений', level: 0 },
  consul:    { name: 'Консул',        level: 1 },
  charge:    { name: 'Поверенный',    level: 2 },
  ambassador:{ name: 'Посол',         level: 3 },
};

// ============================================================
// ДОГОВОРЫ (v1.8 — цены под 1936)
// ============================================================
export const TREATY_TYPES = {
  trade:          { name: 'Торговый договор',         minRel: 10, cost: 0.02, desc: '+экспорт, +импорт' },
  non_aggression: { name: 'Пакт о ненападении',       minRel: 20, cost: 0.01, desc: 'Нельзя объявить войну' },
  border:         { name: 'Договор о границах',       minRel: 30, cost: 0.02, desc: 'Стабильность, меньше претензий' },
  cultural:       { name: 'Культурный обмен',         minRel: 20, cost: 0.01, desc: '+счастье, +репутация' },
  tech_sharing:   { name: 'Обмен технологиями',       minRel: 30, cost: 0.03, desc: '+технологии обоим' },
  mutual_defense: { name: 'Оборонительный союз',      minRel: 50, cost: 0.05, desc: 'Защита при войне' },
  offensive:      { name: 'Наступательный союз',      minRel: 60, cost: 0.08, desc: 'Совместные войны' },
  economic_union: { name: 'Экономический союз',       minRel: 70, cost: 0.10, desc: '+торговля, +рост' },
  base_agreement: { name: 'Военная база',             minRel: 40, cost: 0.05, desc: 'База на чужой территории' },
  recognition:    { name: 'Признание',                minRel: 0,  cost: 0,    desc: 'Официальное признание' },
};

// ============================================================
// ШПИОНАЖ (v1.8 — цены под 1936)
// ============================================================
export const ESPIONAGE_OPS = {
  gather_info:       { name: 'Сбор информации',        cost: 0.005, risk: 0.10, desc: 'Узнать скрытые данные' },
  steal_tech:        { name: 'Кража технологий',       cost: 0.02,  risk: 0.30, desc: '+технологии за счёт цели' },
  sabotage:          { name: 'Диверсия',               cost: 0.03,  risk: 0.40, desc: 'Урон экономике цели' },
  propaganda:        { name: 'Пропаганда',             cost: 0.02,  risk: 0.25, desc: 'Снизить стабильность цели' },
  support_opposition:{ name: 'Поддержка оппозиции',    cost: 0.05,  risk: 0.50, desc: 'Рост недовольства' },
  coup:              { name: 'Переворот',              cost: 0.15,  risk: 0.70, desc: 'Смена власти' },
};

// ============================================================
// УРОВЕНЬ ОТНОШЕНИЙ
// ============================================================
export function getRelationLevel(rel) {
  for (const lvl of RELATION_LEVELS) {
    if (rel >= lvl.min) return lvl;
  }
  return RELATION_LEVELS[RELATION_LEVELS.length - 1];
}

// ============================================================
// БАЗОВЫЕ ОПЕРАЦИИ
// ============================================================
export function getRelation(a, b) {
  if (!a.relations) a.relations = {};
  return a.relations[b.id] ?? 0;
}

export function changeRelation(a, b, delta) {
  if (!a.relations) a.relations = {};
  if (!b.relations) b.relations = {};
  const va = a.relations[b.id] ?? 0;
  const vb = b.relations[a.id] ?? 0;
  a.relations[b.id] = clamp(va + delta, -100, 100);
  b.relations[a.id] = clamp(vb + delta * 0.8, -100, 100);
}

function ensureDiplomacyState(c) {
  if (!c.relations || typeof c.relations !== 'object') c.relations = {};
  if (!c.treaties) c.treaties = [];
  if (!c.embassies) c.embassies = {};
  if (!c.espionage) c.espionage = {};
  if (!c.sanctions) c.sanctions = [];
  if (!c.bases) c.bases = [];
  if (!c.recognized) c.recognized = [];
  if (!c.ultimatums) c.ultimatums = [];
  if (!c.wars) c.wars = [];
  if (!c.tradeAgreements) c.tradeAgreements = [];
  if (!c.embassy) c.embassy = [];
  if (!c.embargoes) c.embargoes = [];
  if (!c.alliances) c.alliances = [];
}

export function hasTreaty(a, b, typeId) {
  ensureDiplomacyState(a);
  return a.treaties.some(t => t.with === b.id && t.type === typeId);
}

export function getTreaties(a, b) {
  ensureDiplomacyState(a);
  return a.treaties.filter(t => t.with === b.id);
}

// ============================================================
// ДОГОВОРЫ
// ============================================================
export function signTreaty(a, b, typeId, game) {
  ensureDiplomacyState(a);
  ensureDiplomacyState(b);

  const type = TREATY_TYPES[typeId];
  if (!type) return { ok: false, reason: 'Неизвестный договор' };
  if (hasTreaty(a, b, typeId)) return { ok: false, reason: 'Договор уже подписан' };

  const rel = getRelation(a, b);
  if (rel < type.minRel) return { ok: false, reason: `Нужны отношения ≥ ${type.minRel} (сейчас ${Math.round(rel)})` };
  if ((a.treasury || 0) < type.cost) return { ok: false, reason: 'Недостаточно средств' };

  a.treasury -= type.cost;

  const date = game?.date || a._date || { year: 1936, month: 1, day: 1 };
  const treaty = { id: uid(), with: b.id, type: typeId, signed: { ...date } };
  a.treaties.push(treaty);
  b.treaties.push({ id: uid(), with: a.id, type: typeId, signed: { ...date } });

  applyTreatyEffects(a, b, typeId);

  changeRelation(a, b, 10);
  if (game) game.pushNews('Договор', `Подписан «${type.name}»`, 'good', a.id);
  return { ok: true, treaty };
}

function applyTreatyEffects(a, b, typeId) {
  switch (typeId) {
    case 'trade':
      a.exports = (a.exports || 0) * 1.05;
      a.imports = (a.imports || 0) * 1.03;
      b.exports = (b.exports || 0) * 1.05;
      b.imports = (b.imports || 0) * 1.03;
      if (!a.tradeAgreements.includes(b.id)) a.tradeAgreements.push(b.id);
      if (!b.tradeAgreements.includes(a.id)) b.tradeAgreements.push(a.id);
      break;
    case 'cultural':
      a.happiness = clamp((a.happiness || 50) + 2, 0, 100);
      b.happiness = clamp((b.happiness || 50) + 2, 0, 100);
      a.reputation = clamp((a.reputation || 30) + 2, 0, 100);
      b.reputation = clamp((b.reputation || 30) + 2, 0, 100);
      break;
    case 'tech_sharing':
      a.technology = clamp((a.technology || 20) + 3, 0, 100);
      b.technology = clamp((b.technology || 20) + 3, 0, 100);
      break;
    case 'mutual_defense':
      if (!a.alliances.includes(b.id)) a.alliances.push(b.id);
      if (!b.alliances.includes(a.id)) b.alliances.push(a.id);
      break;
    case 'offensive':
      if (!a.alliances.includes(b.id)) a.alliances.push(b.id);
      if (!b.alliances.includes(a.id)) b.alliances.push(a.id);
      a.influence = clamp((a.influence || 20) + 3, 0, 100);
      b.influence = clamp((b.influence || 20) + 3, 0, 100);
      break;
    case 'economic_union':
      a.growth += 0.0005;
      b.growth += 0.0005;
      a.reputation = clamp((a.reputation || 30) + 5, 0, 100);
      b.reputation = clamp((b.reputation || 30) + 5, 0, 100);
      break;
    case 'base_agreement':
      if (!a.bases.includes(b.id)) a.bases.push(b.id);
      a.influence = clamp((a.influence || 20) + 5, 0, 100);
      if (a.military) a.military.readiness = clamp((a.military.readiness || 50) + 3, 0, 100);
      break;
    case 'border':
      a.stability = clamp((a.stability || 55) + 2, 0, 100);
      b.stability = clamp((b.stability || 55) + 2, 0, 100);
      break;
    case 'recognition':
      if (!a.recognized.includes(b.id)) a.recognized.push(b.id);
      if (!b.recognized.includes(a.id)) b.recognized.push(a.id);
      a.reputation = clamp((a.reputation || 30) + 1, 0, 100);
      b.reputation = clamp((b.reputation || 30) + 1, 0, 100);
      break;
  }
}

export function breakTreaty(a, b, typeId, game) {
  ensureDiplomacyState(a);
  ensureDiplomacyState(b);
  a.treaties = a.treaties.filter(t => !(t.with === b.id && t.type === typeId));
  b.treaties = b.treaties.filter(t => !(t.with === a.id && t.type === typeId));

  changeRelation(a, b, -25);
  a.reputation = clamp((a.reputation || 30) - 5, 0, 100);
  a.stability = clamp((a.stability || 55) - 2, 0, 100);

  if (typeId === 'mutual_defense' || typeId === 'offensive') {
    a.alliances = a.alliances.filter(id => id !== b.id);
    b.alliances = b.alliances.filter(id => id !== a.id);
  }
  if (typeId === 'trade') {
    a.tradeAgreements = a.tradeAgreements.filter(id => id !== b.id);
    b.tradeAgreements = b.tradeAgreements.filter(id => id !== a.id);
  }

  if (game) game.pushNews('Договор', `Разорван «${TREATY_TYPES[typeId]?.name || typeId}»`, 'bad', a.id);
  return { ok: true };
}

// ============================================================
// ПОСОЛЬСТВА И РАНГИ
// ============================================================
export function openEmbassy(a, b) {
  ensureDiplomacyState(a);
  ensureDiplomacyState(b);
  const rel = getRelation(a, b);
  if (rel < -40) return { ok: false, reason: 'Отношения слишком враждебны' };
  if (a.embassies[b.id]) return { ok: false, reason: 'Посольство уже открыто' };

  const date = a._date || { year: 1936, month: 1, day: 1 };
  a.embassies[b.id] = { rank: 'charge', since: { ...date } };
  b.embassies[a.id] = { rank: 'charge', since: { ...date } };
  if (!a.embassy.includes(b.id)) a.embassy.push(b.id);
  if (!b.embassy.includes(a.id)) b.embassy.push(a.id);
  changeRelation(a, b, 5);
  return { ok: true };
}

export function setRank(a, b, rank) {
  ensureDiplomacyState(a);
  if (!a.embassies[b.id]) return { ok: false, reason: 'Сначала откройте посольство' };
  a.embassies[b.id].rank = rank;
  const bonus = DIPLOMATIC_RANKS[rank]?.level || 0;
  changeRelation(a, b, bonus);
  return { ok: true };
}

export function closeEmbassy(a, b) {
  ensureDiplomacyState(a);
  ensureDiplomacyState(b);
  if (!a.embassies[b.id]) return { ok: false, reason: 'Посольства нет' };
  delete a.embassies[b.id];
  delete b.embassies[a.id];
  a.embassy = a.embassy.filter(id => id !== b.id);
  b.embassy = b.embassy.filter(id => id !== a.id);
  changeRelation(a, b, -20);
  return { ok: true };
}

// ============================================================
// БАЗОВЫЕ ДЕЙСТВИЯ (v1.8 — цены под 1936)
// ============================================================
export function improveRelations(a, b) {
  const cost = 0.004 + Math.abs(getRelation(a, b)) * 0.0001;
  if ((a.treasury || 0) < cost) return { ok: false, reason: 'Недостаточно средств' };
  a.treasury -= cost;
  changeRelation(a, b, 8 + Math.round(gauss(0, 4)));
  return { ok: true };
}

export function holdSummit(a, b) {
  const cost = 0.012;
  if ((a.treasury || 0) < cost) return { ok: false, reason: 'Недостаточно средств' };
  a.treasury -= cost;
  changeRelation(a, b, 18);
  a.reputation = clamp((a.reputation || 30) + 2, 0, 100);
  return { ok: true };
}

// ============================================================
// ЭКОНОМИЧЕСКАЯ ПОМОЩЬ
// ============================================================
export function sendAid(a, b, amount, game) {
  // FIX: валидация amount — иначе -5 превращается в +5 из воздуха, NaN → NaN
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: 'Сумма должна быть положительным числом' };
  }
  if ((a.treasury || 0) < amount) return { ok: false, reason: 'Недостаточно средств' };
  a.treasury -= amount;
  b.treasury = (b.treasury || 0) + amount;
  const relBonus = Math.max(2, Math.round(amount * 20));
  changeRelation(a, b, relBonus);
  a.reputation = clamp((a.reputation || 30) + 2, 0, 100);
  b.approval = clamp((b.approval || 50) + 1, 0, 100);
  if (game) game.pushNews('Помощь', `${a.shortName} выделил $ ${amount} млрд`, 'good', a.id);
  return { ok: true };
}

export function sendMilitaryAid(a, b, game) {
  const cost = 0.05;
  if ((a.treasury || 0) < cost) return { ok: false, reason: 'Недостаточно средств' };
  a.treasury -= cost;
  if (a.military) a.military.readiness = clamp((a.military.readiness || 50) - 1, 0, 100);
  if (b.military) {
    b.military.readiness = clamp((b.military.readiness || 50) + 8, 0, 100);
    b.military.industry = clamp((b.military.industry || 30) + 3, 0, 100);
  }
  changeRelation(a, b, 15);
  a.influence = clamp((a.influence || 20) + 2, 0, 100);
  if (game) game.pushNews('Военная помощь', `${a.shortName} → ${b.shortName}`, 'info', a.id);
  return { ok: true };
}

// ============================================================
// ШПИОНАЖ
// ============================================================
export function conductEspionage(a, b, opId, game) {
  const op = ESPIONAGE_OPS[opId];
  if (!op) return { ok: false, reason: 'Неизвестная операция' };
  if ((a.treasury || 0) < op.cost) return { ok: false, reason: 'Недостаточно средств' };

  a.treasury -= op.cost;

  const success = chance(1 - op.risk);
  if (success) {
    switch (opId) {
      case 'gather_info':
        if (game) game.pushNews('Разведка', `${a.shortName} получил данные о ${b.shortName}`, 'good', a.id);
        break;
      case 'steal_tech':
        a.technology = clamp((a.technology || 20) + 3, 0, 100);
        b.technology = clamp((b.technology || 20) - 2, 0, 100);
        if (game) game.pushNews('Шпионаж', `Технологии ${b.shortName} украдены`, 'bad', b.id);
        break;
      case 'sabotage':
        b.gdp = (b.gdp || 1) * 0.98;
        b.infrastructure = clamp((b.infrastructure || 30) - 5, 0, 100);
        changeRelation(a, b, -15);
        if (game) game.pushNews('Диверсия', `Диверсия в ${b.shortName}`, 'bad', b.id);
        break;
      case 'propaganda':
        b.stability = clamp((b.stability || 55) - 8, 0, 100);
        b.approval = clamp((b.approval || 50) - 5, 0, 100);
        if (game) game.pushNews('Пропаганда', `Пропаганда против ${b.shortName}`, 'bad', b.id);
        break;
      case 'support_opposition':
        b.discontent = clamp((b.discontent || 40) + 10, 0, 100);
        b.stability = clamp((b.stability || 55) - 6, 0, 100);
        changeRelation(a, b, -20);
        if (game) game.pushNews('Оппозиция', `Поддержка оппозиции в ${b.shortName}`, 'bad', b.id);
        break;
      case 'coup':
        b.stability = clamp((b.stability || 55) - 25, 0, 100);
        b.approval = clamp((b.approval || 50) - 20, 0, 100);
        b.discontent = clamp((b.discontent || 40) + 20, 0, 100);
        changeRelation(a, b, -50);
        if (game) game.pushNews('Переворот', `Попытка переворота в ${b.shortName}`, 'bad', b.id);
        break;
    }
    a.reputation = clamp((a.reputation || 30) - 1, 0, 100);
    return { ok: true, success: true };
  } else {
    changeRelation(a, b, -25);
    a.reputation = clamp((a.reputation || 30) - 8, 0, 100);
    if (game) game.pushNews('Скандал', `${a.shortName} раскрыт в шпионаже против ${b.shortName}`, 'bad', a.id);
    return { ok: true, success: false };
  }
}

// ============================================================
// ПРОПАГАНДА (внешняя) — v1.8
// ============================================================
export function propaganda(a, b, mode, game) {
  const cost = mode === 'soft' ? 0.02 : 0.05;
  if ((a.treasury || 0) < cost) return { ok: false, reason: 'Недостаточно средств' };
  a.treasury -= cost;

  if (mode === 'soft') {
    b.happiness = clamp((b.happiness || 50) + 3, 0, 100);
    b.approval = clamp((b.approval || 50) + 2, 0, 100);
    changeRelation(a, b, 5);
    a.reputation = clamp((a.reputation || 30) + 1, 0, 100);
    return { ok: true, msg: 'Культурная пропаганда' };
  } else {
    b.discontent = clamp((b.discontent || 40) + 6, 0, 100);
    b.approval = clamp((b.approval || 50) - 4, 0, 100);
    changeRelation(a, b, -10);
    a.reputation = clamp((a.reputation || 30) - 2, 0, 100);
    return { ok: true, msg: 'Жёсткая пропаганда' };
  }
}

// ============================================================
// САНКЦИИ
// ============================================================
export function imposeSanctions(a, b, game) {
  ensureDiplomacyState(a);
  if (a.sanctions.some(s => s.against === b.id)) return { ok: false, reason: 'Санкции уже действуют' };
  const date = a._date || { year: 1936, month: 1, day: 1 };
  a.sanctions.push({ against: b.id, since: { ...date } });
  if (!a.embargoes.includes(b.id)) a.embargoes.push(b.id);
  changeRelation(a, b, -35);
  b.imports = (b.imports || 0) * 0.85;
  a.exports = (a.exports || 0) * 0.95;
  b.approval = clamp((b.approval || 50) - 3, 0, 100);
  if (game) game.pushNews('Санкции', `${a.shortName} ввёл санкции против ${b.shortName}`, 'bad', a.id);
  return { ok: true };
}

export function liftSanctions(a, b, game) {
  ensureDiplomacyState(a);
  a.sanctions = a.sanctions.filter(s => s.against !== b.id);
  a.embargoes = a.embargoes.filter(id => id !== b.id);
  changeRelation(a, b, 10);
  if (game) game.pushNews('Санкции', `${a.shortName} снял санкции с ${b.shortName}`, 'good', a.id);
  return { ok: true };
}

// ============================================================
// УЛЬТИМАТУМ (v1.8 — цены под 1936)
// ============================================================
export function issueUltimatum(a, b, demand, game) {
  ensureDiplomacyState(a);
  if (b.wars?.includes(a.id)) return { ok: false, reason: 'Уже в состоянии войны' };
  if (getRelation(a, b) > 10) return { ok: false, reason: 'Отношения слишком хорошие для ультиматума' };

  const demands = {
    reparations: { label: 'Репарации', cost: 0.2 },
    territory:   { label: 'Территория', cost: 0 },
    trade:       { label: 'Торговые уступки', cost: 0.05 },
    disarm:      { label: 'Разоружение', cost: 0 },
  };
  const d = demands[demand];
  if (!d) return { ok: false, reason: 'Неизвестное требование' };

  const myPower = (a.military?.personnel || 0) + (a.gdp || 0) * 1e6;
  const theirPower = (b.military?.personnel || 0) + (b.gdp || 0) * 1e6;
  const powerRatio = myPower / Math.max(theirPower, 1);

  const agree = powerRatio > 1.5 && chance(0.7);
  if (agree) {
    if (demand === 'reparations') {
      const rep = demands.reparations.cost;
      b.treasury = Math.max(0, (b.treasury || 0) - rep);
      a.treasury = (a.treasury || 0) + rep;
    } else if (demand === 'trade') {
      a.exports = (a.exports || 0) * 1.1;
    } else if (demand === 'territory') {
      const transfer = (b.area || 0) * 0.05;
      b.area = (b.area || 0) - transfer;
      a.area = (a.area || 0) + transfer;
      b.approval = clamp((b.approval || 50) - 10, 0, 100);
    } else if (demand === 'disarm') {
      if (b.military) b.military.personnel = Math.round(b.military.personnel * 0.8);
    }
    changeRelation(a, b, -20);
    if (game) game.pushNews('Ультиматум', `${b.shortName} принял ультиматум ${a.shortName}`, 'bad', b.id);
    return { ok: true, accepted: true };
  } else {
    changeRelation(a, b, -40);
    b.approval = clamp((b.approval || 50) + 5, 0, 100);
    if (game) game.pushNews('Ультиматум', `${b.shortName} отверг ультиматум ${a.shortName}`, 'bad', b.id);
    return { ok: true, accepted: false };
  }
}

// ============================================================
// ВОЙНА / МИР
// ============================================================
export function declareWar(a, b, game) {
  ensureDiplomacyState(a);
  ensureDiplomacyState(b);

  if (hasTreaty(a, b, 'non_aggression')) {
    return { ok: false, reason: 'Действует пакт о ненападении — сначала разорвите его' };
  }
  if (a.wars.includes(b.id)) return { ok: false, reason: 'Уже в войне' };

  a.wars.push(b.id);
  b.wars.push(a.id);
  changeRelation(a, b, -100);
  a.stability = clamp((a.stability || 55) - 10, 0, 100);
  b.stability = clamp((b.stability || 55) - 10, 0, 100);
  a.approval = clamp((a.approval || 50) - 5, 0, 100);
  b.approval = clamp((b.approval || 50) + 5, 0, 100);
  a.reputation = clamp((a.reputation || 30) - 10, 0, 100);

  for (const allyId of a.alliances) {
    const ally = game?.getCountry(allyId);
    if (ally && !ally.wars.includes(b.id) && chance(0.6)) {
      ally.wars.push(b.id);
      b.wars.push(allyId);
      if (game) game.pushNews('Война', `${ally.shortName} вступил в войну`, 'bad', allyId);
    }
  }

  if (game) game.pushNews('Война', `${a.shortName} объявил войну ${b.shortName}`, 'bad', a.id);
  return { ok: true };
}

export function makePeace(a, b, game) {
  ensureDiplomacyState(a);
  ensureDiplomacyState(b);
  if (!a.wars.includes(b.id)) return { ok: false, reason: 'Нет войны' };

  a.wars = a.wars.filter(id => id !== b.id);
  b.wars = b.wars.filter(id => id !== a.id);
  changeRelation(a, b, 20);
  a.stability = clamp((a.stability || 55) + 5, 0, 100);
  b.stability = clamp((b.stability || 55) + 5, 0, 100);
  a.approval = clamp((a.approval || 50) + 3, 0, 100);
  b.approval = clamp((b.approval || 50) + 3, 0, 100);

  if (game) game.pushNews('Мир', `${a.shortName} и ${b.shortName} подписали мир`, 'good', a.id);
  return { ok: true };
}

// ============================================================
// СОВМЕСТНЫЕ УЧЕНИЯ (v1.8)
// ============================================================
export function jointExercise(a, b, game) {
  const cost = 0.03;
  if ((a.treasury || 0) < cost) return { ok: false, reason: 'Недостаточно средств' };
  if (getRelation(a, b) < 20) return { ok: false, reason: 'Нужны отношения ≥ 20' };
  a.treasury -= cost;
  if (a.military) a.military.readiness = clamp((a.military.readiness || 50) + 5, 0, 100);
  if (b.military) b.military.readiness = clamp((b.military.readiness || 50) + 3, 0, 100);
  changeRelation(a, b, 10);
  if (game) game.pushNews('Учения', `Совместные учения ${a.shortName} и ${b.shortName}`, 'good', a.id);
  return { ok: true };
}

// ============================================================
// ТИК ДИПЛОМАТИИ
// ============================================================
export function tickDiplomacy(game) {
  const countries = game.world.countries;
  for (const a of countries) {
    ensureDiplomacyState(a);
    const relsA = a.relations;

    for (const b of countries) {
      if (a.id === b.id) continue;
      ensureDiplomacyState(b);

      const cur = relsA[b.id] ?? 0;
      let target = 0;
      if (a.ideology === b.ideology) target += 20;

      const treaties = (a.treaties || []).filter(t => t.with === b.id);
      for (const t of treaties) {
        if (t.type === 'mutual_defense' || t.type === 'offensive') target += 40;
        if (t.type === 'economic_union') target += 35;
        if (t.type === 'trade') target += 15;
        if (t.type === 'non_aggression') target += 20;
        if (t.type === 'border') target += 15;
      }

      if ((a.sanctions || []).some(s => s.against === b.id)) target -= 45;
      if (a.wars?.includes(b.id)) target -= 100;

      const drift = (target - cur) * 0.008 + gauss(0, 0.35);
      relsA[b.id] = clamp(cur + drift, -100, 100);
    }

    const allies = (a.alliances || []).length;
    const treaties = (a.treaties || []).length;
    const sanctions = (a.sanctions || []).length;
    const wars = (a.wars || []).length;

    const reputationTarget = clamp(
      30 + allies * 5 + treaties * 2 -
      sanctions * 3 - wars * 15 +
      (a.gdpPerCapita > 500 ? 10 : 0),
      5, 95
    );
    a.reputation = clamp(lerp(a.reputation || 30, reputationTarget, 0.01), 0, 100);

    const militaryPower = ((a.military?.personnel || 0) / 1e7);
    const influenceTarget = clamp(
      Math.log10(Math.max(a.gdp || 1, 1)) * 20 +
      allies * 4 + treaties * 2 + militaryPower +
      (a.reputation || 30) * 0.2 -
      wars * 3,
      2, 100
    );
    a.influence = clamp(lerp(a.influence || 20, influenceTarget, 0.01), 0, 100);

    if (wars > 0) {
      a.gdp = (a.gdp || 1) * 0.997;
      a.stability = clamp((a.stability || 55) - 0.3, 0, 100);
    }

    for (const baseId of a.bases || []) {
      a.influence = clamp((a.influence || 20) + 0.02, 0, 100);
    }
  }
}

// Совместимость со старым API
export { improveRelations as improveRelationsOld };
export function formAlliance(a, b) { return signTreaty(a, b, 'mutual_defense', null); }
export function breakAlliance(a, b) { return breakTreaty(a, b, 'mutual_defense', null); }
export function signTradeAgreement(a, b) { return signTreaty(a, b, 'trade', null); }
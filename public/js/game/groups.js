import { pick, chance, randInt, randFloat, gauss, shuffle } from '../core/rng.js';
import { clamp, uid, lerp } from '../core/util.js';

// ============================================================
// ТИПЫ ПРОФСОЮЗОВ
// ============================================================
export const UNION_TYPES = {
  moderate:     { name: 'умеренный профсоюз',        ideology: 'social_democrat', radicalism: 25, color: '#e0559a', desc: 'Защита прав через переговоры' },
  socialist:    { name: 'социалистический профсоюз', ideology: 'socialist',       radicalism: 55, color: '#e04b3a', desc: 'Борьба за права трудящихся' },
  communist:    { name: 'коммунистический профсоюз', ideology: 'communist',       radicalism: 85, color: '#b0141c', desc: 'Революционная борьба пролетариата' },
  syndicalist:  { name: 'синдикалистский профсоюз',  ideology: 'socialist',       radicalism: 90, color: '#8a1a3a', desc: 'Прямое действие и всеобщая стачка' },
  christian:    { name: 'христианский профсоюз',     ideology: 'conservative',    radicalism: 20, color: '#a06bd8', desc: 'Защита рабочих на основе веры' },
  nationalist:  { name: 'националистический профсоюз', ideology: 'nationalist',   radicalism: 40, color: '#8a6a1f', desc: 'Защита своих от чужих' },
  fascist:      { name: 'корпоративный профсоюз',    ideology: 'nationalist',     radicalism: 30, color: '#8a6a1f', desc: 'Корпоративистская организация труда' },
};

// ============================================================
// ТИПЫ АССОЦИАЦИЙ
// ============================================================
export const ASSOCIATION_TYPES = {
  business:     { name: 'Торговая палата',     ideology: 'liberal',      color: '#4a7dff', desc: 'Интересы предпринимателей' },
  religious:    { name: 'Церковный совет',      ideology: 'conservative', color: '#a06bd8', desc: 'Интересы верующих' },
  cultural:     { name: 'Культурное общество',  ideology: 'centrist',     color: '#7a8fb5', desc: 'Развитие культуры' },
  women:        { name: 'Женский союз',         ideology: 'liberal',      color: '#e0559a', desc: 'Права женщин' },
  veterans:     { name: 'Союз ветеранов',       ideology: 'nationalist',  color: '#8a6a1f', desc: 'Патриотизм, ветераны' },
  intellectual: { name: 'Академия наук',        ideology: 'liberal',      color: '#4a7dff', desc: 'Наука и образование' },
  media:        { name: 'Союз журналистов',     ideology: 'liberal',      color: '#4a7dff', desc: 'Свобода прессы' },
  sports:       { name: 'Спортивный клуб',      ideology: 'centrist',     color: '#3ea868', desc: 'Физкультура и здоровье' },
  ethnic:       { name: 'Национальное общество', ideology: 'centrist',    color: '#7a8fb5', desc: 'Права меньшинств' },
  peasants:     { name: 'Крестьянский союз',    ideology: 'centrist',     color: '#3ea868', desc: 'Интересы крестьян' },
};

const UNION_PREFIXES = ['Всеобщий', 'Объединённый', 'Свободный', 'Национальный', 'Рабочий', 'Единый', 'Независимый'];
const ASSOC_NAMES = {
  business:     ['Торговая палата', 'Союз промышленников', 'Ассоциация предпринимателей', 'Гильдия купцов'],
  religious:    ['Церковный совет', 'Духовная ассоциация', 'Религиозное братство', 'Собор верующих'],
  cultural:     ['Общество искусств', 'Культурный союз', 'Литературное общество', 'Театральная лига'],
  women:        ['Женский союз', 'Лига равноправия', 'Ассоциация женщин', 'Союз матерей'],
  veterans:     ['Союз ветеранов', 'Братство фронтовиков', 'Ассоциация участников войны', 'Легион славы'],
  intellectual: ['Академия наук', 'Учёный совет', 'Философское общество', 'Институт знаний'],
  media:        ['Союз журналистов', 'Ассоциация прессы', 'Гильдия издателей', 'Клуб репортёров'],
  sports:       ['Спортивный клуб', 'Атлетический союз', 'Гимнастическое общество', 'Олимпийский комитет'],
  ethnic:       ['Национальный союз', 'Ассоциация меньшинств', 'Культурная община', 'Землячество'],
  peasants:     ['Крестьянский союз', 'Аграрная лига', 'Союз фермеров', 'Земледельческое общество'],
};

// ============================================================
// СОЗДАНИЕ
// ============================================================
export function createUnion(ideologyHint = 'centrist', dev = 0.5) {
  let typeId;
  if (['communist', 'socialist'].includes(ideologyHint)) typeId = pick(['socialist', 'communist', 'syndicalist']);
  else if (ideologyHint === 'social_democrat') typeId = pick(['moderate', 'socialist', 'christian']);
  else if (ideologyHint === 'nationalist') typeId = pick(['nationalist', 'fascist', 'christian']);
  else if (['conservative', 'monarchist'].includes(ideologyHint)) typeId = pick(['christian', 'nationalist', 'moderate']);
  else typeId = pick(Object.keys(UNION_TYPES));

  const type = UNION_TYPES[typeId];
  return {
    id: uid(),
    type: typeId,
    name: `${pick(UNION_PREFIXES)} ${type.name}`,
    ideology: type.ideology,
    radicalism: clamp(type.radicalism + gauss(0, 10), 0, 100),
    color: type.color,
    members: Math.round(randFloat(0.02, 0.15) * (0.3 + dev * 0.7) * 100000),
    strength: clamp(randFloat(20, 60) + dev * 20, 0, 100),
    stance: 'neutral',
    strikes: 0,
  };
}

export function createAssociation(typeId, ideologyHint = 'centrist') {
  const type = ASSOCIATION_TYPES[typeId] || ASSOCIATION_TYPES.cultural;
  const names = ASSOC_NAMES[typeId] || [type.name];
  return {
    id: uid(),
    type: typeId,
    name: pick(names),
    ideology: type.ideology,
    color: type.color,
    members: randInt(2000, 80000),
    influence: clamp(randFloat(20, 70), 0, 100),
    stance: 'neutral',
    banned: false,
  };
}

export function generateUnions(c) {
  let count;
  if (c.ideology === 'communist' || c.system === 'one_party') count = 1;
  else if (c.ideology === 'socialist') count = 2;
  else if (['authoritarian', 'military_junta'].includes(c.system)) count = 1;
  else count = randInt(2, 4);

  const dev = clamp((c.educationLevel || 30) / 100, 0, 1);
  return Array.from({ length: count }, () => createUnion(c.ideology, dev));
}

export function generateAssociations(c) {
  const count = randInt(4, 7);
  const types = shuffle(Object.keys(ASSOCIATION_TYPES)).slice(0, count);
  return types.map(t => createAssociation(t, c.ideology));
}

// ============================================================
// ДЕЙСТВИЯ ИГРОКА С ПРОФСОЮЗАМИ (v1.8 — цены под 1936)
// ============================================================
export function unionAction(c, unionId, action) {
  const u = (c.unions || []).find(x => x.id === unionId);
  if (!u) return { ok: false, reason: 'Профсоюз не найден' };

  switch (action) {
    case 'negotiate': {
      const cost = 0.02 + (u.strength || 0) * 0.0003;   // 0.02..0.05
      if (c.treasury < cost) return { ok: false, reason: 'Недостаточно средств' };
      c.treasury -= cost;
      u.strength = clamp(u.strength - 3, 0, 100);
      u.radicalism = clamp(u.radicalism - 8, 0, 100);
      u.stance = 'loyal';
      c.approval = clamp(c.approval + 2, 0, 100);
      c.inequality = clamp(c.inequality - 0.01, 0, 1);
      return { ok: true, msg: `Переговоры с «${u.name}» успешны` };
    }
    case 'recognize': {
      if (u.official) return { ok: false, reason: 'Уже признан' };
      u.official = true;
      u.radicalism = clamp(u.radicalism - 15, 0, 100);
      u.strength = clamp(u.strength + 5, 0, 100);
      c.approval = clamp(c.approval + 3, 0, 100);
      c.stability = clamp(c.stability + 2, 0, 100);
      return { ok: true, msg: `«${u.name}» официально признан` };
    }
    case 'subsidize': {
      const cost = 0.05;
      if (c.treasury < cost) return { ok: false, reason: 'Недостаточно средств' };
      c.treasury -= cost;
      u.stance = 'loyal';
      u.strength = clamp(u.strength + 5, 0, 100);
      c.approval = clamp(c.approval + 4, 0, 100);
      c.wage = lerp(c.wage, c.wage * 1.02, 0.1);
      return { ok: true, msg: `Профсоюз «${u.name}» получил субсидию` };
    }
    case 'repress': {
      const penalty = (u.strength || 0) * 0.3;
      u.members = Math.round(u.members * 0.5);
      u.strength = clamp((u.strength || 0) - 30, 0, 100);
      u.radicalism = clamp((u.radicalism || 0) + 20, 0, 100);
      u.stance = 'opposed';
      c.approval = clamp(c.approval - penalty * 0.3, 0, 100);
      c.discontent = clamp(c.discontent + 8, 0, 100);
      c.humanRights = clamp(c.humanRights - 5, 0, 100);
      c.stability = clamp(c.stability - 4, 0, 100);
      return { ok: true, msg: `Профсоюз «${u.name}» разогнан` };
    }
    default:
      return { ok: false, reason: 'Неизвестное действие' };
  }
}

// ============================================================
// ДЕЙСТВИЯ ИГРОКА С АССОЦИАЦИЯМИ (v1.8 — цены под 1936)
// ============================================================
export function assocAction(c, assocId, action) {
  const a = (c.associations || []).find(x => x.id === assocId);
  if (!a) return { ok: false, reason: 'Ассоциация не найдена' };

  switch (action) {
    case 'register': {
      if (a.official) return { ok: false, reason: 'Уже зарегистрирована' };
      a.official = true;
      a.influence = clamp(a.influence + 5, 0, 100);
      c.pressFreedom = clamp(c.pressFreedom + 2, 0, 100);
      c.humanRights = clamp(c.humanRights + 2, 0, 100);
      return { ok: true, msg: `«${a.name}» зарегистрирована` };
    }
    case 'subsidize': {
      const cost = 0.03;
      if (c.treasury < cost) return { ok: false, reason: 'Недостаточно средств' };
      c.treasury -= cost;
      a.stance = 'loyal';
      a.influence = clamp(a.influence + 10, 0, 100);
      // Эффект зависит от типа
      if (a.type === 'intellectual') c.educationLevel = clamp(c.educationLevel + 2, 0, 100);
      if (a.type === 'media') c.pressFreedom = clamp(c.pressFreedom + 3, 0, 100);
      if (a.type === 'women') c.humanRights = clamp(c.humanRights + 3, 0, 100);
      if (a.type === 'veterans') {
        if (!c.military) c.military = { personnel: 0, industry: 0, readiness: 50, mobilization: 30, budgetShare: 0.015 };
        c.military.readiness = clamp(c.military.readiness + 2, 0, 100);
      }
      if (a.type === 'business') c.growth = (c.growth || 0) + 0.0005;
      if (a.type === 'religious') c.stability = clamp(c.stability + 3, 0, 100);
      if (a.type === 'sports') c.happiness = clamp(c.happiness + 2, 0, 100);
      if (a.type === 'peasants') c.approval = clamp(c.approval + 2, 0, 100);
      return { ok: true, msg: `«${a.name}» получила субсидию` };
    }
    case 'ban': {
      a.banned = true;
      a.influence = 0;
      a.members = 0;
      c.pressFreedom = clamp(c.pressFreedom - 5, 0, 100);
      c.humanRights = clamp(c.humanRights - 8, 0, 100);
      c.approval = clamp(c.approval - 4, 0, 100);
      c.discontent = clamp(c.discontent + 5, 0, 100);
      return { ok: true, msg: `«${a.name}» запрещена` };
    }
    default:
      return { ok: false, reason: 'Неизвестное действие' };
  }
}

// ============================================================
// ЕЖЕМЕСЯЧНЫЙ ТИК
// ============================================================
export function tickUnions(c, game) {
  if (!c.unions) c.unions = [];

  for (const u of c.unions) {
    // Рост/сокращение силы
    const ideoMatch = u.ideology === c.ideology;
    // wage*12 — годовой эквивалент, сравниваем с годовым ВВП на душу
    const annualWage = (c.wage || 0) * 12;
    const targetStrength = clamp(
      30 + (c.unemployment > 0.1 ? 25 : 0) + (annualWage < c.gdpPerCapita * 0.4 ? 15 : 0) +
      (ideoMatch ? 15 : -5),
      10, 95
    );
    u.strength = lerp(u.strength, targetStrength, 0.02);

    // Забастовка?
    if (u.strength > 40 && u.radicalism > 60 && c.approval < 45 && chance(0.015)) {
      u.strikes++;
      c.gdp *= 0.997;
      c.approval = clamp(c.approval - 1.5, 0, 100);
      c.unemployment = clamp(c.unemployment + 0.003, 0, 1);
      if (game) game.pushNews('Профсоюз', `Забастовка: «${u.name}»`, 'bad', c.id);
    }

    // Определение отношения
    if (ideoMatch && c.approval > 55) u.stance = 'loyal';
    else if (!ideoMatch && c.approval < 35) u.stance = 'opposed';
    else u.stance = 'neutral';
  }

  // Общий эффект
  const avgRad = c.unions.length ? c.unions.reduce((a, u) => a + u.radicalism * u.strength, 0) / Math.max(c.unions.reduce((a, u) => a + u.strength, 0), 1) : 0;
  if (avgRad > 60) {
    c.inequality = clamp(c.inequality - 0.0005, 0, 1);
  }
}

export function tickAssociations(c, game) {
  if (!c.associations) c.associations = [];

  for (const a of c.associations) {
    if (a.banned) continue;

    // Дрейф влияния
    const drift = gauss(0, 0.3);
    a.influence = clamp(a.influence + drift, 0, 100);

    // Пассивные эффекты от влиятельных ассоциаций
    if (a.influence > 50) {
      const w = (a.influence - 50) / 100; // 0..0.5
      switch (a.type) {
        case 'business': c.growth = (c.growth || 0) + 0.0001 * w; break;
        case 'religious': c.stability = clamp(c.stability + 0.03 * w, 0, 100); break;
        case 'women': c.humanRights = clamp(c.humanRights + 0.02 * w, 0, 100); break;
        case 'veterans':
          if (c.military) c.military.readiness = clamp(c.military.readiness + 0.03 * w, 0, 100);
          break;
        case 'intellectual': c.technology = clamp(c.technology + 0.03 * w, 0, 100); break;
        case 'media': c.pressFreedom = clamp(c.pressFreedom + 0.03 * w, 0, 100); break;
        case 'sports': c.happiness = clamp(c.happiness + 0.02 * w, 0, 100); break;
        case 'ethnic': c.minorityRights = clamp(c.minorityRights + 0.03 * w, 0, 100); break;
        case 'peasants': c.approval = clamp(c.approval + 0.02 * w, 0, 100); break;
      }
    }
  }

  // Пресс-фактор: подавление ассоциаций
  const banned = c.associations.filter(a => a.banned).length;
  if (banned > 2) {
    c.pressFreedom = clamp(c.pressFreedom - 0.1 * (banned - 2), 0, 100);
    c.humanRights = clamp(c.humanRights - 0.1 * (banned - 2), 0, 100);
  }
}
import { randInt, randFloat, pick, chance, gauss, shuffle } from '../core/rng.js';
import { clamp, uid } from '../core/util.js';
import { FIRST_M, FIRST_F, LAST, PARTY_NAMES, PARTY_NAMES_EXTRA, PARTY_COLORS, getSpectrum } from './names.js';

const IDEOLOGY_IDS = [
  'liberal', 'conservative', 'social_democrat', 'socialist',
  'communist', 'nationalist', 'centrist', 'monarchist',
  'agrarian', 'libertarian',
];

// ============================================================
// ДОЛЖНОСТИ
// ============================================================
export const POSITIONS = {
  president:         { name: 'Президент',              icon: '🏛️' },
  prime_minister:    { name: 'Премьер-министр',         icon: '👔' },
  general_secretary: { name: 'Генеральный секретарь',  icon: '🚩' },
  monarch:           { name: 'Монарх',                 icon: '👑' },
  junta_leader:      { name: 'Военный диктатор',       icon: '🎖️' },
};

const DISTRICT_NAMES = [
  'Северный', 'Южный', 'Восточный', 'Западный', 'Центральный',
  'Приморский', 'Горный', 'Степной', 'Лесной', 'Речной',
  'Столичный', 'Промышленный', 'Аграрный', 'Пограничный', 'Островной',
  'Долинный', 'Приозёрный', 'Портовый', 'Северо-Западный', 'Юго-Восточный',
];

// ============================================================
// ПАРТИИ: ТРАДИЦИИ, СИМВОЛЫ, БАЗА
// ============================================================
export const PARTY_TRADITIONS = {
  liberal:        ['свобода рынка', 'гражданские права', 'парламентаризм', 'свободная пресса'],
  conservative:   ['традиции', 'порядок', 'сильная армия', 'церковь'],
  social_democrat:['социальная справедливость', 'профсоюзы', 'государство всеобщего благосостояния', 'равенство'],
  socialist:      ['национализация', 'рабочий класс', 'плановая экономика', 'антиклерикализм'],
  communist:      ['диктатура пролетариата', 'коллективизация', 'антифашизм', 'атеизм'],
  nationalist:    ['нация превыше всего', 'милитаризм', 'антикоммунизм', 'традиционные ценности'],
  centrist:       ['прагматизм', 'компромисс', 'стабильность', 'реформы'],
  monarchist:     ['монархия', 'аристократия', 'традиции', 'порядок'],
  agrarian:       ['крестьянство', 'земля', 'деревня', 'антиурбанизм'],
  libertarian:    ['минимальное государство', 'свобода личности', 'свободный рынок', 'невмешательство'],
};

export const PARTY_SYMBOLS = {
  liberal: '🕊️', conservative: '⚜️', social_democrat: '🌹', socialist: '⚒️',
  communist: '☭', nationalist: '🦅', centrist: '⚖️', monarchist: '👑',
  agrarian: '🌾', libertarian: '🗽',
};

export const PARTY_BASES = {
  liberal:        ['буржуазия', 'интеллигенция', 'горожане'],
  conservative:   ['аристократия', 'духовенство', 'военные'],
  social_democrat:['рабочие', 'профсоюзы', 'интеллигенция'],
  socialist:      ['рабочие', 'крестьяне-бедняки'],
  communist:      ['рабочие', 'беднота'],
  nationalist:    ['военные', 'мелкая буржуазия', 'молодёжь'],
  centrist:       ['средний класс', 'бюрократия'],
  monarchist:     ['аристократия', 'духовенство', 'офицеры'],
  agrarian:       ['крестьяне', 'фермеры'],
  libertarian:    ['предприниматели', 'интеллигенция'],
};

export function generatePartyDescription(ideo) {
  const templates = {
    liberal: 'Партия свободы и прогресса. Выступает за рыночную экономику, гражданские права и парламентскую демократию.',
    conservative: 'Партия порядка и традиций. Защищает церковь, армию и устои общества от революционных потрясений.',
    social_democrat: 'Партия труда и справедливости. Борется за права рабочих, социальные гарантии и равенство.',
    socialist: 'Партия рабочего класса. Требует национализации ключевых отраслей и перераспределения богатства.',
    communist: 'Авангард пролетариата. Цель — революция, диктатура пролетариата и построение социализма.',
    nationalist: 'Партия нации. Защищает суверенитет, армию и традиционные ценности от внешних и внутренних врагов.',
    centrist: 'Партия прагматизма и стабильности. Ищет компромиссы и избегает крайностей.',
    monarchist: 'Партия короны. Защищает монархию, аристократию и традиционный порядок.',
    agrarian: 'Партия земли и крестьянства. Защищает интересы деревни от городской эксплуатации.',
    libertarian: 'Партия свободы. Требует минимального государства, свободного рынка и невмешательства.',
  };
  return templates[ideo] || templates.centrist;
}

// ============================================================
// ГЕНЕРАЦИЯ ЧЕЛОВЕКА
// ============================================================
export function generatePerson(ideology = 'centrist') {
  const female = chance(0.3);
  const name = `${female ? pick(FIRST_F) : pick(FIRST_M)} ${pick(LAST)}`;
  const age = randInt(36, 68);
  return {
    id: uid(),
    name,
    age,
    ideology,
    competence: clamp(Math.round(35 + gauss(0, 18)), 5, 95),
    charisma: clamp(Math.round(35 + gauss(0, 18)), 5, 95),
    loyalty: clamp(Math.round(55 + gauss(0, 18)), 5, 99),
    health: clamp(Math.round(90 - (age - 36) * 0.8 + gauss(0, 5)), 20, 100),
    deathRisk: 0,
  };
}

// ============================================================
// ПОИСК ПЕРСОНАЖА ПО ID
// ============================================================
export function findPersonById(c, id) {
  if (!id) return null;
  if (c.president?.id === id) return c.president;
  if (c.primeMinister?.id === id) return c.primeMinister;
  if (c.monarch?.id === id) return c.monarch;
  if (c.speaker?.id === id) return c.speaker;
  for (const p of c.parties || []) {
    if (p.leader?.id === id) return p.leader;
  }
  for (const p of Object.values(c.cabinet || {})) {
    if (p?.id === id) return p;
  }
  for (const pol of c.politicians || []) {
    if (pol?.id === id) return pol;
  }
  return null;
}

// ============================================================
// ЦЕЛИ ИГРОКА
// ============================================================
export const PARTY_GOAL_TYPES = {
  laws:    { name: 'Принять законы своей идеологии', target: 8,  unit: 'законов' },
  power:   { name: 'Быть у власти',                   target: 5,  unit: 'лет' },
  support: { name: 'Достичь поддержки',               target: 40, unit: '%' },
};

export const PERSON_GOAL_TYPES = {
  years:  { name: 'Быть у власти',   target: 10,   unit: 'лет' },
  laws:   { name: 'Принять законы',  target: 10,   unit: 'законов' },
  legacy: { name: 'Оставить наследие (ВВП/душу)', target: 1000, unit: '$' },
};

export function initPartyGoal(c) {
  if (!c.playerPartyId) return;
  const party = c.parties?.find(p => p.id === c.playerPartyId);
  const currentSupport = Math.round(party?.support || 0);

  const types = Object.keys(PARTY_GOAL_TYPES);
  const type = pick(types);
  const def = PARTY_GOAL_TYPES[type];

  let target = def.target;
  let progress = 0;
  let name = def.name;

  if (type === 'support') {
    target = Math.max(40, currentSupport + 10);
    progress = currentSupport;
    name = `Достичь поддержки ${target}%`;
  } else if (type === 'laws') {
    target = 8;
    progress = (c.laws || []).length;
  } else if (type === 'power') {
    target = 5;
    progress = 0;
  }

  c.playerPartyGoal = { type, target, progress, name, unit: def.unit, _goalCompleted: false };
}

export function initPersonGoal(c) {
  if (!c.playerPersonId) return;
  const types = Object.keys(PERSON_GOAL_TYPES);
  const type = pick(types);
  const def = PERSON_GOAL_TYPES[type];

  let target = def.target;
  let progress = 0;
  let name = def.name;

  if (type === 'years') {
    target = 10;
    progress = 0;
  } else if (type === 'laws') {
    target = 10;
    progress = (c.laws || []).length;
  } else if (type === 'legacy') {
    const current = Math.round(c.gdpPerCapita || 0);
    target = Math.max(1000, current + 500);
    progress = current;
    name = `Достичь ВВП на душу $${target}`;
  }

  c.playerPersonGoal = { type, target, progress, name, unit: def.unit, _goalCompleted: false };
}

export function updatePartyGoalProgress(c) {
  const g = c.playerPartyGoal;
  if (!g) return;
  if (g._goalCompleted) return;

  const party = c.parties?.find(p => p.id === c.playerPartyId);
  if (!party) return;

  if (g.type === 'laws') {
    g.progress = (c.laws || []).length;
  } else if (g.type === 'power') {
    if (c.playerInPower) {
      g.progress = Math.floor(((g._monthsInPower || 0) + 1) / 12);
      g._monthsInPower = (g._monthsInPower || 0) + 1;
    }
  } else if (g.type === 'support') {
    g.progress = Math.round(party.support || 0);
  }

  if (g.progress >= g.target) {
    g._goalCompleted = true;
    c.playerWon = true;
    c.playerWinReason = `Цель партии достигнута: ${g.name} (${g.progress}/${g.target})`;
  }
}

export function updatePersonGoalProgress(c) {
  const g = c.playerPersonGoal;
  if (!g) return;
  if (g._goalCompleted) return;

  if (g.type === 'years') {
    if (c.playerRole) {
      g.progress = Math.floor(((g._monthsInPower || 0) + 1) / 12);
      g._monthsInPower = (g._monthsInPower || 0) + 1;
    }
  } else if (g.type === 'laws') {
    g.progress = (c.laws || []).length;
  } else if (g.type === 'legacy') {
    g.progress = Math.min(g.target, Math.round(c.gdpPerCapita || 0));
  }

  if (g.progress >= g.target) {
    g._goalCompleted = true;
    c.playerWon = true;
    c.playerWinReason = `Цель персонажа достигнута: ${g.name} (${g.progress}/${g.target})`;
  }
}

// ============================================================
// ДЕЙСТВИЯ ОППОЗИЦИИ
// ============================================================
export function oppositionRally(c) {
  if (!c.playerPartyId) return { ok: false, reason: 'Вы не играете за партию' };
  if (c.playerInPower) return { ok: false, reason: 'Вы у власти — митинг не нужен' };
  const cost = 0.02;
  if ((c.treasury || 0) < cost) return { ok: false, reason: 'Недостаточно средств' };
  c.treasury -= cost;
  c.discontent = clamp((c.discontent || 40) + 3, 0, 100);
  c.approval = clamp((c.approval || 50) - 2, 0, 100);
  const party = c.parties?.find(p => p.id === c.playerPartyId);
  if (party) party.support = clamp(party.support + 2, 1, 95);
  return { ok: true, msg: 'Митинг оппозиции: +2% поддержки партии, +3 недовольства' };
}

export function oppositionScandal(c) {
  if (!c.playerPartyId) return { ok: false, reason: 'Вы не играете за партию' };
  if (c.playerInPower) return { ok: false, reason: 'Вы у власти — скандал не нужен' };
  const cost = 0.03;
  if ((c.treasury || 0) < cost) return { ok: false, reason: 'Недостаточно средств' };
  c.treasury -= cost;
  if (!chance(0.5)) {
    return { ok: false, reason: 'Скандал провалился: пресса разоблачила фальшивку' };
  }
  c.approval = clamp((c.approval || 50) - 5, 0, 100);
  c.corruption = clamp((c.corruption || 40) + 1, 0, 100);
  const party = c.parties?.find(p => p.id === c.playerPartyId);
  if (party) party.support = clamp(party.support + 3, 1, 95);
  return { ok: true, msg: 'Скандал удался: −5 одобрения власти, +3% поддержки партии' };
}

export function callVoteOfNoConfidence(c, game) {
  if (!c.playerPartyId) return { ok: false, reason: 'Вы не играете за партию' };
  if (c.playerInPower) return { ok: false, reason: 'Вы у власти' };
  if (!hasMajority(c)) {
    return { ok: false, reason: 'У оппозиции нет большинства для вотума недоверия' };
  }
  const r = impeachPresident(c);
  if (r.ok) {
    c.discontent = clamp((c.discontent || 40) + 5, 0, 100);
    c.stability = clamp((c.stability || 55) - 5, 0, 100);
    if (game) game.pushNews('Парламент', 'Вотум недоверия: правительство отправлено в отставку', 'bad', c.id);
    return { ok: true, msg: 'Вотум недоверия прошёл: правительство в отставке' };
  }
  return { ok: false, reason: r.reason };
}

// ============================================================
// СМЕРТЬ ПЕРСОНАЖА
// ============================================================
export function tickPersonAge(c, game) {
  if (!c.playerPersonId) return;
  const person = findPersonById(c, c.playerPersonId);
  if (!person) return;

  person.age = (person.age || 36) + 1;
  person.health = clamp((person.health || 80) - randInt(0, 3), 0, 100);

  const ageRisk = Math.max(0, (person.age - 60) * 0.005);
  const healthRisk = Math.max(0, (50 - person.health) * 0.002);
  const deathRisk = clamp(ageRisk + healthRisk, 0, 0.20);
  person.deathRisk = deathRisk;

  if (chance(deathRisk)) {
    c.playerLost = true;
    c.playerLoseReason = `${person.name} умер в возрасте ${person.age} лет`;
    if (game) {
      game.pushNews('Смерть', `${person.name} умер в возрасте ${person.age} лет`, 'bad', c.id);
    }
  }
}

// ============================================================
// ГЕНЕРАЦИЯ ДЕПУТАТА
// ============================================================
export function generateDeputy(party, ideology, index, currentYear) {
  const person = generatePerson(ideology);
  const parts = person.name.split(' ');
  const since = currentYear
    ? randInt(Math.max(1928, currentYear - 8), currentYear)
    : randInt(1928, 1935);
  return {
    id: uid(),
    firstName: parts[0] || '—',
    lastName: parts[1] || '',
    name: person.name,
    age: person.age,
    ideology: person.ideology,
    competence: person.competence,
    charisma: person.charisma,
    loyalty: person.loyalty,
    health: person.health,
    partyId: party.id,
    partyName: party.name,
    partyColor: party.color,
    partySymbol: party.symbol,
    district: DISTRICT_NAMES[index % DISTRICT_NAMES.length] + ' округ',
    since,
    voteBias: clamp(gauss(0, 0.15), -0.4, 0.4),
    speeches: 0,
    scandals: 0,
  };
}

function pickPartyName(ideo) {
  const base = PARTY_NAMES[ideo] || PARTY_NAMES.centrist;
  const extra = PARTY_NAMES_EXTRA?.[ideo] || [];
  const all = [...base, ...extra];
  return pick(all);
}

// ============================================================
// ГЕНЕРАЦИЯ ПОЛНОЙ ПАРТИИ
// ============================================================
export function generatePartyFull(ideo, partyName) {
  const spec = getSpectrum(ideo);
  return {
    id: uid(),
    name: partyName,
    ideology: ideo,
    description: generatePartyDescription(ideo),
    traditions: PARTY_TRADITIONS[ideo] || PARTY_TRADITIONS.centrist,
    symbol: PARTY_SYMBOLS[ideo] || '⚖️',
    base: PARTY_BASES[ideo] || PARTY_BASES.centrist,
    spectrum: clamp(spec.position + gauss(0, 0.8), -10, 10),
    spectrumLabel: spec.label,
    spectrumShort: spec.short,
    spectrumColor: spec.color,
    support: 0,
    seats: 0,
    color: PARTY_COLORS[ideo] || '#7a8fb5',
    leader: generatePerson(ideo),
    discipline: clamp(Math.round(45 + gauss(0, 20)), 10, 95),
    funding: Math.round(randFloat(5, 50)),
    founded: randInt(1870, 1935),
    deputies: [],
    // v3.12: регистрация партии
    registered: true,
    // v3.13: партийная программа
    program: [],
  };
}

// ============================================================
// ГЕНЕРАЦИЯ ПАРТИЙ
// ============================================================
export function generateParties(c, ideology) {
  if (c.system === 'one_party' || c.system === 'authoritarian') {
    const party = generatePartyFull(ideology, pickPartyName(ideology));
    party.support = 100;
    party.seats = c.seatsTotal || 100;
    party.discipline = 90;
    party.funding = 100;
    party.founded = randInt(1900, 1935);
    party.isRuling = true;
    party.deputies = Array.from({ length: party.seats }, (_, i) =>
      generateDeputy(party, ideology, i)
    );
    c.parties = [party];
    c.rulingPartyId = party.id;
    c.coalition = [party.id];
    return c.parties;
  }

  const n = randInt(3, 6);
  const pool = shuffle([...IDEOLOGY_IDS]).slice(0, n);
  if (!pool.includes(ideology)) pool[0] = ideology;

  const usedNames = new Set();
  const parties = pool.map((ideo) => {
    let name = pickPartyName(ideo);
    let attempts = 0;
    while (usedNames.has(name) && attempts < 10) {
      name = pickPartyName(ideo);
      attempts++;
    }
    usedNames.add(name);
    const party = generatePartyFull(ideo, name);
    party.support = randFloat(8, 38);
    return party;
  });

  const total = parties.reduce((a, p) => a + p.support, 0);
  for (const p of parties) p.support = (p.support / total) * 100;

  c.parties = parties;
  assignSeats(c);

  for (const p of parties) {
    p.deputies = Array.from({ length: p.seats }, (_, i) =>
      generateDeputy(p, p.ideology, i)
    );
  }
  return parties;
}

export function assignSeats(c) {
  const threshold = 5;
  const eligible = c.parties.filter(p => p.support >= threshold);
  const totalSupport = eligible.reduce((a, p) => a + p.support, 0) || 1;
  let allocated = 0;
  for (const p of c.parties) p.seats = 0;
  for (const p of eligible) {
    p.seats = Math.floor((p.support / totalSupport) * c.seatsTotal);
    allocated += p.seats;
  }
  let remainder = c.seatsTotal - allocated;
  const sorted = [...eligible].sort((a, b) =>
    ((b.support / totalSupport) * c.seatsTotal) % 1 -
    ((a.support / totalSupport) * c.seatsTotal) % 1
  );
  let i = 0;
  while (remainder > 0 && sorted.length) {
    sorted[i % sorted.length].seats++;
    remainder--;
    i++;
  }
}

// ============================================================
// ХЕЛПЕРЫ ДЛЯ ДЕПУТАТОВ
// ============================================================
export function getDeputiesByParty(c) {
  return (c.parties || []).map(p => ({ party: p, deputies: p.deputies || [] }));
}

export function getAllDeputies(c) {
  return (c.parties || []).flatMap(p => p.deputies || []);
}

export function getDeputyById(c, deputyId) {
  for (const p of c.parties || []) {
    const d = (p.deputies || []).find(x => x.id === deputyId);
    if (d) return d;
  }
  return null;
}

export function regenerateDeputies(c) {
  const year = c._date?.year || 1936;
  for (const p of c.parties || []) {
    p.deputies = Array.from({ length: p.seats }, (_, i) =>
      generateDeputy(p, p.ideology, i, year)
    );
  }
}

// ============================================================
// КАБИНЕТ
// ============================================================
export function generateCabinet(c) {
  const roles = ['finance', 'defense', 'foreign', 'interior', 'education', 'health', 'economy', 'justice'];
  const cabinet = {};
  for (const role of roles) {
    cabinet[role] = { ...generatePerson(c.ideology), role };
  }

  if (c.system === 'parliamentary' || c.system === 'semi_presidential') {
    c.primeMinister = {
      ...generatePerson(c.ideology),
      partyId: c.parties?.[0]?.id || null,
      since: { year: 1936, month: 1, day: 1 },
    };
  }

  if (c.government === 'constitutional_monarchy' || c.government === 'absolute_monarchy') {
    c.monarch = {
      ...generatePerson(c.ideology),
      name: `Король ${pick(FIRST_M)} ${pick(LAST)}`,
      age: randInt(40, 75),
      partyId: null,
      since: { year: 1936, month: 1, day: 1 },
    };
  }

  return cabinet;
}

export const MINISTRY_LABELS = {
  finance: 'Министр финансов',
  defense: 'Министр обороны',
  foreign: 'Министр иностранных дел',
  interior: 'Министр внутренних дел',
  education: 'Министр образования',
  health: 'Министр здравоохранения',
  economy: 'Министр экономики',
  justice: 'Министр юстиции',
};

// ============================================================
// ГЛАВА ГОСУДАРСТВА
// ============================================================
export function getHeadOfState(c) {
  let result;
  if (c.system === 'one_party') {
    result = { position: 'general_secretary', person: c.president, partyId: c.president?.partyId };
  } else if (c.system === 'authoritarian' || c.government === 'military_junta') {
    result = { position: 'junta_leader', person: c.president, partyId: c.president?.partyId };
  } else if (c.government === 'constitutional_monarchy' || c.government === 'absolute_monarchy') {
    result = { position: 'monarch', person: c.monarch || c.president, partyId: null };
  } else if (c.system === 'parliamentary' || c.system === 'semi_presidential') {
    result = { position: 'prime_minister', person: c.primeMinister || c.president, partyId: c.primeMinister?.partyId || c.president?.partyId };
  } else {
    result = { position: 'president', person: c.president, partyId: c.president?.partyId };
  }
  result.isPlayer = !!(c.playerPersonId && result.person?.id === c.playerPersonId);
  result.hasPlayer = !!c.playerPersonId;
  return result;
}

export function getHeadTitle(c) {
  const h = getHeadOfState(c);
  return POSITIONS[h.position]?.name || 'Глава государства';
}

// ============================================================
// СПИКЕР
// ============================================================
export function electSpeaker(c, game) {
  if (!c.parties || !c.parties.length) return null;
  const sorted = [...c.parties].sort((a, b) => b.seats - a.seats);

  const fromLargest = chance(0.65);
  const speakerParty = fromLargest ? sorted[0] : (sorted[1] || sorted[0]);
  const person = generatePerson(speakerParty.ideology);

  c.speaker = {
    ...person,
    partyId: speakerParty.id,
    partyName: speakerParty.name,
    color: speakerParty.color,
    symbol: speakerParty.symbol,
    since: { ...(game?.date || { year: 1936, month: 1, day: 1 }) },
  };

  if (game) {
    game.pushNews('Парламент', `${person.name} избран председателем парламента`, 'info', c.id);
  }
  return c.speaker;
}

// ============================================================
// ЕЖЕМЕСЯЧНЫЙ ТИК ПОЛИТИКИ
// ============================================================
export function tickPolitics(c, game) {
  c.parties = c.parties || [];
  c.coalition = c.coalition || [];

  for (const p of c.parties) {
    const drift = gauss(0, 0.25);
    const isRuling = p.id === c.rulingPartyId;
    // FIX: guard от undefined approval — иначе NaN в support
    const approval = Number.isFinite(c.approval) ? c.approval : 50;
    const ideologyBonus = isRuling ? (approval - 50) * 0.02 : 0;
    p.support = clamp(p.support + drift + ideologyBonus, 1, 90);

    if (typeof p.discipline === 'number') {
      p.discipline = clamp(p.discipline + gauss(0, 0.5), 10, 95);
    }
    if (typeof p.funding === 'number') {
      p.funding = clamp(p.funding + gauss(0, 1), 0, 200);
    }
  }
  const total = c.parties.reduce((a, p) => a + p.support, 0) || 1;
  for (const p of c.parties) p.support = (p.support / total) * 100;

  c.monthsInTerm = (c.monthsInTerm || 0) + 1;
  if (c.monthsInTerm >= (c.termMonths || 48) && c.system !== 'one_party' && c.system !== 'authoritarian') {
    if (c.system === 'presidential' || c.system === 'semi_presidential') runPresidentialElection(c, game);
    if (c.system === 'parliamentary' || c.system === 'semi_presidential') runParliamentaryElection(c, game);
    c.monthsInTerm = 0;
  }

  const financeCompetence = c.cabinet?.finance?.competence ?? 50;
  c.presidentApproval = clamp((approval) + financeCompetence * 0.1 - 5, 2, 98);

  const corrTarget = clamp(
    65 - (c.judicialIndependence || 50) * 0.25 - (c.pressFreedom || 50) * 0.18 - (c.educationLevel || 30) * 0.1 - (c.gdpPerCapita || 100) / 900,
    2, 92
  );
  c.corruption = clamp((c.corruption || 50) + (corrTarget - (c.corruption || 50)) * 0.01, 2, 92);

  // v3.12: восстановление кабинета после отставки
  if (!c.cabinet || Object.keys(c.cabinet).length === 0) {
    c.cabinet = generateCabinet(c);
    if (game) game.pushNews('Правительство', 'Сформирован новый кабинет министров', 'info', c.id);
  }

  if (!c.speaker && c.parties.length) {
    electSpeaker(c, game);
  }

  if (c.playerPersonId) {
    const head = getHeadOfState(c);
    c.playerRole = (head.person?.id === c.playerPersonId) ? head.position : null;
    c.playerInPower = (c.playerRole !== null);
  }

  if (c.playerPartyGoal) updatePartyGoalProgress(c);
  if (c.playerPersonGoal) updatePersonGoalProgress(c);

  // v3.3: конституционный кризис
  if (c.constitutionalCrisis) tickConstitutionalCrisis(c, game);

  // v3.13: политическая конкуренция
  tickCompetition(c, game);
}

// ============================================================
// ВЫБОРЫ
// ============================================================
export function runParliamentaryElection(c, game) {
  if (c.system === 'one_party' || c.system === 'authoritarian') {
    if (c.parties.length === 1) {
      c.parties[0].support = 100;
      c.parties[0].seats = c.seatsTotal;
      regenerateDeputies(c);
    }
    if (game) game.pushNews('Выборы', `Фиктивные выборы в ${c.shortName}: власть подтверждена`, 'info', c.id);
    return;
  }

  const oldPMId = c.primeMinister?.id || null;

  for (const p of c.parties) {
    let swing = gauss(0, 2.5);
    const isRuling = p.id === c.rulingPartyId;
    if (isRuling) swing += ((c.approval || 50) - 50) * 0.18;
    if (p.ideology === 'communist' && c.unemployment > 0.12) swing += 2;
    if (p.ideology === 'nationalist' && c.inflation > 0.1) swing += 2.5;
    p.support = clamp(p.support + swing, 1, 92);
  }
  const total = c.parties.reduce((a, p) => a + p.support, 0) || 1;
  for (const p of c.parties) p.support = (p.support / total) * 100;
  assignSeats(c);
  formCoalition(c);
  electSpeaker(c, game);
  regenerateDeputies(c);

  if (c.system === 'parliamentary' || c.system === 'semi_presidential') {
    const ruling = c.parties.find(p => p.id === c.rulingPartyId);
    if (ruling) {
      c.primeMinister = {
        ...ruling.leader,
        partyId: ruling.id,
        since: { ...(game?.date || { year: 1936, month: 1, day: 1 }) },
      };
    }
  }

  if (c.playerPartyId) {
    // FIX: coalition может быть undefined после смены системы
    c.playerInPower = (c.coalition || []).includes(c.playerPartyId);
  }
  if (c.playerPersonId) {
    const newPMId = c.primeMinister?.id || null;
    if (oldPMId === c.playerPersonId && newPMId !== c.playerPersonId) {
      c.playerRole = null;
      c.playerInPower = false;
    } else if (newPMId === c.playerPersonId) {
      c.playerRole = 'prime_minister';
      c.playerInPower = true;
    }
  }

  if (game) game.pushNews('Выборы', `Прошли парламентские выборы в ${c.shortName}`, 'info', c.id);
}

export function runPresidentialElection(c, game) {
  if (!c.parties.length) return;

  if (c.system === 'one_party' || c.system === 'authoritarian') {
    const ruling = c.parties[0];
    if (!ruling) return;
    c.president = {
      ...ruling.leader,
      partyId: ruling.id,
      since: { ...(game?.date || { year: 1936, month: 1, day: 1 }) },
    };
    c.ideology = ruling.ideology;
    if (c.playerPersonId) {
      c.playerRole = (c.president?.id === c.playerPersonId) ? 'general_secretary' : null;
      c.playerInPower = (c.playerRole !== null);
    }
    if (game) game.pushNews('Выборы', `${ruling.leader.name} подтвердил полномочия главы ${c.shortName}`, 'info', c.id);
    return;
  }

  const candidates = c.parties.map(p => ({
    party: p,
    candidate: p.leader,
    score: p.support + p.leader.charisma * 0.4 + gauss(0, 6) + (p.ideology === c.ideology ? ((c.approval || 50) - 50) * 0.2 : 0),
  })).sort((a, b) => b.score - a.score);

  const winner = candidates[0];
  if (!winner) return;
  const date = game?.date || { year: 1936, month: 1, day: 1 };
  c.president = {
    ...winner.candidate,
    partyId: winner.party.id,
    since: { ...date },
  };
  c.ideology = winner.party.ideology;

  if (c.playerPartyId) {
    c.playerInPower = (winner.party.id === c.playerPartyId);
  }
  if (c.playerPersonId) {
    if (winner.candidate?.id === c.playerPersonId) {
      c.playerRole = 'president';
      c.playerInPower = true;
    } else {
      c.playerRole = null;
      c.playerInPower = false;
    }
  }

  if (game) game.pushNews('Выборы', `${winner.candidate.name} избран главой ${c.shortName}`, 'info', c.id);
}

// ============================================================
// КОАЛИЦИЯ И БОЛЬШИНСТВО
// ============================================================
export function formCoalition(c) {
  const sorted = [...c.parties].sort((a, b) => b.seats - a.seats);
  const needed = Math.floor(c.seatsTotal / 2) + 1;
  const coalition = [];
  let seats = 0;
  for (const p of sorted) {
    coalition.push(p.id);
    seats += p.seats;
    if (seats >= needed) break;
  }
  c.coalition = coalition;
  c.rulingPartyId = sorted[0]?.id || null;
  return coalition;
}

export function hasMajority(c) {
  const seats = c.parties
    .filter(p => (c.coalition || []).includes(p.id))
    .reduce((a, p) => a + p.seats, 0);
  return seats > c.seatsTotal / 2;
}

// ============================================================
// КАБИНЕТ
// ============================================================
export function appointMinister(c, role, person) {
  if (!c.cabinet || !c.cabinet[role]) return false;
  c.cabinet[role] = { ...person, role };
  return true;
}

// ============================================================
// ИМПИЧМЕНТ
// ============================================================
export function impeachPresident(c) {
  if (!hasMajority(c)) return { ok: false, reason: 'Нет большинства в парламенте' };
  if (c.approval > 40) return { ok: false, reason: 'Недостаточно оснований: одобрение слишком высокое' };
  if (!c.president) return { ok: false, reason: 'Президент не найден' };

  if (c.system === 'one_party' || c.system === 'authoritarian') {
    return { ok: false, reason: 'Импичмент невозможен при этой системе' };
  }

  const parties = [...c.parties].sort((a, b) => b.support - a.support);
  const newParty = parties.find(p => p.id !== c.president.partyId) || parties[0];
  if (!newParty) return { ok: false, reason: 'Нет альтернативной партии' };

  const playerWasPresident = c.playerPersonId && c.president?.id === c.playerPersonId;

  c.president = {
    ...(newParty.leader || generatePerson(newParty.ideology)),
    partyId: newParty.id,
    since: { ...(c.president.since || {}), day: 1 },
  };
  c.stability = clamp(c.stability - 8, 0, 100);
  c.approval = clamp(c.approval - 5, 0, 100);

  if (c.playerPartyId) {
    c.playerInPower = (newParty.id === c.playerPartyId);
  }
  if (playerWasPresident) {
    c.playerRole = null;
    c.playerInPower = false;
  }

  return { ok: true };
}

export function callSnapElection(c, game) {
  if (c.system === 'one_party' || c.system === 'authoritarian') {
    return { ok: false, reason: 'Выборы невозможны при этой системе' };
  }
  runParliamentaryElection(c, game);
  c.monthsInTerm = 0;
  return { ok: true };
}

// ============================================================
// ДЕЙСТВИЯ С ПАРТИЯМИ
// ============================================================
export function changePartyLeader(c, partyId) {
  const p = c.parties.find(x => x.id === partyId);
  if (!p) return { ok: false, reason: 'Партия не найдена' };
  const oldLeaderId = p.leader?.id || null;
  const newLeader = generatePerson(p.ideology);
  p.leader = newLeader;
  p.support = clamp(p.support + gauss(0, 2), 1, 90);
  if (c.playerPersonId && oldLeaderId === c.playerPersonId) {
    const head = getHeadOfState(c);
    if (head.person?.id !== c.playerPersonId) {
      c.playerRole = null;
      c.playerInPower = false;
    }
  }
  return { ok: true, leader: newLeader };
}

export function fundParty(c, partyId, amount) {
  const p = c.parties.find(x => x.id === partyId);
  if (!p) return { ok: false, reason: 'Партия не найдена' };
  if (c.playerPartyId && partyId !== c.playerPartyId) {
    return { ok: false, reason: 'Можно финансировать только свою партию' };
  }
  if (!(amount > 0)) return { ok: false, reason: 'Сумма должна быть > 0' };
  if ((c.treasury || 0) < amount) return { ok: false, reason: 'Недостаточно средств' };
  c.treasury -= amount;
  p.funding = (p.funding || 0) + amount * 200;
  p.support = clamp(p.support + amount * 30, 1, 95);
  p.discipline = clamp((p.discipline || 50) + 2, 10, 95);
  return { ok: true };
}

export function mergeParty(c, fromPartyId, intoPartyId) {
  if (fromPartyId === intoPartyId) return { ok: false, reason: 'Нельзя слить с самой собой' };
  const fromP = c.parties.find(p => p.id === fromPartyId);
  const intoP = c.parties.find(p => p.id === intoPartyId);
  if (!fromP || !intoP) return { ok: false, reason: 'Партия не найдена' };
  if (c.playerPartyId && fromPartyId === c.playerPartyId && intoPartyId !== c.playerPartyId) {
    return { ok: false, reason: 'Нельзя слить свою партию в чужую' };
  }

  intoP.support += fromP.support * 0.7;
  intoP.funding = (intoP.funding || 0) + (fromP.funding || 0) * 0.5;

  // FIX: перенесённые депутаты должны получить partyId/partyName/partyColor/partySymbol новой партии
  const movedDeputies = (fromP.deputies || []).map(d => ({
    ...d,
    partyId: intoP.id,
    partyName: intoP.name,
    partyColor: intoP.color,
    partySymbol: intoP.symbol,
  }));
  intoP.deputies = [...(intoP.deputies || []), ...movedDeputies];

  c.parties = c.parties.filter(p => p.id !== fromPartyId);
  assignSeats(c);
  if (c.playerPartyId && fromPartyId === c.playerPartyId) {
    c.playerPartyId = intoPartyId;
  }
  return { ok: true };
}

export function boostParty(c, partyId) {
  const p = c.parties.find(x => x.id === partyId);
  if (!p) return { ok: false, reason: 'Партия не найдена' };
  if (c.playerPartyId && partyId !== c.playerPartyId) {
    return { ok: false, reason: 'Можно проводить кампанию только для своей партии' };
  }
  const cost = 0.08;
  if ((c.treasury || 0) < cost) return { ok: false, reason: 'Недостаточно средств' };
  c.treasury -= cost;
  p.support = clamp(p.support + 3, 1, 95);
  p.funding = (p.funding || 0) + 10;
  return { ok: true };
}

// ============================================================
// РОСПУСК ПАРТИИ
// ============================================================
export function dissolveParty(c, partyId) {
  if (c.system !== 'authoritarian') {
    return { ok: false, reason: 'Только при авторитарной системе' };
  }
  if ((c.parties || []).length <= 1) {
    return { ok: false, reason: 'Нельзя распустить последнюю партию' };
  }
  const party = c.parties.find(p => p.id === partyId);
  if (!party) return { ok: false, reason: 'Партия не найдена' };
  if (party.id === c.rulingPartyId) {
    return { ok: false, reason: 'Нельзя распустить правящую партию' };
  }
  if (c.playerPartyId && partyId === c.playerPartyId) {
    return { ok: false, reason: 'Нельзя распустить свою партию' };
  }

  c.parties = c.parties.filter(p => p.id !== partyId);
  c.coalition = (c.coalition || []).filter(id => id !== partyId);
  c.discontent = clamp((c.discontent || 40) + 3, 0, 100);
  c.humanRights = clamp((c.humanRights || 50) - 2, 0, 100);
  c.pressFreedom = clamp((c.pressFreedom || 50) - 3, 0, 100);
  return { ok: true, msg: `Партия «${party.name}» распущена` };
}

// ============================================================
// СОЗДАНИЕ ПАРТИИ
// ============================================================
export function createParty(c, { name, ideology } = {}) {
  if (c.system === 'one_party' || c.system === 'authoritarian') {
    return { ok: false, reason: 'При этой системе нельзя создавать партии' };
  }
  if ((c.parties || []).length >= 8) {
    return { ok: false, reason: 'Слишком много партий (макс 8)' };
  }

  const ideo = ideology && IDEOLOGY_IDS.includes(ideology) ? ideology : pick(IDEOLOGY_IDS);
  const partyName = name || pickPartyName(ideo);

  if (c.parties.some(p => p.name === partyName)) {
    return { ok: false, reason: 'Партия с таким названием уже существует' };
  }

  const newParty = generatePartyFull(ideo, partyName);
  newParty.support = randFloat(2, 10);
  newParty.founded = c._date?.year || 1936;
  // v3.12: новая партия не зарегистрирована — нужна регистрация
  newParty.registered = false;

  c.parties.push(newParty);
  assignSeats(c);
  regenerateDeputies(c);
  c.discontent = clamp((c.discontent || 40) - 2, 0, 100);
  c.pressFreedom = clamp((c.pressFreedom || 50) + 2, 0, 100);

  return { ok: true, party: newParty, msg: `Создана партия «${partyName}». Требуется регистрация.` };
}

// ============================================================
// v3.12: РЕГИСТРАЦИЯ ПАРТИИ
// ============================================================
export function registerParty(c, partyId) {
  const p = (c.parties || []).find(x => x.id === partyId);
  if (!p) return { ok: false, reason: 'Партия не найдена' };
  if (p.registered) return { ok: false, reason: 'Партия уже зарегистрирована' };

  const cost = 0.02;
  if ((c.treasury || 0) < cost) return { ok: false, reason: 'Недостаточно средств ($0.02)' };

  c.treasury -= cost;
  p.registered = true;
  p.support = clamp((p.support || 0) + 5, 1, 95);
  p.funding = (p.funding || 0) + 1;
  c.humanRights = clamp((c.humanRights || 50) + 1, 0, 100);
  c.pressFreedom = clamp((c.pressFreedom || 50) + 1, 0, 100);

  return { ok: true, msg: `Партия «${p.name}» зарегистрирована (+5% поддержки)` };
}

// ============================================================
// v3.12: ОТСТАВКА ПРАВИТЕЛЬСТВА
// ============================================================
export function dismissGovernment(c, game) {
  if (c.system === 'one_party' || c.system === 'authoritarian') {
    return { ok: false, reason: 'При этой системе правительство не может уйти в отставку' };
  }
  if (c.constitutionalCrisis) {
    return { ok: false, reason: 'Во время конституционного кризиса нельзя' };
  }

  c.approval = clamp((c.approval || 50) - 10, 0, 100);
  c.discontent = clamp((c.discontent || 40) + 5, 0, 100);
  c.stability = clamp((c.stability || 55) - 5, 0, 100);
  c.presidentApproval = clamp((c.presidentApproval || 50) - 8, 0, 100);

  c.cabinet = {};

  if (c.system === 'parliamentary' || c.system === 'semi_presidential') {
    c.primeMinister = null;
  }

  c.speaker = null;

  if (game) {
    game.pushNews('Правительство', `Правительство отправлено в отставку`, 'bad', c.id);
  }

  return { ok: true, msg: 'Правительство отправлено в отставку: −10 одобрения, −5 стабильности' };
}

// ============================================================
// v3.13: РЕФЕРЕНДУМЫ
// ============================================================
export const REFERENDUM_QUESTIONS = [
  {
    id: 'death_penalty',
    question: 'Ввести смертную казнь?',
    options: ['За', 'Против'],
    effect: { humanRights: -8, crimeRate: -5, approval: 2, stability: 2 },
    effectIfAgainst: { humanRights: 5, crimeRate: 2, approval: -1 },
  },
  {
    id: 'free_press',
    question: 'Гарантировать свободу прессы?',
    options: ['За', 'Против'],
    effect: { pressFreedom: 15, humanRights: 5, approval: -2, stability: -2, corruption: -3 },
    effectIfAgainst: { pressFreedom: -10, stability: 3, approval: -3, corruption: 2 },
  },
  {
    id: 'womens_suffrage',
    question: 'Дать женщинам право голоса?',
    options: ['За', 'Против'],
    effect: { humanRights: 10, educationLevel: 4, approval: 2, minorityRights: 5 },
    effectIfAgainst: { humanRights: -5, approval: -2 },
  },
  {
    id: 'labor_rights',
    question: 'Ввести 8-часовой рабочий день?',
    options: ['За', 'Против'],
    effect: { approval: 5, happiness: 3, inequality: -0.05, stability: -1 },
    effectIfAgainst: { approval: -3, inequality: 0.02, growth: 0.0005 },
  },
  {
    id: 'universal_healthcare',
    question: 'Ввести бесплатную медицину?',
    options: ['За', 'Против'],
    effect: { healthcareLevel: 10, approval: 6, happiness: 4, poverty: -0.03, treasury: -0.02 },
    effectIfAgainst: { approval: -3, treasury: 0.02 },
  },
  {
    id: 'military_service',
    question: 'Ввести всеобщую воинскую обязанность?',
    options: ['За', 'Против'],
    effect: { stability: -3, approval: -4, military: { readiness: 8, mobilization: 15 } },
    effectIfAgainst: { approval: 2, military: { readiness: -3 } },
  },
  {
    id: 'gold_standard',
    question: 'Вернуться к золотому стандарту?',
    options: ['За', 'Против'],
    effect: { goldStandard: true, inflation: -0.02, growth: -0.0005 },
    effectIfAgainst: { goldStandard: false, inflation: 0.01, growth: 0.0008 },
  },
  {
    id: 'eu_membership',
    question: 'Вступить в Всемирную Лигу?',
    options: ['За', 'Против'],
    effect: { reputation: 5, influence: 5, approval: -1 },
    effectIfAgainst: { reputation: -3, influence: -3, stability: 3 },
  },
];

export function startReferendum(c, questionId) {
  if (c.referendum) {
    return { ok: false, reason: 'Референдум уже идёт' };
  }
  const q = REFERENDUM_QUESTIONS.find(x => x.id === questionId);
  if (!q) return { ok: false, reason: 'Вопрос не найден' };

  const cost = 0.05;
  if ((c.treasury || 0) < cost) return { ok: false, reason: 'Недостаточно средств ($0.05)' };
  c.treasury -= cost;

  c.referendum = {
    questionId: q.id,
    question: q.question,
    options: q.options,
    votes: [0, 0],
    daysLeft: 7,
    startedAt: { ...(c._date || { year: 1936, month: 1, day: 1 }) },
    effect: q.effect,
    effectIfAgainst: q.effectIfAgainst,
  };

  return { ok: true, referendum: c.referendum };
}

export function tickReferendum(c, game) {
  const ref = c.referendum;
  if (!ref) return;

  const approval = c.approval || 50;
  const forChance = 0.5 + (approval - 50) / 200 + gauss(0, 0.1);
  const totalVoters = Math.round((c.population || 1000000) / 1000);
  const forVotes = Math.round(totalVoters * clamp(forChance, 0.1, 0.9));
  const againstVotes = totalVoters - forVotes;
  ref.votes[0] = forVotes;
  ref.votes[1] = againstVotes;

  ref.daysLeft -= 1;

  if (ref.daysLeft <= 0) {
    resolveReferendum(c, game);
  }
}

export function resolveReferendum(c, game) {
  const ref = c.referendum;
  if (!ref) return { ok: false, reason: 'Референдума нет' };

  const forVotes = ref.votes[0];
  const againstVotes = ref.votes[1];
  const passed = forVotes > againstVotes;

  const effect = passed ? ref.effect : ref.effectIfAgainst;
  if (effect) {
    applyReferendumEffect(c, effect);
  }

  if (game) {
    game.pushNews('Референдум',
      `Референдум «${ref.question}»: ${passed ? 'ПРИНЯТ' : 'ОТКЛОНЁН'} (${forVotes} / ${againstVotes})`,
      passed ? 'good' : 'bad', c.id);
  }

  c.referendum = null;
  return { ok: true, passed, forVotes, againstVotes };
}

// FIX: карта лимитов для applyReferendumEffect — раньше crimeRate и др. получали max=1
const EFFECT_LIMITS = {
  approval: 100,
  stability: 100,
  humanRights: 100,
  pressFreedom: 100,
  healthcareLevel: 100,
  educationLevel: 100,
  minorityRights: 100,
  crimeRate: 100,
  corruption: 100,
  infrastructure: 100,
  judicialIndependence: 100,
  reputation: 100,
  influence: 100,
  happiness: 100,
  literacy: 1,
  inequality: 1,
  poverty: 1,
  shadowEconomy: 1,
  growth: 1,
  inflation: 1,
  unemployment: 1,
  publicSectorShare: 1,
};

function applyReferendumEffect(c, effect) {
  if (!effect) return;
  for (const [k, v] of Object.entries(effect)) {
    if (k === 'military' && c.military) {
      for (const [mk, mv] of Object.entries(v)) {
        const cur = (c.military[mk] || 0) + mv;
        c.military[mk] = mk === 'personnel' ? Math.max(0, cur) : clamp(cur, 0, 100);
      }
      continue;
    }
    if (k === 'treasury') { c.treasury += v; continue; }
    if (k === 'goldStandard') { c.goldStandard = v; continue; }
    if (k === 'taxes' && c.taxes) {
      for (const [tk, tv] of Object.entries(v)) {
        c.taxes[tk] = clamp((c.taxes[tk] || 0) + tv, 0, 1);
      }
      continue;
    }
    if (k === 'spending' && c.spending) {
      for (const [sk, sv] of Object.entries(v)) {
        c.spending[sk] = clamp((c.spending[sk] || 0) + sv, 0, 1);
      }
      continue;
    }
    if (typeof c[k] === 'number') {
      // FIX: лимит берётся из карты, по умолчанию 100
      const max = EFFECT_LIMITS[k] ?? 100;
      c[k] = clamp(c[k] + v, 0, max);
    }
  }
}

// ============================================================
// v3.13: ПАРТИЙНЫЕ ПРОГРАММЫ
// ============================================================
export const PROGRAM_POINTS = [
  { id: 'tax_cut',        name: 'Снижение налогов',       ideology: 'liberal',        effect: { taxes: { income: -0.02 }, approval: 2 } },
  { id: 'tax_hike',       name: 'Повышение налогов',      ideology: 'social_democrat', effect: { taxes: { income: 0.02 }, treasury: 0.02 } },
  { id: 'spend_social',   name: 'Социальные расходы',     ideology: 'social_democrat', effect: { spending: { social: 0.005 }, approval: 3 } },
  { id: 'spend_military', name: 'Военные расходы',        ideology: 'nationalist',     effect: { spending: { military: 0.005 }, military: { readiness: 3 } } },
  { id: 'spend_education',name: 'Образование',            ideology: 'social_democrat', effect: { spending: { education: 0.005 }, educationLevel: 2 } },
  { id: 'spend_health',   name: 'Медицина',               ideology: 'social_democrat', effect: { spending: { healthcare: 0.005 }, healthcareLevel: 2 } },
  { id: 'spend_infra',    name: 'Инфраструктура',         ideology: 'centrist',        effect: { spending: { infrastructure: 0.005 }, infrastructure: 3 } },
  { id: 'free_market',    name: 'Свободный рынок',        ideology: 'liberal',         effect: { growth: 0.0005, inequality: 0.02 } },
  { id: 'nationalize',    name: 'Национализация',         ideology: 'socialist',       effect: { publicSectorShare: 0.05, approval: 2, growth: -0.0005 } },
  { id: 'strong_state',   name: 'Сильное государство',    ideology: 'conservative',    effect: { stability: 3, humanRights: -2 } },
  { id: 'free_press',     name: 'Свобода прессы',         ideology: 'liberal',         effect: { pressFreedom: 5, corruption: -2 } },
  { id: 'traditional',    name: 'Традиционные ценности',  ideology: 'conservative',    effect: { stability: 2, minorityRights: -3 } },
  { id: 'isolationism',   name: 'Изоляционизм',           ideology: 'nationalist',     effect: { influence: -3, stability: 3 } },
  { id: 'internationalism', name: 'Интернационализм',     ideology: 'liberal',         effect: { influence: 3, reputation: 3 } },
];

export function setPartyProgram(c, partyId, programIds) {
  const p = (c.parties || []).find(x => x.id === partyId);
  if (!p) return { ok: false, reason: 'Партия не найдена' };
  if (!Array.isArray(programIds) || programIds.length === 0) {
    return { ok: false, reason: 'Выберите хотя бы 1 пункт' };
  }
  if (programIds.length > 3) return { ok: false, reason: 'Максимум 3 пункта программы' };

  const valid = programIds.filter(id => PROGRAM_POINTS.find(pp => pp.id === id));
  if (valid.length !== programIds.length) return { ok: false, reason: 'Неизвестный пункт' };

  p.program = valid;
  p.support = clamp((p.support || 0) + 2, 1, 95);
  return { ok: true, msg: `Программа партии «${p.name}» обновлена` };
}

// ============================================================
// v3.13: ПОЛИТИЧЕСКАЯ КОНКУРЕНЦИЯ
// ============================================================
export function tickCompetition(c, game) {
  if (!Number.isFinite(c.competition)) c.competition = 50;

  const pressFreedom = c.pressFreedom || 50;
  const humanRights = c.humanRights || 50;
  const corruption = c.corruption || 50;
  const isOneParty = c.system === 'one_party' || c.system === 'authoritarian';

  let target;
  if (isOneParty) {
    target = 5 + pressFreedom * 0.05;
  } else {
    target = pressFreedom * 0.3 + humanRights * 0.3 + (100 - corruption) * 0.2 + 20;
  }
  target = clamp(target, 0, 100);

  c.competition = clamp((c.competition || 50) + (target - (c.competition || 50)) * 0.05, 0, 100);

  if (c.competition > 60) {
    for (const p of c.parties || []) {
      if (p.id !== c.rulingPartyId) {
        p.support = clamp(p.support + 0.3, 1, 95);
      }
    }
  } else if (c.competition < 30) {
    for (const p of c.parties || []) {
      if (p.id === c.rulingPartyId) {
        p.support = clamp(p.support + 0.5, 1, 95);
      }
    }
  }
}

export function getCompetitionLabel(c) {
  // FIX: NaN не должен попадать — fallback 50
  const comp = Number.isFinite(c.competition) ? c.competition : 50;
  if (comp >= 80) return { name: 'Высокая', icon: '🟢', color: 'var(--green)' };
  if (comp >= 60) return { name: 'Умеренная', icon: '🟡', color: 'var(--gold)' };
  if (comp >= 40) return { name: 'Средняя', icon: '🟠', color: '#e6a23c' };
  if (comp >= 20) return { name: 'Низкая', icon: '🔴', color: 'var(--red)' };
  return { name: 'Отсутствует', icon: '⛔', color: 'var(--red)' };
}

// ============================================================
// СМЕНА СИСТЕМЫ — v3.3: через конституционный кризис
// ============================================================
const VALID_SYSTEMS = ['presidential', 'parliamentary', 'semi_presidential', 'one_party', 'authoritarian'];

export const CRISIS_PHASES = {
  1: { name: 'Инициатива', months: 1 },
  2: { name: 'Кризис',     months: 2 },
  3: { name: 'Развязка',   months: 1 },
};

function _applySystemChange(c, newSystem) {
  const oldSystem = c.system;
  c.system = newSystem;
  const now = c._date || { year: 1936, month: 1, day: 1 };

  if (newSystem === 'one_party' || newSystem === 'authoritarian') {
    const ruling = c.parties.find(p => p.id === c.rulingPartyId) || c.parties[0];
    if (ruling) {
      c.parties = [ruling];
      c.coalition = [ruling.id];
      c.rulingPartyId = ruling.id;
      ruling.seats = c.seatsTotal;
      ruling.support = 100;
      regenerateDeputies(c);
    }
    c.pressFreedom = clamp((c.pressFreedom || 50) - 20, 0, 100);
    c.humanRights = clamp((c.humanRights || 50) - 15, 0, 100);
    c.discontent = clamp((c.discontent || 40) + 10, 0, 100);
    c.stability = clamp((c.stability || 55) - 5, 0, 100);
    c.primeMinister = null;
    c.monarch = null;
  }

  else if (oldSystem === 'one_party' || oldSystem === 'authoritarian') {
    const count = randInt(2, 4);
    for (let i = 0; i < count; i++) {
      const ideo = pick(IDEOLOGY_IDS);
      const name = pickPartyName(ideo);
      if (c.parties.some(p => p.name === name)) continue;

      const party = generatePartyFull(ideo, name);
      party.support = randFloat(5, 15);
      party.founded = now.year;
      c.parties.push(party);
    }
    assignSeats(c);
    regenerateDeputies(c);
    c.pressFreedom = clamp((c.pressFreedom || 50) + 15, 0, 100);
    c.humanRights = clamp((c.humanRights || 50) + 10, 0, 100);
    c.discontent = clamp((c.discontent || 40) - 5, 0, 100);
  }

  if (newSystem === 'parliamentary' || newSystem === 'semi_presidential') {
    const ruling = c.parties.find(p => p.id === c.rulingPartyId) || c.parties[0];
    if (ruling) {
      c.primeMinister = {
        ...ruling.leader,
        partyId: ruling.id,
        since: { ...now },
      };
    }
  }

  if (c.playerPartyId) {
    c.playerInPower = (c.coalition || []).includes(c.playerPartyId);
  }
  if (c.playerPersonId) {
    const head = getHeadOfState(c);
    c.playerRole = (head.person?.id === c.playerPersonId) ? head.position : null;
    c.playerInPower = (c.playerRole !== null);
  }

  return { ok: true, msg: `Система изменена: ${oldSystem} → ${newSystem}` };
}

export function startConstitutionalCrisis(c, targetSystem) {
  if (!VALID_SYSTEMS.includes(targetSystem)) {
    return { ok: false, reason: 'Неизвестная система' };
  }
  if (c.system === targetSystem) {
    return { ok: false, reason: 'Уже установлена' };
  }
  if (c.constitutionalCrisis) {
    return { ok: false, reason: 'Конституционный кризис уже идёт' };
  }

  const risks = computeCrisisRisks(c, targetSystem);

  c.constitutionalCrisis = {
    from: c.system,
    to: targetSystem,
    phase: 1,
    monthsLeft: CRISIS_PHASES[1].months,
    startDate: { ...(c._date || { year: 1936, month: 1, day: 1 }) },
    risks,
    events: [],
  };

  c.stability = clamp((c.stability || 55) - 10, 0, 100);
  c.discontent = clamp((c.discontent || 40) + 10, 0, 100);

  return { ok: true, crisis: c.constitutionalCrisis };
}

function computeCrisisRisks(c, targetSystem) {
  const isToAuth = targetSystem === 'one_party' || targetSystem === 'authoritarian';
  const isFromAuth = c.system === 'one_party' || c.system === 'authoritarian';

  let parliament = clamp(0.5 - ((c.approval || 50) - 50) / 100, 0.1, 0.9);
  let army = clamp(0.3 - ((c.stability || 55) - 50) / 100, 0.05, 0.8);
  let street = clamp(0.3 - ((c.approval || 50) - 50) / 100, 0.05, 0.8);

  if (!isFromAuth && isToAuth) parliament += 0.2;
  if (isFromAuth && !isToAuth) { parliament -= 0.1; army -= 0.1; street -= 0.1; }
  if ((c.military?.readiness || 0) > 70) army -= 0.1;

  return {
    parliament: clamp(parliament, 0.05, 0.95),
    army: clamp(army, 0.02, 0.9),
    street: clamp(street, 0.05, 0.9),
  };
}

export function tickConstitutionalCrisis(c, game) {
  const cr = c.constitutionalCrisis;
  if (!cr) return;

  cr.monthsLeft--;

  cr.risks.parliament = clamp(cr.risks.parliament + 0.02, 0, 0.95);
  cr.risks.army = clamp(cr.risks.army + 0.015, 0, 0.9);
  cr.risks.street = clamp(cr.risks.street + 0.02, 0, 0.9);

  if (chance(0.4)) {
    cr.events.push({
      month: c._date?.month || 1,
      text: pickCrisisEvent(c, cr),
    });
  }

  if (cr.monthsLeft > 0) return;

  cr.phase++;
  if (cr.phase > 3) {
    resolveConstitutionalCrisis(c, game);
    return;
  }
  cr.monthsLeft = CRISIS_PHASES[cr.phase].months;
}

function pickCrisisEvent(c, cr) {
  const events = [
    'Парламент требует референдум по вопросу о смене системы',
    'Армия на грани мятежа: генералы недовольны реформой',
    'Протесты на улицах: тысячи людей требуют сохранить конституцию',
    'Пресса обвиняет правительство в узурпации власти',
    'Оппозиция призывает к всеобщей забастовке',
    'Западные державы выражают обеспокоенность ситуацией',
    'Студенческие волнения в столице',
    'Церковь осуждает смену системы',
  ];
  return pick(events);
}

function resolveConstitutionalCrisis(c, game) {
  const cr = c.constitutionalCrisis;
  if (!cr) return;

  const rolls = {
    army: chance(cr.risks.army),
    parliament: chance(cr.risks.parliament),
    street: chance(cr.risks.street),
  };

  if (rolls.army) {
    c.playerLost = true;
    c.playerLoseReason = 'Военный переворот. Вы свергнуты.';
    if (game) game.pushNews('Переворот', 'Военные свергли правительство', 'bad', c.id);
    c.constitutionalCrisis = null;
    return;
  }
  if (rolls.parliament) {
    c.approval = clamp((c.approval || 50) - 15, 0, 100);
    c.stability = clamp((c.stability || 55) - 5, 0, 100);
    if (game) game.pushNews('Парламент', 'Конституционный кризис провален: парламент заблокировал смену системы', 'bad', c.id);
    c.constitutionalCrisis = null;
    return;
  }
  if (rolls.street) {
    c.playerLost = true;
    c.playerLoseReason = 'Революция. Вы свергнуты.';
    if (game) game.pushNews('Революция', 'Народ сверг правительство', 'bad', c.id);
    c.constitutionalCrisis = null;
    return;
  }

  const result = _applySystemChange(c, cr.to);
  c.stability = clamp((c.stability || 55) - 10, 0, 100);
  c.discontent = clamp((c.discontent || 40) + 5, 0, 100);
  if (game) {
    game.pushNews('Политика', `Система изменена: ${cr.from} → ${cr.to}`, 'info', c.id);
  }
  c.constitutionalCrisis = null;
  return result;
}

export function abortConstitutionalCrisis(c, game) {
  const cr = c.constitutionalCrisis;
  if (!cr) return { ok: false, reason: 'Кризиса нет' };

  c.approval = clamp((c.approval || 50) - 8, 0, 100);
  c.stability = clamp((c.stability || 55) - 3, 0, 100);
  c.discontent = clamp((c.discontent || 40) + 5, 0, 100);

  if (game) game.pushNews('Политика', 'Правительство отступило: смена системы отменена', 'info', c.id);

  c.constitutionalCrisis = null;
  return { ok: true, msg: 'Кризис отменён. Вы потеряли 8 одобрения.' };
}
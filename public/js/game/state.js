import { randInt, randFloat, pick, gauss } from '../core/rng.js';
import { clamp, uid, deepClone } from '../core/util.js';
import { COUNTRY_PRESETS, ETHNICITIES, RELIGIONS, CURRENCIES, getSpectrum } from './names.js';
import { generateParties, generatePerson, generateCabinet } from './politics.js';
import { generateUnions, generateAssociations } from './groups.js';
import { DEFAULT_CONSTITUTION } from './constitution.js';
import { initSenate } from './parliament.js';
// v3.15: единая валидация
import { sanitizeSociety } from './society.js';

export const GOVERNMENTS = [
  { id:'republic', name:'Республика' },
  { id:'federal_republic', name:'Федеративная республика' },
  { id:'constitutional_monarchy', name:'Конституционная монархия' },
  { id:'absolute_monarchy', name:'Абсолютная монархия' },
  { id:'socialist_republic', name:'Социалистическая республика' },
  { id:'theocracy', name:'Теократия' },
  { id:'military_junta', name:'Военная хунта' },
  { id:'dominion', name:'Доминион' },
];

export const SYSTEMS = [
  { id:'presidential', name:'Президентская' },
  { id:'parliamentary', name:'Парламентская' },
  { id:'semi_presidential', name:'Смешанная' },
  { id:'one_party', name:'Однопартийная' },
  { id:'authoritarian', name:'Авторитарная' },
];

export const IDEOLOGIES = [
  { id:'liberal', name:'Либеральная' },
  { id:'conservative', name:'Консервативная' },
  { id:'social_democrat', name:'Социал-демократическая' },
  { id:'socialist', name:'Социалистическая' },
  { id:'communist', name:'Коммунистическая' },
  { id:'nationalist', name:'Националистическая' },
  { id:'centrist', name:'Центристская' },
  { id:'monarchist', name:'Монархическая' },
  { id:'agrarian', name:'Аграрная' },
  { id:'libertarian', name:'Либертарианская' },
];

function baseEconomy(c, gdpPerCapita) {
  c.gdp = (c.population * gdpPerCapita) / 1e9;
  c.gdpPerCapita = gdpPerCapita;
  c.growth = 0.002;
  c.treasury = c.gdp * 0.04;
  c.debt = c.gdp * randFloat(0.15, 0.5);
  c.inflation = 0.005;
  c.unemployment = 0.07;
  c.poverty = clamp(0.6 - gdpPerCapita / 18000, 0.03, 0.8);
  c.wage = gdpPerCapita * 0.5;
  c.pension = c.wage * 0.35;
  c.socialBenefits = c.wage * 0.12;
  c.exports = c.gdp * 0.11;
  c.imports = c.gdp * 0.10;
  c.fdi = c.gdp * 0.015;
  c.interestRate = 0.02;

  c.minimumWage = c.wage * 0.4;
  c.pensionAge = 65;
  c.pensionRate = 0.35;
  c.exchangeRate = 1.0;
  c.cbIndependence = 50;
  c.cbChairman = null;
  c.cbRate = 0.02;

  c.taxes = {
    income: 0.25,
    corporate: 0.25,
    vat: 0.10,
    property: 0.03,
    tariff: 0.15,
  };

  c.spending = {
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

  c.currency = pick(CURRENCIES);
  c.budget = 0;

  c.goldReserves = c.gdp * 0.05;
  c.goldStandard = true;
  c.foreignDebt = c.gdp * 0.1;
  c.creditRating = 50;
  c.bankReserveRatio = 0.15;
  c.publicSectorShare = 0.25;
  c.agricultureShare = 0.45;
  c.industryShare = 0.30;
  c.servicesShare = 0.25;
  c.economicCycle = 0;
  c.cyclePhase = 'recovery';
}

function baseSociety(c, dev) {
  c.birthRate = 14 + (1 - dev) * 20;
  c.deathRate = 22 - dev * 12;
  c.migrationRate = randFloat(-1, 2);
  c.lifeExpectancy = 32 + dev * 28;
  c.literacy = 0.55 + dev * 0.42;
  c.educationLevel = 25 + dev * 55;
  c.healthcareLevel = 20 + dev * 60;
  c.crimeRate = 60 - dev * 40;
  c.inequality = 0.55 - dev * 0.2;
  c.infrastructure = 25 + dev * 55;
  c.technology = 20 + dev * 60;
  c.shadowEconomy = 0.35 - dev * 0.2;
  c.approval = 50 + gauss(0, 6);
  c.discontent = 40 + gauss(0, 5);
  c.stability = 55 + gauss(0, 6);
  c.happiness = 45 + dev * 20;
  c.ageStructure = { children: 30 + (1-dev)*15, adults: 60 - (1-dev)*5, elderly: 10 - (1-dev)*10 };
  c.ethnicities = [{ name: pick(ETHNICITIES), share: 60 + randInt(0, 25) }];
  c.religions = [{ name: pick(RELIGIONS), share: 55 + randInt(0, 30) }];
  c.military = {
    personnel: Math.round(c.population * (0.004 + randFloat(0, 0.006))),
    budgetShare: c.spending.military,
    industry: 20 + dev * 40,
    readiness: 40 + dev * 30,
    mobilization: 30 + dev * 25,
  };

  // v3.14: внутренняя безопасность и правовая система
  c.policeFunding = 0.008;
  c.ruleOfLaw = clamp(45 + dev * 30 + gauss(0, 5), 5, 95);
  c.localAutonomy = clamp(40 + dev * 20 + gauss(0, 8), 5, 95);
  c.protests = [];
  c.strikes = [];

  // v3.15: журнал действий
  c.actionLog = [];
}

function basePolitics(c, dev, ideology) {
  c.corruption = clamp(75 - dev * 55 + gauss(0, 6), 3, 92);
  c.judicialIndependence = clamp(30 + dev * 45 + gauss(0, 8), 3, 95);
  c.pressFreedom = clamp(25 + dev * 55 + gauss(0, 10), 2, 96);
  c.humanRights = clamp(30 + dev * 45 + gauss(0, 8), 3, 95);
  c.minorityRights = clamp(30 + dev * 40 + gauss(0, 10), 3, 95);
  c.laws = [];
  c.bills = [];
  c.coalition = [];
  c.termMonths = 48;
  c.monthsInTerm = 0;
  c.seatsTotal = 100 + randInt(0, 3) * 50;
  c.tradeAgreements = [];
  c.embassy = [];
  c.rulingPartyId = null;
  c.presidentApproval = 50;

  generateParties(c, ideology);
  c.cabinet = generateCabinet(c);
  c.president = {
    ...generatePerson(ideology),
    partyId: c.parties[0].id,
    since: { year: 1936, month: 1, day: 1 },
  };
  c.rulingPartyId = c.parties[0].id;

  c.constitution = { ...DEFAULT_CONSTITUTION };
  c.unions = generateUnions(c);
  c.associations = generateAssociations(c);

  c.treaties = [];
  c.embassies = {};
  c.espionage = {};
  c.sanctions = [];
  c.bases = [];
  c.recognized = [];
  c.ultimatums = [];
  if (!c.wars) c.wars = [];

  c.speaker = null;
  c.constitutionalCrisis = null;
  c.referendum = null;
  c.competition = 50;
}

function initParliamentStructures(c) {
  initSenate(c);

  if (!Array.isArray(c.committees)) c.committees = [];
  if (!Array.isArray(c.interpellations)) c.interpellations = [];

  if (!c.session) {
    c.session = {
      number: 1,
      startDate: { ...(c._date || { year: 1936, month: 1, day: 1 }) },
      daysTotal: 90,
      daysLeft: 90,
      closed: false,
    };
  }
}

export function createCountry(opts = {}) {
  const dev = clamp(opts.dev ?? randFloat(0.15, 0.85), 0.05, 0.95);
  const c = {
    id: opts.id || uid(),
    name: opts.name || 'Безымянное государство',
    shortName: opts.shortName || opts.name || 'Государство',
    capital: opts.capital || 'Столица',
    flag: opts.flag || { colors: ['#1e3a8a', '#ffffff', '#b91c1c'], pattern: 'horizontal' },
    area: Math.max(1000, Math.round(opts.area || 500000)),
    population: Math.max(100000, Math.round(opts.population || 20000000)),
    government: opts.government || 'republic',
    system: opts.system || 'presidential',
    ideology: opts.ideology || 'centrist',
    isPlayer: false,
    relations: {},
    alliances: [],
    embargoes: [],
    wars: [],
    reputation: Math.round(30 + dev * 40),
    influence: Math.round(10 + dev * 50),
    history: [],
    politicians: [],
    log: [],

    playerPartyId: opts.playerPartyId ?? null,
    playerPersonId: opts.playerPersonId ?? null,
    playerRole: opts.playerRole ?? null,
    playerInPower: opts.playerInPower ?? true,

    playerPartyGoal: opts.playerPartyGoal ?? null,
    playerPersonGoal: opts.playerPersonGoal ?? null,
    playerWon: opts.playerWon ?? false,
    playerLost: opts.playerLost ?? false,
    playerWinReason: opts.playerWinReason ?? null,
    playerLoseReason: opts.playerLoseReason ?? null,

    constitutionalCrisis: opts.constitutionalCrisis ?? null,
  };
  baseEconomy(c, opts.gdpPerCapita || (700 + dev * 7500));
  baseSociety(c, dev);
  basePolitics(c, dev, c.ideology);
  c.politicians = Array.from({ length: 16 }, () =>
    generatePerson(pick(['liberal','conservative','social_democrat','centrist','nationalist']))
  );

  initParliamentStructures(c);

  return c;
}

export function createPresetCountry(preset, isPlayer = false) {
  const c = createCountry({
    id: preset.id,
    name: preset.name,
    shortName: preset.short,
    capital: preset.capital,
    flag: deepClone(preset.flag),
    area: preset.area,
    population: preset.population,
    government: preset.government,
    system: preset.system,
    ideology: preset.ideology,
    gdpPerCapita: preset.gdpPerCapita,
  });
  c.isPlayer = isPlayer;
  return c;
}

export function generateWorld(playerCountry) {
  const countries = [];

  for (const p of COUNTRY_PRESETS) {
    if (playerCountry && playerCountry.id === p.id) continue;
    countries.push(createPresetCountry(p, false));
  }

  if (playerCountry) {
    playerCountry.isPlayer = true;
    countries.unshift(playerCountry);
  }

  for (const a of countries) {
    for (const b of countries) {
      if (a.id === b.id) continue;
      let base = Math.round(gauss(0, 28));
      if (!Number.isFinite(base)) base = 0;
      if (a.ideology === b.ideology) base += 22;
      if (a.ideology === 'communist' && b.ideology === 'liberal') base -= 25;
      if (a.ideology === 'communist' && b.ideology === 'nationalist') base -= 20;
      a.relations[b.id] = clamp(base, -95, 95);
    }
  }

  for (const c of countries) {
    if (!c.bills) c.bills = [];
    if (!c.tradeAgreements) c.tradeAgreements = [];
    if (!c.embassy) c.embassy = [];
    if (!c.history) c.history = [];

    if (c.goldReserves === undefined) c.goldReserves = c.gdp * 0.05;
    if (c.goldStandard === undefined) c.goldStandard = true;
    if (c.foreignDebt === undefined) c.foreignDebt = c.gdp * 0.1;
    if (c.creditRating === undefined) c.creditRating = 50;
    if (c.bankReserveRatio === undefined) c.bankReserveRatio = 0.15;
    if (c.publicSectorShare === undefined) c.publicSectorShare = 0.25;
    if (c.agricultureShare === undefined) c.agricultureShare = 0.45;
    if (c.industryShare === undefined) c.industryShare = 0.30;
    if (c.servicesShare === undefined) c.servicesShare = 0.25;
    if (c.economicCycle === undefined) c.economicCycle = 0;
    if (!c.cyclePhase) c.cyclePhase = 'recovery';

    if (c.minimumWage === undefined) c.minimumWage = (c.wage || 50) * 0.4;
    if (c.pensionAge === undefined) c.pensionAge = 65;
    if (c.pensionRate === undefined) c.pensionRate = 0.35;
    if (c.exchangeRate === undefined) c.exchangeRate = 1.0;
    if (c.cbIndependence === undefined) c.cbIndependence = 50;
    if (c.cbChairman === undefined) c.cbChairman = null;
    if (c.cbRate === undefined) c.cbRate = c.interestRate || 0.02;

    // v3.14: внутренняя безопасность и правовая система
    if (c.policeFunding === undefined) c.policeFunding = 0.008;
    if (c.ruleOfLaw === undefined) c.ruleOfLaw = 50;
    if (c.localAutonomy === undefined) c.localAutonomy = 50;
    if (!Array.isArray(c.protests)) c.protests = [];
    if (!Array.isArray(c.strikes)) c.strikes = [];

    // v3.15: журнал действий
    if (!Array.isArray(c.actionLog)) c.actionLog = [];

    if (c.taxes) {
      if (c.taxes.tariff === undefined) c.taxes.tariff = 0.15;
    }
    if (c.spending) {
      if (c.spending.agriculture === undefined) c.spending.agriculture = 0.010;
      if (c.spending.industry === undefined) c.spending.industry = 0.010;
    }

    if (!Array.isArray(c.unions)) c.unions = generateUnions(c);
    if (!Array.isArray(c.associations)) c.associations = generateAssociations(c);
    if (!c.constitution) c.constitution = { ...DEFAULT_CONSTITUTION };

    if (!Array.isArray(c.treaties)) c.treaties = [];
    if (!c.embassies || typeof c.embassies !== 'object') c.embassies = {};
    if (!c.espionage || typeof c.espionage !== 'object') c.espionage = {};
    if (!Array.isArray(c.sanctions)) c.sanctions = [];
    if (!Array.isArray(c.bases)) c.bases = [];
    if (!Array.isArray(c.recognized)) c.recognized = [];
    if (!Array.isArray(c.ultimatums)) c.ultimatums = [];
    if (!Array.isArray(c.wars)) c.wars = [];

    if (c.speaker === undefined) c.speaker = null;

    for (const p of (c.parties || [])) {
      if (p.spectrum === undefined) {
        const spec = getSpectrum(p.ideology);
        p.spectrum = spec.position;
        p.spectrumLabel = spec.label;
        p.spectrumShort = spec.short;
        p.spectrumColor = spec.color;
      }
      if (p.discipline === undefined) p.discipline = 50;
      if (p.funding === undefined) p.funding = 20;
      if (p.founded === undefined) p.founded = 1900;
      if (p.registered === undefined) p.registered = true;
      if (!Array.isArray(p.program)) p.program = [];
    }

    if (c.playerPartyId === undefined) c.playerPartyId = null;
    if (c.playerPersonId === undefined) c.playerPersonId = null;
    if (c.playerRole === undefined) c.playerRole = null;
    if (c.playerInPower === undefined) c.playerInPower = true;

    if (c.playerPartyGoal === undefined) c.playerPartyGoal = null;
    if (c.playerPersonGoal === undefined) c.playerPersonGoal = null;
    if (c.playerWon === undefined) c.playerWon = false;
    if (c.playerLost === undefined) c.playerLost = false;
    if (c.playerWinReason === undefined) c.playerWinReason = null;
    if (c.playerLoseReason === undefined) c.playerLoseReason = null;

    if (c.constitutionalCrisis === undefined) c.constitutionalCrisis = null;

    if (c.referendum === undefined) c.referendum = null;
    if (c.competition === undefined) c.competition = 50;

    initParliamentStructures(c);

    // v3.15: единая валидация (добивает пропущенное)
    sanitizeCountry(c);
  }

  const orgs = [
    { id: 'world_league', name: 'Всемирная Лига', members: countries.filter(c => c.ideology !== 'communist').map(c => c.id) },
    { id: 'eastern_bloc', name: 'Восточный Блок', members: countries.filter(c => c.ideology === 'communist').map(c => c.id) },
    { id: 'western_pact', name: 'Западный Пакт', members: countries.filter(c => ['liberal','conservative','centrist','social_democrat'].includes(c.ideology)).slice(0, 5).map(c => c.id) },
  ].filter(o => o.members.length > 1);

  return { countries, organizations: orgs };
}

export function serialize(game) {
  return JSON.stringify({
    version: '3.15',
    date: game.date,
    playerId: game.playerId,
    world: game.world,
    news: game.news,
    history: game.history || [],
  });
}

export function deserialize(str) {
  const data = JSON.parse(str);
  if (data && data.date && !data.date.day) data.date.day = 1;
  if (data && data.world && Array.isArray(data.world.countries)) {
    for (const c of data.world.countries) {
      if (c.playerPartyId === undefined) c.playerPartyId = null;
      if (c.playerPersonId === undefined) c.playerPersonId = null;
      if (c.playerRole === undefined) c.playerRole = null;
      if (c.playerInPower === undefined) c.playerInPower = true;
      if (c.playerPartyGoal === undefined) c.playerPartyGoal = null;
      if (c.playerPersonGoal === undefined) c.playerPersonGoal = null;
      if (c.playerWon === undefined) c.playerWon = false;
      if (c.playerLost === undefined) c.playerLost = false;
      if (c.playerWinReason === undefined) c.playerWinReason = null;
      if (c.playerLoseReason === undefined) c.playerLoseReason = null;
      if (c.constitutionalCrisis === undefined) c.constitutionalCrisis = null;

      if (c.minimumWage === undefined) c.minimumWage = (c.wage || 50) * 0.4;
      if (c.pensionAge === undefined) c.pensionAge = 65;
      if (c.pensionRate === undefined) c.pensionRate = 0.35;
      if (c.exchangeRate === undefined) c.exchangeRate = 1.0;
      if (c.cbIndependence === undefined) c.cbIndependence = 50;
      if (c.cbChairman === undefined) c.cbChairman = null;
      if (c.cbRate === undefined) c.cbRate = c.interestRate || 0.02;

      // v3.14: внутренняя безопасность и правовая система
      if (c.policeFunding === undefined) c.policeFunding = 0.008;
      if (c.ruleOfLaw === undefined) c.ruleOfLaw = 50;
      if (c.localAutonomy === undefined) c.localAutonomy = 50;
      if (!Array.isArray(c.protests)) c.protests = [];
      if (!Array.isArray(c.strikes)) c.strikes = [];

      // v3.15: журнал действий
      if (!Array.isArray(c.actionLog)) c.actionLog = [];

      for (const p of (c.parties || [])) {
        if (p.registered === undefined) p.registered = true;
        if (!Array.isArray(p.program)) p.program = [];
      }

      if (c.referendum === undefined) c.referendum = null;
      if (c.competition === undefined) c.competition = 50;

      initParliamentStructures(c);

      // v3.15: единая валидация (добивает пропущенное)
      sanitizeCountry(c);
    }
  }
  return data;
}

// ============================================================
// v3.15: ЕДИНАЯ ВАЛИДАЦИЯ СТРАНЫ
// Вызывается в generateWorld / deserialize / loadFromKey (engine.js).
// Не убирает старые if — просто добивает то, что забыли.
// ============================================================
export function sanitizeCountry(c) {
  if (!c || typeof c !== 'object') return c;

  // --- игрок ---
  if (c.playerPartyId === undefined) c.playerPartyId = null;
  if (c.playerPersonId === undefined) c.playerPersonId = null;
  if (c.playerRole === undefined) c.playerRole = null;
  if (c.playerInPower === undefined) c.playerInPower = true;
  if (c.playerPartyGoal === undefined) c.playerPartyGoal = null;
  if (c.playerPersonGoal === undefined) c.playerPersonGoal = null;
  if (c.playerWon === undefined) c.playerWon = false;
  if (c.playerLost === undefined) c.playerLost = false;
  if (c.playerWinReason === undefined) c.playerWinReason = null;
  if (c.playerLoseReason === undefined) c.playerLoseReason = null;

  // --- экономика (v3.13) ---
  if (c.minimumWage === undefined) c.minimumWage = (c.wage || 50) * 0.4;
  if (c.pensionAge === undefined) c.pensionAge = 65;
  if (c.pensionRate === undefined) c.pensionRate = 0.35;
  if (c.exchangeRate === undefined) c.exchangeRate = 1.0;
  if (c.cbIndependence === undefined) c.cbIndependence = 50;
  if (c.cbChairman === undefined) c.cbChairman = null;
  if (c.cbRate === undefined) c.cbRate = c.interestRate || 0.02;
  if (c.goldReserves === undefined) c.goldReserves = (c.gdp || 1) * 0.05;
  if (c.goldStandard === undefined) c.goldStandard = true;
  if (c.foreignDebt === undefined) c.foreignDebt = (c.gdp || 1) * 0.1;
  if (c.creditRating === undefined) c.creditRating = 50;
  if (c.bankReserveRatio === undefined) c.bankReserveRatio = 0.15;
  if (c.publicSectorShare === undefined) c.publicSectorShare = 0.25;
  if (c.agricultureShare === undefined) c.agricultureShare = 0.45;
  if (c.industryShare === undefined) c.industryShare = 0.30;
  if (c.servicesShare === undefined) c.servicesShare = 0.25;
  if (c.economicCycle === undefined) c.economicCycle = 0;
  if (!c.cyclePhase) c.cyclePhase = 'recovery';

  // --- внутренняя безопасность (v3.14) ---
  if (c.policeFunding === undefined) c.policeFunding = 0.008;
  if (c.ruleOfLaw === undefined) c.ruleOfLaw = 50;
  if (c.localAutonomy === undefined) c.localAutonomy = 50;
  if (!Array.isArray(c.protests)) c.protests = [];
  if (!Array.isArray(c.strikes)) c.strikes = [];

  // --- журнал действий (v3.15) ---
  if (!Array.isArray(c.actionLog)) c.actionLog = [];

  // --- парламентские структуры (v3.11) ---
  if (!Array.isArray(c.parliamentLife)) c.parliamentLife = [];
  if (c.senate === undefined) c.senate = null;
  if (!Array.isArray(c.committees)) c.committees = [];
  if (!Array.isArray(c.interpellations)) c.interpellations = [];
  if (!c.session) {
    c.session = {
      number: 1,
      startDate: { ...(c._date || { year: 1936, month: 1, day: 1 }) },
      daysTotal: 90,
      daysLeft: 90,
      closed: false,
    };
  }

  // --- партии ---
  for (const p of (c.parties || [])) {
    if (p.registered === undefined) p.registered = true;
    if (!Array.isArray(p.program)) p.program = [];
  }

  // --- референдум и конкуренция (v3.13) ---
  if (c.referendum === undefined) c.referendum = null;
  if (c.competition === undefined) c.competition = 50;

  // --- дипломатия ---
  if (!c.relations || typeof c.relations !== 'object') c.relations = {};
  if (!Array.isArray(c.treaties)) c.treaties = [];
  if (!c.embassies || typeof c.embassies !== 'object') c.embassies = {};
  if (!c.espionage || typeof c.espionage !== 'object') c.espionage = {};
  if (!Array.isArray(c.sanctions)) c.sanctions = [];
  if (!Array.isArray(c.bases)) c.bases = [];
  if (!Array.isArray(c.recognized)) c.recognized = [];
  if (!Array.isArray(c.ultimatums)) c.ultimatums = [];
  if (!Array.isArray(c.wars)) c.wars = [];
  if (c.speaker === undefined) c.speaker = null;
  if (c.constitutionalCrisis === undefined) c.constitutionalCrisis = null;

  // --- общество (клампы + протесты/забастовки/журнал) ---
  sanitizeSociety(c);

  return c;
}
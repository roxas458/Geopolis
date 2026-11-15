import { applyEffects } from './effects.js';
import { voteOnBill, predictVote } from './parliament.js';

// ============================================================
// ЗАКОНЫ И РЕФОРМЫ (v3.14 — внутренняя безопасность)
// ============================================================
export const LAWS = [
  // ЭКОНОМИКА — НАЛОГИ
  { id:'flat_tax', name:'Плоская шкала налогообложения', desc:'Единая ставка для всех. Простота, но меньше доходов.',
    cost: 0, effects: { set: { 'taxes.income': 0.20 }, add: { approval: 3, inequality: 0.02 } } },
  { id:'progressive_tax', name:'Прогрессивная шкала налогов', desc:'Богатые платят больше. Рост доходов, но недовольство элит.',
    cost: 0, effects: { set: { 'taxes.income': 0.45 }, add: { approval: -2, inequality: -0.05, treasury: 0.05 } } },
  { id:'corporate_tax_cut', name:'Снижение налога на прибыль', desc:'Корпорации платят меньше. Рост инвестиций.',
    cost: 0, effects: { set: { 'taxes.corporate': 0.15 }, add: { growth: 0.001, approval: -1 } } },
  { id:'corporate_tax_hike', name:'Повышение налога на прибыль', desc:'Корпорации платят больше. Рост доходов.',
    cost: 0, effects: { set: { 'taxes.corporate': 0.35 }, add: { treasury: 0.05, growth: -0.0005, approval: 2 } } },
  { id:'vat_introduce', name:'Введение НДС', desc:'Косвенный налог. Рост доходов, но инфляция.',
    cost: 0, effects: { set: { 'taxes.vat': 0.15 }, add: { inflation: 0.01, approval: -3, treasury: 0.04 } } },
  { id:'property_tax', name:'Налог на роскошь', desc:'Богатые платят за имущество. Рост доходов.',
    cost: 0, effects: { set: { 'taxes.property': 0.08 }, add: { treasury: 0.03, inequality: -0.03, approval: 2 } } },

  // ЭКОНОМИКА — РАСХОДЫ
  { id:'universal_healthcare', name:'Всеобщее здравоохранение', desc:'Бесплатная медицина для всех.',
    cost: 0.008, effects: { add: { healthcareLevel: 10, approval: 6, happiness: 4, poverty: -0.03 } } },
  { id:'free_education', name:'Всеобщее образование', desc:'Бесплатное школьное и университетское образование.',
    cost: 0.007, effects: { add: { educationLevel: 12, literacy: 0.05, approval: 5, happiness: 3 } } },
  { id:'public_works', name:'Общественные работы', desc:'Массовые госпроекты (как «Новый курс»).',
    cost: 0.008, effects: { add: { unemployment: -0.02, infrastructure: 5, approval: 5 } } },
  { id:'infrastructure_program', name:'Инфраструктурная программа', desc:'Дороги, мосты, порты.',
    cost: 0.010, effects: { add: { infrastructure: 8, growth: 0.0015, approval: 3 } } },
  { id:'science_funding', name:'Финансирование науки', desc:'Гранты учёным и институтам.',
    cost: 0.005, effects: { add: { technology: 6, educationLevel: 3, approval: 1 } } },
  { id:'agriculture_support', name:'Поддержка фермеров', desc:'Субсидии сельскому хозяйству.',
    cost: 0.006, effects: { add: { approval: 4, stability: 2, agricultureShare: 0.02 } } },
  { id:'industrialization', name:'Индустриализация', desc:'Ускоренное развитие промышленности.',
    cost: 0.010, effects: { add: { technology: 5, growth: 0.001, industryShare: 0.05 } } },
  { id:'housing_program', name:'Жилищная программа', desc:'Доступное жильё для рабочих.',
    cost: 0.006, effects: { add: { approval: 5, happiness: 3, poverty: -0.02, inequality: -0.02 } } },

  // ЭКОНОМИКА — ФИНАНСЫ
  { id:'gold_standard', name:'Введение золотого стандарта', desc:'Жёсткая привязка к золоту.',
    cost: 0, effects: { set: { goldStandard: true }, add: { inflation: -0.02, growth: -0.0005 } } },
  { id:'fiat_money', name:'Отмена золотого стандарта', desc:'Свободная эмиссия.',
    cost: 0, effects: { set: { goldStandard: false }, add: { growth: 0.0008, inflation: 0.01 } } },
  { id:'banking_reform', name:'Банковская реформа', desc:'Усиление ЦБ и резервов.',
    cost: 0.004, effects: { add: { creditRating: 10, inflation: -0.01 } } },
  { id:'deposit_insurance', name:'Страхование вкладов', desc:'Защита вкладчиков от банкротства банков.',
    cost: 0.003, effects: { add: { stability: 3, creditRating: 5, approval: 2 } } },
  { id:'stock_market_reform', name:'Реформа фондового рынка', desc:'Прозрачность биржи.',
    cost: 0.002, effects: { add: { growth: 0.0005, corruption: -2 }, mul: { fdi: 1.5 } } },

  // ЭКОНОМИКА — ТОРГОВЛЯ
  { id:'tariff_protection', name:'Протекционистские тарифы', desc:'Защита своей промышленности.',
    cost: 0, effects: { set: { 'taxes.tariff': 0.30 }, add: { industryShare: 0.02, approval: 2 }, mul: { exports: 0.95 } } },
  { id:'free_trade', name:'Свободная торговля', desc:'Снижение тарифов.',
    cost: 0, effects: { set: { 'taxes.tariff': 0.05 }, add: { approval: -2 }, mul: { exports: 1.05 } } },
  { id:'trade_agreements', name:'Торговые соглашения', desc:'Двусторонние договоры.',
    cost: 0.003, effects: { add: { reputation: 2 }, mul: { exports: 1.05, imports: 1.03 } } },

  // ОБЩЕСТВО — ПРАВА
  { id:'free_press', name:'Свобода прессы', desc:'Независимость СМИ.',
    cost: 0, effects: { add: { pressFreedom: 20, humanRights: 5, approval: -2, stability: -2, corruption: -3 } } },
  { id:'censorship', name:'Цензура', desc:'Контроль над СМИ.',
    cost: 0, effects: { add: { pressFreedom: -25, stability: 5, approval: -5, corruption: 3 } } },
  { id:'labor_rights', name:'Права трудящихся', desc:'8-часовой день, минимальная зарплата.',
    cost: 0.003, effects: { add: { approval: 5, happiness: 3, inequality: -0.05, stability: -1 } } },
  { id:'womens_suffrage', name:'Женское избирательное право', desc:'Право голоса для женщин.',
    cost: 0, effects: { add: { humanRights: 10, educationLevel: 4, approval: 2, minorityRights: 5 } } },
  { id:'minority_rights', name:'Права меньшинств', desc:'Расширение прав этнических и религиозных меньшинств.',
    cost: 0.001, effects: { add: { minorityRights: 25, humanRights: 8, approval: -3, stability: -2 } } },
  { id:'secularism', name:'Светское государство', desc:'Отделение церкви от государства.',
    cost: 0, effects: { add: { educationLevel: 4, minorityRights: 6, approval: -4 } } },
  { id:'religious_law', name:'Религиозное право', desc:'Церковь влияет на законы.',
    cost: 0, effects: { add: { stability: 4, approval: 3, humanRights: -5, educationLevel: -3 } } },
  { id:'anti_discrimination', name:'Антидискриминационный закон', desc:'Запрет дискриминации.',
    cost: 0.001, effects: { add: { humanRights: 8, minorityRights: 10, approval: -1 } } },
  { id:'death_penalty_abolish', name:'Отмена смертной казни', desc:'Гуманизация правосудия.',
    cost: 0, effects: { add: { humanRights: 8, judicialIndependence: 3, approval: -2 } } },
  { id:'death_penalty_restore', name:'Восстановление смертной казни', desc:'Жёсткие меры против преступности.',
    cost: 0, effects: { add: { humanRights: -8, crimeRate: -5, approval: 2 } } },

  // ОБЩЕСТВО — ОБРАЗОВАНИЕ И МЕДИЦИНА
  { id:'mandatory_education', name:'Обязательное образование', desc:'До 14 лет — обязательно.',
    cost: 0.004, effects: { add: { educationLevel: 8, literacy: 0.03, approval: 3 } } },
  { id:'university_funding', name:'Финансирование университетов', desc:'Развитие высшего образования.',
    cost: 0.005, effects: { add: { educationLevel: 6, technology: 4, approval: 2 } } },
  { id:'vaccination_program', name:'Программа вакцинации', desc:'Массовая вакцинация.',
    cost: 0.003, effects: { add: { healthcareLevel: 6, lifeExpectancy: 2, approval: 3 } } },
  { id:'pension_system', name:'Пенсионная система', desc:'Государственные пенсии.',
    cost: 0.006, effects: { add: { approval: 6, happiness: 4, inequality: -0.03 } } },

  // ПОЛИТИКА
  // v3.14: anti_corruption и judicial_reform теперь усиливают ruleOfLaw
  { id:'anti_corruption', name:'Антикоррупционная реформа', desc:'Независимый антикоррупционный орган.',
    cost: 0.002, effects: { add: { corruption: -18, judicialIndependence: 8, ruleOfLaw: 6, approval: 3, stability: 2 } } },
  { id:'judicial_reform', name:'Судебная реформа', desc:'Независимость судов.',
    cost: 0.003, effects: { add: { judicialIndependence: 20, corruption: -8, ruleOfLaw: 8, humanRights: 6, pressFreedom: 3 } } },
  // v3.14: federalism/centralization теперь меняют localAutonomy
  { id:'federalism', name:'Федерализация', desc:'Расширение прав регионов.',
    cost: 0.002, effects: { set: { localAutonomy: 80 }, add: { stability: 5, corruption: -3, minorityRights: 8, approval: 2 } } },
  { id:'centralization', name:'Централизация', desc:'Усиление центральной власти.',
    cost: 0.002, effects: { set: { localAutonomy: 20 }, add: { stability: -3, corruption: 4, approval: -2 } } },
  { id:'constitution_reform', name:'Конституционная реформа', desc:'Расширение полномочий парламента.',
    cost: 0, effects: { add: { humanRights: 5, pressFreedom: 3, approval: 2 } } },
  { id:'emergency_powers', name:'Чрезвычайные полномочия', desc:'Правительство получает чрезвычайные полномочия.',
    cost: 0, effects: { add: { stability: 5, humanRights: -8, pressFreedom: -10, approval: -3 } } },
  { id:'secret_police', name:'Тайная полиция', desc:'Слежка за гражданами.',
    cost: 0.002, effects: { add: { stability: 6, humanRights: -12, crimeRate: -5, corruption: 5 } } },
  { id:'civil_liberties', name:'Гражданские свободы', desc:'Расширение прав граждан.',
    cost: 0, effects: { add: { humanRights: 10, pressFreedom: 8, approval: 4, stability: -2 } } },
  { id:'voting_reform', name:'Избирательная реформа', desc:'Прозрачные выборы.',
    cost: 0.002, effects: { add: { stability: 3, approval: 5, corruption: -5 } } },
  { id:'martial_law', name:'Военное положение', desc:'Армия контролирует улицы.',
    cost: 0.003, effects: { add: { stability: 8, humanRights: -15, pressFreedom: -12, approval: -6 } } },

  // ============================================================
  // v3.14: ВНУТРЕННЯЯ БЕЗОПАСНОСТЬ И ПРАВОВАЯ СИСТЕМА
  // ============================================================
  { id:'police_reform', name:'Реформа полиции', desc:'Профессионализация, повышение финансирования и подготовка кадров.',
    cost: 0.003,
    effects: { add: { policeFunding: 0.003, crimeRate: -6, approval: 2, ruleOfLaw: 4 } } },
  { id:'community_policing', name:'Общественная полиция', desc:'Полиция ближе к населению: участковые, профилактика.',
    cost: 0.002,
    effects: { add: { policeFunding: 0.001, crimeRate: -3, approval: 3, stability: 2 } } },
  { id:'rule_of_law_act', name:'Закон о верховенстве права', desc:'Обязательность судебных решений, равенство перед законом.',
    cost: 0.001,
    effects: { add: { ruleOfLaw: 8, judicialIndependence: 5, corruption: -4, approval: 2 } } },
  { id:'decentralization_act', name:'Децентрализация', desc:'Передача полномочий регионам, местное самоуправление.',
    cost: 0.002,
    effects: { set: { localAutonomy: 85 }, add: { stability: 3, corruption: -4, minorityRights: 6, approval: 3 } } },
  { id:'centralization_act', name:'Централизация власти', desc:'Усиление вертикали, назначение губернаторов.',
    cost: 0.002,
    effects: { set: { localAutonomy: 15 }, add: { stability: 4, corruption: 5, approval: -3, humanRights: -3 } } },

  // ВОЕННЫЕ
  { id:'military_industry', name:'Развитие ВПК', desc:'Создание военно-промышленного комплекса.',
    cost: 0.006, effects: { add: { technology: 6, influence: 4, approval: -1 } } },
  { id:'conscription', name:'Всеобщая воинская обязанность', desc:'Обязательный призыв.',
    cost: 0.004, effects: { add: { stability: -3, approval: -4 } } },
  { id:'professional_army', name:'Профессиональная армия', desc:'Контрактная армия.',
    cost: 0.008, effects: { add: { military: { readiness: 15 }, approval: 2, treasury: -0.02 } } },
  { id:'naval_buildup', name:'Развитие флота', desc:'Военно-морская программа.',
    cost: 0.010, effects: { add: { military: { readiness: 10, industry: 5 }, influence: 5 } } },
  { id:'air_force', name:'Развитие авиации', desc:'Военно-воздушные силы.',
    cost: 0.008, effects: { add: { technology: 5, military: { readiness: 8 }, influence: 3 } } },
  { id:'military_alliance', name:'Военные союзы', desc:'Соглашения с другими странами.',
    cost: 0.003, effects: { add: { reputation: 3, influence: 3 } } },
  { id:'arms_export', name:'Экспорт оружия', desc:'Продажа вооружений за рубеж.',
    cost: 0, effects: { add: { treasury: 0.03, reputation: -2 }, mul: { exports: 1.05 } } },
  { id:'veterans_support', name:'Поддержка ветеранов', desc:'Льготы и пенсии ветеранам.',
    cost: 0.003, effects: { add: { approval: 4, stability: 2, military: { readiness: 3 } } } },

  // ДИПЛОМАТИЯ
  { id:'isolationism', name:'Изоляционизм', desc:'Отказ от внешних союзов.',
    cost: 0, effects: { add: { stability: 3, influence: -5, reputation: -3 }, mul: { exports: 0.95 } } },
  { id:'internationalism', name:'Интернационализм', desc:'Активное участие в мировых делах.',
    cost: 0.004, effects: { add: { influence: 8, reputation: 5 }, mul: { exports: 1.03 } } },
  { id:'foreign_aid', name:'Программа внешней помощи', desc:'Помощь другим странам.',
    cost: 0.006, effects: { add: { reputation: 8, influence: 6, treasury: -0.02 } } },
  { id:'colonial_policy', name:'Колониальная политика', desc:'Экспансия за рубежом.',
    cost: 0.008, effects: { add: { influence: 10, reputation: -5, treasury: 0.04 } } },
  { id:'neutrality', name:'Нейтралитет', desc:'Отказ от участия в войнах.',
    cost: 0, effects: { add: { stability: 5, reputation: 2, influence: -3 } } },
];

// ============================================================
// МАППИНГ: закон → статья расходов
// ============================================================
const LAW_SPENDING_MAP = {
  universal_healthcare: 'healthcare',
  vaccination_program: 'healthcare',
  free_education: 'education',
  mandatory_education: 'education',
  university_funding: 'education',
  labor_rights: 'social',
  pension_system: 'social',
  housing_program: 'social',
  veterans_support: 'social',
  public_works: 'infrastructure',
  infrastructure_program: 'infrastructure',
  science_funding: 'science',
  agriculture_support: 'agriculture',
  industrialization: 'industry',
  military_industry: 'military',
  conscription: 'military',
  professional_army: 'military',
  naval_buildup: 'military',
  air_force: 'military',
  colonial_policy: 'military',
  anti_corruption: 'other',
  judicial_reform: 'other',
  federalism: 'other',
  banking_reform: 'other',
  deposit_insurance: 'other',
  stock_market_reform: 'other',
  minority_rights: 'other',
  anti_discrimination: 'other',
  centralization: 'other',
  secret_police: 'other',
  voting_reform: 'other',
  martial_law: 'other',
  military_alliance: 'other',
  foreign_aid: 'other',
  trade_agreements: 'other',
  // v3.14: внутренняя безопасность
  police_reform: 'other',
  community_policing: 'other',
  rule_of_law_act: 'other',
  decentralization_act: 'other',
  centralization_act: 'other',
};

const DEFAULT_SPENDING = {
  social: 0.030, education: 0.015, healthcare: 0.012,
  military: 0.015, infrastructure: 0.012, science: 0.004,
  agriculture: 0.010, industry: 0.010, other: 0.008,
};

// ============================================================
// v3.9: ИНТЕРАКТИВНОЕ ГОЛОСОВАНИЕ
// ============================================================
const VOTE_WINDOW_DAYS = 3;
const PLAYER_VOTE_BONUS = 15;

export function isAwaitingPlayerVote(bill) {
  if (!bill || bill.sponsorType !== 'law' || bill.status !== 'proposed') return false;
  if (bill.playerVote) return false;
  const daysLeft = bill.daysLeft ?? bill.daysTotal ?? 60;
  return daysLeft <= VOTE_WINDOW_DAYS;
}

export function getPlayerVoteWindow(bill) {
  if (!bill || bill.sponsorType !== 'law') return null;
  const daysLeft = bill.daysLeft ?? bill.daysTotal ?? 60;
  if (daysLeft > VOTE_WINDOW_DAYS) return null;
  return {
    canVote: !bill.playerVote,
    daysLeft,
    voted: bill.playerVote || null,
  };
}

export function castBillVote(c, bill, vote, game) {
  if (!c || !bill) return { ok: false, reason: 'Билль не найден' };
  if (bill.sponsorType !== 'law') return { ok: false, reason: 'Только для законопроектов' };
  if (bill.status !== 'proposed') return { ok: false, reason: 'Законопроект уже рассмотрен' };
  if (bill.playerVote) return { ok: false, reason: 'Вы уже проголосовали' };
  if (!['for', 'against', 'abstain'].includes(vote)) return { ok: false, reason: 'Неверный голос' };

  const daysLeft = bill.daysLeft ?? bill.daysTotal ?? 60;
  if (daysLeft > VOTE_WINDOW_DAYS) {
    return { ok: false, reason: `Голосование откроется за ${VOTE_WINDOW_DAYS} дня до конца рассмотрения` };
  }

  bill.playerVote = vote;
  bill.playerVoteDate = { ...(game?.date || c._date || { year: 1936, month: 1, day: 1 }) };

  if (vote === 'for') {
    bill.playerVoteBonus = PLAYER_VOTE_BONUS;
  } else if (vote === 'against') {
    bill.playerVoteBonus = -PLAYER_VOTE_BONUS;
  } else {
    bill.playerVoteBonus = 0;
  }

  bill._cachedVote = null;
  bill._cachedDay = -1;

  if (game) {
    const label = vote === 'for' ? '«за»' : vote === 'against' ? '«против»' : '«воздержался»';
    game.pushNews('Парламент', `Вы проголосовали ${label} по законопроекту «${bill.name}»`, vote === 'for' ? 'good' : vote === 'against' ? 'bad' : 'info', c.id);
  }

  return { ok: true, vote, bonus: bill.playerVoteBonus };
}

// ============================================================
// ПРИНЯТЬ ЗАКОН
// ============================================================
export function passLaw(c, lawId) {
  if (!c) return { ok: false, reason: 'Страна не найдена' };
  if (!c.laws) c.laws = [];

  if (c.laws.includes(lawId)) return { ok: false, reason: 'Закон уже принят' };
  const law = LAWS.find(l => l.id === lawId);
  if (!law) return { ok: false, reason: 'Закон не найден' };

  if (law.effects) {
    try {
      applyEffects(c, law.effects);
    } catch (err) {
      console.error('[Geopolis] Ошибка применения эффектов закона', lawId, err);
    }
  }

  if (!c.spending) c.spending = { ...DEFAULT_SPENDING };
  if (c.spending.agriculture === undefined) c.spending.agriculture = DEFAULT_SPENDING.agriculture;
  if (c.spending.industry === undefined) c.spending.industry = DEFAULT_SPENDING.industry;

  if (law.cost > 0) {
    const key = LAW_SPENDING_MAP[law.id];
    if (key && c.spending[key] !== undefined) {
      c.spending[key] = Math.min(0.30, c.spending[key] + law.cost);
    }
  }

  if (law.id === 'conscription') {
    if (!c.military) c.military = { personnel: 0, industry: 0, readiness: 50, mobilization: 30, budgetShare: 0.015 };
    c.military.mobilization = Math.min(100, (c.military.mobilization || 0) + 15);
    c.military.readiness = Math.min(100, (c.military.readiness || 0) + 8);
    c.military.personnel = Math.round((c.military.personnel || 0) * 1.15);
  }

  c.laws.push(lawId);
  return { ok: true, law };
}

// ============================================================
// ПРЕДЛОЖИТЬ ЗАКОН (v3.6: 60 дней, живой прогресс)
// ============================================================
export function proposeLaw(c, lawId, game) {
  if (!c) return { ok: false, reason: 'Страна не найдена' };
  if (!c.laws) c.laws = [];
  if (!c.bills) c.bills = [];
  if (c.laws.includes(lawId)) return { ok: false, reason: 'Закон уже принят' };
  const law = LAWS.find(l => l.id === lawId);
  if (!law) return { ok: false, reason: 'Закон не найден' };

  if (c.bills.some(b => b.sponsorType === 'law' && b.lawId === lawId && b.status === 'proposed')) {
    return { ok: false, reason: 'Законопроект уже на рассмотрении' };
  }

  const gd = game?.date;
  const createdDate = {
    year: gd?.year || c._date?.year || 1936,
    month: gd?.month || c._date?.month || 1,
    day: gd?.day || c._date?.day || 1,
  };

  const bill = {
    id: 'law_' + lawId + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    lawId,
    templateId: law.id,
    name: law.name,
    desc: law.desc,
    effect: {},
    sponsorType: 'law',
    sponsorPartyId: c.rulingPartyId,
    sponsorName: 'Парламентская инициатива',
    sponsorColor: '#8b97b8',
    support: 0,
    opposition: 0,
    status: 'proposed',
    createdDate,

    daysTotal: 60,
    daysLeft: 60,
    supportSeats: 0,
    opposeSeats: 0,
    _cachedVote: null,
    _cachedDay: -1,

    playerVote: null,
    playerVoteDate: null,
    playerVoteBonus: 0,
  };
  c.bills.push(bill);

  if (game) {
    game.pushNews('Парламент', `Внесён законопроект: «${law.name}»`, 'info', c.id);
  }
  return { ok: true, bill };
}

// ============================================================
// ЕЖЕДНЕВНЫЙ ТИК ЗАКОНОПРОЕКТОВ
// ============================================================
export function tickActiveBills(c, game) {
  if (!c.bills || !c.bills.length) return;
  if (!game || !game.date) return;

  for (const bill of c.bills) {
    if (bill.status !== 'proposed') continue;
    if (bill.sponsorType !== 'law') continue;

    if (!bill.daysTotal) bill.daysTotal = 60;
    if (bill.daysLeft === undefined) bill.daysLeft = bill.daysTotal;

    const cd = bill.createdDate || { year: game.date.year, month: game.date.month, day: 1 };
    const now = game.date;
    const cdDay = (cd.year - 1936) * 360 + ((cd.month || 1) - 1) * 30 + (cd.day || 1);
    const nowDay = (now.year - 1936) * 360 + ((now.month || 1) - 1) * 30 + (now.day || 1);
    const age = Math.max(0, nowDay - cdDay);

    bill.daysLeft = Math.max(0, bill.daysTotal - age);

    if (bill._cachedDay !== nowDay) {
      bill._cachedDay = nowDay;
      try {
        const vote = predictVote(c, bill);
        if (bill.playerVoteBonus) {
          vote.supportSeats = Math.max(0, Math.min(c.seatsTotal, vote.supportSeats + bill.playerVoteBonus));
          vote.passes = vote.supportSeats > c.seatsTotal / 2;
        }
        bill._cachedVote = vote;
        bill.supportSeats = vote.supportSeats;
        bill.opposeSeats = vote.opposeSeats;
      } catch (e) {
        // ignore
      }
    }
  }
}

// ============================================================
// ГОЛОСОВАНИЕ ПО ЗАВЕРШЁННЫМ ЗАКОНОПРОЕКТАМ
// ВАЖНО: должна вызываться ЕЖЕДНЕВНО (см. engine.js runDailySystems),
// иначе 3-дневное окно голосования игрока не работает.
// ============================================================
export function resolveLawBills(c, game) {
  if (!c.bills) return;
  for (const bill of c.bills) {
    if (bill.status !== 'proposed') continue;
    if (bill.sponsorType !== 'law') continue;

    const daysLeft = bill.daysLeft ?? 0;
    if (daysLeft > 0) continue;

    if (!bill.playerVote) {
      const now = game?.date;
      if (now) {
        const cd = bill.createdDate || { year: now.year, month: now.month, day: 1 };
        const cdDay = (cd.year - 1936) * 360 + ((cd.month || 1) - 1) * 30 + (cd.day || 1);
        const nowDay = (now.year - 1936) * 360 + ((now.month || 1) - 1) * 30 + (now.day || 1);
        const totalAge = nowDay - cdDay;
        // Ждём до daysTotal + VOTE_WINDOW_DAYS — игрок должен успеть проголосовать
        if (totalAge < (bill.daysTotal || 60) + VOTE_WINDOW_DAYS) continue;
      }
    }

    // FIX: guard от void-возврата voteOnBill
    const r = voteOnBill(c, bill, game);
    if (r && r.passed && bill.lawId) {
      passLaw(c, bill.lawId);
    }
  }
}

// ============================================================
// ОТМЕНИТЬ ЗАКОН
// ============================================================
export function revokeLaw(c, lawId) {
  if (!c.laws) return { ok: false, reason: 'Закон не найден' };
  const idx = c.laws.indexOf(lawId);
  if (idx === -1) return { ok: false, reason: 'Закон не принят' };
  const law = LAWS.find(l => l.id === lawId);
  c.laws.splice(idx, 1);

  if (c.spending && law && law.cost > 0) {
    const key = LAW_SPENDING_MAP[law.id];
    if (key && c.spending[key] !== undefined) {
      c.spending[key] = Math.max(0, c.spending[key] - law.cost);
    }
  }

  if (law && law.id === 'conscription' && c.military) {
    c.military.mobilization = Math.max(0, (c.military.mobilization || 0) - 15);
    c.military.readiness = Math.max(0, (c.military.readiness || 0) - 8);
    c.military.personnel = Math.round((c.military.personnel || 0) / 1.15);
  }

  return { ok: true };
}

export const VOTE_WINDOW = VOTE_WINDOW_DAYS;
export const VOTE_BONUS = PLAYER_VOTE_BONUS;
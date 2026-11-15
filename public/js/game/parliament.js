import { pick, chance, gauss, randInt } from '../core/rng.js';
import { clamp, uid } from '../core/util.js';

// ============================================================
// v3.9: парламентская жизнь — единый источник (parliamentLife.js)
// ============================================================
import {
  initParliamentLife,
  generateParliamentLife,
  tickParliamentLife,
  tickParliamentLifeMonthly,
  getParliamentLife,
  getParliamentLifeByDeputy,
  getParliamentLifeSummary,
  getAllDeputiesDetailed,
  getDeputyStats,
  archiveOldParliamentLife,
  PARLIAMENT_LIFE_TYPES,
} from './parliamentLife.js';

// ============================================================
// v3.9: интерактивное голосование — логика в laws.js
// ============================================================
import {
  castBillVote,
  isAwaitingPlayerVote,
  getPlayerVoteWindow,
  VOTE_WINDOW,
  VOTE_BONUS,
} from './laws.js';

// ============================================================
// v3.11: двухпалатный парламент, комитеты, фракции,
//        повестка, сессия, интерпелляции, коалиция, оппозиция
// ============================================================

// Реэкспорт для views.js / engine.js (единая точка импорта)
export {
  // parliamentLife.js
  initParliamentLife,
  generateParliamentLife,
  tickParliamentLife,
  tickParliamentLifeMonthly,
  getParliamentLife,
  getParliamentLifeByDeputy,
  getParliamentLifeSummary,
  getAllDeputiesDetailed,
  getDeputyStats,
  archiveOldParliamentLife,
  PARLIAMENT_LIFE_TYPES,
  // laws.js — интерактивное голосование
  castBillVote,
  isAwaitingPlayerVote,
  getPlayerVoteWindow,
  VOTE_WINDOW,
  VOTE_BONUS,
};

// ============================================================
// ПАРЛАМЕНТСКИЕ ЗАКОНОПРОЕКТЫ (v3.9)
// ============================================================

const BILL_TEMPLATES = [
  { id:'tax_cut_income',   name:'Снижение подоходного налога',     desc:'Снизить подоходный налог на 3 п.п.',           effect:{ taxes: { income: -0.03 }, approval: +3 },   cost: 0 },
  { id:'tax_raise_corp',   name:'Повышение налога на прибыль',     desc:'Повысить корпоративный налог на 2 п.п.',       effect:{ taxes: { corporate: +0.02 }, approval: -2 }, cost: 0 },
  { id:'vat_cut',          name:'Снижение НДС',                    desc:'Снизить НДС на 2 п.п.',                        effect:{ taxes: { vat: -0.02 }, inflation: -0.005, approval: +2 }, cost: 0 },
  { id:'minimum_wage',     name:'Повышение минимальной зарплаты',  desc:'Установить минимальную зарплату.',             effect:{ wage: +40, unemployment: +0.005, approval: +2, inequality: -0.02 }, cost: 0 },
  { id:'pension_raise',    name:'Индексация пенсий',               desc:'Проиндексировать пенсии на 5%.',               effect:{ pension: +5, approval: +4, treasury: -0.06 }, cost: 0.002 },
  { id:'edu_spending',     name:'Увеличение расходов на образование', desc:'+0.5% ВВП на образование.',                 effect:{ spending: { education: +0.005 }, educationLevel: +3, approval: +2 }, cost: 0.005 },
  { id:'health_spending',  name:'Увеличение расходов на медицину', desc:'+0.5% ВВП на здравоохранение.',                effect:{ spending: { healthcare: +0.005 }, healthcareLevel: +3, approval: +3 }, cost: 0.005 },
  { id:'infra_spending',   name:'Инфраструктурная программа',      desc:'Инвестиции в дороги и мосты.',                 effect:{ spending: { infrastructure: +0.006 }, infrastructure: +4, growth: +0.001 }, cost: 0.006 },
  { id:'science_grant',    name:'Гранты учёным',                   desc:'Финансирование научных исследований.',         effect:{ spending: { science: +0.004 }, technology: +3, approval: +1 }, cost: 0.004 },
  { id:'military_buildup', name:'Наращивание военного бюджета',    desc:'+0.5% ВВП на оборону.',                        effect:{ spending: { military: +0.005 }, military: { readiness: +3 }, approval: -1 }, cost: 0.005 },
  { id:'military_cut',     name:'Сокращение военных расходов',     desc:'−0.5% ВВП на оборону.',                        effect:{ spending: { military: -0.005 }, military: { readiness: -3 }, approval: +2 }, cost: 0 },
  { id:'anti_trust',       name:'Антимонопольный закон',           desc:'Ограничить монополии.',                        effect:{ inequality: -0.03, corruption: -3, growth: +0.0005 }, cost: 0 },
  { id:'labor_reform',     name:'Трудовая реформа',                desc:'Гибкость рынка труда.',                        effect:{ unemployment: -0.01, inequality: +0.02, growth: +0.001, approval: -2 }, cost: 0 },
  { id:'green_energy',     name:'Энергетический переход',          desc:'Инвестиции в новые источники энергии.',        effect:{ spending: { infrastructure: +0.003 }, technology: +4, inflation: -0.003 }, cost: 0.003 },
  { id:'border_control',   name:'Усиление границ',                 desc:'Строже миграционная политика.',                 effect:{ migrationRate: -1, approval: +2, humanRights: -3 }, cost: 0 },
  { id:'open_borders',     name:'Открытые границы',                desc:'Упростить иммиграцию.',                        effect:{ migrationRate: +1, approval: -3, growth: +0.0005, inequality: -0.01 }, cost: 0 },
  { id:'nationalize',      name:'Национализация промышленности',  desc:'Передать ключевые отрасли государству.',       effect:{ treasury: +0.20, unemployment: +0.01, approval: +2, corruption: +5 }, cost: 0 },
];

const VOTE_MAP = {
  tax_cut_income:    { liberal: 1, conservative: 0.8, social_democrat: 0.3, socialist: 0.1, communist: 0, nationalist: 0.4, centrist: 0.5, monarchist: 0.3, agrarian: 0.4, libertarian: 1 },
  tax_raise_corp:    { liberal: 0, conservative: 0.3, social_democrat: 0.9, socialist: 0.9, communist: 0.9, nationalist: 0.5, centrist: 0.2, monarchist: 0.4, agrarian: 0.5, libertarian: 0.1 },
  vat_cut:           { liberal: 0.9, conservative: 0.7, social_democrat: 0.9, socialist: 0.8, communist: 0.6, nationalist: 0.6, centrist: 0.8, monarchist: 0.5, agrarian: 0.7, libertarian: 0.9 },
  minimum_wage:      { liberal: 0.2, conservative: 0, social_democrat: 1, socialist: 1, communist: 1, nationalist: 0.4, centrist: 0.5, monarchist: 0.2, agrarian: 0.6, libertarian: 0.2 },
  pension_raise:     { liberal: 0.5, conservative: 0.6, social_democrat: 1, socialist: 1, communist: 1, nationalist: 0.8, centrist: 0.8, monarchist: 0.9, agrarian: 0.8, libertarian: 0.4 },
  edu_spending:      { liberal: 0.9, conservative: 0.5, social_democrat: 1, socialist: 1, communist: 1, nationalist: 0.6, centrist: 0.9, monarchist: 0.6, agrarian: 0.7, libertarian: 0.6 },
  health_spending:   { liberal: 0.8, conservative: 0.6, social_democrat: 1, socialist: 1, communist: 1, nationalist: 0.7, centrist: 0.9, monarchist: 0.7, agrarian: 0.8, libertarian: 0.5 },
  infra_spending:    { liberal: 0.8, conservative: 0.8, social_democrat: 0.9, socialist: 0.8, communist: 0.7, nationalist: 1, centrist: 1, monarchist: 0.9, agrarian: 0.9, libertarian: 0.6 },
  science_grant:     { liberal: 1, conservative: 0.6, social_democrat: 0.9, socialist: 0.7, communist: 0.5, nationalist: 0.7, centrist: 1, monarchist: 0.5, agrarian: 0.6, libertarian: 0.8 },
  military_buildup:  { liberal: 0, conservative: 0.9, social_democrat: 0.3, socialist: 0.2, communist: 0, nationalist: 1, centrist: 0.4, monarchist: 0.9, agrarian: 0.4, libertarian: 0.1 },
  military_cut:      { liberal: 0.9, conservative: 0, social_democrat: 0.8, socialist: 0.9, communist: 1, nationalist: 0, centrist: 0.4, monarchist: 0, agrarian: 0.6, libertarian: 0.8 },
  anti_trust:        { liberal: 0.9, conservative: 0.3, social_democrat: 0.9, socialist: 1, communist: 1, nationalist: 0.4, centrist: 0.6, monarchist: 0.2, agrarian: 0.7, libertarian: 0.5 },
  labor_reform:      { liberal: 0.8, conservative: 0.9, social_democrat: 0.1, socialist: 0, communist: 0, nationalist: 0.5, centrist: 0.7, monarchist: 0.6, agrarian: 0.3, libertarian: 0.9 },
  green_energy:      { liberal: 0.8, conservative: 0.4, social_democrat: 0.8, socialist: 0.7, communist: 0.6, nationalist: 0.5, centrist: 0.9, monarchist: 0.5, agrarian: 0.4, libertarian: 0.6 },
  border_control:    { liberal: 0, conservative: 0.9, social_democrat: 0.3, socialist: 0.2, communist: 0.4, nationalist: 1, centrist: 0.4, monarchist: 0.8, agrarian: 0.6, libertarian: 0.1 },
  open_borders:      { liberal: 1, conservative: 0, social_democrat: 0.7, socialist: 0.5, communist: 0.2, nationalist: 0, centrist: 0.4, monarchist: 0.1, agrarian: 0.3, libertarian: 1 },
  nationalize:       { liberal: 0, conservative: 0.1, social_democrat: 0.6, socialist: 1, communist: 1, nationalist: 0.7, centrist: 0.3, monarchist: 0.4, agrarian: 0.5, libertarian: 0 },
};

const LAW_VOTE_BASE = {
  liberal: 0.5, conservative: 0.5, social_democrat: 0.5, socialist: 0.5,
  communist: 0.5, nationalist: 0.5, centrist: 0.5, monarchist: 0.5,
  agrarian: 0.5, libertarian: 0.5,
};

// ============================================================
// ГЕНЕРАЦИЯ ИНИЦИАТИВ
// ============================================================
export function generateBill(c, { sponsor = null, forceTemplate = null } = {}) {
  const template = forceTemplate || pick(BILL_TEMPLATES);

  const eligible = c.parties.filter(p => p.seats > 0);
  if (!eligible.length) return null;
  const sponsorParty = sponsor || pick(eligible);
  if (!sponsorParty) return null;

  const ideologyBias = {
    liberal:        ['tax_cut_income','vat_cut','open_borders','anti_trust'],
    conservative:   ['tax_raise_corp','border_control','military_buildup','anti_trust'],
    social_democrat:['pension_raise','edu_spending','health_spending','minimum_wage'],
    socialist:      ['pension_raise','nationalize','minimum_wage','health_spending'],
    communist:      ['nationalize','minimum_wage','pension_raise','military_cut'],
    nationalist:    ['military_buildup','border_control','infra_spending','tax_raise_corp'],
    centrist:       ['infra_spending','science_grant','labor_reform','green_energy'],
    monarchist:     ['military_buildup','border_control','infra_spending','pension_raise'],
    agrarian:       ['pension_raise','infra_spending','border_control','minimum_wage'],
    libertarian:    ['tax_cut_income','vat_cut','open_borders','anti_trust'],
  };

  let tmpl = template;
  if (chance(0.55)) {
    const pool = ideologyBias[sponsorParty.ideology] || [];
    if (pool.length) {
      const forced = pick(pool);
      const found = BILL_TEMPLATES.find(b => b.id === forced);
      if (found) tmpl = found;
    }
  }

  return {
    id: uid(),
    templateId: tmpl.id,
    name: tmpl.name,
    desc: tmpl.desc,
    effect: tmpl.effect,
    sponsorPartyId: sponsorParty.id,
    sponsorName: sponsorParty.name,
    sponsorColor: sponsorParty.color,
    sponsorSymbol: sponsorParty.symbol || '⚖️',
    sponsorType: 'party',
    support: 0,
    opposition: 0,
    status: 'proposed',
    createdDate: { ...(c._date || { year: 1936, month: 1, day: 1 }) },
  };
}

export function generateGovernmentBill(c, game, head) {
  if (!head || !head.person) return null;

  const template = pick(BILL_TEMPLATES);
  const ideologyBias = {
    liberal:        ['tax_cut_income','vat_cut','open_borders','anti_trust'],
    conservative:   ['tax_raise_corp','border_control','military_buildup','anti_trust'],
    social_democrat:['pension_raise','edu_spending','health_spending','minimum_wage'],
    socialist:      ['pension_raise','nationalize','minimum_wage','health_spending'],
    communist:      ['nationalize','minimum_wage','pension_raise','military_cut'],
    nationalist:    ['military_buildup','border_control','infra_spending','tax_raise_corp'],
    centrist:       ['infra_spending','science_grant','labor_reform','green_energy'],
    monarchist:     ['military_buildup','border_control','infra_spending','pension_raise'],
    agrarian:       ['pension_raise','infra_spending','border_control','minimum_wage'],
    libertarian:    ['tax_cut_income','vat_cut','open_borders','anti_trust'],
  };

  let tmpl = template;
  if (chance(0.70)) {
    const pool = ideologyBias[head.person.ideology] || ideologyBias.centrist;
    if (pool.length) {
      const forced = pick(pool);
      const found = BILL_TEMPLATES.find(b => b.id === forced);
      if (found) tmpl = found;
    }
  }

  return {
    id: uid(),
    templateId: tmpl.id,
    name: tmpl.name,
    desc: tmpl.desc,
    effect: tmpl.effect,
    sponsorPartyId: head.partyId || null,
    sponsorName: `${head.positionName || 'Глава государства'} ${head.person.name}`,
    sponsorColor: '#e6b84c',
    sponsorType: 'government',
    support: 0,
    opposition: 0,
    status: 'proposed',
    createdDate: { ...(game?.date || { year: 1936, month: 1, day: 1 }) },
  };
}

// ============================================================
// ПРОГНОЗ ГОЛОСОВАНИЯ (v3.9: + бонус от голоса игрока)
// ============================================================
export function predictVote(c, bill) {
  if (c.system === 'one_party' || c.system === 'authoritarian') {
    return { supportSeats: c.seatsTotal, opposeSeats: 0, passes: true, supportDeputies: [], opposeDeputies: [] };
  }

  const isLaw = bill.sponsorType === 'law';

  if (isLaw && bill._cachedVote && bill._cachedDay != null) {
    const cd = c._date || null;
    const nowDay = cd ? (cd.year - 1936) * 360 + (cd.month - 1) * 30 + (cd.day || 1) : null;
    if (nowDay != null && nowDay === bill._cachedDay) {
      return bill._cachedVote;
    }
  }

  const base = isLaw ? (LAW_VOTE_BASE || {}) : (VOTE_MAP[bill.templateId] || {});
  let supportSeats = 0, opposeSeats = 0;
  const supportDeputies = [];
  const opposeDeputies = [];

  for (const party of c.parties) {
    const deputies = party.deputies || [];
    if (deputies.length === 0) {
      let prob = base[party.ideology];
      if (prob === undefined) prob = base.centrist ?? 0.5;
      if (party.id === c.rulingPartyId) prob += 0.15;
      if (party.id === c.president?.partyId) prob += 0.10;
      if (party.id === bill.sponsorPartyId) prob = 1;
      prob = clamp(prob + gauss(0, 0.10), 0, 1);
      if (prob >= 0.5) supportSeats += party.seats;
      else opposeSeats += party.seats;
      continue;
    }

    for (const deputy of deputies) {
      const prob = getDeputyVoteProbability(c, bill, deputy, party, base, isLaw);
      if (prob >= 0.5) {
        supportSeats++;
        supportDeputies.push(deputy);
      } else {
        opposeSeats++;
        opposeDeputies.push(deputy);
      }
    }
  }

  // v3.9: голос игрока сдвигает баланс
  if (bill.playerVoteBonus) {
    supportSeats = Math.max(0, Math.min(c.seatsTotal, supportSeats + bill.playerVoteBonus));
    opposeSeats = Math.max(0, c.seatsTotal - supportSeats);
  }

  const result = { supportSeats, opposeSeats, passes: supportSeats > c.seatsTotal / 2, supportDeputies, opposeDeputies };

  if (isLaw) {
    const cd = c._date || null;
    const nowDay = cd ? (cd.year - 1936) * 360 + (cd.month - 1) * 30 + (cd.day || 1) : null;
    if (nowDay != null) {
      bill._cachedVote = result;
      bill._cachedDay = nowDay;
      bill.supportSeats = supportSeats;
      bill.opposeSeats = opposeSeats;
    }
  }

  return result;
}

function getDeputyVoteProbability(c, bill, deputy, party, base, deterministic = false) {
  let prob = base[deputy.ideology];
  if (prob === undefined) prob = base.centrist ?? 0.5;

  if (party.id === c.rulingPartyId) prob += 0.15;
  if (party.id === c.president?.partyId) prob += 0.10;
  if (party.id === bill.sponsorPartyId) prob = 1;

  if (party.discipline > 70 && deputy.loyalty > 60) {
    const partyProb = base[party.ideology] ?? base.centrist ?? 0.5;
    const partyBias = (party.id === c.rulingPartyId ? 0.15 : 0) + (party.id === c.president?.partyId ? 0.10 : 0);
    prob = (prob + (partyProb + partyBias)) / 2;
  }

  prob += deputy.voteBias || 0;

  if (deputy.competence > 70 && !deterministic) {
    prob += gauss(0, 0.05);
  }

  if (bill.sponsorType === 'government' && deputy.charisma > 70) {
    prob += 0.03;
  }

  if (deterministic) {
    return clamp(prob, 0, 1);
  }
  return clamp(prob + gauss(0, 0.08), 0, 1);
}

export function parliamentCanBlock(c) {
  if (c.system === 'one_party' || c.system === 'authoritarian') return false;
  const opposition = (c.parties || []).filter(p => p.id !== c.rulingPartyId);
  if (!opposition.length) return false;
  return true;
}

export function parliamentBlockBill(c, bill, game) {
  if (bill.sponsorType !== 'government') {
    return { ok: false, reason: 'Только законопроекты власти можно блокировать' };
  }
  if (!parliamentCanBlock(c)) {
    return { ok: false, reason: 'Парламент не может блокировать' };
  }

  const oppositionSeats = (c.parties || [])
    .filter(p => p.id !== c.rulingPartyId)
    .reduce((a, p) => a + p.seats, 0);

  const blocked = oppositionSeats > c.seatsTotal / 2;

  if (blocked) {
    bill.status = 'blocked';
    if (game) game.pushNews('Парламент', `Парламент заблокировал законопроект «${bill.name}»`, 'bad', c.id);
    c.approval = clamp((c.approval || 50) - 2, 0, 100);
    c.stability = clamp((c.stability || 55) - 1, 0, 100);
    c.discontent = clamp((c.discontent || 40) + 2, 0, 100);
    return { ok: true, blocked: true };
  }

  bill.status = 'passed';
  applyBillEffect(c, bill);
  if (game) game.pushNews('Парламент', `Парламент одобрил законопроект «${bill.name}»`, 'good', c.id);
  return { ok: true, blocked: false };
}

export function voteOnBill(c, bill, game) {
  // FIX: guard от повторного голосования
  if (!bill || bill.status !== 'proposed') {
    return { ok: false, reason: 'Билль уже рассмотрен', passed: false };
  }
  const r = predictVote(c, bill);
  if (r.passes) {
    bill.status = 'passed';
    applyBillEffect(c, bill);
    if (game) game.pushNews('Парламент', `Принят закон: «${bill.name}» (за: ${r.supportSeats}, против: ${r.opposeSeats})`, 'good', c.id);
    // FIX: возвращаем оба набора имён — support/oppose и supportSeats/opposeSeats
    return {
      ok: true, passed: true,
      support: r.supportSeats, oppose: r.opposeSeats,
      supportSeats: r.supportSeats, opposeSeats: r.opposeSeats,
      supportDeputies: r.supportDeputies,
    };
  } else {
    bill.status = 'rejected';
    if (game) game.pushNews('Парламент', `Отклонён законопроект: «${bill.name}» (за: ${r.supportSeats}, против: ${r.opposeSeats})`, 'bad', c.id);
    return {
      ok: true, passed: false,
      support: r.supportSeats, oppose: r.opposeSeats,
      supportSeats: r.supportSeats, opposeSeats: r.opposeSeats,
      opposeDeputies: r.opposeDeputies,
    };
  }
}

export function presidentialVeto(c, bill, game) {
  bill.status = 'vetoed';
  if (game) game.pushNews('Президент', `Президент наложил вето на «${bill.name}»`, 'bad', c.id);
  c.stability = clamp(c.stability - 1, 0, 100);
  return { ok: true };
}

export function applyBillEffect(c, bill) {
  const e = bill.effect || {};
  if (e.taxes) for (const [k, v] of Object.entries(e.taxes)) c.taxes[k] = clamp((c.taxes[k] || 0) + v, 0, 0.75);
  if (e.spending) for (const [k, v] of Object.entries(e.spending)) c.spending[k] = clamp((c.spending[k] || 0) + v, 0, 0.30);
  if (e.treasury) c.treasury += e.treasury;
  if (e.approval) c.approval = clamp(c.approval + e.approval, 0, 100);
  if (e.wage) c.wage += e.wage;
  if (e.pension) c.pension += e.pension;
  if (e.unemployment) c.unemployment = clamp(c.unemployment + e.unemployment, 0, 1);
  if (e.inequality) c.inequality = clamp(c.inequality + e.inequality, 0, 1);
  if (e.inflation) c.inflation = clamp(c.inflation + e.inflation, -0.5, 3);
  if (e.growth) c.growth += e.growth;
  if (e.educationLevel) c.educationLevel = clamp(c.educationLevel + e.educationLevel, 0, 100);
  if (e.healthcareLevel) c.healthcareLevel = clamp(c.healthcareLevel + e.healthcareLevel, 0, 100);
  if (e.infrastructure) c.infrastructure = clamp(c.infrastructure + e.infrastructure, 0, 100);
  if (e.technology) c.technology = clamp(c.technology + e.technology, 0, 100);
  if (e.corruption) c.corruption = clamp(c.corruption + e.corruption, 0, 100);
  if (e.migrationRate) c.migrationRate += e.migrationRate;
  if (e.humanRights) c.humanRights = clamp(c.humanRights + e.humanRights, 0, 100);
  if (e.military && c.military) {
    for (const [k, v] of Object.entries(e.military)) {
      const cur = (c.military[k] || 0) + v;
      c.military[k] = k === 'personnel' ? Math.max(0, cur) : clamp(cur, 0, 100);
    }
  }
}

export function tickParliament(c, game, head = null) {
  c.bills = c.bills || [];
  initParliamentLife(c);

  // v3.9: парламентская жизнь (обращения/слухи/скандалы/протесты)
  tickParliamentLife(c, game);

  if (shouldHoldEmergencyDebate(c) && chance(0.15)) {
    holdEmergencyDebate(c, game);
  }
  if (shouldBrawl(c) && chance(0.05)) {
    parliamentBrawl(c, game);
  }

  const active = c.bills.filter(b => b.status === 'proposed');
  if (active.length >= 10) return;

  if (head && head.person && chance(0.05)) {
    const govBill = generateGovernmentBill(c, game, head);
    if (govBill) {
      c.bills.push(govBill);
      if (game) {
        game.pushNews('Парламент', `${govBill.sponsorName} вносит законопроект: «${govBill.name}»`, 'info', c.id);
        game.pendingBill = govBill;
      }
      return;
    }
  }

  // FIX (бэклог): снижено с 0.25 до 0.05 — иначе новые билли каждый день,
  // lastBillsCount меняется → renderTab('politics') дёргается постоянно
  if (!chance(0.05)) return;

  if (c.system === 'one_party' || c.system === 'authoritarian') {
    const ruling = c.parties.find(p => p.id === c.rulingPartyId);
    if (!ruling) return;
    if (!chance(0.30)) return;

    const bill = generateBill(c, { sponsor: ruling });
    if (!bill) return;

    bill.createdDate = { ...game.date };
    c.bills.push(bill);

    if (game) {
      game.pushNews('Парламент', `${bill.sponsorName} вносит законопроект: «${bill.name}»`, 'info', c.id);
      game.pendingBill = bill;
    }
    return;
  }

  const withSeats = c.parties.filter(p => p.seats > 0);
  if (!withSeats.length) return;

  const opposition = withSeats.filter(p => p.id !== c.rulingPartyId);
  const sponsor = opposition.length && chance(0.7) ? pick(opposition) : pick(withSeats);
  if (!sponsor) return;

  const bill = generateBill(c, { sponsor });
  if (!bill) return;

  bill.createdDate = { ...game.date };
  c.bills.push(bill);

  if (game) {
    game.pushNews('Парламент', `${bill.sponsorName} вносит законопроект: «${bill.name}»`, 'info', c.id);
    game.pendingBill = bill;
  }
}

function shouldBrawl(c) {
  return (c.stability ?? 50) < 40
    || (c.discontent ?? 40) > 65
    || (c.polarization ?? 0) > 60;
}

function shouldHoldEmergencyDebate(c) {
  return (c.wars || []).length > 0
    || (c.inflation ?? 0) > 0.15
    || (c.unemployment ?? 0) > 0.18
    || (c.approval ?? 50) < 25;
}

function parliamentBrawl(c, game) {
  const allDeputies = (c.parties || []).flatMap(p => p.deputies || []);
  if (allDeputies.length < 2) return;

  const attacker = pick(allDeputies);
  const victim = pick(allDeputies.filter(d => d.id !== attacker.id));
  if (!victim) return;

  c.stability = clamp(c.stability - 3, 0, 100);
  c.discontent = clamp(c.discontent + 2, 0, 100);
  c.approval = clamp(c.approval - 2, 0, 100);
  c.pressFreedom = clamp(c.pressFreedom + 1, 0, 100);

  attacker.scandals = (attacker.scandals || 0) + 1;

  const texts = [
    `Драка в парламенте: ${attacker.name} (${attacker.district}) против ${victim.name}`,
    `Депутаты устроили потасовку. Спикер прервал заседание.`,
    `Скандал: ${attacker.name} (${attacker.partyName}) обвинил ${victim.name} в предательстве`,
    `Потасовка в зале заседаний: ${attacker.name} и ${victim.name} подрались`,
  ];

  if (game) {
    game.pushNews('Парламент', pick(texts), 'bad', c.id);
  }
}

function holdEmergencyDebate(c, game) {
  const issues = [];
  if ((c.wars || []).length > 0) issues.push('война');
  if ((c.inflation ?? 0) > 0.15) issues.push('инфляция');
  if ((c.unemployment ?? 0) > 0.18) issues.push('безработица');
  if ((c.approval ?? 50) < 25) issues.push('кризис доверия');

  const issue = issues.length ? pick(issues) : 'общие вопросы';

  c.approval = clamp(c.approval + 1, 0, 100);
  c.stability = clamp(c.stability - 1, 0, 100);

  if (game) {
    game.pushNews('Парламент', `Срочные дебаты по теме: ${issue}`, 'info', c.id);
  }
}

export function autoResolveBills(c, game) {
  c.bills = c.bills || [];
  for (const bill of c.bills) {
    if (bill.status !== 'proposed') continue;
    if (bill.sponsorType === 'law') continue;
    const cd = bill.createdDate || { year: game.date.year, month: game.date.month };
    const age = (game.date.year - cd.year) * 12 + (game.date.month - cd.month);
    if (age >= 2) {
      if (bill.sponsorType === 'government' && parliamentCanBlock(c)) {
        parliamentBlockBill(c, bill, game);
      } else {
        voteOnBill(c, bill, game);
      }
    }
  }
}

export function getActiveBills(c) {
  return (c.bills || []).filter(b => b.status === 'proposed');
}

export function getBillHistory(c) {
  return (c.bills || []).filter(b => b.status !== 'proposed').sort((a, b) => {
    const da = a.createdDate.year * 12 + a.createdDate.month;
    const db = b.createdDate.year * 12 + b.createdDate.month;
    return db - da;
  });
}

export function getVotingStats(c, bill) {
  const r = predictVote(c, bill);
  const byParty = {};
  for (const p of c.parties || []) {
    byParty[p.id] = { party: p, support: 0, oppose: 0 };
  }
  for (const d of r.supportDeputies || []) {
    if (byParty[d.partyId]) byParty[d.partyId].support++;
  }
  for (const d of r.opposeDeputies || []) {
    if (byParty[d.partyId]) byParty[d.partyId].oppose++;
  }
  return { ...r, byParty };
}

// ============================================================
// v3.11: ДВУХПАЛАТНЫЙ ПАРЛАМЕНТ (СЕНАТ)
// ============================================================

const BICAMERAL_SYSTEMS = ['presidential', 'semi_presidential', 'parliamentary'];
const BICAMERAL_GOVERNMENTS = ['republic', 'federal_republic', 'constitutional_monarchy'];

export function hasSenate(c) {
  if (!c) return false;
  return BICAMERAL_SYSTEMS.includes(c.system) && BICAMERAL_GOVERNMENTS.includes(c.government);
}

export function initSenate(c) {
  if (!hasSenate(c)) return;
  if (!c.senate) {
    const total = Math.floor((c.seatsTotal || 100) / 2);
    c.senate = {
      seatsTotal: total,
      seats: [],
      lastElection: null,
      speaker: null,
    };
  }
}

export function getSenateSeats(c) {
  if (!hasSenate(c)) return 0;
  return c.senate?.seatsTotal || Math.floor((c.seatsTotal || 100) / 2);
}

export function predictSenateVote(c, bill) {
  if (!hasSenate(c)) return null;
  const total = getSenateSeats(c);
  const isLaw = bill.sponsorType === 'law';
  const base = isLaw ? (LAW_VOTE_BASE || {}) : (VOTE_MAP[bill.templateId] || {});

  let support = 0, oppose = 0;
  const senateSeats = c.senate?.seats || [];

  if (senateSeats.length === 0) {
    const lower = predictVote(c, bill);
    support = Math.floor(lower.supportSeats * 0.5);
    oppose = total - support;
  } else {
    for (const s of senateSeats) {
      let prob = base[s.ideology] ?? 0.5;
      if (s.partyId === c.rulingPartyId) prob += 0.15;
      if (s.partyId === bill.sponsorPartyId) prob = 1;
      prob = clamp(prob + gauss(0, 0.1), 0, 1);
      if (prob >= 0.5) support++;
      else oppose++;
    }
  }

  if (bill.playerVoteBonus) {
    support = Math.max(0, Math.min(total, support + Math.floor(bill.playerVoteBonus / 2)));
    oppose = total - support;
  }

  return { supportSeats: support, opposeSeats: oppose, passes: support > total / 2, total };
}

export function voteOnBillSenate(c, bill, game) {
  const r = predictSenateVote(c, bill);
  if (!r) return { ok: false, reason: 'Нет сената' };
  if (r.passes) {
    if (game) game.pushNews('Сенат', `Сенат одобрил: «${bill.name}»`, 'good', c.id);
    return { ok: true, passed: true, support: r.supportSeats, oppose: r.opposeSeats };
  } else {
    if (game) game.pushNews('Сенат', `Сенат отклонил: «${bill.name}»`, 'bad', c.id);
    return { ok: true, passed: false, support: r.supportSeats, oppose: r.opposeSeats };
  }
}

export function getSenateStats(c) {
  if (!hasSenate(c)) return null;
  const total = getSenateSeats(c);
  const seats = c.senate?.seats || [];
  return {
    total,
    filled: seats.length,
    parties: c.parties?.map(p => ({
      partyId: p.id,
      partyName: p.name,
      partyColor: p.color,
      seats: seats.filter(s => s.partyId === p.id).length,
    })).filter(x => x.seats > 0) || [],
    speaker: c.senate?.speaker || null,
  };
}

// ============================================================
// v3.11: КОМИТЕТЫ ПАРЛАМЕНТА
// ============================================================
const COMMITTEE_TYPES = [
  { id: 'budget',     name: '💰 Бюджетный',         icon: '💰' },
  { id: 'defense',    name: '⚔️ Оборонный',          icon: '⚔️' },
  { id: 'education',  name: '🎓 Образование',        icon: '🎓' },
  { id: 'healthcare', name: '🏥 Медицина',           icon: '🏥' },
  { id: 'infra',      name: '🏗️ Инфраструктура',     icon: '🏗️' },
  { id: 'trade',      name: '🚢 Торговля',           icon: '🚢' },
  { id: 'rights',     name: '⚖️ Права',              icon: '⚖️' },
  { id: 'ecology',    name: '🌿 Экология',           icon: '🌿' },
];

export function getCommittees(c) {
  if (!c.committees) c.committees = [];
  return c.committees;
}

export function createCommittee(c, typeId, chairmanId) {
  if (!c.committees) c.committees = [];
  if (c.committees.find(cm => cm.typeId === typeId)) {
    return { ok: false, reason: 'Комитет уже существует' };
  }
  const type = COMMITTEE_TYPES.find(t => t.id === typeId);
  if (!type) return { ok: false, reason: 'Неизвестный тип' };

  const allDeputies = (c.parties || []).flatMap(p => p.deputies || []);
  // FIX: pick вместо Math.random() для консистентности с rng.js
  const chairman = chairmanId ? allDeputies.find(d => d.id === chairmanId) : pick(allDeputies);
  if (!chairman) return { ok: false, reason: 'Нет депутатов' };

  c.committees.push({
    typeId,
    name: type.name,
    icon: type.icon,
    chairmanId: chairman.id,
    chairmanName: chairman.name,
    createdAt: { ...(c._date || { year: 1936, month: 1, day: 1 }) },
    efficiency: 50,
  });
  return { ok: true };
}

export function dissolveCommittee(c, typeId) {
  if (!c.committees) return { ok: false, reason: 'Нет комитетов' };
  const idx = c.committees.findIndex(cm => cm.typeId === typeId);
  if (idx === -1) return { ok: false, reason: 'Комитет не найден' };
  c.committees.splice(idx, 1);
  return { ok: true };
}

// ============================================================
// v3.11: ФРАКЦИИ
// ============================================================
export function getFactions(c) {
  const parties = c.parties || [];
  return parties.map(p => ({
    partyId: p.id,
    partyName: p.name,
    partyColor: p.color,
    spectrum: p.spectrum,
    discipline: p.discipline || 50,
    seats: p.seats || 0,
    wing: p.spectrum < -3 ? 'left' : p.spectrum > 3 ? 'right' : 'center',
  }));
}

export function strengthenDiscipline(c, partyId, amount = 5) {
  const party = (c.parties || []).find(p => p.id === partyId);
  if (!party) return { ok: false, reason: 'Партия не найдена' };
  if ((c.treasury || 0) < 0.01) return { ok: false, reason: 'Мало денег' };
  c.treasury -= 0.01;
  party.discipline = clamp((party.discipline || 50) + amount, 0, 100);
  return { ok: true };
}

// ============================================================
// v3.11: ЗАКОНОДАТЕЛЬНАЯ ПОВЕСТКА
// ============================================================
export function getLegislativeAgenda(c) {
  const bills = (c.bills || []).filter(b => b.status === 'proposed');
  return bills
    .map(b => ({
      ...b,
      priority: b.sponsorType === 'government' ? 2 : 1,
      daysLeft: b.daysLeft ?? b.daysTotal ?? 60,
    }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return (a.daysLeft ?? 999) - (b.daysLeft ?? 999);
    })
    .slice(0, 10);
}

export function accelerateBill(c, billId, days = 5) {
  const bill = (c.bills || []).find(b => b.id === billId);
  if (!bill) return { ok: false, reason: 'Билль не найден' };
  if ((c.treasury || 0) < 0.01) return { ok: false, reason: 'Мало денег' };
  c.treasury -= 0.01;
  // FIX: для law-биллей daysLeft пересчитывается tickActiveBills от createdDate,
  // поэтому меняем daysTotal, а не daysLeft — иначе ускорение затрётся
  if (bill.sponsorType === 'law') {
    bill.daysTotal = Math.max(1, (bill.daysTotal || 60) - days);
  } else {
    bill.daysLeft = Math.max(0, (bill.daysLeft ?? 60) - days);
  }
  bill._cachedVote = null;
  bill._cachedDay = -1;
  return { ok: true };
}

export function postponeBill(c, billId, days = 10) {
  const bill = (c.bills || []).find(b => b.id === billId);
  if (!bill) return { ok: false, reason: 'Билль не найден' };
  // FIX: для law-биллей меняем daysTotal, а не daysLeft
  if (bill.sponsorType === 'law') {
    bill.daysTotal = Math.min(180, (bill.daysTotal || 60) + days);
  } else {
    bill.daysLeft = Math.min(bill.daysTotal || 60, (bill.daysLeft ?? 60) + days);
  }
  bill._cachedVote = null;
  bill._cachedDay = -1;
  return { ok: true };
}

// ============================================================
// v3.11: СЕССИЯ ПАРЛАМЕНТА
// ============================================================
export function getSessionInfo(c) {
  if (!c.session) {
    c.session = { number: 1, startDate: { ...(c._date || { year: 1936, month: 1, day: 1 }) }, daysTotal: 90, daysLeft: 90, closed: false };
  }
  return c.session;
}

export function openSession(c) {
  const s = getSessionInfo(c);
  s.closed = false;
  s.daysLeft = s.daysTotal;
  s.startDate = { ...(c._date || { year: 1936, month: 1, day: 1 }) };
  s.number += 1;
  return { ok: true };
}

export function closeSession(c) {
  const s = getSessionInfo(c);
  s.closed = true;
  s.daysLeft = 0;
  return { ok: true };
}

// ============================================================
// v3.11: ИНТЕРПЕЛЛЯЦИИ (запросы)
// ============================================================
export function getInterpellations(c) {
  if (!c.interpellations) c.interpellations = [];
  return c.interpellations.slice(0, 10);
}

export function createInterpellation(c, deputyId, topic) {
  if (!c.interpellations) c.interpellations = [];
  const allDeputies = (c.parties || []).flatMap(p => p.deputies || []);
  const deputy = allDeputies.find(d => d.id === deputyId);
  if (!deputy) return { ok: false, reason: 'Депутат не найден' };
  c.interpellations.unshift({
    id: uid(),
    deputyId: deputy.id,
    deputyName: deputy.name,
    topic: topic || 'Общие вопросы',
    status: 'pending',
    createdAt: { ...(c._date || { year: 1936, month: 1, day: 1 }) },
  });
  if (c.interpellations.length > 30) c.interpellations.pop();
  return { ok: true };
}

export function answerInterpellation(c, interpellationId, accepted) {
  if (!c.interpellations) return { ok: false, reason: 'Нет запросов' };
  const it = c.interpellations.find(x => x.id === interpellationId);
  if (!it) return { ok: false, reason: 'Запрос не найден' };
  it.status = accepted ? 'answered' : 'rejected';
  if (accepted) {
    c.approval = clamp((c.approval || 50) + 1, 0, 100);
  } else {
    c.approval = clamp((c.approval || 50) - 1, 0, 100);
    c.discontent = clamp((c.discontent || 40) + 1, 0, 100);
  }
  return { ok: true };
}

// ============================================================
// v3.11: КОАЛИЦИЯ И ОППОЗИЦИЯ
// ============================================================
export function getCoalitionInfo(c) {
  const coalition = c.coalition || [];
  const parties = c.parties || [];
  const inCoalition = parties.filter(p => coalition.includes(p.id));
  const outside = parties.filter(p => !coalition.includes(p.id) && p.seats > 0);

  const coalitionSeats = inCoalition.reduce((a, p) => a + p.seats, 0);
  const majority = Math.floor((c.seatsTotal || 100) / 2) + 1;

  const ruling = parties.find(p => p.id === c.rulingPartyId);
  const potential = outside
    .map(p => ({
      party: p,
      distance: Math.abs((p.spectrum ?? 0) - (ruling?.spectrum ?? 0)),
    }))
    .filter(x => x.distance < 5)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);

  return {
    inCoalition,
    outside,
    coalitionSeats,
    majority,
    hasMajority: coalitionSeats >= majority,
    potential,
  };
}

export function getOppositionInfo(c) {
  const coalition = c.coalition || [];
  const parties = c.parties || [];
  const opposition = parties.filter(p => !coalition.includes(p.id) && p.seats > 0);
  const totalSeats = opposition.reduce((a, p) => a + p.seats, 0);

  const allDeputies = opposition.flatMap(p => (p.deputies || []).map(d => ({ ...d, partyName: p.name, partyColor: p.color })));
  const leader = allDeputies.sort((a, b) => (b.charisma || 0) - (a.charisma || 0))[0] || null;

  return {
    parties: opposition,
    totalSeats,
    leader,
  };
}

// ============================================================
// v3.11: СТАТИСТИКА ГОЛОСОВАНИЙ (расширенная)
// ============================================================
export function getVotingStatsDetailed(c) {
  const bills = c.bills || [];
  const passed = bills.filter(b => b.status === 'passed').length;
  const rejected = bills.filter(b => b.status === 'rejected').length;
  const blocked = bills.filter(b => b.status === 'blocked').length;
  const vetoed = bills.filter(b => b.status === 'vetoed').length;
  const total = passed + rejected + blocked + vetoed;

  const history = (c.history || []).slice(-12).map(h => ({
    month: h.month || 0,
    year: h.year || 1936,
    passed: h.billsPassed || 0,
    rejected: h.billsRejected || 0,
  }));

  return { passed, rejected, blocked, vetoed, total, history };
}

// ============================================================
// v3.11: АВТОМАТИЧЕСКИЕ ТИКИ
// ============================================================

// --- СЕНАТ: раз в месяц обновляем распределение ---
export function tickSenate(c, game) {
  if (!hasSenate(c)) return;
  initSenate(c);
  const total = getSenateSeats(c);
  if (total <= 0) return;

  // Инициализация распределения (если пусто)
  if (!c.senate.seats || c.senate.seats.length === 0) {
    c.senate.seats = [];
    const parties = (c.parties || []).filter(p => p.seats > 0);
    if (!parties.length) return;
    const totalPartySeats = parties.reduce((a, p) => a + p.seats, 0);
    for (const p of parties) {
      const share = totalPartySeats > 0 ? p.seats / totalPartySeats : 1 / parties.length;
      const count = Math.round(total * share);
      for (let i = 0; i < count && c.senate.seats.length < total; i++) {
        c.senate.seats.push({
          partyId: p.id,
          partyName: p.name,
          ideology: p.ideology,
          loyalty: 50 + Math.round(gauss(0, 10)),
          since: { ...(game?.date || c._date || { year: 1936, month: 1, day: 1 }) },
        });
      }
    }
    // Добить остаток в крупнейшую партию
    while (c.senate.seats.length < total) {
      const big = parties.reduce((a, p) => p.seats > a.seats ? p : a, parties[0]);
      c.senate.seats.push({
        partyId: big.id, partyName: big.name, ideology: big.ideology,
        loyalty: 50, since: { ...(game?.date || c._date || { year: 1936, month: 1, day: 1 }) },
      });
    }
  }

  // Раз в месяц — пересменка (5% сенаторов)
  if (chance(0.15)) {
    const swapCount = Math.max(1, Math.floor(total * 0.05));
    const allParties = (c.parties || []).filter(p => p.seats > 0);
    if (!allParties.length) return;
    for (let i = 0; i < swapCount; i++) {
      // FIX: randInt вместо Math.random() для консистентности
      const idx = randInt(0, c.senate.seats.length - 1);
      const p = pick(allParties);
      c.senate.seats[idx] = {
        partyId: p.id, partyName: p.name, ideology: p.ideology,
        loyalty: 50 + Math.round(gauss(0, 10)),
        since: { ...(game?.date || c._date || { year: 1936, month: 1, day: 1 }) },
      };
    }
  }

  // Дрейф лояльности
  for (const s of c.senate.seats) {
    s.loyalty = clamp((s.loyalty || 50) + gauss(0, 1.5), 0, 100);
  }
}

// --- КОМИТЕТЫ: раз в месяц ---
export function tickCommittees(c, game) {
  if (!Array.isArray(c.committees) || !c.committees.length) return;
  for (const cm of c.committees) {
    cm.efficiency = clamp((cm.efficiency || 50) + gauss(0, 2), 0, 100);
    if (chance(0.02) && c.committees.length > 1) {
      cm._dissolve = true;
    }
  }
  c.committees = c.committees.filter(cm => !cm._dissolve);
}

// --- ФРАКЦИИ: раз в месяц ---
export function tickFactions(c, game) {
  const parties = c.parties || [];
  for (const p of parties) {
    const cur = p.discipline ?? 50;
    const drift = (50 - cur) * 0.05 + gauss(0, 1);
    p.discipline = clamp(cur + drift, 0, 100);
    if (chance(0.03)) {
      p.discipline = clamp(p.discipline + (chance(0.5) ? 5 : -5), 0, 100);
    }
  }
}

// --- СЕССИЯ: ежедневно ---
export function tickSession(c, game) {
  const s = getSessionInfo(c);
  if (s.closed) return;
  if (s.daysLeft > 0) {
    s.daysLeft -= 1;
    if (s.daysLeft <= 0) {
      closeSession(c);
      if (game) game.pushNews('Парламент', `Сессия № ${s.number} завершена`, 'info', c.id);
    }
  }
}

// --- ИНТЕРПЕЛЛЯЦИИ: раз в месяц ---
export function tickInterpellations(c, game) {
  if (!Array.isArray(c.interpellations)) c.interpellations = [];
  const allDeputies = (c.parties || []).flatMap(p => p.deputies || []);
  if (!allDeputies.length) return;

  // Новый запрос (20%)
  if (chance(0.20)) {
    const deputy = pick(allDeputies);
    const topics = ['бюджета', 'обороны', 'образования', 'медицины', 'инфраструктуры', 'торговли'];
    createInterpellation(c, deputy.id, pick(topics));
  }

  // Авто-ответ через 7 дней
  const now = game?.date || c._date;
  if (!now) return;
  const nowDay = (now.year - 1936) * 360 + ((now.month || 1) - 1) * 30 + (now.day || 1);
  for (const it of c.interpellations) {
    if (it.status !== 'pending') continue;
    const d = it.createdAt || { year: 1936, month: 1, day: 1 };
    const dDay = (d.year - 1936) * 360 + ((d.month || 1) - 1) * 30 + (d.day || 1);
    if (nowDay - dDay >= 7) {
      answerInterpellation(c, it.id, chance(0.6));
    }
  }
}

// --- ПОВЕСТКА: ежедневно ---
export function tickLegislativeAgenda(c, game) {
  if (!Array.isArray(c.bills) || !c.bills.length) return;

  // Правительственные билли «продавливаются» быстрее
  for (const b of c.bills) {
    if (b.status !== 'proposed') continue;
    if (b.sponsorType === 'government' && chance(0.02)) {
      b.daysLeft = Math.max(0, (b.daysLeft ?? 60) - 1);
    }
  }
}

export { COMMITTEE_TYPES };
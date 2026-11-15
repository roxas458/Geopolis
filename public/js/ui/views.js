import { el, mount, toast } from '../core/dom.js';
import { num, pct, pctRaw, int, dateShort, dateStr, signNum } from '../core/util.js';
import { flagBox, card, statBig, kv, bar, slider, sparkline, listRow } from './components.js';
import * as net from '../net/actions.js';
import {
  TAX_KEYS, TAX_LABELS, SPEND_KEYS, SPEND_LABELS,
  revenue, spending, annualBalance,
  setTax, setSpending, setInterestRate, setGoldStandard, setBankReserveRatio,
  PROJECTS, startProject, nationalize, privatize,
  // FIX: новые экономические действия
  setMinimumWage, setPensionAge, setPensionRate,
  devalueCurrency, revalueCurrency,
  setCbIndependence, setCbChairman,
} from '../game/economy.js';
import {
  MINISTRY_LABELS,
  runParliamentaryElection, runPresidentialElection,
  formCoalition, impeachPresident, appointMinister,
  electSpeaker, changePartyLeader, fundParty, boostParty,
  dissolveParty, createParty,
  POSITIONS, getHeadOfState,
  initPartyGoal, initPersonGoal,
  oppositionRally, oppositionScandal, callVoteOfNoConfidence,
  registerParty, dismissGovernment,
  startReferendum, REFERENDUM_QUESTIONS,
  setPartyProgram, PROGRAM_POINTS,
  getCompetitionLabel,
  findPersonById,
  CRISIS_PHASES,
  startConstitutionalCrisis, abortConstitutionalCrisis,
} from '../game/politics.js';
import {
  startPresidentialCampaign, startParliamentaryCampaign,
  campaignAction, finishElection, cancelElection,
  getElectionStatus, CAMPAIGN_ACTIONS,
} from '../game/elections.js';
import { LAWS, passLaw, proposeLaw, revokeLaw } from '../game/laws.js';
import {
  getRelation, getRelationLevel, RELATION_LEVELS, TREATY_TYPES, DIPLOMATIC_RANKS,
  ESPIONAGE_OPS, hasTreaty, getTreaties,
  signTreaty, breakTreaty, openEmbassy, closeEmbassy, setRank,
  improveRelations, holdSummit,
  sendAid, sendMilitaryAid, conductEspionage, propaganda,
  imposeSanctions, liftSanctions, issueUltimatum,
  declareWar, makePeace, jointExercise,
} from '../game/diplomacy.js';
import { computeRankings, computeHDI, computeDemocracy, computeEconomicFreedom, computeMilitaryPower } from '../game/stats.js';
import { resolveChoice } from '../game/events.js';
import {
  getActiveBills, getBillHistory, voteOnBill, presidentialVeto, predictVote,
  generateGovernmentBill, parliamentCanBlock, parliamentBlockBill,
  getParliamentLife, getAllDeputiesDetailed, getDeputyStats,
  getParliamentLifeSummary, PARLIAMENT_LIFE_TYPES,
  isAwaitingPlayerVote, getPlayerVoteWindow, castBillVote, VOTE_WINDOW, VOTE_BONUS,
  hasSenate, initSenate, getSenateSeats, predictSenateVote, voteOnBillSenate, getSenateStats,
  getCommittees, createCommittee, dissolveCommittee, COMMITTEE_TYPES,
  getFactions, strengthenDiscipline,
  getLegislativeAgenda, accelerateBill, postponeBill,
  getSessionInfo, openSession, closeSession,
  getInterpellations, createInterpellation, answerInterpellation,
  getCoalitionInfo, getOppositionInfo, getVotingStatsDetailed,
} from '../game/parliament.js';
import { UNION_TYPES, ASSOCIATION_TYPES, unionAction, assocAction } from '../game/groups.js';
import { PARLIAMENT_POWERS, amendPower, getConstitutionalEffects } from '../game/constitution.js';
// v3.15: внутренняя безопасность и правовая система + журнал
import {
  setPoliceFunding, setJudicialReform, launchAntiCorruption,
  setLocalAutonomy, protestAction, strikeAction,
  logAction,
} from '../game/society.js';

let currentTab = 'overview';
const collapsedLawCategories = new Set();

export function setTab(tab) { currentTab = tab; }

// ============================================================
// ХЕЛПЕР — одиночная / мультиплеер
// ============================================================
function isNet(engine) {
  return !!(engine && engine.isNetEngine);
}

// v3.15: проверка прав — правительственные действия
function canGovern(c) {
  return c && c.playerInPower !== false;
}

function act(engine, singleFn, netFn, logInfo = null) {
  if (isNet(engine)) {
    try {
      const p = netFn();
      if (p && typeof p.then === 'function') {
        return p.then(r => {
          if (r && r.ok === false) toast(r.reason || 'Ошибка', 'error');
          engine.notify();
          return r;
        }).catch(e => {
          toast('Ошибка: ' + e.message, 'error');
          return { ok: false, reason: e.message };
        });
      }
      return p;
    } catch (e) {
      toast('Ошибка: ' + e.message, 'error');
      return { ok: false, reason: e.message };
    }
  }
  const r = singleFn();
  if (r && r.ok === false) toast(r.reason || 'Ошибка', 'error');
  // v3.15: журнал действий (только при успехе и если передан logInfo)
  if (r && r.ok !== false && logInfo) {
    try {
      const c = engine.getPlayer?.();
      if (c) logAction(c, logInfo.type, logInfo.text, logInfo.kind);
    } catch (e) { /* ignore */ }
  }
  return r;
}

export function renderTab(engine, tab = currentTab) {
  currentTab = tab;
  const root = document.getElementById('view');
  if (!root) return;
  const player = engine.getPlayer();
  const scrollPos = root.scrollTop;
  const map = {
    overview: viewOverview,
    economy: viewEconomy,
    politics: viewPolitics,
    parliament: viewParliament,
    society: viewSociety,
    diplomacy: viewDiplomacy,
    military: viewMilitary,
    stats: viewStats,
    news: viewNews,
  };
  mount(root, (map[tab] || viewOverview)(engine, player));
  root.scrollTop = scrollPos;

  if (player && (player.playerWon || player.playerLost) && !player._endgameShown && !isEventModalOpen()) {
    player._endgameShown = true;
    showEndGameModal(engine, player);
  }
  if (player && !player.playerWon && !player.playerLost && player._endgameShown) {
    player._endgameShown = false;
  }
}

function visibleNews(engine) {
  return (engine.news || []).filter(n =>
    n.isPlayer || n.kind === 'good' || n.kind === 'bad'
  );
}

export function updateView(engine, tab = currentTab) {
  if (!engine) return;
  const root = document.getElementById('view');
  if (!root) return;
  const c = engine.getPlayer();
  if (!c) return;

  const setKV = (key, value) => {
    root.querySelectorAll(`[data-kv="${key}"]`).forEach(n => { n.textContent = value; });
  };
  const setBar = (key, value, max = 100) => {
    const pctWidth = Math.max(0, Math.min(100, (value / max) * 100));
    root.querySelectorAll(`[data-bar="${key}"]`).forEach(n => { n.style.width = pctWidth + '%'; });
  };

  if (tab === 'overview') {
    setKV('gdp', '$ ' + num(c.gdp) + ' млрд');
    setKV('gdp-growth', `Рост ${pct((c.growth || 0) * 12, 2)}/год`);
    setKV('gdp-delta', ((c.growth || 0) >= 0 ? '▲ ' : '▼ ') + pct(Math.abs((c.growth || 0) * 12), 2));
    setKV('population', num(c.population));
    setKV('life-exp', `Ожидаемая жизнь: ${(c.lifeExpectancy || 0).toFixed(1)} лет`);
    setKV('area', int(c.area) + ' км²');
    setKV('density', `Плотность: ${(c.area > 0 ? (c.population / c.area).toFixed(1) : '0')} чел/км²`);
    setKV('influence', Math.round(c.influence || 0) + ' / 100');
    setKV('reputation', `Репутация: ${Math.round(c.reputation || 0)}`);
    setKV('gdp-per-capita', '$ ' + num(c.gdpPerCapita));
    setKV('debt', '$ ' + num(c.debt) + ' млрд (' + pct(c.debt / Math.max(c.gdp, 1)) + ' ВВП)');
    setKV('budget', ((c.budget || 0) >= 0 ? 'Профицит ' : 'Дефицит ') + '$ ' + num(Math.abs(c.budget || 0)) + ' млрд');
    setKV('inflation', pct(c.inflation));
    setKV('unemployment', pct(c.unemployment));
    setKV('poverty', pct(c.poverty));
    setKV('cycle', cycleName(c.cyclePhase));
    setKV('approval', pctRaw(c.approval));
    setKV('discontent', pctRaw(c.discontent));
    setKV('stability', pctRaw(c.stability));
    setKV('education', pctRaw(c.educationLevel));
    setKV('healthcare', pctRaw(c.healthcareLevel));
    setKV('crime', pctRaw(c.crimeRate));
    setKV('inequality', ((c.inequality || 0) * 100).toFixed(0) + '%');
    setKV('president', c.president?.name || '—');
    setKV('speaker', c.speaker?.name || '—');
    setKV('ruling-party', c.parties?.find(p => p.id === c.rulingPartyId)?.name || '—');
    setKV('corruption', pctRaw(c.corruption));
    setKV('press-freedom', pctRaw(c.pressFreedom));
    setKV('judicial', pctRaw(c.judicialIndependence));
    setKV('unions-count', (c.unions || []).length + ' шт.');
    setKV('assoc-count', (c.associations || []).filter(a => !a.banned).length + ' активных');
    setKV('treaties-count', (c.treaties || []).length + ' шт.');
    setKV('wars-count', (c.wars || []).length > 0 ? `⚔️ ${c.wars.length}` : '—');
  }

  if (tab === 'economy') {
    setKV('budget-revenue', '$ ' + num(revenue(c)) + ' млрд');
    setKV('budget-spending', '$ ' + num(spending(c)) + ' млрд');
    setKV('budget-treasury', '$ ' + num(c.treasury) + ' млрд');
    setKV('budget-debt', '$ ' + num(c.debt) + ' млрд');
    setKV('macro-gdp', '$ ' + num(c.gdp) + ' млрд');
    setKV('macro-gdp-pc', '$ ' + num(c.gdpPerCapita));
    setKV('macro-inflation', pct(c.inflation));
    setKV('macro-unemployment', pct(c.unemployment));
    setKV('macro-wage', '$ ' + num(c.wage));
    setKV('macro-pension', '$ ' + num(c.pension));
    setKV('macro-cycle', cycleName(c.cyclePhase));
    setKV('trade-exports', '$ ' + num(c.exports) + ' млрд');
    setKV('trade-imports', '$ ' + num(c.imports) + ' млрд');
    setKV('trade-fdi', '$ ' + num(c.fdi) + ' млрд');
    setKV('trade-currency', c.currency || '$');
    setKV('gold-reserves', '$ ' + num(c.goldReserves || 0) + ' млрд');
    setKV('gold-status', c.goldStandard ? '🟡 Золотой стандарт' : '⚪ Фиатная валюта');
    setKV('credit-rating', Math.round(c.creditRating || 50) + ' / 100');
    setKV('agri-share', pct(c.agricultureShare ?? 0.4));
    setKV('industry-share', pct(c.industryShare ?? 0.35));
    setKV('services-share', pct(c.servicesShare ?? 0.25));
    setKV('public-sector', pct(c.publicSectorShare ?? 0.25));
  }

  if (tab === 'society') {
    setKV('soc-population', int(c.population));
    setKV('soc-area', int(c.area) + ' км²');
    setKV('soc-density', (c.area > 0 ? (c.population / c.area).toFixed(1) : '0') + ' чел/км²');
    setKV('birth-rate', (c.birthRate || 0).toFixed(1) + ' / 1000');
    setKV('death-rate', (c.deathRate || 0).toFixed(1) + ' / 1000');
    setKV('migration', signNum(c.migrationRate || 0, 2) + ' / 1000');
    setKV('life-expectancy', (c.lifeExpectancy || 0).toFixed(1) + ' лет');
    setKV('age-structure', `${(c.ageStructure?.children || 0).toFixed(0)}% / ${(c.ageStructure?.adults || 0).toFixed(0)}% / ${(c.ageStructure?.elderly || 0).toFixed(0)}%`);
    setKV('literacy', pct(c.literacy, 1));
    setKV('soc-education', pctRaw(c.educationLevel));
    setKV('soc-healthcare', pctRaw(c.healthcareLevel));
    setKV('infrastructure', pctRaw(c.infrastructure));
    setKV('technology', pctRaw(c.technology));
    setKV('soc-crime', pctRaw(c.crimeRate));
    setKV('soc-inequality', ((c.inequality || 0) * 100).toFixed(1) + '%');
    setKV('soc-poverty', pct(c.poverty));
    setKV('shadow-economy', pct(c.shadowEconomy));
    setKV('happiness', pctRaw(c.happiness));
    setKV('soc-approval', pctRaw(c.approval));
    setKV('soc-discontent', pctRaw(c.discontent));
    setKV('soc-press-freedom', pctRaw(c.pressFreedom));
    setKV('human-rights', pctRaw(c.humanRights));
    setKV('minority-rights', pctRaw(c.minorityRights));
    setKV('soc-judicial', pctRaw(c.judicialIndependence));
    setKV('soc-corruption', pctRaw(c.corruption));
        setKV('democracy', computeDemocracy(c) + ' / 100');
    setKV('hdi', computeHDI(c).toFixed(2));
    setKV('econ-freedom', computeEconomicFreedom(c) + ' / 100');
    // v3.15: внутренняя безопасность
    setKV('soc-rule-of-law', pctRaw(c.ruleOfLaw ?? 50));
    setKV('soc-local-autonomy', Math.round(c.localAutonomy ?? 50) + ' / 100');
    setKV('soc-judicial-2', pctRaw(c.judicialIndependence));
    setKV('soc-corruption-2', pctRaw(c.corruption));
    setKV('soc-crime-2', pctRaw(c.crimeRate));
  }

  if (tab === 'military') {
    const m = c.military || {};
    setKV('mil-personnel', int(m.personnel || 0));
    setKV('mil-budget', '$ ' + num((c.spending?.military || 0) * c.gdp) + ' млрд');
    setKV('mil-share', pct(c.spending?.military || 0));
    setKV('mil-industry', pctRaw(m.industry || 0));
    setKV('mil-readiness', pctRaw(m.readiness || 0));
    setKV('mil-mobilization', pctRaw(m.mobilization || 0));
    setKV('mil-power', computeMilitaryPower(c) + ' / 100');
    setBar('mil-readiness-bar', m.readiness || 0);
  }

  if (tab === 'diplomacy') {
    setKV('diplo-allies', (c.alliances || []).length);
    setKV('diplo-treaties', (c.treaties || []).length);
    setKV('diplo-wars', (c.wars || []).length);
    setKV('diplo-sanctions', (c.sanctions || []).length);
    setKV('diplo-embassies', Object.keys(c.embassies || {}).length);
    setKV('diplo-bases', (c.bases || []).length);
    setKV('diplo-reputation', Math.round(c.reputation || 0) + ' / 100');
    setKV('diplo-influence', Math.round(c.influence || 0) + ' / 100');
  }

  if (tab === 'politics' || tab === 'parliament') {
    const bills = (c.bills || []).filter(b => b.status === 'proposed' && b.sponsorType === 'law');

    for (const b of bills) {
      const daysLeft = b.daysLeft ?? b.daysTotal ?? 60;
      const daysTotal = b.daysTotal || 60;
      const daysPassed = Math.max(0, daysTotal - daysLeft);
      const vote = b._cachedVote || { supportSeats: b.supportSeats || 0, opposeSeats: b.opposeSeats || 0, passes: (b.supportSeats || 0) > c.seatsTotal / 2 };

      root.querySelectorAll(`[data-law-days="${b.lawId}"]`).forEach(n => {
        const voteInfo = b.playerVote
          ? ` · ${b.playerVote === 'for' ? '✅ За' : b.playerVote === 'against' ? '❌ Против' : '⚪ Возд.'}`
          : '';
        n.textContent = `⏳ Осталось ${daysLeft} дн. · ${vote.passes ? '✅' : '❌'} ${vote.supportSeats}/${vote.opposeSeats}${voteInfo}`;
      });
      root.querySelectorAll(`[data-law-bar="${b.lawId}"]`).forEach(n => {
        n.style.width = Math.min(100, (daysPassed / Math.max(daysTotal, 1)) * 100) + '%';
      });

      root.querySelectorAll(`[data-bill-days="${b.id}"]`).forEach(n => {
        n.textContent = `⏳ Осталось ${daysLeft} дн. до голосования`;
      });
      root.querySelectorAll(`[data-bill-count="${b.id}"]`).forEach(n => {
        n.textContent = `${daysPassed}/${daysTotal}`;
      });
      root.querySelectorAll(`[data-bill-bar="${b.id}"]`).forEach(n => {
        n.style.width = Math.min(100, (daysPassed / Math.max(daysTotal, 1)) * 100) + '%';
      });
      root.querySelectorAll(`[data-bill-vote="${b.id}"]`).forEach(n => {
        n.textContent = `${vote.passes ? '✅ проходит' : '❌ не проходит'}`;
        n.className = vote.passes ? 'pos' : 'neg';
      });
      root.querySelectorAll(`[data-bill-seats="${b.id}"]`).forEach(n => {
        n.textContent = `${vote.supportSeats} / ${vote.opposeSeats}`;
      });
      root.querySelectorAll(`[data-bill-support-bar="${b.id}"]`).forEach(n => {
        n.style.width = Math.min(100, (vote.supportSeats / Math.max(c.seatsTotal, 1)) * 100) + '%';
      });
    }
  }
}

// ============================================================
// ХЕЛПЕРЫ
// ============================================================
function kvK(k, v, key) {
  const vEl = el('span', { class: 'v' }, v);
  if (key) vEl.setAttribute('data-kv', key);
  return el('div', { class: 'kv' }, el('span', { class: 'k' }, k), vEl);
}

function card2(title, tag, ...children) {
  const h = el('h3', {}, title, tag ? el('span', { class: 'tag' }, tag) : null);
  return el('div', { class: 'card' }, h, ...children);
}

function openModal(title, body, actions) {
  const modal = document.getElementById('event-modal');
  if (!modal) return null;
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  mount(modal,
    el('div', { class: 'modal-card' },
      el('h2', {}, title),
      ...(Array.isArray(body) ? body : [body]),
      el('div', { class: 'mt-16 flex gap-8 wrap' },
        ...(actions || []).map(a => el('button', {
          class: 'btn small' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''),
          onclick: () => { close(); a.onClick && a.onClick(); }
        }, a.label)),
        el('button', { class: 'btn small', onclick: close }, 'Отмена')
      )
    )
  );
  return { close, modal };
}

// ============================================================
// МОДАЛКА ПОБЕДЫ / ПОРАЖЕНИЯ
// ============================================================
function showEndGameModal(engine, c) {
  const modal = document.getElementById('event-modal');
  if (!modal) return;
  const isWin = c.playerWon;
  const isLoss = c.playerLost;
  if (!isWin && !isLoss) return;

  modal.classList.remove('hidden');
  mount(modal,
    el('div', { class: 'modal-card' },
      el('h2', { style: { fontSize: '24px' } }, isWin ? '🏆 Победа!' : '💀 Поражение'),
      el('p', {}, isWin ? c.playerWinReason : c.playerLoseReason),
      el('div', { class: 'mt-16 flex gap-8 wrap' },
        el('button', { class: 'btn small primary', onclick: () => {
          modal.classList.add('hidden');
          c.playerWon = false;
          c.playerLost = false;
          c.playerWinReason = null;
          c.playerLoseReason = null;
          c.playerPartyGoal = null;
          c.playerPersonGoal = null;
          c._endgameShown = false;
          engine.notify();
        } }, isWin ? 'Продолжить' : 'Продолжить (оппозиция)'),
        el('button', { class: 'btn small danger', onclick: () => {
          modal.classList.add('hidden');
          c.playerPartyGoal = null;
          c.playerPersonGoal = null;
          c._endgameShown = false;
          if (typeof window.__toMenu === 'function') window.__toMenu();
        } }, 'В меню')
      )
    )
  );
}

// ============================================================
// ОБЗОР
// ============================================================
function viewOverview(engine, c) {
  const historyGDP = (c.history || []).map(h => h.gdp);
  const historyApproval = (c.history || []).map(h => h.approval);
  // v3.15: права
  const gov = canGovern(c);

  const topStats = el('div', { class: 'grid cols-4' },
    card2('ВВП', null,
      el('div', {},
        el('div', { class: 'stat-big', 'data-kv': 'gdp' }, '$ ' + num(c.gdp) + ' млрд'),
        el('div', { class: 'stat-sub', 'data-kv': 'gdp-growth' }, `Рост ${pct((c.growth || 0) * 12, 2)}/год`),
        el('div', { class: 'stat-delta ' + ((c.growth || 0) >= 0 ? 'pos' : 'neg'), 'data-kv': 'gdp-delta' }, ((c.growth || 0) >= 0 ? '▲ ' : '▼ ') + pct(Math.abs((c.growth || 0) * 12), 2))
      )
    ),
    card2('Население', null,
      el('div', {},
        el('div', { class: 'stat-big', 'data-kv': 'population' }, num(c.population)),
        el('div', { class: 'stat-sub', 'data-kv': 'life-exp' }, `Ожидаемая жизнь: ${(c.lifeExpectancy || 0).toFixed(1)} лет`)
      )
    ),
    card2('Площадь', null,
      el('div', {},
        el('div', { class: 'stat-big', 'data-kv': 'area' }, int(c.area) + ' км²'),
        el('div', { class: 'stat-sub', 'data-kv': 'density' }, `Плотность: ${(c.area > 0 ? (c.population / c.area).toFixed(1) : '0')} чел/км²`)
      )
    ),
    card2('Влияние', null,
      el('div', {},
        el('div', { class: 'stat-big', 'data-kv': 'influence' }, Math.round(c.influence || 0) + ' / 100'),
        el('div', { class: 'stat-sub', 'data-kv': 'reputation' }, `Репутация: ${Math.round(c.reputation || 0)}`)
      )
    ),
  );

  const econCard = card2('Экономика', null,
    kvK('ВВП на душу', '$ ' + num(c.gdpPerCapita), 'gdp-per-capita'),
    kvK('Госдолг', '$ ' + num(c.debt) + ' млрд (' + pct(c.debt / Math.max(c.gdp, 1)) + ' ВВП)', 'debt'),
    kvK('Бюджет', ((c.budget || 0) >= 0 ? 'Профицит ' : 'Дефицит ') + '$ ' + num(Math.abs(c.budget || 0)) + ' млрд', 'budget'),
    kvK('Инфляция', pct(c.inflation), 'inflation'),
    kvK('Безработица', pct(c.unemployment), 'unemployment'),
    kvK('Бедность', pct(c.poverty), 'poverty'),
    kvK('Цикл', cycleName(c.cyclePhase), 'cycle'),
    sparkline(historyGDP.length > 1 ? historyGDP : [c.gdp * 0.9, c.gdp]),
  );

  const socCard = card2('Общество', null,
    kvK('Одобрение правительства', pctRaw(c.approval), 'approval'),
    kvK('Недовольство', pctRaw(c.discontent), 'discontent'),
    kvK('Политическая стабильность', pctRaw(c.stability), 'stability'),
    kvK('Образование', pctRaw(c.educationLevel), 'education'),
    kvK('Здравоохранение', pctRaw(c.healthcareLevel), 'healthcare'),
    kvK('Преступность', pctRaw(c.crimeRate), 'crime'),
    kvK('Неравенство (Джини)', ((c.inequality || 0) * 100).toFixed(0) + '%', 'inequality'),
    sparkline(historyApproval.length > 1 ? historyApproval : [c.approval]),
  );

  const head = getHeadOfState(c);
  const isPlayerHead = c.playerPersonId && head.person?.id === c.playerPersonId;
  const polCard = card2('Политика', null,
    kvK(POSITIONS[head.position]?.name || 'Глава государства', head.person?.name || '—', 'president'),
    isPlayerHead ? el('div', { class: 'badge good', style: { marginTop: '4px' } }, '👑 Вы — глава государства') : null,
    kvK('Председатель парламента', c.speaker?.name || '—', 'speaker'),
    kvK('Правящая партия', c.parties?.find(p => p.id === c.rulingPartyId)?.name || '—', 'ruling-party'),
    c.playerPartyId ? kvK('Ваша партия', c.parties?.find(p => p.id === c.playerPartyId)?.name || '—', 'player-party') : null,
    kv('Форма правления', govName(c.government)),
    kv('Политическая система', sysName(c.system)),
    kvK('Коррупция', pctRaw(c.corruption), 'corruption'),
    kvK('Свобода прессы', pctRaw(c.pressFreedom), 'press-freedom'),
    kvK('Независимость судов', pctRaw(c.judicialIndependence), 'judicial'),
    kvK('Профсоюзы', (c.unions || []).length + ' шт.', 'unions-count'),
    kvK('Ассоциации', (c.associations || []).filter(a => !a.banned).length + ' активных', 'assoc-count'),
    kvK('Договоры', (c.treaties || []).length + ' шт.', 'treaties-count'),
    kvK('Войны', (c.wars || []).length > 0 ? `⚔️ ${c.wars.length}` : '—', 'wars-count'),
  );

    const overviewNews = visibleNews(engine).slice(0, 8);
  const newsCard = card2('📰 Живая лента', null,
    ...(overviewNews.length ? overviewNews.map((n, i) => el('div', {
      class: `news-item ${n.kind === 'good' ? 'ev-good' : n.kind === 'bad' ? 'ev-bad' : ''} ${i === 0 ? 'news-fresh' : ''}`
    },
      el('div', { class: 'ni-date' }, dateShort(n.date)),
      el('div', { class: 'ni-tag' }, n.tag),
      el('div', {}, n.text)
    )) : [el('div', { class: 'empty' }, 'Пока тихо...')])
  );

  // v3.15: журнал действий
  const actionLog = (c.actionLog || []).slice(0, 15);
  const logCard = card2('📜 Журнал действий', `${(c.actionLog || []).length}`,
    ...(actionLog.length ? actionLog.map(a => el('div', {
      class: `list-row ${a.kind === 'good' ? 'ev-good' : a.kind === 'bad' ? 'ev-bad' : ''}`,
      style: { fontSize: '12px', padding: '4px 0' }
    },
      el('span', { class: 'muted', style: { minWidth: '60px' } }, dateShort(a.date)),
      el('span', { style: { flex: 1 } }, a.text)
    )) : [el('div', { class: 'empty' }, 'Пока пусто')])
  );

  return el('div', { class: 'grid' },
    // v3.15: предупреждение для оппозиции
    !gov ? card2('⚠️ Вы в оппозиции', null,
      el('p', { class: 'muted small' },
        'Правительственные действия (налоги, расходы, законы, дипломатия) недоступны. ' +
        'Вам доступно: митинг, скандал, вотум недоверия, финансирование своей партии.')
    ) : null,
    topStats,
    el('div', { class: 'grid cols-2' }, econCard, socCard),
    el('div', { class: 'grid cols-2' }, polCard, newsCard),
    logCard,
  );
}

// ============================================================
// ЭКОНОМИКА (FIX: + 4 новые карточки)
// ============================================================
function viewEconomy(engine, c) {
  const rev = revenue(c);
  const exp = spending(c);
  const bal = annualBalance(c);

   const taxes = el('div', {}, ...TAX_KEYS.map(k =>
    slider(TAX_LABELS[k] || k, c.taxes?.[k] ?? 0, 0.75,
      (v) => act(engine, () => setTax(c, k, v), () => net.setTax(k, v),
        { type: 'tax', text: `Налог ${TAX_LABELS[k] || k}: ${(v * 100).toFixed(0)}%` }),
      v => pct(v))
  ));

    const sp = el('div', {}, ...SPEND_KEYS.map(k =>
    slider(SPEND_LABELS[k] || k, c.spending?.[k] ?? 0, 0.30,
      (v) => act(engine, () => setSpending(c, k, v), () => net.setSpending(k, v),
        { type: 'spending', text: `Расходы ${SPEND_LABELS[k] || k}: ${(v * 100).toFixed(1)}% ВВП` }),
      v => pct(v) + ' ВВП')
  ));

  const budgetCard = card2('Бюджет', null,
    kvK('Доходы', '$ ' + num(rev) + ' млрд', 'budget-revenue'),
    kvK('Расходы', '$ ' + num(exp) + ' млрд', 'budget-spending'),
    kv('Обслуживание долга', '$ ' + num((c.debt || 0) * (c.interestRate || 0)) + ' млрд'),
    kv('Внешний долг (3%)', '$ ' + num((c.foreignDebt || 0) * 0.03) + ' млрд'),
    kv('Сальдо', (bal >= 0 ? '+' : '−') + '$ ' + num(Math.abs(bal)) + ' млрд'),
    kvK('Казна', '$ ' + num(c.treasury) + ' млрд', 'budget-treasury'),
    kvK('Госдолг', '$ ' + num(c.debt) + ' млрд', 'budget-debt'),
    el('div', { class: 'mt-12' }, bar(Math.min(100, ((c.debt || 0) / Math.max(c.gdp, 1)) * 100), (c.debt || 0) / c.gdp > 0.8 ? 'red' : 'gold')),
    el('div', { class: 'stat-sub' }, `Долг / ВВП: ${pct((c.debt || 0) / Math.max(c.gdp, 1))}`),
  );

  const indicators = card2('Макроэкономика', null,
    kvK('ВВП', '$ ' + num(c.gdp) + ' млрд', 'macro-gdp'),
    kvK('ВВП на душу', '$ ' + num(c.gdpPerCapita), 'macro-gdp-pc'),
    kv('Рост (год)', pct((c.growth || 0) * 12, 2)),
    kvK('Инфляция', pct(c.inflation), 'macro-inflation'),
    kvK('Безработица', pct(c.unemployment), 'macro-unemployment'),
    kvK('Уровень бедности', pct(c.poverty)),
    kvK('Средняя зарплата', '$ ' + num(c.wage), 'macro-wage'),
    kvK('Средняя пенсия', '$ ' + num(c.pension), 'macro-pension'),
    kv('Соцвыплаты', '$ ' + num(c.socialBenefits)),
    kvK('Экономический цикл', cycleName(c.cyclePhase), 'macro-cycle'),
  );

  const trade = card2('Торговля', null,
    kvK('Экспорт', '$ ' + num(c.exports) + ' млрд', 'trade-exports'),
    kvK('Импорт', '$ ' + num(c.imports) + ' млрд', 'trade-imports'),
    kv('Торговый баланс', ((c.exports - c.imports) >= 0 ? '+' : '−') + '$ ' + num(Math.abs(c.exports - c.imports)) + ' млрд'),
    kvK('Иностранные инвестиции', '$ ' + num(c.fdi) + ' млрд', 'trade-fdi'),
    kvK('Валюта', c.currency || '$', 'trade-currency'),
    slider('Ключевая ставка ЦБ', c.interestRate ?? 0.02, 0.25,
      (v) => act(engine, () => setInterestRate(c, v), () => net.setInterestRate(v)),
      v => pct(v)),
    slider('Резервная норма', c.bankReserveRatio ?? 0.15, 0.5,
      (v) => act(engine, () => setBankReserveRatio(c, v), () => net.setBankReserveRatio(v)),
      v => pct(v)),
  );

  const goldCard = card2('Золотой стандарт', null,
    kvK('Золотые резервы', '$ ' + num(c.goldReserves || 0) + ' млрд', 'gold-reserves'),
    kvK('Статус', c.goldStandard ? '🟡 Золотой стандарт' : '⚪ Фиатная валюта', 'gold-status'),
    kvK('Кредитный рейтинг', Math.round(c.creditRating || 50) + ' / 100', 'credit-rating'),
    el('div', { class: 'flex gap-8 wrap mt-12' },
      el('button', { class: 'btn small' + (c.goldStandard ? ' danger' : ' primary'), onclick: () => {
        act(engine, () => { setGoldStandard(c, !c.goldStandard); engine.notify(); }, () => net.setGoldStandard(!c.goldStandard));
      } }, c.goldStandard ? 'Отменить золотой стандарт' : 'Ввести золотой стандарт'),
    ),
    el('div', { class: 'mt-12 muted small' },
      c.goldStandard
        ? 'Золотой стандарт стабилизирует инфляцию, но ограничивает рост и эмиссию.'
        : 'Фиатная валюта даёт свободу эмиссии, но повышает риск инфляции.'
    ),
  );

  const structure = card2('Структура экономики', null,
    kvK('Сельское хозяйство', pct(c.agricultureShare ?? 0.4), 'agri-share'),
    kvK('Промышленность', pct(c.industryShare ?? 0.35), 'industry-share'),
    kvK('Услуги', pct(c.servicesShare ?? 0.25), 'services-share'),
    kvK('Госсектор', pct(c.publicSectorShare ?? 0.25), 'public-sector'),
    el('div', { class: 'mt-12' },
      bar((c.agricultureShare ?? 0.4) * 100, 'green'),
      el('div', { class: 'stat-sub' }, 'Сельское хозяйство'),
    ),
    el('div', { class: 'mt-8' },
      bar((c.industryShare ?? 0.35) * 100, 'gold'),
      el('div', { class: 'stat-sub' }, 'Промышленность'),
    ),
    el('div', { class: 'mt-8' },
      bar((c.servicesShare ?? 0.25) * 100, ''),
      el('div', { class: 'stat-sub' }, 'Услуги'),
    ),
    el('div', { class: 'flex gap-8 wrap mt-12' },
      el('button', { class: 'btn small', onclick: () => {
        act(engine, () => nationalize(c), () => net.nationalize());
      } }, 'Национализировать'),
      el('button', { class: 'btn small', onclick: () => {
        act(engine, () => privatize(c), () => net.privatize());
      } }, 'Приватизировать'),
    ),
  );

  const projectsCard = card2('Государственные проекты', null,
    ...PROJECTS.map(p => el('div', { class: 'list-row' },
      el('div', {},
        el('div', { class: 'lr-name' }, p.name),
        el('div', { class: 'lr-sub' }, p.desc)
      ),
            el('button', { class: 'btn small primary', onclick: () => {
        act(engine, () => startProject(c, p.id), () => net.startProject(p.id),
          { type: 'project', text: `Запущен проект: ${p.name}` });
      } }, '$ ' + p.cost + ' млрд')
    )),
    el('div', { class: 'mt-12 muted small' }, 'Разовые проекты — сразу дают бонус, но стоят денег.'),
  );

  // ============================================================
  // FIX: 4 новые экономические карточки
  // ============================================================

  // 1. Минимальная зарплата
  const minWageCard = card2('Минимальная зарплата', null,
    slider('Минимальная зарплата', c.minimumWage ?? (c.wage || 0) * 0.4, (c.wage || 100) * 1.5,
      (v) => act(engine, () => setMinimumWage(c, v), () => net.setMinimumWage(v)),
      v => '$ ' + num(v)),
    kv('Средняя зарплата', '$ ' + num(c.wage || 0)),
    kv('Отношение', ((c.minimumWage || 0) / Math.max(c.wage || 1, 1) * 100).toFixed(0) + '%'),
    el('div', { class: 'mt-8 muted small' },
      'Высокая минимальная зарплата снижает бедность, но повышает безработицу.'),
  );

  // 2. Пенсионная система
  const pensionCard = card2('Пенсионная система', null,
    slider('Пенсионный возраст', c.pensionAge ?? 65, 80,
      (v) => act(engine, () => setPensionAge(c, v), () => net.setPensionAge(v)),
      v => Math.round(v) + ' лет'),
    slider('Ставка пенсии (доля зарплаты)', c.pensionRate ?? 0.35, 0.8,
      (v) => act(engine, () => setPensionRate(c, v), () => net.setPensionRate(v)),
      v => pct(v)),
    kv('Средняя пенсия', '$ ' + num(c.pension || 0)),
    kv('Средняя зарплата', '$ ' + num(c.wage || 0)),
    el('div', { class: 'mt-8 muted small' },
      'Высокий возраст и низкая ставка экономят бюджет, но снижают одобрение.'),
  );

  // 3. Валюта
  const currencyCard = card2('Валюта', c.currency || '$',
    kv('Курс к корзине', (c.exchangeRate ?? 1).toFixed(2)),
    kv('Статус', c.goldStandard ? '🟡 Золотой стандарт' : '⚪ Фиатная валюта'),
    kv('Инфляция', pct(c.inflation)),
    el('div', { class: 'flex gap-8 wrap mt-12' },
      el('button', { class: 'btn small', onclick: () => {
        act(engine, () => devalueCurrency(c, 10), () => net.devalueCurrency(10));
      } }, '📉 Девальвировать 10%'),
      el('button', { class: 'btn small', onclick: () => {
        act(engine, () => revalueCurrency(c, 10), () => net.revalueCurrency(10));
      } }, '📈 Ревальвировать 10%'),
    ),
    el('div', { class: 'mt-8 muted small' },
      'Девальвация: +экспорт, +инфляция, −одобрение. Ревальвация: наоборот.'),
  );

  // 4. Центральный банк
  const cbCard = card2('Центральный банк', null,
    kv('Председатель', c.cbChairman?.name || '—'),
    kv('Независимость', Math.round(c.cbIndependence ?? 50) + ' / 100'),
    bar(c.cbIndependence ?? 50, (c.cbIndependence ?? 50) > 60 ? 'green' : 'gold'),
    slider('Независимость ЦБ', c.cbIndependence ?? 50, 100,
      (v) => act(engine, () => setCbIndependence(c, v), () => net.setCbIndependence(v)),
      v => Math.round(v) + ' / 100'),
    el('div', { class: 'flex gap-8 wrap mt-12' },
      el('button', { class: 'btn small', onclick: () => {
        const candidates = (c.politicians || []).filter(p => p.id !== c.cbChairman?.id);
        if (!candidates.length) { toast('Нет кандидатов', 'error'); return; }
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        act(engine, () => setCbChairman(c, pick), () => net.setCbChairman(pick.id));
      } }, '👤 Назначить председателя'),
    ),
    el('div', { class: 'mt-8 muted small' },
      'Независимый ЦБ сдерживает инфляцию, но снижает контроль правительства.'),
  );

  return el('div', { class: 'grid' },
    el('div', { class: 'grid cols-2' },
      card2('Налоговая политика', null, taxes),
      card2('Государственные расходы', null, sp)
    ),
    el('div', { class: 'grid cols-3' }, budgetCard, indicators, trade),
    el('div', { class: 'grid cols-2' }, goldCard, structure),
    // FIX: новые карточки
    el('div', { class: 'grid cols-2' }, minWageCard, pensionCard),
    el('div', { class: 'grid cols-2' }, currencyCard, cbCard),
    projectsCard,
  );
}
// ============================================================
// ПОЛИТИКА
// ============================================================
function viewPolitics(engine, c) {
  if (c.playerPartyId && !c.playerPartyGoal) initPartyGoal(c);
  if (c.playerPersonId && !c.playerPersonGoal) initPersonGoal(c);

  const isOneParty = c.system === 'one_party' || c.system === 'authoritarian';
  // v3.15: права
  const gov = canGovern(c);
  const playerParty = c.playerPartyId ? c.parties?.find(p => p.id === c.playerPartyId) : null;
  const head = getHeadOfState(c);
  const isPlayerHead = c.playerPersonId && head.person?.id === c.playerPersonId;
  const playerPerson = c.playerPersonId ? findPersonById(c, c.playerPersonId) : null;

  const headPosition = POSITIONS[head.position] || POSITIONS.president;
  const headCard = card2(`${headPosition.icon} ${headPosition.name}`, null,
    isPlayerHead ? el('div', { class: 'badge good', style: { marginBottom: '8px' } }, '👑 Вы — глава государства') : null,
    el('div', { class: 'kv' },
      el('span', { class: 'k' }, 'Имя'),
      el('span', { class: 'v' },
        el('span', {
          style: { cursor: 'pointer', textDecoration: 'underline dotted' },
          onclick: () => head.person && openPersonModal(engine, c, head.person, {
            roleLabel: headPosition.name,
            partyName: c.parties?.find(p => p.id === head.partyId)?.name || '—',
          })
        }, head.person?.name || '—')
      )
    ),
    kv('Идеология', ideoName(head.person?.ideology)),
    kv('Партия', c.parties?.find(p => p.id === head.partyId)?.name || '—'),
    kv('Компетентность', Math.round(head.person?.competence || 0)),
    kv('Харизма', Math.round(head.person?.charisma || 0)),
    kv('Одобрение', pctRaw(c.presidentApproval ?? c.approval)),
    el('div', { class: 'flex gap-8 wrap mt-12' },
      !isOneParty ? el('button', { class: 'btn small', onclick: () => {
        act(engine, () => { runPresidentialElection(c, engine); engine.notify(); }, () => net.runPresidentialElection());
      } }, 'Провести выборы') : null,
      !isOneParty ? el('button', { class: 'btn small danger', onclick: () => {
        act(engine, () => impeachPresident(c), () => net.impeachPresident());
      } }, 'Импичмент') : null,
      !isOneParty ? el('button', { class: 'btn small danger', onclick: () => {
        if (!confirm('Распустить правительство? −10 одобрения, −5 стабильности.')) return;
        act(engine, () => dismissGovernment(c, engine), () => net.dismissGovernment());
        engine.notify();
        renderTab(engine, 'politics');
      } }, '🗑️ Распустить правительство') : null,
      el('button', {
        class: 'btn small' + (c.constitutionalCrisis ? ' danger' : ''),
        disabled: !!c.constitutionalCrisis,
        onclick: () => openSystemModal(engine, c)
      }, c.constitutionalCrisis ? '⚖️ Кризис идёт' : '⚙️ Сменить систему'),
      el('button', { class: 'btn small primary', onclick: () => openProposeLawModal(engine, c) }, '📜 Внести законопроект'),
      !c.referendum ? el('button', { class: 'btn small', onclick: () => openReferendumModal(engine, c) }, '🗳️ Референдум') : null
    ),
  );

  const crisisCard = c.constitutionalCrisis ? buildCrisisCard(engine, c) : null;

  const electionStatus = getElectionStatus(c);
  const electionCard = electionStatus ? card2(
    `🗳️ ${electionStatus.type === 'presidential' ? 'Президентские' : 'Парламентские'} выборы`,
    `Тур ${electionStatus.round} · ${electionStatus.daysLeft} дн.`,
    ...electionStatus.candidates.map(cand => {
      const isPlayerCand = (c.playerPartyId && cand.partyId === c.playerPartyId)
        || (c.playerPersonId && cand.candidate?.id === c.playerPersonId);
      return el('div', { class: 'list-row' },
        el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', width: '100%' } },
          el('span', { style: { fontSize: '20px' } }, cand.partySymbol),
          el('div', { style: { flex: 1 } },
            el('div', { class: 'lr-name', style: { display: 'flex', gap: '6px', alignItems: 'center' } },
              el('span', {
                style: { cursor: 'pointer', textDecoration: 'underline dotted' },
                onclick: () => cand.candidate && openPersonModal(engine, c, cand.candidate, { roleLabel: 'Кандидат', partyName: cand.partyName })
              }, cand.candidate.name),
              isPlayerCand ? el('span', { class: 'badge good', style: { fontSize: '9px' } }, 'ВАША') : null
            ),
            el('div', { class: 'lr-sub' }, `${cand.partyName} · действий: ${cand.maxActions - cand.actionsUsed}/${cand.maxActions}`)
          ),
          el('div', { class: 'lr-name', style: { color: cand.partyColor } }, pctRaw(cand.rating))
        ),
        bar(cand.rating, isPlayerCand ? 'green' : 'gold')
      );
    }),
    el('div', { class: 'flex gap-8 wrap mt-12' },
      ...Object.entries(CAMPAIGN_ACTIONS).map(([id, actDef]) =>
        el('button', { class: 'btn small primary', onclick: () => {
          const target = playerParty
            ? playerParty
            : (c.playerPersonId
              ? (c.parties.find(p => p.leader?.id === c.playerPersonId) || c.parties.find(p => p.id === c.rulingPartyId) || c.parties[0])
              : (c.parties.find(p => p.id === c.rulingPartyId) || c.parties[0]));
          if (!target) { toast('Нет партии', 'error'); return; }
          act(engine, () => campaignAction(c, id, target.id), () => net.campaignAction(id, target.id));
        } }, `${actDef.icon} ${actDef.name}${actDef.cost > 0 ? ` ($${actDef.cost})` : ''}`)
      ),
      el('button', { class: 'btn small danger', onclick: () => {
        act(engine, () => finishElection(c, engine), () => net.finishElection());
      } }, 'Завершить выборы'),
      el('button', { class: 'btn small danger', onclick: () => {
        act(engine, () => cancelElection(c), () => net.cancelElection());
      } }, 'Отменить')
    )
  ) : null;

  const campaignStartButtons = !isOneParty && !c.election ? el('div', { class: 'flex gap-8 wrap mt-12' },
    el('button', { class: 'btn small primary', onclick: () => {
      act(engine, () => startPresidentialCampaign(c, engine), () => net.startPresidentialCampaign());
    } }, '🏛️ Президентская кампания'),
    el('button', { class: 'btn small primary', onclick: () => {
      act(engine, () => startParliamentaryCampaign(c, engine), () => net.startParliamentaryCampaign());
    } }, '🗳️ Парламентская кампания')
  ) : null;

  const playerStatusCard = buildPlayerStatusCard(engine, c, head, playerParty, playerPerson);

  const unions = c.unions || [];
  const unionsCard = card2('Профсоюзы', `${unions.length}`,
    ...(unions.length ? unions.map(u => {
      const type = UNION_TYPES[u.type] || {};
      return el('div', { class: 'list-row', style: { flexDirection: 'column', alignItems: 'flex-start', gap: '8px' } },
        el('div', { style: { display: 'flex', gap: '10px', width: '100%', alignItems: 'flex-start' } },
          el('span', { class: 'dot', style: { background: u.color } }),
          el('div', { style: { flex: 1 } },
            el('div', { class: 'lr-name' }, u.name),
            el('div', { class: 'lr-sub' }, `${type.desc || ''} · ${Math.round((u.members || 0) / 1000)} тыс. · сила ${Math.round(u.strength || 0)}`)
          ),
          el('span', { class: `badge ${u.stance === 'loyal' ? 'good' : u.stance === 'opposed' ? 'bad' : 'info'}` }, u.stance || 'neutral')
        ),
        el('div', { class: 'flex gap-8 wrap', style: { width: '100%' } },
          el('button', { class: 'btn small', onclick: () => act(engine, () => unionAction(c, u.id, 'negotiate'), () => net.unionAction(u.id, 'negotiate')) }, 'Переговоры'),
          el('button', { class: 'btn small', onclick: () => act(engine, () => unionAction(c, u.id, 'recognize'), () => net.unionAction(u.id, 'recognize')) }, u.official ? '✓' : 'Признать'),
          el('button', { class: 'btn small', onclick: () => act(engine, () => unionAction(c, u.id, 'subsidize'), () => net.unionAction(u.id, 'subsidize')) }, '$ 0.05'),
          el('button', { class: 'btn small danger', onclick: () => act(engine, () => unionAction(c, u.id, 'repress'), () => net.unionAction(u.id, 'repress')) }, 'Разогнать')
        )
      );
    }) : [el('div', { class: 'empty' }, 'Нет профсоюзов')])
  );

  const referendumCard = c.referendum ? buildReferendumCard(engine, c) : null;
  const competitionCard = buildCompetitionCard(engine, c);

  return el('div', { class: 'grid' },
    // v3.15: предупреждение для оппозиции
    !gov ? card2('⚠️ Вы в оппозиции', null,
      el('p', { class: 'muted small' },
        'Правительственные действия недоступны. Доступно: митинг, скандал, вотум недоверия, финансирование партии.')
    ) : null,
    playerStatusCard,
    crisisCard,
    referendumCard,
    competitionCard,
    el('div', { class: 'grid cols-2' }, headCard, unionsCard),
    electionCard ? electionCard : campaignStartButtons,
  );
}

// ============================================================
// v3.13: МОДАЛКА «РЕФЕРЕНДУМ»
// ============================================================
function openReferendumModal(engine, c) {
  const modal = document.getElementById('event-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  const cost = 0.05;
  if ((c.treasury || 0) < cost) {
    toast('Недостаточно средств ($0.05)', 'error');
    modal.classList.add('hidden');
    return;
  }

  let selectedId = null;
  const listEl = el('div', { style: { maxHeight: '55vh', overflowY: 'auto' } });

  const renderList = () => {
    mount(listEl,
      ...REFERENDUM_QUESTIONS.map(q => el('div', {
        class: 'list-row',
        style: {
          cursor: 'pointer',
          border: selectedId === q.id ? '1px solid var(--gold)' : '1px solid transparent',
          borderRadius: '6px',
          padding: '8px',
          marginBottom: '4px',
        },
        onclick: () => { selectedId = q.id; renderList(); }
      },
        el('div', { style: { flex: 1 } },
          el('div', { class: 'lr-name' }, q.question),
          el('div', { class: 'lr-sub' }, `Варианты: ${q.options.join(' / ')}`)
        ),
        selectedId === q.id ? el('span', { class: 'badge good' }, '✓') : null
      ))
    );
  };

  mount(modal,
    el('div', { class: 'modal-card', style: { maxHeight: '90vh', overflowY: 'auto', minWidth: '360px' } },
      el('h2', {}, '🗳️ Референдум'),
      el('p', { class: 'muted small' }, `Стоимость: $${cost} млрд. Длительность: 7 дней.`),
      el('div', { class: 'mt-12' }, listEl),
      el('div', { class: 'mt-16 flex gap-8 wrap' },
        el('button', { class: 'btn small primary', onclick: () => {
          if (!selectedId) { toast('Выберите вопрос', 'error'); return; }
          close();
          act(engine, () => startReferendum(c, selectedId), () => net.startReferendum(selectedId));
          engine.notify();
          renderTab(engine, 'politics');
        } }, '🗳️ Начать референдум'),
        el('button', { class: 'btn small', onclick: close }, 'Отмена')
      )
    )
  );

  renderList();
}

// ============================================================
// v3.13: КАРТОЧКА АКТИВНОГО РЕФЕРЕНДУМА
// ============================================================
function buildReferendumCard(engine, c) {
  const ref = c.referendum;
  if (!ref) return null;

  const forVotes = ref.votes?.[0] || 0;
  const againstVotes = ref.votes?.[1] || 0;
  const totalVotes = forVotes + againstVotes;
  const forPct = totalVotes > 0 ? (forVotes / totalVotes) * 100 : 0;

  return card2('🗳️ Активный референдум', `${ref.daysLeft} дн.`,
    el('div', { class: 'lr-name', style: { marginBottom: '8px' } }, ref.question),
    el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' } },
      el('span', {}, `${ref.options[0]} (${forVotes.toLocaleString()})`),
      el('span', {}, `${ref.options[1]} (${againstVotes.toLocaleString()})`)
    ),
    bar(Math.min(100, forPct), forPct > 50 ? 'green' : 'red'),
    el('div', { class: 'mt-12 muted small' },
      `Всего голосов: ${totalVotes.toLocaleString()} · Осталось: ${ref.daysLeft} дн.`)
  );
}

// ============================================================
// v3.13: КАРТОЧКА «ПОЛИТИЧЕСКАЯ КОНКУРЕНЦИЯ»
// ============================================================
function buildCompetitionCard(engine, c) {
  const comp = c.competition ?? 50;
  const label = getCompetitionLabel(c);

  return card2('🏁 Политическая конкуренция', `${Math.round(comp)}/100`,
    el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } },
      el('span', { style: { fontSize: '20px' } }, label.icon),
      el('span', { class: 'lr-name', style: { color: label.color } }, label.name)
    ),
    bar(comp, comp >= 80 ? 'green' : comp >= 60 ? 'gold' : comp >= 40 ? 'gold' : 'red'),
    el('div', { class: 'mt-8 muted small' },
      comp >= 60
        ? 'Высокая конкуренция: оппозиция усиливается каждый месяц.'
        : comp < 30
          ? 'Низкая конкуренция: правящая партия доминирует.'
          : 'Умеренная конкуренция.'
    )
  );
}

// ============================================================
// v3.13: МОДАЛКА «ПРОГРАММА ПАРТИИ»
// ============================================================
function openPartyProgramModal(engine, c, p) {
  const modal = document.getElementById('event-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  const selected = new Set(p.program || []);

  const toggle = (id) => {
    if (selected.has(id)) selected.delete(id);
    else {
      if (selected.size >= 3) { toast('Максимум 3 пункта', 'error'); return; }
      selected.add(id);
    }
    renderList();
  };

  const listEl = el('div', { style: { maxHeight: '55vh', overflowY: 'auto' } });

  const renderList = () => {
    mount(listEl,
      ...PROGRAM_POINTS.map(pp => {
        const isSelected = selected.has(pp.id);
        return el('div', {
          class: 'list-row',
          style: {
            cursor: 'pointer',
            border: isSelected ? '1px solid var(--gold)' : '1px solid transparent',
            borderRadius: '6px',
            padding: '8px',
            marginBottom: '4px',
          },
          onclick: () => toggle(pp.id)
        },
          el('div', { style: { flex: 1 } },
            el('div', { class: 'lr-name' }, `${isSelected ? '✓ ' : ''}${pp.name}`),
            el('div', { class: 'lr-sub' }, `Идеология: ${ideoName(pp.ideology)}`)
          )
        );
      })
    );
  };

  mount(modal,
    el('div', { class: 'modal-card', style: { maxHeight: '90vh', overflowY: 'auto', minWidth: '360px' } },
      el('h2', {}, `📜 Программа «${p.name}»`),
      el('p', { class: 'muted small' }, `Выберите до 3 пунктов. Текущая программа: ${(p.program || []).length} п.`),
      el('div', { class: 'mt-12' }, listEl),
      el('div', { class: 'mt-16 flex gap-8 wrap' },
        el('button', { class: 'btn small primary', onclick: () => {
          if (selected.size === 0) { toast('Выберите хотя бы 1 пункт', 'error'); return; }
          close();
          act(engine, () => setPartyProgram(c, p.id, [...selected]), () => net.setPartyProgram(p.id, [...selected]));
          engine.notify();
          renderTab(engine, currentTab);
        } }, '📜 Сохранить программу'),
        el('button', { class: 'btn small', onclick: close }, 'Отмена')
      )
    )
  );

  renderList();
}

// ============================================================
// v3.11: ВКЛАДКА «🏛️ ПАРЛАМЕНТ»
// ============================================================
function viewParliament(engine, c) {
  if (c.playerPartyId && !c.playerPartyGoal) initPartyGoal(c);
  if (c.playerPersonId && !c.playerPersonGoal) initPersonGoal(c);

  const parties = [...(c.parties || [])].sort((a, b) => (a.spectrum ?? 0) - (b.spectrum ?? 0));
  const coalitionSeats = (c.parties || []).filter(p => (c.coalition || []).includes(p.id)).reduce((a, p) => a + p.seats, 0);

  const isOneParty = c.system === 'one_party' || c.system === 'authoritarian';
  const playerParty = c.playerPartyId ? c.parties?.find(p => p.id === c.playerPartyId) : null;
  const head = getHeadOfState(c);
  const playerPerson = c.playerPersonId ? findPersonById(c, c.playerPersonId) : null;

  const sp = c.speaker;
  const speakerCard = card2('Председатель парламента', null,
    sp ? el('div', {},
      el('div', { class: 'kv' },
        el('span', { class: 'k' }, 'Имя'),
        el('span', { class: 'v' },
          el('span', {
            style: { cursor: 'pointer', textDecoration: 'underline dotted' },
            onclick: () => openPersonModal(engine, c, sp, { roleLabel: 'Спикер парламента', partyName: sp.partyName })
          }, sp.name)
        )
      ),
      kv('Партия', sp.partyName || '—'),
      kv('Идеология', ideoName(sp.ideology)),
      kv('Компетентность', Math.round(sp.competence || 0)),
      kv('Харизма', Math.round(sp.charisma || 0)),
      el('div', { class: 'flex gap-8 wrap mt-12' },
        el('button', { class: 'btn small', onclick: () => {
          act(engine, () => { electSpeaker(c, engine); engine.notify(); }, () => net.electSpeaker());
        } }, 'Переизбрать')
      ),
    ) : el('div', { class: 'empty' }, 'Председатель не избран'),
  );

  const parliament = card2('Парламент', `${coalitionSeats}/${c.seatsTotal}`,
    parliamentChart(c),
    ...parties.map(p => {
      const isCoalition = (c.coalition || []).includes(p.id);
      const isPlayerParty = p.id === c.playerPartyId;
      const spectrumPct = ((p.spectrum + 10) / 20) * 100;
      return el('div', { class: 'party-row', style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' } },
        el('span', { class: 'dot', style: { background: p.color } }),
        el('div', { style: { flex: 1, minWidth: 0 } },
          el('div', { class: 'lr-name', style: { display: 'flex', gap: '6px', alignItems: 'center' } },
            p.name,
            isPlayerParty ? el('span', { class: 'badge good', style: { fontSize: '9px' } }, 'ВАША') : null,
            el('span', { class: 'badge', style: { background: (p.spectrumColor || '#7a8fb5') + '30', color: p.spectrumColor || '#7a8fb5', fontSize: '9px' } }, p.spectrumShort || '—')
          ),
          el('div', { class: 'lr-sub' }, `${ideoName(p.ideology)} · ${p.leader?.name || '—'}`),
          el('div', { class: 'spectrum-bar-mini' },
            el('div', { class: 'spectrum-track' }),
            el('div', { class: 'spectrum-marker', style: { left: spectrumPct + '%', background: p.spectrumColor || '#7a8fb5' } })
          )
        ),
        el('div', { style: { textAlign: 'right', minWidth: '70px' } },
          el('div', { class: 'lr-name' }, p.seats + ' мест'),
          el('div', { class: 'lr-sub' }, pctRaw(p.support)),
          isCoalition ? el('div', { class: 'badge good', style: { marginTop: '2px' } }, 'коалиция') : null
        ),
        el('button', { class: 'btn small', onclick: () => openPartyModal(engine, c, p) }, '📋')
      );
    }),
    el('div', { class: 'flex gap-8 wrap mt-12' },
      !isOneParty ? el('button', { class: 'btn small', onclick: () => {
        act(engine, () => { runParliamentaryElection(c, engine); engine.notify(); }, () => net.runParliamentaryElection());
      } }, 'Парламентские выборы') : null,
      !isOneParty ? el('button', { class: 'btn small', onclick: () => {
        act(engine, () => { formCoalition(c); engine.notify(); }, () => net.formCoalition());
      } }, 'Сформировать коалицию') : null,
      !isOneParty ? el('button', { class: 'btn small primary', onclick: () => openCreatePartyModal(engine, c) }, '➕ Создать партию') : null,
      isOneParty ? el('div', { class: 'badge warn', style: { padding: '8px 12px' } }, '⚠️ Однопартийная система') : null,
    )
  );

  const senateCard = hasSenate(c) ? buildSenateCard(engine, c) : null;
  const committeesCard = buildCommitteesCard(engine, c);
  const factionsCard = buildFactionsCard(engine, c);
  const competitionCard = buildCompetitionCard(engine, c);

  const bills = getActiveBills(c);
  const billHistory = getBillHistory(c).slice(0, 6);
  const canBlock = parliamentCanBlock(c);

  const billsCard = card2('Законопроекты', `${bills.length} активно`,
    ...(bills.length ? bills.map(b => buildParliamentBillRow(engine, c, b, canBlock, isOneParty)) : [el('div', { class: 'empty' }, 'Парламент пока не вносит инициатив')]),
    billHistory.length ? el('div', { class: 'mt-12' },
      el('div', { class: 'lr-sub', style: { marginBottom: '8px' } }, 'История:'),
      ...billHistory.map(b => el('div', { class: 'list-row', style: { fontSize: '12px', opacity: 0.75 } },
        el('div', { class: 'lr-name' }, b.name),
        el('div', { class: b.status === 'passed' ? 'pos' : 'neg' },
          b.status === 'passed' ? '✅' : b.status === 'blocked' ? '🚫' : b.status === 'vetoed' ? '⛔' : '❌')
      ))
    ) : null
  );

  const agendaCard = buildLegislativeAgendaCard(engine, c);
  const sessionCard = buildSessionCard(engine, c);
  const interpellationsCard = buildInterpellationsCard(engine, c);
  const coalitionCard = buildCoalitionCard(engine, c);
  const oppositionCard = buildOppositionCard(engine, c);
  const votingStatsCard = buildVotingStatsCard(engine, c);
  const parliamentLifeCard = buildParliamentLifeCard(engine, c);

  const lawsCard = card2('Законы и реформы', `${(c.laws || []).length}/${LAWS.length}`,
    ...renderLawsGrouped(engine, c)
  );

  const cons = getConstitutionalEffects(c);
  const powersCard = card2('Полномочия парламента', `${cons.parliamentScore}/10`,
    el('div', { class: 'muted small mb-12' },
      `Исполнительная власть: ${cons.executivePower}/10 · Демократия +${cons.democracyBonus}`),
    ...PARLIAMENT_POWERS.map(p => {
      const has = (c.constitution || {})[p.id];
      return el('div', { class: 'list-row' },
        el('div', {},
          el('div', { class: 'lr-name' }, p.name),
          el('div', { class: 'lr-sub' }, p.desc)
        ),
        el('button', {
          class: 'btn small' + (has ? ' primary' : ''),
          onclick: () => {
            act(engine, () => amendPower(c, p.id, !has), () => net.amendPower(p.id, !has));
          }
        }, has ? 'Есть' : 'Нет')
      );
    })
  );

  const cabinet = card2('Кабинет министров', null,
    ...Object.entries(c.cabinet || {}).map(([role, p]) =>
      listRow(
        el('div', {},
          el('div', { class: 'lr-name' }, MINISTRY_LABELS[role] || role),
          el('div', { class: 'lr-sub' },
            el('span', {
              style: { cursor: 'pointer', textDecoration: 'underline dotted' },
              onclick: () => openPersonModal(engine, c, p, { roleLabel: MINISTRY_LABELS[role] || role, partyName: '—' })
            }, p.name)
          )
        ),
        el('button', { class: 'btn small', onclick: () => {
          const candidates = (c.politicians || []).filter(x => x.id !== p.id);
          if (!candidates.length) return;
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          act(engine, () => { appointMinister(c, role, pick); engine.notify(); }, () => net.appointMinister(role, pick.id));
        } }, 'Сменить')
      )
    )
  );

  const spectrumCard = card2('Политический спектр', null,
    el('div', { class: 'spectrum-legend' },
      el('div', { class: 'spectrum-labels' },
        el('span', {}, '← Левые'),
        el('span', {}, 'Центр'),
        el('span', {}, 'Правые →')
      ),
      el('div', { class: 'spectrum-line' })
    ),
    ...parties.map(p => el('div', { style: { padding: '4px 0', display: 'flex', justifyContent: 'space-between', fontSize: '11px' } },
      el('span', { style: { color: p.spectrumColor || '#7a8fb5', fontWeight: '600' } }, `${p.spectrumShort} · ${p.name}`),
      el('span', { class: 'muted' }, p.spectrumLabel || '—')
    ))
  );

  const blocks = [
    el('div', { class: 'grid cols-2' }, parliament, speakerCard),
    senateCard,
    competitionCard,
    el('div', { class: 'grid cols-2' }, billsCard, agendaCard),
    el('div', { class: 'grid cols-2' }, sessionCard, votingStatsCard),
    el('div', { class: 'grid cols-2' }, committeesCard, factionsCard),
    el('div', { class: 'grid cols-2' }, coalitionCard, oppositionCard),
    interpellationsCard,
    parliamentLifeCard,
    el('div', { class: 'grid cols-2' }, lawsCard, powersCard),
    el('div', { class: 'grid cols-2' }, cabinet, spectrumCard),
  ].filter(Boolean);

  return el('div', { class: 'grid' }, ...blocks);
}

// ============================================================
// v3.11: МОДАЛКА «ВНЕСТИ ЗАКОНОПРОЕКТ»
// ============================================================
function openProposeLawModal(engine, c) {
  const modal = document.getElementById('event-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  const categories = LAW_CATEGORIES.map(cat => ({
    ...cat,
    laws: cat.ids.map(id => LAWS.find(l => l.id === id)).filter(Boolean),
  })).filter(cat => cat.laws.length > 0);

  const listEl = el('div', { style: { maxHeight: '55vh', overflowY: 'auto' } });
  let selectedLawId = null;
  let selectedLaw = null;

  const renderList = () => {
    mount(listEl,
      ...categories.map(cat => el('div', { class: 'mt-12' },
        el('div', { class: 'lr-sub', style: { marginBottom: '4px', fontWeight: '600', color: 'var(--muted)' } }, cat.name),
        ...cat.laws.map(law => {
          const passed = (c.laws || []).includes(law.id);
          const inProgress = (c.bills || []).some(b => b.sponsorType === 'law' && b.lawId === law.id && b.status === 'proposed');
          const disabled = passed || inProgress;
          return el('div', {
            class: 'list-row',
            style: {
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              border: selectedLawId === law.id ? '1px solid var(--gold)' : '1px solid transparent',
              borderRadius: '6px',
              padding: '6px 8px',
              marginBottom: '2px',
            },
            onclick: () => {
              if (disabled) return;
              selectedLawId = law.id;
              selectedLaw = law;
              renderList();
              renderEffect();
            }
          },
            el('div', { style: { flex: 1 } },
              el('div', { class: 'lr-name' }, law.name),
              el('div', { class: 'lr-sub' }, law.desc)
            ),
            el('div', { style: { textAlign: 'right', minWidth: '80px' } },
              passed ? el('span', { class: 'badge good' }, '✓ Принят')
              : inProgress ? el('span', { class: 'badge warn' }, '⏳ На рассм.')
              : el('span', { class: 'badge info' }, 'Внести')
            )
          );
        })
      ))
    );
  };

  const effectEl = el('div', { class: 'mt-12' });

  const renderEffect = () => {
    if (!selectedLaw) {
      mount(effectEl, el('div', { class: 'muted small' }, 'Выберите закон из списка'));
      return;
    }
    const rows = [];
    if (selectedLaw.effects?.add) {
      for (const [k, v] of Object.entries(selectedLaw.effects.add)) {
        rows.push(el('div', { class: 'kv', style: { padding: '2px 0', fontSize: '12px' } },
          el('span', { class: 'k' }, k),
          el('span', { class: v >= 0 ? 'pos' : 'neg', style: { fontWeight: '600' } }, (v >= 0 ? '+' : '') + v)
        ));
      }
    }
    if (selectedLaw.effects?.set) {
      for (const [k, v] of Object.entries(selectedLaw.effects.set)) {
        rows.push(el('div', { class: 'kv', style: { padding: '2px 0', fontSize: '12px' } },
          el('span', { class: 'k' }, k),
          el('span', { class: 'gold', style: { fontWeight: '600' } }, '→ ' + v)
        ));
      }
    }
    if (selectedLaw.effects?.mul) {
      for (const [k, v] of Object.entries(selectedLaw.effects.mul)) {
        rows.push(el('div', { class: 'kv', style: { padding: '2px 0', fontSize: '12px' } },
          el('span', { class: 'k' }, k),
          el('span', { style: { fontWeight: '600' } }, '× ' + v)
        ));
      }
    }
    mount(effectEl,
      el('div', { class: 'lr-name', style: { marginBottom: '4px' } }, selectedLaw.name),
      el('div', { class: 'lr-sub', style: { marginBottom: '8px' } }, selectedLaw.desc),
      rows.length ? el('div', {}, ...rows) : el('div', { class: 'muted small' }, 'Нет эффектов'),
      el('div', { class: 'mt-8 muted small' },
        `Стоимость: $${(selectedLaw.cost || 0).toFixed(3)} млрд`)
    );
  };

  mount(modal,
    el('div', { class: 'modal-card', style: { maxHeight: '90vh', overflowY: 'auto', minWidth: '380px' } },
      el('h2', {}, '📜 Внести законопроект'),
      el('p', { class: 'muted small' }, 'Выберите закон из списка. Он будет внесён от имени правительства.'),

      el('div', { class: 'grid cols-2', style: { gap: '12px' } },
        el('div', {},
          el('div', { class: 'lr-sub', style: { marginBottom: '4px', fontWeight: '600' } }, 'Доступные законы:'),
          listEl
        ),
        el('div', {},
          el('div', { class: 'lr-sub', style: { marginBottom: '4px', fontWeight: '600' } }, 'Эффекты:'),
          effectEl
        )
      ),

      el('div', { class: 'mt-16 flex gap-8 wrap' },
        el('button', { class: 'btn small primary', onclick: () => {
          if (!selectedLaw) { toast('Выберите закон', 'error'); return; }
          close();

          if (isNet(engine)) {
            act(engine, () => proposeLaw(c, selectedLaw.id, engine), () => net.proposeLaw(selectedLaw.id));
          } else {
            const result = proposeLaw(c, selectedLaw.id, engine);
            if (result && result.ok) {
              toast(`Законопроект «${selectedLaw.name}» внесён`, 'success');
              engine.notify();
              renderTab(engine, 'politics');
            } else {
              toast(result?.reason || 'Не удалось внести', 'error');
            }
          }
        } }, '📜 Внести выбранный'),
        el('button', { class: 'btn small', onclick: close }, 'Отмена')
      )
    )
  );

  renderList();
  renderEffect();
}

// ============================================================
// v3.11: СЕНАТ
// ============================================================
function buildSenateCard(engine, c) {
  const stats = getSenateStats(c);
  if (!stats) return null;

  return card2('🏛️ Сенат (верхняя палата)', `${stats.total} мест`,
    el('div', { class: 'muted small mb-12' }, 'Двухпалатный парламент: закон должен пройти обе палаты.'),
    el('div', { class: 'grid cols-2 mt-8' },
      el('div', {},
        kv('Всего мест', stats.total),
        kv('Распределено', stats.filled),
      ),
      el('div', {},
        kv('Спикер сената', stats.speaker?.name || '—'),
      )
    ),
    ...(stats.parties.length ? stats.parties.map(p => el('div', { class: 'list-row', style: { padding: '4px 0' } },
      el('span', { class: 'dot', style: { background: p.partyColor } }),
      el('span', {}, p.partyName),
      el('span', { class: 'font-600' }, `${p.seats} мест`)
    )) : [el('div', { class: 'empty' }, 'Сенат не распределён')])
  );
}

// ============================================================
// v3.11: КОМИТЕТЫ
// ============================================================
function buildCommitteesCard(engine, c) {
  const committees = getCommittees(c);
  const available = COMMITTEE_TYPES.filter(t => !committees.find(cm => cm.typeId === t.id));

  return card2('🏛️ Комитеты парламента', `${committees.length} шт.`,
    ...(committees.length ? committees.map(cm => el('div', { class: 'list-row' },
      el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        el('span', { style: { fontSize: '16px' } }, cm.icon),
        el('div', {},
          el('div', { class: 'lr-name' }, cm.name),
          el('div', { class: 'lr-sub' }, `Председатель: ${cm.chairmanName || '—'}`)
        )
      ),
      el('button', { class: 'btn small danger', onclick: () => {
        act(engine, () => dissolveCommittee(c, cm.typeId), () => net.dissolveCommittee?.(cm.typeId) || Promise.resolve({ok:false, reason:'Нет в мультиплеере'}));
      } }, 'Распустить')
    )) : [el('div', { class: 'empty' }, 'Нет комитетов')]),
    available.length ? el('div', { class: 'mt-12' },
      el('div', { class: 'lr-sub', style: { marginBottom: '6px' } }, 'Создать комитет:'),
      el('div', { class: 'flex gap-8 wrap' },
        ...available.slice(0, 4).map(t => el('button', { class: 'btn small', onclick: () => {
          act(engine, () => createCommittee(c, t.id), () => net.createCommittee?.(t.id) || Promise.resolve({ok:false, reason:'Нет в мультиплеере'}));
        } }, `${t.icon} ${t.name}`))
      )
    ) : null
  );
}

// ============================================================
// v3.11: ФРАКЦИИ
// ============================================================
function buildFactionsCard(engine, c) {
  const factions = getFactions(c);
  if (!factions.length) return card2('🎭 Фракции', null, el('div', { class: 'empty' }, 'Нет партий'));

  return card2('🎭 Фракции и дисциплина', `${factions.length}`,
    ...factions.map(f => el('div', { class: 'list-row', style: { flexDirection: 'column', alignItems: 'stretch', gap: '4px', padding: '6px 0' } },
      el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', width: '100%' } },
        el('span', { class: 'dot', style: { background: f.partyColor } }),
        el('div', { style: { flex: 1 } },
          el('div', { class: 'lr-name' }, f.partyName),
          el('div', { class: 'lr-sub' }, `${f.seats} мест · ${f.wing === 'left' ? 'левая' : f.wing === 'right' ? 'правая' : 'центр'}`)
        ),
        el('div', { style: { textAlign: 'right', minWidth: '80px' } },
          el('div', { class: 'lr-sub' }, `Дисциплина`),
          el('div', { class: 'font-600', style: { color: f.discipline > 70 ? 'var(--green)' : f.discipline > 40 ? 'var(--gold)' : 'var(--red)' } }, Math.round(f.discipline) + '%')
        )
      ),
      el('div', { class: 'bar ' + (f.discipline > 70 ? 'green' : f.discipline > 40 ? 'gold' : 'red') },
        el('i', { style: { width: f.discipline + '%' } })
      ),
      el('button', { class: 'btn small mt-8', onclick: () => {
        act(engine, () => strengthenDiscipline(c, f.partyId), () => net.strengthenDiscipline?.(f.partyId) || Promise.resolve({ok:false, reason:'Нет в мультиплеере'}));
      } }, '💰 Укрепить (−$0.01, +5%)')
    ))
  );
}

// ============================================================
// v3.11: СТАТИСТИКА ГОЛОСОВАНИЙ
// ============================================================
function buildVotingStatsCard(engine, c) {
  const stats = getVotingStatsDetailed(c);
  return card2('📊 Статистика голосований', `${stats.total} голосований`,
    el('div', { class: 'grid cols-2' },
      el('div', {},
        kv('✅ Принято', stats.passed),
        kv('❌ Отклонено', stats.rejected),
        kv('🚫 Заблокировано', stats.blocked),
        kv('⛔ Вето', stats.vetoed),
      ),
      el('div', {},
        kv('Всего', stats.total),
        kv('Успешность', stats.total > 0 ? pct(stats.passed / stats.total) : '—'),
      )
    ),
    stats.history.length ? el('div', { class: 'mt-12' },
      el('div', { class: 'lr-sub', style: { marginBottom: '4px' } }, 'Последние месяцы:'),
      el('div', { class: 'flex gap-8 wrap' },
        ...stats.history.map(h => el('span', { class: 'badge info' },
          `${h.month}/${String(h.year).slice(-2)}: ✅${h.passed} ❌${h.rejected}`
        ))
      )
    ) : null
  );
}

// ============================================================
// v3.11: ПОВЕСТКА
// ============================================================
function buildLegislativeAgendaCard(engine, c) {
  const agenda = getLegislativeAgenda(c);

  return card2('📋 Законодательная повестка', `${agenda.length}`,
    ...(agenda.length ? agenda.map(b => el('div', { class: 'list-row', style: { flexDirection: 'column', alignItems: 'stretch', gap: '4px', padding: '6px 0' } },
      el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        el('span', { class: b.priority === 2 ? 'badge warn' : 'badge info' }, b.priority === 2 ? '🏛️ Прав.' : '📜 Парт.'),
        el('div', { style: { flex: 1 } },
          el('div', { class: 'lr-name' }, b.name),
          el('div', { class: 'lr-sub' }, `⏳ ${b.daysLeft} дн.`)
        )
      ),
      el('div', { class: 'flex gap-8 wrap' },
        el('button', { class: 'btn small', onclick: () => {
          act(engine, () => accelerateBill(c, b.id), () => net.accelerateBill?.(b.id) || Promise.resolve({ok:false, reason:'Нет в мультиплеере'}));
        } }, '⏩ Ускорить (−$0.01)'),
        el('button', { class: 'btn small danger', onclick: () => {
          act(engine, () => postponeBill(c, b.id), () => net.postponeBill?.(b.id) || Promise.resolve({ok:false, reason:'Нет в мультиплеере'}));
        } }, '⏸️ Отложить')
      )
    )) : [el('div', { class: 'empty' }, 'Нет активных биллей')])
  );
}

// ============================================================
// v3.11: СЕССИЯ
// ============================================================
function buildSessionCard(engine, c) {
  const session = getSessionInfo(c);
  const progressPct = ((session.daysTotal - session.daysLeft) / Math.max(session.daysTotal, 1)) * 100;

  return card2('📅 Сессия парламента', `№ ${session.number}`,
    el('div', { class: 'grid cols-2' },
      el('div', {},
        kv('Статус', session.closed ? '🔒 Закрыта' : '🟢 Открыта'),
        kv('Начало', `${session.startDate?.month || 1}/${session.startDate?.year || 1936}`),
        kv('Длительность', `${session.daysTotal} дн.`),
      ),
      el('div', {},
        kv('Осталось', `${session.daysLeft} дн.`),
        kv('Прогресс', pct(progressPct / 100)),
      )
    ),
    el('div', { class: 'mt-12' },
      bar(Math.min(100, progressPct), 'gold')
    ),
    el('div', { class: 'flex gap-8 wrap mt-12' },
      session.closed ? el('button', { class: 'btn small primary', onclick: () => {
        act(engine, () => openSession(c), () => net.openSession?.() || Promise.resolve({ok:false, reason:'Нет в мультиплеере'}));
      } }, '📂 Открыть сессию') : el('button', { class: 'btn small danger', onclick: () => {
        act(engine, () => closeSession(c), () => net.closeSession?.() || Promise.resolve({ok:false, reason:'Нет в мультиплеере'}));
      } }, '📁 Закрыть сессию')
    )
  );
}

// ============================================================
// v3.11: ИНТЕРПЕЛЛЯЦИИ
// ============================================================
function buildInterpellationsCard(engine, c) {
  const items = getInterpellations(c);

  return card2('❓ Интерпелляции (запросы)', `${items.length}`,
    ...(items.length ? items.map(it => el('div', { class: 'list-row', style: { flexDirection: 'column', alignItems: 'stretch', gap: '4px', padding: '6px 0' } },
      el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        el('span', { class: it.status === 'pending' ? 'badge warn' : it.status === 'answered' ? 'badge good' : 'badge bad' },
          it.status === 'pending' ? '⏳ Ожидает' : it.status === 'answered' ? '✅ Отвечен' : '❌ Отклонён'),
        el('div', { style: { flex: 1 } },
          el('div', { class: 'lr-name' }, it.topic),
          el('div', { class: 'lr-sub' }, `${it.deputyName} · ${dateShort(it.createdAt)}`)
        )
      ),
      it.status === 'pending' ? el('div', { class: 'flex gap-8 wrap' },
        el('button', { class: 'btn small primary', onclick: () => {
          act(engine, () => answerInterpellation(c, it.id, true), () => net.answerInterpellation?.(it.id, true) || Promise.resolve({ok:false, reason:'Нет в мультиплеере'}));
        } }, '✅ Ответить'),
        el('button', { class: 'btn small danger', onclick: () => {
          act(engine, () => answerInterpellation(c, it.id, false), () => net.answerInterpellation?.(it.id, false) || Promise.resolve({ok:false, reason:'Нет в мультиплеере'}));
        } }, '❌ Отклонить')
      ) : null
    )) : [el('div', { class: 'empty' }, 'Нет запросов')]),
    el('div', { class: 'mt-12' },
      el('button', { class: 'btn small', onclick: () => {
        const all = (c.parties || []).flatMap(p => p.deputies || []);
        if (!all.length) { toast('Нет депутатов', 'error'); return; }
        const d = all[Math.floor(Math.random() * all.length)];
        act(engine, () => createInterpellation(c, d.id, 'Общие вопросы'), () => net.createInterpellation?.(d.id, 'Общие вопросы') || Promise.resolve({ok:false, reason:'Нет в мультиплеере'}));
      } }, '❓ Новый запрос')
    )
  );
}

// ============================================================
// v3.11: КОАЛИЦИЯ
// ============================================================
function buildCoalitionCard(engine, c) {
  const info = getCoalitionInfo(c);

  return card2('🤝 Коалиция', `${info.coalitionSeats}/${info.majority}`,
    el('div', { class: 'muted small mb-12' },
      info.hasMajority ? '✅ Коалиция имеет большинство' : '⚠️ Коалиция не имеет большинства'),
    ...info.inCoalition.map(p => el('div', { class: 'list-row', style: { padding: '4px 0' } },
      el('span', { class: 'dot', style: { background: p.color } }),
      el('span', {}, p.name),
      el('span', { class: 'font-600' }, `${p.seats} мест`)
    )),
    info.potential.length ? el('div', { class: 'mt-12' },
      el('div', { class: 'lr-sub', style: { marginBottom: '4px' } }, 'Потенциальные союзники:'),
      ...info.potential.map(x => el('div', { class: 'list-row', style: { padding: '4px 0' } },
        el('span', { class: 'dot', style: { background: x.party.color } }),
        el('span', {}, x.party.name),
        el('span', { class: 'lr-sub' }, `дистанция ${x.distance.toFixed(1)}`),
        el('button', { class: 'btn small primary', onclick: () => {
          act(engine, () => {
            if (!c.coalition) c.coalition = [];
            if (!c.coalition.includes(x.party.id)) c.coalition.push(x.party.id);
          }, () => net.formCoalition?.() || Promise.resolve({ok:false, reason:'Нет в мультиплеере'}));
        } }, '➕')
      ))
    ) : null
  );
}

// ============================================================
// v3.11: ОППОЗИЦИЯ
// ============================================================
function buildOppositionCard(engine, c) {
  const info = getOppositionInfo(c);

  return card2('🥊 Оппозиция', `${info.totalSeats} мест`,
    info.leader ? el('div', { class: 'list-row' },
      el('div', {},
        el('div', { class: 'lr-name' }, info.leader.name),
        el('div', { class: 'lr-sub' }, `${info.leader.partyName} · харизма ${Math.round(info.leader.charisma || 0)}`)
      ),
      el('span', { class: 'badge bad' }, 'Лидер оппозиции')
    ) : el('div', { class: 'empty' }, 'Нет оппозиции'),
    ...info.parties.map(p => el('div', { class: 'list-row', style: { padding: '4px 0' } },
      el('span', { class: 'dot', style: { background: p.color } }),
      el('span', {}, p.name),
      el('span', { class: 'font-600' }, `${p.seats} мест`)
    )),
    el('div', { class: 'flex gap-8 wrap mt-12' },
      el('button', { class: 'btn small primary', onclick: () => {
        act(engine, () => oppositionRally(c), () => net.oppositionRally?.() || Promise.resolve({ok:false, reason:'Нет в мультиплеере'}));
      } }, '📢 Митинг ($0.02)'),
      el('button', { class: 'btn small', onclick: () => {
        act(engine, () => oppositionScandal(c), () => net.oppositionScandal?.() || Promise.resolve({ok:false, reason:'Нет в мультиплеере'}));
      } }, '📰 Скандал ($0.03)'),
      el('button', { class: 'btn small danger', onclick: () => {
        act(engine, () => callVoteOfNoConfidence(c, engine), () => net.callVoteOfNoConfidence?.() || Promise.resolve({ok:false, reason:'Нет в мультиплеере'}));
      } }, '⚠️ Вотум недоверия')
    )
  );
}

// ============================================================
// v3.10: СТРОКА БИЛЛЯ ДЛЯ ВКЛАДКИ «ПАРЛАМЕНТ»
// ============================================================
function buildParliamentBillRow(engine, c, b, canBlock, isOneParty) {
  const isGovernment = b.sponsorType === 'government';
  const isLaw = b.sponsorType === 'law';
  const canBlockThis = isGovernment && canBlock;
  const vote = predictVote(c, b);

  const isLawInProgress = isLaw && b.status === 'proposed';
  const daysLeft = b.daysLeft ?? b.daysTotal ?? 60;
  const daysTotal = b.daysTotal || 60;
  const daysPassed = Math.max(0, daysTotal - daysLeft);

  const awaiting = isLaw && isAwaitingPlayerVote(b);
  const voted = isLaw && b.playerVote;

  const lawProgressBar = isLawInProgress ? el('div', { style: { width: '100%', marginTop: '4px' } },
    el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' } },
      el('span', { class: 'muted', 'data-bill-days': b.id }, `⏳ Осталось ${daysLeft} дн. до голосования`),
      el('span', { class: 'muted', 'data-bill-count': b.id }, `${daysPassed}/${daysTotal}`)
    ),
    el('div', { class: 'bar gold' },
      el('i', { 'data-bill-bar': b.id, style: { width: Math.min(100, (daysPassed / Math.max(daysTotal, 1)) * 100) + '%' } })
    )
  ) : null;

  const voteBadge = voted ? el('span', {
    class: 'badge ' + (voted === 'for' ? 'good' : voted === 'against' ? 'bad' : 'info'),
    style: { fontSize: '9px' }
  }, voted === 'for' ? '✅ За' : voted === 'against' ? '❌ Против' : '⚪ Возд.') : null;

  const voteButton = awaiting ? el('button', {
    class: 'btn small primary',
    onclick: () => openBillVoteModal(engine, c, b)
  }, '🗳️ Голосовать') : (isLaw ? el('button', { class: 'btn small', onclick: () => openLawBillModal(engine, c, b) }, '📋 Детали') : null);

  return el('div', { class: 'list-row', style: { alignItems: 'flex-start', flexDirection: 'column', gap: '8px' } },
    el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', width: '100%' } },
      el('span', { class: 'dot', style: { background: isGovernment ? '#e6b84c' : (isLaw ? '#8b97b8' : b.sponsorColor) } }),
      el('div', { style: { flex: 1 } },
        el('div', { class: 'lr-name', style: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } },
          b.name,
          isGovernment ? el('span', { class: 'badge warn' }, '🏛️ Правительство') : null,
          isLaw ? el('span', { class: 'badge info' }, '📜 Закон') : null,
          voteBadge
        ),
        el('div', { class: 'lr-sub' }, `${b.desc} · внесён: ${b.sponsorName}`),
        lawProgressBar
      ),
      el('div', { style: { textAlign: 'right', minWidth: '120px' } },
        el('div', { class: vote.passes ? 'pos' : 'neg', style: { fontSize: '12px', fontWeight: '600' }, 'data-bill-vote': b.id },
          vote.passes ? '✅ проходит' : '❌ не проходит'),
        el('div', { class: 'lr-sub', 'data-bill-seats': b.id }, `${vote.supportSeats} / ${vote.opposeSeats}`)
      )
    ),
    el('div', { class: 'flex gap-8 wrap', style: { width: '100%' } },
      !isLaw ? el('button', { class: 'btn small ' + (canBlockThis ? 'danger' : 'primary'), onclick: () => {
        if (canBlockThis) {
          act(engine, () => parliamentBlockBill(c, b, engine), () => net.parliamentBlockBill(b.id));
        } else {
          act(engine, () => voteOnBill(c, b, engine), () => net.voteOnBill(b.id));
        }
      } }, canBlockThis ? '🚫 Заблокировать' : 'Голосовать') : null,
      !isLaw && !isOneParty && !isGovernment ? el('button', { class: 'btn small danger', onclick: () => {
        act(engine, () => presidentialVeto(c, b, engine), () => net.presidentialVeto(b.id));
      } }, 'Вето') : null,
      voteButton,
      el('div', { class: 'bar ' + (vote.passes ? 'green' : 'red'), style: { flex: 1, minWidth: '120px', marginTop: 0 } },
        el('i', { 'data-bill-support-bar': b.id, style: { width: Math.min(100, (vote.supportSeats / Math.max(c.seatsTotal, 1)) * 100) + '%' } })
      )
    )
  );
}
// ============================================================
// v3.9: КАРТОЧКА «ПАРЛАМЕНТСКАЯ ЖИЗНЬ»
// ============================================================
function buildParliamentLifeCard(engine, c) {
  const events = getParliamentLife(c, 10);
  const total = (c.parliamentLife || []).length;

  return card2('📢 Парламентская жизнь', total + ' событий',
    ...(events.length ? events.map(ev => {
      const type = PARLIAMENT_LIFE_TYPES[ev.type] || { icon: '📢', name: '?', color: '#7a8fb5' };
      return el('div', { class: 'list-row', style: { flexDirection: 'column', alignItems: 'stretch', gap: '4px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' } },
        el('div', { style: { display: 'flex', gap: '8px', alignItems: 'flex-start', width: '100%' } },
          el('span', { style: { fontSize: '16px', flexShrink: 0 } }, type.icon),
          el('div', { style: { flex: 1, minWidth: 0 } },
            el('div', { style: { fontSize: '12px', lineHeight: '1.4' } }, ev.text),
            el('div', { class: 'lr-sub', style: { display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' } },
              el('span', {
                style: { cursor: 'pointer', textDecoration: 'underline dotted', color: type.color },
                onclick: () => ev.deputyId && openDeputyByIdModal(engine, c, ev.deputyId)
              }, ev.deputyName || '—'),
              el('span', {}, '·'),
              el('span', {}, ev.partyName || '—'),
              el('span', {}, '·'),
              el('span', { class: 'muted' }, dateShort(ev.date))
            )
          )
        )
      );
    }) : [el('div', { class: 'empty' }, 'Парламентская жизнь пока тиха')]),
    el('div', { class: 'flex gap-8 wrap mt-12' },
      el('button', { class: 'btn small primary', onclick: () => openAllDeputiesModal(engine, c) }, '📋 Все депутаты'),
      el('button', { class: 'btn small', onclick: () => openParliamentLifeSummaryModal(engine, c) }, '📊 Сводка')
    )
  );
}

// ============================================================
// v3.9: МОДАЛКА «ВСЕ ДЕПУТАТЫ»
// ============================================================
function openAllDeputiesModal(engine, c) {
  const modal = document.getElementById('event-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  const all = getAllDeputiesDetailed(c);
  const parties = [...(c.parties || [])].filter(p => (p.deputies || []).length > 0);
  const districts = [...new Set(all.map(d => d.district).filter(Boolean))].sort();

  let filterParty = 'all';
  let filterDistrict = 'all';
  let searchText = '';

  const listEl = el('div', { style: { maxHeight: '55vh', overflowY: 'auto' } });

  const renderList = () => {
    const filtered = all.filter(d => {
      if (filterParty !== 'all' && d.partyId !== filterParty) return false;
      if (filterDistrict !== 'all' && d.district !== filterDistrict) return false;
      if (searchText && !(d.name || '').toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });

    mount(listEl,
      filtered.length ? filtered.map(d => el('div', {
        class: 'list-row',
        style: { cursor: 'pointer' },
        onclick: () => { close(); openDeputyModal(engine, c, d, parties.find(p => p.id === d.partyId)); }
      },
        el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', width: '100%' } },
          el('span', { style: { fontSize: '16px', color: d.partyColor } }, d.partySymbol || '⚖️'),
          el('div', { style: { flex: 1, minWidth: 0 } },
            el('div', { class: 'lr-name' }, d.name),
            el('div', { class: 'lr-sub' }, `${d.partyName} · ${d.district} · ${d.age} лет`)
          ),
          el('div', { style: { textAlign: 'right', fontSize: '11px' } },
            el('div', {}, `К${Math.round(d.competence)} · Х${Math.round(d.charisma)} · Л${Math.round(d.loyalty)}`),
            (d.scandals || 0) > 0 ? el('div', { class: 'neg' }, `⚠️ ${d.scandals}`) : null
          )
        )
      )) : [el('div', { class: 'empty' }, 'Никого не найдено')]
    );
  };

  const partySelect = el('select', {
    style: { padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '12px' },
    onchange: (e) => { filterParty = e.target.value; renderList(); }
  },
    el('option', { value: 'all' }, 'Все партии'),
    ...parties.map(p => el('option', { value: p.id }, `${p.symbol || ''} ${p.name}`))
  );

  const districtSelect = el('select', {
    style: { padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '12px' },
    onchange: (e) => { filterDistrict = e.target.value; renderList(); }
  },
    el('option', { value: 'all' }, 'Все округа'),
    ...districts.map(d => el('option', { value: d }, d))
  );

  const searchInput = el('input', {
    type: 'text',
    placeholder: '🔍 Поиск по имени...',
    style: { padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '12px', flex: 1, minWidth: '120px' },
    oninput: (e) => { searchText = e.target.value; renderList(); }
  });

  mount(modal,
    el('div', { class: 'modal-card', style: { maxHeight: '90vh', overflowY: 'auto', minWidth: '320px' } },
      el('h2', {}, `📋 Все депутаты (${all.length})`),
      el('p', { class: 'muted small' }, `Партий: ${parties.length} · Округов: ${districts.length}`),
      el('div', { class: 'flex gap-8 wrap mt-12', style: { alignItems: 'center' } },
        partySelect, districtSelect, searchInput
      ),
      el('div', { class: 'mt-12' }, listEl),
      el('div', { class: 'mt-16' },
        el('button', { class: 'btn small primary', onclick: close }, 'Закрыть')
      )
    )
  );

  renderList();
}

// ============================================================
// v3.9: МОДАЛКА ДЕПУТАТА ПО ID
// ============================================================
function openDeputyByIdModal(engine, c, deputyId) {
  const all = getAllDeputiesDetailed(c);
  const d = all.find(x => x.id === deputyId);
  if (!d) {
    toast('Депутат не найден', 'error');
    return;
  }
  const party = (c.parties || []).find(p => p.id === d.partyId);
  openDeputyModal(engine, c, d, party);
}

// ============================================================
// v3.9: МОДАЛКА СВОДКИ ПАРЛАМЕНТСКОЙ ЖИЗНИ
// ============================================================
function openParliamentLifeSummaryModal(engine, c) {
  const modal = document.getElementById('event-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  const summary = getParliamentLifeSummary(c, 30);

  const typeRows = Object.entries(PARLIAMENT_LIFE_TYPES).map(([typeId, type]) => {
    const count = summary.byType[typeId] || 0;
    return el('div', { class: 'list-row', style: { padding: '6px 0' } },
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        el('span', { style: { fontSize: '16px' } }, type.icon),
        el('span', {}, type.name)
      ),
      el('span', { class: 'font-600', style: { color: type.color } }, String(count))
    );
  });

  mount(modal,
    el('div', { class: 'modal-card', style: { maxHeight: '90vh', overflowY: 'auto', minWidth: '320px' } },
      el('h2', {}, '📊 Сводка парламентской жизни'),
      el('p', { class: 'muted small' }, `За последние 30 дней: ${summary.total} событий`),
      el('div', { class: 'mt-12' }, ...typeRows),
      el('div', { class: 'mt-16' },
        el('h3', { style: { fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' } }, 'ПОСЛЕДНИЕ СОБЫТИЯ'),
        el('div', { style: { maxHeight: '40vh', overflowY: 'auto' } },
          ...(summary.recent.length ? summary.recent.map(ev => {
            const type = PARLIAMENT_LIFE_TYPES[ev.type] || { icon: '📢', color: '#7a8fb5' };
            return el('div', { class: 'list-row', style: { flexDirection: 'column', alignItems: 'stretch', gap: '2px', padding: '6px 0' } },
              el('div', { style: { display: 'flex', gap: '6px', alignItems: 'flex-start' } },
                el('span', { style: { fontSize: '14px', flexShrink: 0 } }, type.icon),
                el('div', { style: { fontSize: '12px', lineHeight: '1.4' } }, ev.text)
              ),
              el('div', { class: 'lr-sub', style: { paddingLeft: '20px' } },
                el('span', { style: { color: type.color } }, ev.deputyName || '—'),
                ' · ',
                ev.partyName || '—',
                ' · ',
                dateShort(ev.date)
              )
            );
          }) : [el('div', { class: 'empty' }, 'Нет событий')])
        )
      ),
      el('div', { class: 'mt-16' },
        el('button', { class: 'btn small primary', onclick: close }, 'Закрыть')
      )
    )
  );
}

// ============================================================
// v3.9: МОДАЛКА ГОЛОСОВАНИЯ ПО ЗАКОНОПРОЕКТУ
// ============================================================
function openBillVoteModal(engine, c, b) {
  const modal = document.getElementById('event-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  const law = LAWS.find(l => l.id === b.lawId);
  const vote = b._cachedVote || predictVote(c, b);
  const daysLeft = b.daysLeft ?? b.daysTotal ?? 60;
  const daysTotal = b.daysTotal || 60;
  const daysPassed = Math.max(0, daysTotal - daysLeft);
  const threshold = Math.floor(c.seatsTotal / 2) + 1;
  const passed = vote.passes;

  const renderEffects = () => {
    if (!law?.effects) return el('div', { class: 'muted small' }, '—');
    const rows = [];
    if (law.effects.add) {
      for (const [k, v] of Object.entries(law.effects.add)) {
        rows.push(el('div', { class: 'list-row', style: { padding: '3px 0', fontSize: '12px' } },
          el('span', { class: 'muted' }, k),
          el('span', { class: v >= 0 ? 'pos' : 'neg', style: { fontWeight: '600' } }, (v >= 0 ? '+' : '') + v)
        ));
      }
    }
    if (law.effects.set) {
      for (const [k, v] of Object.entries(law.effects.set)) {
        rows.push(el('div', { class: 'list-row', style: { padding: '3px 0', fontSize: '12px' } },
          el('span', { class: 'muted' }, k),
          el('span', { class: 'gold', style: { fontWeight: '600' } }, '→ ' + v)
        ));
      }
    }
    if (law.effects.mul) {
      for (const [k, v] of Object.entries(law.effects.mul)) {
        rows.push(el('div', { class: 'list-row', style: { padding: '3px 0', fontSize: '12px' } },
          el('span', { class: 'muted' }, k),
          el('span', { style: { fontWeight: '600' } }, '× ' + v)
        ));
      }
    }
    return rows.length ? el('div', {}, ...rows) : el('div', { class: 'muted small' }, '—');
  };

  const supportAfterFor = Math.min(c.seatsTotal, vote.supportSeats + VOTE_BONUS);
  const supportAfterAgainst = Math.max(0, vote.supportSeats - VOTE_BONUS);
  const passesAfterFor = supportAfterFor > c.seatsTotal / 2;
  const passesAfterAgainst = supportAfterAgainst > c.seatsTotal / 2;

  mount(modal,
    el('div', { class: 'modal-card', style: { maxHeight: '90vh', overflowY: 'auto' } },
      el('h2', {}, `🗳️ ${b.name}`),
      el('p', { class: 'muted small' }, b.desc),

      el('div', { class: 'grid cols-2 mt-12' },
        el('div', {},
          kv('Тип', 'Парламентская инициатива'),
          kv('Внесён', b.sponsorName || '—'),
          kv('Дней прошло', `${daysPassed}/${daysTotal}`),
          kv('Осталось', `${daysLeft} дн.`)
        ),
        el('div', {},
          kv('Голосов «за»', vote.supportSeats),
          kv('Голосов «против»', vote.opposeSeats),
          kv('Порог', threshold),
          el('div', { class: 'kv' },
            el('span', { class: 'k' }, 'Прогноз'),
            el('span', { class: 'v ' + (passed ? 'pos' : 'neg') }, passed ? '✅ пройдёт' : '❌ не пройдёт')
          )
        )
      ),

      el('div', { class: 'mt-12' },
        el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' } },
          el('span', {}, '🗳️ Поддержка парламента'),
          el('span', { class: passed ? 'pos' : 'neg' }, `${vote.supportSeats} / ${c.seatsTotal}`)
        ),
        bar(Math.min(100, (vote.supportSeats / Math.max(c.seatsTotal, 1)) * 100), passed ? 'green' : 'red')
      ),

      el('div', { class: 'mt-16' },
        el('h3', { style: { fontSize: '12px', marginBottom: '6px', color: 'var(--muted)' } }, '📊 ПОСЛЕДСТВИЯ ПРИНЯТИЯ'),
        renderEffects()
      ),

      el('div', { class: 'mt-16' },
        el('h3', { style: { fontSize: '12px', marginBottom: '6px', color: 'var(--muted)' } }, '🎯 ВАШ ГОЛОС'),
        el('div', { class: 'muted small', style: { marginBottom: '8px' } },
          `Ваш голос даёт ±${VOTE_BONUS} мест к поддержке.`),
        el('div', { class: 'grid cols-2', style: { gap: '8px' } },
          el('div', { class: 'card', style: { padding: '8px', background: 'rgba(62, 207, 142, 0.08)' } },
            el('div', { style: { fontWeight: '600', fontSize: '12px', marginBottom: '4px' } }, '✅ За'),
            el('div', { class: 'lr-sub', style: { fontSize: '11px' } },
              `→ ${supportAfterFor} мест · ${passesAfterFor ? 'пройдёт' : 'не пройдёт'}`)
          ),
          el('div', { class: 'card', style: { padding: '8px', background: 'rgba(240, 89, 107, 0.08)' } },
            el('div', { style: { fontWeight: '600', fontSize: '12px', marginBottom: '4px' } }, '❌ Против'),
            el('div', { class: 'lr-sub', style: { fontSize: '11px' } },
              `→ ${supportAfterAgainst} мест · ${passesAfterAgainst ? 'пройдёт' : 'не пройдёт'}`)
          )
        )
      ),

      el('div', { class: 'mt-16 flex gap-8 wrap' },
        el('button', { class: 'btn small primary', onclick: () => {
          close();
          act(engine,
            () => castBillVote(c, b, 'for', engine),
            () => net.castBillVote?.(b.id, 'for') || Promise.resolve({ok:false, reason:'Нет в мультиплеере'})
          );
          engine.notify();
        } }, '✅ Голосовать «За»'),
        el('button', { class: 'btn small danger', onclick: () => {
          close();
          act(engine,
            () => castBillVote(c, b, 'against', engine),
            () => net.castBillVote?.(b.id, 'against') || Promise.resolve({ok:false, reason:'Нет в мультиплеере'})
          );
          engine.notify();
        } }, '❌ Голосовать «Против»'),
        el('button', { class: 'btn small', onclick: () => {
          close();
          act(engine,
            () => castBillVote(c, b, 'abstain', engine),
            () => net.castBillVote?.(b.id, 'abstain') || Promise.resolve({ok:false, reason:'Нет в мультиплеере'})
          );
          engine.notify();
        } }, '⚪ Воздержаться'),
        el('button', { class: 'btn small', onclick: close }, 'Отмена')
      )
    )
  );
}

// ============================================================
// v3.5: МОДАЛКА ДЕТАЛЕЙ LAW-БИЛЛЯ
// ============================================================
function openLawBillModal(engine, c, b) {
  const modal = document.getElementById('event-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  const vote = b._cachedVote || predictVote(c, b);
  const law = LAWS.find(l => l.id === b.lawId);
  const daysLeft = b.daysLeft ?? b.daysTotal ?? 60;
  const daysTotal = b.daysTotal || 60;
  const daysPassed = Math.max(0, daysTotal - daysLeft);
  const createdDate = b.createdDate
    ? `${b.createdDate.day || 1}/${b.createdDate.month}/${b.createdDate.year}`
    : '—';

  const awaiting = isAwaitingPlayerVote(b);
  const voted = b.playerVote;

  mount(modal,
    el('div', { class: 'modal-card', style: { maxHeight: '90vh', overflowY: 'auto' } },
      el('h2', {}, `📜 ${b.name}`),
      el('p', { class: 'muted small' }, b.desc),

      el('div', { class: 'grid cols-2 mt-12' },
        el('div', {},
          kv('Тип', 'Парламентская инициатива'),
          kv('Внесён', createdDate),
          kv('Внесён', b.sponsorName || '—'),
          kv('Дней прошло', `${daysPassed}/${daysTotal}`)
        ),
        el('div', {},
          kv('Голосов «за»', vote.supportSeats),
          kv('Голосов «против»', vote.opposeSeats),
          kv('Порог', Math.floor(c.seatsTotal / 2) + 1),
          kv('Прогноз', vote.passes ? '✅ пройдёт' : '❌ не пройдёт')
        )
      ),

      el('div', { class: 'mt-12' },
        el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' } },
          el('span', {}, '⏳ Осталось до голосования'),
          el('span', { class: 'gold' }, `${daysLeft} дн.`)
        ),
        bar(Math.min(100, (daysPassed / Math.max(daysTotal, 1)) * 100), 'gold')
      ),

      el('div', { class: 'mt-12' },
        el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' } },
          el('span', {}, '🗳️ Поддержка парламента'),
          el('span', { class: vote.passes ? 'pos' : 'neg' }, `${vote.supportSeats} / ${c.seatsTotal}`)
        ),
        bar(Math.min(100, (vote.supportSeats / Math.max(c.seatsTotal, 1)) * 100), vote.passes ? 'green' : 'red')
      ),

      voted ? el('div', { class: 'mt-12 badge ' + (voted === 'for' ? 'good' : voted === 'against' ? 'bad' : 'info'), style: { padding: '8px 12px' } },
        `Ваш голос: ${voted === 'for' ? '✅ За' : voted === 'against' ? '❌ Против' : '⚪ Воздержался'}`) : null,

      law ? el('div', { class: 'mt-12' },
        el('div', { class: 'lr-sub', style: { marginBottom: '4px' } }, '📊 Эффекты:'),
        law.effects?.add ? Object.entries(law.effects.add).map(([k, v]) =>
          el('div', { class: 'kv', style: { padding: '2px 0', fontSize: '12px' } },
            el('span', { class: 'k' }, k),
            el('span', { class: 'v' }, (v >= 0 ? '+' : '') + v)
          )
        ) : el('div', { class: 'muted small' }, '—')
      ) : null,

      el('div', { class: 'mt-16 flex gap-8 wrap' },
        awaiting ? el('button', { class: 'btn small primary', onclick: () => { close(); openBillVoteModal(engine, c, b); } }, '🗳️ Голосовать') : null,
        el('button', { class: 'btn small primary', onclick: close }, 'Закрыть')
      )
    )
  );
}

// ============================================================
// КАРТОЧКА КОНСТИТУЦИОННОГО КРИЗИСА
// ============================================================
function buildCrisisCard(engine, c) {
  const cr = c.constitutionalCrisis;
  if (!cr) return null;

  const phase = CRISIS_PHASES[cr.phase] || { name: '?' };
  const progressPct = Math.min(100, ((cr.phase - 1) / 3) * 100 + (1 - cr.monthsLeft / (CRISIS_PHASES[cr.phase]?.months || 1)) * (100 / 3));

  const riskRow = (label, value, color) => el('div', { class: 'list-row', style: { padding: '6px 0' } },
    el('div', { style: { display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '12px' } },
      el('span', {}, label),
      el('span', { class: 'font-600', style: { color } }, Math.round(value * 100) + '%')
    ),
    bar(value * 100, color === 'var(--red)' ? 'red' : color === 'var(--gold)' ? 'gold' : '')
  );

  return card2(
    '⚖️ Конституционный кризис',
    `Фаза ${cr.phase}/3 · ${phase.name}`,
    el('div', { class: 'muted small mb-12' },
      `Смена системы: ${sysName(cr.from)} → ${sysName(cr.to)}`),
    el('div', { class: 'mt-8' },
      el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' } },
        el('span', {}, 'Прогресс'),
        el('span', { class: 'muted' }, `${cr.monthsLeft} мес. до развязки`)
      ),
      bar(progressPct, 'gold')
    ),
    el('div', { class: 'mt-12' },
      riskRow('🏛️ Парламент заблокирует', cr.risks.parliament, 'var(--red)'),
      riskRow('🎖️ Военный переворот', cr.risks.army, 'var(--red)'),
      riskRow('✊ Революция', cr.risks.street, 'var(--red)')
    ),
    cr.events && cr.events.length ? el('div', { class: 'mt-12' },
      el('div', { class: 'lr-sub', style: { marginBottom: '4px' } }, '📰 События:'),
      ...cr.events.slice(-3).map(e => el('div', { class: 'list-row', style: { fontSize: '12px', padding: '4px 0' } },
        el('div', { class: 'muted' }, e.text)
      ))
    ) : null,
    el('div', { class: 'mt-12 flex gap-8 wrap' },
      el('button', { class: 'btn small danger', onclick: () => {
        act(engine, () => abortConstitutionalCrisis(c, engine), () => net.abortConstitutionalCrisis?.());
      } }, '❌ Отступить (−8 одобрения)')
    ),
    el('div', { class: 'mt-12 muted small' },
      'Кризис идёт 4 месяца. Риски растут каждый месяц. Если армия или улица сработают — вы потеряете власть.')
  );
}

// ============================================================
// PLAYER STATUS CARD
// ============================================================
function buildPlayerStatusCard(engine, c, head, playerParty, playerPerson) {
  if (c.playerPersonId) {
    const rolePos = c.playerRole ? POSITIONS[c.playerRole] : null;
    const leaderParty = playerParty?.leader?.id === c.playerPersonId ? playerParty : null;
    const roleLabel = rolePos?.name || (leaderParty ? 'Лидер партии' : 'Без должности');
    const roleIcon = rolePos?.icon || (leaderParty ? '👑' : '👤');
    const inPower = c.playerInPower !== false && (!!c.playerRole || !!leaderParty);
    const personName = playerPerson?.name || '—';
    const partyName = playerParty?.name || null;
    const goal = c.playerPersonGoal;

    return card2('🎮 Вы играете за персонажа', null,
      el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' } },
        el('span', { style: { fontSize: '24px' } }, roleIcon),
        el('div', { style: { flex: 1 } },
          el('div', { class: 'lr-name' }, personName),
          el('div', { class: 'lr-sub' },
            roleLabel +
            (partyName ? ` · ${partyName}` : '') +
            (playerPerson ? ` · ${playerPerson.age} лет` : '')
          )
        ),
        el('span', { class: inPower ? 'badge good' : 'badge bad' },
          inPower ? '✓ У власти' : '✗ Потеряли пост')
      ),
      playerPerson ? el('div', { class: 'grid cols-2 mt-8' },
        el('div', {},
          kv('Компетентность', Math.round(playerPerson.competence || 0)),
          kv('Харизма', Math.round(playerPerson.charisma || 0)),
          kv('Здоровье', pctRaw(playerPerson.health || 100)),
        ),
        el('div', {},
          kv('Лояльность', Math.round(playerPerson.loyalty || 0)),
          kv('Идеология', ideoName(playerPerson.ideology)),
          kv('Возраст', (playerPerson.age || '—') + ' лет'),
        )
      ) : null,
      goal ? el('div', { class: 'mt-12' },
        el('div', { class: 'lr-sub', style: { marginBottom: '4px' } }, `🎯 Цель: ${goal.name}`),
        el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' } },
          el('span', {}, `${goal.progress} / ${goal.target} ${goal.unit}`),
          el('span', { class: goal.progress >= goal.target ? 'pos' : 'muted' }, goal.progress >= goal.target ? '✓ Достигнуто' : '')
        ),
        bar(Math.min(100, (goal.progress / Math.max(goal.target, 1)) * 100), goal.progress >= goal.target ? 'green' : 'gold')
      ) : null,
      el('div', { class: 'mt-12 flex gap-8 wrap' },
        playerPerson ? el('button', { class: 'btn small', onclick: () => openPersonModal(engine, c, playerPerson, { roleLabel: roleLabel, partyName }) }, '👤 Карточка персонажа') : null,
        !inPower ? el('div', { class: 'muted small' }, 'Вы в оппозиции. Боритесь за возвращение на выборах.') : null
      )
    );
  }

  if (c.playerPartyId) {
    const inPower = (c.playerInPower !== false) && (c.coalition || []).includes(c.playerPartyId);
    const goal = c.playerPartyGoal;

    const isLeader = playerParty?.leader?.id === c.playerPersonId;
    const roleTitle = isLeader
      ? (inPower ? '👑 Лидер правящей партии' : '🥊 Лидер оппозиции')
      : (inPower ? '🏛️ Депутат правящей коалиции' : '✊ Депутат оппозиции');

    return card2('🎮 Вы играете за партию', null,
      el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' } },
        el('span', { style: { fontSize: '24px' } }, playerParty?.symbol || '⚖️'),
        el('div', { style: { flex: 1 } },
          el('div', { class: 'lr-name' }, playerParty?.name || '—'),
          el('div', { class: 'lr-sub' }, `${ideoName(playerParty?.ideology)} · ${playerParty?.seats || 0} мест`),
          el('div', { class: 'badge ' + (inPower ? 'good' : 'bad'), style: { marginTop: '4px' } }, roleTitle)
        ),
        el('span', { class: inPower ? 'badge good' : 'badge bad' },
          inPower ? '✓ У власти' : '✗ В оппозиции')
      ),
      goal ? el('div', { class: 'mt-12' },
        el('div', { class: 'lr-sub', style: { marginBottom: '4px' } }, `🎯 Цель: ${goal.name}`),
        el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' } },
          el('span', {}, `${goal.progress} / ${goal.target} ${goal.unit}`),
          el('span', { class: goal.progress >= goal.target ? 'pos' : 'muted' }, goal.progress >= goal.target ? '✓ Достигнуто' : '')
        ),
        bar(Math.min(100, (goal.progress / Math.max(goal.target, 1)) * 100), goal.progress >= goal.target ? 'green' : 'gold')
      ) : null,
      el('div', { class: 'muted small mt-8' },
        inPower
          ? 'Ваша партия входит в правящую коалицию. Вы можете вносить законопроекты от правительства.'
          : 'Ваша партия в оппозиции. Вы можете агитировать, устраивать митинги и скандалы.'
      ),
      !inPower ? el('div', { class: 'mt-12 flex gap-8 wrap' },
        el('button', { class: 'btn small primary', onclick: () => {
          act(engine, () => oppositionRally(c), () => net.oppositionRally?.() || Promise.resolve({ok:false, reason:'Нет в мультиплеере'}));
        } }, '📢 Митинг ($0.02)'),
        el('button', { class: 'btn small', onclick: () => {
          act(engine, () => oppositionScandal(c), () => net.oppositionScandal?.() || Promise.resolve({ok:false, reason:'Нет в мультиплеере'}));
        } }, '📰 Скандал ($0.03)'),
        el('button', { class: 'btn small danger', onclick: () => {
          act(engine, () => callVoteOfNoConfidence(c, engine), () => net.callVoteOfNoConfidence?.() || Promise.resolve({ok:false, reason:'Нет в мультиплеере'}));
        } }, '⚠️ Вотум недоверия')
      ) : null
    );
  }

  return null;
}

// ============================================================
// МОДАЛКА ПЕРСОНАЖА
// ============================================================
function openPersonModal(engine, c, person, opts = {}) {
  if (!person) return;
  const modal = document.getElementById('event-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  const { roleLabel = 'Персонаж', partyName = '—', showActions = false } = opts;
  const isPlayer = c.playerPersonId && person.id === c.playerPersonId;

  mount(modal,
    el('div', { class: 'modal-card' },
      el('h2', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        el('span', { style: { fontSize: '20px' } }, isPlayer ? '👑' : '👤'),
        person.name,
        isPlayer ? el('span', { class: 'badge good', style: { fontSize: '10px' } }, 'ВЫ') : null
      ),
      el('p', { class: 'muted small' }, `${roleLabel} · ${ideoName(person.ideology)} · ${person.age} лет`),

      el('div', { class: 'grid cols-2 mt-12' },
        el('div', {},
          kv('Возраст', (person.age || '—') + ' лет'),
          kv('Идеология', ideoName(person.ideology)),
          kv('Роль', roleLabel),
          kv('Партия', partyName),
        ),
        el('div', {},
          kv('Компетентность', Math.round(person.competence || 0)),
          kv('Харизма', Math.round(person.charisma || 0)),
          kv('Лояльность', Math.round(person.loyalty || 0)),
          kv('Здоровье', pctRaw(person.health || 100)),
        )
      ),

      el('div', { class: 'mt-12' },
        kv('Скандалов', person.scandals || 0)
      ),

      showActions ? el('div', { class: 'mt-12 flex gap-8 wrap' },
        el('button', { class: 'btn small', onclick: () => {
          toast(`Действия для «${person.name}» появятся позже`, 'info');
        } }, '⚙️ Действия')
      ) : null,

      el('div', { class: 'mt-16 flex gap-8 wrap' },
        el('button', { class: 'btn small primary', onclick: close }, 'Закрыть')
      )
    )
  );
}

// ============================================================
// ЗАКОНЫ
// ============================================================
const LAW_CATEGORIES = [
  { id: 'economy_taxes',    name: '💰 Налоги',              ids: ['flat_tax','progressive_tax','corporate_tax_cut','corporate_tax_hike','vat_introduce','property_tax'] },
  { id: 'economy_spending', name: '💸 Расходы',             ids: ['universal_healthcare','free_education','public_works','infrastructure_program','science_funding','agriculture_support','industrialization','housing_program'] },
  { id: 'economy_finance',  name: '🏦 Финансы',             ids: ['gold_standard','fiat_money','banking_reform','deposit_insurance','stock_market_reform'] },
  { id: 'economy_trade',    name: '🚢 Торговля',            ids: ['tariff_protection','free_trade','trade_agreements'] },
  { id: 'society_rights',   name: '⚖️ Права и свободы',     ids: ['free_press','censorship','labor_rights','womens_suffrage','minority_rights','secularism','religious_law','anti_discrimination','death_penalty_abolish','death_penalty_restore'] },
  { id: 'society_social',   name: '🏥 Образование и медицина', ids: ['mandatory_education','university_funding','vaccination_program','pension_system'] },
  { id: 'politics',         name: '🏛️ Политика',            ids: ['anti_corruption','judicial_reform','federalism','centralization','constitution_reform','emergency_powers','secret_police','civil_liberties','voting_reform','martial_law','police_reform','community_policing','rule_of_law_act','decentralization_act','centralization_act'] },
  { id: 'military',         name: '⚔️ Военные',             ids: ['military_industry','conscription','professional_army','naval_buildup','air_force','military_alliance','arms_export','veterans_support'] },
  { id: 'diplomacy',        name: '🌐 Дипломатия',          ids: ['isolationism','internationalism','foreign_aid','colonial_policy','neutrality'] },
];

function renderLawsGrouped(engine, c) {
  const result = [];
  for (const cat of LAW_CATEGORIES) {
    const laws = cat.ids.map(id => LAWS.find(l => l.id === id)).filter(Boolean);
    if (!laws.length) continue;
    const passedCount = laws.filter(l => (c.laws || []).includes(l.id)).length;
    const isCollapsed = collapsedLawCategories.has(cat.id);

    const header = el('div', {
      class: 'law-category-header',
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 0', cursor: 'pointer', userSelect: 'none',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      },
      onclick: () => {
        if (collapsedLawCategories.has(cat.id)) collapsedLawCategories.delete(cat.id);
        else collapsedLawCategories.add(cat.id);
        renderTab(engine, currentTab);
      }
    },
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        el('span', { style: { fontSize: '14px', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform .2s', display: 'inline-block' } }, '▼'),
        el('span', { class: 'lr-name', style: { fontSize: '13px' } }, cat.name)
      ),
      el('span', { class: 'badge info' }, `${passedCount}/${laws.length}`)
    );

    result.push(header);

    if (!isCollapsed) {
      for (const law of laws) {
        const passed = (c.laws || []).includes(law.id);
        const activeBill = (c.bills || []).find(b => b.sponsorType === 'law' && b.lawId === law.id && b.status === 'proposed');
        const inProgress = !!activeBill;

        let progressText = '';
        if (inProgress) {
          const daysLeft = activeBill.daysLeft ?? activeBill.daysTotal ?? 60;
          const vote = activeBill._cachedVote || predictVote(c, activeBill);
          const voteInfo = activeBill.playerVote
            ? ` · ${activeBill.playerVote === 'for' ? '✅ За' : activeBill.playerVote === 'against' ? '❌ Против' : '⚪ Возд.'}`
            : '';
          progressText = `⏳ Осталось ${daysLeft} дн. · ${vote.passes ? '✅' : '❌'} ${vote.supportSeats}/${vote.opposeSeats}${voteInfo}`;
        }

        result.push(
          el('div', { class: 'list-row', style: { paddingLeft: '20px', flexDirection: 'column', alignItems: 'stretch' } },
            el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '8px' } },
              el('div', { style: { flex: 1 } },
                el('div', { class: 'lr-name' }, law.name),
                el('div', { class: 'lr-sub' }, law.desc),
                inProgress ? el('div', {
                  class: 'lr-sub',
                  style: { marginTop: '4px', color: 'var(--gold-soft)' },
                  'data-law-days': law.id
                }, progressText) : null
              ),
              el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' } },
                passed ? el('button', {
                  class: 'btn small danger',
                  onclick: () => {
                    act(engine, () => revokeLaw(c, law.id), () => net.revokeLaw(law.id));
                    engine.notify();
                  }
                }, '↩️ Отменить') : el('button', {
                  class: 'btn small' + (inProgress ? '' : ' primary'),
                  disabled: inProgress,
                  onclick: () => {
                    act(engine, () => proposeLaw(c, law.id, engine), () => net.proposeLaw(law.id));
                  }
                }, inProgress ? '⏳ На рассмотрении' : 'Предложить'),
                inProgress && activeBill && isAwaitingPlayerVote(activeBill) ? el('button', {
                  class: 'btn small primary',
                  onclick: () => openBillVoteModal(engine, c, activeBill)
                }, '🗳️') : (inProgress ? el('button', {
                  class: 'btn small',
                  onclick: () => openLawBillModal(engine, c, activeBill)
                }, '📋') : null)
              )
            )
          )
        );
      }
    }
  }
  return result;
}

// ============================================================
// МОДАЛКА СМЕНЫ СИСТЕМЫ
// ============================================================
function openSystemModal(engine, c) {
  if (c.constitutionalCrisis) {
    toast('Конституционный кризис уже идёт', 'warn');
    return;
  }

  const modal = document.getElementById('event-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  const systems = [
    { id: 'presidential', name: 'Президентская', desc: 'Демократия: партии, выборы' },
    { id: 'parliamentary', name: 'Парламентская', desc: 'Демократия: партии, выборы' },
    { id: 'semi_presidential', name: 'Смешанная', desc: 'Демократия: партии, выборы' },
    { id: 'one_party', name: 'Однопартийная', desc: '⚠️ Только одна партия, без выборов' },
    { id: 'authoritarian', name: 'Авторитарная', desc: '⚠️ Партии можно распускать' },
  ];

  let selectedTarget = systems.find(s => s.id !== c.system)?.id || 'authoritarian';
  const forecastEl = el('div', { class: 'mt-16' });

  const updateForecast = () => {
    const target = selectedTarget;
    const isToAuth = target === 'one_party' || target === 'authoritarian';
    const isFromAuth = c.system === 'one_party' || c.system === 'authoritarian';

    let parliament = Math.max(0.05, Math.min(0.95, 0.5 - ((c.approval || 50) - 50) / 100));
    let army = Math.max(0.02, Math.min(0.9, 0.3 - ((c.stability || 55) - 50) / 100));
    let street = Math.max(0.05, Math.min(0.9, 0.3 - ((c.approval || 50) - 50) / 100));

    if (!isFromAuth && isToAuth) parliament += 0.2;
    if (isFromAuth && !isToAuth) { parliament -= 0.1; army -= 0.1; street -= 0.1; }
    if ((c.military?.readiness || 0) > 70) army -= 0.1;

    const rows = [
      { label: '🏛️ Парламент заблокирует', value: Math.max(0.05, Math.min(0.95, parliament)), color: 'var(--red)' },
      { label: '🎖️ Военный переворот', value: Math.max(0.02, Math.min(0.9, army)), color: 'var(--red)' },
      { label: '✊ Революция', value: Math.max(0.05, Math.min(0.9, street)), color: 'var(--red)' },
    ];

    mount(forecastEl,
      el('div', { class: 'muted small mb-12' }, `Прогноз для: ${sysName(target)}`),
      ...rows.map(r => el('div', { class: 'list-row', style: { padding: '6px 0' } },
        el('div', { style: { display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '12px' } },
          el('span', {}, r.label),
          el('span', { class: 'font-600', style: { color: r.color } }, Math.round(r.value * 100) + '%')
        ),
        bar(r.value * 100, 'red')
      )),
      el('div', { class: 'mt-12 muted small' },
        'Кризис длится 4 месяца. Риски растут каждый месяц. Армия/улица = потеря власти, парламент = провал.')
    );
  };

  const choicesEl = el('div', { class: 'modal-choices' });
  const renderChoices = () => {
    mount(choicesEl,
      ...systems.filter(s => s.id !== c.system).map(s =>
        el('button', {
          class: 'choice-btn' + (selectedTarget === s.id ? ' primary' : ''),
          onclick: (e) => {
            selectedTarget = s.id;
            renderChoices();
            updateForecast();
          }
        },
          el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            el('div', {},
              el('div', { style: { fontWeight: '700' } }, s.name),
              el('small', {}, s.desc)
            ),
            selectedTarget === s.id ? el('span', { class: 'badge good' }, 'выбрано') : null
          )
        )
      )
    );
  };

  mount(modal,
    el('div', { class: 'modal-card', style: { maxHeight: '90vh', overflowY: 'auto' } },
      el('h2', {}, '⚖️ Конституционный кризис'),
      el('p', { class: 'muted small' }, `Сейчас: ${sysName(c.system)}. Смена системы — это процесс, а не мгновенное действие.`),
      choicesEl,
      forecastEl,
      el('div', { class: 'mt-16 flex gap-8 wrap' },
        el('button', { class: 'btn small danger', onclick: () => {
          close();
          act(engine,
            () => startConstitutionalCrisis(c, selectedTarget),
            () => net.startConstitutionalCrisis?.(selectedTarget) || Promise.resolve({ok:false, reason:'Нет в мультиплеере'})
          );
        } }, '⚖️ Начать процесс'),
        el('button', { class: 'btn small', onclick: close }, 'Отмена')
      )
    )
  );

  renderChoices();
  updateForecast();
}

// ============================================================
// МОДАЛКА СОЗДАНИЯ ПАРТИИ
// ============================================================
function openCreatePartyModal(engine, c) {
  const modal = document.getElementById('event-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  let partyName = '';
  let partyIdeology = 'centrist';
  const ideologies = ['liberal','conservative','social_democrat','socialist','communist','nationalist','centrist','monarchist','agrarian','libertarian'];

  const nameInput = el('input', { type: 'text', placeholder: 'Название партии', value: '',
    style: { padding: '10px', width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', marginBottom: '10px', fontSize: '14px' } });
  nameInput.addEventListener('input', () => { partyName = nameInput.value; });

  const ideoSelect = el('select', {
    style: { padding: '10px', width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', marginBottom: '10px', fontSize: '14px' } },
    ...ideologies.map(i => el('option', { value: i }, ideoName(i)))
  );
  ideoSelect.addEventListener('change', () => { partyIdeology = ideoSelect.value; });

  mount(modal,
    el('div', { class: 'modal-card' },
      el('h2', {}, 'Создать партию'),
      el('p', { class: 'muted small' }, 'Партия появится в парламенте с небольшим количеством мест.'),
      nameInput,
      ideoSelect,
      el('div', { class: 'mt-16 flex gap-8' },
        el('button', { class: 'btn small primary', onclick: () => {
          close();
          act(engine, () => createParty(c, { name: partyName || undefined, ideology: partyIdeology }), () => net.createParty(partyName || undefined, partyIdeology));
        } }, 'Создать'),
        el('button', { class: 'btn small', onclick: close }, 'Отмена')
      )
    )
  );
}

// ============================================================
// МОДАЛКА ПАРТИИ
// ============================================================
function openPartyModal(engine, c, p) {
  const modal = document.getElementById('event-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const isCoalition = (c.coalition || []).includes(p.id);
  const isPlayerParty = p.id === c.playerPartyId;
  const spectrumPct = ((p.spectrum + 10) / 20) * 100;
  const canDissolve = c.system === 'authoritarian' && p.id !== c.rulingPartyId && (c.parties || []).length > 1 && !isPlayerParty;
  const canSwitchTo = !isPlayerParty && c.system !== 'one_party' && c.system !== 'authoritarian';
  const close = () => modal.classList.add('hidden');
  const deputies = p.deputies || [];

  mount(modal,
    el('div', { class: 'modal-card', style: { maxHeight: '90vh', overflowY: 'auto' } },
      el('h2', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        el('span', { style: { fontSize: '20px' } }, p.symbol || '⚖️'),
        p.name,
        isPlayerParty ? el('span', { class: 'badge good', style: { fontSize: '10px' } }, 'ВАША') : null
      ),
      el('p', {},
        `${ideoName(p.ideology)} · ${p.spectrumLabel || '—'} `,
        el('span', { class: 'badge', style: { background: (p.spectrumColor || '#7a8fb5') + '30', color: p.spectrumColor || '#7a8fb5' } }, p.spectrumShort || '—')
      ),

      p.description ? el('p', { class: 'muted small' }, p.description) : null,

      p.traditions && p.traditions.length ? el('div', { class: 'flex gap-8 wrap mt-12' },
        ...p.traditions.map(t => el('span', { class: 'badge info' }, t))
      ) : null,

      p.base && p.base.length ? el('div', { class: 'mt-12 muted small' },
        'База: ' + p.base.join(', ')
      ) : null,

      el('div', { class: 'spectrum-full mt-12' },
        el('div', { class: 'spectrum-labels' },
          el('span', {}, '← Крайне левые'),
          el('span', {}, 'Центр'),
          el('span', {}, 'Крайне правые →')
        ),
        el('div', { class: 'spectrum-track-full' },
          el('div', { class: 'spectrum-marker-full', style: { left: spectrumPct + '%', background: p.spectrumColor || '#7a8fb5' } })
        )
      ),

      el('div', { class: 'grid cols-2 mt-12' },
        el('div', {},
          kv('Мест', `${p.seats} / ${c.seatsTotal}`),
          kv('Поддержка', pctRaw(p.support)),
          kv('Дисциплина', pctRaw(p.discipline || 0)),
          kv('Финансирование', '$ ' + (p.funding || 0) + ' млн'),
          kv('Депутатов', deputies.length),
        ),
        el('div', {},
          el('div', { class: 'kv' },
            el('span', { class: 'k' }, 'Лидер'),
            el('span', { class: 'v' },
              el('span', {
                style: { cursor: 'pointer', textDecoration: 'underline dotted' },
                onclick: () => p.leader && openPersonModal(engine, c, p.leader, { roleLabel: 'Лидер партии', partyName: p.name })
              }, p.leader?.name || '—')
            )
          ),
          kv('Возраст лидера', (p.leader?.age || '—') + ' лет'),
          kv('Харизма', Math.round(p.leader?.charisma || 0)),
          kv('Основана', p.founded || '—'),
        )
      ),

      el('div', { class: 'mt-12' },
        isCoalition
          ? el('div', { class: 'badge good' }, '✓ В правящей коалиции')
          : el('div', { class: 'badge bad' }, '✗ В оппозиции')
      ),

      deputies.length ? el('div', { class: 'mt-12' },
        el('h3', { style: { fontSize: '12px', marginBottom: '8px', color: 'var(--muted)' } },
          `ДЕПУТАТЫ (${deputies.length})`),
        el('button', { class: 'btn small primary', onclick: () => {
          close();
          openDeputiesListModal(engine, c, p);
        } }, `📋 Показать всех (${deputies.length})`),
        el('div', { class: 'mt-8 muted small' },
          `Округа: ${[...new Set(deputies.map(d => d.district))].slice(0, 5).join(', ')}${deputies.length > 5 ? '...' : ''}`)
      ) : null,

      el('h3', { style: { fontSize: '12px', marginTop: '16px', marginBottom: '8px', color: 'var(--muted)' } }, 'ДЕЙСТВИЯ'),
      el('div', { class: 'flex gap-8 wrap' },
        !p.registered ? el('button', { class: 'btn small primary', onclick: () => {
          act(engine, () => registerParty(c, p.id), () => net.registerParty(p.id));
          close();
          engine.notify();
          renderTab(engine, currentTab);
        } }, '📋 Зарегистрировать ($0.02)') : null,
        el('button', { class: 'btn small', onclick: () => {
          close();
          openPartyProgramModal(engine, c, p);
        } }, '📜 Программа'),
        el('button', { class: 'btn small primary', onclick: () => {
          act(engine, () => changePartyLeader(c, p.id), () => net.changePartyLeader(p.id));
        } }, '🔄 Сменить лидера'),
        el('button', { class: 'btn small', onclick: () => {
          const amounts = [0.02, 0.05, 0.10, 0.20];
          openModal(
            `Финансировать «${p.name}»`,
            [el('p', { class: 'muted small' }, `Казна: $ ${num(c.treasury)} млрд`)],
            amounts.map(amt => ({
              label: `$${amt.toFixed(2)} млрд (+${Math.round(amt * 30)} поддержки)`,
              primary: amt === 0.05,
              onClick: () => {
                act(engine, () => fundParty(c, p.id, amt), () => net.fundParty(p.id, amt));
              }
            }))
          );
        } }, '💰 Финансировать'),
        el('button', { class: 'btn small', onclick: () => {
          act(engine, () => boostParty(c, p.id), () => net.boostParty(p.id));
        } }, '📣 Кампания ($0.08)'),
        canSwitchTo ? el('button', { class: 'btn small', onclick: () => {
          c.playerPartyId = p.id;
          c.playerPersonId = null;
          c.playerRole = null;
          c.playerInPower = (c.coalition || []).includes(p.id);
          c.playerPartyGoal = null;
          initPartyGoal(c);
          toast(`Теперь вы играете за «${p.name}»`, 'success');
          engine.notify();
          close();
          renderTab(engine, currentTab);
        } }, '🎮 Играть за эту партию') : null,
        canDissolve ? el('button', { class: 'btn small danger', onclick: () => {
          act(engine, () => dissolveParty(c, p.id), () => net.dissolveParty(p.id));
        } }, '🗑️ Распустить') : null
      ),

      el('div', { class: 'mt-16 flex gap-8' },
        el('button', { class: 'btn small primary', onclick: close }, 'Закрыть')
      )
    )
  );
}

// ============================================================
// МОДАЛКА СПИСКА ДЕПУТАТОВ
// ============================================================
function openDeputiesListModal(engine, c, p) {
  const modal = document.getElementById('event-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  const deputies = [...(p.deputies || [])].sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));

  mount(modal,
    el('div', { class: 'modal-card', style: { maxHeight: '90vh', overflowY: 'auto' } },
      el('h2', {}, `📋 Депутаты «${p.name}»`),
      el('p', { class: 'muted small' }, `${deputies.length} депутатов · ${p.seats} мест`),
      el('div', { style: { maxHeight: '60vh', overflowY: 'auto' } },
        ...deputies.map(d => el('div', { class: 'list-row', style: { cursor: 'pointer' }, onclick: () => {
          close();
          openDeputyModal(engine, c, d, p);
        } },
          el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            el('span', { style: { fontSize: '16px' } }, d.partySymbol || '⚖️'),
            el('div', {},
              el('div', { class: 'lr-name' }, d.name),
              el('div', { class: 'lr-sub' }, `${d.district} · ${d.age} лет · с ${d.since}`)
            )
          ),
          el('div', { style: { textAlign: 'right' } },
            el('div', { class: 'lr-sub' }, `Комп. ${d.competence} · Хар. ${d.charisma}`)
          )
        ))
      ),
      el('div', { class: 'mt-16' },
        el('button', { class: 'btn small', onclick: close }, 'Закрыть')
      )
    )
  );
}

// ============================================================
// КАРТОЧКА ДЕПУТАТА
// ============================================================
function openDeputyModal(engine, c, d, party) {
  const modal = document.getElementById('event-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  const biasLabel = d.voteBias > 0.1 ? '🟢 Лоялен правительству' :
                    d.voteBias < -0.1 ? '🔴 Оппозиционер' : '⚪ Умеренный';

  const stats = getDeputyStats(c, d.id);
  const reputation = stats?.reputation ?? 50;
  const totalScandals = stats?.scandals ?? (d.scandals || 0);
  const rumors = stats?.rumors ?? 0;
  const appeals = stats?.appeals ?? 0;
  const protests = stats?.protests ?? 0;
  const life = stats?.life ?? [];

  const reputationColor = reputation >= 70 ? 'var(--green)' : reputation >= 40 ? 'var(--gold)' : 'var(--red)';

  mount(modal,
    el('div', { class: 'modal-card', style: { maxHeight: '90vh', overflowY: 'auto' } },
      el('h2', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        el('span', { style: { fontSize: '20px' } }, d.partySymbol || '⚖️'),
        d.name
      ),
      el('p', { class: 'muted small' },
        `${party?.name || d.partyName || '—'} · ${ideoName(d.ideology)} · ${d.district}`),

      el('div', { class: 'grid cols-2 mt-12' },
        el('div', {},
          kv('Возраст', d.age + ' лет'),
          kv('Избран', d.since),
          kv('Округ', d.district),
          kv('Партия', party?.name || d.partyName || '—'),
        ),
        el('div', {},
          kv('Компетентность', Math.round(d.competence)),
          kv('Харизма', Math.round(d.charisma)),
          kv('Лояльность', Math.round(d.loyalty)),
          kv('Скандалов', totalScandals),
        )
      ),

      el('div', { class: 'mt-12' },
        kv('Политический уклон', biasLabel + ` (${(d.voteBias || 0).toFixed(2)})`)
      ),

      el('div', { class: 'mt-12' },
        el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' } },
          el('span', {}, '⭐ Репутация'),
          el('span', { class: 'font-600', style: { color: reputationColor } }, String(reputation) + ' / 100')
        ),
        bar(reputation, reputation >= 70 ? 'green' : reputation >= 40 ? 'gold' : 'red'),
        el('div', { class: 'mt-8 lr-sub', style: { display: 'flex', gap: '12px', flexWrap: 'wrap' } },
          el('span', {}, `🔥 Скандалы: ${totalScandals}`),
          el('span', {}, `🗣️ Слухи: ${rumors}`),
          el('span', {}, `📢 Обращения: ${appeals}`),
          el('span', {}, `✊ Протесты: ${protests}`)
        )
      ),

      life.length ? el('div', { class: 'mt-12' },
        el('h3', { style: { fontSize: '12px', marginBottom: '6px', color: 'var(--muted)' } }, 'ПОСЛЕДНИЕ СОБЫТИЯ'),
        el('div', { style: { maxHeight: '30vh', overflowY: 'auto' } },
          ...life.map(ev => {
            const type = PARLIAMENT_LIFE_TYPES[ev.type] || { icon: '📢', color: '#7a8fb5' };
            return el('div', { class: 'list-row', style: { flexDirection: 'column', alignItems: 'stretch', gap: '2px', padding: '4px 0' } },
              el('div', { style: { display: 'flex', gap: '6px', alignItems: 'flex-start' } },
                el('span', { style: { fontSize: '13px', flexShrink: 0 } }, type.icon),
                el('div', { style: { fontSize: '11px', lineHeight: '1.4' } }, ev.text)
              ),
              el('div', { class: 'lr-sub', style: { paddingLeft: '18px', fontSize: '10px' } }, dateShort(ev.date))
            );
          })
        )
      ) : null,

      el('div', { class: 'mt-12 flex gap-8 wrap' },
        el('button', { class: 'btn small', onclick: () => {
          close();
          openPersonModal(engine, c, d, { roleLabel: 'Депутат', partyName: party?.name || d.partyName });
        } }, '👤 Подробнее'),
        el('button', { class: 'btn small', onclick: () => {
          close();
          openAllDeputiesModal(engine, c);
        } }, '📋 Все депутаты')
      ),

      el('div', { class: 'mt-16' },
        el('button', { class: 'btn small primary', onclick: close }, 'Закрыть')
      )
    )
  );
}

// ============================================================
// ОБЩЕСТВО
// ============================================================
function viewSociety(engine, c) {
  const demo = card2('Демография', null,
    kvK('Население', int(c.population), 'soc-population'),
    kvK('Площадь', int(c.area) + ' км²', 'soc-area'),
    kvK('Плотность', (c.area > 0 ? (c.population / c.area).toFixed(1) : '0') + ' чел/км²', 'soc-density'),
    kvK('Рождаемость', (c.birthRate || 0).toFixed(1) + ' / 1000', 'birth-rate'),
    kvK('Смертность', (c.deathRate || 0).toFixed(1) + ' / 1000', 'death-rate'),
    kvK('Миграция', signNum(c.migrationRate || 0, 2) + ' / 1000', 'migration'),
    kvK('Ожидаемая жизнь', (c.lifeExpectancy || 0).toFixed(1) + ' лет', 'life-expectancy'),
    kvK('Дети / взрослые / пожилые', `${(c.ageStructure?.children || 0).toFixed(0)}% / ${(c.ageStructure?.adults || 0).toFixed(0)}% / ${(c.ageStructure?.elderly || 0).toFixed(0)}%`, 'age-structure'),
  );

  const edu = card2('Образование и медицина', null,
    kvK('Грамотность', pct(c.literacy, 1), 'literacy'),
    kvK('Уровень образования', pctRaw(c.educationLevel), 'soc-education'),
    kvK('Уровень здравоохранения', pctRaw(c.healthcareLevel), 'soc-healthcare'),
    kvK('Инфраструктура', pctRaw(c.infrastructure), 'infrastructure'),
    kvK('Технологии', pctRaw(c.technology), 'technology'),
    bar(c.educationLevel, 'green'),
    bar(c.healthcareLevel, 'green'),
  );

  const social = card2('Социальное состояние', null,
    kvK('Преступность', pctRaw(c.crimeRate), 'soc-crime'),
    kvK('Неравенство', ((c.inequality || 0) * 100).toFixed(1) + '%', 'soc-inequality'),
    kvK('Бедность', pct(c.poverty), 'soc-poverty'),
    kvK('Теневая экономика', pct(c.shadowEconomy), 'shadow-economy'),
    kvK('Счастье', pctRaw(c.happiness), 'happiness'),
    kvK('Одобрение', pctRaw(c.approval), 'soc-approval'),
    kvK('Недовольство', pctRaw(c.discontent), 'soc-discontent'),
    bar(c.approval, c.approval > 50 ? 'green' : 'red'),
  );

  const freedoms = card2('Права и свободы', null,
    kvK('Свобода прессы', pctRaw(c.pressFreedom), 'soc-press-freedom'),
    kvK('Права человека', pctRaw(c.humanRights), 'human-rights'),
    kvK('Права меньшинств', pctRaw(c.minorityRights), 'minority-rights'),
    kvK('Независимость судов', pctRaw(c.judicialIndependence), 'soc-judicial'),
    kvK('Коррупция', pctRaw(c.corruption), 'soc-corruption'),
    kvK('Индекс демократии', computeDemocracy(c) + ' / 100', 'democracy'),
    kvK('ИЧР', computeHDI(c).toFixed(2), 'hdi'),
    kvK('Экономическая свобода', computeEconomicFreedom(c) + ' / 100', 'econ-freedom'),
  );

  // ============================================================
  // v3.14: ПРАВО И ПОРЯДОК
  // ============================================================
  const lawOrder = card2('⚖️ Право и порядок', Math.round(c.ruleOfLaw ?? 50) + ' / 100',
    kvK('Верховенство права', pctRaw(c.ruleOfLaw ?? 50), 'soc-rule-of-law'),
    bar(c.ruleOfLaw ?? 50, (c.ruleOfLaw ?? 50) > 60 ? 'green' : (c.ruleOfLaw ?? 50) > 40 ? 'gold' : 'red'),
    kvK('Независимость судов', pctRaw(c.judicialIndependence), 'soc-judicial-2'),
    kvK('Коррупция', pctRaw(c.corruption), 'soc-corruption-2'),
    kvK('Преступность', pctRaw(c.crimeRate), 'soc-crime-2'),

    el('div', { class: 'mt-12' },
      el('div', { class: 'lr-sub', style: { marginBottom: '4px' } }, 'Финансирование полиции'),
            slider('Доля ВВП на полицию', (c.policeFunding ?? 0.008) * 100, 5,
        (v) => act(engine, () => setPoliceFunding(c, v / 100), () => net.setPoliceFunding(v / 100),
          { type: 'police', text: `Финансирование полиции: ${(v).toFixed(2)}% ВВП` }),
        v => (v).toFixed(2) + '% ВВП'),
    ),

    el('div', { class: 'mt-12' },
      el('div', { class: 'lr-sub', style: { marginBottom: '4px' } }, 'Реформа судов'),
            slider('Независимость судов', c.judicialIndependence ?? 50, 100,
        (v) => act(engine, () => setJudicialReform(c, v), () => net.setJudicialReform(v),
          { type: 'judicial', text: `Реформа судов: ${Math.round(v)}/100` }),
        v => Math.round(v) + ' / 100'),
    ),

    el('div', { class: 'flex gap-8 wrap mt-12' },
            el('button', { class: 'btn small primary', onclick: () => {
        act(engine, () => launchAntiCorruption(c), () => net.launchAntiCorruption(),
          { type: 'corruption', text: 'Антикоррупционная кампания', kind: 'good' });
      } }, '🧹 Антикоррупционная кампания'),
    ),
    el('div', { class: 'mt-8 muted small' },
      'Кампания стоит денег, снижает коррупцию и повышает верховенство права.'),
  );

  // ============================================================
  // v3.14: ПРОТЕСТЫ И ЗАБАСТОВКИ
  // ============================================================
  const protests = c.protests || [];
  const strikes = c.strikes || [];

  const protestRows = protests.length ? protests.map(p => el('div', { class: 'list-row', style: { flexDirection: 'column', alignItems: 'stretch', gap: '6px', padding: '6px 0' } },
    el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', width: '100%' } },
      el('span', { class: 'badge warn' }, `⚠️ ${Math.round(p.scale)}`),
      el('div', { style: { flex: 1 } },
        el('div', { class: 'lr-name' }, `Протест: ${p.cause}`),
        el('div', { class: 'lr-sub' }, `${p.region} · осталось ${p.daysLeft} дн.`)
      )
    ),
    el('div', { class: 'flex gap-8 wrap' },
            el('button', { class: 'btn small primary', onclick: () => {
        act(engine, () => protestAction(c, p.id, 'concede'), () => net.protestAction(p.id, 'concede'),
          { type: 'protest', text: `Протест (${p.cause}): уступить`, kind: 'good' });
      } }, '🤝 Уступить'),
      el('button', { class: 'btn small danger', onclick: () => {
        act(engine, () => protestAction(c, p.id, 'repress'), () => net.protestAction(p.id, 'repress'),
          { type: 'protest', text: `Протест (${p.cause}): разогнать`, kind: 'bad' });
      } }, '🚫 Разогнать'),
    )
  )) : [el('div', { class: 'empty' }, 'Активных протестов нет')];

  const strikeRows = strikes.length ? strikes.map(s => el('div', { class: 'list-row', style: { flexDirection: 'column', alignItems: 'stretch', gap: '6px', padding: '6px 0' } },
    el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', width: '100%' } },
      el('span', { class: 'badge bad' }, `✊ ${Math.round(s.scale)}`),
      el('div', { style: { flex: 1 } },
        el('div', { class: 'lr-name' }, `Забастовка: ${s.sector}`),
        el('div', { class: 'lr-sub' }, `осталось ${s.daysLeft} дн.`)
      )
    ),
    el('div', { class: 'flex gap-8 wrap' },
           el('button', { class: 'btn small primary', onclick: () => {
        act(engine, () => strikeAction(c, s.id, 'negotiate'), () => net.strikeAction(s.id, 'negotiate'),
          { type: 'strike', text: `Забастовка (${s.sector}): договориться`, kind: 'good' });
      } }, '🤝 Договориться'),
      el('button', { class: 'btn small danger', onclick: () => {
        act(engine, () => strikeAction(c, s.id, 'break'), () => net.strikeAction(s.id, 'break'),
          { type: 'strike', text: `Забастовка (${s.sector}): сломать`, kind: 'bad' });
      } }, '🔨 Сломать'),
    )
  )) : [el('div', { class: 'empty' }, 'Активных забастовок нет')];

  const unrest = card2('✊ Протесты и забастовки',
    `${protests.length} / ${strikes.length}`,
    el('div', { class: 'lr-sub', style: { marginBottom: '4px' } }, 'Протесты:'),
    ...protestRows,
    el('div', { class: 'lr-sub', style: { marginTop: '12px', marginBottom: '4px' } }, 'Забастовки:'),
    ...strikeRows,
    el('div', { class: 'mt-8 muted small' },
      'Протесты растут при недовольстве > 55 и стабильности < 55. Забастовки — при нелояльных профсоюзах.'),
  );

  // ============================================================
  // v3.14: РЕГИОНАЛЬНОЕ САМОУПРАВЛЕНИЕ
  // ============================================================
  const autonomy = c.localAutonomy ?? 50;
  const autonomyLabel = autonomy >= 70 ? 'Децентрализация'
    : autonomy <= 30 ? 'Централизация'
    : 'Умеренная автономия';
  const autonomyColor = (autonomy >= 70 || autonomy <= 30) ? 'gold' : 'green';

  const regions = card2('🗺️ Региональное самоуправление', autonomyLabel,
    kvK('Уровень автономии', Math.round(autonomy) + ' / 100', 'soc-local-autonomy'),
    bar(autonomy, autonomyColor),
        slider('Автономия регионов', autonomy, 100,
      (v) => act(engine, () => setLocalAutonomy(c, v), () => net.setLocalAutonomy(v),
        { type: 'autonomy', text: `Автономия регионов: ${Math.round(v)}/100` }),
      v => Math.round(v) + ' / 100'),
    el('div', { class: 'mt-8 muted small' },
      autonomy >= 70
        ? 'Децентрализация снижает коррупцию, но ослабляет вертикаль власти.'
        : autonomy <= 30
          ? 'Централизация усиливает контроль, но повышает коррупцию.'
          : 'Умеренная автономия — баланс стабильности и эффективности.'),
    el('div', { class: 'mt-8 muted small' },
      'Крайности (полная централизация/автономия) снижают политическую стабильность.'),
  );

  const allAssoc = c.associations || [];
  const activeAssoc = allAssoc.filter(a => !a.banned);
  const bannedAssoc = allAssoc.filter(a => a.banned);

  const assocCard = card2('Гражданские ассоциации', `${activeAssoc.length} активных`,
    ...(activeAssoc.length ? activeAssoc.map(a => {
      const type = ASSOCIATION_TYPES[a.type] || {};
      return el('div', { class: 'list-row', style: { flexDirection: 'column', alignItems: 'flex-start', gap: '6px' } },
        el('div', { style: { display: 'flex', gap: '10px', width: '100%', alignItems: 'flex-start' } },
          el('span', { class: 'dot', style: { background: a.color } }),
          el('div', { style: { flex: 1 } },
            el('div', { class: 'lr-name' }, a.name),
            el('div', { class: 'lr-sub' }, `${type.desc || ''} · ${Math.round((a.members || 0) / 1000)} тыс. · влияние ${Math.round(a.influence || 0)}`)
          ),
          a.official ? el('span', { class: 'badge info' }, '✓') : null
        ),
        el('div', { class: 'flex gap-8 wrap', style: { width: '100%' } },
          el('button', { class: 'btn small', onclick: () => act(engine, () => assocAction(c, a.id, 'register'), () => net.assocAction(a.id, 'register')) }, a.official ? '✓ Зарег.' : 'Регистрация'),
          el('button', { class: 'btn small', onclick: () => act(engine, () => assocAction(c, a.id, 'subsidize'), () => net.assocAction(a.id, 'subsidize')) }, '$ 0.03'),
          el('button', { class: 'btn small danger', onclick: () => act(engine, () => assocAction(c, a.id, 'ban'), () => net.assocAction(a.id, 'ban')) }, 'Запретить')
        )
      );
    }) : [el('div', { class: 'empty' }, 'Нет ассоциаций')]),
    bannedAssoc.length ? el('div', { class: 'mt-12 muted small' },
      `Запрещено: ${bannedAssoc.length} (${bannedAssoc.map(a => a.name).join(', ')})`
    ) : null
  );

  return el('div', { class: 'grid cols-2' },
    demo, edu, social, freedoms,
    lawOrder, unrest, regions,
    assocCard,
  );
}

// ============================================================
// ДИПЛОМАТИЯ
// ============================================================
function viewDiplomacy(engine, c) {
  const others = (engine.world.countries || []).filter(o => o.id !== c.id);

  const filters = [
    { id: 'all', name: '🌐 Все', fn: () => true },
    { id: 'allies', name: '🤝 Союзники', fn: o => (c.alliances || []).includes(o.id) },
    { id: 'enemies', name: '💀 Враги', fn: o => getRelation(c, o) < -50 },
    { id: 'war', name: '⚔️ Война', fn: o => (c.wars || []).includes(o.id) },
    { id: 'sanctions', name: '🚫 Санкции', fn: o => (c.sanctions || []).some(s => s.against === o.id) },
  ];

  const summary = card2('Дипломатическая сводка', null,
    kvK('Всего государств', others.length),
    kvK('Союзников', (c.alliances || []).length, 'diplo-allies'),
    kvK('Договоров', (c.treaties || []).length, 'diplo-treaties'),
    kvK('Войн', (c.wars || []).length, 'diplo-wars'),
    kv('Санкций против нас', others.filter(o => (o.sanctions || []).some(s => s.against === c.id)).length),
    kvK('Посольств', Object.keys(c.embassies || {}).length, 'diplo-embassies'),
    kvK('Военных баз', (c.bases || []).length, 'diplo-bases'),
    kvK('Репутация', Math.round(c.reputation || 0) + ' / 100', 'diplo-reputation'),
    kvK('Влияние', Math.round(c.influence || 0) + ' / 100', 'diplo-influence'),
    el('div', { class: 'mt-12 flex gap-8 wrap' },
      ...filters.map(f => el('button', {
        class: 'btn small', dataset: { filter: f.id },
        onclick: (e) => {
          const target = e.currentTarget;
          document.querySelectorAll('.diplo-country').forEach(elm => {
            const oid = elm.dataset.countryId;
            const country = engine.getCountry(oid);
            elm.style.display = (country && f.fn(country)) ? '' : 'none';
          });
          document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('primary'));
          target.classList.add('primary');
        }
      }, f.name))
    )
  );

  const rows = others.map(o => {
    const rel = getRelation(c, o);
    const level = getRelationLevel(rel);
    const inAlliance = (c.alliances || []).includes(o.id);
    const inWar = (c.wars || []).includes(o.id);
    const sanctions = (c.sanctions || []).some(s => s.against === o.id);
    const embassy = c.embassies?.[o.id];
    const treaties = getTreaties(c, o);

    return el('div', { class: 'diplo-country list-row', dataset: { countryId: o.id }, style: { flexDirection: 'column', alignItems: 'stretch', gap: '8px' } },
      el('div', { style: { display: 'flex', gap: '10px', width: '100%', alignItems: 'center' } },
        flagBox(o, 'flag-box'),
        el('div', { style: { flex: 1 } },
          el('div', { class: 'lr-name' }, o.name),
          el('div', { class: 'lr-sub' },
            `${level.icon} ${level.name} · ${Math.round(rel)} · ` +
            `${inWar ? '⚔️ война' : inAlliance ? '🤝 союз' : embassy ? `🏛 ${DIPLOMATIC_RANKS[embassy.rank]?.name || 'посольство'}` : '—'}` +
            (sanctions ? ' · 🚫 санкции' : '')
          )
        ),
        el('div', { style: { textAlign: 'right', minWidth: '110px' } },
          el('div', { class: 'lr-name', style: { color: level.color } }, Math.round(rel)),
          el('div', { class: 'lr-sub' }, `${treaties.length} договоров`)
        )
      ),
      el('div', { class: 'flex gap-8 wrap', style: { width: '100%' } },
        el('button', { class: 'btn small', onclick: () => openDiplomacyModal(engine, c, o) }, '📜 Действия'),
        el('button', { class: 'btn small', onclick: () => act(engine, () => improveRelations(c, o), () => net.improveRelations(o.id)) }, '🌱 +8'),
        el('button', { class: 'btn small', onclick: () => act(engine, () => holdSummit(c, o), () => net.holdSummit(o.id)) }, '🤝 Саммит'),
        inWar
          ? el('button', { class: 'btn small primary', onclick: () => act(engine, () => makePeace(c, o, engine), () => net.makePeace(o.id)) }, '🕊️ Мир')
          : el('button', { class: 'btn small danger', onclick: () => {
              openModal(
                'Объявить войну',
                [el('p', {}, `Объявить войну ${o.shortName}?`)],
                [{ label: '⚔️ Объявить', primary: true, onClick: () => {
                  act(engine, () => declareWar(c, o, engine), () => net.declareWar(o.id));
                } }]
              );
            } }, '⚔️ Война')
      )
    );
  });

  return el('div', { class: 'grid' },
    summary,
    card2('Международные отношения', null, ...rows),
  );
}

function openDiplomacyModal(engine, c, o) {
  const modal = document.getElementById('event-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const rel = getRelation(c, o);
  const level = getRelationLevel(rel);
  const treaties = getTreaties(c, o);
  const embassy = c.embassies?.[o.id];
  const closeModal = () => modal.classList.add('hidden');

  const buildMainContent = () => el('div', { class: 'modal-card', style: { maxHeight: '90vh', overflowY: 'auto' } },
    el('h2', {}, o.name),
    el('p', {}, `${level.icon} ${level.name} · ${Math.round(rel)} · Влияние ${Math.round(o.influence || 0)} · ВВП $ ${num(o.gdp)} млрд`),

    el('div', { class: 'mb-12' },
      el('h3', { style: { fontSize: '12px', marginBottom: '8px', color: 'var(--muted)' } }, '📜 ДОГОВОРЫ'),
      ...Object.entries(TREATY_TYPES).map(([id, t]) => {
        const has = hasTreaty(c, o, id);
        return el('div', { class: 'list-row', style: { padding: '5px 0', fontSize: '12px' } },
          el('div', {},
            el('div', {}, t.name),
            el('div', { class: 'lr-sub' }, `${t.desc} · нужно ${t.minRel}, $${t.cost}`)
          ),
          has
            ? el('button', { class: 'btn small danger', onclick: () => {
                act(engine, () => breakTreaty(c, o, id, engine), () => net.breakTreaty(o.id, id));
              } }, 'Разорвать')
            : el('button', { class: 'btn small primary', onclick: () => {
                act(engine, () => signTreaty(c, o, id, engine), () => net.signTreaty(o.id, id));
              } }, 'Подписать')
        );
      })
    ),

    el('div', { class: 'mb-12' },
      el('h3', { style: { fontSize: '12px', marginBottom: '8px', color: 'var(--muted)' } }, '🏛 ПОСОЛЬСТВО'),
      embassy
        ? el('div', {},
            el('div', { class: 'mb-8' }, `Ранг: ${DIPLOMATIC_RANKS[embassy.rank]?.name}`),
            el('div', { class: 'flex gap-8 wrap' },
              ...Object.entries(DIPLOMATIC_RANKS).filter(([k]) => k !== 'none').map(([k, r]) =>
                el('button', { class: 'btn small' + (embassy.rank === k ? ' primary' : ''), onclick: () => {
                  act(engine, () => setRank(c, o, k), () => net.setRank(o.id, k));
                } }, r.name)
              ),
              el('button', { class: 'btn small danger', onclick: () => {
                act(engine, () => closeEmbassy(c, o), () => net.closeEmbassy(o.id));
              } }, 'Закрыть')
            )
          )
        : el('button', { class: 'btn small primary', onclick: () => {
            act(engine, () => openEmbassy(c, o), () => net.openEmbassy(o.id));
          } }, 'Открыть посольство')
    ),

    el('div', { class: 'mb-12' },
      el('h3', { style: { fontSize: '12px', marginBottom: '8px', color: 'var(--muted)' } }, '🕵️ РАЗВЕДКА'),
      ...Object.entries(ESPIONAGE_OPS).map(([id, op]) =>
        el('div', { class: 'list-row', style: { padding: '5px 0', fontSize: '12px' } },
          el('div', {},
            el('div', {}, op.name),
            el('div', { class: 'lr-sub' }, `${op.desc} · $${op.cost} · риск ${Math.round(op.risk * 100)}%`)
          ),
          el('button', { class: 'btn small', onclick: () => {
            act(engine, () => conductEspionage(c, o, id, engine), () => net.conductEspionage(o.id, id));
          } }, 'Запуск')
        )
      )
    ),

    el('div', { class: 'mb-12 flex gap-8 wrap' },
      el('button', { class: 'btn small', onclick: () => {
        openAidModal(engine, c, o);
      } }, '💰 Экономпомощь'),
      el('button', { class: 'btn small', onclick: () => act(engine, () => sendMilitaryAid(c, o, engine), () => net.sendMilitaryAid(o.id)) }, '⚔️ Военпомощь'),
      el('button', { class: 'btn small', onclick: () => act(engine, () => jointExercise(c, o, engine), () => net.jointExercise(o.id)) }, '🎖️ Учения'),
      el('button', { class: 'btn small', onclick: () => act(engine, () => propaganda(c, o, 'soft', engine), () => net.propaganda(o.id, 'soft')) }, '📣 Мягк. проп.'),
      el('button', { class: 'btn small danger', onclick: () => act(engine, () => propaganda(c, o, 'hard', engine), () => net.propaganda(o.id, 'hard')) }, '📢 Жёстк. проп.')
    ),

    el('div', { class: 'flex gap-8 wrap' },
      (c.sanctions || []).some(s => s.against === o.id)
        ? el('button', { class: 'btn small', onclick: () => act(engine, () => liftSanctions(c, o, engine), () => net.liftSanctions(o.id)) }, '✅ Снять санкции')
        : el('button', { class: 'btn small danger', onclick: () => act(engine, () => imposeSanctions(c, o, engine), () => net.imposeSanctions(o.id)) }, '🚫 Санкции'),
      el('button', { class: 'btn small danger', onclick: () => {
        const demands = [
          { id: 'reparations', label: 'Репарации', sub: '−$0.20 млрд из казны цели' },
          { id: 'territory',   label: 'Территория', sub: '−5% площади цели' },
          { id: 'trade',       label: 'Торговые уступки', sub: '+10% экспорта цели' },
          { id: 'disarm',      label: 'Разоружение', sub: '−20% армии цели' },
        ];
        openModal(
          `Ультиматум ${o.shortName}`,
          [el('p', { class: 'muted small' }, 'Отношения должны быть ≤ 10. Цель согласится, если вы сильнее в 1.5 раза.')],
          demands.map(d => ({
            label: d.label,
            danger: true,
            onClick: () => {
              act(engine, () => issueUltimatum(c, o, d.id, engine), () => net.issueUltimatum(o.id, d.id));
            }
          }))
        );
      } }, '⚠️ Ультиматум'),
      (c.wars || []).includes(o.id)
        ? el('button', { class: 'btn small primary', onclick: () => act(engine, () => makePeace(c, o, engine), () => net.makePeace(o.id)) }, '🕊️ Мир')
        : el('button', { class: 'btn small danger', onclick: () => {
            openModal(
              'Объявить войну',
              [el('p', {}, `Объявить войну ${o.shortName}?`)],
              [{ label: '⚔️ Объявить', primary: true, onClick: () => {
                act(engine, () => declareWar(c, o, engine), () => net.declareWar(o.id));
              } }]
            );
          } }, '⚔️ Война')
    ),

    el('div', { class: 'mt-16 flex gap-8 wrap' },
      el('button', { class: 'btn small primary', onclick: closeModal }, 'Закрыть')
    )
  );

  mount(modal, buildMainContent());

  // FIX: отдельная функция для открытия модалки помощи
  function openAidModal(engine2, c2, o2) {
    let amount = 0.05;
    const sliderEl = slider('Сумма ($ млрд)', 0.05, 0.5,
      (v) => { amount = v; },
      (v) => '$ ' + v.toFixed(2) + ' млрд'
    );

    mount(modal,
      el('div', { class: 'modal-card' },
        el('h2', {}, `Помощь ${o2.shortName}`),
        el('p', { class: 'muted small' }, `Казна: $ ${num(c2.treasury)} млрд`),
        el('div', { class: 'modal-choices' }, sliderEl),
        el('div', { class: 'mt-16 flex gap-8' },
          el('button', { class: 'btn small primary', onclick: () => {
            act(engine2, () => sendAid(c2, o2, amount, engine2), () => net.sendAid(o2.id, amount));
            mount(modal, buildMainContent());
          } }, 'Отправить'),
          el('button', { class: 'btn small', onclick: () => {
            mount(modal, buildMainContent());
          } }, 'Отмена')
        )
      )
    );
  }
}

// ============================================================
// АРМИЯ
// ============================================================
function viewMilitary(engine, c) {
  const m = c.military || { personnel: 0, industry: 0, readiness: 0, mobilization: 0, budgetShare: 0 };
  const totalMil = (c.spending?.military || 0) * c.gdp;
  return el('div', { class: 'grid cols-2' },
    card2('Вооружённые силы', null,
      kvK('Численность', int(m.personnel), 'mil-personnel'),
      kvK('Военный бюджет', '$ ' + num(totalMil) + ' млрд', 'mil-budget'),
      kvK('Доля от ВВП', pct(c.spending?.military || 0), 'mil-share'),
      kvK('Оборонная промышленность', pctRaw(m.industry), 'mil-industry'),
      kvK('Боеготовность', pctRaw(m.readiness), 'mil-readiness'),
      kvK('Мобилизационный потенциал', pctRaw(m.mobilization), 'mil-mobilization'),
      kvK('Военная мощь', computeMilitaryPower(c) + ' / 100', 'mil-power'),
      el('div', { class: 'bar red' }, el('i', { 'data-bar': 'mil-readiness-bar', style: { width: `${m.readiness}%` } })),
    ),
    card2('Оборонная политика', null,
      slider('Военные расходы (ВВП)', c.spending?.military || 0, 0.30,
        (v) => act(engine, () => setSpending(c, 'military', v), () => net.setSpending('military', v)),
        v => pct(v)),
      kv('Всеобщая воинская обязанность', (c.laws || []).includes('conscription') ? 'Да' : 'Нет'),
      kv('ВПК развит', (c.laws || []).includes('military_industry') ? 'Да' : 'Нет'),
      el('div', { class: 'mt-12 muted small' }, 'Военная мощь влияет на глобальное влияние, но не является единственным путём к величию.'),
    ),
  );
}

// ============================================================
// СТАТИСТИКА
// ============================================================
function viewStats(engine, c) {
  const ranks = computeRankings(engine.world);

  const mk = (title, arr, fmt, opts = {}) => {
    const { limit = 10, unit = '' } = opts;
    if (!arr || !arr.length) {
      return card2(title, unit || null, el('div', { class: 'empty' }, 'Нет данных'));
    }
    const myIdx = arr.findIndex(x => x.id === c.id);
    const myRank = myIdx + 1;
    const top = arr.slice(0, limit);
    const inTop = myIdx >= 0 && myIdx < limit;

    return card2(title, unit || null,
      el('table', { class: 'mini-table' },
        el('thead', {}, el('tr', {},
          el('th', {}, '#'),
          el('th', {}, 'Государство'),
          el('th', { class: 'text-right' }, 'Значение')
        )),
        el('tbody', {}, ...top.map((r, i) =>
          el('tr', { class: r.id === c.id ? 'me' : '' },
            el('td', {}, i + 1),
            el('td', {}, r.name),
            el('td', { class: 'text-right font-600' }, fmt(r.value))
          )
        ))
      ),
      (!inTop && myRank > 0) ? el('div', { class: 'mt-8 muted small' },
        `Ваша позиция: #${myRank} из ${arr.length} (${fmt(arr[myIdx]?.value || 0)})`
      ) : null
    );
  };

  const safeAvg = (arr) => (arr && arr.length ? arr.reduce((a, b) => a + b.value, 0) / arr.length : 0);

  const avgGdp = safeAvg(ranks.gdpPerCapita);
  const avgLife = safeAvg(ranks.lifeExpectancy);
  const avgHDI = safeAvg(ranks.hdi);

  const findRank = (arr) => (arr ? arr.findIndex(x => x.id === c.id) + 1 : 0);

  const myGdpRank = findRank(ranks.gdpPerCapita);
  const myPopRank = findRank(ranks.population);
  const myAreaRank = findRank(ranks.area);
  const myMilRank = findRank(ranks.militaryPower);
  const myInfRank = findRank(ranks.influence);
  const myHDIRank = findRank(ranks.hdi);
  const myDemRank = findRank(ranks.democracy);

  const worldPosition = card2('Позиция в мире', null,
    kv('🌍 Площадь', `#${myAreaRank || '—'} / ${ranks.area?.length || 0}`),
    kv('👥 Население', `#${myPopRank || '—'} / ${ranks.population?.length || 0}`),
    kv('💰 ВВП', `#${findRank(ranks.gdp) || '—'} / ${ranks.gdp?.length || 0}`),
    kv('📈 ВВП на душу', `#${myGdpRank || '—'} / ${ranks.gdpPerCapita?.length || 0}`),
    kv('⚔️ Военная мощь', `#${myMilRank || '—'} / ${ranks.militaryPower?.length || 0}`),
    kv('🌐 Влияние', `#${myInfRank || '—'} / ${ranks.influence?.length || 0}`),
    kv('❤️ ИЧР', `#${myHDIRank || '—'} / ${ranks.hdi?.length || 0}`),
    kv('🗳 Демократия', `#${myDemRank || '—'} / ${ranks.democracy?.length || 0}`),
  );

  const comparisonCard = card2('Сравнение со средним', null,
    kv('ВВП на душу vs среднее',
      ((c.gdpPerCapita || 0) >= avgGdp ? '▲ +' : '▼ −') +
      Math.abs(((c.gdpPerCapita || 0) / Math.max(avgGdp, 1) - 1) * 100).toFixed(0) + '%'),
    kv('Ожидаемая жизнь vs среднее',
      ((c.lifeExpectancy || 0) >= avgLife ? '▲ +' : '▼ −') +
      Math.abs((c.lifeExpectancy || 0) - avgLife).toFixed(1) + ' лет'),
    kv('ИЧР vs среднее',
      ((computeHDI(c) || 0) >= avgHDI ? '▲ +' : '▼ −') +
      Math.abs((computeHDI(c) || 0) - avgHDI).toFixed(2)),
    kv('Средний ВВП на душу в мире', '$ ' + num(avgGdp)),
    kv('Средняя жизнь в мире', avgLife.toFixed(1) + ' лет'),
    kv('Средний ИЧР в мире', avgHDI.toFixed(2)),
  );

  const myMetrics = card2('Мои показатели', null,
    kv('Площадь', int(c.area) + ' км²'),
    kv('Плотность', (c.area > 0 ? (c.population / c.area).toFixed(1) : '0') + ' чел/км²'),
    kv('Население', int(c.population)),
    kv('ВВП', '$ ' + num(c.gdp) + ' млрд'),
    kv('ВВП на душу', '$ ' + num(c.gdpPerCapita)),
    kv('ИЧР', computeHDI(c).toFixed(2)),
    kv('Индекс демократии', computeDemocracy(c) + ' / 100'),
    kv('Экономическая свобода', computeEconomicFreedom(c) + ' / 100'),
    kv('Военная мощь', computeMilitaryPower(c) + ' / 100'),
    kv('Влияние', Math.round(c.influence || 0) + ' / 100'),
  );

  return el('div', { class: 'grid' },
    el('div', { class: 'grid cols-2' }, worldPosition, comparisonCard),
    myMetrics,
    el('div', { class: 'grid cols-3' },
      mk('🌍 Площадь', ranks.area, v => int(v) + ' км²', { unit: 'км²' }),
      mk('👥 Население', ranks.population, v => num(v)),
      mk('🏙 Плотность', ranks.density, v => v.toFixed(1) + ' /км²', { unit: 'чел/км²' }),
    ),
    el('div', { class: 'grid cols-3' },
      mk('💰 ВВП', ranks.gdp, v => '$ ' + num(v) + ' млрд'),
      mk('📈 ВВП на душу', ranks.gdpPerCapita, v => '$ ' + num(v)),
      mk('📊 Рост ВВП (год)', ranks.gdpGrowth, v => (v >= 0 ? '+' : '') + v.toFixed(1) + '%', { unit: '%' }),
    ),
    el('div', { class: 'grid cols-3' },
      mk('❤️ ИЧР', ranks.hdi, v => v.toFixed(2)),
      mk('🎓 Образование', ranks.education, v => Math.round(v)),
      mk('🏥 Здравоохранение', ranks.healthcare, v => Math.round(v)),
    ),
    el('div', { class: 'grid cols-3' },
      mk('⏳ Ожидаемая жизнь', ranks.lifeExpectancy, v => v.toFixed(1) + ' лет', { unit: 'лет' }),
      mk('😊 Счастье', ranks.happiness, v => Math.round(v)),
      mk('📉 Бедность', ranks.poverty, v => v.toFixed(1) + '%', { unit: '%' }),
    ),
    el('div', { class: 'grid cols-3' },
      mk('🗳 Демократия', ranks.democracy, v => Math.round(v)),
      mk('📰 Свобода прессы', ranks.pressFreedom, v => Math.round(v)),
      mk('🛡 Низкая коррупция', ranks.corruption, v => Math.round(-v)),
    ),
    el('div', { class: 'grid cols-3' },
      mk('⚔️ Военная мощь', ranks.militaryPower, v => Math.round(v) + ' / 100'),
      mk('🎖 Численность армии', ranks.military, v => int(v)),
      mk('💣 Военный бюджет', ranks.militaryBudget, v => '$ ' + num(v) + ' млрд'),
    ),
    el('div', { class: 'grid cols-3' },
      mk('🌐 Влияние', ranks.influence, v => Math.round(v)),
      mk('⭐ Репутация', ranks.reputation, v => Math.round(v)),
      mk('💵 Экономическая свобода', ranks.economicFreedom, v => Math.round(v) + ' / 100'),
    ),
  );
}

// ============================================================
// НОВОСТИ
// ============================================================
function viewNews(engine) {
  const items = visibleNews(engine);

  const groups = [];
  let currentDate = null;
  for (const n of items) {
    const d = n.date ? `${n.date.year}-${n.date.month}-${n.date.day}` : '—';
    if (d !== currentDate) {
      currentDate = d;
      groups.push({ date: n.date, items: [] });
    }
    groups[groups.length - 1].items.push(n);
  }

  return el('div', { class: 'grid' },
    card2('📰 Лента событий', `${items.length} событий`,
      ...(groups.length ? groups.map((g, gi) => el('div', { class: 'news-group' },
        el('div', { class: 'news-group-date' }, dateStr(g.date)),
        ...g.items.map(n => el('div', {
          class: `news-item ${n.kind === 'good' ? 'ev-good' : n.kind === 'bad' ? 'ev-bad' : ''} ${gi === 0 ? 'news-fresh' : ''}`
        },
          el('div', { class: 'ni-tag' }, n.tag),
          el('div', {}, n.text)
        ))
      )) : [el('div', { class: 'empty' }, 'Событий пока нет')])
    )
  );
}

// ============================================================
// ДИАГРАММА ПАРЛАМЕНТА
// ============================================================
function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[ch]));
}

function parliamentChart(c) {
  const W = 520, H = 340;
  const cx = W / 2, cy = H - 60;
  const rOuter = 230;
  const rInner = 90;

  const total = c.seatsTotal || 100;
  const parties = [...(c.parties || [])]
    .filter(p => p.seats > 0)
    .sort((a, b) => (a.spectrum ?? 0) - (b.spectrum ?? 0));

  let layout = null;
  for (let rows = 3; rows <= 6 && !layout; rows++) {
    for (let seatSize = 14; seatSize >= 4; seatSize -= 0.5) {
      const rowRadii = [];
      for (let i = 0; i < rows; i++) {
        rowRadii.push(rOuter - (rOuter - rInner) * i / (rows - 1));
      }
      const seatsPerRow = rowRadii.map(r => Math.floor(Math.PI * r / (seatSize * 1.6)));
      const capacity = seatsPerRow.reduce((a, b) => a + b, 0);
      if (capacity >= total) {
        layout = { rows, rowRadii, seatSize, seatsPerRow };
        break;
      }
    }
  }
  if (!layout) {
    layout = { rows: 1, rowRadii: [rOuter], seatSize: 8, seatsPerRow: [total] };
  }

  const positions = [];
  for (let row = 0; row < layout.rows; row++) {
    const r = layout.rowRadii[row];
    const n = layout.seatsPerRow[row];
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0.5;
      const angle = Math.PI * (1 - t);
      positions.push({ angle, radius: r });
    }
  }
  positions.sort((a, b) => b.angle - a.angle);
  const seats = positions.slice(0, total);

  const seatsWithParty = [];
  let idx = 0;
  for (const p of parties) {
    const isCoalition = (c.coalition || []).includes(p.id);
    const isPlayerParty = p.id === c.playerPartyId;
    for (let i = 0; i < p.seats && idx < total; i++) {
      seatsWithParty.push({ party: p, isCoalition, isPlayerParty });
      idx++;
    }
  }

  const circles = seats.map((s, i) => {
    const info = seatsWithParty[i] || { party: parties[0] || {}, isCoalition: false, isPlayerParty: false };
    const x = cx + s.radius * Math.cos(s.angle);
    const y = cy - s.radius * Math.sin(s.angle);
    const fill = info.party.color || '#7a8fb5';
    const opacity = info.isCoalition ? 1 : 0.45;
    const rad = layout.seatSize * 0.5;
    const stroke = info.isPlayerParty ? '#e6b84c' : '#0b1020';
    const strokeWidth = info.isPlayerParty ? '1.5' : '0.5';
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="${fill}" opacity="${opacity}" stroke="${stroke}" stroke-width="${strokeWidth}">
      <title>${escapeXml(info.party.name || '')} · ${escapeXml(info.party.spectrumLabel || '')} · ${info.party.seats} мест</title>
    </circle>`;
  }).join('');

  let speakerSvg = '';
  if (c.speaker) {
    const sx = cx;
    const sy = cy - rOuter - 25;
    speakerSvg = `
      <circle cx="${sx}" cy="${sy}" r="15" fill="${c.speaker.color || '#e6b84c'}" stroke="#0b1020" stroke-width="2"/>
      <text x="${sx}" y="${sy + 5}" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">СП</text>
      <text x="${sx}" y="${sy + 32}" text-anchor="middle" fill="#e6b84c" font-size="10" font-weight="600">${escapeXml((c.speaker.name || '').split(' ')[0])}</text>
      <text x="${sx}" y="${sy + 46}" text-anchor="middle" fill="#8b97b8" font-size="9">Председатель</text>
    `;
  }

  const majorityLine = `<line x1="${cx}" y1="${cy - rOuter - 4}" x2="${cx}" y2="${cy - rOuter + 4}" stroke="#e6b84c" stroke-width="2" stroke-dasharray="2 2"/>`;

  const coalitionSeats = (c.parties || []).filter(p => (c.coalition || []).includes(p.id)).reduce((a, p) => a + p.seats, 0);
  const label = `
    <text x="${cx}" y="${cy - 30}" text-anchor="middle" fill="#f3d489" font-family="Georgia, serif" font-size="24" font-weight="700">${coalitionSeats}/${total}</text>
    <text x="${cx}" y="${cy - 12}" text-anchor="middle" fill="#8b97b8" font-size="10" letter-spacing="1.5">КОАЛИЦИЯ</text>
  `;

  const axisY = H - 15;
  const axisLeft = cx - rOuter;
  const axisRight = cx + rOuter;
  const axis = `
    <line x1="${axisLeft}" y1="${axisY}" x2="${axisRight}" y2="${axisY}" stroke="#3a4560" stroke-width="2"/>
    <text x="${axisLeft}" y="${axisY - 5}" text-anchor="start" fill="#e04b3a" font-size="10" font-weight="600">◀ Левые</text>
    <text x="${cx}" y="${axisY - 5}" text-anchor="middle" fill="#7a8fb5" font-size="10" font-weight="600">Центр</text>
    <text x="${axisRight}" y="${axisY - 5}" text-anchor="end" fill="#8a6a1f" font-size="10" font-weight="600">Правые ▶</text>
  `;

  return el('div', { class: 'parliament-chart-wrap' },
    el('div', { html: `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:520px;display:block;">${circles}${speakerSvg}${majorityLine}${label}${axis}</svg>` })
  );
}

// ============================================================
// НАЗВАНИЯ
// ============================================================
function govName(id) {
  const m = { republic:'Республика', federal_republic:'Федеративная республика', constitutional_monarchy:'Конституционная монархия', absolute_monarchy:'Абсолютная монархия', socialist_republic:'Социалистическая республика', theocracy:'Теократия', military_junta:'Военная хунта', dominion:'Доминион' };
  return m[id] || id;
}
function sysName(id) {
  const m = { presidential:'Президентская', parliamentary:'Парламентская', semi_presidential:'Смешанная', one_party:'Однопартийная', authoritarian:'Авторитарная' };
  return m[id] || id;
}
function ideoName(id) {
  const m = { liberal:'Либеральная', conservative:'Консервативная', social_democrat:'Социал-демократическая', socialist:'Социалистическая', communist:'Коммунистическая', nationalist:'Националистическая', centrist:'Центристская', monarchist:'Монархическая', agrarian:'Аграрная', libertarian:'Либертарианская' };
  return m[id] || id;
}

function cycleName(phase) {
  const m = {
    boom: '📈 Бум',
    recovery: '↗ Восстановление',
    recession: '↘ Рецессия',
    depression: '📉 Депрессия',
  };
  return m[phase] || '—';
}

// ============================================================
// МОДАЛКА СОБЫТИЙ
// ============================================================
export function openEventModal(engine, event) {
  const modal = document.getElementById('event-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  mount(modal,
    el('div', { class: 'modal-card' },
      el('h2', {}, event.title),
      el('p', {}, event.text),
      el('div', { class: 'modal-choices' },
        ...(event.choices || []).map(ch => el('button', { class: 'choice-btn',
          onclick: () => {
            resolveChoice(engine, event, ch);
            modal.classList.add('hidden');
            engine.notify();
          }
        }, ch.label, ch.sub ? el('small', {}, ch.sub) : null))
      )
    )
  );
}

export function isEventModalOpen() {
  const modal = document.getElementById('event-modal');
  return modal && !modal.classList.contains('hidden');
}
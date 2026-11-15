// ============================================================
// ОБРАБОТКА ДЕЙСТВИЙ ИГРОКОВ (v3.15, D+C)
// ============================================================
import { passLaw, proposeLaw, revokeLaw, castBillVote } from '../public/js/game/laws.js';
import { declareWar, makePeace, signTreaty, improveRelations,
         imposeSanctions, liftSanctions, sendAid, sendMilitaryAid,
         conductEspionage, propaganda, issueUltimatum, jointExercise,
         openEmbassy, closeEmbassy, setRank, breakTreaty,
         holdSummit } from '../public/js/game/diplomacy.js';
import { setTax, setSpending, setInterestRate, setGoldStandard,
         setBankReserveRatio, startProject, nationalize, privatize,
         setMinimumWage, setPensionAge, setPensionRate,
         devalueCurrency, revalueCurrency,
         setCbIndependence, setCbChairman } from '../public/js/game/economy.js';
// v3.14: внутренняя безопасность и правовая система
// v3.15: + logAction
import { setPoliceFunding, setJudicialReform, launchAntiCorruption,
         setLocalAutonomy, protestAction, strikeAction,
         logAction } from '../public/js/game/society.js';
import { fundParty, boostParty, changePartyLeader, createParty,
         dissolveParty, runParliamentaryElection,
         runPresidentialElection, formCoalition, impeachPresident,
         appointMinister, electSpeaker,
         getHeadOfState, POSITIONS,
         oppositionRally, oppositionScandal, callVoteOfNoConfidence,
         startConstitutionalCrisis, abortConstitutionalCrisis,
         registerParty, dismissGovernment,
         startReferendum, setPartyProgram } from '../public/js/game/politics.js';
import { startPresidentialCampaign, startParliamentaryCampaign,
         campaignAction, finishElection, cancelElection } from '../public/js/game/elections.js';
import { unionAction, assocAction } from '../public/js/game/groups.js';
import { amendPower } from '../public/js/game/constitution.js';
import { generateGovernmentBill, voteOnBill, parliamentBlockBill,
         presidentialVeto, initSenate, voteOnBillSenate,
         createCommittee, dissolveCommittee, strengthenDiscipline,
         accelerateBill, postponeBill, openSession, closeSession,
         createInterpellation, answerInterpellation } from '../public/js/game/parliament.js';

// ============================================================
// v3.15: ПРОВЕРКА ПРАВ
// ============================================================
const GOVERNMENT_ACTIONS = new Set([
  // экономика
  'setTax', 'setSpending', 'setInterestRate', 'setGoldStandard', 'setBankReserveRatio',
  'startProject', 'nationalize', 'privatize',
  'setMinimumWage', 'setPensionAge', 'setPensionRate', 'devalueCurrency', 'revalueCurrency',
  'setCbIndependence', 'setCbChairman',
  // внутренняя безопасность
  'setPoliceFunding', 'setJudicialReform', 'launchAntiCorruption', 'setLocalAutonomy',
  'protestAction', 'strikeAction',
  // законы
  'proposeLaw', 'passLaw', 'revokeLaw',
  // парламент
  'voteOnBill', 'parliamentBlockBill', 'presidentialVeto',
  'castBillVote', 'initSenate', 'voteOnBillSenate',
  'createCommittee', 'dissolveCommittee', 'strengthenDiscipline',
  'accelerateBill', 'postponeBill', 'openSession', 'closeSession',
  'createInterpellation', 'answerInterpellation',
  'generateGovernmentBill', 'electSpeaker',
  'runParliamentaryElection', 'runPresidentialElection',
  'formCoalition', 'impeachPresident', 'appointMinister',
  // правительство
  'dismissGovernment',
  // референдум
  'startReferendum',
  // кризис
  'startConstitutionalCrisis', 'abortConstitutionalCrisis',
  // выборы
  'startPresidentialCampaign', 'startParliamentaryCampaign',
  'campaignAction', 'finishElection', 'cancelElection',
  // конституция
  'amendPower',
  // дипломатия
  'improveRelations', 'holdSummit', 'signTreaty', 'breakTreaty',
  'declareWar', 'makePeace', 'sendAid', 'sendMilitaryAid',
  'conductEspionage', 'propaganda', 'imposeSanctions', 'liftSanctions',
  'issueUltimatum', 'jointExercise', 'openEmbassy', 'closeEmbassy', 'setRank',
]);

const OPPOSITION_ACTIONS = new Set([
  'oppositionRally', 'oppositionScandal', 'callVoteOfNoConfidence',
]);

function isGovernmentAction(type) {
  return GOVERNMENT_ACTIONS.has(type);
}

// FIX: нормализация возврата — если функция вернула void/false/массив,
// отдаём { ok: true }, чтобы клиент не падал на undefined.ok
function okOr(res, fallback = { ok: true }) {
  if (res === undefined || res === null) return fallback;
  if (typeof res === 'boolean') return { ok: res };
  if (typeof res === 'object' && !Array.isArray(res)) return res;
  return { ok: true };
}

export function handleAction(room, playerId, action) {
  if (!room || !room.engine) return { ok: false, reason: 'Игра не начата' };
  // FIX: guard от undefined/битого action
  if (!action || typeof action.type !== 'string') {
    return { ok: false, reason: 'Неверное действие' };
  }
  const { type } = action;
  const c = room.engine.getCountry(playerId);
  if (!c) return { ok: false, reason: 'Страна не найдена' };

  // v3.15: проверка прав — правительственные действия в оппозиции запрещены
  const inPower = c.playerInPower !== false;
  if (!inPower && isGovernmentAction(type)) {
    return { ok: false, reason: 'Вы не у власти. Действие доступно только правительству.' };
  }

  try {
    switch (type) {
      // === ЭКОНОМИКА ===
      case 'setTax': {
        setTax(c, action.key, action.value);
        logAction(c, 'tax', `Налог ${action.key}: ${(Number(action.value) * 100).toFixed(0)}%`);
        return { ok: true };
      }
      case 'setSpending': {
        setSpending(c, action.key, action.value);
        logAction(c, 'spending', `Расходы ${action.key}: ${(Number(action.value) * 100).toFixed(1)}% ВВП`);
        return { ok: true };
      }
      case 'setInterestRate': setInterestRate(c, action.value); return { ok: true };
      case 'setGoldStandard': setGoldStandard(c, action.value); return { ok: true };
      case 'setBankReserveRatio': setBankReserveRatio(c, action.value); return { ok: true };
      case 'startProject': {
        const r = okOr(startProject(c, action.projectId));
        if (r.ok) logAction(c, 'project', `Запущен проект: ${action.projectId}`);
        return r;
      }
      case 'nationalize': return okOr(nationalize(c));
      case 'privatize': return okOr(privatize(c));
      case 'setMinimumWage': return okOr(setMinimumWage(c, action.value));
      case 'setPensionAge': return okOr(setPensionAge(c, action.value));
      case 'setPensionRate': return okOr(setPensionRate(c, action.value));
      case 'devalueCurrency': return okOr(devalueCurrency(c, action.percent));
      case 'revalueCurrency': return okOr(revalueCurrency(c, action.percent));
      case 'setCbIndependence': return okOr(setCbIndependence(c, action.value));
      case 'setCbChairman': {
        const person = (c.politicians || []).find(p => p.id === action.personId);
        if (!person) return { ok: false, reason: 'Персонаж не найден' };
        return okOr(setCbChairman(c, person));
      }

      // === v3.14: ВНУТРЕННЯЯ БЕЗОПАСНОСТЬ И ПРАВОВАЯ СИСТЕМА ===
      case 'setPoliceFunding': {
        const r = okOr(setPoliceFunding(c, action.value));
        if (r.ok) logAction(c, 'police', `Финансирование полиции: ${(Number(action.value) * 100).toFixed(2)}% ВВП`);
        return r;
      }
      case 'setJudicialReform': {
        const r = okOr(setJudicialReform(c, action.value));
        if (r.ok) logAction(c, 'judicial', `Реформа судов: ${Math.round(Number(action.value))}/100`);
        return r;
      }
      case 'launchAntiCorruption': {
        const r = okOr(launchAntiCorruption(c));
        if (r.ok) logAction(c, 'corruption', 'Антикоррупционная кампания', 'good');
        return r;
      }
      case 'setLocalAutonomy': {
        const r = okOr(setLocalAutonomy(c, action.value));
        if (r.ok) logAction(c, 'autonomy', `Автономия регионов: ${Math.round(Number(action.value))}/100`);
        return r;
      }
      case 'protestAction': {
        const r = okOr(protestAction(c, action.id, action.action));
        if (r.ok) logAction(c, 'protest', `Протест: ${action.action}`, action.action === 'concede' ? 'good' : 'bad');
        return r;
      }
      case 'strikeAction': {
        const r = okOr(strikeAction(c, action.id, action.action));
        if (r.ok) logAction(c, 'strike', `Забастовка: ${action.action}`, action.action === 'negotiate' ? 'good' : 'bad');
        return r;
      }

      // === ЗАКОНЫ ===
      case 'proposeLaw': {
        const r = okOr(proposeLaw(c, action.lawId, room.engine));
        if (r.ok) logAction(c, 'law', `Внесён законопроект: ${action.lawId}`);
        return r;
      }
      case 'passLaw': {
        const r = okOr(passLaw(c, action.lawId));
        if (r.ok) logAction(c, 'law', `Принят закон: ${action.lawId}`, 'good');
        return r;
      }
      case 'revokeLaw': {
        const r = okOr(revokeLaw(c, action.lawId));
        if (r.ok) logAction(c, 'law', `Отменён закон: ${action.lawId}`, 'bad');
        return r;
      }

      // === ПАРЛАМЕНТ ===
      case 'voteOnBill': {
        const bill = (c.bills || []).find(b => b.id === action.billId);
        if (!bill) return { ok: false, reason: 'Билль не найден' };
        return okOr(voteOnBill(c, bill, room.engine));
      }
      case 'parliamentBlockBill': {
        const bill = (c.bills || []).find(b => b.id === action.billId);
        if (!bill) return { ok: false, reason: 'Билль не найден' };
        return okOr(parliamentBlockBill(c, bill, room.engine));
      }
      case 'presidentialVeto': {
        const bill = (c.bills || []).find(b => b.id === action.billId);
        if (!bill) return { ok: false, reason: 'Билль не найден' };
        return okOr(presidentialVeto(c, bill, room.engine));
      }

      // === v3.9: ИНТЕРАКТИВНОЕ ГОЛОСОВАНИЕ ===
      case 'castBillVote': {
        const bill = (c.bills || []).find(b => b.id === action.billId);
        if (!bill) return { ok: false, reason: 'Билль не найден' };
        return okOr(castBillVote(c, bill, action.vote, room.engine));
      }

      // === v3.11: СЕНАТ ===
      case 'initSenate': {
        initSenate(c);
        return { ok: true, senate: c.senate };
      }
      case 'voteOnBillSenate': {
        const bill = (c.bills || []).find(b => b.id === action.billId);
        if (!bill) return { ok: false, reason: 'Билль не найден' };
        return okOr(voteOnBillSenate(c, bill, room.engine));
      }

      // === v3.11: КОМИТЕТЫ ===
      case 'createCommittee': return okOr(createCommittee(c, action.typeId, action.chairmanId));
      case 'dissolveCommittee': return okOr(dissolveCommittee(c, action.typeId));

      // === v3.11: ФРАКЦИИ ===
      case 'strengthenDiscipline': return okOr(strengthenDiscipline(c, action.partyId));

      // === v3.11: ПОВЕСТКА ===
      case 'accelerateBill': return okOr(accelerateBill(c, action.billId, action.days));
      case 'postponeBill': return okOr(postponeBill(c, action.billId, action.days));

      // === v3.11: СЕССИЯ ===
      case 'openSession': return okOr(openSession(c));
      case 'closeSession': return okOr(closeSession(c));

      // === v3.11: ИНТЕРПЕЛЛЯЦИИ ===
      case 'createInterpellation': return okOr(createInterpellation(c, action.deputyId, action.topic));
      case 'answerInterpellation': return okOr(answerInterpellation(c, action.interpellationId, action.accepted));

      case 'generateGovernmentBill': {
        const head = getHeadOfState(c);
        if (!head) return { ok: false, reason: 'Нет главы государства' };
        const bill = generateGovernmentBill(c, room.engine, {
          ...head,
          positionName: POSITIONS[head.position]?.name || 'Глава',
        });
        if (!bill) return { ok: false, reason: 'Не удалось' };
        c.bills = c.bills || [];
        c.bills.push(bill);
        return { ok: true };
      }
      case 'electSpeaker': return { ok: true, speaker: electSpeaker(c, room.engine) };
      case 'runParliamentaryElection': return okOr(runParliamentaryElection(c, room.engine));
      case 'runPresidentialElection': return okOr(runPresidentialElection(c, room.engine));
      case 'formCoalition': return okOr(formCoalition(c));
      case 'impeachPresident': return okOr(impeachPresident(c));
      case 'appointMinister': {
        const person = (c.politicians || []).find(p => p.id === action.personId);
        if (!person) return { ok: false, reason: 'Персонаж не найден' };
        return okOr(appointMinister(c, action.role, person));
      }

      // === ДЕЙСТВИЯ ОППОЗИЦИИ ===
      case 'oppositionRally': return okOr(oppositionRally(c));
      case 'oppositionScandal': return okOr(oppositionScandal(c));
      case 'callVoteOfNoConfidence': return okOr(callVoteOfNoConfidence(c, room.engine));

      // === ПАРТИИ ===
      case 'changePartyLeader': return okOr(changePartyLeader(c, action.partyId));
      case 'fundParty': return okOr(fundParty(c, action.partyId, action.amount));
      case 'boostParty': return okOr(boostParty(c, action.partyId));
      case 'createParty': return okOr(createParty(c, { name: action.name, ideology: action.ideology }));
      case 'dissolveParty': return okOr(dissolveParty(c, action.partyId));
      case 'registerParty': return okOr(registerParty(c, action.partyId));
      case 'setPartyProgram': return okOr(setPartyProgram(c, action.partyId, action.programIds));

      // === v3.12: ОТСТАВКА ПРАВИТЕЛЬСТВА ===
      case 'dismissGovernment': return okOr(dismissGovernment(c, room.engine));

      // === v3.13: РЕФЕРЕНДУМ ===
      case 'startReferendum': return okOr(startReferendum(c, action.questionId));

      // === КОНСТИТУЦИОННЫЙ КРИЗИС (v3.3) ===
      case 'startConstitutionalCrisis': return okOr(startConstitutionalCrisis(c, action.targetSystem));
      case 'abortConstitutionalCrisis': return okOr(abortConstitutionalCrisis(c, room.engine));

      // === ВЫБОРЫ ===
      case 'startPresidentialCampaign': return okOr(startPresidentialCampaign(c, room.engine));
      case 'startParliamentaryCampaign': return okOr(startParliamentaryCampaign(c, room.engine));
      case 'campaignAction': return okOr(campaignAction(c, action.action, action.partyId));
      case 'finishElection': return okOr(finishElection(c, room.engine));
      case 'cancelElection': return okOr(cancelElection(c));

      // === КОНСТИТУЦИЯ ===
      case 'amendPower': return okOr(amendPower(c, action.powerId, action.value));

      // === ПРОФСОЮЗЫ / АССОЦИАЦИИ ===
      case 'unionAction': return okOr(unionAction(c, action.unionId, action.action));
      case 'assocAction': return okOr(assocAction(c, action.assocId, action.action));

      // === ДИПЛОМАТИЯ ===
      case 'improveRelations': {
        const target = room.engine.getCountry(action.targetId);
        if (!target) return { ok: false, reason: 'Страна не найдена' };
        const r = okOr(improveRelations(c, target));
        if (r.ok) logAction(c, 'diplomacy', `Улучшены отношения с ${target.shortName || target.name}`);
        return r;
      }
      case 'holdSummit': {
        const target = room.engine.getCountry(action.targetId);
        if (!target) return { ok: false, reason: 'Страна не найдена' };
        const r = okOr(holdSummit(c, target));
        if (r.ok) logAction(c, 'diplomacy', `Саммит с ${target.shortName || target.name}`, 'good');
        return r;
      }
      case 'signTreaty': {
        const target = room.engine.getCountry(action.targetId);
        if (!target) return { ok: false, reason: 'Страна не найдена' };
        return okOr(signTreaty(c, target, action.treatyType, room.engine));
      }
      case 'breakTreaty': {
        const target = room.engine.getCountry(action.targetId);
        if (!target) return { ok: false, reason: 'Страна не найдена' };
        return okOr(breakTreaty(c, target, action.treatyType, room.engine));
      }
      case 'declareWar': {
        const target = room.engine.getCountry(action.targetId);
        if (!target) return { ok: false, reason: 'Страна не найдена' };
        const r = okOr(declareWar(c, target, room.engine));
        if (r.ok) logAction(c, 'war', `Война с ${target.shortName || target.name}`, 'bad');
        return r;
      }
      case 'makePeace': {
        const target = room.engine.getCountry(action.targetId);
        if (!target) return { ok: false, reason: 'Страна не найдена' };
        const r = okOr(makePeace(c, target, room.engine));
        if (r.ok) logAction(c, 'peace', `Мир с ${target.shortName || target.name}`, 'good');
        return r;
      }
      case 'sendAid': {
        const target = room.engine.getCountry(action.targetId);
        if (!target) return { ok: false, reason: 'Страна не найдена' };
        const r = okOr(sendAid(c, target, action.amount, room.engine));
        if (r.ok) logAction(c, 'aid', `Помощь ${target.shortName || target.name}: $${action.amount} млрд`, 'good');
        return r;
      }
      case 'sendMilitaryAid': {
        const target = room.engine.getCountry(action.targetId);
        if (!target) return { ok: false, reason: 'Страна не найдена' };
        return okOr(sendMilitaryAid(c, target, room.engine));
      }
      case 'conductEspionage': {
        const target = room.engine.getCountry(action.targetId);
        if (!target) return { ok: false, reason: 'Страна не найдена' };
        return okOr(conductEspionage(c, target, action.opId, room.engine));
      }
      case 'propaganda': {
        const target = room.engine.getCountry(action.targetId);
        if (!target) return { ok: false, reason: 'Страна не найдена' };
        return okOr(propaganda(c, target, action.mode, room.engine));
      }
      case 'imposeSanctions': {
        const target = room.engine.getCountry(action.targetId);
        if (!target) return { ok: false, reason: 'Страна не найдена' };
        const r = okOr(imposeSanctions(c, target, room.engine));
        if (r.ok) logAction(c, 'sanctions', `Санкции против ${target.shortName || target.name}`, 'bad');
        return r;
      }
      case 'liftSanctions': {
        const target = room.engine.getCountry(action.targetId);
        if (!target) return { ok: false, reason: 'Страна не найдена' };
        const r = okOr(liftSanctions(c, target, room.engine));
        if (r.ok) logAction(c, 'sanctions', `Сняты санкции с ${target.shortName || target.name}`, 'good');
        return r;
      }
      case 'issueUltimatum': {
        const target = room.engine.getCountry(action.targetId);
        if (!target) return { ok: false, reason: 'Страна не найдена' };
        return okOr(issueUltimatum(c, target, action.demand, room.engine));
      }
      case 'jointExercise': {
        const target = room.engine.getCountry(action.targetId);
        if (!target) return { ok: false, reason: 'Страна не найдена' };
        return okOr(jointExercise(c, target, room.engine));
      }
      case 'openEmbassy': {
        const target = room.engine.getCountry(action.targetId);
        if (!target) return { ok: false, reason: 'Страна не найдена' };
        return okOr(openEmbassy(c, target));
      }
      case 'closeEmbassy': {
        const target = room.engine.getCountry(action.targetId);
        if (!target) return { ok: false, reason: 'Страна не найдена' };
        return okOr(closeEmbassy(c, target));
      }
      case 'setRank': {
        const target = room.engine.getCountry(action.targetId);
        if (!target) return { ok: false, reason: 'Страна не найдена' };
        return okOr(setRank(c, target, action.rank));
      }

      default:
        return { ok: false, reason: 'Неизвестное действие: ' + type };
    }
  } catch (e) {
    console.error(`[actions] error (${type}):`, e);
    return { ok: false, reason: 'Ошибка: ' + e.message };
  }
}
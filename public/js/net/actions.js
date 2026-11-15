// ============================================================
// ДЕЙСТВИЯ ИГРОКА (v3.14, D+C) — отправка на сервер
// ============================================================
import { sendAction } from './client.js';

let currentRoomCode = null;

export function setRoomCode(code) {
  currentRoomCode = code;
}

export function getRoomCode() {
  return currentRoomCode;
}

// FIX: try/catch вокруг sendAction — чтобы промис всегда резолвился
// в { ok, reason }, а не отклонялся (views.js act() ждёт объект)
async function action(type, extra = {}) {
  if (!currentRoomCode) return { ok: false, reason: 'Нет активной комнаты' };
  try {
    return await sendAction({ code: currentRoomCode, action: { type, ...extra } });
  } catch (e) {
    console.error(`[net/actions] ${type} failed:`, e);
    return { ok: false, reason: e.message || 'Ошибка сети' };
  }
}

// === ЭКОНОМИКА ===
export function setTax(key, value) { return action('setTax', { key, value }); }
export function setSpending(key, value) { return action('setSpending', { key, value }); }
export function setInterestRate(value) { return action('setInterestRate', { value }); }
export function setGoldStandard(value) { return action('setGoldStandard', { value }); }
export function setBankReserveRatio(value) { return action('setBankReserveRatio', { value }); }
export function startProject(projectId) { return action('startProject', { projectId }); }
export function nationalize() { return action('nationalize'); }
export function privatize() { return action('privatize'); }

// FIX: новые экономические действия
export function setMinimumWage(value) { return action('setMinimumWage', { value }); }
export function setPensionAge(value) { return action('setPensionAge', { value }); }
export function setPensionRate(value) { return action('setPensionRate', { value }); }
export function devalueCurrency(percent) { return action('devalueCurrency', { percent }); }
export function revalueCurrency(percent) { return action('revalueCurrency', { percent }); }
export function setCbIndependence(value) { return action('setCbIndependence', { value }); }
export function setCbChairman(personId) { return action('setCbChairman', { personId }); }

// === v3.14: ВНУТРЕННЯЯ БЕЗОПАСНОСТЬ И ПРАВОВАЯ СИСТЕМА ===
export function setPoliceFunding(value) { return action('setPoliceFunding', { value }); }
export function setJudicialReform(value) { return action('setJudicialReform', { value }); }
export function launchAntiCorruption() { return action('launchAntiCorruption'); }
export function setLocalAutonomy(value) { return action('setLocalAutonomy', { value }); }
export function protestAction(id, actId) { return action('protestAction', { id, action: actId }); }
export function strikeAction(id, actId) { return action('strikeAction', { id, action: actId }); }

// === ЗАКОНЫ ===
export function proposeLaw(lawId) { return action('proposeLaw', { lawId }); }
export function passLaw(lawId) { return action('passLaw', { lawId }); }
export function revokeLaw(lawId) { return action('revokeLaw', { lawId }); }

// === ПАРЛАМЕНТ ===
export function voteOnBill(billId) { return action('voteOnBill', { billId }); }
export function parliamentBlockBill(billId) { return action('parliamentBlockBill', { billId }); }
export function presidentialVeto(billId) { return action('presidentialVeto', { billId }); }
export function generateGovernmentBill() { return action('generateGovernmentBill'); }
export function electSpeaker() { return action('electSpeaker'); }
export function runParliamentaryElection() { return action('runParliamentaryElection'); }
export function runPresidentialElection() { return action('runPresidentialElection'); }
export function formCoalition() { return action('formCoalition'); }
export function impeachPresident() { return action('impeachPresident'); }
export function appointMinister(role, personId) { return action('appointMinister', { role, personId }); }

// === v3.9: ИНТЕРАКТИВНОЕ ГОЛОСОВАНИЕ ПО ЗАКОНОПРОЕКТУ ===
export function castBillVote(billId, vote) { return action('castBillVote', { billId, vote }); }

// === v3.11: СЕНАТ (двухпалатный парламент) ===
export function initSenate() { return action('initSenate'); }
export function voteOnBillSenate(billId) { return action('voteOnBillSenate', { billId }); }

// === v3.11: КОМИТЕТЫ ===
export function createCommittee(typeId, chairmanId) { return action('createCommittee', { typeId, chairmanId }); }
export function dissolveCommittee(typeId) { return action('dissolveCommittee', { typeId }); }

// === v3.11: ФРАКЦИИ ===
export function strengthenDiscipline(partyId) { return action('strengthenDiscipline', { partyId }); }

// === v3.11: ПОВЕСТКА ===
export function accelerateBill(billId, days) { return action('accelerateBill', { billId, days }); }
export function postponeBill(billId, days) { return action('postponeBill', { billId, days }); }

// === v3.11: СЕССИЯ ===
export function openSession() { return action('openSession'); }
export function closeSession() { return action('closeSession'); }

// === v3.11: ИНТЕРПЕЛЛЯЦИИ ===
export function createInterpellation(deputyId, topic) { return action('createInterpellation', { deputyId, topic }); }
export function answerInterpellation(interpellationId, accepted) { return action('answerInterpellation', { interpellationId, accepted }); }

// === ПАРТИИ ===
export function changePartyLeader(partyId) { return action('changePartyLeader', { partyId }); }
export function fundParty(partyId, amount) { return action('fundParty', { partyId, amount }); }
export function boostParty(partyId) { return action('boostParty', { partyId }); }
export function createParty(name, ideology) { return action('createParty', { name, ideology }); }
export function dissolveParty(partyId) { return action('dissolveParty', { partyId }); }
export function registerParty(partyId) { return action('registerParty', { partyId }); }
// v3.13: партийная программа
export function setPartyProgram(partyId, programIds) { return action('setPartyProgram', { partyId, programIds }); }

// === v3.12: ОТСТАВКА ПРАВИТЕЛЬСТВА ===
export function dismissGovernment() { return action('dismissGovernment'); }

// === v3.13: РЕФЕРЕНДУМ ===
export function startReferendum(questionId) { return action('startReferendum', { questionId }); }

// === КОНСТИТУЦИОННЫЙ КРИЗИС (v3.3) ===
export function startConstitutionalCrisis(targetSystem) {
  return action('startConstitutionalCrisis', { targetSystem });
}
export function abortConstitutionalCrisis() {
  return action('abortConstitutionalCrisis');
}

// === ВЫБОРЫ ===
export function startPresidentialCampaign() { return action('startPresidentialCampaign'); }
export function startParliamentaryCampaign() { return action('startParliamentaryCampaign'); }
export function campaignAction(actionId, partyId) { return action('campaignAction', { action: actionId, partyId }); }
export function finishElection() { return action('finishElection'); }
export function cancelElection() { return action('cancelElection'); }

// === КОНСТИТУЦИЯ ===
export function amendPower(powerId, value) { return action('amendPower', { powerId, value }); }

// === ПРОФСОЮЗЫ / АССОЦИАЦИИ ===
export function unionAction(unionId, actionId) { return action('unionAction', { unionId, action: actionId }); }
export function assocAction(assocId, actionId) { return action('assocAction', { assocId, action: actionId }); }

// === ДЕЙСТВИЯ ОППОЗИЦИИ ===
export function oppositionRally() { return action('oppositionRally'); }
export function oppositionScandal() { return action('oppositionScandal'); }
export function callVoteOfNoConfidence() { return action('callVoteOfNoConfidence'); }

// === ДИПЛОМАТИЯ ===
export function improveRelations(targetId) { return action('improveRelations', { targetId }); }
export function holdSummit(targetId) { return action('holdSummit', { targetId }); }
export function signTreaty(targetId, treatyType) { return action('signTreaty', { targetId, treatyType }); }
export function breakTreaty(targetId, treatyType) { return action('breakTreaty', { targetId, treatyType }); }
export function declareWar(targetId) { return action('declareWar', { targetId }); }
export function makePeace(targetId) { return action('makePeace', { targetId }); }
export function sendAid(targetId, amount) { return action('sendAid', { targetId, amount }); }
export function sendMilitaryAid(targetId) { return action('sendMilitaryAid', { targetId }); }
export function conductEspionage(targetId, opId) { return action('conductEspionage', { targetId, opId }); }
export function propaganda(targetId, mode) { return action('propaganda', { targetId, mode }); }
export function imposeSanctions(targetId) { return action('imposeSanctions', { targetId }); }
export function liftSanctions(targetId) { return action('liftSanctions', { targetId }); }
export function issueUltimatum(targetId, demand) { return action('issueUltimatum', { targetId, demand }); }
export function jointExercise(targetId) { return action('jointExercise', { targetId }); }
export function openEmbassy(targetId) { return action('openEmbassy', { targetId }); }
export function closeEmbassy(targetId) { return action('closeEmbassy', { targetId }); }
export function setRank(targetId, rank) { return action('setRank', { targetId, rank }); }
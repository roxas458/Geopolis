import { randInt, randFloat, pick, chance, gauss } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { generatePerson, generateDeputy, regenerateDeputies } from './politics.js';

// ============================================================
// ВЫБОРЫ (v2.7 — варианты B и C)
// ============================================================

const CAMPAIGN_ACTIONS = {
  rally:  { name: 'Митинг',   icon: '📢', cost: 0,     gainBase: 3,   gainSpread: 2 },
  debate: { name: 'Дебаты',   icon: '🎤', cost: 0,     gainBase: 0,   gainSpread: 4 },
  ad:     { name: 'Реклама',  icon: '💰', cost: 0.05,  gainBase: 5,   gainSpread: 3 },
};

// ============================================================
// ЛЕНИВАЯ ИНИЦИАЛИЗАЦИЯ
// ============================================================
function ensurePlayerState(c) {
  if (c.playerPartyId === undefined) c.playerPartyId = null;
  if (c.playerPersonId === undefined) c.playerPersonId = null;
  if (c.playerRole === undefined) c.playerRole = null;
  if (c.playerInPower === undefined) c.playerInPower = true;
}

// FIX: безопасное получение харизмы лидера (p.leader может быть null)
function leaderCharisma(p) {
  return Number.isFinite(p?.leader?.charisma) ? p.leader.charisma : 30;
}

// ============================================================
// СТАРТ ПРЕЗИДЕНТСКОЙ КАМПАНИИ
// ============================================================
export function startPresidentialCampaign(c, game) {
  ensurePlayerState(c);
  if (c.election) return { ok: false, reason: 'Кампания уже идёт' };
  if (!c.parties || c.parties.length < 2) {
    return { ok: false, reason: 'Нужно минимум 2 партии' };
  }
  if (c.system === 'one_party' || c.system === 'authoritarian') {
    return { ok: false, reason: 'Выборы невозможны при этой системе' };
  }

  const candidates = c.parties.map(p => ({
    partyId: p.id,
    partyName: p.name,
    partyColor: p.color,
    partySymbol: p.symbol || '⚖️',
    candidate: p.leader,
    // FIX: guard p.leader (иначе p.leader.charisma → TypeError)
    rating: clamp(p.support * 0.6 + leaderCharisma(p) * 0.4, 0, 100),
    actionsUsed: 0,
    maxActions: 3,
  }));

  c.election = {
    type: 'presidential',
    round: 1,
    candidates,
    daysLeft: 30,
    totalDays: 30,
    history: [],
    startedDate: { ...(game?.date || { year: 1936, month: 1, day: 1 }) },
  };

  if (game) {
    game.pushNews('Выборы', `Началась президентская кампания в ${c.shortName}`, 'info', c.id);
  }
  return { ok: true, election: c.election };
}

// ============================================================
// СТАРТ ПАРЛАМЕНТСКОЙ КАМПАНИИ
// ============================================================
export function startParliamentaryCampaign(c, game) {
  ensurePlayerState(c);
  if (c.election) return { ok: false, reason: 'Кампания уже идёт' };
  if (!c.parties || c.parties.length < 2) {
    return { ok: false, reason: 'Нужно минимум 2 партии' };
  }
  if (c.system === 'one_party' || c.system === 'authoritarian') {
    return { ok: false, reason: 'Выборы невозможны при этой системе' };
  }

  const candidates = c.parties.map(p => ({
    partyId: p.id,
    partyName: p.name,
    partyColor: p.color,
    partySymbol: p.symbol || '⚖️',
    candidate: p.leader,
    // FIX: guard p.leader
    rating: clamp(p.support * 0.7 + leaderCharisma(p) * 0.3, 0, 100),
    actionsUsed: 0,
    maxActions: 3,
  }));

  c.election = {
    type: 'parliamentary',
    round: 1,
    candidates,
    daysLeft: 30,
    totalDays: 30,
    history: [],
    startedDate: { ...(game?.date || { year: 1936, month: 1, day: 1 }) },
  };

  if (game) {
    game.pushNews('Выборы', `Началась парламентская кампания в ${c.shortName}`, 'info', c.id);
  }
  return { ok: true, election: c.election };
}

// ============================================================
// ДЕЙСТВИЯ В КАМПАНИИ (v2.7: B + C)
// ============================================================
export function campaignAction(c, action, partyId) {
  ensurePlayerState(c);
  if (!c.election) return { ok: false, reason: 'Нет активной кампании' };
  const def = CAMPAIGN_ACTIONS[action];
  if (!def) return { ok: false, reason: 'Неизвестное действие' };

  if (c.playerPartyId && partyId !== c.playerPartyId) {
    return { ok: false, reason: 'Можно агитировать только за свою партию' };
  }

  if (c.playerPersonId && !c.playerPartyId) {
    const cand = c.election.candidates.find(x => x.partyId === partyId);
    if (cand && cand.candidate?.id !== c.playerPersonId) {
      return { ok: false, reason: 'Можно агитировать только за себя' };
    }
  }

  const cand = c.election.candidates.find(x => x.partyId === partyId);
  if (!cand) return { ok: false, reason: 'Кандидат не найден' };
  // FIX: guard cand.candidate (иначе cand.candidate.charisma → TypeError)
  if (!cand.candidate) return { ok: false, reason: 'У кандидата нет персонажа' };
  if (cand.actionsUsed >= cand.maxActions) return { ok: false, reason: 'Действия закончились' };

  if (def.cost > 0) {
    if ((c.treasury || 0) < def.cost) return { ok: false, reason: 'Недостаточно средств' };
    c.treasury -= def.cost;
  }

  let gain = 0;

  switch (action) {
    case 'rally':
      gain = gauss(def.gainBase, def.gainSpread);
      break;
    case 'debate':
      gain = gauss(cand.candidate.charisma * 0.15 - 5, def.gainSpread);
      for (const other of c.election.candidates) {
        if (other.partyId === partyId) continue;
        other.rating = clamp(other.rating - gain * 0.2, 0, 100);
      }
      break;
    case 'ad':
      gain = gauss(def.gainBase, def.gainSpread);
      break;
  }

  cand.rating = clamp(cand.rating + gain, 0, 100);
  cand.actionsUsed++;

  c.election.history.push({
    day: c.election.totalDays - c.election.daysLeft,
    action: def.name,
    party: cand.partyName,
    gain: Math.round(gain),
  });

  return { ok: true, gain };
}

// ============================================================
// ЕЖЕДНЕВНЫЙ ТИК ВЫБОРОВ
// ============================================================
export function tickElections(c, game) {
  if (!c.election) return;

  c.election.daysLeft--;

  for (const cand of c.election.candidates) {
    cand.rating = clamp(cand.rating + gauss(0, 0.5), 0, 100);
  }

  if (c.election.daysLeft % 7 === 0) {
    for (const cand of c.election.candidates) {
      cand.actionsUsed = Math.max(0, cand.actionsUsed - 1);
    }
  }

  if (c.election.daysLeft <= 0) {
    finishElection(c, game);
  }
}

// ============================================================
// ЗАВЕРШЕНИЕ ВЫБОРОВ
// ============================================================
export function finishElection(c, game) {
  ensurePlayerState(c);
  if (!c.election) return { ok: false, reason: 'Нет выборов' };

  const candidates = [...c.election.candidates].sort((a, b) => b.rating - a.rating);

  // FIX: guard пустого списка кандидатов (иначе candidates[0].rating → TypeError)
  if (!candidates.length) {
    c.election = null;
    return { ok: false, reason: 'Нет кандидатов' };
  }

  if (c.election.type === 'presidential') {
    if (c.election.round === 1) {
      if (candidates[0].rating > 50) {
        return finalizePresidential(c, game, candidates[0]);
      }
      c.election.round = 2;
      c.election.candidates = candidates.slice(0, 2).map(c => ({
        ...c,
        actionsUsed: 0,
        maxActions: 2,
      }));
      c.election.daysLeft = 14;
      c.election.totalDays = 14;
      c.election.history = [];
      if (game) {
        const second = candidates[1];
        const vs = second ? ` vs ${second.partyName}` : '';
        game.pushNews('Выборы', `Второй тур: ${candidates[0].partyName}${vs}`, 'info', c.id);
      }
      return { ok: true, round: 2 };
    } else {
      return finalizePresidential(c, game, candidates[0]);
    }
  }

  if (c.election.type === 'parliamentary') {
    return finalizeParliamentary(c, game, candidates);
  }

  return { ok: false, reason: 'Неизвестный тип выборов' };
}

// ============================================================
// ФИНАЛИЗАЦИЯ ПРЕЗИДЕНТСКИХ (v2.7: B + C)
// ============================================================
function finalizePresidential(c, game, winner) {
  if (!winner || !winner.candidate) {
    c.election = null;
    return { ok: false, reason: 'Победитель не определён' };
  }
  const party = c.parties.find(p => p.id === winner.partyId);
  c.president = {
    ...winner.candidate,
    partyId: winner.partyId,
    since: { ...(game?.date || { year: 1936, month: 1, day: 1 }) },
  };
  c.ideology = party?.ideology || c.ideology;

  if (c.playerPartyId) {
    c.playerInPower = (winner.partyId === c.playerPartyId);
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

  c.election = null;
  if (game) {
    const kind = c.playerPartyId || c.playerPersonId
      ? (c.playerInPower ? 'good' : 'bad')
      : 'good';
    game.pushNews('Выборы', `${winner.candidate.name} избран президентом ${c.shortName}`, kind, c.id);
  }
  return { ok: true, winner };
}

// ============================================================
// ФИНАЛИЗАЦИЯ ПАРЛАМЕНТСКИХ (v2.7: B + C + обновление премьера)
// ============================================================
function finalizeParliamentary(c, game, candidates) {
  const oldPMId = c.primeMinister?.id || null;

  // FIX: guard seatsTotal (иначе NaN во всех местах)
  const seatsTotal = Number.isFinite(c.seatsTotal) && c.seatsTotal > 0 ? c.seatsTotal : 100;

  const totalRating = candidates.reduce((a, b) => a + b.rating, 0) || 1;
  for (const cand of candidates) {
    const party = c.parties.find(p => p.id === cand.partyId);
    if (party) party.support = (cand.rating / totalRating) * 100;
  }

  const threshold = 5;
  const eligible = c.parties.filter(p => p.support >= threshold);
  const totalSupport = eligible.reduce((a, p) => a + p.support, 0) || 1;
  let allocated = 0;
  for (const p of c.parties) p.seats = 0;
  for (const p of eligible) {
    p.seats = Math.floor((p.support / totalSupport) * seatsTotal);
    allocated += p.seats;
  }
  let remainder = seatsTotal - allocated;
  const sorted = [...eligible].sort((a, b) =>
    ((b.support / totalSupport) * seatsTotal) % 1 -
    ((a.support / totalSupport) * seatsTotal) % 1
  );
  let i = 0;
  while (remainder > 0 && sorted.length) {
    sorted[i % sorted.length].seats++;
    remainder--;
    i++;
  }

  regenerateDeputies(c);

  const sortedBySeats = [...c.parties].sort((a, b) => b.seats - a.seats);
  const needed = Math.floor(seatsTotal / 2) + 1;
  const coalition = [];
  let seats = 0;
  for (const p of sortedBySeats) {
    coalition.push(p.id);
    seats += p.seats;
    if (seats >= needed) break;
  }
  c.coalition = coalition;
  c.rulingPartyId = sortedBySeats[0]?.id || null;

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
    // FIX: guard coalition (на случай undefined)
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

  c.election = null;
  if (game) {
    const kind = c.playerPartyId || c.playerPersonId
      ? (c.playerInPower ? 'good' : 'bad')
      : 'info';
    game.pushNews('Выборы', `Прошли парламентские выборы в ${c.shortName}`, kind, c.id);
  }
  return { ok: true };
}

// ============================================================
// ОТМЕНА ВЫБОРОВ
// ============================================================
export function cancelElection(c) {
  if (!c.election) return { ok: false, reason: 'Нет активной кампании' };
  c.election = null;
  return { ok: true };
}

// ============================================================
// СТАТУС
// ============================================================
export function getElectionStatus(c) {
  if (!c.election) return null;
  const cands = [...c.election.candidates].sort((a, b) => b.rating - a.rating);
  return {
    type: c.election.type,
    round: c.election.round,
    daysLeft: c.election.daysLeft,
    totalDays: c.election.totalDays,
    leader: cands[0] || null,
    candidates: cands,
  };
}

export { CAMPAIGN_ACTIONS };
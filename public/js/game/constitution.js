import { clamp } from '../core/util.js';

// ============================================================
// ПОЛНОМОЧИЯ ПАРЛАМЕНТА (v1.4, v2.6 — фиксы)
// ============================================================
export const PARLIAMENT_POWERS = [
  { id: 'budget_approval',       name: 'Утверждение бюджета',         desc: 'Парламент голосует по бюджету',        default: true },
  { id: 'war_declaration',       name: 'Объявление войны',            desc: 'Парламент решает вопросы войны и мира', default: true },
  { id: 'treaty_ratification',   name: 'Ратификация договоров',       desc: 'Парламент утверждает договоры',         default: true },
  { id: 'investigation',         name: 'Парламентские расследования', desc: 'Право расследовать действия правительства', default: true },
  { id: 'confidence_vote',       name: 'Вотум недоверия',             desc: 'Парламент может отправить кабинет в отставку', default: true },
  { id: 'veto_override',         name: 'Преодоление вето',            desc: 'Парламент может преодолеть вето президента (2/3)', default: true },
  { id: 'emergency_powers',      name: 'Чрезвычайные полномочия',     desc: 'Парламент утверждает ЧП',               default: true },
  { id: 'judicial_appointment',  name: 'Назначение судей',            desc: 'Парламент утверждает судей',            default: false },
  { id: 'cabinet_approval',      name: 'Утверждение министров',       desc: 'Парламент утверждает кабинет',           default: true },
  { id: 'constitutional_amend',  name: 'Конституционные поправки',    desc: 'Парламент меняет конституцию (2/3)',     default: true },
];

export const DEFAULT_CONSTITUTION = PARLIAMENT_POWERS.reduce((acc, p) => {
  acc[p.id] = p.default;
  return acc;
}, {});

/**
 * Попробовать изменить полномочие парламента.
 * Требует 2/3 голосов в парламенте (для конституционных изменений).
 */
export function amendPower(c, powerId, value) {
  if (!c.constitution) c.constitution = { ...DEFAULT_CONSTITUTION };
  const power = PARLIAMENT_POWERS.find(p => p.id === powerId);
  if (!power) return { ok: false, reason: 'Полномочие не найдено' };

  if (c.constitution[powerId] === value) return { ok: false, reason: 'Уже установлено' };

  // Защита от не-массивов в старых сейвах
  const parties = Array.isArray(c.parties) ? c.parties : [];
  const coalition = Array.isArray(c.coalition) ? c.coalition : [];

  // Проверка большинства — 2/3 для поправок
  const coalitionSeats = parties
    .filter(p => coalition.includes(p.id))
    .reduce((a, p) => a + (Number.isFinite(p.seats) ? p.seats : 0), 0);

  const totalSeats = Number.isFinite(c.seatsTotal) && c.seatsTotal > 0 ? c.seatsTotal : 100;
  // v2.6: 2/3 вместо 0.67 (точнее на 1 голос при 250 местах)
  const need = Math.ceil(totalSeats * 2 / 3);

  if (coalitionSeats < need) {
    return { ok: false, reason: `Нужно ${need} голосов (2/3). У коалиции только ${coalitionSeats}.` };
  }

  c.constitution[powerId] = !!value;

  // Политические последствия
  if (!value) {
    // Отобрали полномочие — сдвиг к авторитаризму
    c.democracyLoss = (c.democracyLoss || 0) + 1;
    // v2.6: clamp вместо Math.max (ограничивает 0..100 с обеих сторон)
    c.humanRights = clamp((c.humanRights || 50) - 3, 0, 100);
    c.pressFreedom = clamp((c.pressFreedom || 50) - 2, 0, 100);
    c.discontent = clamp((c.discontent || 40) + 3, 0, 100);
  } else {
    // Дали полномочие — сдвиг к демократии
    // v2.6: clamp вместо Math.min
    c.humanRights = clamp((c.humanRights || 50) + 2, 0, 100);
    c.pressFreedom = clamp((c.pressFreedom || 50) + 2, 0, 100);
    c.approval = clamp((c.approval || 50) + 2, 0, 100);
  }

  return { ok: true };
}

/**
 * Считает эффекты конституции.
 */
export function getConstitutionalEffects(c) {
  // Мержим с дефолтом — на случай неполного старого сейва
  const k = { ...DEFAULT_CONSTITUTION, ...(c.constitution || {}) };
  let parliamentScore = 0;
  for (const p of PARLIAMENT_POWERS) {
    if (k[p.id]) parliamentScore++;
  }

  return {
    parliamentScore,           // 0..10
    executivePower: 10 - parliamentScore,  // 0..10
    // Эффекты на эффективность
    decisionSpeed: 1 - parliamentScore * 0.03, // 1.0..0.7 (медленнее)
    corruptionRisk: 1 + (10 - parliamentScore) * 0.02, // 1.0..1.2
    // Влияние на демократию
    democracyBonus: parliamentScore * 2, // 0..20
  };
}

/**
 * Изменение полномочий через закон (не конституцию).
 */
export function proposePowerChange(c, powerId, value) {
  return amendPower(c, powerId, value);
}
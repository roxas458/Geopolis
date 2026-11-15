// ============================================================
// v3.15: СОБЫТИЯ ПРОТЕСТОВ И ЗАБАСТОВОК
// Вызывается из events.js (rollEvents) — возвращает событие или null.
// ============================================================
import { resolveChoice } from './events.js';

// ============================================================
// ВСПОМОГАТЕЛЬНОЕ: выбрать случайный элемент
// ============================================================
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================
// СОБЫТИЕ 1: ПРОТЕСТЫ В СТОЛИЦЕ
// Триггер: c.protests.length > 0
// ============================================================
function buildProtestEvent(c) {
  const p = c.protests[0];
  const scale = Math.round(p.scale);
  const causeLabel = {
    poverty: 'бедность',
    unemployment: 'безработица',
    corruption: 'коррупция',
    repression: 'репрессии',
    inequality: 'неравенство',
    war: 'война',
  }[p.cause] || p.cause;

  return {
    id: 'protest_' + p.id,
    title: '✊ Протесты в столице',
    text: `В ${p.region} начались протесты против ${causeLabel}. ` +
          `Масштаб: ${scale}/100. Осталось ${p.daysLeft} дн. ` +
          `Требования: улучшение условий, снижение цен, борьба с коррупцией.`,
    choices: [
      {
        label: '🤝 Уступить',
        sub: '−недовольство, +одобрение, −казна',
        effects: { add: { discontent: -6, approval: +3, treasury: -0.01 } },
        onResolve: () => {
          // удаляем протест
          c.protests = (c.protests || []).filter(x => x.id !== p.id);
        },
      },
      {
        label: '🚫 Разогнать',
        sub: '−одобрение, −права, +стабильность',
        effects: { add: { approval: -5, humanRights: -6, stability: +3, discontent: +3 } },
        onResolve: () => {
          c.protests = (c.protests || []).filter(x => x.id !== p.id);
        },
      },
      {
        label: '⚪ Игнорировать',
        sub: 'протест продолжится',
        effects: { add: { stability: -2 } },
      },
    ],
  };
}

// ============================================================
// СОБЫТИЕ 2: ЗАБАСТОВКА В ПРОМЫШЛЕННОСТИ
// Триггер: c.strikes.length > 0
// ============================================================
function buildStrikeEvent(c) {
  const s = c.strikes[0];
  const scale = Math.round(s.scale);
  const sectorLabel = {
    industry: 'промышленности',
    transport: 'транспорте',
    mining: 'шахтах',
    agriculture: 'сельском хозяйстве',
    services: 'сфере услуг',
  }[s.sector] || s.sector;

  return {
    id: 'strike_' + s.id,
    title: '✊ Забастовка',
    text: `Забастовка в ${sectorLabel}. Масштаб: ${scale}/100. ` +
          `Осталось ${s.daysLeft} дн. Рабочие требуют повышения зарплат и улучшения условий.`,
    choices: [
      {
        label: '🤝 Договориться',
        sub: '+зарплата, +одобрение, −казна',
        effects: { add: { approval: +2, treasury: -0.02 }, mul: { wage: 1.02 } },
        onResolve: () => {
          c.strikes = (c.strikes || []).filter(x => x.id !== s.id);
        },
      },
      {
        label: '🔨 Сломать',
        sub: '−одобрение, −права, +стабильность',
        effects: { add: { approval: -4, humanRights: -4, stability: +2 } },
        onResolve: () => {
          c.strikes = (c.strikes || []).filter(x => x.id !== s.id);
        },
      },
      {
        label: '⚪ Ждать',
        sub: 'забастовка продолжится',
        effects: { add: { gdp: -0.001 } },
      },
    ],
  };
}

// ============================================================
// СОБЫТИЕ 3: МАССОВЫЕ БЕСПОРЯДКИ
// Триггер: discontent > 70
// ============================================================
function buildRiotEvent(c) {
  const scale = Math.round(c.discontent);
  return {
    id: 'riot_' + Date.now(),
    title: '🔥 Массовые беспорядки',
    text: `Недовольство достигло ${scale}/100. В нескольких городах вспыхнули беспорядки. ` +
          `Правительство должно действовать решительно.`,
    choices: [
      {
        label: '🛡️ Ввести войска',
        sub: '+стабильность, −права, −одобрение',
        effects: { add: { stability: +6, humanRights: -10, approval: -6, discontent: -4 } },
      },
      {
        label: '🤝 Пойти на уступки',
        sub: '−недовольство, +одобрение, −казна',
        effects: { add: { discontent: -8, approval: +4, treasury: -0.03 } },
      },
      {
        label: '📢 Обратиться к нации',
        sub: 'небольшой эффект',
        effects: { add: { approval: +1, discontent: -2 } },
      },
    ],
  };
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================
export function rollSocietyEvents(game) {
  const c = game?.getPlayer?.();
  if (!c) return null;

  // приоритет: массовые беспорядки > протесты > забастовки
  if ((c.discontent || 0) > 70 && Math.random() < 0.15) {
    return buildRiotEvent(c);
  }
  if ((c.protests || []).length > 0 && Math.random() < 0.20) {
    return buildProtestEvent(c);
  }
  if ((c.strikes || []).length > 0 && Math.random() < 0.20) {
    return buildStrikeEvent(c);
  }
  return null;
}
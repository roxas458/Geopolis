import { chance, random } from '../core/rng.js';
import { applyEffects } from './effects.js';

export const EVENT_TEMPLATES = [
  {
    id: 'economic_crisis', tag: 'Экономика', weight: 4,
    cond: (c) => (c.growth ?? 0) < 0.0005,
    title: 'Экономический кризис',
    text: 'Фондовый рынок рушится. Банки терпят убытки, предприятия сокращают штат. Что предпримет правительство?',
    choices: [
      { label: 'Спасать банки за счёт казны', sub: '−$ 0.25 млрд', effects: { add: { treasury: -0.25, stability: 4, approval: 2, debt: 0.15 } } },
      { label: 'Жёсткая экономия', sub: 'рост безработицы', effects: { add: { approval: -8, stability: -6, unemployment: 0.03 } } },
      { label: 'Программа общественных работ', sub: '−$ 0.15 млрд, но занятость', effects: { add: { treasury: -0.15, unemployment: -0.01, approval: 4, infrastructure: 4 } } },
    ],
  },
  {
    id: 'corruption_scandal', tag: 'Коррупция', weight: 3,
    cond: (c) => (c.corruption ?? 0) > 35,
    title: 'Коррупционный скандал',
    text: 'Пресса раскрыла схему хищения государственных средств высокопоставленными чиновниками.',
    choices: [
      { label: 'Показательный процесс', effects: { add: { corruption: -6, approval: 3, stability: -2 } } },
      { label: 'Замести под ковёр', effects: { add: { corruption: 4, pressFreedom: -5, approval: -6 } } },
    ],
  },
  {
    id: 'mass_protests', tag: 'Протесты', weight: 3,
    cond: (c) => (c.approval ?? 50) < 40 && (c.discontent ?? 40) > 55,
    title: 'Массовые протесты',
    text: 'Тысячи людей вышли на улицы с требованиями отставки правительства.',
    choices: [
      { label: 'Диалог с протестующими', effects: { add: { approval: 4, stability: 3, discontent: -6 } } },
      { label: 'Разогнать силой', effects: { add: { stability: -8, humanRights: -8, pressFreedom: -5, discontent: 4 } } },
      { label: 'Уступки и реформы', sub: '−$ 0.10 млрд', effects: { add: { treasury: -0.10, approval: 7, discontent: -10, inequality: -0.02 } } },
    ],
  },
  {
    id: 'natural_disaster', tag: 'Катастрофа', weight: 2,
    cond: () => true,
    title: 'Природная катастрофа',
    text: 'Землетрясение разрушило инфраструктуру в одном из регионов. Требуется срочная помощь.',
    choices: [
      { label: 'Выделить средства на восстановление', sub: '−$ 0.18 млрд', effects: { add: { treasury: -0.18, approval: 5, infrastructure: -2 } } },
      { label: 'Минимальные меры', effects: { add: { approval: -7, infrastructure: -6, stability: -3 } } },
    ],
  },
  {
    id: 'epidemic', tag: 'Эпидемия', weight: 2,
    cond: (c) => (c.healthcareLevel ?? 50) < 55,
    title: 'Вспышка эпидемии',
    text: 'Инфекция распространяется по стране. Система здравоохранения на грани перегрузки.',
    choices: [
      { label: 'Массовая вакцинация', sub: '−$ 0.12 млрд', effects: { add: { treasury: -0.12, healthcareLevel: 4, approval: 3 } } },
      { label: 'Карантин', effects: { add: { approval: -2, healthcareLevel: 1 }, mul: { gdp: 0.99 } } },
      { label: 'Игнорировать', effects: { add: { approval: -10, population: -200000, stability: -5 }, mul: { gdp: 0.98 } } },
    ],
  },
  {
    id: 'tech_breakthrough', tag: 'Наука', weight: 2,
    cond: (c) => (c.educationLevel ?? 30) > 40,
    title: 'Технологический прорыв',
    text: 'Учёные вашей страны совершили крупное открытие в области промышленности.',
    choices: [
      { label: 'Инвестировать в развитие', effects: { add: { technology: 8, approval: 3 }, mul: { gdp: 1.005 } } },
      { label: 'Продать патенты за рубеж', sub: '+$ 0.20 млрд', effects: { add: { treasury: 0.20, technology: 2 } } },
    ],
  },
  {
    id: 'energy_crisis', tag: 'Энергетика', weight: 2,
    cond: () => true,
    title: 'Энергетический кризис',
    text: 'Рост цен на топливо вызывает недовольство в промышленности и среди населения.',
    choices: [
      { label: 'Субсидировать цены', sub: '−$ 0.14 млрд', effects: { add: { treasury: -0.14, inflation: -0.01, approval: 4 } } },
      { label: 'Позволить рынку', effects: { add: { inflation: 0.03, approval: -6, stability: -2 } } },
      { label: 'Инвестировать в энергетику', sub: '−$ 0.08 млрд', effects: { add: { treasury: -0.08, infrastructure: 5, technology: 2 } } },
    ],
  },
  {
    id: 'diplomatic_conflict', tag: 'Дипломатия', weight: 3,
    cond: (c, game) => !!(game && game.world?.countries?.some(o => o.id !== c.id && ((c.relations || {})[o.id] ?? 0) < -40)),
    title: 'Дипломатический конфликт',
    text: 'Соседнее государство обвинило вас в нарушении границ. Атмосфера накаляется.',
    choices: [
      { label: 'Извиниться и сесть за стол переговоров', effects: { add: { influence: -3, reputation: 2, stability: 2 } } },
      { label: 'Ответить жёстко', effects: { add: { influence: 4, reputation: -4, stability: -2 } } },
    ],
  },
  {
    id: 'unexpected_growth', tag: 'Экономика', weight: 2,
    cond: (c) => (c.growth ?? 0) > 0.002,
    title: 'Неожиданный экономический рост',
    text: 'Инвесторы со всего мира обратили внимание на вашу страну.',
    choices: [
      { label: 'Направить в бюджет', sub: '+$ 0.18 млрд', effects: { add: { treasury: 0.18 }, mul: { fdi: 1.5 } } },
      { label: 'Инвестировать в инфраструктуру', effects: { add: { infrastructure: 7, technology: 3 } } },
    ],
  },
  {
    id: 'president_scandal', tag: 'Политика', weight: 2,
    cond: (c) => ((c.presidentApproval ?? c.approval ?? 50) < 40),
    title: 'Скандал вокруг президента',
    text: 'Личная жизнь главы государства стала предметом общественного обсуждения.',
    choices: [
      { label: 'Публичные извинения', effects: { add: { approval: -2, stability: 1 } } },
      { label: 'Наступление на прессу', effects: { add: { pressFreedom: -10, approval: -5, humanRights: -4 } } },
    ],
  },
  {
    id: 'general_strike', tag: 'Общество', weight: 2,
    cond: (c) => (c.unemployment ?? 0) > 0.12 || (c.inequality ?? 0) > 0.45,
    title: 'Всеобщая забастовка',
    text: 'Профсоюзы объявили всеобщую забастовку, требуя повышения зарплат.',
    choices: [
      { label: 'Повысить минимальную зарплату', effects: { add: { wage: 60, unemployment: 0.01, approval: 5, inequality: -0.03 } } },
      { label: 'Запретить забастовки', effects: { add: { stability: -5, humanRights: -6, approval: -6 } } },
    ],
  },

  // ============================================================
  // v3.15: СОБЫТИЯ ПРОТЕСТОВ / ЗАБАСТОВОК / БЕСПОРЯДКОВ
  // ============================================================
  {
    id: 'protest_event', tag: 'Протесты', weight: 3,
    cond: (c) => Array.isArray(c.protests) && c.protests.length > 0,
    title: '✊ Протесты в столице',
    text: 'На улицах столицы собрались протестующие. Они требуют реформ и улучшения условий жизни.',
    choices: [
      { label: '🤝 Уступить', sub: '−недовольство, +одобрение, −казна', effects: { add: { discontent: -6, approval: 3, treasury: -0.01 } } },
      { label: '🚫 Разогнать', sub: '−одобрение, −права, +стабильность', effects: { add: { approval: -5, humanRights: -6, stability: 3, discontent: 3 } } },
      { label: '⚪ Игнорировать', sub: 'протест продолжится', effects: { add: { stability: -2 } } },
    ],
  },
  {
    id: 'strike_event', tag: 'Забастовки', weight: 3,
    cond: (c) => Array.isArray(c.strikes) && c.strikes.length > 0,
    title: '✊ Забастовка',
    text: 'Рабочие объявили забастовку. Производство остановлено, требования — повышение зарплат.',
    choices: [
      { label: '🤝 Договориться', sub: '+зарплата, +одобрение, −казна', effects: { add: { approval: 2, treasury: -0.02 }, mul: { wage: 1.02 } } },
      { label: '🔨 Сломать', sub: '−одобрение, −права, +стабильность', effects: { add: { approval: -4, humanRights: -4, stability: 2 } } },
      { label: '⚪ Ждать', sub: 'забастовка продолжится', effects: { add: { growth: -0.0005 } } },
    ],
  },
  {
    id: 'riot_event', tag: 'Беспорядки', weight: 2,
    cond: (c) => (c.discontent ?? 0) > 70,
    title: '🔥 Массовые беспорядки',
    text: 'Недовольство достигло критического уровня. В нескольких городах вспыхнули беспорядки.',
    choices: [
      { label: '🛡️ Ввести войска', sub: '+стабильность, −права, −одобрение', effects: { add: { stability: 6, humanRights: -10, approval: -6, discontent: -4 } } },
      { label: '🤝 Пойти на уступки', sub: '−недовольство, +одобрение, −казна', effects: { add: { discontent: -8, approval: 4, treasury: -0.03 } } },
      { label: '📢 Обратиться к нации', sub: 'небольшой эффект', effects: { add: { approval: 1, discontent: -2 } } },
    ],
  },
];

export function rollEvents(game) {
  if (!game) return null;
  const player = game.getPlayer();
  if (!player) return null;
  if (game.pendingEvent) return null;
  if (!chance(0.09)) return null;

  const applicable = EVENT_TEMPLATES.filter(e => {
    try {
      return !e.cond || e.cond(player, game);
    } catch (err) {
      console.warn('[Geopolis] Ошибка в cond события', e.id, err);
      return false;
    }
  });
  if (!applicable.length) return null;

  const weights = applicable.map(e => e.weight || 1);
  const totalW = weights.reduce((a, b) => a + b, 0);
  let r = random() * totalW;
  let chosen = applicable[0];
  for (let i = 0; i < applicable.length; i++) {
    r -= weights[i];
    if (r <= 0) { chosen = applicable[i]; break; }
  }

  // v3.15: привязываем конкретный протест/забастовку к событию,
  // чтобы resolveChoice удалил именно его
  if (chosen.id === 'protest_event' && player.protests?.length) {
    chosen = { ...chosen, _protestId: player.protests[0].id };
  }
  if (chosen.id === 'strike_event' && player.strikes?.length) {
    chosen = { ...chosen, _strikeId: player.strikes[0].id };
  }

  return chosen;
}

export function resolveChoice(game, event, choice) {
  if (!game || !event || !choice) return;
  const player = game.getPlayer();
  if (!player) return;

  try {
    if (choice.effects) applyEffects(player, choice.effects);

    // FIX: после applyEffects пересчитать gdpPerCapita,
    // иначе mul: { gdp: 0.99 } оставит старый gdpPerCapita до следующего tickEconomy
    if (typeof player.gdp === 'number' && typeof player.population === 'number' && player.population > 0) {
      player.gdpPerCapita = (player.gdp * 1e9) / player.population;
    }

    // v3.15: удаляем протест/забастовку после выбора (если событие к ним привязано)
    if (event._protestId && Array.isArray(player.protests)) {
      player.protests = player.protests.filter(p => p.id !== event._protestId);
    }
    if (event._strikeId && Array.isArray(player.strikes)) {
      player.strikes = player.strikes.filter(s => s.id !== event._strikeId);
    }

    // Определяем «хорошо/плохо» по суммарному эффекту
    const add = choice.effects?.add || {};
    let score = 0;
    if (add.approval) score += add.approval;
    if (add.stability) score += add.stability;
    if (add.treasury) score += add.treasury > 0 ? 2 : -2;
    if (add.population) score += add.population > 0 ? 1 : -1;
    // v2.6: учитываем mul.gdp (рост/падение ВВП в процентах)
    const mulGdp = choice.effects?.mul?.gdp;
    if (typeof mulGdp === 'number') {
      score += mulGdp > 1 ? 1 : (mulGdp < 1 ? -1 : 0);
    }
    const kind = score >= 0 ? 'good' : 'bad';

    game.pushNews(event.tag, `${event.title}: ${choice.label}`, kind, player.id);
  } catch (err) {
    console.error('[Geopolis] Ошибка при разрешении события', err);
  } finally {
    game.pendingEvent = null;
  }
}
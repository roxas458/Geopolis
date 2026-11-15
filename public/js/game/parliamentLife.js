// ============================================================
// ПАРЛАМЕНТСКАЯ ЖИЗНЬ (v1.0)
// Обращения, слухи, скандалы, отчёты, заседания.
// Хранится в country.parliamentLife = [] (до 100 событий).
// ============================================================
import { pick, chance, gauss } from '../core/rng.js';
import { clamp, uid } from '../core/util.js';

// ============================================================
// ТИПЫ СОБЫТИЙ
// ============================================================
export const PARLIAMENT_LIFE_TYPES = {
  appeal:  { icon: '📢', name: 'Обращение', color: '#4a7dff' },
  rumor:   { icon: '🗣️', name: 'Слух',      color: '#8b97b8' },
  scandal: { icon: '🔥', name: 'Скандал',   color: '#f0596b' },
  report:  { icon: '📊', name: 'Отчёт',     color: '#3ecf8e' },
  session: { icon: '🏛️', name: 'Заседание', color: '#e6b84c' },
  protest: { icon: '✊', name: 'Протест',   color: '#e0559a' },
};

// ============================================================
// ТЕМЫ (для обращений и слухов)
// ============================================================
const TOPICS = [
  'бюджета', 'налогов', 'обороны', 'образования', 'медицины',
  'инфраструктуры', 'торговли', 'иммиграции', 'свободы прессы',
  'прав меньшинств', 'социальных выплат', 'пенсий', 'коррупции',
  'внешней политики', 'промышленности', 'сельского хозяйства',
  'трудовых прав', 'жилищного вопроса', 'транспорта', 'энергетики',
];

// ============================================================
// ШАБЛОНЫ ОБРАЩЕНИЙ
// ============================================================
const APPEAL_TEMPLATES = [
  'Фракция «{party}» требует пересмотра бюджета на {topic}.',
  'Депутат {name} (округ {district}) обратился к правительству с вопросом о {topic}.',
  'Комитет по {topic} заслушал отчёт министра. Решение отложено.',
  'Парламентская комиссия по {topic} начала проверку.',
  'Спикер {speaker} призвал депутатов к порядку при обсуждении {topic}.',
  'Фракция «{party}» предложила законопроект о {topic}, но он не набрал голосов.',
  'Депутат {name} задал вопрос министру о {topic}. Ответ признан неудовлетворительным.',
  'Бюджетный комитет отклонил поправку о {topic}.',
  'Фракция «{party}» покинула зал в знак протеста против обсуждения {topic}.',
  'Депутат {name} внёс предложение о {topic}. Передано в комитет.',
  'Парламент принял обращение к правительству по вопросу {topic}.',
  'Депутат {name} потребовал отчёта министра о {topic}.',
  'Фракция «{party}» требует создания комиссии по {topic}.',
  'Спикер {speaker} объявил перерыв в заседании из-за споров о {topic}.',
];

// ============================================================
// ШАБЛОНЫ СЛУХОВ
// ============================================================
const RUMOR_TEMPLATES = [
  'Поговаривают, что депутат {name} готовит переход в другую партию.',
  'В кулуарах шепчутся: {name} (округ {district}) недоволен политикой «{party}».',
  'Говорят, {name} тайно встречался с представителями оппозиции.',
  'Слух: {name} собирает подписи против спикера {speaker}.',
  'В коридорах парламента обсуждают возможную отставку {name}.',
  'Говорят, {name} финансируется из-за рубежа. Проверка не подтвердила.',
  'Слух: фракция «{party}» готовит вотум недоверия.',
  'Поговаривают, что {name} болен и может покинуть парламент.',
  'Шепчутся, что {name} получил предложение о министерском портфеле.',
  'Слух: спикер {speaker} собирает сторонников для переизбрания.',
  'Говорят, «{party}» готовит раскол из-за разногласий по {topic}.',
  'В кулуарах обсуждают, что {name} может стать лидером фракции.',
  'Слух: {name} тайно встречался с дипломатами иностранной державы.',
  'Поговаривают, что бюджетный комитет скрывает дефицит.',
];

// ============================================================
// ШАБЛОНЫ СКАНДАЛОВ
// ============================================================
const SCANDAL_TEMPLATES = [
  'Скандал: депутат {name} (округ {district}) замечен в неформальной обстановке с представителем «{party}».',
  'Депутат {name} обвинён в растрате. Партия «{party}» отстранила его от должности.',
  'Публикация в прессе: {name} голосовал против интересов своего округа.',
  'Депутат {name} подрался с коллегой из «{party}». Заседание прервано.',
  'Вскрылись связи {name} с криминалом. Фракция «{party}» отрицает.',
  'Депутат {name} обвинён в использовании служебного положения в личных целях.',
  'Скандал: {name} уличен в подкупе избирателей в округе {district}.',
  'Депутат {name} опубликовал оскорбительное заявление в адрес «{party}».',
  'Партия «{party}» исключила {name} из фракции из-за скандала.',
  'Депутат {name} обвинён в плагиате в научной работе.',
  'Скандал: {name} скрыл доходы от налоговой службы.',
  'Депутат {name} замечен в нетрезвом виде в зале заседаний.',
];

// ============================================================
// ШАБЛОНЫ ОТЧЁТОВ (ежемесячно)
// ============================================================
const REPORT_TEMPLATES = [
  'Спикер {speaker} отчитался о работе парламента за месяц. Принято {billsPassed} законов, отклонено {billsRejected}.',
  'Бюджетный комитет опубликовал отчёт: расходы выросли на {pct}%.',
  'Парламент заслушал отчёт правительства. Фракция «{party}» выразила недоверие.',
  'Комитет по этике отчитался: {scandals} скандалов за месяц.',
  'Спикер {speaker} подвёл итоги сессии. Главные темы: {topic}, {topic}.',
  'Парламент опубликовал статистику голосований. Явка — {attendance}%.',
];

// ============================================================
// ШАБЛОНЫ ЗАСЕДАНИЙ (ежемесячно)
// ============================================================
const SESSION_TEMPLATES = [
  'Открылась новая сессия парламента. Главный вопрос — {topic}.',
  'Парламент собрался на внеочередное заседание по вопросу {topic}.',
  'Фракция «{party}» инициировала обсуждение {topic}.',
  'Состоялись парламентские слушания по {topic}. Приглашены эксперты.',
  'Спикер {speaker} объявил о начале осенней сессии. Приоритет — {topic}.',
  'Парламент обсуждает бюджет на следующий год. Фракции не пришли к согласию.',
];

// ============================================================
// ШАБЛОНЫ ПРОТЕСТОВ (при низком одобрении)
// ============================================================
const PROTEST_TEMPLATES = [
  'Группа депутатов от «{party}» устроила сидячую забастовку в зале заседаний.',
  'Депутаты от оппозиции покинули заседание в знак протеста.',
  'Фракция «{party}» требует отставки спикера {speaker}.',
  'У здания парламента собрались протестующие против политики {topic}.',
  'Депутаты заблокировали трибуну, требуя обсуждения {topic}.',
];

// ============================================================
// ИНИЦИАЛИЗАЦИЯ (для старых сейвов)
// ============================================================
export function initParliamentLife(c) {
  if (!c) return;
  if (!Array.isArray(c.parliamentLife)) c.parliamentLife = [];
}

// ============================================================
// ГЕНЕРАЦИЯ ОДНОГО СОБЫТИЯ
// type: 'appeal' | 'rumor' | 'scandal' | 'report' | 'session' | 'protest'
// ============================================================
export function generateParliamentLife(c, game, type = null) {
  if (!c) return null;
  initParliamentLife(c);

  c.parties = c.parties || [];
  const allDeputies = c.parties.flatMap(p => p.deputies || []);
  if (!allDeputies.length) return null;

  // FIX: chance/pick из rng.js вместо Math.random() — консистентность
  if (!type) {
    const r = chance(0.45) ? 'appeal'
      : chance(0.55) ? 'rumor'
      : chance(0.65) ? 'scandal'
      : 'protest';
    type = r;
  }

  const deputy = pick(allDeputies);
  const party = c.parties.find(p => p.id === deputy.partyId)
    || pick(c.parties.filter(p => p.seats > 0))
    || c.parties[0];
  const speaker = c.speaker;
  const topic = pick(TOPICS);
  const topic2 = pick(TOPICS);

  // Заполнение шаблона
  const fill = (tpl, extra = {}) => {
    let out = tpl
      .replace(/{name}/g, deputy.name || '—')
      .replace(/{party}/g, party?.name || '—')
      .replace(/{district}/g, deputy.district || '—')
      .replace(/{speaker}/g, speaker?.name || '—')
      .replace(/{topic}/g, topic);
    for (const [k, v] of Object.entries(extra)) {
      out = out.replace(new RegExp(`{${k}}`, 'g'), String(v));
    }
    return out;
  };

  let text = '';
  let icon = '📢';

  switch (type) {
    case 'appeal': {
      text = fill(pick(APPEAL_TEMPLATES));
      icon = PARLIAMENT_LIFE_TYPES.appeal.icon;
      break;
    }
    case 'rumor': {
      text = fill(pick(RUMOR_TEMPLATES));
      icon = PARLIAMENT_LIFE_TYPES.rumor.icon;
      deputy.loyalty = clamp((deputy.loyalty || 50) - 1, 0, 99);
      break;
    }
    case 'scandal': {
      text = fill(pick(SCANDAL_TEMPLATES));
      icon = PARLIAMENT_LIFE_TYPES.scandal.icon;
      deputy.scandals = (deputy.scandals || 0) + 1;
      deputy.loyalty = clamp((deputy.loyalty || 50) - 3, 0, 99);
      // FIX: guard от NaN — Number.isFinite
      if (Number.isFinite(c.stability)) c.stability = clamp(c.stability - 0.5, 0, 100);
      if (game) game.pushNews('Парламент', `Скандал: ${deputy.name}`, 'bad', c.id);
      break;
    }
    case 'report': {
      const billsPassed = (c.bills || []).filter(b => b.status === 'passed').length;
      const billsRejected = (c.bills || []).filter(b => b.status === 'rejected').length;
      const scandals = (c.parliamentLife || []).filter(e => e.type === 'scandal').length;
      const pct = Math.round(gauss(3, 2));
      const attendance = clamp(Math.round(60 + gauss(0, 15)), 30, 99);
      text = fill(pick(REPORT_TEMPLATES), {
        billsPassed,
        billsRejected,
        scandals,
        pct: Math.abs(pct),
        attendance,
        topic: topic2,
      });
      icon = PARLIAMENT_LIFE_TYPES.report.icon;
      break;
    }
    case 'session': {
      text = fill(pick(SESSION_TEMPLATES), { topic: topic2 });
      icon = PARLIAMENT_LIFE_TYPES.session.icon;
      break;
    }
    case 'protest': {
      text = fill(pick(PROTEST_TEMPLATES));
      icon = PARLIAMENT_LIFE_TYPES.protest.icon;
      // FIX: guard от NaN
      if (Number.isFinite(c.stability)) c.stability = clamp(c.stability - 1, 0, 100);
      if (Number.isFinite(c.approval)) c.approval = clamp(c.approval - 0.5, 0, 100);
      break;
    }
    default: {
      text = fill(pick(APPEAL_TEMPLATES));
      icon = '📢';
    }
  }

  const event = {
    id: uid(),
    type,
    icon,
    text,
    deputyId: deputy.id,
    deputyName: deputy.name,
    partyId: deputy.partyId,
    partyName: deputy.partyName || party?.name,
    date: { ...(game?.date || c._date || { year: 1936, month: 1, day: 1 }) },
  };

  c.parliamentLife.unshift(event);
  if (c.parliamentLife.length > 100) c.parliamentLife.pop();

  return event;
}

// ============================================================
// ЕЖЕДНЕВНЫЙ ТИК (из tickParliament)
// Шанс 15% в день → событие. Плюс протесты при низком одобрении.
// ============================================================
export function tickParliamentLife(c, game) {
  if (!c) return;
  initParliamentLife(c);
  if (!c.parties || !c.parties.length) return;

  const allDeputies = c.parties.flatMap(p => p.deputies || []);
  if (!allDeputies.length) return;

  // FIX: Number.isFinite вместо ?? — NaN не ловится ??
  const approval = Number.isFinite(c.approval) ? c.approval : 50;
  const stability = Number.isFinite(c.stability) ? c.stability : 55;

  if (approval < 25 && chance(0.10)) {
    generateParliamentLife(c, game, 'protest');
    return;
  }
  if (stability < 30 && chance(0.08)) {
    generateParliamentLife(c, game, 'protest');
    return;
  }

  if (!chance(0.15)) return;
  generateParliamentLife(c, game);
}

// ============================================================
// МЕСЯЧНЫЙ ТИК (крупные события)
// Раз в месяц: отчёт спикера, новая сессия.
// ============================================================
export function tickParliamentLifeMonthly(c, game) {
  if (!c) return;
  initParliamentLife(c);
  if (!c.parties || !c.parties.length) return;

  const allDeputies = c.parties.flatMap(p => p.deputies || []);
  if (!allDeputies.length) return;

  if (chance(0.5)) {
    generateParliamentLife(c, game, 'report');
  }
  if (chance(0.3)) {
    generateParliamentLife(c, game, 'session');
  }
}

// ============================================================
// ПОЛУЧЕНИЕ СОБЫТИЙ
// ============================================================
export function getParliamentLife(c, limit = 20, type = null) {
  const arr = (c && c.parliamentLife) || [];
  const filtered = type ? arr.filter(e => e.type === type) : arr;
  return filtered.slice(0, limit);
}

export function getParliamentLifeByDeputy(c, deputyId, limit = 10) {
  const arr = (c && c.parliamentLife) || [];
  return arr.filter(e => e.deputyId === deputyId).slice(0, limit);
}

// ============================================================
// СВОДКА (для UI-статистики)
// ============================================================
export function getParliamentLifeSummary(c, days = 30) {
  const arr = (c && c.parliamentLife) || [];
  const now = c?._date || { year: 1936, month: 1, day: 1 };
  const nowDay = (now.year - 1936) * 360 + ((now.month || 1) - 1) * 30 + (now.day || 1);

  const recent = arr.filter(e => {
    const d = e.date || { year: 1936, month: 1, day: 1 };
    const dDay = (d.year - 1936) * 360 + ((d.month || 1) - 1) * 30 + (d.day || 1);
    return nowDay - dDay <= days;
  });

  const byType = {};
  for (const t of Object.keys(PARLIAMENT_LIFE_TYPES)) {
    byType[t] = recent.filter(e => e.type === t).length;
  }

  return {
    total: recent.length,
    byType,
    recent: recent.slice(0, 10),
  };
}

// ============================================================
// ВСЕ ДЕПУТАТЫ С ПОЛНЫМИ ДАННЫМИ
// ============================================================
export function getAllDeputiesDetailed(c) {
  const all = [];
  for (const p of c.parties || []) {
    for (const d of (p.deputies || [])) {
      all.push({
        ...d,
        partyId: p.id,
        partyName: p.name,
        partyColor: p.color,
        partySymbol: p.symbol,
        partyIdeology: p.ideology,
      });
    }
  }
  return all;
}

// ============================================================
// СТАТИСТИКА ДЕПУТАТА
// ============================================================
export function getDeputyStats(c, deputyId) {
  const all = getAllDeputiesDetailed(c);
  const d = all.find(x => x.id === deputyId);
  if (!d) return null;

  const life = (c.parliamentLife || []).filter(e => e.deputyId === deputyId);
  const scandals = life.filter(e => e.type === 'scandal').length;
  const rumors = life.filter(e => e.type === 'rumor').length;
  const appeals = life.filter(e => e.type === 'appeal').length;
  const protests = life.filter(e => e.type === 'protest').length;

  const totalScandals = (d.scandals || 0) + scandals;
  const activity = appeals + protests;

  let reputation = 50;
  reputation -= totalScandals * 5;
  reputation -= rumors * 1;
  reputation += activity * 0.5;
  reputation = clamp(Math.round(reputation), 0, 100);

  return {
    deputy: d,
    scandals: totalScandals,
    rumors,
    appeals,
    protests,
    totalLifeEvents: life.length,
    reputation,
    life: life.slice(0, 10),
  };
}

// ============================================================
// ЧИСТКА СТАРЫХ СОБЫТИЙ (чтобы массив не разрастался)
// maxAgeDays — старше какого возраста удалять (по умолчанию 180)
// ============================================================
export function archiveOldParliamentLife(c, maxAgeDays = 180) {
  if (!c || !Array.isArray(c.parliamentLife)) return;
  const now = c._date || { year: 1936, month: 1, day: 1 };
  const nowDay = (now.year - 1936) * 360 + ((now.month || 1) - 1) * 30 + (now.day || 1);

  c.parliamentLife = c.parliamentLife.filter(e => {
    const d = e.date || { year: 1936, month: 1, day: 1 };
    const dDay = (d.year - 1936) * 360 + ((d.month || 1) - 1) * 30 + (d.day || 1);
    return nowDay - dDay <= maxAgeDays;
  });
}
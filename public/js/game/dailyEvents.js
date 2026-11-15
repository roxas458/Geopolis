import { chance, random } from '../core/rng.js';
import { applyEffects } from './effects.js';

const DAILY_TEMPLATES = [
  // ============================================================
  // ЭКОНОМИКА
  // ============================================================
  { id:'bread_prices', tag:'Экономика', weight:3, kind:'info', text:'Цены на хлеб выросли на 2%.', effects:{ add:{ inflation: 0.001 } } },
  { id:'good_harvest', tag:'Экономика', weight:3, kind:'good', text:'Фермеры собрали рекордный урожай.', effects:{ add:{ approval: 1 } } },
  { id:'new_factory', tag:'Экономика', weight:2, kind:'good', text:'Новый завод открылся в столице.', effects:{ mul:{ gdp: 1.005 } } },
  { id:'market_drop', tag:'Экономика', weight:2, kind:'bad', text:'Биржа закрылась с падением.', effects:{ add:{ approval: -1 } } },
  { id:'strike_threat', tag:'Экономика', weight:1, kind:'bad', cond:(c)=> (c.unemployment ?? 0) > 0.1, text:'Профсоюзы угрожают забастовкой.', effects:{ add:{ discontent: 1 } } },
  { id:'stock_boom', tag:'Экономика', weight:1, kind:'good', cond:(c)=> (c.growth ?? 0) > 0.001, text:'Биржа выросла на 3%.', effects:{ add:{ approval: 1 } } },
  { id:'bank_run', tag:'Экономика', weight:1, kind:'bad', cond:(c)=> (c.creditRating ?? 50) < 40, text:'Набег на банки: вкладчики снимают средства.', effects:{ add:{ stability: -1, treasury: -0.02 } } },
  { id:'new_trade_route', tag:'Экономика', weight:1, kind:'good', text:'Открыт новый торговый маршрут.', effects:{ mul:{ exports: 1.02 } } },
  { id:'tax_protest', tag:'Экономика', weight:1, kind:'bad', cond:(c)=> (c.taxes?.income ?? 0) > 0.35, text:'Налоговые протесты в провинции.', effects:{ add:{ discontent: 1, stability: -1 } } },

  // ============================================================
  // ОБЩЕСТВО
  // ============================================================
  { id:'sports_win', tag:'Общество', weight:2, kind:'good', text:'Национальная сборная выиграла матч.', effects:{ add:{ happiness: 1 } } },
  { id:'flu', tag:'Общество', weight:2, kind:'bad', text:'Эпидемия гриппа в провинции.', effects:{ add:{ healthcareLevel: -0.5 } } },
  { id:'university_grant', tag:'Общество', weight:2, kind:'good', text:'Университет получил грант.', effects:{ add:{ educationLevel: 0.5 } } },
  { id:'bank_robbery', tag:'Общество', weight:1, kind:'bad', text:'Криминальная сводка: ограбление банка.', effects:{ add:{ crimeRate: 0.5 } } },
  { id:'charity', tag:'Общество', weight:1, kind:'good', text:'Благотворительная акция собрала средства.', effects:{ add:{ approval: 1 } } },
  { id:'literacy_program', tag:'Общество', weight:1, kind:'good', cond:(c)=> (c.literacy ?? 0.7) < 0.8, text:'Запущена программа ликвидации безграмотности.', effects:{ add:{ literacy: 0.005 } } },
  { id:'crime_wave', tag:'Общество', weight:1, kind:'bad', cond:(c)=> (c.crimeRate ?? 40) > 55, text:'Волна преступности в столице.', effects:{ add:{ crimeRate: 1, approval: -1 } } },
  { id:'womens_rights', tag:'Общество', weight:1, kind:'good', cond:(c)=> (c.humanRights ?? 50) > 50, text:'Женский союз провёл конференцию.', effects:{ add:{ humanRights: 0.5 } } },

  // ============================================================
  // ПОЛИТИКА
  // ============================================================
  { id:'opposition_rally', tag:'Политика', weight:2, kind:'info', text:'Оппозиция провела митинг.', effects:{ add:{ discontent: 1 } } },
  { id:'parliament_resolution', tag:'Политика', weight:2, kind:'info', text:'Парламент принял резолюцию.', effects:{ add:{ stability: 0.5 } } },
  { id:'president_speech', tag:'Политика', weight:2, kind:'good', text:'Президент выступил с речью.', effects:{ add:{ approval: 1 } } },
  { id:'cabinet_scandal', tag:'Политика', weight:1, kind:'bad', text:'Скандал в кабинете министров.', effects:{ add:{ corruption: 0.5 } } },
  { id:'judicial_ruling', tag:'Политика', weight:1, kind:'info', text:'Суд вынес важное решение.', effects:{ add:{ judicialIndependence: 0.5 } } },
  { id:'corruption_leak', tag:'Политика', weight:1, kind:'bad', cond:(c)=> (c.corruption ?? 30) > 50, text:'Утечка о коррупции в правительстве.', effects:{ add:{ approval: -1, pressFreedom: 1 } } },
  { id:'press_crackdown', tag:'Политика', weight:1, kind:'bad', cond:(c)=> (c.pressFreedom ?? 50) < 30, text:'Закрыта оппозиционная газета.', effects:{ add:{ pressFreedom: -1, discontent: 1 } } },

  // ============================================================
  // ПАРЛАМЕНТ
  // ============================================================
  { id:'parliament_fight', tag:'Парламент', weight:2, kind:'bad', cond:(c)=> (c.stability ?? 50) < 50, text:'Потасовка в парламенте.', effects:{ add:{ stability: -1 } } },
  { id:'parliament_walkout', tag:'Парламент', weight:2, kind:'info', text:'Оппозиция покинула заседание в знак протеста.', effects:{ add:{ discontent: 1 } } },
  { id:'parliament_ovation', tag:'Парламент', weight:2, kind:'good', cond:(c)=> (c.approval ?? 50) > 60, text:'Парламент аплодировал речи президента.', effects:{ add:{ approval: 1 } } },
  { id:'parliament_deadlock', tag:'Парламент', weight:1, kind:'bad', cond:(c)=> (c.parties || []).length > 3, text:'Парламентский тупик: коалиция не может договориться.', effects:{ add:{ stability: -1 } } },
  { id:'parliament_new_bill', tag:'Парламент', weight:3, kind:'info', text:'Внесён новый законопроект на рассмотрение.', effects:{} },

  // ============================================================
  // ДИПЛОМАТИЯ
  // ============================================================
  { id:'foreign_visit', tag:'Дипломатия', weight:2, kind:'good', text:'Иностранная делегация прибыла с визитом.', effects:{ add:{ reputation: 0.5 } } },
  { id:'border_tension', tag:'Дипломатия', weight:1, kind:'bad', text:'Соседняя страна провела учения у границы.', effects:{ add:{ stability: -0.5 } } },
  { id:'cultural_exchange', tag:'Дипломатия', weight:2, kind:'good', text:'Подписан культурный обмен.', effects:{ add:{ reputation: 0.5 } } },
  { id:'trade_talks', tag:'Дипломатия', weight:1, kind:'info', text:'Начались торговые переговоры.', effects:{ mul:{ exports: 1.04 } } },
  { id:'embassy_opening', tag:'Дипломатия', weight:1, kind:'good', cond:(c)=> Object.keys(c.embassies || {}).length > 0, text:'Открыто новое посольство.', effects:{ add:{ reputation: 1 } } },
  { id:'spy_scandal', tag:'Дипломатия', weight:1, kind:'bad', cond:(c)=> (c.espionage && Object.keys(c.espionage).length > 0), text:'Шпионский скандал: разоблачён агент.', effects:{ add:{ reputation: -1, stability: -1 } } },

  // ============================================================
  // ПРИРОДА
  // ============================================================
  { id:'drought', tag:'Природа', weight:1, kind:'bad', text:'Засуха в южных провинциях.', effects:{ add:{ agricultureShare: -0.005 } } },
  { id:'flood', tag:'Природа', weight:1, kind:'bad', text:'Наводнение на севере.', effects:{ add:{ infrastructure: -1 } } },
  { id:'warm_winter', tag:'Природа', weight:2, kind:'good', text:'Тёплая зима — урожай будет хорошим.', effects:{ add:{ approval: 1 } } },
  { id:'earthquake', tag:'Природа', weight:1, kind:'bad', text:'Землетрясение в отдалённом регионе.', effects:{ add:{ infrastructure: -1, approval: -1 } } },
  { id:'forest_fire', tag:'Природа', weight:1, kind:'bad', text:'Лесные пожары в провинции.', effects:{ add:{ infrastructure: -0.5, approval: -0.5 } } },

  // ============================================================
  // ВОЙНА
  // ============================================================
  { id:'front_battle', tag:'Война', weight:3, kind:'bad', cond:(c)=> (c.wars||[]).length > 0, text:'Бои на фронте продолжаются.', effects:{ add:{ stability: -1, approval: -1 } } },
  { id:'war_victory', tag:'Война', weight:1, kind:'good', cond:(c)=> (c.wars||[]).length > 0, text:'Армия одержала локальную победу.', effects:{ add:{ approval: 2, stability: 1 } } },
  { id:'war_losses', tag:'Война', weight:2, kind:'bad', cond:(c)=> (c.wars||[]).length > 0, text:'Потери на фронте.', effects:{ add:{ military: { personnel: -500 }, approval: -1 } } },
  { id:'war_hero', tag:'Война', weight:2, kind:'good', cond:(c)=> (c.wars||[]).length > 0, text:'Герой с фронта получил награду.', effects:{ add:{ approval: 2 } } },
  { id:'war_desertion', tag:'Война', weight:2, kind:'bad', cond:(c)=> (c.wars||[]).length > 0, text:'Случаи дезертирства на фронте.', effects:{ add:{ military: { personnel: -200 }, stability: -1 } } },
  { id:'war_supply', tag:'Война', weight:1, kind:'bad', cond:(c)=> (c.wars||[]).length > 0, text:'Проблемы со снабжением армии.', effects:{ add:{ military: { readiness: -2 } } } },
  { id:'war_propaganda', tag:'Война', weight:2, kind:'info', cond:(c)=> (c.wars||[]).length > 0, text:'Военная пропаганда набирает обороты.', effects:{ add:{ approval: 1 } } },
];

export function rollDailyEvents(game) {
  if (!game) return null;
  const player = game.getPlayer();
  if (!player) return null;

  // Шанс 40% в день — не заспамить ленту
  if (!chance(0.40)) return null;

  // Фильтр по условиям
  const applicable = DAILY_TEMPLATES.filter(e => {
    try { return !e.cond || e.cond(player, game); }
    catch { return false; }
  });
  if (!applicable.length) return null;

  // Взвешенный выбор
  const weights = applicable.map(e => Math.max(0.1, Number.isFinite(e.weight) ? e.weight : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  let chosen = applicable[0];
  for (let i = 0; i < applicable.length; i++) {
    r -= weights[i];
    if (r <= 0) { chosen = applicable[i]; break; }
  }

  // Применяем микро-эффекты
  if (chosen.effects) {
    try { applyEffects(player, chosen.effects); }
    catch (err) { console.warn('[dailyEvents] applyEffects error:', err); }
  }

  // Пишем в ленту (только игрок — info; good/bad — всегда)
  game.pushNews(chosen.tag, chosen.text, chosen.kind || 'info', player.id);

  return chosen;
}

export { DAILY_TEMPLATES };
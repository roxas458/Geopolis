import { qs, qsa, el, mount, toast } from './core/dom.js';
import { dateStr, flagStyle, num, pct, pctRaw } from './core/util.js';
import { GameEngine, MAX_SLOTS } from './game/engine.js';
import { generateWorld } from './game/state.js';
import { initSetup } from './ui/setup.js';
import { renderTab, updateView, setTab, openEventModal, isEventModalOpen } from './ui/views.js';
import { initLobby, showLobbyScreen, getCurrentRoom, getCurrentPlayerId, forceLeaveRoom } from './ui/lobby.js';
import { createNetEngine } from './net/netEngine.js';
import { setRoomCode } from './net/actions.js';
import { getSocket, on, pauseRoom, resumeRoom, setSpeed as netSetSpeed, ping } from './net/client.js'; // v3.16: + ping

let engine = null;
let lastRender = 0;
let savesMode = 'menu';
const TAB_DEFAULT = 'overview';

let currentMode = 'single';   // 'single' | 'multiplayer'

let lastRenderedMonth = null;
let lastRenderedYear = null;

// v3.8: перерисовка «Политики» ТОЛЬКО при изменении числа биллей
let lastBillsCount = -1;

// v3.16: интервал пинга
let pingInterval = null;

// ============================================================
// НАСТРОЙКИ
// ============================================================
const DEFAULT_SETTINGS = {
  autosave: true,
  animations: true,
  defaultSpeed: 1,
  uiScale: 100,
};
const SETTINGS_KEY = 'geopolis_settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

let settings = loadSettings();

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) { /* ignore */ }
}

function applySettings() {
  document.body.style.zoom = String(settings.uiScale / 100);
  document.documentElement.classList.toggle('no-animations', !settings.animations);

  const autosave = qs('#set-autosave');
  if (autosave) autosave.checked = settings.autosave;
  const anim = qs('#set-animations');
  if (anim) anim.checked = settings.animations;
  const speed = qs('#set-speed');
  if (speed) speed.value = String(settings.defaultSpeed);
  const scale = qs('#set-scale');
  if (scale) scale.value = String(settings.uiScale);
  const scaleVal = qs('#set-scale-val');
  if (scaleVal) scaleVal.textContent = settings.uiScale + '%';

  if (engine && engine.autoSaveEnabled !== undefined) {
    engine.autoSaveEnabled = settings.autosave;
  }
}

function resetSettings() {
  settings = { ...DEFAULT_SETTINGS };
  saveSettings();
  applySettings();
  toast('Настройки сброшены', 'info');
}

// ============================================================
// НЕБЛОКИРУЮЩИЙ CONFIRM
// ============================================================
function confirmModal(title, text, onConfirm) {
  const modal = document.getElementById('event-modal');
  if (!modal) { if (confirm(text)) onConfirm(); return; }
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');
  mount(modal,
    el('div', { class: 'modal-card' },
      el('h2', {}, title),
      el('p', {}, text),
      el('div', { class: 'mt-16 flex gap-8 wrap' },
        el('button', { class: 'btn small primary', onclick: () => { close(); onConfirm(); } }, 'Да'),
        el('button', { class: 'btn small', onclick: close }, 'Отмена')
      )
    )
  );
}

// ============================================================
// МОБИЛЬНАЯ ОПТИМИЗАЦИЯ
// ============================================================
const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
let userScrolling = false;
let scrollTimeout = null;

function setupMobileScrollProtection() {
  if (!isTouchDevice) return;
  const viewEl = qs('#view');
  if (!viewEl) return;
  viewEl.addEventListener('scroll', () => {
    userScrolling = true;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => { userScrolling = false; }, 800);
  }, { passive: true });
}

// ============================================================
// ЭКРАНЫ
// ============================================================
function show(screenId) {
  qsa('.screen').forEach(s => s.classList.remove('active'));
  const target = qs('#' + screenId);
  if (!target) { console.error('[Geopolis] Экран не найден:', screenId); return; }
  target.classList.add('active');
  if (screenId === 'game-screen') {
    const v = qs('#view');
    if (v) v.scrollTop = 0;
  }
  window.scrollTo(0, 0);
}

function resetRenderState() {
  lastRender = 0;
  lastRenderedMonth = null;
  lastRenderedYear = null;
  lastBillsCount = -1;
}

// ============================================================
// v3.16: ПИНГ (каждые 5 сек, только в мультиплеере)
// ============================================================
function startPingLoop() {
  if (pingInterval) clearInterval(pingInterval);
  if (!engine?.isNetEngine) return;
  pingInterval = setInterval(async () => {
    if (!engine?.isNetEngine) return;
    try {
      const ms = await ping();
      if (typeof engine.setMyPing === 'function') {
        engine.setMyPing(ms);
      }
    } catch (e) { /* ignore */ }
  }, 5000);
}

function stopPingLoop() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

// ============================================================
// ОДИНОЧНАЯ ИГРА
// ============================================================
function startNewGameFlow() {
  if (engine) {
    confirmModal('Новая игра', 'Текущая игра будет сохранена в автослот. Продолжить?', () => {
      try { engine.save('auto'); } catch (e) { /* ignore */ }
      engine.pause?.();
      engine.clearTimer?.();
      engine.listeners = [];
      engine = null;
      resetRenderState();
      show('setup-screen');
    });
    return;
  }
  show('setup-screen');
}

function startGame(playerCountry) {
  if (!playerCountry) {
    console.error('[Geopolis] startGame: нет страны');
    return;
  }
  if (engine) {
    engine.pause?.();
    engine.clearTimer?.();
    engine.listeners = [];
  }
  resetRenderState();
  currentMode = 'single';
  stopPingLoop(); // v3.16: одиночная — без пинга

  try {
    const world = generateWorld(playerCountry);
    engine = new GameEngine({ world, playerId: playerCountry.id });
    engine.autoSaveEnabled = settings.autosave;
    engine.subscribe(onTick);
    engine.start();
    engine.setSpeed(settings.defaultSpeed);
  } catch (err) {
    console.error('[Geopolis] Ошибка запуска игры:', err);
    toast('Не удалось запустить игру: ' + err.message, 'error', 6000);
    return;
  }

  show('game-screen');
  setupMobileScrollProtection();
  refreshTop();
  renderTab(engine, TAB_DEFAULT);
  setTabButtons(TAB_DEFAULT);
  setTab(TAB_DEFAULT);
}

function startWithEngine(loadedEngine) {
  if (!loadedEngine) {
    toast('Не удалось загрузить игру', 'error');
    return;
  }
  if (engine) {
    engine.pause?.();
    engine.clearTimer?.();
    engine.listeners = [];
  }
  engine = loadedEngine;
  engine.autoSaveEnabled = settings.autosave;
  engine.subscribe(onTick);
  engine.start();
  engine.setSpeed(settings.defaultSpeed);
  resetRenderState();
  currentMode = 'single';
  stopPingLoop();
  show('game-screen');
  setupMobileScrollProtection();
  refreshTop();
  renderTab(engine, TAB_DEFAULT);
  setTabButtons(TAB_DEFAULT);
  setTab(TAB_DEFAULT);
}

window.__startGame = startGame;

// ============================================================
// МУЛЬТИПЛЕЕР
// ============================================================
function startMultiplayerGame({ world, playerId, date, news, paused, speed, dayCount, tickCount, roomCode, players }) {
  if (engine) {
    if (typeof engine.destroy === 'function') engine.destroy();
    engine.pause?.();
    engine.clearTimer?.();
    engine.listeners = [];
  }
  resetRenderState();
  currentMode = 'multiplayer';

  try {
    engine = createNetEngine({ world, playerId, date, news, paused, speed, dayCount, tickCount, players }); // v3.16: + players
    if (roomCode) setRoomCode(roomCode);
    engine.subscribe(onTick);
    startPingLoop(); // v3.16
  } catch (err) {
    console.error('[Geopolis] Ошибка мультиплеера:', err);
    toast('Не удалось начать мультиплеер: ' + err.message, 'error');
    return;
  }

  show('game-screen');
  setupMobileScrollProtection();
  refreshTop();
  renderTab(engine, TAB_DEFAULT);
  setTabButtons(TAB_DEFAULT);
  setTab(TAB_DEFAULT);
}

window.__onMultiplayerStart = (code) => {
  const socket = getSocket();
  if (!socket) {
    toast('Нет соединения с сервером', 'error');
    return;
  }

  let started = false;

  const launch = (state) => {
    if (started || !state) return;
    started = true;
    startMultiplayerGame({
      world: state.world,
      playerId: state.playerId,
      date: state.date,
      news: state.news,
      paused: state.paused,
      speed: state.speed,
      dayCount: state.dayCount,
      tickCount: state.tickCount,
      roomCode: code,
      players: state.players, // v3.16
    });
  };

  const off = on('game:state', (state) => {
    launch(state);
    off();
  });

  setTimeout(() => {
    if (!started) {
      off();
      toast('Сервер не прислал состояние игры', 'error');
    }
  }, 3000);

  toast('Подключение к игре...', 'info');
};

// ============================================================
// СОХРАНЕНИЯ (только одиночная)
// ============================================================
function openSavesScreen(mode = 'menu') {
  if (currentMode === 'multiplayer') {
    toast('В мультиплеере сохранение недоступно', 'warn');
    return;
  }
  savesMode = mode;
  const title = qs('#saves-title');
  if (title) title.textContent = mode === 'game' ? 'Сохранить игру' : 'Сохранения';
  renderSavesScreen();
  show('saves-screen');
}

function renderSavesScreen() {
  const grid = qs('#saves-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const inGame = !!engine;
  const allSaves = GameEngine.listSaves();

  const autoSave = allSaves.find(s => s.slot === 'auto');
  grid.appendChild(makeSaveCard('auto', autoSave, inGame));

  for (let i = 1; i <= MAX_SLOTS; i++) {
    const save = allSaves.find(s => s.slot === i);
    grid.appendChild(makeSaveCard(i, save, inGame));
  }
}

function makeSaveCard(slot, save, inGame) {
  const slotLabel = slot === 'auto' ? 'Автосохранение' : `Слот ${slot}`;

  if (!save) {
    return el('div', { class: 'save-card empty' },
      el('div', { class: 'save-card-label' }, slotLabel),
      el('div', { class: 'save-card-empty-text' }, 'Пусто'),
      inGame && slot !== 'auto'
        ? el('button', { class: 'btn small primary', onclick: () => saveToSlot(slot) }, '💾 Сохранить')
        : null
    );
  }

  const m = save.meta || {};
  const dateStr = m.savedAt ? new Date(m.savedAt).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  }) : '—';

  return el('div', { class: 'save-card' },
    el('div', { class: 'save-card-header' },
      el('div', { class: 'save-card-flag', style: { background: flagStyle(m.flag || {}) } }),
      el('div', { class: 'save-card-info' },
        el('div', { class: 'save-card-title' }, m.countryName || '—'),
        el('div', { class: 'save-card-sub' }, slotLabel)
      )
    ),
    el('div', { class: 'save-card-stats' },
      el('div', {}, `👥 ${num(m.population || 0)}`),
      el('div', {}, `💰 $${num(m.gdp || 0)} млрд`),
      el('div', {}, `📊 ${pctRaw(m.approval || 0, 0)}`)
    ),
    el('div', { class: 'save-card-date' }, '🕐 ' + dateStr),
    el('div', { class: 'save-card-actions' },
      el('button', { class: 'btn small primary', onclick: () => loadFromSlot(slot) }, '▶ Загрузить'),
      inGame && slot !== 'auto'
        ? el('button', { class: 'btn small', onclick: () => saveToSlot(slot) }, '💾')
        : null,
      el('button', { class: 'btn small', onclick: () => exportSlot(slot) }, '📤'),
      el('button', { class: 'btn small danger', onclick: () => deleteSlot(slot) }, '🗑️')
    )
  );
}

function saveToSlot(slot) {
  if (!engine) { toast('Игра не запущена', 'warn'); return; }
  if (currentMode === 'multiplayer') { toast('В мультиплеере сохранение недоступно', 'warn'); return; }
  const exists = slot !== 'auto' && localStorage.getItem(`geopolis_save_${slot}`);
  if (exists) {
    confirmModal('Перезаписать слот', `Перезаписать слот ${slot}?`, () => {
      const r = engine.save(slot);
      if (r.ok) {
        toast(`Сохранено в слот ${slot}`, 'success');
        renderSavesScreen();
        updateContinueButton();
      } else {
        toast('Ошибка сохранения: ' + r.reason, 'error');
      }
    });
    return;
  }
  const r = engine.save(slot);
  if (r.ok) {
    toast(`Сохранено в ${slot === 'auto' ? 'автослот' : 'слот ' + slot}`, 'success');
    renderSavesScreen();
    updateContinueButton();
  } else {
    toast('Ошибка сохранения: ' + r.reason, 'error');
  }
}

function loadFromSlot(slot) {
  const loaded = GameEngine.loadSlot(slot);
  if (!loaded) { toast('Не удалось загрузить', 'error'); return; }
  if (engine) {
    confirmModal('Загрузить игру', 'Текущая игра будет потеряна. Продолжить?', () => {
      startWithEngine(loaded);
      toast('Игра загружена', 'success');
    });
    return;
  }
  startWithEngine(loaded);
  toast('Игра загружена', 'success');
}

function deleteSlot(slot) {
  confirmModal('Удалить сохранение', 'Удалить это сохранение?', () => {
    GameEngine.deleteSlot(slot);
    toast('Сохранение удалено', 'info');
    renderSavesScreen();
    updateContinueButton();
  });
}

function exportSlot(slot) {
  const key = slot === 'auto' ? 'geopolis_autosave' : `geopolis_save_${slot}`;
  const raw = localStorage.getItem(key);
  if (!raw) { toast('Сохранение не найдено', 'warn'); return; }
  try {
    const meta = JSON.parse(raw).meta || {};
    const filename = `geopolis_${meta.shortName || 'save'}_${slot}_${Date.now()}.json`;
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast('Файл сохранён', 'success');
  } catch (e) {
    toast('Ошибка экспорта', 'error');
  }
}

function importSave(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || !data.world || !Array.isArray(data.world.countries)) {
        throw new Error('Неверный формат: нет world.countries');
      }
      if (!data.playerId) {
        throw new Error('Неверный формат: нет playerId');
      }
      if (!data.world.countries.some(c => c.id === data.playerId)) {
        throw new Error('playerId не найден среди стран');
      }

      let slot = null;
      for (let i = 1; i <= MAX_SLOTS; i++) {
        if (!localStorage.getItem(`geopolis_save_${i}`)) { slot = i; break; }
      }
      const doImport = (targetSlot) => {
        localStorage.setItem(`geopolis_save_${targetSlot}`, JSON.stringify(data));
        toast(`Импортировано в слот ${targetSlot}`, 'success');
        renderSavesScreen();
        updateContinueButton();
      };
      if (slot === null) {
        confirmModal('Все слоты заняты', 'Перезаписать слот 1?', () => doImport(1));
        return;
      }
      doImport(slot);
    } catch (err) {
      toast('Ошибка импорта: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

// ============================================================
// ПРОДОЛЖИТЬ
// ============================================================
function updateContinueButton() {
  const btn = qs('#btn-continue');
  const info = qs('#continue-info');
  if (!btn) return;
  const latest = GameEngine.getLatestSave();
  if (latest) {
    btn.disabled = false;
    if (info) {
      const m = latest.meta;
      const dt = m.savedAt ? new Date(m.savedAt).toLocaleDateString('ru-RU') : '';
      info.textContent = `${m.countryName || '—'} · ${dt}`;
    }
  } else {
    btn.disabled = true;
    if (info) info.textContent = 'Нет сохранений';
  }
}

function continueGame() {
  const latest = GameEngine.getLatestSave();
  if (!latest) { toast('Нет сохранений', 'warn'); return; }
  const loaded = GameEngine.loadSlot(latest.slot);
  if (!loaded) { toast('Не удалось загрузить', 'error'); return; }
  startWithEngine(loaded);
  toast('Игра загружена', 'success');
}

// ============================================================
// ВОЗВРАТ В МЕНЮ
// ============================================================
function goToMenu() {
  stopPingLoop(); // v3.16
  if (engine) {
    if (currentMode === 'multiplayer') {
      Promise.resolve(forceLeaveRoom()).catch(() => {});
    }
    if (typeof engine.destroy === 'function') engine.destroy();
    if (currentMode !== 'multiplayer') {
      try { engine.save(); } catch (e) { /* ignore */ }
    }
    engine.pause?.();
    engine.clearTimer?.();
    engine.listeners = [];
    engine = null;
  }
  resetRenderState();
  userScrolling = false;
  clearTimeout(scrollTimeout);

  const viewRoot = qs('#view');
  if (viewRoot) viewRoot.innerHTML = '';
  const modal = document.getElementById('event-modal');
  if (modal) modal.classList.add('hidden');

  currentMode = 'single';
  show('menu-screen');
  updateContinueButton();
  toast('Возврат в меню.', 'info', 2500);
}

// ============================================================
// ТОПБАР
// ============================================================
function refreshTop() {
  if (!engine) return;
  const c = engine.getPlayer();
  if (!c) return;

  const flagEl = qs('#top-flag');
  if (flagEl) flagEl.style.background = flagStyle(c.flag);
  const nameEl = qs('#top-name');
  if (nameEl) nameEl.textContent = c.name || '—';
  const subEl = qs('#top-sub');
  if (subEl) {
    const ruling = c.parties?.find(p => p.id === c.rulingPartyId)?.name || '—';
    subEl.textContent = `${c.capital || '—'} · ${pctRaw(c.approval, 0)} одобрение · ${ruling}`;
  }
  const dateEl = qs('#top-date');
  if (dateEl) dateEl.textContent = dateStr(engine.date);
  const dayEl = qs('#top-day');
  if (dayEl) dayEl.textContent = `День ${engine.dayCount || 0}`;

  const statsEl = qs('#top-stats');
  if (statsEl) {
    if (statsEl.children.length !== 3) {
      statsEl.innerHTML = `
        <div class="tb-stat"><div class="v" data-k="gdp">—</div><div class="l">ВВП</div></div>
        <div class="tb-stat"><div class="v" data-k="approval">—</div><div class="l">Одобрение</div></div>
        <div class="tb-stat"><div class="v" data-k="influence">—</div><div class="l">Влияние</div></div>
      `;
    }
    const gdpEl = statsEl.querySelector('[data-k="gdp"]');
    const apprEl = statsEl.querySelector('[data-k="approval"]');
    const inflEl = statsEl.querySelector('[data-k="influence"]');
    if (gdpEl) gdpEl.textContent = '$ ' + num(c.gdp);
    if (apprEl) apprEl.textContent = pctRaw(c.approval, 0);
    if (inflEl) inflEl.textContent = Math.round(c.influence || 0);
  }

  qsa('#speed-controls button').forEach(b => {
    const activeSpeed = engine.paused ? 0 : (engine.speed || 1);
    b.classList.toggle('active', Number(b.dataset.speed) === activeSpeed);
  });

  const saveBtn = qs('#btn-save');
  if (saveBtn) saveBtn.style.display = currentMode === 'multiplayer' ? 'none' : '';
  const speedControls = qs('#speed-controls');
  if (speedControls) speedControls.style.display = '';
}

// ============================================================
// ГЛАВНЫЙ ТИК — ПЛАВНОЕ ОБНОВЛЕНИЕ
// ============================================================
function onTick() {
  if (!engine) return;

  if (window.__uiBusy) return;
  if (isTouchDevice && userScrolling) return;

  refreshTop();

  const now = performance.now();
  let didFullRender = false;

  const c = engine.getPlayer();
  if (c && !engine.paused) {
    const billsCount = (c.bills || []).filter(b => b.status === 'proposed').length;
    const activeTabBtn = qs('#tabs button.active');
    const activeTab = activeTabBtn?.dataset.tab;

    if (billsCount !== lastBillsCount) {
      lastBillsCount = billsCount;
      if (activeTab === 'politics') {
        renderTab(engine, 'politics');
        didFullRender = true;
      }
    }
  }

  if (!didFullRender && now - lastRender >= 400) {
    lastRender = now;
    updateView(engine);
  }

  const currentMonth = engine.date.year * 12 + engine.date.month;
  const currentYear = engine.date.year;

  if (currentMonth !== lastRenderedMonth || currentYear !== lastRenderedYear) {
    lastRenderedMonth = currentMonth;
    lastRenderedYear = currentYear;
    if (!engine.paused) {
      renderTab(engine);
    }
  }

  if (engine.pendingEvent && !isEventModalOpen()) {
    openEventModal(engine, engine.pendingEvent);
  }
}

function setTabButtons(tab) {
  qsa('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
function init() {
  applySettings();

  try {
    initSetup();
    console.log('[Geopolis] initSetup OK');
  } catch (e) {
    console.error('[Geopolis] Ошибка в initSetup:', e);
  }

  try {
    initLobby();
    console.log('[Geopolis] initLobby OK');
  } catch (e) {
    console.error('[Geopolis] Ошибка в initLobby:', e);
  }

  const bind = (id, fn) => { const el = qs(id); if (el) el.addEventListener('click', fn); };

  bind('#btn-new', startNewGameFlow);
  bind('#btn-continue', continueGame);
  bind('#btn-load', () => openSavesScreen('menu'));
  bind('#btn-multiplayer', () => {
    if (engine) {
      confirmModal('Мультиплеер', 'Текущая игра будет потеряна. Продолжить?', () => {
        goToMenu();
        showLobbyScreen();
      });
      return;
    }
    showLobbyScreen();
  });
  bind('#btn-settings', () => { applySettings(); show('settings-screen'); });
  bind('#btn-about', () => {
    // v3.16: версия
    toast('Geopolis v3.16 — HOI4-стиль, 1936. 30 государств, парламент, экономика, дипломатия, мультиплеер, AI-страны, внутренняя безопасность, ники и пинг.', 'info', 6000);
  });

  bind('#btn-settings-back', () => show('menu-screen'));
  bind('#btn-settings-save', () => {
    saveSettings();
    show('menu-screen');
    updateContinueButton();
    toast('Настройки сохранены', 'success');
  });
  bind('#btn-settings-reset', resetSettings);

  const setAutosave = qs('#set-autosave');
  if (setAutosave) setAutosave.addEventListener('change', () => {
    settings.autosave = setAutosave.checked;
    if (engine && engine.autoSaveEnabled !== undefined) engine.autoSaveEnabled = settings.autosave;
    saveSettings();
  });
  const setAnims = qs('#set-animations');
  if (setAnims) setAnims.addEventListener('change', () => {
    settings.animations = setAnims.checked;
    applySettings();
    saveSettings();
  });
  const setSpeedEl = qs('#set-speed');
  if (setSpeedEl) setSpeedEl.addEventListener('change', () => {
    settings.defaultSpeed = Number(setSpeedEl.value);
    saveSettings();
  });
  const setScale = qs('#set-scale');
  if (setScale) setScale.addEventListener('input', () => {
    settings.uiScale = Number(setScale.value);
    applySettings();
    saveSettings();
  });

  bind('#btn-saves-back', () => {
    show(savesMode === 'game' && engine ? 'game-screen' : 'menu-screen');
    updateContinueButton();
  });
  bind('#btn-import-save', () => qs('#input-import-save')?.click());
  const importInput = qs('#input-import-save');
  if (importInput) importInput.addEventListener('change', (e) => {
    if (e.target.files?.[0]) importSave(e.target.files[0]);
    e.target.value = '';
  });

  bind('#btn-save', () => openSavesScreen('game'));
  bind('#btn-to-menu', () => {
    if (!engine) { goToMenu(); return; }
    if (currentMode === 'multiplayer') {
      confirmModal('Выйти из мультиплеера', 'Игра будет потеряна. Продолжить?', goToMenu);
      return;
    }
    confirmModal('Выйти в меню', 'Игра будет сохранена. Продолжить?', goToMenu);
  });
  bind('#btn-setup-back', () => show('menu-screen'));

  qsa('#tabs button').forEach(b => b.addEventListener('click', () => {
    if (!engine) return;
    setTabButtons(b.dataset.tab);
    setTab(b.dataset.tab);
    renderTab(engine, b.dataset.tab);
  }));

  qsa('#speed-controls button').forEach(b => b.addEventListener('click', () => {
    if (!engine) return;
    const s = Number(b.dataset.speed);
    if (!Number.isFinite(s)) return;

    if (currentMode === 'multiplayer') {
      const room = getCurrentRoom();
      if (!room) return;
      if (s === 0) {
        const fn = room.paused ? resumeRoom : pauseRoom;
        fn({ code: room.code }).catch(e => toast('Ошибка: ' + e.message, 'error'));
      } else {
        netSetSpeed({ code: room.code, speed: s }).catch(e => toast('Ошибка: ' + e.message, 'error'));
      }
      return;
    }

    engine.setSpeed(s);
    refreshTop();
  }));

  const modal = document.getElementById('event-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'event-modal') { /* нельзя закрыть */ }
    });
  }

  window.addEventListener('beforeunload', () => {
    if (engine && currentMode !== 'multiplayer') {
      try { engine.save(); } catch (e) { /* ignore */ }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && engine && !engine.paused) {
      refreshTop();
      updateView(engine);
    }
  });

  if (isTouchDevice) {
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });
  }

  updateContinueButton();
}

init();
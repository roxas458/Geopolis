// ============================================================
// ЛОББИ (v3.16, D+C) — создание/вход/выбор страны/персонажа + ник
// ============================================================
import { qs, qsa, el, mount, toast } from '../core/dom.js';
import { flagStyle, num } from '../core/util.js';
import {
  connect, on, createRoom, joinRoom, pickCountry, setReady,
  startRoom, pauseRoom, resumeRoom, listRooms, isConnected,
  waitForConnection, leaveRoom as netLeaveRoom,
  getNick, setNick, // v3.16
} from '../net/client.js';
import { setRoomCode, getRoomCode } from '../net/actions.js';
import { COUNTRY_PRESETS } from '../game/names.js';
import { getHeadOfState, POSITIONS } from '../game/politics.js';

let lobbyInitialized = false;
let currentRoom = null;
let currentPlayerId = null;
let currentPersonId = null;
let currentRole = null;
let unsubscribers = [];

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
export function initLobby() {
  if (lobbyInitialized) return;
  lobbyInitialized = true;

  // === КНОПКИ ЛОББИ ===
  bindSafe('#btn-mp-create', () => handleCreateRoom());
  bindSafe('#btn-mp-join', () => handleJoinRoom());
  bindSafe('#btn-mp-list', () => refreshRoomList());
  bindSafe('#btn-mp-back', () => showScreen('menu-screen'));

  // === КНОПКИ КОМНАТЫ ===
  bindSafe('#btn-room-leave', () => leaveRoom());
  bindSafe('#btn-room-ready', () => toggleReady());
  bindSafe('#btn-room-start', () => startGame());
  bindSafe('#btn-room-pause', () => togglePause());
  bindSafe('#btn-room-back', () => showScreen('menu-screen'));

  // === v3.16: ПОЛЕ НИКА ===
  const nickInput = qs('#mp-nick-input');
  if (nickInput) {
    nickInput.value = getNick();
    nickInput.addEventListener('input', () => {
      setNick(nickInput.value);
    });
  }

  // === ПОДПИСКИ НА СОБЫТИЯ ===
  connect();
  setupSubscriptions();
}

function bindSafe(selector, fn) {
  const node = qs(selector);
  if (node) node.addEventListener('click', fn);
}

function setupSubscriptions() {
  unsubscribers.forEach(u => u());
  unsubscribers = [];

  unsubscribers.push(on('room:update', (room) => {
    currentRoom = room;
    renderRoom(room);
  }));

  unsubscribers.push(on('room:started', (data) => {
    const code = data?.code || currentRoom?.code;
    toast('Игра началась!', 'success');
    if (typeof window.__onMultiplayerStart === 'function') {
      window.__onMultiplayerStart(code);
    }
  }));

  unsubscribers.push(on('room:paused', ({ paused }) => {
    if (currentRoom) currentRoom.paused = paused;
    renderRoomPauseState();
  }));

  unsubscribers.push(on('room:playerLeft', ({ socketId }) => {
    toast('Игрок отключился. Игра на паузе.', 'warn');
  }));

  unsubscribers.push(on('connect', () => {
    if (currentRoom && !currentRoom.started) {
      joinRoom(currentRoom.code).catch(() => {});
    }
  }));
}

// ============================================================
// ЭКРАНЫ
// ============================================================
function showScreen(id) {
  qsa('.screen').forEach(s => s.classList.remove('active'));
  const target = qs('#' + id);
  if (target) target.classList.add('active');
}

export function showLobbyScreen() {
  currentRoom = null;
  currentPlayerId = null;
  currentPersonId = null;
  currentRole = null;
  setRoomCode(null);
  showScreen('lobby-screen');
  refreshRoomList();
}

export function showRoomScreen(room) {
  currentRoom = room;
  showScreen('room-screen');
  renderRoom(room);
}

// ============================================================
// СОЗДАТЬ КОМНАТУ
// ============================================================
async function handleCreateRoom() {
  try {
    await waitForConnection();
    const r = await createRoom();
    if (!r.ok) {
      toast(r.reason || 'Не удалось создать комнату', 'error');
      return;
    }
    setRoomCode(r.room.code);
    currentRoom = r.room;
    currentPlayerId = null;
    currentPersonId = null;
    currentRole = null;
    showRoomScreen(r.room);
    toast(`Комната создана: ${r.room.code}`, 'success');
  } catch (e) {
    toast('Ошибка: ' + e.message, 'error');
  }
}

// ============================================================
// ВОЙТИ В КОМНАТУ
// ============================================================
async function handleJoinRoom() {
  const input = qs('#mp-code-input');
  const code = (input?.value || '').trim().toUpperCase();
  if (!code) {
    toast('Введите код комнаты', 'warn');
    return;
  }
  try {
    await waitForConnection();
    const r = await joinRoom(code);
    if (!r.ok) {
      toast(r.reason || 'Не удалось войти', 'error');
      return;
    }
    setRoomCode(r.room.code);
    currentRoom = r.room;
    currentPlayerId = null;
    currentPersonId = null;
    currentRole = null;
    showRoomScreen(r.room);
    toast(`Вы вошли в комнату ${r.room.code}`, 'success');
  } catch (e) {
    toast('Ошибка: ' + e.message, 'error');
  }
}

// ============================================================
// СПИСОК КОМНАТ
// ============================================================
async function refreshRoomList() {
  const list = qs('#mp-room-list');
  if (!list) return;
  try {
    await waitForConnection();
    const r = await listRooms();
    if (!r.ok) {
      mount(list, el('div', { class: 'empty' }, 'Не удалось загрузить список'));
      return;
    }
    const rooms = (r.rooms || []).filter(room => {
      if (room.started && room.players === 0) return false;
      return true;
    });
    if (!rooms.length) {
      mount(list, el('div', { class: 'empty' }, 'Нет активных комнат'));
      return;
    }
    mount(list, ...rooms.map(room => el('div', { class: 'list-row' },
      el('div', {},
        el('div', { class: 'lr-name' }, room.code),
        el('div', { class: 'lr-sub' }, `${room.players}/${room.maxPlayers} игроков · ${room.started ? 'идёт' : 'ожидание'}`)
      ),
      el('button', {
        class: 'btn small primary',
        disabled: room.started,
        onclick: async () => {
          const input = qs('#mp-code-input');
          if (input) input.value = room.code;
          await handleJoinRoom();
        }
      }, room.started ? 'Идёт' : 'Войти')
    )));
  } catch (e) {
    mount(list, el('div', { class: 'empty' }, 'Ошибка: ' + e.message));
  }
}

// ============================================================
// ПОКИНУТЬ КОМНАТУ
// ============================================================
async function leaveRoom() {
  const code = currentRoom?.code;
  currentRoom = null;
  currentPlayerId = null;
  currentPersonId = null;
  currentRole = null;
  setRoomCode(null);

  if (code) {
    try {
      await waitForConnection(2000);
      await netLeaveRoom({ code });
    } catch (e) {
      console.warn('[lobby] leaveRoom emit failed:', e);
    }
  }

  showScreen('menu-screen');
}

export async function forceLeaveRoom() {
  await leaveRoom();
}

// ============================================================
// РЕНДЕР КОМНАТЫ
// ============================================================
function renderRoom(room) {
  if (!room) return;
  currentRoom = room;

  const title = qs('#room-code-title');
  if (title) title.textContent = room.code;

  renderPlayers(room);
  renderCountryPicker(room);
  renderRoomButtons(room);
  renderRoomPauseState();
}

function renderPlayers(room) {
  const container = qs('#room-players');
  if (!container) return;

  const players = room.players || [];
  if (!players.length) {
    mount(container, el('div', { class: 'empty' }, 'Пока никого'));
    return;
  }

  mount(container, ...players.map(p => el('div', { class: 'list-row' },
    el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } },
      el('span', { class: `dot ${p.connected ? '' : 'red'}`, style: { background: p.connected ? '#3ecf8e' : '#f0596b' } }),
      el('div', {},
        // v3.16: ник + страна
        el('div', { class: 'lr-name' }, `${p.nick || 'Игрок'}${p.isHost ? ' 👑' : ''}`),
        el('div', { class: 'lr-sub' }, `${p.countryName} · ${p.personName} · ${p.role ? POSITIONS[p.role]?.name || p.role : 'без должности'}`)
      )
    ),
    el('span', { class: `badge ${p.ready ? 'good' : 'info'}` }, p.ready ? '✓ Готов' : 'Ожидание')
  )));
}

function renderCountryPicker(room) {
  const container = qs('#room-country-picker');
  if (!container) return;

  const usedIds = new Set((room.players || []).map(p => p.playerId));
  const isMe = (id) => currentPlayerId === id;
  const isStarted = !!room.started;

  mount(container,
    el('div', { class: 'grid cols-3' },
      ...COUNTRY_PRESETS.map(p => {
        const used = usedIds.has(p.id);
        const mine = isMe(p.id);
        const myPlayer = mine
          ? (room.players || []).find(pl => pl.playerId === p.id)
          : null;
        const locked = isStarted || (used && !mine);
        return el('div', {
          class: 'preset-card' + (locked ? ' disabled' : '') + (mine ? ' selected' : ''),
          style: { opacity: locked && !mine ? 0.4 : 1, cursor: locked ? 'not-allowed' : 'pointer' },
          onclick: () => {
            if (locked) return;
            chooseCountry(p);
          }
        },
          el('div', { class: 'flag-box', style: { background: flagStyle(p.flag) } }),
          el('div', {},
            el('div', { class: 'pc-name' }, p.name),
            el('div', { class: 'pc-sub' },
              mine && myPlayer
                ? `✓ ${myPlayer.personName}`
                : isStarted ? 'Игра идёт' : `${p.short} · ${(p.population / 1e6).toFixed(0)} млн`
            )
          )
        );
      })
    )
  );
}

function chooseCountry(preset) {
  if (currentRoom?.started) {
    toast('Игра уже идёт', 'warn');
    return;
  }
  const usedIds = new Set((currentRoom?.players || []).map(p => p.playerId));
  if (usedIds.has(preset.id) && preset.id !== currentPlayerId) {
    toast('Страна уже занята', 'warn');
    return;
  }
  openPersonSelectModal(preset);
}

async function openPersonSelectModal(preset) {
  const modal = qs('#event-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  const { createPresetCountry } = await import('../game/state.js');
  const country = createPresetCountry(preset, false);

  const chars = collectCharacters(country);

  // v3.16: nick передаётся в pickCountry
  const finish = async (person, role, slot) => {
    close();
    try {
      const r = await pickCountry({
        code: currentRoom.code,
        playerId: preset.id,
        countryName: preset.short,
        personName: person?.name || '—',
        personId: person?.id || null,
        role: role || null,
        roleSlot: slot || null,
        nick: getNick() || 'Игрок', // v3.16
      });
      if (!r.ok) {
        toast(r.reason || 'Не удалось выбрать страну', 'error');
        return;
      }
      currentPlayerId = preset.id;
      currentPersonId = person?.id || null;
      currentRole = role || null;
      currentRoom = r.room;
      toast(`Вы играете за ${preset.short}`, 'success');
      renderRoom(r.room);
    } catch (e) {
      toast('Ошибка: ' + e.message, 'error');
    }
  };

  mount(modal,
    el('div', { class: 'modal-card', style: { maxHeight: '90vh', overflowY: 'auto' } },
      el('h2', {}, `👤 Персонаж для ${preset.short}`),
      el('p', { class: 'muted small' }, `Выберите, за кого играть. ${chars.length} персонажей.`),
      el('div', { class: 'modal-choices', style: { maxHeight: '60vh', overflowY: 'auto' } },
        ...chars.map(ch => el('button', { class: 'choice-btn', onclick: () => finish(ch.person, ch.role, ch.slot) },
          el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between' } },
            el('div', {},
              el('div', { style: { fontWeight: '700' } }, ch.person.name),
              el('div', { class: 'muted small' }, `${ch.roleLabel} · ${ch.person.age} лет`)
            ),
            ch.isHead ? el('span', { class: 'badge good' }, '👑 глава') : null
          )
        ))
      ),
      el('div', { class: 'mt-16 flex gap-8' },
        el('button', { class: 'btn small', onclick: () => finish(null, null, null) }, 'Без персонажа (наблюдатель)'),
        el('button', { class: 'btn small', onclick: close }, 'Отмена')
      )
    )
  );
}

function collectCharacters(country) {
  const chars = [];
  const seen = new Set();
  const add = (person, roleLabel, role, slot) => {
    if (!person?.id || seen.has(person.id)) return;
    seen.add(person.id);
    chars.push({ person, roleLabel, role, slot });
  };
  const head = getHeadOfState(country);
  add(country.president, 'Президент', 'president', 'president');
  add(country.primeMinister, 'Премьер-министр', 'prime_minister', 'prime_minister');
  add(country.monarch, 'Монарх', 'monarch', 'monarch');
  add(country.speaker, 'Спикер парламента', null, 'speaker');
  (country.parties || []).forEach((p) => {
    if (p.leader && p.name) {
      add(p.leader, `Лидер «${p.name}»`, null, `party_leader:${p.name}`);
    }
  });
  return chars.map(ch => ({ ...ch, isHead: head.person?.id === ch.person.id }));
}

function renderRoomButtons(room) {
  const players = room.players || [];
  const hostPlayer = players.find(p => p.isHost) || null;
  const isHost = !!hostPlayer && hostPlayer.playerId === currentPlayerId;
  const me = players.find(p => p.playerId === currentPlayerId);
  const amReady = me?.ready || false;
  const allReady = players.length >= 2 && players.every(p => p.ready);

  const readyBtn = qs('#btn-room-ready');
  if (readyBtn) {
    readyBtn.disabled = !currentPlayerId || !!room.started;
    readyBtn.textContent = amReady ? '✗ Не готов' : '✓ Готов';
    readyBtn.className = 'btn ' + (amReady ? 'danger' : 'primary');
  }

  const startBtn = qs('#btn-room-start');
  if (startBtn) {
    startBtn.disabled = !isHost || !allReady || !!room.started;
    startBtn.style.display = isHost ? '' : 'none';
  }

  const pauseBtn = qs('#btn-room-pause');
  if (pauseBtn) {
    pauseBtn.style.display = room.started ? '' : 'none';
    pauseBtn.textContent = room.paused ? '▶ Продолжить' : '❚❚ Пауза';
  }
}

function renderRoomPauseState() {
  const banner = qs('#room-pause-banner');
  if (!banner) return;
  if (currentRoom?.paused) {
    banner.classList.remove('hidden');
    banner.textContent = '⏸ Игра на паузе';
  } else {
    banner.classList.add('hidden');
  }
}

// ============================================================
// ГОТОВНОСТЬ
// ============================================================
async function toggleReady() {
  if (!currentRoom || !currentPlayerId) {
    toast('Сначала выберите страну', 'warn');
    return;
  }
  if (currentRoom.started) {
    toast('Игра уже идёт', 'warn');
    return;
  }
  const me = currentRoom.players?.find(p => p.playerId === currentPlayerId);
  const newReady = !me?.ready;
  try {
    await waitForConnection();
    const r = await setReady({ code: currentRoom.code, ready: newReady });
    if (!r.ok) toast(r.reason || 'Ошибка', 'error');
  } catch (e) {
    toast('Ошибка: ' + e.message, 'error');
  }
}

// ============================================================
// СТАРТ
// ============================================================
async function startGame() {
  if (!currentRoom) return;
  try {
    await waitForConnection();
    const r = await startRoom({ code: currentRoom.code });
    if (!r.ok) toast(r.reason || 'Ошибка', 'error');
  } catch (e) {
    toast('Ошибка: ' + e.message, 'error');
  }
}

// ============================================================
// ПАУЗА
// ============================================================
async function togglePause() {
  if (!currentRoom) return;
  try {
    await waitForConnection();
    if (currentRoom.paused) {
      await resumeRoom({ code: currentRoom.code });
    } else {
      await pauseRoom({ code: currentRoom.code });
    }
  } catch (e) {
    toast('Ошибка: ' + e.message, 'error');
  }
}

// ============================================================
// ЭКСПОРТ
// ============================================================
export function getCurrentRoom() { return currentRoom; }
export function getCurrentPlayerId() { return currentPlayerId; }
export function getCurrentPersonId() { return currentPersonId; }
export function getCurrentRole() { return currentRole; }
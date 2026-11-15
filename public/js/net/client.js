// ============================================================
// WEBSOCKET-КЛИЕНТ (v3.16, D+C) — + скорость, + выход, + roleSlot, + nick, + ping
// ============================================================
import { io } from 'https://cdn.socket.io/4.7.5/socket.io.esm.min.js';

let socket = null;
let listeners = {
  roomUpdate: [],
  roomStarted: [],
  roomPaused: [],
  roomSpeed: [],
  gameState: [],
  playerLeft: [],
  connected: [],
  disconnected: [],
};

export function connect() {
  // FIX: если socket уже создан, но не connected — пробуем переподключиться
  if (socket) {
    if (!socket.connected) {
      try { socket.connect(); } catch (e) { /* ignore */ }
    }
    return socket;
  }

  socket = io({
    // v3.15 FIX: websocket первым (Render поддерживает), polling — fallback
    transports: ['websocket', 'polling'],
    reconnection: true,
    // v3.15 FIX: не сдаваться — Render Free засыпает через 15 мин
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000, // v3.15: таймаут на одно подключение
  });

  socket.on('connect', () => {
    console.log('[ws] connected:', socket.id);
    listeners.connected.forEach(fn => fn(socket.id));
  });

  socket.on('disconnect', (reason) => {
    console.log('[ws] disconnected:', reason);
    listeners.disconnected.forEach(fn => fn(reason));
  });

  // v3.15: логируем connect_error (Render Free может вернуть 502 при пробуждении)
  socket.on('connect_error', (err) => {
    console.warn('[ws] connect_error:', err.message);
  });

  socket.on('room:update', (room) => {
    listeners.roomUpdate.forEach(fn => fn(room));
  });

  socket.on('room:started', (data) => {
    listeners.roomStarted.forEach(fn => fn(data));
  });

  socket.on('room:paused', (data) => {
    listeners.roomPaused.forEach(fn => fn(data));
  });

  socket.on('room:speed', (data) => {
    listeners.roomSpeed.forEach(fn => fn(data));
  });

  socket.on('room:playerLeft', (data) => {
    listeners.playerLeft.forEach(fn => fn(data));
  });

  socket.on('game:state', (state) => {
    listeners.gameState.forEach(fn => fn(state));
  });

  return socket;
}

export function isConnected() {
  return !!(socket && socket.connected);
}

export function getSocket() {
  return socket;
}

// === ДОЖДАТЬСЯ СОЕДИНЕНИЯ (для emit без гонок) ===
// v3.15: таймаут 35 сек — Render Free просыпается до 30 сек
export function waitForConnection(timeoutMs = 35000) {
  return new Promise((resolve, reject) => {
    if (socket && socket.connected) return resolve(socket);
    if (!socket) connect();
    if (!socket) return reject(new Error('Не удалось создать socket'));

    let done = false;
    const onConnect = () => {
      if (done) return;
      done = true;
      clearTimeout(t);
      socket.off('connect', onConnect);
      resolve(socket);
    };
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      socket.off('connect', onConnect);
      reject(new Error('Не дождались соединения с сервером'));
    }, timeoutMs);

    socket.once('connect', onConnect);
  });
}

// === ОБЁРТКА НАД emit С CALLBACK → PROMISE ===
function emit(event, data) {
  return new Promise((resolve, reject) => {
    if (!socket) {
      return reject(new Error('Нет соединения с сервером'));
    }
    // v3.15: для room:* — 35 сек (Render Free просыпается), для остальных — 10 сек
    const isRoomEvent = event.startsWith('room:') || event === 'rooms:list';
    const timeoutMs = isRoomEvent ? 35000 : 10000;
    const timeout = setTimeout(() => reject(new Error('Таймаут запроса: ' + event)), timeoutMs);

    const cb = (response) => {
      clearTimeout(timeout);
      resolve(response);
    };

    // FIX: КРИТИЧНО — всегда передаём data (даже {}), иначе Socket.IO
    // отдаёт серверу (cb) вместо (data, cb) → "cb is not a function".
    const payload = (data === undefined || data === null) ? {} : data;

    try {
      socket.emit(event, payload, cb);
    } catch (e) {
      clearTimeout(timeout);
      reject(e);
    }
  });
}

// === ПОДПИСКА НА СОБЫТИЯ ===
export function on(event, fn) {
  const key = mapEvent(event);
  if (!listeners[key]) listeners[key] = [];
  listeners[key].push(fn);
  return () => off(event, fn);
}

export function off(event, fn) {
  const key = mapEvent(event);
  if (listeners[key]) {
    listeners[key] = listeners[key].filter(f => f !== fn);
  }
}

function mapEvent(event) {
  const map = {
    'room:update': 'roomUpdate',
    'room:started': 'roomStarted',
    'room:paused': 'roomPaused',
    'room:speed': 'roomSpeed',
    'game:state': 'gameState',
    'room:playerLeft': 'playerLeft',
    'connect': 'connected',
    'disconnect': 'disconnected',
  };
  return map[event] || event;
}

// ============================================================
// v3.16: НИК ИГРОКА (localStorage)
// ============================================================
export function getNick() {
  try {
    return localStorage.getItem('geopolis_nick') || '';
  } catch (e) {
    return '';
  }
}
export function setNick(nick) {
  const n = String(nick || '').trim().slice(0, 20);
  try {
    if (n) localStorage.setItem('geopolis_nick', n);
    else localStorage.removeItem('geopolis_nick');
  } catch (e) { /* ignore */ }
  return n;
}

// === API ===
export async function createRoom() {
  return emit('room:create');
}

export async function joinRoom(code) {
  return emit('room:join', { code });
}

// v3.16: pickCountry передаёт nick (из аргумента или localStorage)
export async function pickCountry({ code, playerId, countryName, personName, personId, role, roleSlot, nick }) {
  return emit('room:pickCountry', {
    code, playerId, countryName, personName, personId, role, roleSlot,
    nick: nick || getNick() || 'Игрок',
  });
}

export async function setReady({ code, ready }) {
  return emit('room:ready', { code, ready });
}

export async function startRoom({ code }) {
  return emit('room:start', { code });
}

export async function pauseRoom({ code }) {
  return emit('room:pause', { code });
}

export async function resumeRoom({ code }) {
  return emit('room:resume', { code });
}

// скорость (0 = пауза, 1..5 = скорость, только хост)
export async function setSpeed({ code, speed }) {
  return emit('room:speed', { code, speed });
}

// выход из комнаты (удаляет игрока на сервере)
export async function leaveRoom({ code }) {
  return emit('room:leave', { code });
}

export async function sendAction({ code, action }) {
  return emit('game:action', { code, action });
}

export async function listRooms() {
  return emit('rooms:list');
}

// ============================================================
// v3.16: ПИНГ (RTT через emit → cb) + ping:report
// ============================================================
export async function ping() {
  const start = Date.now();
  await emit('ping', { ping: 0 });
  const rtt = Date.now() - start;
  // v3.16 FIX: отправляем RTT на сервер (fire-and-forget), чтобы другие видели
  try {
    if (socket && socket.connected) {
      socket.emit('ping:report', { ping: rtt }, () => {});
    }
  } catch (e) { /* ignore */ }
  return rtt;
}
// ============================================================
// WEBSOCKET-КЛИЕНТ (v3.16.2, D+C) — + скорость, + выход, + roleSlot, + nick, + ping
// FIX: polling ПЕРВЫМ (Render), timeout 60s, tryAllTransports
// ============================================================
import { io } from 'https://cdn.socket.io/4.7.5/socket.io.esm.min.js';

let socket = null;
let initialized = false;
let listeners = {
  roomUpdate: [],
  roomStarted: [],
  roomPaused: [],
  roomSpeed: [],
  gameState: [],
  playerLeft: [],
  connected: [],
  disconnected: [],
  connectError: [],
};

export function connect() {
  if (socket) {
    if (!socket.connected) {
      try { socket.connect(); } catch (e) { /* ignore */ }
    }
    return socket;
  }

  socket = io({
    // FIX: polling ПЕРВЫМ — Render-прокси пропускает polling всегда,
    // затем апгрейд до websocket. Если апгрейд не удался — polling остаётся.
    transports: ['polling', 'websocket'],
    tryAllTransports: true,
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 60000, // Render Free просыпается до 60 сек
  });

  if (initialized) return socket;
  initialized = true;

  socket.on('connect', () => {
    console.log('[ws] connected:', socket.id);
    listeners.connected.forEach(fn => fn(socket.id));
  });

  socket.on('disconnect', (reason) => {
    console.log('[ws] disconnected:', reason);
    listeners.disconnected.forEach(fn => fn(reason));
  });

  socket.on('connect_error', (err) => {
    console.warn('[ws] connect_error:', err.message);
    listeners.connectError.forEach(fn => fn(err));
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

// === ДОЖДАТЬСЯ СОЕДИНЕНИЯ ===
export function waitForConnection(timeoutMs = 60000) {
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
    const isRoomEvent = event.startsWith('room:') || event === 'rooms:list';
    const timeoutMs = isRoomEvent ? 35000 : 10000;
    const timeout = setTimeout(() => reject(new Error('Таймаут запроса: ' + event)), timeoutMs);

    const cb = (response) => {
      clearTimeout(timeout);
      resolve(response);
    };

    const payload = (data === undefined || data === null) ? {} : data;

    try {
      socket.emit(event, payload, cb);
    } catch (e) {
      clearTimeout(timeout);
      reject(e);
    }
  });
}

// FIX: emit с ожиданием соединения — для холодного Render / быстрого клика на ПК
async function emitWithWait(event, data, timeoutMs = 60000) {
  if (!socket) connect();
  if (socket && !socket.connected) {
    await waitForConnection(timeoutMs);
  }
  return emit(event, data);
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
    'connect_error': 'connectError',
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
  return emitWithWait('room:create', {}, 60000);
}

export async function joinRoom(code) {
  return emitWithWait('room:join', { code }, 60000);
}

export async function pickCountry({ code, playerId, countryName, personName, personId, role, roleSlot, nick }) {
  return emitWithWait('room:pickCountry', {
    code, playerId, countryName, personName, personId, role, roleSlot,
    nick: nick || getNick() || 'Игрок',
  }, 60000);
}

export async function setReady({ code, ready }) {
  return emitWithWait('room:ready', { code, ready }, 60000);
}

export async function startRoom({ code }) {
  return emitWithWait('room:start', { code }, 60000);
}

export async function pauseRoom({ code }) {
  return emitWithWait('room:pause', { code }, 60000);
}

export async function resumeRoom({ code }) {
  return emitWithWait('room:resume', { code }, 60000);
}

export async function setSpeed({ code, speed }) {
  return emitWithWait('room:speed', { code, speed }, 60000);
}

export async function leaveRoom({ code }) {
  return emitWithWait('room:leave', { code }, 60000);
}

export async function sendAction({ code, action }) {
  return emitWithWait('game:action', { code, action }, 60000);
}

export async function listRooms() {
  return emitWithWait('rooms:list', {}, 60000);
}

// ============================================================
// v3.16: ПИНГ (RTT через emit → cb) + ping:report
// ============================================================
export async function ping() {
  if (!socket || !socket.connected) return null;
  const start = Date.now();
  try {
    await emit('ping', { ping: 0 });
  } catch (e) {
    return null;
  }
  const rtt = Date.now() - start;
  try {
    if (socket && socket.connected) {
      socket.emit('ping:report', { ping: rtt }, () => {});
    }
  } catch (e) { /* ignore */ }
  return rtt;
}
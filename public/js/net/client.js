// ============================================================
// WEBSOCKET-КЛИЕНТ (v3.13, D+C) — + скорость, + выход, + roleSlot
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
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('[ws] connected:', socket.id);
    listeners.connected.forEach(fn => fn(socket.id));
  });

  socket.on('disconnect', (reason) => {
    console.log('[ws] disconnected:', reason);
    listeners.disconnected.forEach(fn => fn(reason));
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
// FIX: снимаем слушатель 'connect' при таймауте, чтобы не копить утечки
export function waitForConnection(timeoutMs = 5000) {
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
    const timeout = setTimeout(() => reject(new Error('Таймаут запроса: ' + event)), 5000);

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
  // FIX: инициализируем массив для неизвестных событий,
  // иначе слушатель молча теряется
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

// === API ===
export async function createRoom() {
  return emit('room:create');
}

export async function joinRoom(code) {
  return emit('room:join', { code });
}

// v3.3: roleSlot — стабильный ключ ('president', 'prime_minister', 'monarch',
// 'speaker', 'party_leader:0', ...) вместо personId (id разные на клиенте и сервере)
export async function pickCountry({ code, playerId, countryName, personName, personId, role, roleSlot }) {
  return emit('room:pickCountry', { code, playerId, countryName, personName, personId, role, roleSlot });
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
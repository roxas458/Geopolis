// ============================================================
// SERVER.JS — Express + Socket.IO (v3.16.1, D+C)
// FIX: cors, room:create guard, ping-обработчики, disconnect
// ============================================================
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import {
  createRoom, getRoom, deleteRoom,
  findRoomBySocket, registerSocket, unregisterSocket,
  listRooms, cleanupEmptyRooms,
} from './server/rooms.js';

const PORT = process.env.PORT || 3000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  // FIX: origin: true — отражает origin запроса (работает и localhost, и onrender.com)
  // '*' тоже ок, но true безопаснее с credentials и не ломает WS-хендшейк
  cors: {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST'],
  },
  // FIX: разрешаем polling+websocket, чтобы за прокси Render был fallback
  transports: ['polling', 'websocket'],
  pingInterval: 25000,
  pingTimeout: 60000,
});

// ============================================================
// ХЕЛПЕР: защита от (cb) вместо (data, cb)
// ============================================================
function withCb(fn) {
  return function (data, cb) {
    if (typeof data === 'function') {
      cb = data;
      data = {};
    }
    return fn.call(this, data, cb);
  };
}

// ============================================================
// v3.15 FIX: проверка хоста по playerId (переподключение Socket.IO)
// ============================================================
function isHostOfRoom(socket, room) {
  if (!room) return false;
  if (room.hostSocketId === socket.id) return true;
  const ref = findRoomBySocket(socket.id);
  if (!ref || !ref.playerId) return false;
  const p = (room.players || []).find(x => x.playerId === ref.playerId);
  return !!(p && p.isHost);
}

// ============================================================
// СТАТИКА
// ============================================================
app.use(express.static('public'));

app.get('/health', (req, res) => {
  res.json({ ok: true, rooms: listRooms().length, version: '3.16.1', uptime: process.uptime() });
});

// ============================================================
// SOCKET.IO
// ============================================================
io.on('connection', (socket) => {
  console.log('[ws] connected:', socket.id);

  // === СОЗДАТЬ КОМНАТУ ===
  socket.on('room:create', withCb((data, cb) => {
    try {
      // FIX: guard — если сокет уже в комнате, вернуть её, а не плодить новые
      const existingRef = findRoomBySocket(socket.id);
      if (existingRef && existingRef.room) {
        return cb({ ok: true, code: existingRef.room.code, room: existingRef.room.toJSON() });
      }

      const room = createRoom(socket.id);
      if (!room) return cb({ ok: false, reason: 'Не удалось создать комнату' });
      socket.join(room.code);
      socket.data.roomCode = room.code;
      registerSocket(socket.id, room.code, null);
      cb({ ok: true, code: room.code, room: room.toJSON() });
    } catch (e) {
      console.error('[room:create] error:', e);
      cb({ ok: false, reason: e.message });
    }
  }));

  // === ВОЙТИ В КОМНАТУ ===
  socket.on('room:join', withCb((data, cb) => {
    try {
      const room = getRoom(data?.code);
      if (!room) return cb({ ok: false, reason: 'Комната не найдена' });
      if (room.players.length >= room.maxPlayers) {
        return cb({ ok: false, reason: 'Комната заполнена' });
      }
      socket.join(room.code);
      socket.data.roomCode = room.code;
      registerSocket(socket.id, room.code, null);
      cb({ ok: true, room: room.toJSON() });
    } catch (e) {
      console.error('[room:join] error:', e);
      cb({ ok: false, reason: e.message });
    }
  }));

  // === ВЫБРАТЬ СТРАНУ / ПЕРСОНАЖА ===
  socket.on('room:pickCountry', withCb((data, cb) => {
    try {
      const room = getRoom(data?.code);
      if (!room) return cb({ ok: false, reason: 'Комната не найдена' });
      if (room.started) return cb({ ok: false, reason: 'Игра уже начата' });

      const r = room.addPlayer(
        socket.id,
        data.playerId,
        data.countryName,
        data.personName,
        data.personId,
        data.role,
        data.roleSlot,
        data.nick,
      );
      if (!r.ok) return cb(r);

      registerSocket(socket.id, room.code, data.playerId);
      io.to(room.code).emit('room:update', room.toJSON());
      cb({ ok: true, room: room.toJSON() });
    } catch (e) {
      console.error('[room:pickCountry] error:', e);
      cb({ ok: false, reason: e.message });
    }
  }));

  // === ГОТОВНОСТЬ ===
  socket.on('room:ready', withCb((data, cb) => {
    try {
      const room = getRoom(data?.code);
      if (!room) return cb({ ok: false, reason: 'Комната не найдена' });
      room.setReady(socket.id, !!data.ready);
      io.to(room.code).emit('room:update', room.toJSON());
      cb({ ok: true, room: room.toJSON() });
    } catch (e) {
      console.error('[room:ready] error:', e);
      cb({ ok: false, reason: e.message });
    }
  }));

  // === СТАРТ ИГРЫ ===
  socket.on('room:start', withCb((data, cb) => {
    try {
      const room = getRoom(data?.code);
      if (!room) return cb({ ok: false, reason: 'Комната не найдена' });
      if (!isHostOfRoom(socket, room)) {
        return cb({ ok: false, reason: 'Только хост может начать игру' });
      }
      if (!room.allReady()) {
        return cb({ ok: false, reason: 'Не все игроки готовы' });
      }

      const r = room.start(io);
      if (!r.ok) return cb(r);

      room.broadcastState(io);
      io.to(room.code).emit('room:started', { started: true, speed: room.speed, code: room.code });
      io.to(room.code).emit('room:update', room.toJSON());
      cb({ ok: true, room: room.toJSON() });
    } catch (e) {
      console.error('[room:start] error:', e);
      cb({ ok: false, reason: e.message });
    }
  }));

  // === СКОРОСТЬ (0 = пауза, 1..5) ===
  socket.on('room:speed', withCb((data, cb) => {
    try {
      const room = getRoom(data?.code);
      if (!room) return cb({ ok: false, reason: 'Комната не найдена' });
      if (!isHostOfRoom(socket, room)) {
        return cb({ ok: false, reason: 'Только хост может менять скорость' });
      }
      const r = room.setSpeed(data.speed);
      io.to(room.code).emit('room:speed', { speed: room.speed, paused: room.paused });
      cb(r);
    } catch (e) {
      console.error('[room:speed] error:', e);
      cb({ ok: false, reason: e.message });
    }
  }));

  // === ПАУЗА ===
  socket.on('room:pause', withCb((data, cb) => {
    try {
      const room = getRoom(data?.code);
      if (!room) return cb({ ok: false, reason: 'Комната не найдена' });
      if (!isHostOfRoom(socket, room)) {
        return cb({ ok: false, reason: 'Только хост может ставить паузу' });
      }
      room.pause(io);
      cb({ ok: true, paused: room.paused });
    } catch (e) {
      console.error('[room:pause] error:', e);
      cb({ ok: false, reason: e.message });
    }
  }));

  // === ВОЗОБНОВИТЬ ===
  socket.on('room:resume', withCb((data, cb) => {
    try {
      const room = getRoom(data?.code);
      if (!room) return cb({ ok: false, reason: 'Комната не найдена' });
      if (!isHostOfRoom(socket, room)) {
        return cb({ ok: false, reason: 'Только хост может возобновить' });
      }
      room.resume(io);
      cb({ ok: true, paused: room.paused });
    } catch (e) {
      console.error('[room:resume] error:', e);
      cb({ ok: false, reason: e.message });
    }
  }));

  // === ВЫЙТИ ИЗ КОМНАТЫ ===
  socket.on('room:leave', withCb((data, cb) => {
    try {
      const code = data?.code || socket.data.roomCode;
      const room = getRoom(code);
      if (!room) return cb({ ok: true });

      room.removePlayer(socket.id);
      unregisterSocket(socket.id);
      socket.leave(code);
      socket.data.roomCode = null;

      if (room.isEmpty()) {
        deleteRoom(room.code);
      } else {
        if (room.started) room.pause(io);
        io.to(room.code).emit('room:update', room.toJSON());
        io.to(room.code).emit('room:playerLeft', { socketId: socket.id });
      }
      cb({ ok: true });
    } catch (e) {
      console.error('[room:leave] error:', e);
      cb({ ok: false, reason: e.message });
    }
  }));

  // === СПИСОК КОМНАТ ===
  socket.on('rooms:list', withCb((data, cb) => {
    try {
      cb({ ok: true, rooms: listRooms() });
    } catch (e) {
      console.error('[rooms:list] error:', e);
      cb({ ok: false, reason: e.message });
    }
  }));

  // === v3.16: ПИНГ (клиент шлёт — сервер отвечает RTT) ===
  socket.on('ping', withCb((data, cb) => {
    try {
      if (typeof cb === 'function') cb({ ok: true, ts: Date.now() });
    } catch (e) {
      if (typeof cb === 'function') cb({ ok: false, reason: e.message });
    }
  }));

  // === v3.16: ПИНГ-ОТЧЁТ (клиент сообщает свой RTT, сохраняем для всех) ===
  socket.on('ping:report', withCb((data, cb) => {
    try {
      const ref = findRoomBySocket(socket.id);
      if (ref && ref.room) {
        const ping = Number(data?.ping) || 0;
        if (ping > 0) ref.room.setPing(socket.id, ping);
      }
      if (typeof cb === 'function') cb({ ok: true });
    } catch (e) {
      if (typeof cb === 'function') cb({ ok: false, reason: e.message });
    }
  }));

  // === ДЕЙСТВИЕ ИГРОКА ===
  socket.on('game:action', withCb((data, cb) => {
    try {
      const room = getRoom(data?.code);
      if (!room) return cb({ ok: false, reason: 'Комната не найдена' });
      if (!room.started) return cb({ ok: false, reason: 'Игра не начата' });

      const result = room.handleAction(socket.id, data.action);
      room.broadcastState(io);
      cb(result);
    } catch (e) {
      console.error('[game:action] error:', e);
      cb({ ok: false, reason: e.message });
    }
  }));

  // === DISCONNECT ===
  socket.on('disconnect', (reason) => {
    console.log('[ws] disconnected:', socket.id, reason);

    const ref = findRoomBySocket(socket.id);
    if (!ref || !ref.room) {
      unregisterSocket(socket.id);
      return;
    }
    const room = ref.room;

    room.setConnected(socket.id, false);

    if (room.started) {
      room.pause(io);
    }

    const anyConnected = room.players.some(p => p.connected);
    if (!anyConnected && !room.started) {
      deleteRoom(room.code);
    } else if (!anyConnected && room.started) {
      setTimeout(() => {
        const r = getRoom(room.code);
        if (r && !r.players.some(p => p.connected)) {
          deleteRoom(room.code);
        }
      }, 60_000);
    } else {
      io.to(room.code).emit('room:update', room.toJSON());
      io.to(room.code).emit('room:playerLeft', { socketId: socket.id });
    }

    unregisterSocket(socket.id);
  });
});

// ============================================================
// ПЕРИОДИЧЕСКАЯ ОЧИСТКА
// ============================================================
setInterval(() => {
  try { cleanupEmptyRooms(); } catch (e) { console.error('[cleanup] error:', e); }
}, 5 * 60_000);

// ============================================================
// ЗАПУСК
// ============================================================
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Geopolis] server on port ${PORT}`);
  console.log(`[Geopolis] static: public/`);
});
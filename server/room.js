// ============================================================
// КОМНАТА (v3.16, D+C) — speed + roleSlot + isHost + nick
// ============================================================
import { GameEngine } from '../public/js/game/engine.js';
import { createPresetCountry } from '../public/js/game/state.js';
import { COUNTRY_PRESETS } from '../public/js/game/names.js';
import { getHeadOfState, initPartyGoal, initPersonGoal, findPersonById } from '../public/js/game/politics.js';
import { filterWorldForPlayer } from './sync.js';
import { handleAction } from './actions.js';

const MAX_PLAYERS = 5;
const TICK_MS = 1000; // 1 день = 1 сек при speed = 1

export class Room {
  constructor(code, hostSocketId) {
    this.code = code;
    this.hostSocketId = hostSocketId;
    this.players = [];         // { socketId, playerId, ..., isHost, nick, ready, connected }
    this.started = false;
    this.engine = null;
    this.tickInterval = null;
    this.paused = false;
    this.speed = 1;            // 1, 2, 3, 5
    this.io = null;            // сохраняем для setSpeed
    this.maxPlayers = MAX_PLAYERS;
  }

  // ============================================================
  // ИГРОКИ
  // ============================================================
  addPlayer(socketId, playerId, countryName, personName, personId, role, roleSlot, nick) {
    if (this.players.length >= this.maxPlayers) {
      return { ok: false, reason: 'Комната заполнена' };
    }
    if (this.players.some(p => p.playerId === playerId)) {
      return { ok: false, reason: 'Страна уже занята' };
    }
    if (this.players.some(p => p.socketId === socketId)) {
      return { ok: false, reason: 'Вы уже в комнате' };
    }

    const isHost = this.players.length === 0; // v3.15: первый = хост
    this.players.push({
      socketId,
      playerId,
      countryName: countryName || playerId,
      personName: personName || '—',
      personId: personId || null,
      role: role || null,
      roleSlot: roleSlot || null,
      nick: String(nick || 'Игрок').trim().slice(0, 20) || 'Игрок', // v3.16
      ready: false,
      connected: true,
      isHost, // v3.15
    });
    if (isHost) this.hostSocketId = socketId;
    return { ok: true };
  }

  removePlayer(socketId) {
    const idx = this.players.findIndex(p => p.socketId === socketId);
    if (idx === -1) return false;
    const wasHost = this.players[idx].isHost || socketId === this.hostSocketId;
    this.players.splice(idx, 1);
    // v3.15: если ушёл хост — передаём следующему
    if (wasHost && this.players.length > 0) {
      this.players[0].isHost = true;
      this.hostSocketId = this.players[0].socketId;
    }
    return true;
  }

  setConnected(socketId, connected) {
    const p = this.players.find(x => x.socketId === socketId);
    if (p) p.connected = connected;
  }

  setReady(socketId, ready) {
    const p = this.players.find(x => x.socketId === socketId);
    if (p) p.ready = ready;
  }

  isEmpty() {
    return this.players.length === 0;
  }

  allReady() {
    return this.players.length >= 2 && this.players.every(p => p.ready);
  }

  // ============================================================
  // СТАРТ ИГРЫ
  // ============================================================
  start(io) {
    if (this.started) return { ok: false, reason: 'Уже начато' };
    if (!this.allReady()) return { ok: false, reason: 'Не все готовы' };

    this.io = io;

    // === 1. Создаём все 30 стран ===
    const countries = COUNTRY_PRESETS.map(p => createPresetCountry(p, false));

    // === 2. Привязываем игроков к странам ===
    for (const p of this.players) {
      const country = countries.find(c => c.id === p.playerId);
      if (!country) continue;

      country.isPlayer = true;
      const head = getHeadOfState(country);

      // v3.3: находим персонажа по roleSlot
      let person = null;
      let partyIdFromSlot = null;
      if (p.roleSlot) {
        if (p.roleSlot === 'president') person = country.president;
        else if (p.roleSlot === 'prime_minister') person = country.primeMinister;
        else if (p.roleSlot === 'monarch') person = country.monarch;
        else if (p.roleSlot === 'speaker') person = country.speaker;
        else if (p.roleSlot.startsWith('party_leader:')) {
          // FIX: ищем партию по имени, а не по индексу
          const name = p.roleSlot.slice('party_leader:'.length);
          const party = country.parties?.find(x => x.name === name);
          person = party?.leader || null;
          partyIdFromSlot = party?.id || null;
        }
      }

      if (person) {
        country.playerPersonId = person.id;
        const isHead = head.person?.id === person.id;
        country.playerRole = isHead ? head.position : null;
        country.playerInPower = isHead;
        country.playerPartyId = partyIdFromSlot || person.partyId || head.partyId || null;
      } else {
        // Fallback — глава
        country.playerPersonId = head.person?.id || null;
        country.playerRole = head.position || null;
        country.playerPartyId = head.partyId || null;
        country.playerInPower = true;
      }

      // === 3. Цели ===
      try {
        if (country.playerPartyId && !country.playerPartyGoal) initPartyGoal(country);
        if (country.playerPersonId && !country.playerPersonGoal) initPersonGoal(country);
      } catch (e) {
        console.warn(`[Room ${this.code}] initGoal error (${country.id}):`, e);
      }
    }

    // === 4. Собираем world ===
    const world = {
      countries,
      organizations: [
        { id: 'world_league', name: 'Всемирная Лига', members: countries.filter(c => c.ideology !== 'communist').map(c => c.id) },
        { id: 'eastern_bloc', name: 'Восточный Блок', members: countries.filter(c => c.ideology === 'communist').map(c => c.id) },
        { id: 'western_pact', name: 'Западный Пакт', members: countries.filter(c => ['liberal','conservative','centrist','social_democrat'].includes(c.ideology)).slice(0, 5).map(c => c.id) },
      ].filter(o => o.members.length > 1),
    };

    // === 5. Создаём движок с playerIds ===
    const playerIds = this.players.map(p => p.playerId);
    this.engine = new GameEngine({
      world,
      playerId: playerIds[0],
      playerIds,
      date: { year: 1936, month: 1, day: 1 },
    });

    // v3.15: гарантируем, что хост есть
    if (!this.players.some(p => p.isHost) && this.players.length > 0) {
      this.players[0].isHost = true;
      this.hostSocketId = this.players[0].socketId;
    }

    this.started = true;
    this.paused = false;
    this.speed = 1;

    // === 6. Запускаем тик ===
    this.startTick(io);

    return { ok: true };
  }

  // ============================================================
  // ТИК
  // ============================================================
  startTick(io) {
    if (io) this.io = io;
    this.stopTick();
    if (this.paused) return;

    const ms = Math.max(100, TICK_MS / (this.speed || 1));
    this.tickInterval = setInterval(() => {
      if (!this.engine || this.paused) return;
      try {
        this.engine.tick();
        this.broadcastState(this.io);
      } catch (e) {
        console.error(`[Room ${this.code}] tick error:`, e);
      }
    }, ms);
  }

  stopTick() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  pause(io) {
    if (io) this.io = io;
    if (this.paused) return;
    this.paused = true;
    this.stopTick();
    if (this.io) {
      this.io.to(this.code).emit('room:paused', { paused: true, speed: this.speed });
    }
  }

  resume(io) {
    if (io) this.io = io;
    if (!this.paused) return;
    this.paused = false;
    this.startTick(this.io);
    if (this.io) {
      this.io.to(this.code).emit('room:paused', { paused: false, speed: this.speed });
    }
  }

  // скорость 0 = пауза, 1..5 = скорость
  setSpeed(speed) {
    const s = Math.max(0, Math.min(5, Number(speed) || 1));

    if (s === 0) {
      this.pause(this.io);
      return { ok: true, speed: this.speed, paused: this.paused };
    }

    this.speed = s;
    if (this.paused) {
      this.paused = false;
    }
    this.startTick(this.io);

    if (this.io) {
      this.io.to(this.code).emit('room:paused', { paused: false, speed: this.speed });
    }
    return { ok: true, speed: this.speed, paused: this.paused };
  }

  // ============================================================
  // СИНХРОНИЗАЦИЯ
  // ============================================================
  broadcastState(io) {
    if (!this.engine) return;
    for (const p of this.players) {
      if (!p.connected) continue;
      try {
        const filtered = filterWorldForPlayer(this.engine, p.playerId);
        io.to(p.socketId).emit('game:state', {
          date: this.engine.date,
          world: filtered,
          playerId: p.playerId,
          news: this.engine.news.slice(0, 60),
          paused: this.paused,
          speed: this.speed,
          dayCount: this.engine.dayCount,
          tickCount: this.engine.tickCount,
          // v3.16: список игроков (ник, страна, пинг, онлайн)
          players: this.players.map(x => ({
            playerId: x.playerId,
            nick: x.nick || 'Игрок',
            countryName: x.countryName,
            personName: x.personName,
            connected: x.connected,
            isHost: !!x.isHost,
            ping: x.ping || null,
          })),
        });
      } catch (e) {
        console.error(`[Room ${this.code}] broadcastState error:`, e);
      }
    }
  }

  // ============================================================
  // ДЕЙСТВИЯ
  // ============================================================
  handleAction(socketId, action) {
    const p = this.players.find(x => x.socketId === socketId);
    if (!p) return { ok: false, reason: 'Вы не в комнате' };
    if (!this.engine) return { ok: false, reason: 'Игра не начата' };
    return handleAction(this, p.playerId, action);
  }

  // ============================================================
  // v3.16: ПИНГ (сохраняем на сервере, чтобы все видели)
  // ============================================================
  setPing(socketId, ping) {
    const p = this.players.find(x => x.socketId === socketId);
    if (p) p.ping = Math.max(0, Math.min(9999, Number(ping) || 0));
  }

  // ============================================================
  // УНИЧТОЖЕНИЕ
  // ============================================================
  destroy() {
    this.stopTick();
    this.engine = null;
    this.players = [];
    this.io = null;
  }

  // ============================================================
  // СЕРИАЛИЗАЦИЯ
  // ============================================================
  toJSON() {
    return {
      code: this.code,
      players: this.players.map(p => ({
        playerId: p.playerId,
        countryName: p.countryName,
        personName: p.personName,
        personId: p.personId,
        role: p.role,
        roleSlot: p.roleSlot || null,
        nick: p.nick || 'Игрок', // v3.16
        ready: p.ready,
        connected: p.connected,
        isHost: !!p.isHost, // v3.15
        ping: p.ping || null, // v3.16
      })),
      maxPlayers: this.maxPlayers,
      started: this.started,
      paused: this.paused,
      speed: this.speed,
      hostSocketId: this.hostSocketId,
    };
  }
}
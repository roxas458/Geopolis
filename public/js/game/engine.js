import { getDaysInMonth } from '../core/util.js';
import { tickEconomy } from './economy.js';
import { tickSociety } from './society.js';
import { tickPolitics, electSpeaker, getHeadOfState, POSITIONS, tickPersonAge, tickReferendum } from './politics.js';
import { tickDiplomacy } from './diplomacy.js';
import { rollEvents } from './events.js';
import { recordHistory } from './stats.js';
import {
  tickParliament, autoResolveBills, tickParliamentLifeMonthly,
  tickSenate, tickCommittees, tickFactions,
  tickSession, tickInterpellations, tickLegislativeAgenda,
} from './parliament.js';
import { tickElections } from './elections.js';
import { tickUnions, tickAssociations } from './groups.js';
import { resolveLawBills, tickActiveBills } from './laws.js';
// v3.15: единая валидация после загрузки
import { sanitizeCountry } from './state.js';
// v3.15: ИИ для AI-стран
import { tickAI } from './ai.js';

export { dateStr } from '../core/util.js';

let rollDailyEvents = null;
try {
  const mod = await import('./dailyEvents.js');
  rollDailyEvents = mod.rollDailyEvents;
} catch (e) {
  console.warn('[Geopolis] dailyEvents.js не загружен — ежедневные события отключены:', e.message);
}

const SPEED_MS = { 1: 1000, 2: 500, 3: 250, 5: 100 };

const AUTOSAVE_KEY = 'geopolis_autosave';
const SLOT_KEY = (slot) => `geopolis_save_${slot}`;
export const MAX_SLOTS = 5;

export class GameEngine {
  constructor({ world, playerId, playerIds = null, date = { year: 1936, month: 1, day: 1 } }) {
    this.world = world;
    this.playerId = playerId;
    this.playerIds = Array.isArray(playerIds) && playerIds.length > 0
      ? [...playerIds]
      : (playerId ? [playerId] : []);
    this.date = {
      year: date.year || 1936,
      month: date.month || 1,
      day: date.day || 1,
    };
    this.speed = 1;
    this.paused = false;
    this.timer = null;
    this.news = [];
    this.pendingEvent = null;
    this.pendingBill = null;
    this.listeners = [];
    this.tickCount = 0;
    this.dayCount = 0;
    this.monthCount = 0;
    this.yearCount = 0;
    this.autoSaveEnabled = true;
    this._isFirstDayOfMonth = false;
    this._isFirstDayOfYear = false;
  }

  _resolvePrimaryId() {
    return this.playerIds[0] || this.playerId || null;
  }

  getPlayer() {
    const id = this._resolvePrimaryId();
    if (!id) return null;
    return this.world.countries.find(c => c.id === id) || null;
  }

  getPlayerById(id) {
    return this.world.countries.find(c => c.id === id) || null;
  }

  getPlayers() {
    const ids = this.playerIds.length > 0
      ? this.playerIds
      : (this.playerId ? [this.playerId] : []);
    return ids.map(id => this.world.countries.find(c => c.id === id)).filter(Boolean);
  }

  isPlayer(id) {
    if (!id) return false;
    if (this.playerIds.includes(id)) return true;
    return this.playerIds.length === 0 && this.playerId === id;
  }

  getCountry(id) { return this.world.countries.find(c => c.id === id); }

  pushNews(tag, text, kind = 'info', countryId = null) {
    const cid = countryId || this.playerIds[0] || this.playerId;
    const isPlayerCountry = this.playerIds.includes(cid);
    if (!isPlayerCountry && kind === 'info') return;
    this.news.unshift({
      tag, text, kind, countryId: cid, isPlayer: isPlayerCountry,
      date: { ...this.date },
    });
    if (this.news.length > 200) this.news.pop();
  }

  start() { this.paused = false; this.schedule(); }
  pause() { this.paused = true; this.clearTimer(); }
  setSpeed(s) {
    this.speed = s;
    if (s === 0) { this.paused = true; this.clearTimer(); }
    else { this.paused = false; this.schedule(); }
  }
  clearTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  schedule() {
    this.clearTimer();
    if (this.paused) return;
    const ms = SPEED_MS[this.speed] || 1000;
    this.timer = setInterval(() => this.tick(), ms);
  }

  advanceDate() {
    this._isFirstDayOfMonth = false;
    this._isFirstDayOfYear = false;

    if (!Number.isFinite(this.date.month) || this.date.month < 1) this.date.month = 1;
    if (this.date.month > 12) this.date.month = 12;
    if (!Number.isFinite(this.date.day) || this.date.day < 1) this.date.day = 1;
    if (!Number.isFinite(this.date.year) || this.date.year < 1900) this.date.year = 1936;

    const daysInMonth = getDaysInMonth(this.date.year, this.date.month);
    this.date.day++;

    if (this.date.day > daysInMonth) {
      this.date.day = 1;
      this.date.month++;
      this._isFirstDayOfMonth = true;

      if (this.date.month > 12) {
        this.date.month = 1;
        this.date.year++;
        this._isFirstDayOfYear = true;
      }
    }
  }

  tick() {
    this.tickCount++;
    this.dayCount++;

    this.advanceDate();
    this.runDailySystems();

    if (this._isFirstDayOfMonth) {
      this.monthCount++;
      this.runMonthlySystems();
    }

    if (this._isFirstDayOfYear) {
      this.yearCount++;
      this.runYearlySystems();
    }

    this.notify();
  }

  runDailySystems() {
    const players = this.getPlayers();
    if (!players.length) return;

    for (const player of players) {
      if (player) player._date = { ...this.date };
    }

    if (typeof rollDailyEvents === 'function') {
      try {
        rollDailyEvents(this);
      } catch (e) {
        console.warn('[Geopolis] rollDailyEvents error:', e);
      }
    }

    for (const player of players) {
      if (!player) continue;
      try {
        const head = getHeadOfState(player);
        const headWithName = head ? {
          ...head,
          positionName: POSITIONS[head.position]?.name || 'Глава государства',
        } : null;
        tickParliament(player, this, headWithName);
      } catch (e) {
        console.warn(`[Geopolis] tickParliament error (${player.id}):`, e);
      }

      try {
        tickElections(player, this);
      } catch (e) {
        console.warn(`[Geopolis] tickElections error (${player.id}):`, e);
      }

      try {
        tickActiveBills(player, this);
      } catch (e) {
        console.warn(`[Geopolis] tickActiveBills error (${player.id}):`, e);
      }

      try {
        resolveLawBills(player, this);
      } catch (e) {
        console.warn(`[Geopolis] resolveLawBills error (${player.id}):`, e);
      }

      try { tickSession(player, this); } catch (e) {
        console.warn(`[Geopolis] tickSession error (${player.id}):`, e);
      }
      try { tickLegislativeAgenda(player, this); } catch (e) {
        console.warn(`[Geopolis] tickLegislativeAgenda error (${player.id}):`, e);
      }

      try { tickReferendum(player, this); } catch (e) {
        console.warn(`[Geopolis] tickReferendum error (${player.id}):`, e);
      }
    }
  }

  runMonthlySystems() {
    for (const c of this.world.countries) {
      tickEconomy(c, this);
      tickSociety(c, this);
      tickPolitics(c, this);
      tickUnions(c, this);
      tickAssociations(c, this);
      // v3.15: ИИ для AI-стран (после всех тиков)
      try { tickAI(c, this); } catch (e) {
        console.warn(`[Geopolis] tickAI error (${c.id}):`, e);
      }
    }

    tickDiplomacy(this);

    for (const player of this.getPlayers()) {
      if (!player) continue;
      try {
        player._date = { ...this.date };
        if (!player.speaker && player.parties?.length) {
          electSpeaker(player, this);
        }
        autoResolveBills(player, this);

        tickParliamentLifeMonthly(player, this);

        try { tickSenate(player, this); } catch (e) {
          console.warn(`[Geopolis] tickSenate error (${player.id}):`, e);
        }
        try { tickCommittees(player, this); } catch (e) {
          console.warn(`[Geopolis] tickCommittees error (${player.id}):`, e);
        }
        try { tickFactions(player, this); } catch (e) {
          console.warn(`[Geopolis] tickFactions error (${player.id}):`, e);
        }
        try { tickInterpellations(player, this); } catch (e) {
          console.warn(`[Geopolis] tickInterpellations error (${player.id}):`, e);
        }
      } catch (e) {
        console.warn(`[Geopolis] monthly parliament error (${player.id}):`, e);
      }
    }

    if (!this.pendingEvent) {
      const ev = rollEvents(this);
      if (ev) this.pendingEvent = ev;
    }
  }

  runYearlySystems() {
    for (const c of this.world.countries) {
      recordHistory({ getPlayer: () => c, date: this.date, world: this.world });
    }

    for (const player of this.getPlayers()) {
      if (!player) continue;
      try { tickPersonAge(player, this); }
      catch (e) { console.warn(`[Geopolis] tickPersonAge error (${player.id}):`, e); }
    }

    if (this.autoSaveEnabled && this.playerIds.length <= 1) {
      this.autoSave();
    }
  }

  buildSaveData() {
    const player = this.getPlayer();
    return {
      world: this.world,
      playerId: this.playerId,
      playerIds: this.playerIds,
      date: this.date,
      news: this.news.slice(0, 60),
      counters: {
        day: this.dayCount,
        month: this.monthCount,
        year: this.yearCount,
        tick: this.tickCount,
      },
      meta: {
        countryName: player?.name || '—',
        shortName: player?.shortName || '—',
        capital: player?.capital || '—',
        flag: player?.flag || { colors: ['#1e3a8a','#ffffff','#b91c1c'], pattern: 'horizontal' },
        population: player?.population || 0,
        gdp: player?.gdp || 0,
        approval: player?.approval || 0,
        savedAt: Date.now(),
        // v3.15: версия
        version: '3.15',
      },
    };
  }

  autoSave() {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(this.buildSaveData()));
    } catch (e) {
      console.warn('[Geopolis] Autosave failed:', e);
    }
  }

  save(slot = 'auto') {
    try {
      const key = slot === 'auto' ? AUTOSAVE_KEY : SLOT_KEY(slot);
      localStorage.setItem(key, JSON.stringify(this.buildSaveData()));
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }

  static loadFromKey(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (!data.date) data.date = { year: 1936, month: 1, day: 1 };
      if (!data.date.day) data.date.day = 1;

      let playerIds = Array.isArray(data.playerIds) && data.playerIds.length > 0
        ? [...data.playerIds]
        : (data.playerId ? [data.playerId] : []);

      if (playerIds.length === 0) {
        console.error('[Geopolis] Load failed: save has no playerIds/playerId');
        return null;
      }

      const engine = new GameEngine({
        world: data.world,
        playerId: data.playerId,
        playerIds,
        date: data.date,
      });
      engine.news = data.news || [];

      engine.dayCount = Number.isFinite(data.counters?.day) ? data.counters.day : 0;
      engine.monthCount = Number.isFinite(data.counters?.month) ? data.counters.month : 0;
      engine.yearCount = Number.isFinite(data.counters?.year) ? data.counters.year : 0;
      engine.tickCount = Number.isFinite(data.counters?.tick) ? data.counters.tick : 0;

      for (const c of engine.world.countries || []) {
        if (!c.relations || typeof c.relations !== 'object') c.relations = {};
        if (c.playerPartyId === undefined) c.playerPartyId = null;
        if (c.playerPersonId === undefined) c.playerPersonId = null;
        if (c.playerRole === undefined) c.playerRole = null;
        if (c.playerInPower === undefined) c.playerInPower = true;
        if (c.playerPartyGoal === undefined) c.playerPartyGoal = null;
        if (c.playerPersonGoal === undefined) c.playerPersonGoal = null;
        if (c.playerWon === undefined) c.playerWon = false;
        if (c.playerLost === undefined) c.playerLost = false;
        if (c.playerWinReason === undefined) c.playerWinReason = null;
        if (c.playerLoseReason === undefined) c.playerLoseReason = null;
        if (!Array.isArray(c.parliamentLife)) c.parliamentLife = [];
        if (c.senate === undefined) c.senate = null;
        if (!Array.isArray(c.committees)) c.committees = [];
        if (!Array.isArray(c.interpellations)) c.interpellations = [];
        if (!c.session) {
          c.session = {
            number: 1,
            startDate: { ...data.date },
            daysTotal: 90,
            daysLeft: 90,
            closed: false,
          };
        }
        for (const p of (c.parties || [])) {
          if (p.registered === undefined) p.registered = true;
          if (!Array.isArray(p.program)) p.program = [];
        }
        if (c.referendum === undefined) c.referendum = null;
        if (c.competition === undefined) c.competition = 50;

        if (c.minimumWage === undefined) c.minimumWage = (c.wage || 50) * 0.4;
        if (c.pensionAge === undefined) c.pensionAge = 65;
        if (c.pensionRate === undefined) c.pensionRate = 0.35;
        if (c.exchangeRate === undefined) c.exchangeRate = 1.0;
        if (c.cbIndependence === undefined) c.cbIndependence = 50;
        if (c.cbChairman === undefined) c.cbChairman = null;
        if (c.cbRate === undefined) c.cbRate = c.interestRate || 0.02;

        // v3.14: внутренняя безопасность и правовая система
        if (c.policeFunding === undefined) c.policeFunding = 0.008;
        if (c.ruleOfLaw === undefined) c.ruleOfLaw = 50;
        if (c.localAutonomy === undefined) c.localAutonomy = 50;
        if (!Array.isArray(c.protests)) c.protests = [];
        if (!Array.isArray(c.strikes)) c.strikes = [];

        // v3.15: журнал действий
        if (!Array.isArray(c.actionLog)) c.actionLog = [];
      }

      // v3.15: единая валидация после загрузки
      for (const c of engine.world.countries || []) {
        sanitizeCountry(c);
      }

      const player = engine.getPlayer();
      if (player) player._date = { ...data.date };
      return engine;
    } catch (e) {
      console.error('[Geopolis] Load failed:', e);
      return null;
    }
  }

  static load() { return GameEngine.loadFromKey(AUTOSAVE_KEY); }
  static loadSlot(slot) {
    if (slot === 'auto') return GameEngine.load();
    return GameEngine.loadFromKey(SLOT_KEY(slot));
  }

  static deleteSlot(slot) {
    if (slot === 'auto') localStorage.removeItem(AUTOSAVE_KEY);
    else localStorage.removeItem(SLOT_KEY(slot));
  }

  static getSaveMeta(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      return data.meta || null;
    } catch (e) { return null; }
  }

  static listSaves() {
    const saves = [];
    const autoMeta = GameEngine.getSaveMeta(AUTOSAVE_KEY);
    if (autoMeta) saves.push({ slot: 'auto', key: AUTOSAVE_KEY, meta: autoMeta });
    for (let i = 1; i <= MAX_SLOTS; i++) {
      const meta = GameEngine.getSaveMeta(SLOT_KEY(i));
      if (meta) saves.push({ slot: i, key: SLOT_KEY(i), meta });
    }
    return saves;
  }

  static getLatestSave() {
    const saves = GameEngine.listSaves();
    if (!saves.length) return null;
    return saves.sort((a, b) => (b.meta.savedAt || 0) - (a.meta.savedAt || 0))[0];
  }

  subscribe(fn) { this.listeners.push(fn); }
  notify() {
    for (const fn of this.listeners) {
      try { fn(this); } catch (e) { console.warn('[Geopolis] listener error:', e); }
    }
  }
}
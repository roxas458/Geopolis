// ============================================================
// NET-ENGINE (v3.13, D+C) — прокси для GameEngine на клиенте
// ============================================================
import { on } from './client.js';

export class NetEngine {
  constructor({ world, playerId, date }) {
    this.world = world;
    this.playerId = playerId;
    this.isNetEngine = true;   // ← флаг для views.js
    this.date = date || { year: 1936, month: 1, day: 1 };
    this.news = [];
    this.paused = false;
    this.speed = 1;
    this.pendingEvent = null;
    this.pendingBill = null;
    this.listeners = [];
    this.tickCount = 0;
    this.dayCount = 0;
    this.monthCount = 0;
    this.yearCount = 0;
    this.autoSaveEnabled = false;
    this._unsubscribe = null;

    // Подписка на обновления от сервера
    this._unsubscribe = on('game:state', (state) => {
      this._applyState(state);
    });
  }

  // ============================================================
  // СИНХРОНИЗАЦИЯ
  // ============================================================
  _applyState(state) {
    if (!state) return;
    if (state.world) this.world = state.world;
    if (state.date) this.date = state.date;
    if (state.news) this.news = state.news;
    if (state.playerId) this.playerId = state.playerId;
    if (typeof state.paused === 'boolean') this.paused = state.paused;
    if (typeof state.speed === 'number') this.speed = state.speed;
    if (typeof state.dayCount === 'number') this.dayCount = state.dayCount;
    if (typeof state.tickCount === 'number') this.tickCount = state.tickCount;

    this.notify();
  }

  // ============================================================
  // СОВМЕСТИМОСТЬ С GameEngine
  // ============================================================
  getPlayer() {
    if (!this.world || !this.world.countries) return null;
    return this.world.countries.find(c => c.id === this.playerId) || null;
  }

  // FIX: совместимость с GameEngine (views.js / main.js могут вызвать)
  getPlayerById(id) {
    return this.getCountry(id);
  }

  getPlayers() {
    const p = this.getPlayer();
    return p ? [p] : [];
  }

  isPlayer(id) {
    return id === this.playerId;
  }

  getCountry(id) {
    if (!this.world || !this.world.countries) return null;
    return this.world.countries.find(c => c.id === id) || null;
  }

  pushNews(tag, text, kind = 'info', countryId = this.playerId) {
    this.news.unshift({
      tag, text, kind, countryId, isPlayer: countryId === this.playerId,
      date: { ...this.date },
    });
    if (this.news.length > 200) this.news.pop();
  }

  // Заглушки — не используются в мультиплеере
  start() {}
  pause() {}
  setSpeed() {}
  clearTimer() {}
  schedule() {}
  tick() {}
  save() { return { ok: false, reason: 'В мультиплеере сохранение на сервере' }; }
  autoSave() {}

  // ============================================================
  // ПОДПИСКА
  // ============================================================
  subscribe(fn) {
    this.listeners.push(fn);
  }

  notify() {
    for (const fn of this.listeners) {
      try { fn(this); } catch (e) { console.warn('[NetEngine] listener error:', e); }
    }
  }

  destroy() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    this.listeners = [];
  }
}

// ============================================================
// СОЗДАТЬ NET-ENGINE ИЗ СОСТОЯНИЯ СЕРВЕРА
// ============================================================
export function createNetEngine({ world, playerId, date, news, paused, speed, dayCount, tickCount }) {
  const engine = new NetEngine({ world, playerId, date });
  if (news) engine.news = news;
  if (typeof paused === 'boolean') engine.paused = paused;
  if (typeof speed === 'number') engine.speed = speed;
  if (typeof dayCount === 'number') engine.dayCount = dayCount;
  if (typeof tickCount === 'number') engine.tickCount = tickCount;
  return engine;
}
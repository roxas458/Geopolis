// ============================================================
// УПРАВЛЕНИЕ КОМНАТАМИ (v3.0, D+C)
// ============================================================
import { Room } from './room.js';

const rooms = new Map();          // code → Room
const playerToRoom = new Map();   // socketId → { roomCode, playerId }

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без I/O/0/1
function generateCode() {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  code += '-';
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

export function createRoom(hostSocketId) {
  let code;
  let attempts = 0;
  do {
    code = generateCode();
    attempts++;
  } while (rooms.has(code) && attempts < 20);
  if (rooms.has(code)) return null;

  const room = new Room(code, hostSocketId);
  rooms.set(code, room);
  return room;
}

export function getRoom(code) {
  return rooms.get(code) || null;
}

export function deleteRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  room.destroy();
  rooms.delete(code);
}

export function findRoomBySocket(socketId) {
  const ref = playerToRoom.get(socketId);
  if (!ref) return null;
  return { room: rooms.get(ref.roomCode), playerId: ref.playerId, ...ref };
}

export function registerSocket(socketId, roomCode, playerId) {
  playerToRoom.set(socketId, { roomCode, playerId });
}

export function unregisterSocket(socketId) {
  const ref = playerToRoom.get(socketId);
  playerToRoom.delete(socketId);
  return ref;
}

export function listRooms() {
  return [...rooms.values()].map(r => ({
    code: r.code,
    players: r.players.length,
    maxPlayers: r.maxPlayers,
    started: r.started,
  }));
}

export function cleanupEmptyRooms() {
  for (const [code, room] of rooms) {
    if (room.isEmpty() && !room.started) {
      deleteRoom(code);
    }
  }
}
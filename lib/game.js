// Game-domain helpers on top of the Redis layer.
import { redis, gameKey, getGame, updateGame, GAME_TTL } from './redis.js';

export const MAX_PLAYERS = 5;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no ambiguous chars
export function genCode() {
  let c = '';
  for (let i = 0; i < 4; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return c;
}
export function genId() { return Math.random().toString(36).slice(2, 10); }
export function genToken() { return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }

function activePlayerCount(state) {
  return Object.values(state.players).filter(p => p.role === 'player').length;
}

// Public view of the game — strips per-player secret tokens.
export function publicState(state) {
  const players = {};
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = { id, name: p.name, role: p.role, color: p.color, joinedAt: p.joinedAt };
  }
  return {
    code: state.code, status: state.status, hostId: state.hostId,
    maxPlayers: state.maxPlayers, createdAt: state.createdAt, startedAt: state.startedAt,
    order: state.order, turn: state.turn, version: state.version,
    players, claims: state.claims,
  };
}

// Create a new game with the caller as host (an active player).
export async function createGame(hostName) {
  const now = Date.now();
  for (let i = 0; i < 8; i++) {
    const code = genCode();
    const hostId = genId();
    const token = genToken();
    const state = {
      code, status: 'lobby', hostId, createdAt: now, startedAt: null,
      maxPlayers: MAX_PLAYERS, version: 1,
      players: { [hostId]: { id: hostId, name: hostName, role: 'player', color: null, joinedAt: now, token } },
      order: [], turn: 0, claims: {},
    };
    const ok = await redis(['SET', gameKey(code), JSON.stringify(state), 'EX', String(GAME_TTL), 'NX']);
    if (ok) return { code, playerId: hostId, token, state };
  }
  throw new Error('could not allocate a game code');
}

// Join an existing game. Reconnects if (playerId, token) already match a player.
// New joiners become 'player' while there's room and the game is still in the
// lobby; otherwise they join as 'viewer'.
export async function joinGame(code, name, playerId, token) {
  const now = Date.now();
  const newId = genId();
  const newToken = genToken();
  const result = await updateGame(code, (state) => {
    // Reconnect path
    if (playerId && state.players[playerId] && state.players[playerId].token === token) {
      return { playerId, token, role: state.players[playerId].role, reconnected: true };
    }
    const canPlay = state.status === 'lobby' && activePlayerCount(state) < state.maxPlayers;
    const role = canPlay ? 'player' : 'viewer';
    state.players[newId] = { id: newId, name, role, color: null, joinedAt: now, token: newToken };
    return { playerId: newId, token: newToken, role, reconnected: false };
  });
  return result;
}

export { getGame };

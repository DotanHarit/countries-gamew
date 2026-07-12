// POST /api/start  { code, playerId, token }  -> { ok, state, serverTime }
// Host starts the game: validates, builds turn order, flips to 'playing' with a
// 3-second countdown (startedAt is a future timestamp).
import { updateGame, getGame } from '../lib/redis.js';
import { publicState } from '../lib/game.js';

function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}
function fail(status, msg) { const e = new Error(msg); e.status = status; return e; }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  try {
    const b = getBody(req);
    const code = (b.code || '').toString().trim().toUpperCase();
    if (!code) return res.status(400).json({ ok: false, error: 'missing code' });

    const result = await updateGame(code, (state) => {
      const me = state.players[b.playerId];
      if (!me || me.token !== b.token) throw fail(403, 'not authorized');
      if (me.id !== state.hostId) throw fail(403, 'only the host can start');
      if (state.status !== 'lobby') throw fail(409, 'game already started');
      const active = Object.values(state.players).filter(p => p.role === 'player');
      if (active.length < 2) throw fail(400, 'need at least 2 players');
      if (!active.every(p => p.color != null)) throw fail(400, 'all players must pick a color');
      state.order = active.sort((a, b2) => a.joinedAt - b2.joinedAt).map(p => p.id);
      state.turn = 0;
      state.status = 'playing';
      state.startedAt = Date.now() + 3000;   // 3s countdown, synced via startedAt
    });
    if (result.notFound) return res.status(404).json({ ok: false, error: 'game not found' });

    const state = await getGame(code);
    return res.status(200).json({ ok: true, state: publicState(state), serverTime: Date.now() });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) });
  }
}

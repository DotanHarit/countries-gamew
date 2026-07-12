// POST /api/claim  { code, playerId, token, country }  -> { ok, state, serverTime }
// Claim an unclaimed country on your turn (turn-based).
import { updateGame, getGame } from '../lib/redis.js';
import { publicState } from '../lib/game.js';

function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}
function fail(status, msg) { const e = new Error(msg); e.status = status; return e; }
function advanceTurn(state) {
  const n = (state.order || []).length;
  if (n > 0) state.turn = ((state.turn || 0) + 1) % n;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  try {
    const b = getBody(req);
    const code = (b.code || '').toString().trim().toUpperCase();
    const country = (b.country || '').toString().trim();
    if (!code) return res.status(400).json({ ok: false, error: 'missing code' });
    if (!country) return res.status(400).json({ ok: false, error: 'missing country' });

    const result = await updateGame(code, (state) => {
      const me = state.players[b.playerId];
      if (!me || me.token !== b.token) throw fail(403, 'not authorized');
      if (state.status !== 'playing') throw fail(409, 'game is not in play');
      if (me.role !== 'player') throw fail(403, 'viewers cannot play');
      if (state.startedAt && Date.now() < state.startedAt) throw fail(409, 'game has not started yet');
      const currentId = (state.order || [])[state.turn || 0];
      if (currentId !== me.id) throw fail(409, 'not your turn');
      if (state.claims[country]) throw fail(409, 'already claimed');
      state.claims[country] = { by: me.id, color: me.color };
      state.consecutiveSkips = 0;
      advanceTurn(state);
    });
    if (result.notFound) return res.status(404).json({ ok: false, error: 'game not found' });

    const state = await getGame(code);
    return res.status(200).json({ ok: true, state: publicState(state), serverTime: Date.now() });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) });
  }
}

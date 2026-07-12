// POST /api/end  { code, playerId, token }  -> { ok, state, serverTime }
// Host ends the game.
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
      if (me.id !== state.hostId) throw fail(403, 'only the host can end the game');
      if (state.status === 'ended') return;
      state.status = 'ended';
      state.endedAt = Date.now();
    });
    if (result.notFound) return res.status(404).json({ ok: false, error: 'game not found' });

    const state = await getGame(code);
    return res.status(200).json({ ok: true, state: publicState(state), serverTime: Date.now() });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) });
  }
}

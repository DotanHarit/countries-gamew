// POST /api/color  { code, playerId, token, color }  -> { ok, state }
// Pick a color (0..4) during the lobby. Rejects taken colors.
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
    const color = Number(b.color);
    if (!code) return res.status(400).json({ ok: false, error: 'missing code' });
    if (!Number.isInteger(color) || color < 0 || color > 4) return res.status(400).json({ ok: false, error: 'invalid color' });

    const result = await updateGame(code, (state) => {
      const me = state.players[b.playerId];
      if (!me || me.token !== b.token) throw fail(403, 'not authorized');
      if (state.status !== 'lobby') throw fail(409, 'game already started');
      if (me.role !== 'player') throw fail(403, 'viewers cannot pick a color');
      const taken = Object.values(state.players).some(p => p.id !== me.id && p.color === color);
      if (taken) throw fail(409, 'color already taken');
      me.color = color;
    });
    if (result.notFound) return res.status(404).json({ ok: false, error: 'game not found' });

    const state = await getGame(code);
    return res.status(200).json({ ok: true, state: publicState(state) });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) });
  }
}

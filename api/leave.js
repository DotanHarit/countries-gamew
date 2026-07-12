// POST /api/leave  { code, playerId, token }  -> { ok }
// Remove a player from a game. Adjusts turn order and transfers host if needed.
import { updateGame } from '../lib/redis.js';

function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  try {
    const b = getBody(req);
    const code = (b.code || '').toString().trim().toUpperCase();
    if (!code) return res.status(400).json({ ok: false, error: 'missing code' });

    await updateGame(code, (state) => {
      const me = state.players[b.playerId];
      if (!me || me.token !== b.token) return;   // already gone / not authorized -> no-op
      delete state.players[b.playerId];

      const order = state.order || [];
      const idx = order.indexOf(b.playerId);
      if (idx >= 0) {
        order.splice(idx, 1);
        if (order.length === 0) state.turn = 0;
        else if (idx < state.turn) state.turn -= 1;
        else if (idx === state.turn && state.turn >= order.length) state.turn = 0;
        state.order = order;
      }

      // Transfer host if the host left.
      if (state.hostId === b.playerId) {
        const remaining = Object.values(state.players).sort((a, c) => a.joinedAt - c.joinedAt);
        const nextPlayer = remaining.find(p => p.role === 'player') || remaining[0];
        state.hostId = nextPlayer ? nextPlayer.id : null;
      }
      // If a game in progress has no active players left, end it.
      if (state.status === 'playing' && (state.order || []).length < 1) {
        state.status = 'ended';
        state.endedAt = Date.now();
      }
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}

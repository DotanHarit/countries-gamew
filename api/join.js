// POST /api/join  { code, name, playerId?, token? }  -> { ok, playerId, token, role, state }
import { joinGame, getGame, publicState } from '../lib/game.js';

function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  try {
    const body = getBody(req);
    const code = (body.code || '').toString().trim().toUpperCase();
    const name = (body.name || '').toString().trim().slice(0, 20) || 'שחקן';
    if (!code) return res.status(400).json({ ok: false, error: 'missing code' });

    const result = await joinGame(code, name, body.playerId, body.token);
    if (result.notFound) return res.status(404).json({ ok: false, error: 'game not found' });

    const state = await getGame(code);
    return res.status(200).json({
      ok: true,
      playerId: result.ret.playerId,
      token: result.ret.token,
      role: result.ret.role,
      reconnected: result.ret.reconnected,
      state: publicState(state),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}

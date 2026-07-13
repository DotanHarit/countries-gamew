// POST /api/create  { name, vsBot }  -> { ok, code, playerId, token, botId, botToken, state }
import { createGame, publicState } from '../lib/game.js';

function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  try {
    const body = getBody(req);
    const name = (body.name || '').toString().trim().slice(0, 20) || 'מארח';
    const { code, playerId, token, botId, botToken, state } = await createGame(name, { vsBot: !!body.vsBot });
    return res.status(200).json({ ok: true, code, playerId, token, botId, botToken, state: publicState(state) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}

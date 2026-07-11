// GET /api/state?code=XXXX  -> { ok, state }   (polled by clients)
import { getGame, publicState } from '../lib/game.js';

export default async function handler(req, res) {
  try {
    const code = ((req.query && req.query.code) || '').toString().trim().toUpperCase();
    if (!code) return res.status(400).json({ ok: false, error: 'missing code' });
    const state = await getGame(code);
    if (!state) return res.status(404).json({ ok: false, error: 'game not found' });
    // Discourage caching of the polled state.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, state: publicState(state) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}

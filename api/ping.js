// Health check: round-trips a value through Upstash Redis to verify the
// serverless -> Redis pipeline and that the env vars are configured.
// GET /api/ping

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Minimal Upstash REST helper: runs a Redis command via the pipeline endpoint.
async function redis(command) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(`Redis error: ${data.error}`);
  return data.result;
}

export default async function handler(req, res) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN env vars',
    });
  }
  try {
    const key = 'countries:ping';
    const value = 'pong-' + Date.now();
    await redis(['SET', key, value, 'EX', '60']);   // expire in 60s so it self-cleans
    const readBack = await redis(['GET', key]);
    return res.status(200).json({
      ok: readBack === value,
      wrote: value,
      read: readBack,
      time: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message || e) });
  }
}

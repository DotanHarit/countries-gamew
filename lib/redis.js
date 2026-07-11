// Shared Upstash Redis (REST) helpers + optimistic-concurrency game update.
const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export const GAME_TTL = 60 * 60 * 6;   // games expire after 6h of inactivity
export const gameKey = (code) => `game:${code}`;

// Run a single Redis command via the Upstash REST endpoint.
export async function redis(cmd) {
  if (!URL || !TOKEN) throw new Error('Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN');
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(`Redis: ${data.error}`);
  return data.result;
}

export async function getGame(code) {
  const raw = await redis(['GET', gameKey(code)]);
  return raw ? JSON.parse(raw) : null;
}

// Compare-and-set on the game's `version` field, atomically on the server.
// Returns 1 = written, 0 = version conflict, -1 = key missing.
const CAS = `
local cur = redis.call('GET', KEYS[1])
if not cur then return -1 end
local obj = cjson.decode(cur)
if tostring(obj.version) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1`;

// Read-modify-write with optimistic retry. `mutator(state)` mutates in place and
// may throw a { status, error } object to reject; its return value is passed back.
export async function updateGame(code, mutator) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const raw = await redis(['GET', gameKey(code)]);
    if (!raw) return { notFound: true };
    const state = JSON.parse(raw);
    const ver = state.version || 0;
    const ret = mutator(state);            // may throw {status,error}
    state.version = ver + 1;
    const r = await redis(['EVAL', CAS, '1', gameKey(code), String(ver), JSON.stringify(state), String(GAME_TTL)]);
    if (r === 1) return { state, ret };
    if (r === -1) return { notFound: true };
    // r === 0 -> someone else wrote first; loop and retry
  }
  throw new Error('write conflict (too many retries)');
}

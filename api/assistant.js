/**
 * Міндетті емес серверлік endpoint: AI зерттеушіге LLM түсіндірмесін қосу.
 * Кілт тек серверде: Vercel → Project → Settings → Environment Variables → ANTHROPIC_API_KEY.
 * Кілт болмаса, GET { enabled: false } қайтарады және клиент тек жергілікті ережелерді пайдаланады.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map(); // IP → уақыт белгілері (бір инстанс ішінде, қарапайым шектеу)

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > MAX_PER_WINDOW;
}

const SYSTEM = [
  'Сен — оқушылардың жол қозғалысы симуляторы нәтижелерін түсіндіретін көмекшісің.',
  'Тек қазақ тілінде, қысқа (6–8 сөйлем) жауап бер.',
  'Тек берілген JSON контекстіндегі сандарды пайдалан; жаңа сандар, өлшеулер немесе дереккөздер ойлап шығарма.',
  'Статистикалық маңыздылықты өзің бағалама: контексте paired.significant=true болмаса, «дәлелденді» немесе «маңызды» деп жазба.',
  'Модель шартты схема және калибрленбеген екенін ескерт; нақты қалаға тікелей көшірме.',
].join(' ');

export default async function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    res.status(200).json({ enabled: Boolean(key) });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!key) {
    res.status(503).json({ error: 'LLM қосылмаған' });
    return;
  }
  const ip = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() || 'unknown';
  if (limited(ip)) {
    res.status(429).json({ error: 'Сұраныс тым жиі. Бір минуттан кейін қайталаңыз.' });
    return;
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const question = String(body.question || '').slice(0, 300);
  const context = JSON.stringify(body.context || {}).slice(0, 6000);
  if (!question) {
    res.status(400).json({ error: 'Сұрақ бос' });
    return;
  }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'claude-sonnet-5-5',
        max_tokens: 700,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Сұрақ: ${question}\n\nСимуляция контексті (JSON):\n${context}` }],
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      res.status(502).json({ error: j?.error?.message || 'LLM қатесі' });
      return;
    }
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    res.status(200).json({ text });
  } catch {
    res.status(502).json({ error: 'LLM сервисіне қосылу мүмкін болмады' });
  }
}

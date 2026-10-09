const express = require('express');
const multer = require('multer');
const path = require('path');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

const P = process.env.POLLINATIONS_API_KEY;
const F = process.env.FAL_KEY;
const VM = process.env.VIDEO_MODEL || 'fal-ai/wan-t2v';
const CM = process.env.CHAT_MODEL || 'openai';

app.get('/api/health', (q, s) => s.json({
  ok: true,
  imageReady: !!P,
  chatReady: !!P,
  videoReady: !!F
}));

app.post('/api/image', async (q, s) => {
  try {
    if (!P) return s.status(503).json({ error: 'Set POLLINATIONS_API_KEY in server environment.' });
    const { prompt, model = 'flux', size = '1024x1024' } = q.body || {};
    if (!String(prompt || '').trim()) return s.status(400).json({ error: 'Prompt required.' });
    const [w0, h0] = String(size).split('x').map(Number);
    const w = Number.isFinite(w0) && w0 > 0 ? w0 : 1024;
    const h = Number.isFinite(h0) && h0 > 0 ? h0 : 1024;
    const url = 'https://gen.pollinations.ai/image/' + encodeURIComponent(prompt) +
      '?model=' + encodeURIComponent(model) + '&width=' + w + '&height=' + h +
      '&key=' + encodeURIComponent(P);
    s.json({ url });
  } catch (e) {
    s.status(500).json({ error: e.message || 'Image request failed.' });
  }
});

app.post('/api/image-edit', upload.single('image'), (q, s) => {
  s.status(501).json({
    error: 'Image edit is not connected yet. A compatible image-to-image provider must be configured on the server.'
  });
});

app.post('/api/chat', async (q, s) => {
  try {
    if (!P) return s.status(503).json({ error: 'Set POLLINATIONS_API_KEY in server environment.' });
    const message = String(q.body?.message || '').trim();
    if (!message) return s.status(400).json({ error: 'Message required.' });
    const r = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + P },
      body: JSON.stringify({ model: CM, messages: [{ role: 'user', content: message }] })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return s.status(r.status).json({ error: d.error?.message || d.detail || 'Chat provider request failed.' });
    s.json({ text: d.choices?.[0]?.message?.content || d.text || '' });
  } catch (e) {
    s.status(502).json({ error: e.message || 'Chat request failed.' });
  }
});

app.post('/api/video', async (q, s) => {
  try {
    if (!F) return s.status(503).json({ error: 'Set FAL_KEY in server environment.' });
    const prompt = String(q.body?.prompt || '').trim();
    if (!prompt) return s.status(400).json({ error: 'Prompt required.' });
    const duration = Number(q.body?.duration || 5);
    const aspect_ratio = String(q.body?.aspect_ratio || '16:9');
    const r = await fetch('https://queue.fal.run/' + VM, {
      method: 'POST',
      headers: { 'Authorization': 'Key ' + F, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, duration, aspect_ratio })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return s.status(r.status).json({ error: d.detail || d.message || d.error || 'Video provider failed.' });
    if (!d.request_id) return s.status(502).json({ error: 'Video provider did not return a request ID.' });
    s.json({ requestId: d.request_id });
  } catch (e) {
    s.status(502).json({ error: e.message || 'Could not submit video job.' });
  }
});

app.post('/api/video/status', async (q, s) => {
  try {
    if (!F) return s.status(503).json({ error: 'Set FAL_KEY in server environment.' });
    const id = String(q.body?.requestId || '').trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return s.status(400).json({ error: 'Valid request ID required.' });

    const base = 'https://queue.fal.run/' + VM + '/requests/' + encodeURIComponent(id);
    const headers = { 'Authorization': 'Key ' + F };
    const sr = await fetch(base + '/status', { headers });
    const sd = await sr.json().catch(() => ({}));
    if (!sr.ok) return s.status(sr.status).json({ error: sd.detail || sd.message || 'Could not check video status.' });

    const status = String(sd.status || 'IN_QUEUE').toUpperCase();
    if (status === 'FAILED') return s.json({ status: 'FAILED', error: sd.error || 'Video generation failed.' });
    if (status !== 'COMPLETED') return s.json({ status });

    const vr = await fetch(base, { headers });
    const vd = await vr.json().catch(() => ({}));
    if (!vr.ok) return s.status(vr.status).json({ error: vd.detail || vd.message || 'Could not fetch completed video.' });

    const videoUrl = vd.video?.url || vd.output?.video?.url ||
      vd.video_url || vd.url || vd.data?.video?.url;
    if (!videoUrl) return s.status(502).json({ error: 'Video completed but provider returned no video URL. Check the selected FAL model output format.' });
    s.json({ status: 'COMPLETED', url: videoUrl });
  } catch (e) {
    s.status(502).json({ error: e.message || 'Could not check video status.' });
  }
});

app.get('*', (q, s) => s.sendFile(path.join(__dirname, 'index.html')));
app.listen(process.env.PORT || 3000, () => console.log('Nova AI Studio ready'));

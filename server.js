const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    imageReady: Boolean(process.env.POLLINATIONS_API_KEY),
    videoReady: Boolean(process.env.FAL_KEY)
  });
});

// Image generation via Pollinations. Set POLLINATIONS_API_KEY in your host's environment.
app.post("/api/image", async (req, res) => {
  try {
    const prompt = String(req.body.prompt || "").trim();
    const model = String(req.body.model || "flux");
    const width = Math.max(256, Math.min(1536, Number(req.body.width) || 1024));
    const height = Math.max(256, Math.min(1536, Number(req.body.height) || 1024));
    if (!prompt) return res.status(400).json({ error: "Please enter an image prompt." });
    if (!process.env.POLLINATIONS_API_KEY) {
      return res.status(503).json({ error: "Image provider is not configured. Add POLLINATIONS_API_KEY in Render Environment settings." });
    }
    const url = new URL("https://gen.pollinations.ai/image/" + encodeURIComponent(prompt));
    url.searchParams.set("model", model);
    url.searchParams.set("width", String(width));
    url.searchParams.set("height", String(height));
    url.searchParams.set("nologo", "true");
    const upstream = await fetch(url, {
      headers: { Authorization: "Bearer " + process.env.POLLINATIONS_API_KEY }
    });
    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 500);
      return res.status(502).json({ error: "Image provider error (" + upstream.status + "). " + detail });
    }
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "no-store");
    res.send(bytes);
  } catch (e) {
    res.status(500).json({ error: "Image generation failed: " + e.message });
  }
});

// Text-to-video via fal.ai queue API. Set FAL_KEY in your host's environment.
// Default model is configurable with VIDEO_MODEL, e.g. fal-ai/wan-i2v (provider/model availability may change).
app.post("/api/video", async (req, res) => {
  try {
    const prompt = String(req.body.prompt || "").trim();
    const duration = Math.max(2, Math.min(10, Number(req.body.duration) || 5));
    if (!prompt) return res.status(400).json({ error: "Please enter a video prompt." });
    if (!process.env.FAL_KEY) {
      return res.status(503).json({ error: "Video provider is not configured. Add FAL_KEY in Render Environment settings." });
    }
    const model = process.env.VIDEO_MODEL || "fal-ai/wan-t2v";
    const upstream = await fetch("https://queue.fal.run/" + model, {
      method: "POST",
      headers: {
        "Authorization": "Key " + process.env.FAL_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt, duration })
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return res.status(502).json({ error: data.detail || data.message || ("Video provider error (" + upstream.status + ").") });
    res.json({ request_id: data.request_id, status_url: data.status_url, response_url: data.response_url, model });
  } catch (e) {
    res.status(500).json({ error: "Could not start video generation: " + e.message });
  }
});

app.get("/api/video/status", async (req, res) => {
  try {
    if (!process.env.FAL_KEY) return res.status(503).json({ error: "Add FAL_KEY in Render Environment settings." });
    const statusUrl = String(req.query.url || "");
    if (!statusUrl.startsWith("https://queue.fal.run/")) return res.status(400).json({ error: "Invalid status URL." });
    const upstream = await fetch(statusUrl, { headers: { Authorization: "Key " + process.env.FAL_KEY } });
    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(500).json({ error: "Could not check video status: " + e.message });
  }
});

app.get("/api/video/result", async (req, res) => {
  try {
    if (!process.env.FAL_KEY) return res.status(503).json({ error: "Add FAL_KEY in Render Environment settings." });
    const resultUrl = String(req.query.url || "");
    if (!resultUrl.startsWith("https://queue.fal.run/")) return res.status(400).json({ error: "Invalid result URL." });
    const upstream = await fetch(resultUrl, { headers: { Authorization: "Key " + process.env.FAL_KEY } });
    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(500).json({ error: "Could not fetch video result: " + e.message });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log("Nova Image & Video Studio listening on " + PORT));

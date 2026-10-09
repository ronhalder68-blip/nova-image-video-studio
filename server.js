const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    imageReady: Boolean(process.env.POLLINATIONS_API_KEY),
    chatReady: Boolean(process.env.POLLINATIONS_API_KEY),
    videoReady: Boolean(process.env.FAL_KEY),
    videoModel:
      process.env.VIDEO_MODEL ||
      "fal-ai/wan/v2.2-a14b/text-to-video"
  });
});

app.post("/api/image", async (req, res) => {
  try {
    const prompt = String(req.body.prompt || "").trim();
    const model = String(req.body.model || "flux");
    const width = Math.max(
      256,
      Math.min(1536, Number(req.body.width) || 1024)
    );
    const height = Math.max(
      256,
      Math.min(1536, Number(req.body.height) || 1024)
    );

    if (!prompt) {
      return res.status(400).json({
        error: "Please enter an image prompt."
      });
    }

    if (!process.env.POLLINATIONS_API_KEY) {
      return res.status(503).json({
        error: "Add POLLINATIONS_API_KEY in Render Environment settings."
      });
    }

    const url = new URL(
      "https://gen.pollinations.ai/image/" +
      encodeURIComponent(prompt)
    );

    url.searchParams.set("model", model);
    url.searchParams.set("width", String(width));
    url.searchParams.set("height", String(height));
    url.searchParams.set("nologo", "true");

    const upstream = await fetch(url, {
      headers: {
        Authorization:
          "Bearer " + process.env.POLLINATIONS_API_KEY
      },
      signal: AbortSignal.timeout(120000)
    });

    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 500);

      return res.status(502).json({
        error: `Image provider error (${upstream.status}). ${detail}`
      });
    }

    res.set(
      "Content-Type",
      upstream.headers.get("content-type") || "image/jpeg"
    );
    res.set("Cache-Control", "no-store");

    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    res.status(500).json({
      error: "Image generation failed: " + e.message
    });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const messages = Array.isArray(req.body.messages)
      ? req.body.messages
      : [];

    if (!messages.length) {
      return res.status(400).json({
        error: "Send a message first."
      });
    }

    if (!process.env.POLLINATIONS_API_KEY) {
      return res.status(503).json({
        error: "Add POLLINATIONS_API_KEY in Render Environment settings."
      });
    }

    const safeMessages = messages.slice(-12).map(m => ({
      role: ["system", "user", "assistant"].includes(m.role)
        ? m.role
        : "user",
      content: String(m.content || "").slice(0, 8000)
    }));

    const upstream = await fetch(
      "https://gen.pollinations.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization:
            "Bearer " + process.env.POLLINATIONS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.CHAT_MODEL || "openai",
          messages: safeMessages
        }),
        signal: AbortSignal.timeout(120000)
      }
    );

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return res.status(502).json({
        error:
          data.error?.message ||
          data.message ||
          `Chat provider error (${upstream.status}).`
      });
    }

    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(502).json({
        error: "Chat provider returned an empty response."
      });
    }

    res.json({ reply });
  } catch (e) {
    res.status(500).json({
      error: "Chat failed: " + e.message
    });
  }
});

app.post("/api/video", async (req, res) => {
  try {
    const prompt = String(req.body.prompt || "").trim();
    const duration = Math.max(
      2,
      Math.min(10, Number(req.body.duration) || 5)
    );

    const ratioInput = String(req.body.ratio || "16:9")
      .trim()
      .toLowerCase();

    // FIX: Accept both frontend values and aspect-ratio values.
    const aspectRatio = ["9:16", "portrait"].includes(ratioInput)
      ? "9:16"
      : "16:9";

    if (!prompt) {
      return res.status(400).json({
        error: "Please enter a video prompt."
      });
    }

    if (!process.env.FAL_KEY) {
      return res.status(503).json({
        error: "Add FAL_KEY in Render Environment settings."
      });
    }

    const model =
      process.env.VIDEO_MODEL ||
      "fal-ai/wan/v2.2-a14b/text-to-video";

    const upstream = await fetch(
      "https://queue.fal.run/" + model,
      {
        method: "POST",
        headers: {
          Authorization: "Key " + process.env.FAL_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          num_frames: Math.max(
            33,
            Math.min(121, Math.round(duration * 16))
          ),
          aspect_ratio: aspectRatio,
          resolution: "720p"
        }),
        signal: AbortSignal.timeout(60000)
      }
    );

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return res.status(502).json({
        error:
          data.detail ||
          data.message ||
          data.error ||
          `Video provider error (${upstream.status}).`
      });
    }

    if (!data.request_id || !data.status_url || !data.response_url) {
      return res.status(502).json({
        error: "Video provider did not return the expected queue details."
      });
    }

    res.json({
      request_id: data.request_id,
      status_url: data.status_url,
      response_url: data.response_url,
      model
    });
  } catch (e) {
    res.status(500).json({
      error: "Could not start video generation: " + e.message
    });
  }
});

async function proxyFalUrl(req, res, urlParam, label) {
  try {
    if (!process.env.FAL_KEY) {
      return res.status(503).json({
        error: "Add FAL_KEY in Render Environment settings."
      });
    }

    const target = String(req.query[urlParam] || "");
    let parsed;

    try {
      parsed = new URL(target);
    } catch {
      return res.status(400).json({
        error: "Invalid provider URL."
      });
    }

    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "queue.fal.run"
    ) {
      return res.status(400).json({
        error: "Invalid provider URL."
      });
    }

    const upstream = await fetch(parsed.href, {
      headers: {
        Authorization: "Key " + process.env.FAL_KEY
      },
      signal: AbortSignal.timeout(60000)
    });

    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(500).json({
      error: "Could not fetch video " + label + ": " + e.message
    });
  }
}

app.get("/api/video/status", (req, res) =>
  proxyFalUrl(req, res, "url", "status")
);

app.get("/api/video/result", (req, res) =>
  proxyFalUrl(req, res, "url", "result")
);

app.get("*", (_req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

app.listen(PORT, () =>
  console.log("Nova AI Studio listening on " + PORT)
);

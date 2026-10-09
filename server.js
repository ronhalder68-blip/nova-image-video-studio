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

    const aspectRatio =
      ["9:16", "portrait"].includes(ratioInput)
        ? "9:16"
        : "16:9";

    if (!prompt) {
      return res.status(400).json({
        error: "Please enter a video prompt."
      });
    }

    const falKey = process.env.FAL_KEY;

    if (!falKey) {
      return res.status(503).json({
        error: "FAL_KEY missing. Add it in Render Environment settings."
      });
    }

    const model =
      process.env.VIDEO_MODEL ||
      "fal-ai/wan/v2.2-a14b/text-to-video";

    // This model accepts 17–161 frames.
    const numFrames = Math.max(
      17,
      Math.min(161, Math.round(duration * 16))
    );

    const upstream = await fetch(
      "https://queue.fal.run/" + model,
      {
        method: "POST",
        headers: {
          Authorization: "Key " + falKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          num_frames: numFrames,
          aspect_ratio: aspectRatio,
          resolution: "720p"
        }),
        signal: AbortSignal.timeout(60000)
      }
    );

    const raw = await upstream.text();
    let data = {};

    try {
      data = JSON.parse(raw);
    } catch {
      data = { detail: raw.slice(0, 500) };
    }

    if (!upstream.ok) {
      console.error("Fal submit error:", upstream.status, data);

      return res.status(502).json({
        error:
          data.detail?.[0]?.msg ||
          data.detail ||
          data.message ||
          data.error ||
          `Video provider returned HTTP ${upstream.status}. Check Render logs.`
      });
    }

    if (!data.request_id || !data.status_url || !data.response_url) {
      console.error("Unexpected Fal queue response:", data);

      return res.status(502).json({
        error: "Video provider returned incomplete queue information."
      });
    }

    res.json({
      request_id: data.request_id,
      status_url: data.status_url,
      response_url: data.response_url,
      model
    });
  } catch (e) {
    console.error("Video submission exception:", e);

    res.status(500).json({
      error: "Could not start video generation: " + e.message
    });
  }
});

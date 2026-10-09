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
    videoModel: process.env.VIDEO_MODEL || "fal-ai/wan/v2.2-a14b/text-to-video"
  });
});

app.post("/api/image", async (req, res) => {

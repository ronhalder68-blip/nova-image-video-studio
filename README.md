# Nova AI Studio Complete Starter

Upload these four files to the repository root. Render Start Command: `npm start`.

Set server-side environment variables in Render:
- `POLLINATIONS_API_KEY` for image and chat (provider endpoint/model access may change)
- `FAL_KEY` for video
- optional `CHAT_MODEL` (default `openai`)
- optional `VIDEO_MODEL` (default `fal-ai/wan-t2v`)

Important: This is a starter, not deployed or live-provider tested. Image-to-image UI exists but endpoint returns 501 until a compatible provider integration is added. Video request submission is implemented but status/result polling needs provider-specific configuration. Provider policies, availability and limits apply; unlimited use is not promised. Never expose API keys in `index.html` or GitHub.

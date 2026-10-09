# Nova AI Studio update

## Files
- `index.html` — mobile-friendly interface for Text-to-Image, Text-to-Video, and AI Chat.
- `server.js` — server-side API proxy. Provider secrets stay on the server.
- `package.json` — Node.js dependencies.

## Environment variables
Set these in Render Dashboard → your service → Environment:
- `POLLINATIONS_API_KEY` — required for image generation and AI chat.
- `FAL_KEY` — required for video generation.
- `VIDEO_MODEL` — optional; defaults to `fal-ai/wan-t2v`.
- `CHAT_MODEL` — optional; defaults to `openai`.

Do not put API keys in `index.html` or commit them to GitHub.

## Render settings
- Runtime: Node
- Build command: `npm install`
- Start command: `node server.js`

The updated server serves `index.html` from the repository root. If your Render start command still contains the old inline patch script, replace it with `node server.js`.

## Important
This ZIP is a code package, not a deployed update. Upload/commit these files to the GitHub repository and wait for Render to deploy. Provider models, endpoints, pricing and access can change; verify the configured provider account if generation returns an API error.

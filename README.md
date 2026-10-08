# Nova Image & Video Studio

A mobile-friendly Node/Express web app with a text-to-image UI and text-to-video UI.

## Run locally
1. Install Node.js 18 or newer.
2. Run `npm install`
3. Set environment variables (see `.env.example`) in your shell or hosting dashboard.
4. Run `npm start` and open `http://localhost:3000`.

## Deploy to Render
1. Create a **new Web Service** from this folder/repository (keep your existing Nova app unchanged).
2. Build command: `npm install`
3. Start command: `npm start`
4. Add `POLLINATIONS_API_KEY` for image generation and `FAL_KEY` for video generation in Render's Environment tab.
5. Check `/api/health` after deployment.

## Provider notes
- Image route uses `https://gen.pollinations.ai/image/` and a server-side bearer key. Confirm your provider account/key and model access.
- Video route uses the fal.ai queue API. Confirm the `VIDEO_MODEL` slug, request schema, account access, and pricing with fal.ai before production use; provider APIs and model availability can change.
- Keys must remain in server environment variables. Do not put keys in `public/index.html`, GitHub, or chat.
- The app does not promise unlimited/free generation. Providers may rate-limit or charge for requests.
- Generated media may be served from provider URLs; availability and retention are controlled by the provider.

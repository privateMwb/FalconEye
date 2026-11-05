# Deployment

How to host the demo: the backend on **Render** (one Docker container) and the dashboard on
**Vercel**. Nothing here has been deployed from this repository yet, so treat the first run
as the real test.

## What gets deployed

| Piece | Where | What it is |
|---|---|---|
| Backend | Render web service | `Dockerfile.demo`: `falconeye_server`, a traffic generator, and a read-only front door on `$PORT` |
| Dashboard | Vercel | The static build of `frontend/` |

The front door (`scripts/demo-server.mjs`) forwards only `GET /api/metrics` and
`GET /api/health`, answers `/healthz` itself, and sets CORS headers only for the exact
origins in `ALLOWED_ORIGINS`. The C++ server stays on `127.0.0.1:8080` inside the container.

## 1. Check the image locally (optional, needs Docker)

```bash
docker build -f Dockerfile.demo -t falconeye-demo .
docker run --rm -p 10000:10000 -e ALLOWED_ORIGINS=http://localhost:5173 falconeye-demo
scripts/check-demo.sh http://localhost:10000 http://localhost:5173
```

The `Demo image` workflow runs the same build and check in CI.

## 2. Render (backend)

1. Push the repo to GitHub.
2. In Render: **New → Blueprint**, pick the repo. It reads `render.yaml` (a Docker web
   service named `falconeye-demo`, health check `/healthz`).
3. Set `ALLOWED_ORIGINS` to a placeholder such as `https://example.com` for now.
4. Wait for the first build (a few minutes; it compiles the C++ server).
5. Copy the service URL, for example `https://falconeye-demo.onrender.com`, and open
   `<url>/healthz`: it should return `{"ok":true}`.

If you create the service by hand instead of with the Blueprint, choose **Web Service** with
runtime **Docker**, set the Dockerfile path to `./Dockerfile.demo` (the default `./Dockerfile`
does not exist here), and the health check path to `/healthz`.

## 3. Vercel (dashboard)

1. **Add New → Project**, import the repo.
2. **Root Directory:** `frontend`. Framework preset: Vite. Node.js version: 22.x.
3. Environment variable:

   ```
   VITE_DEFAULT_TARGET = https://<your-render-url>
   ```

   No trailing slash. It is read at build time, so changing it needs a redeploy.
4. Deploy and copy the Vercel URL.

## 4. Connect them

In Render, set `ALLOWED_ORIGINS` to the exact Vercel origin, for example
`https://falconeye.vercel.app` (no trailing slash or path; comma-separate several). Render
restarts the service. Then check:

```bash
scripts/check-demo.sh https://<render-url> https://<vercel-url>
```

## Behavior to expect

- **Free plan sleep.** The service sleeps when idle. The first request afterwards takes
  about a minute, the metrics start from zero again, and the dashboard shows "connection
  lost" until it wakes.
- **Fresh data.** The traffic generator sends a request roughly every 0.15 to 0.8 seconds, so
  there is always something to see while the service is awake.
- **Everything is in memory.** A restart clears the metrics.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Plain "Not Found" at the Render URL | The Dockerfile path is `./Dockerfile`; set it to `./Dockerfile.demo` |
| Dashboard says it can't reach the server | `ALLOWED_ORIGINS` doesn't match the dashboard's exact origin, or `VITE_DEFAULT_TARGET` is wrong or has a trailing slash |
| Works in `curl`, fails in the browser | CORS: check the `Access-Control-Allow-Origin` header with `scripts/check-demo.sh` |
| Build fails on Render | Open the build log; the first error is usually a missing apt package or a compiler version issue |

## Updating

Merging to `main` redeploys both: Render rebuilds the image and Vercel rebuilds the
dashboard.

# Demo

A short tour of the dashboard. It works against a local server or the hosted demo.

## Run it locally

```bash
# Terminal 1: the server (port 8080)
cd backend && cmake -B build && cmake --build build && ./build/falconeye_server

# Terminal 2: the dashboard (http://localhost:5173)
cd frontend && npm install && npm run dev

# Terminal 3: some traffic
while true; do
  curl -s localhost:8080/api/health > /dev/null
  curl -s localhost:8080/api/todos/1 > /dev/null
  curl -s localhost:8080/api/todos/99 > /dev/null   # 404: counts as an error
  sleep 0.3
done
```

## What to look at

1. **Throughput.** The sparkline is requests per second, derived from successive polls. Stop
   the loop and watch it fall to zero.
2. **Requests and errors.** `requests` is the lifetime total; `errors` counts status `>= 400`
   in the buffered window (the last 50 requests), so it falls again as old errors scroll out.
3. **Route patterns.** `/api/todos/1` and `/api/todos/99` both appear as `/api/todos/:id`.
4. **DB breakdown.** Tap a `/api/todos/:id` row: its `dbQuery` step is the MiniDB call, timed
   by `timedCall()`. `/api/health` has no breakdown because it makes no database call.
5. **Connection lost.** Stop the server. The dashboard keeps the last data and shows the URL
   it cannot reach; start the server again and it recovers on the next poll.

## Point the dashboard somewhere else

- Open `http://localhost:5173/?target=http://localhost:8080` to choose a server per visit.
- Build with `VITE_DEFAULT_TARGET=https://your-server` to bake one in.

The target must allow the dashboard's origin through CORS.

## The hosted demo

With the Render and Vercel setup from [DEPLOYMENT.md](DEPLOYMENT.md), the container
generates its own traffic, so the dashboard has live data without anyone sending requests.

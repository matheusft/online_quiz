# Deploying to Render

## Prerequisites

- A [Render](https://render.com) account
- Your code pushed to a GitHub repository

---

## 1. Push to GitHub

```bash
git remote add origin https://github.com/matheusft/online_quiz.git
git push -u origin main
```

---

## 2. Create a Web Service on Render

1. Go to [dashboard.render.com](https://dashboard.render.com) and click **New → Web Service**
2. Connect your GitHub repository
3. Render will auto-detect `render.yaml` — confirm the settings:

| Setting | Value |
|---|---|
| **Runtime** | Python |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn --worker-class geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 1 run:app` |
| **Instance Type** | Free (or Starter for always-on) |

---

## 3. Set Environment Variables

In the Render dashboard under **Environment**, add:

| Key | Value | Notes |
|---|---|---|
| `PYTHON_VERSION` | `3.11.0` | auto-set via `render.yaml` |
| `SECRET_KEY` | a long random string | generate with `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `MASTER_CODE` | your admin password | the code required to unlock the admin panel |
| `QR_PUBLIC_URL` | `https://YOUR-APP-NAME.onrender.com/student` | auto-set via `render.yaml` if using the known URL |

> `SECRET_KEY` and `MASTER_CODE` are declared as `sync: false` in `render.yaml`, meaning Render will prompt you to set them but will never store them in the repo.

The app will **refuse to start** if `SECRET_KEY` is not set.

---

## 4. Update `config/config.yaml` if Needed

Only non-secret values live in `config.yaml`:

```yaml
app:
  port: 8085            # local dev port, ignored on Render

qr:
  public_url: "https://online-quiz-9gez.onrender.com/student"  # overridden by QR_PUBLIC_URL
```

Do **not** add `SECRET_KEY` or `MASTER_CODE` here — both must come from the environment.

---

## 5. Deploy

Render deploys automatically on every push to `main`. You can also trigger a manual deploy from the dashboard.

Once live, your URLs are:

- **Student join link:** `https://YOUR-APP-NAME.onrender.com/student`
- **Admin panel:** `https://YOUR-APP-NAME.onrender.com/admin`
- **QR code image:** `https://YOUR-APP-NAME.onrender.com/qrcode`

---

## Important Constraints

**Single worker only.** The app holds all quiz state in memory. Render must run exactly 1 worker process — this is already set in `render.yaml` (`-w 1`). Do not increase the worker count or state will be split across processes and Socket.IO will break.

**Free tier sleeps.** Render's free tier spins down after 15 minutes of inactivity. The first request after sleep takes ~30 seconds. Upgrade to a paid instance type if you need the app always ready.

**State resets on restart.** Any deploy or server restart clears all quiz answers and resets to idle. This is by design for per-lecture use — start a fresh session for each lecture.

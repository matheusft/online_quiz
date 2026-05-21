# LiveQuiz

A real-time interactive quiz platform for live lecture settings. A presenter controls the quiz from an admin panel while students participate on their own devices by scanning a QR code.

## Features

- Real-time answer submission and live result bars via WebSockets
- Multiple choice, true/false, and free-text question types
- LaTeX rendering in question text and answer options via KaTeX
- Students can change their answer any time before reveal
- Duplicate free-text responses are collapsed with a count badge
- Live online/answered counters visible to both admin and students
- Correct answer reveal with per-option percentage breakdown
- QR code endpoint for instant student join
- Admin authentication via master code

## Stack

| Layer | Technology |
|---|---|
| Backend | Python, Flask, Flask-SocketIO |
| Real-time | Socket.IO (`gevent` mode + geventwebsocket) |
| Frontend | Vanilla HTML / CSS / JS |
| Config | `config/config.yaml` via Munch |
| QR codes | `qrcode[pil]` |
| Production | Gunicorn + geventwebsocket on Render |

## Project Structure

```
├── app/
│   ├── __init__.py        # App factory
│   ├── quiz_state.py      # In-memory state manager (thread-safe)
│   ├── socket_events.py   # All Socket.IO event handlers
│   ├── routes.py          # HTTP routes
│   └── utils.py           # Config loader, QR generator
├── config/config.yaml     # App configuration
├── data/questions.yaml    # Quiz questions
├── static/
│   ├── css/               # admin.css, student.css
│   └── js/                # admin.js, student.js
├── templates/             # admin.html, student.html
├── render.yaml            # Render deployment config
└── run.py                 # Entry point
```

## Local Setup

**Requirements:** Python 3.10+

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in the project root (never committed):

```bash
SECRET_KEY=your-long-random-secret-key-here
```

Then start the server:

```bash
python run.py
```

Open `http://localhost:<port>/admin` for the presenter panel and `http://localhost:<port>/student` for the student view. The port is set in `config/config.yaml`.

## Configuration

Edit `config/config.yaml` before running:

```yaml
app:
  port: 8085

quiz:
  master_code: "your-admin-password"

qr:
  public_url: "https://online-quiz-9gez.onrender.com/student"
```

`SECRET_KEY` is intentionally absent from `config.yaml` — it must be set via the environment (`.env` locally, dashboard env var on Render).

## Questions Format

Add or edit questions in `data/questions.yaml`:

```yaml
questions:
  - id: 1
    type: multiple_choice
    text: "What is the capital of France?"
    options: ["Berlin", "Madrid", "Paris", "Rome"]
    correct: 2          # zero-based index

  - id: 2
    type: true_false
    text: "The Earth orbits the Sun."
    options: ["True", "False"]
    correct: 0

  - id: 3
    type: free_text
    text: "Explain photosynthesis in your own words."
```

**Supported types:**

| Type | `correct` field | Notes |
|------|----------------|-------|
| `multiple_choice` | zero-based index | 2–6 options |
| `true_false` | `0` (True) or `1` (False) | options must be `["True", "False"]` |
| `free_text` | omit | responses displayed after reveal |

**LaTeX** is supported in `text` and `options` fields using KaTeX. Use `$...$` for inline math and `$$...$$` for display math. In YAML, backslashes must be doubled: `\\frac`, `\\sqrt`, etc.

## Deploying to Render

See [DEPLOY.md](DEPLOY.md) for full deployment instructions.

## Notes

- All state is in-memory — it resets on server restart (intentional for per-lecture use)
- Only **one worker** is used on Render; Socket.IO in-memory state is not shared across workers
- The correct answer is never sent to students until the admin fires "Reveal Answer"

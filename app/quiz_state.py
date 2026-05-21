"""
In-memory quiz state manager. All mutations go through explicit functions.
No database — state resets on server restart.
"""

import threading

_lock = threading.Lock()

# --- State ---
_state = {
    "current_question_index": 0,
    "status": "idle",          # idle | active | paused | revealing
    "answers": {},             # question_id -> {option_index: count} or [list of strings]
    "answered_sessions": {},   # question_id -> set of session IDs
    "students_online": set(),  # set of socket session IDs
    "answer_revealed": False,
}

_questions = []


# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

def load_questions(questions: list):
    global _questions
    _questions = questions


def get_questions():
    return _questions


# ---------------------------------------------------------------------------
# Read helpers
# ---------------------------------------------------------------------------

def get_status():
    return _state["status"]


def get_current_index():
    return _state["current_question_index"]


def get_current_question(include_correct=False):
    if not _questions:
        return None
    idx = _state["current_question_index"]
    if idx >= len(_questions):
        return None
    q = dict(_questions[idx])
    if not include_correct:
        q.pop("correct", None)
    return q


def get_answers_for_current():
    q = get_current_question(include_correct=True)
    if q is None:
        return {}
    return _state["answers"].get(q["id"], {} if q["type"] == "multiple_choice" else [])


def get_students_online():
    return len(_state["students_online"])


def is_answer_revealed():
    return _state["answer_revealed"]


def has_student_answered(question_id, sid):
    return sid in _state["answered_sessions"].get(question_id, set())


def get_full_state_snapshot(for_admin=False):
    """Return a serialisable snapshot of the current state."""
    q = get_current_question(include_correct=for_admin)
    snap = {
        "status": _state["status"],
        "current_question_index": _state["current_question_index"],
        "total_questions": len(_questions),
        "students_online": get_students_online(),
        "answer_revealed": _state["answer_revealed"],
        "question": q,
    }
    if for_admin and q:
        snap["live_counts"] = _build_live_counts(q)
    if _state["answer_revealed"] and q:
        snap["reveal_data"] = _build_reveal_data(q)
    return snap


def _build_live_counts(q):
    qid = q["id"]
    raw = _state["answers"].get(qid, {} if q["type"] == "multiple_choice" else [])
    if q["type"] == "multiple_choice":
        total = sum(raw.values()) if raw else 0
        return {
            "question_id": qid,
            "counts": raw,
            "total_answers": total,
            "students_online": get_students_online(),
        }
    else:
        return {
            "question_id": qid,
            "responses": list(raw) if raw else [],
            "total_answers": len(raw) if raw else 0,
            "students_online": get_students_online(),
        }


def _build_reveal_data(q):
    qid = q["id"]
    raw = _state["answers"].get(qid, {} if q["type"] == "multiple_choice" else [])
    data = _build_live_counts(q)
    if q["type"] == "multiple_choice":
        data["correct"] = q.get("correct")
    return data


# ---------------------------------------------------------------------------
# Mutation helpers
# ---------------------------------------------------------------------------

def add_student(sid):
    with _lock:
        _state["students_online"].add(sid)


def remove_student(sid):
    with _lock:
        _state["students_online"].discard(sid)


def start_quiz():
    with _lock:
        _state["status"] = "active"
        _state["current_question_index"] = 0
        _state["answer_revealed"] = False
        _reset_answers_for_current_unlocked()


def pause_quiz():
    with _lock:
        if _state["status"] == "active":
            _state["status"] = "paused"
        elif _state["status"] == "paused":
            _state["status"] = "active"


def reset_quiz():
    with _lock:
        _state["status"] = "idle"
        _state["current_question_index"] = 0
        _state["answers"] = {}
        _state["answered_sessions"] = {}
        _state["answer_revealed"] = False


def next_question():
    with _lock:
        if _state["current_question_index"] < len(_questions) - 1:
            _state["current_question_index"] += 1
            _state["answer_revealed"] = False
            _state["status"] = "active"
            _reset_answers_for_current_unlocked()
            return True
        return False


def prev_question():
    with _lock:
        if _state["current_question_index"] > 0:
            _state["current_question_index"] -= 1
            _state["answer_revealed"] = False
            _state["status"] = "active"
            _reset_answers_for_current_unlocked()
            return True
        return False


def reveal_answer():
    with _lock:
        _state["answer_revealed"] = True
        _state["status"] = "revealing"


def hide_answer():
    with _lock:
        _state["answer_revealed"] = False
        _state["status"] = "active"


def record_answer(question_id, answer, sid):
    """
    Record an answer. Returns False if already answered or quiz not active.
    answer is an int (MC option index) or a string (free text).
    """
    with _lock:
        if _state["status"] not in ("active",):
            return False

        # Prevent re-submission
        if sid in _state["answered_sessions"].get(question_id, set()):
            return False

        _state["answered_sessions"].setdefault(question_id, set()).add(sid)

        # Find question type
        q = next((x for x in _questions if x["id"] == question_id), None)
        if q is None:
            return False

        if q["type"] == "multiple_choice":
            bucket = _state["answers"].setdefault(question_id, {})
            bucket[answer] = bucket.get(answer, 0) + 1
        else:
            bucket = _state["answers"].setdefault(question_id, [])
            bucket.append(str(answer))

        return True


def _reset_answers_for_current_unlocked():
    """Called while lock is already held."""
    idx = _state["current_question_index"]
    if idx < len(_questions):
        qid = _questions[idx]["id"]
        q = _questions[idx]
        _state["answers"][qid] = {} if q["type"] == "multiple_choice" else []
        _state["answered_sessions"].pop(qid, None)

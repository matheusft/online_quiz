from flask import request
from flask_socketio import emit, join_room, leave_room

from . import socketio, config
from . import quiz_state as qs


def _emit_state_to_admin():
    snap = qs.get_full_state_snapshot(for_admin=True)
    emit("quiz_state", snap, to="admin")


def _broadcast_question_to_students():
    q = qs.get_current_question(include_correct=False)
    emit(
        "question_update",
        {
            "question": q,
            "status": qs.get_status(),
            "current_question_index": qs.get_current_index(),
            "total_questions": len(qs.get_questions()),
            "answer_revealed": qs.is_answer_revealed(),
        },
        broadcast=True,
    )


def _emit_live_counts():
    q = qs.get_current_question(include_correct=True)
    if q is None:
        return
    qid = q["id"]
    raw = qs.get_answers_for_current()
    if q["type"] == "multiple_choice":
        total = sum(raw.values()) if raw else 0
        payload = {
            "question_id": qid,
            "counts": raw,
            "total_answers": total,
            "students_online": qs.get_students_online(),
        }
    else:
        payload = {
            "question_id": qid,
            "responses": list(raw) if raw else [],
            "total_answers": len(raw) if raw else 0,
            "students_online": qs.get_students_online(),
        }
    emit("live_counts", payload, to="admin")


@socketio.on("connect")
def on_connect():
    sid = request.sid
    qs.add_student(sid)
    snap = qs.get_full_state_snapshot(for_admin=False)
    emit("quiz_state", snap)
    # Notify admin of updated online count
    _emit_live_counts()


@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    qs.remove_student(sid)
    leave_room("admin")
    _emit_live_counts()


# ---------------------------------------------------------------------------
# Admin events
# ---------------------------------------------------------------------------

@socketio.on("admin_auth")
def on_admin_auth(data):
    code = (data or {}).get("code", "")
    if code == config.quiz.master_code:
        join_room("admin")
        snap = qs.get_full_state_snapshot(for_admin=True)
        emit("auth_result", {"success": True, "state": snap})
    else:
        emit("auth_result", {"success": False})


@socketio.on("start_quiz")
def on_start_quiz():
    qs.start_quiz()
    _broadcast_question_to_students()
    _emit_state_to_admin()


@socketio.on("pause_quiz")
def on_pause_quiz():
    qs.pause_quiz()
    status = qs.get_status()
    emit("quiz_paused", {"status": status}, broadcast=True)
    _emit_state_to_admin()


@socketio.on("reset_quiz")
def on_reset_quiz():
    qs.reset_quiz()
    emit("quiz_reset", {}, broadcast=True)
    _emit_state_to_admin()


@socketio.on("next_question")
def on_next_question():
    moved = qs.next_question()
    if moved:
        _broadcast_question_to_students()
        _emit_state_to_admin()


@socketio.on("prev_question")
def on_prev_question():
    moved = qs.prev_question()
    if moved:
        _broadcast_question_to_students()
        _emit_state_to_admin()


@socketio.on("reveal_answer")
def on_reveal_answer():
    qs.reveal_answer()
    q = qs.get_current_question(include_correct=True)
    if q is None:
        return
    raw = qs.get_answers_for_current()
    if q["type"] == "multiple_choice":
        total = sum(raw.values()) if raw else 0
        payload = {
            "question_id": q["id"],
            "counts": raw,
            "total_answers": total,
            "correct": q.get("correct"),
            "question_type": "multiple_choice",
        }
    else:
        payload = {
            "question_id": q["id"],
            "responses": list(raw) if raw else [],
            "total_answers": len(raw) if raw else 0,
            "question_type": "free_text",
        }
    emit("answer_revealed", payload, broadcast=True)
    _emit_state_to_admin()


@socketio.on("hide_answer")
def on_hide_answer():
    qs.hide_answer()
    emit("answer_hidden", {}, broadcast=True)
    _emit_state_to_admin()


# ---------------------------------------------------------------------------
# Student events
# ---------------------------------------------------------------------------

@socketio.on("submit_answer")
def on_submit_answer(data):
    sid = request.sid
    question_id = (data or {}).get("question_id")
    answer = (data or {}).get("answer")

    if question_id is None or answer is None:
        return

    recorded = qs.record_answer(question_id, answer, sid)
    if recorded:
        emit("answer_accepted", {"question_id": question_id})
        _emit_live_counts()
    else:
        emit("answer_rejected", {"question_id": question_id})

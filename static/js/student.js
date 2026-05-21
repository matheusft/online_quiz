/* ======================================================
   Student App — Socket.IO client
   ====================================================== */

"use strict";

const socket = io({ transports: ["websocket", "polling"] });

// ── DOM refs ──────────────────────────────────────────
const connDot      = document.getElementById("connection-dot");
const statsBar     = document.getElementById("stats-bar");
const statsOnline  = document.getElementById("stats-online");
const statsAnswered = document.getElementById("stats-answered");

const views = {
  waiting:   document.getElementById("view-waiting"),
  question:  document.getElementById("view-question"),
  revealMC:  document.getElementById("view-reveal-mc"),
  revealFT:  document.getElementById("view-reveal-ft"),
  paused:    document.getElementById("view-paused"),
};

const waitingTitle = document.getElementById("waiting-title");
const waitingSub   = document.getElementById("waiting-sub");

const qCounter  = document.getElementById("q-counter");
const qTypeBadge = document.getElementById("q-type-badge");
const qText     = document.getElementById("q-text");
const mcOptions = document.getElementById("mc-options");
const ftInput   = document.getElementById("ft-input");
const ftTextarea = document.getElementById("ft-textarea");
const ftSubmit  = document.getElementById("ft-submit");
const ftCharCount = document.getElementById("ft-char-count");
const submittedBanner = document.getElementById("submitted-banner");

const rvCounter = document.getElementById("rv-counter");
const rvText    = document.getElementById("rv-text");
const rvOptions = document.getElementById("rv-options");
const rvYourAnswer = document.getElementById("rv-your-answer");

const rvftText  = document.getElementById("rvft-text");
const rvftCount = document.getElementById("rvft-count");
const rvftList  = document.getElementById("rvft-list");

const progressFooter = document.getElementById("progress-footer");
const progressFill   = document.getElementById("progress-fill");
const progressLabel  = document.getElementById("progress-label");

// ── App state ─────────────────────────────────────────
const answeredQuestions = new Set(); // question IDs already submitted this session
let currentQuestionId   = null;
let myAnswers           = {};        // question_id -> submitted answer

// ── Connection ────────────────────────────────────────
socket.on("connect", () => {
  connDot.className = "connection-dot connected";
  connDot.title = "Connected";
});

socket.on("disconnect", () => {
  connDot.className = "connection-dot disconnected";
  connDot.title = "Disconnected";
});

// ── Server events ─────────────────────────────────────
socket.on("quiz_state", (state) => {
  applyState(state);
});

socket.on("question_update", (data) => {
  applyQuestionUpdate(data);
});

socket.on("answer_revealed", (data) => {
  showReveal(data);
});

socket.on("answer_hidden", () => {
  // Go back to question view (re-show last question, submitted)
  if (currentQuestionId !== null) {
    const q = lastKnownQuestion;
    if (q) renderActiveQuestion(q, lastKnownIndex, lastKnownTotal);
  }
});

socket.on("quiz_paused", ({ status }) => {
  if (status === "paused") showView("paused");
  else if (status === "active" && lastKnownQuestion) {
    renderActiveQuestion(lastKnownQuestion, lastKnownIndex, lastKnownTotal);
  }
});

socket.on("quiz_reset", () => {
  answeredQuestions.clear();
  myAnswers = {};
  currentQuestionId = null;
  lastKnownQuestion = null;
  showView("waiting");
  waitingTitle.textContent = "Quiz has been reset";
  waitingSub.textContent = "Waiting for the instructor to restart…";
  progressFooter.classList.add("hidden");
  statsBar.classList.add("hidden");
});

socket.on("answer_accepted", () => {
  submittedBanner.classList.remove("hidden");
});

socket.on("student_stats", ({ students_online, total_answers }) => {
  statsOnline.textContent   = students_online ?? 0;
  statsAnswered.textContent = total_answers ?? 0;
});

// ── State application ─────────────────────────────────
let lastKnownQuestion = null;
let lastKnownIndex    = 0;
let lastKnownTotal    = 1;

function applyState(state) {
  const { status, question, current_question_index, total_questions, answer_revealed, reveal_data } = state;

  lastKnownIndex = current_question_index || 0;
  lastKnownTotal = total_questions || 1;

  if (status === "idle") {
    showView("waiting");
    waitingTitle.textContent = "Waiting for the quiz to start…";
    waitingSub.textContent = "Your instructor will begin shortly";
    progressFooter.classList.add("hidden");
    statsBar.classList.add("hidden");
    return;
  }

  statsBar.classList.remove("hidden");

  if (question) {
    lastKnownQuestion = question;
    currentQuestionId = question.id;
    updateProgress(current_question_index, total_questions);
  }

  if (status === "paused") {
    showView("paused");
    return;
  }

  if (answer_revealed && reveal_data) {
    showReveal(reveal_data);
    return;
  }

  if (question && (status === "active" || status === "revealing")) {
    renderActiveQuestion(question, current_question_index, total_questions);
  }
}

function applyQuestionUpdate(data) {
  const { question, status, current_question_index, total_questions, answer_revealed } = data;

  lastKnownIndex = current_question_index || 0;
  lastKnownTotal = total_questions || 1;

  if (question) {
    lastKnownQuestion = question;
    currentQuestionId = question.id;
    updateProgress(current_question_index, total_questions);
  }

  if (status === "paused") { showView("paused"); return; }

  if (answer_revealed) return; // reveal event will handle it

  if (question) {
    renderActiveQuestion(question, current_question_index, total_questions);
  }
}

function renderActiveQuestion(q, idx, total) {
  updateProgress(idx, total);

  if (answeredQuestions.has(q.id)) {
    // Already answered — show question with submitted state
    showAnsweredState(q, idx, total);
    return;
  }

  showView("question");

  qCounter.textContent  = `Question ${idx + 1} / ${total}`;
  qTypeBadge.textContent = q.type === "multiple_choice" ? "Multiple Choice" : "Free Text";
  qText.textContent      = q.text;

  submittedBanner.classList.add("hidden");

  if (q.type === "multiple_choice") {
    ftInput.classList.add("hidden");
    mcOptions.classList.remove("hidden");
    renderMcOptions(q);
  } else {
    mcOptions.classList.add("hidden");
    ftInput.classList.remove("hidden");
    ftTextarea.value = "";
    ftCharCount.textContent = "0 / 500";
    ftSubmit.disabled = false;
    ftTextarea.disabled = false;
  }
}

function showAnsweredState(q, idx, total) {
  showView("question");
  qCounter.textContent  = `Question ${idx + 1} / ${total}`;
  qTypeBadge.textContent = q.type === "multiple_choice" ? "Multiple Choice" : "Free Text";
  qText.textContent      = q.text;

  if (q.type === "multiple_choice") {
    ftInput.classList.add("hidden");
    mcOptions.classList.remove("hidden");
    // Keep buttons active — student can still change answer before reveal
    renderMcOptions(q, myAnswers[q.id]);
  } else {
    mcOptions.classList.add("hidden");
    ftInput.classList.remove("hidden");
    ftTextarea.value = myAnswers[q.id] || "";
    ftTextarea.disabled = false;
    ftSubmit.disabled = false;
  }

  submittedBanner.classList.remove("hidden");
}

function renderMcOptions(q, selectedIndex) {
  mcOptions.innerHTML = "";
  const letters = ["A", "B", "C", "D", "E", "F"];

  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "mc-option";
    btn.dataset.index = i;
    if (i === selectedIndex) btn.classList.add("selected");
    btn.innerHTML = `<span class="option-letter">${letters[i]}</span><span>${escapeHtml(opt)}</span>`;
    btn.addEventListener("click", () => onMcSelect(q.id, i));
    mcOptions.appendChild(btn);
  });
}

function disableMcOptions() {
  mcOptions.querySelectorAll(".mc-option").forEach((b) => { b.disabled = true; });
}

function onMcSelect(questionId, optionIndex) {
  // Allow changing answer before reveal — clicking same option deselects
  const prev = myAnswers[questionId];
  if (prev === optionIndex) return; // tapped same option, no-op

  myAnswers[questionId] = optionIndex;
  answeredQuestions.add(questionId);

  mcOptions.querySelectorAll(".mc-option").forEach((b, i) => {
    b.classList.toggle("selected", i === optionIndex);
  });
  submittedBanner.classList.remove("hidden");

  socket.emit("submit_answer", { question_id: questionId, answer: optionIndex });
}

// Free text submission
ftTextarea.addEventListener("input", () => {
  const len = ftTextarea.value.length;
  ftCharCount.textContent = `${len} / 500`;
  // Re-enable submit if there's text and answer can still be changed
  ftSubmit.disabled = len === 0;
});

ftSubmit.addEventListener("click", () => {
  const text = ftTextarea.value.trim();
  if (!text) return;

  myAnswers[currentQuestionId] = text;
  answeredQuestions.add(currentQuestionId);

  submittedBanner.classList.remove("hidden");

  socket.emit("submit_answer", { question_id: currentQuestionId, answer: text });
});

// ── Reveal ────────────────────────────────────────────
function showReveal(data) {
  if (data.question_type === "free_text" || data.responses !== undefined) {
    showView("revealFT");
    rvftText.textContent = lastKnownQuestion?.text || "";
    rvftCount.textContent = `${data.total_answers || 0} response${data.total_answers !== 1 ? "s" : ""}`;

    rvftList.innerHTML = "";
    const responses = data.responses || [];
    if (responses.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No responses submitted.";
      li.style.color = "#94a3b8";
      rvftList.appendChild(li);
    } else {
      responses.forEach((r, i) => {
        const li = document.createElement("li");
        li.textContent = r;
        li.style.animationDelay = `${i * 40}ms`;
        rvftList.appendChild(li);
      });
    }
  } else {
    // Multiple choice reveal
    showView("revealMC");
    rvCounter.textContent = `Question ${lastKnownIndex + 1} / ${lastKnownTotal}`;
    rvText.textContent    = lastKnownQuestion?.text || "";

    const counts  = data.counts || {};
    const total   = data.total_answers || 0;
    const correct = data.correct;
    const options = lastKnownQuestion?.options || [];
    const letters = ["A", "B", "C", "D", "E", "F"];
    const myAnswer = myAnswers[data.question_id];

    rvOptions.innerHTML = "";

    options.forEach((opt, i) => {
      const cnt = counts[i] || 0;
      const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
      const isCorrect  = correct !== undefined && correct === i;
      const isSelected = myAnswer === i;

      const div = document.createElement("div");
      div.className = "rv-option";
      if (isCorrect) div.classList.add("correct-option");
      else if (isSelected && !isCorrect) div.classList.add("wrong-selected");

      div.innerHTML = `
        <div class="rv-option-top">
          <span class="rv-letter">${letters[i]}</span>
          <span class="rv-option-text">${escapeHtml(opt)}</span>
          <span class="rv-pct">${pct}%</span>
        </div>
        <div class="rv-bar-track">
          <div class="rv-bar-fill" style="width: 0%"></div>
        </div>`;

      rvOptions.appendChild(div);

      // Animate bar after a brief delay
      requestAnimationFrame(() => {
        setTimeout(() => {
          div.querySelector(".rv-bar-fill").style.width = pct + "%";
        }, 50 + i * 80);
      });
    });

    // Your answer note
    if (myAnswer !== undefined) {
      const isCorrect = myAnswer === correct;
      rvYourAnswer.classList.remove("hidden");
      rvYourAnswer.textContent = isCorrect
        ? `You answered ${letters[myAnswer]} — Correct!`
        : `You answered ${letters[myAnswer]} — The correct answer was ${letters[correct]}`;
    } else {
      rvYourAnswer.classList.add("hidden");
    }
  }
}

// ── View management ───────────────────────────────────
function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    if (key === name) {
      el.classList.remove("hidden");
      el.classList.add("active");
    } else {
      el.classList.remove("active");
      el.classList.add("hidden");
    }
  });
}

function updateProgress(idx, total) {
  progressFooter.classList.remove("hidden");
  const pct = total > 0 ? ((idx + 1) / total) * 100 : 0;
  progressFill.style.width = pct + "%";
  progressLabel.textContent = `${idx + 1} / ${total}`;
}

// ── Helpers ───────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

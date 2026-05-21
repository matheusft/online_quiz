/* ======================================================
   Admin Panel — Socket.IO client
   ====================================================== */

"use strict";

const socket = io({ transports: ["websocket", "polling"] });

// ── DOM refs ──────────────────────────────────────────
const authScreen    = document.getElementById("auth-screen");
const controlPanel  = document.getElementById("control-panel");
const masterInput   = document.getElementById("master-code-input");
const authBtn       = document.getElementById("auth-btn");
const authError     = document.getElementById("auth-error");

const statusBadge   = document.getElementById("status-badge");
const studentsCount = document.getElementById("students-count");
const questionCounter = document.getElementById("question-counter");
const questionTypeLabel = document.getElementById("question-type-label");
const questionText  = document.getElementById("question-text");
const optionsList   = document.getElementById("options-list");
const freetextPlaceholder = document.getElementById("freetext-placeholder");

const startBtn   = document.getElementById("start-btn");
const pauseBtn   = document.getElementById("pause-btn");
const resetBtn   = document.getElementById("reset-btn");
const prevBtn    = document.getElementById("prev-btn");
const nextBtn    = document.getElementById("next-btn");
const revealBtn  = document.getElementById("reveal-btn");
const hideBtn    = document.getElementById("hide-btn");
const navControls = document.getElementById("nav-controls");
const statsGroup = document.getElementById("stats-group");

const statAnswers = document.getElementById("stat-answers");
const statOnline  = document.getElementById("stat-online");
const responseRateFill  = document.getElementById("response-rate-fill");
const responseRateLabel = document.getElementById("response-rate-label");

const resultsPanel = document.getElementById("results-panel");
const resultsBars  = document.getElementById("results-bars");
const freeResponsesList = document.getElementById("free-responses-list");

const qrBtn     = document.getElementById("qr-btn");
const qrModal   = document.getElementById("qr-modal");
const closeModal = document.getElementById("close-modal");
const qrUrlText = document.getElementById("qr-url-text");

// ── App state ─────────────────────────────────────────
let currentState = null;

// ── Auth ──────────────────────────────────────────────
function attemptAuth() {
  const code = masterInput.value.trim();
  if (!code) return;
  socket.emit("admin_auth", { code });
}

authBtn.addEventListener("click", attemptAuth);
masterInput.addEventListener("keydown", (e) => { if (e.key === "Enter") attemptAuth(); });

socket.on("auth_result", ({ success, state }) => {
  if (success) {
    authError.classList.add("hidden");
    authScreen.classList.add("hidden");
    controlPanel.classList.remove("hidden");
    if (state) applyState(state);
  } else {
    authError.classList.remove("hidden");
    masterInput.value = "";
    masterInput.focus();
  }
});

// ── Control buttons ───────────────────────────────────
startBtn.addEventListener("click",  () => socket.emit("start_quiz"));
pauseBtn.addEventListener("click",  () => socket.emit("pause_quiz"));
resetBtn.addEventListener("click",  () => {
  if (confirm("Reset the quiz? All answers will be cleared.")) {
    socket.emit("reset_quiz");
  }
});
prevBtn.addEventListener("click",   () => socket.emit("prev_question"));
nextBtn.addEventListener("click",   () => socket.emit("next_question"));
revealBtn.addEventListener("click", () => socket.emit("reveal_answer"));
hideBtn.addEventListener("click",   () => socket.emit("hide_answer"));

// ── QR Modal ──────────────────────────────────────────
qrBtn.addEventListener("click", () => {
  qrModal.classList.remove("hidden");
});
closeModal.addEventListener("click", () => qrModal.classList.add("hidden"));
qrModal.addEventListener("click", (e) => {
  if (e.target === qrModal) qrModal.classList.add("hidden");
});

// ── Socket events ─────────────────────────────────────
socket.on("quiz_state", (state) => applyState(state));

socket.on("live_counts", (data) => {
  updateLiveCounts(data);
});

socket.on("quiz_paused", ({ status }) => {
  if (currentState) {
    currentState.status = status;
    updateStatusUI(status);
    updateButtons(currentState);
  }
});

socket.on("quiz_reset", () => {
  if (currentState) {
    currentState.status = "idle";
    applyState(currentState);
  }
});

socket.on("answer_revealed", (data) => {
  if (currentState) {
    currentState.answer_revealed = true;
    renderRevealedResults(data);
    revealBtn.classList.add("hidden");
    hideBtn.classList.remove("hidden");
    resultsPanel.classList.remove("hidden");
  }
});

socket.on("answer_hidden", () => {
  if (currentState) {
    currentState.answer_revealed = false;
    resultsPanel.classList.add("hidden");
    revealBtn.classList.remove("hidden");
    hideBtn.classList.add("hidden");
  }
});

// ── State application ─────────────────────────────────
function applyState(state) {
  currentState = state;

  updateStatusUI(state.status);
  updateButtons(state);
  updateQuestion(state.question, state.current_question_index, state.total_questions);
  updateCounters(state.students_online);

  // Restore live counts if present
  if (state.live_counts) {
    updateLiveCounts(state.live_counts);
  }

  // Restore reveal if active
  if (state.answer_revealed && state.reveal_data) {
    renderRevealedResults(state.reveal_data);
    resultsPanel.classList.remove("hidden");
    revealBtn.classList.add("hidden");
    hideBtn.classList.remove("hidden");
  } else {
    resultsPanel.classList.add("hidden");
    revealBtn.classList.remove("hidden");
    hideBtn.classList.add("hidden");
  }
}

function updateStatusUI(status) {
  const labels = { idle: "Idle", active: "Active", paused: "Paused", revealing: "Revealing" };
  const classes = { idle: "badge-idle", active: "badge-active", paused: "badge-paused", revealing: "badge-revealing" };
  statusBadge.textContent = labels[status] || status;
  statusBadge.className = "badge " + (classes[status] || "badge-idle");
}

function updateButtons(state) {
  const { status } = state;

  startBtn.classList.toggle("hidden", status !== "idle");
  pauseBtn.classList.toggle("hidden", status !== "active" && status !== "paused");
  resetBtn.classList.toggle("hidden", status === "idle");
  navControls.classList.toggle("hidden", status === "idle");
  statsGroup.classList.toggle("hidden", status === "idle");

  if (status === "paused") {
    pauseBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Resume`;
  } else {
    pauseBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause`;
  }

  if (state.answer_revealed) {
    revealBtn.classList.add("hidden");
    hideBtn.classList.remove("hidden");
  } else {
    revealBtn.classList.remove("hidden");
    hideBtn.classList.add("hidden");
  }

  // Disable prev/next at boundaries
  prevBtn.disabled = state.current_question_index === 0;
  nextBtn.disabled = state.current_question_index >= (state.total_questions - 1);
}

function updateQuestion(q, idx, total) {
  if (!q) {
    questionCounter.textContent = "Question — / —";
    questionTypeLabel.textContent = "—";
    questionText.textContent = "Start the quiz to begin";
    optionsList.classList.add("hidden");
    freetextPlaceholder.classList.add("hidden");
    return;
  }

  questionCounter.textContent = `Question ${idx + 1} / ${total}`;
  questionTypeLabel.textContent = q.type === "multiple_choice" ? "Multiple Choice" : "Free Text";
  questionText.textContent = q.text;

  if (q.type === "multiple_choice") {
    freetextPlaceholder.classList.add("hidden");
    optionsList.classList.remove("hidden");
    optionsList.innerHTML = "";
    const letters = ["A", "B", "C", "D", "E", "F"];
    q.options.forEach((opt, i) => {
      const li = document.createElement("li");
      li.className = "option-item";
      // Show correct highlight if correct field present (admin state after reveal)
      if (q.correct !== undefined && q.correct === i) {
        li.classList.add("correct");
      }
      li.innerHTML = `<span class="option-letter">${letters[i]}</span><span>${escapeHtml(opt)}</span>`;
      optionsList.appendChild(li);
    });
  } else {
    optionsList.classList.add("hidden");
    freetextPlaceholder.classList.remove("hidden");
  }
}

function updateCounters(online) {
  studentsCount.textContent = online ?? 0;
  if (currentState) statOnline.textContent = online ?? 0;
}

function updateLiveCounts(data) {
  if (!data) return;
  const total = data.total_answers || 0;
  const online = data.students_online || 0;

  statAnswers.textContent = total;
  statOnline.textContent  = online;
  studentsCount.textContent = online;

  const pct = online > 0 ? Math.round((total / online) * 100) : 0;
  responseRateFill.style.width = pct + "%";
  responseRateLabel.textContent = `${pct}% responded`;

  // Update question counter students
  if (currentState) currentState.students_online = online;
}

function renderRevealedResults(data) {
  resultsBars.innerHTML = "";
  freeResponsesList.innerHTML = "";

  if (data.question_type === "multiple_choice" || data.counts !== undefined) {
    freeResponsesList.classList.add("hidden");
    resultsBars.classList.remove("hidden");

    const counts = data.counts || {};
    const total  = data.total_answers || 0;
    const correct = data.correct;

    // Get current question options
    const q = currentState?.question;
    const options = q?.options || [];
    const letters = ["A", "B", "C", "D", "E", "F"];

    options.forEach((opt, i) => {
      const cnt = counts[i] || 0;
      const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
      const isCorrect = correct !== undefined && correct === i;

      const row = document.createElement("div");
      row.className = "result-row";
      row.innerHTML = `
        <div class="result-label">
          <span>${letters[i]}. ${escapeHtml(opt)}${isCorrect ? " ✓" : ""}</span>
          <span class="pct">${pct}% <span class="count-val">(${cnt})</span></span>
        </div>
        <div class="bar-track">
          <div class="bar-fill ${isCorrect ? "correct-bar" : ""}" style="width: ${pct}%"></div>
        </div>`;
      resultsBars.appendChild(row);
    });
  } else {
    // Free text
    resultsBars.classList.add("hidden");
    freeResponsesList.classList.remove("hidden");

    const responses = data.responses || [];
    if (responses.length === 0) {
      freeResponsesList.innerHTML = '<div class="free-response-chip" style="color:#94a3b8">No responses yet.</div>';
    } else {
      responses.forEach((r) => {
        const chip = document.createElement("div");
        chip.className = "free-response-chip";
        chip.textContent = r;
        freeResponsesList.appendChild(chip);
      });
    }
  }
}

// ── Helpers ───────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Focus the auth input on load
masterInput.focus();

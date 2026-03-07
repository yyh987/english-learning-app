// app.js
let score = 0;
let qIndex = 0;

let currentTokens = [];
let userTokens = [];   // typed tokens
let tokenStates = [];  // "correct" | "wrong"

const home = document.getElementById("home");
const practice = document.getElementById("practice");
const result = document.getElementById("result");

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const playBtn = document.getElementById("playBtn");
const repeatBtn = document.getElementById("repeatBtn");
const rateSlider = document.getElementById("rate");
const rateVal = document.getElementById("rateVal");

const chipsEl = document.getElementById("chips");
const wordInput = document.getElementById("wordInput");
const addBtn = document.getElementById("addBtn");
const undoBtn = document.getElementById("undoBtn");

const skipBtn = document.getElementById("skipBtn");
const showBtn = document.getElementById("showBtn");
const nextBtn = document.getElementById("nextBtn");

const scoreEl = document.getElementById("score");
const feedbackEl = document.getElementById("feedback");
const qIndexEl = document.getElementById("qIndex");
const qTotalEl = document.getElementById("qTotal");
const progressFill = document.getElementById("progress-fill");

const finalScoreEl = document.getElementById("finalScore");
const badgeEl = document.getElementById("badge");

function tokenize(sentence) {
  // Keep punctuation attached (assignment. / tired,)
  return sentence.trim().split(/\s+/);
}

function normalizeWord(word) {
  // Compare case-insensitively, but keep punctuation in comparison.
  return word.trim().toLowerCase();
}

function setFeedback(msg, type = "") {
  feedbackEl.className = "feedback";
  if (type === "good") feedbackEl.classList.add("good");
  if (type === "bad") feedbackEl.classList.add("bad");
  feedbackEl.textContent = msg;
}

function renderChips() {
  chipsEl.innerHTML = "";
  userTokens.forEach((w, i) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    if (tokenStates[i] === "correct") chip.classList.add("correct");
    if (tokenStates[i] === "wrong") chip.classList.add("wrong");
    chip.textContent = w;
    chipsEl.appendChild(chip);
  });
}

function updateProgress() {
  const pct = Math.round(((qIndex) / listeningQuestions.length) * 100);
  progressFill.style.width = `${pct}%`;
}

function updateTop() {
  scoreEl.textContent = score.toString();
  qIndexEl.textContent = (qIndex + 1).toString();
  qTotalEl.textContent = listeningQuestions.length.toString();
}

function speakSentence(sentence) {
  if (!("speechSynthesis" in window)) {
    setFeedback("Your browser doesn't support text-to-speech. (Still OK for demo)", "bad");
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(sentence);
  utter.rate = parseFloat(rateSlider.value);
  utter.lang = "en-US"; // you can change to en-GB if you prefer
  window.speechSynthesis.speak(utter);
}

function loadQuestion() {
  const q = listeningQuestions[qIndex];
  currentTokens = tokenize(q.sentence);

  userTokens = [];
  tokenStates = [];
  renderChips();

  nextBtn.classList.add("hidden");
  setFeedback("Press Play, then type the first word.", "");
  updateTop();
  updateProgress();

  // auto-play once at start of question (optional)
  // speakSentence(q.sentence);

  wordInput.value = "";
  wordInput.focus();
}

function checkCompletion() {
  if (userTokens.length !== currentTokens.length) return false;

  // If all correct, finish question
  const allCorrect = tokenStates.every(s => s === "correct");
  if (allCorrect) {
    score += 10;
    scoreEl.textContent = score.toString();
    setFeedback("Perfect! ✅ Click Next.", "good");
    nextBtn.classList.remove("hidden");
    return true;
  }
  return false;
}

function addWord() {
  const raw = wordInput.value.trim();
  if (!raw) return;

  const expected = currentTokens[userTokens.length];
  if (expected === undefined) {
    setFeedback("You already completed the sentence. Click Next.", "good");
    wordInput.value = "";
    return;
  }

  userTokens.push(raw);

  const ok = normalizeWord(raw) === normalizeWord(expected);
  tokenStates.push(ok ? "correct" : "wrong");

  renderChips();

  if (ok) {
    setFeedback("Good. Next word.", "good");
  } else {
    // Minimal hint: show first letter of expected
    const hint = expected ? expected[0] : "";
    setFeedback(`Not quite. Hint: the next word starts with "${hint}".`, "bad");
  }

  wordInput.value = "";
  wordInput.focus();

  checkCompletion();
}

function undoWord() {
  if (userTokens.length === 0) return;
  userTokens.pop();
  tokenStates.pop();
  renderChips();
  setFeedback("Undone. Type again.", "");
  wordInput.focus();
}

function showAnswer() {
  // Reveal as chips in muted "wrong" for missing
  while (userTokens.length < currentTokens.length) {
    userTokens.push(currentTokens[userTokens.length]);
    tokenStates.push("wrong");
  }
  renderChips();
  setFeedback("Answer revealed. Click Next.", "bad");
  nextBtn.classList.remove("hidden");
}

function skipQuestion() {
  setFeedback("Skipped. Click Next.", "");
  nextBtn.classList.remove("hidden");
}

function nextQuestion() {
  qIndex++;
  if (qIndex >= listeningQuestions.length) {
    finish();
  } else {
    loadQuestion();
  }
}

function finish() {
  practice.classList.add("hidden");
  result.classList.remove("hidden");

  finalScoreEl.textContent = score.toString();
  badgeEl.textContent = score >= 30 ? "Academic Starter" : "Beginner";
}

startBtn.addEventListener("click", () => {
  score = 0;
  qIndex = 0;
  home.classList.add("hidden");
  result.classList.add("hidden");
  practice.classList.remove("hidden");
  loadQuestion();
});

restartBtn.addEventListener("click", () => {
  result.classList.add("hidden");
  home.classList.remove("hidden");
});

playBtn.addEventListener("click", () => {
  speakSentence(listeningQuestions[qIndex].sentence);
});

repeatBtn.addEventListener("click", () => {
  speakSentence(listeningQuestions[qIndex].sentence);
});

rateSlider.addEventListener("input", () => {
  rateVal.textContent = parseFloat(rateSlider.value).toFixed(1);
});

addBtn.addEventListener("click", addWord);
wordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addWord();
});

undoBtn.addEventListener("click", undoWord);

showBtn.addEventListener("click", showAnswer);
skipBtn.addEventListener("click", skipQuestion);
nextBtn.addEventListener("click", nextQuestion);

// Init UI counts
qTotalEl.textContent = listeningQuestions.length.toString();
rateVal.textContent = parseFloat(rateSlider.value).toFixed(1);
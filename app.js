const POINTS_PER_QUESTION = 10;
const AUTO_NEXT_DELAY_MS = 800;
const AUTO_PLAY_COUNT = 2;
const REPEAT_PAUSE_MS = 900;

let score = 0;
let qIndex = 0;
let autoNextTimerId = null;
let questionLocked = true;
let speechRunId = 0;
let answerRevealed = false;
let speechRepeatTimerId = null;
let currentTextbook = null;
let activeQuestions = [];

const home = document.getElementById("home");
const library = document.getElementById("library");
const practice = document.getElementById("practice");
const result = document.getElementById("result");

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const libraryBackBtn = document.getElementById("libraryBackBtn");

const playBtn = document.getElementById("playBtn");
const repeatBtn = document.getElementById("repeatBtn");
const rateSlider = document.getElementById("rate");
const rateVal = document.getElementById("rateVal");

const wordInput = document.getElementById("wordInput");
const addBtn = document.getElementById("addBtn");
const clearBtn = document.getElementById("clearBtn");
const answerRevealEl = document.getElementById("answerReveal");
const textbookGrid = document.getElementById("textbookGrid");

const skipBtn = document.getElementById("skipBtn");
const showBtn = document.getElementById("showBtn");
const nextBtn = document.getElementById("nextBtn");

const scoreEl = document.getElementById("score");
const feedbackEl = document.getElementById("feedback");
const qIndexEl = document.getElementById("qIndex");
const qTotalEl = document.getElementById("qTotal");
const progressFill = document.getElementById("progress-fill");

const practiceEyebrowEl = document.getElementById("practiceEyebrow");
const practiceTitleEl = document.getElementById("practiceTitle");
const practiceDescriptionEl = document.getElementById("practiceDescription");
const selectedTextbookNameEl = document.getElementById("selectedTextbookName");
const selectedTextbookMetaEl = document.getElementById("selectedTextbookMeta");

const finalScoreEl = document.getElementById("finalScore");
const badgeEl = document.getElementById("badge");
const resultTextbookEl = document.getElementById("resultTextbook");

function clearAutoNextTimer() {
  if (autoNextTimerId !== null) {
    clearTimeout(autoNextTimerId);
    autoNextTimerId = null;
  }
}

function clearSpeechRepeatTimer() {
  if (speechRepeatTimerId !== null) {
    clearTimeout(speechRepeatTimerId);
    speechRepeatTimerId = null;
  }
}

function cancelSpeech() {
  speechRunId += 1;
  clearSpeechRepeatTimer();

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function tokenize(sentence) {
  return sentence.trim().split(/\s+/).filter(Boolean);
}

function stripEdgePunctuation(word) {
  return word.replace(/^[^\w']+|[^\w']+$/g, "");
}

function normalizeWord(word) {
  return stripEdgePunctuation(word.trim()).toLowerCase();
}

function normalizeSentence(sentence) {
  return tokenize(sentence).map(normalizeWord).join(" ");
}

function getCurrentQuestion() {
  return activeQuestions[qIndex] || null;
}

function showScreen(screen) {
  home.classList.add("hidden");
  library.classList.add("hidden");
  practice.classList.add("hidden");
  result.classList.add("hidden");
  screen.classList.remove("hidden");
}

function setQuestionLocked(locked) {
  questionLocked = locked;
  wordInput.disabled = locked;
  addBtn.disabled = locked;
  clearBtn.disabled = locked;
}

function setFeedback(message, type = "") {
  feedbackEl.className = "feedback";

  if (type === "good") {
    feedbackEl.classList.add("good");
  }

  if (type === "bad") {
    feedbackEl.classList.add("bad");
  }

  feedbackEl.textContent = message;
}

function hideAnswerReveal() {
  answerRevealed = false;
  answerRevealEl.textContent = "";
  answerRevealEl.classList.add("hidden");
}

function showAnswerReveal(sentence) {
  answerRevealed = true;
  answerRevealEl.textContent = `Answer: ${sentence}`;
  answerRevealEl.classList.remove("hidden");
}

function updateProgress() {
  const total = activeQuestions.length;
  const pct = total === 0 ? 0 : Math.round((qIndex / total) * 100);
  progressFill.style.width = `${pct}%`;
}

function updateTop() {
  scoreEl.textContent = score.toString();
  qIndexEl.textContent = activeQuestions.length === 0 ? "0" : (qIndex + 1).toString();
  qTotalEl.textContent = activeQuestions.length.toString();
}

function updateSelectedTextbookCopy() {
  if (!currentTextbook) {
    practiceEyebrowEl.textContent = "Live listening drill";
    practiceTitleEl.textContent = "Train sentence accuracy with guided repetition.";
    practiceDescriptionEl.textContent =
      "The sentence plays automatically, students can replay or slow it down, and the answer can be revealed when needed.";
    selectedTextbookNameEl.textContent = "No textbook selected";
    selectedTextbookMetaEl.textContent = "Choose a collection";
    resultTextbookEl.textContent = "Textbook: Not selected";
    return;
  }

  practiceEyebrowEl.textContent = `${currentTextbook.level} textbook`;
  practiceTitleEl.textContent = currentTextbook.title;
  practiceDescriptionEl.textContent = `${currentTextbook.description} Audio still plays automatically, with replay and answer support available when needed.`;
  selectedTextbookNameEl.textContent = currentTextbook.audience;
  selectedTextbookMetaEl.textContent = `${activeQuestions.length} drills · ${currentTextbook.level}`;
  resultTextbookEl.textContent = `Textbook: ${currentTextbook.title}`;
}

function speakSentence(sentence, repeatCount = 1) {
  if (!("speechSynthesis" in window)) {
    setFeedback("This browser does not support text to speech for the demo.", "bad");
    return;
  }

  cancelSpeech();
  const currentRunId = speechRunId;

  function speakRemaining(remaining) {
    if (currentRunId !== speechRunId) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.rate = parseFloat(rateSlider.value);
    utterance.lang = "en-US";
    utterance.onend = () => {
      if (currentRunId !== speechRunId) {
        return;
      }

      if (remaining > 1) {
        speechRepeatTimerId = setTimeout(() => {
          speechRepeatTimerId = null;

          if (currentRunId !== speechRunId) {
            return;
          }

          speakRemaining(remaining - 1);
        }, REPEAT_PAUSE_MS);
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  speakRemaining(repeatCount);
}

function renderTextbookLibrary() {
  textbookGrid.innerHTML = "";

  textbookCollections.forEach((textbook, index) => {
    const card = document.createElement("article");
    card.className = "textbookCard";

    const preview = textbook.questions[0] ? textbook.questions[0].sentence : "No preview sentence yet.";
    card.innerHTML = `
      <span class="featureKicker">Textbook ${String(index + 1).padStart(2, "0")}</span>
      <h3>${textbook.title}</h3>
      <p class="textbookDescription">${textbook.description}</p>
      <div class="textbookMeta">
        <span class="summaryPill">${textbook.level}</span>
        <span class="summaryPill">${textbook.audience}</span>
        <span class="summaryPill">${textbook.questions.length} drills</span>
      </div>
      <p class="textbookPreview">Preview: ${preview}</p>
      <button class="btn primary textbookLaunchBtn" type="button">Practice This Book</button>
    `;

    card.querySelector(".textbookLaunchBtn").addEventListener("click", () => {
      startTextbook(textbook.id);
    });

    textbookGrid.appendChild(card);
  });
}

function showLibrary() {
  clearAutoNextTimer();
  cancelSpeech();
  hideAnswerReveal();
  setQuestionLocked(true);
  renderTextbookLibrary();
  showScreen(library);
}

function loadQuestion() {
  clearAutoNextTimer();
  cancelSpeech();

  const question = getCurrentQuestion();
  if (!question) {
    finish();
    return;
  }

  hideAnswerReveal();
  nextBtn.classList.add("hidden");
  setQuestionLocked(false);
  setFeedback("Audio starts automatically. Type the full sentence when ready.");
  updateTop();
  updateProgress();

  wordInput.value = "";
  wordInput.focus();
  speakSentence(question.sentence, AUTO_PLAY_COUNT);
}

function startTextbook(textbookId) {
  const textbook = textbookCollections.find((item) => item.id === textbookId);
  if (!textbook) {
    return;
  }

  clearAutoNextTimer();
  cancelSpeech();

  currentTextbook = textbook;
  activeQuestions = textbook.questions;
  score = 0;
  qIndex = 0;

  updateSelectedTextbookCopy();
  showScreen(practice);

  if (activeQuestions.length === 0) {
    finish();
    return;
  }

  loadQuestion();
}

function markCorrect() {
  score += POINTS_PER_QUESTION;
  updateTop();
  setFeedback("Correct. Loading the next sentence...", "good");
  setQuestionLocked(true);
  nextBtn.classList.add("hidden");

  clearAutoNextTimer();
  autoNextTimerId = setTimeout(() => {
    autoNextTimerId = null;
    nextQuestion();
  }, AUTO_NEXT_DELAY_MS);
}

function checkAnswer() {
  if (questionLocked) {
    return;
  }

  const question = getCurrentQuestion();
  const answer = wordInput.value.trim();

  if (!question || !answer) {
    return;
  }

  if (normalizeSentence(answer) === normalizeSentence(question.sentence)) {
    markCorrect();
    return;
  }

  if (answerRevealed) {
    setFeedback("Not quite. Compare your input with the answer below and try again.", "bad");
  } else {
    setFeedback("Close. Replay the audio or reveal the answer for support.", "bad");
  }

  wordInput.focus();
  wordInput.select();
}

function clearInput() {
  if (questionLocked) {
    return;
  }

  wordInput.value = "";
  hideAnswerReveal();
  nextBtn.classList.add("hidden");
  setFeedback("Cleared. Audio starts automatically on each new sentence.");
  wordInput.focus();
}

function showAnswer() {
  clearAutoNextTimer();

  const question = getCurrentQuestion();
  if (!question) {
    return;
  }

  showAnswerReveal(question.sentence);
  setQuestionLocked(false);
  setFeedback("Answer revealed below. Students can still keep typing.");
  nextBtn.classList.remove("hidden");
  wordInput.focus();
}

function skipQuestion() {
  clearAutoNextTimer();
  nextQuestion();
}

function nextQuestion() {
  clearAutoNextTimer();
  cancelSpeech();

  qIndex += 1;

  if (qIndex >= activeQuestions.length) {
    finish();
    return;
  }

  loadQuestion();
}

function finish() {
  clearAutoNextTimer();
  cancelSpeech();
  setQuestionLocked(true);
  hideAnswerReveal();
  progressFill.style.width = "100%";
  updateSelectedTextbookCopy();

  finalScoreEl.textContent = score.toString();

  const maxScore = activeQuestions.length * POINTS_PER_QUESTION;
  const ratio = maxScore === 0 ? 0 : score / maxScore;

  if (ratio === 1) {
    badgeEl.textContent = "Focused Listener";
  } else if (ratio >= 0.6) {
    badgeEl.textContent = "Building Accuracy";
  } else {
    badgeEl.textContent = "Warm-Up Mode";
  }

  showScreen(result);
}

function showHome() {
  clearAutoNextTimer();
  cancelSpeech();
  hideAnswerReveal();
  setQuestionLocked(true);
  showScreen(home);
}

function playCurrentSentence() {
  const question = getCurrentQuestion();

  if (question) {
    speakSentence(question.sentence);
  }
}

startBtn.addEventListener("click", showLibrary);
restartBtn.addEventListener("click", showLibrary);
libraryBackBtn.addEventListener("click", showHome);

playBtn.addEventListener("click", playCurrentSentence);
repeatBtn.addEventListener("click", playCurrentSentence);

rateSlider.addEventListener("input", () => {
  rateVal.textContent = parseFloat(rateSlider.value).toFixed(1);
});

addBtn.addEventListener("click", checkAnswer);
wordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    checkAnswer();
  }
});

clearBtn.addEventListener("click", clearInput);
showBtn.addEventListener("click", showAnswer);
skipBtn.addEventListener("click", skipQuestion);
nextBtn.addEventListener("click", nextQuestion);

setQuestionLocked(true);
updateSelectedTextbookCopy();
updateTop();
rateVal.textContent = parseFloat(rateSlider.value).toFixed(1);

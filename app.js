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

const home = document.getElementById("home");
const practice = document.getElementById("practice");
const result = document.getElementById("result");

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const playBtn = document.getElementById("playBtn");
const repeatBtn = document.getElementById("repeatBtn");
const rateSlider = document.getElementById("rate");
const rateVal = document.getElementById("rateVal");

const wordInput = document.getElementById("wordInput");
const addBtn = document.getElementById("addBtn");
const clearBtn = document.getElementById("clearBtn");
const answerRevealEl = document.getElementById("answerReveal");

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
  return listeningQuestions[qIndex] || null;
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
  const total = listeningQuestions.length;
  const pct = total === 0 ? 0 : Math.round((qIndex / total) * 100);
  progressFill.style.width = `${pct}%`;
}

function updateTop() {
  scoreEl.textContent = score.toString();
  qIndexEl.textContent = listeningQuestions.length === 0 ? "0" : (qIndex + 1).toString();
  qTotalEl.textContent = listeningQuestions.length.toString();
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

  if (qIndex >= listeningQuestions.length) {
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

  practice.classList.add("hidden");
  result.classList.remove("hidden");
  progressFill.style.width = "100%";

  finalScoreEl.textContent = score.toString();

  const maxScore = listeningQuestions.length * POINTS_PER_QUESTION;
  const ratio = maxScore === 0 ? 0 : score / maxScore;

  if (ratio === 1) {
    badgeEl.textContent = "Focused Listener";
  } else if (ratio >= 0.6) {
    badgeEl.textContent = "Building Accuracy";
  } else {
    badgeEl.textContent = "Warm-Up Mode";
  }
}

startBtn.addEventListener("click", () => {
  clearAutoNextTimer();
  cancelSpeech();

  score = 0;
  qIndex = 0;

  home.classList.add("hidden");
  result.classList.add("hidden");
  practice.classList.remove("hidden");

  if (listeningQuestions.length === 0) {
    finish();
    return;
  }

  loadQuestion();
});

restartBtn.addEventListener("click", () => {
  clearAutoNextTimer();
  cancelSpeech();

  result.classList.add("hidden");
  practice.classList.add("hidden");
  home.classList.remove("hidden");
  hideAnswerReveal();
});

function playCurrentSentence() {
  const question = getCurrentQuestion();

  if (question) {
    speakSentence(question.sentence);
  }
}

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
updateTop();
rateVal.textContent = parseFloat(rateSlider.value).toFixed(1);

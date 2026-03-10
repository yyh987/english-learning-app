const POINTS_PER_QUESTION = 10;
const AUTO_NEXT_DELAY_MS = 800;
const AUTO_PLAY_COUNT = 2;
const REPEAT_PAUSE_MS = 900;
const TEXTBOOK_CONTENT_URL = "data/textbooks.json?v=20260310a";
const AI_HINT_API_URL =
  window.LingoDictationConfig && typeof window.LingoDictationConfig.aiHintUrl === "string"
    ? window.LingoDictationConfig.aiHintUrl
    : "";

let score = 0;
let qIndex = 0;
let autoNextTimerId = null;
let questionLocked = true;
let speechRunId = 0;
let answerRevealed = false;
let speechRepeatTimerId = null;
let currentTextbook = null;
let activeQuestions = [];
let textbookCollections = [];
let textbookCollectionPromise = null;
let aiHintLoading = false;
let aiHintRequestId = 0;
const aiHintCache = new Map();

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
const homeStatusEl = document.getElementById("homeStatus");
const aiHintBtn = document.getElementById("aiHintBtn");
const aiHintPanel = document.getElementById("aiHintPanel");
const aiHintTextEl = document.getElementById("aiHintText");
const aiHintMetaEl = document.getElementById("aiHintMeta");

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
  updateAiHintButtonState();
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

function setHomeStatus(message, type = "") {
  homeStatusEl.className = "statusNote";

  if (type === "bad") {
    homeStatusEl.classList.add("bad");
  }

  homeStatusEl.textContent = message;
}

function setStartButtonLoading(isLoading) {
  startBtn.disabled = isLoading;
  startBtn.textContent = isLoading ? "Loading..." : "Launch Demo";
}

function updateAiHintButtonState() {
  aiHintBtn.disabled = questionLocked || aiHintLoading;
  aiHintBtn.textContent = aiHintLoading ? "Thinking..." : "AI Hint";
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

function hideAiHint() {
  aiHintPanel.classList.add("hidden");
  aiHintTextEl.textContent = "";
  aiHintMetaEl.textContent = "Guided support";
}

function showAiHint(text, meta = "Guided support") {
  aiHintTextEl.textContent = text;
  aiHintMetaEl.textContent = meta;
  aiHintPanel.classList.remove("hidden");
}

function setAiHintLoading(isLoading) {
  aiHintLoading = isLoading;
  updateAiHintButtonState();
}

function resetAiHintState() {
  aiHintRequestId += 1;
  setAiHintLoading(false);
  hideAiHint();
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

function getNormalizedWords(sentence) {
  return tokenize(sentence).map(normalizeWord).filter(Boolean);
}

function getHintCacheKey(question, answer) {
  const textbookId = currentTextbook ? currentTextbook.id : "default";
  return `${textbookId}:${qIndex}:${normalizeSentence(question.sentence)}:${normalizeSentence(answer)}`;
}

function getFirstMismatch(targetWords, answerWords) {
  const maxLength = Math.min(targetWords.length, answerWords.length);

  for (let index = 0; index < maxLength; index += 1) {
    if (targetWords[index] !== answerWords[index]) {
      return {
        index,
        type: "different",
        targetWord: targetWords[index],
        answerWord: answerWords[index]
      };
    }
  }

  if (answerWords.length < targetWords.length) {
    return {
      index: answerWords.length,
      type: "missing",
      targetWord: targetWords[answerWords.length],
      answerWord: ""
    };
  }

  if (answerWords.length > targetWords.length) {
    return {
      index: targetWords.length,
      type: "extra",
      targetWord: "",
      answerWord: answerWords[targetWords.length]
    };
  }

  return null;
}

function describeHintSlot(targetWords, index) {
  if (index <= 0) {
    return "the opening word";
  }

  if (index >= targetWords.length - 1) {
    return "the final word";
  }

  return `the word after "${targetWords[index - 1]}"`;
}

function describeWordLength(word) {
  if (word.length <= 4) {
    return "short";
  }

  if (word.length <= 7) {
    return "medium-length";
  }

  return "longer";
}

function buildLocalAiHint(question, answer) {
  const targetWords = getNormalizedWords(question.sentence);
  const answerWords = getNormalizedWords(answer);

  if (!answerWords.length) {
    return `Start with the opening phrase first. This sentence has ${targetWords.length} words, so catch the subject and verb before you worry about the ending.`;
  }

  if (normalizeSentence(answer) === normalizeSentence(question.sentence)) {
    return "Your sentence already matches the target. Click Check to submit it.";
  }

  if (answerWords.length + 2 < targetWords.length) {
    return "Your answer is much shorter than the target. Replay the audio and listen for the clause near the end before you submit again.";
  }

  if (answerWords.length > targetWords.length + 1) {
    return "Your answer is longer than the target. Trim any extra word and match the exact sentence you hear.";
  }

  const mismatch = getFirstMismatch(targetWords, answerWords);

  if (!mismatch) {
    return "Listen once more for the sentence rhythm and punctuation, then submit the exact wording you hear.";
  }

  const slot = describeHintSlot(targetWords, mismatch.index);

  if (mismatch.type === "extra") {
    return `There is an extra word near ${slot}. Replay the audio and keep only the exact words you hear.`;
  }

  const clueWord = mismatch.targetWord;
  const clueStarter = clueWord.charAt(0).toUpperCase();
  const clueLength = describeWordLength(clueWord);

  if (answerRevealed) {
    return `Compare ${slot}. The correct word is a ${clueLength} word that starts with "${clueStarter}".`;
  }

  if (mismatch.type === "missing") {
    return `You are close. A ${clueLength} word is missing at ${slot}, and it starts with "${clueStarter}".`;
  }

  return `Focus on ${slot}. It should be a ${clueLength} word that starts with "${clueStarter}", so revise that part instead of changing the whole sentence.`;
}

async function requestRemoteAiHint(question, answer) {
  if (!AI_HINT_API_URL) {
    return null;
  }

  const response = await fetch(AI_HINT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sentence: question.sentence,
      answer,
      questionIndex: qIndex,
      textbook: currentTextbook
        ? {
            id: currentTextbook.id,
            title: currentTextbook.title,
            level: currentTextbook.level,
            audience: currentTextbook.audience
          }
        : null
    })
  });

  if (!response.ok) {
    throw new Error(`AI hint request failed (${response.status}).`);
  }

  const payload = await response.json();
  return payload && typeof payload.hint === "string" ? payload.hint.trim() : null;
}

async function requestAiHint() {
  if (questionLocked) {
    return;
  }

  const question = getCurrentQuestion();
  if (!question) {
    return;
  }

  const answer = wordInput.value.trim();

  if (normalizeSentence(answer) === normalizeSentence(question.sentence) && answer) {
    showAiHint("Your sentence already matches the target. Click Check to submit it.", "Ready to submit");
    setFeedback("Your answer looks correct. Submit it when ready.");
    return;
  }

  const cacheKey = getHintCacheKey(question, answer);
  const cachedHint = aiHintCache.get(cacheKey);

  if (cachedHint) {
    showAiHint(cachedHint.text, cachedHint.meta);
    setFeedback("Use the hint, replay the sentence, and revise your answer.");
    return;
  }

  aiHintRequestId += 1;
  const currentRequestId = aiHintRequestId;
  setAiHintLoading(true);
  setFeedback(answer ? "Generating a targeted hint for this attempt..." : "Generating a first-pass hint...");

  try {
    let hint = null;
    let meta = "AI-ready demo";

    if (AI_HINT_API_URL) {
      try {
        hint = await requestRemoteAiHint(question, answer);
        if (hint) {
          meta = "AI coach";
        }
      } catch (error) {
        console.error(error);
      }
    }

    if (!hint) {
      hint = buildLocalAiHint(question, answer);
    }

    if (currentRequestId !== aiHintRequestId) {
      return;
    }

    const hintPayload = { text: hint, meta };
    aiHintCache.set(cacheKey, hintPayload);
    showAiHint(hintPayload.text, hintPayload.meta);
    setFeedback("Use the hint, replay the sentence, and revise your answer.");
  } finally {
    if (currentRequestId === aiHintRequestId) {
      setAiHintLoading(false);
    }
  }
}

function normalizeTextbookCollections(payload) {
  const collections = Array.isArray(payload) ? payload : payload && Array.isArray(payload.textbooks) ? payload.textbooks : null;

  if (!collections) {
    throw new Error("Invalid textbook payload.");
  }

  return collections.map((textbook) => ({
    ...textbook,
    questions: Array.isArray(textbook.questions) ? textbook.questions : []
  }));
}

async function loadTextbookCollections() {
  if (textbookCollections.length > 0) {
    return textbookCollections;
  }

  if (!textbookCollectionPromise) {
    textbookCollectionPromise = fetch(TEXTBOOK_CONTENT_URL, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load textbook content (${response.status}).`);
        }

        return response.json();
      })
      .then((payload) => {
        textbookCollections = normalizeTextbookCollections(payload);
        return textbookCollections;
      })
      .catch((error) => {
        textbookCollectionPromise = null;
        throw error;
      });
  }

  return textbookCollectionPromise;
}

async function ensureTextbookContentLoaded() {
  if (textbookCollections.length > 0) {
    setHomeStatus(`${textbookCollections.length} textbook collections ready to demo.`);
    return true;
  }

  setStartButtonLoading(true);
  setHomeStatus("Loading textbook library...");

  try {
    await loadTextbookCollections();
    setHomeStatus(`${textbookCollections.length} textbook collections ready to demo.`);
    return true;
  } catch (error) {
    console.error(error);
    setHomeStatus("Unable to load textbook content. Refresh the page or run the app from a local server.", "bad");
    return false;
  } finally {
    setStartButtonLoading(false);
  }
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

  if (textbookCollections.length === 0) {
    textbookGrid.innerHTML = '<p class="practiceSub">No textbook collections are available yet.</p>';
    return;
  }

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

async function showLibrary() {
  const isLoaded = await ensureTextbookContentLoaded();
  if (!isLoaded) {
    showScreen(home);
    return;
  }

  clearAutoNextTimer();
  cancelSpeech();
  hideAnswerReveal();
  resetAiHintState();
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
  resetAiHintState();
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
  aiHintCache.clear();

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
  resetAiHintState();
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
  resetAiHintState();
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
  resetAiHintState();
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
  resetAiHintState();
  setQuestionLocked(true);
  showScreen(home);
}

function playCurrentSentence() {
  const question = getCurrentQuestion();

  if (question) {
    speakSentence(question.sentence);
  }
}

async function initializeApp() {
  setQuestionLocked(true);
  hideAiHint();
  updateSelectedTextbookCopy();
  updateTop();
  rateVal.textContent = parseFloat(rateSlider.value).toFixed(1);
  await ensureTextbookContentLoaded();
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
aiHintBtn.addEventListener("click", requestAiHint);
showBtn.addEventListener("click", showAnswer);
skipBtn.addEventListener("click", skipQuestion);
nextBtn.addEventListener("click", nextQuestion);

initializeApp();

"use strict";

(() => {
  const fallbackSentenceBank = [
    { sentence: "He plays basketball after school every day." },
    { sentence: "My sister bought a new laptop last month." },
    { sentence: "The train arrives at the station at nine." },
  ];
  const WORD_TOKEN_REGEX = /[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g;
  const FEMALE_HINTS = [
    "female",
    "woman",
    "girl",
    "samantha",
    "victoria",
    "karen",
    "moira",
    "susan",
    "serena",
    "zira",
    "ava",
  ];
  const MALE_HINTS = [
    "male",
    "man",
    "boy",
    "alex",
    "daniel",
    "fred",
    "tom",
    "oliver",
    "david",
    "mark",
    "george",
  ];
  const VOICE_PROFILES = {
    us_male: { region: "us", gender: "male", lang: "en-US" },
    us_female: { region: "us", gender: "female", lang: "en-US" },
    uk_male: { region: "uk", gender: "male", lang: "en-GB" },
    uk_female: { region: "uk", gender: "female", lang: "en-GB" },
  };

  const state = {
    questions: [],
    currentIndex: 0,
    total: 0,
    score: 0,
    expectedTokens: [],
    userTokens: [],
    tokenStatus: [],
    locked: false,
    speechRate: 0.9,
    availableVoices: [],
    selectedVoiceProfile: "us_female",
  };

  const ui = {
    homePage: null,
    practicePage: null,
    resultPage: null,
    startBtn: null,
    restartBtn: null,
    playBtn: null,
    repeatBtn: null,
    showAnswerBtn: null,
    speedRange: null,
    speedValue: null,
    voiceSelect: null,
    questionCounter: null,
    liveScore: null,
    progressFill: null,
    wordForm: null,
    wordInput: null,
    submitWordBtn: null,
    chips: null,
    feedback: null,
    answerText: null,
    nextBtn: null,
    finalScore: null,
    finalMeta: null,
  };

  function selectUi() {
    ui.homePage = document.getElementById("home-page");
    ui.practicePage = document.getElementById("practice-page");
    ui.resultPage = document.getElementById("result-page");

    ui.startBtn = document.getElementById("start-btn");
    ui.restartBtn = document.getElementById("restart-btn");

    ui.playBtn = document.getElementById("play-btn");
    ui.repeatBtn = document.getElementById("repeat-btn");
    ui.showAnswerBtn = document.getElementById("show-answer-btn");
    ui.speedRange = document.getElementById("speed-range");
    ui.speedValue = document.getElementById("speed-value");
    ui.voiceSelect = document.getElementById("voice-select");

    ui.questionCounter = document.getElementById("question-counter");
    ui.liveScore = document.getElementById("live-score");
    ui.progressFill = document.getElementById("progress-fill");

    ui.wordForm = document.getElementById("word-form");
    ui.wordInput = document.getElementById("word-input");
    ui.submitWordBtn = document.getElementById("submit-word-btn");
    ui.chips = document.getElementById("chips");
    ui.feedback = document.getElementById("feedback");
    ui.answerText = document.getElementById("answer-text");
    ui.nextBtn = document.getElementById("next-btn");

    ui.finalScore = document.getElementById("final-score");
    ui.finalMeta = document.getElementById("final-meta");
  }

  function normalizeQuestionBank(raw) {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .map((item) => {
        if (typeof item === "string") {
          return { sentence: item.trim() };
        }

        if (!item || typeof item !== "object") {
          return null;
        }

        const sentence =
          typeof item.sentence === "string"
            ? item.sentence.trim()
            : typeof item.text === "string"
              ? item.text.trim()
              : "";

        if (!sentence) {
          return null;
        }

        return { sentence };
      })
      .filter((item) => item && item.sentence);
  }

  function loadQuestions() {
    const bank =
      window.sentenceBank || window.questions || window.questionBank || [];
    const normalized = normalizeQuestionBank(bank);
    if (normalized.length > 0) {
      return normalized;
    }
    return normalizeQuestionBank(fallbackSentenceBank);
  }

  function showPage(pageName) {
    ui.homePage.hidden = pageName !== "home";
    ui.practicePage.hidden = pageName !== "practice";
    ui.resultPage.hidden = pageName !== "result";
  }

  function isTtsSupported() {
    return (
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance === "function"
    );
  }

  function splitWords(sentence) {
    const matchedWords = sentence.match(WORD_TOKEN_REGEX);
    if (matchedWords && matchedWords.length > 0) {
      return matchedWords;
    }
    return sentence.trim().split(/\s+/).filter(Boolean);
  }

  function normalizeWord(word) {
    return word
      .toLowerCase()
      .replace(/[^a-z0-9'-]/g, "")
      .replace(/^-+|-+$/g, "");
  }

  function getCurrentQuestion() {
    return state.questions[state.currentIndex];
  }

  function scoreVoiceForEnglish(voice) {
    const lang = (voice.lang || "").toLowerCase();
    const name = (voice.name || "").toLowerCase();
    let score = 0;

    if (lang === "en-us") {
      score += 100;
    } else if (lang.startsWith("en-")) {
      score += 85;
    } else if (lang.startsWith("en")) {
      score += 70;
    }

    if (voice.default) {
      score += 20;
    }

    if (
      name.includes("samantha") ||
      name.includes("alex") ||
      name.includes("google us english") ||
      name.includes("enhanced") ||
      name.includes("natural")
    ) {
      score += 12;
    }

    return score;
  }

  function inferVoiceGender(voice) {
    const name = (voice.name || "").toLowerCase();
    if (FEMALE_HINTS.some((hint) => name.includes(hint))) {
      return "female";
    }
    if (MALE_HINTS.some((hint) => name.includes(hint))) {
      return "male";
    }
    return "unknown";
  }

  function scoreVoiceForProfile(voice, profileKey) {
    const profile = VOICE_PROFILES[profileKey] || VOICE_PROFILES.us_female;
    const lang = (voice.lang || "").toLowerCase();
    const name = (voice.name || "").toLowerCase();

    let score = scoreVoiceForEnglish(voice);

    if (profile.region === "us") {
      if (lang === "en-us") {
        score += 70;
      } else if (lang.startsWith("en-")) {
        score += 20;
      }
      if (name.includes("us") || name.includes("american")) {
        score += 30;
      }
    } else {
      if (lang === "en-gb") {
        score += 70;
      } else if (lang.startsWith("en-")) {
        score += 20;
      }
      if (name.includes("uk") || name.includes("british") || name.includes("england")) {
        score += 30;
      }
    }

    const inferredGender = inferVoiceGender(voice);
    if (inferredGender === profile.gender) {
      score += 40;
    } else if (inferredGender === "unknown") {
      score += 6;
    } else {
      score -= 12;
    }

    return score;
  }

  function pickVoiceForCurrentProfile() {
    if (!state.availableVoices.length) {
      return null;
    }

    const profileKey = state.selectedVoiceProfile;
    const sorted = [...state.availableVoices].sort(
      (a, b) => scoreVoiceForProfile(b, profileKey) - scoreVoiceForProfile(a, profileKey)
    );
    return sorted[0] || null;
  }

  function refreshAvailableVoices() {
    if (!isTtsSupported()) {
      state.availableVoices = [];
      ui.voiceSelect.disabled = true;
      return;
    }

    const allVoices = window.speechSynthesis.getVoices().filter(Boolean);
    if (!allVoices.length) {
      state.availableVoices = [];
      ui.voiceSelect.disabled = true;
      return;
    }

    const englishVoices = allVoices.filter((voice) =>
      /^en(?:-|$)/i.test(voice.lang || "")
    );
    state.availableVoices = englishVoices.length > 0 ? englishVoices : allVoices;
    ui.voiceSelect.disabled = false;
  }

  function setFeedback(message, tone) {
    ui.feedback.textContent = message;
    ui.feedback.classList.remove("feedback-correct", "feedback-wrong");
    if (tone === "correct") {
      ui.feedback.classList.add("feedback-correct");
    }
    if (tone === "wrong") {
      ui.feedback.classList.add("feedback-wrong");
    }
  }

  function updateScore() {
    ui.liveScore.textContent = `Score: ${state.score}`;
  }

  function updateProgress() {
    ui.questionCounter.textContent = `Question ${state.currentIndex + 1}/${state.total}`;
    const completedRaw = state.currentIndex + (state.locked ? 1 : 0);
    const completed = Math.min(state.total, Math.max(0, completedRaw));
    const pct = state.total > 0 ? Math.round((completed / state.total) * 100) : 0;
    ui.progressFill.style.width = `${pct}%`;
  }

  function showCorrectAnswer() {
    const current = getCurrentQuestion();
    if (!current) {
      return;
    }
    ui.answerText.textContent = `Correct answer: ${current.sentence}`;
    setFeedback("Answer revealed.", "");
  }

  function renderChip(word, isCorrect) {
    const chip = document.createElement("span");
    chip.className = `chip ${isCorrect ? "chip-correct" : "chip-wrong"}`;
    chip.textContent = word;
    ui.chips.appendChild(chip);
  }

  function setInputLock(lock) {
    ui.wordInput.disabled = lock;
    ui.submitWordBtn.disabled = lock;
    if (!lock) {
      ui.wordInput.focus();
    }
  }

  function speakCurrentSentence() {
    const current = getCurrentQuestion();
    if (!current) {
      return;
    }

    if (!isTtsSupported()) {
      setFeedback("Text-to-speech is not supported in this browser.", "wrong");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(current.sentence);
    utterance.rate = state.speechRate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    if (!state.availableVoices.length) {
      refreshAvailableVoices();
    }

    const chosen = pickVoiceForCurrentProfile();
    if (chosen) {
      utterance.voice = chosen;
      utterance.lang = chosen.lang || "en-US";
    } else {
      const profile = VOICE_PROFILES[state.selectedVoiceProfile] || VOICE_PROFILES.us_female;
      utterance.lang = profile.lang;
      setFeedback("Exact voice not found. Using browser default.", "");
    }

    utterance.onerror = () => {
      setFeedback("Speech playback failed. Try another voice.", "wrong");
    };

    window.speechSynthesis.speak(utterance);
  }

  function completeQuestion(firstWrongInfo = null) {
    if (state.locked) {
      return;
    }

    state.locked = true;
    setInputLock(true);

    const fullyCorrect =
      state.tokenStatus.length === state.expectedTokens.length &&
      state.tokenStatus.every(Boolean);

    if (fullyCorrect) {
      state.score += 10;
      setFeedback("Sentence complete. +10 points.", "correct");
    } else {
      if (firstWrongInfo) {
        const hint =
          firstWrongInfo.expectedNormalized.charAt(0) ||
          firstWrongInfo.expectedWord.charAt(0) ||
          "?";
        setFeedback(
          `Sentence complete. Word ${firstWrongInfo.expectedIndex + 1} hint: starts with "${hint}".`,
          "wrong"
        );
      } else {
        setFeedback("Sentence complete. Continue to the next sentence.", "wrong");
      }
    }

    updateScore();
    updateProgress();

    ui.nextBtn.hidden = false;
    ui.nextBtn.textContent =
      state.currentIndex === state.total - 1 ? "Finish Session" : "Next Question";
  }

  function submitWord() {
    if (state.locked) {
      return;
    }

    const rawValue = ui.wordInput.value.trim();
    if (!rawValue) {
      setFeedback("Type at least one word before submitting.", "wrong");
      return;
    }

    const rawTokens = rawValue.split(/\s+/).filter(Boolean);
    if (rawTokens.length === 0) {
      setFeedback("Please enter at least one word.", "wrong");
      return;
    }

    const remaining = state.expectedTokens.length - state.userTokens.length;
    if (remaining <= 0) {
      completeQuestion();
      return;
    }

    const tokensToProcess = rawTokens.slice(0, remaining);
    let firstWrong = null;
    let acceptedCount = 0;

    tokensToProcess.forEach((typedWord) => {
      const expectedIndex = state.userTokens.length;
      const expectedWord = state.expectedTokens[expectedIndex];
      const expectedNormalized = normalizeWord(expectedWord);
      const typedNormalized = normalizeWord(typedWord);
      const isCorrect = typedNormalized && typedNormalized === expectedNormalized;

      state.userTokens.push(typedWord);
      state.tokenStatus.push(Boolean(isCorrect));
      renderChip(typedWord, Boolean(isCorrect));
      acceptedCount += 1;

      if (!isCorrect && !firstWrong) {
        firstWrong = {
          expectedIndex,
          expectedWord,
          expectedNormalized,
        };
      }
    });

    ui.wordInput.value = "";

    if (state.userTokens.length >= state.expectedTokens.length) {
      completeQuestion(firstWrong);
      return;
    }

    if (firstWrong) {
      const hint =
        firstWrong.expectedNormalized.charAt(0) ||
        firstWrong.expectedWord.charAt(0) ||
        "?";
      setFeedback(
        `Word ${firstWrong.expectedIndex + 1} is wrong. Hint: first letter is "${hint}".`,
        "wrong"
      );
    } else if (acceptedCount > 1) {
      setFeedback(`Accepted ${acceptedCount} words. Keep going.`, "correct");
    } else {
      setFeedback(`Word ${state.userTokens.length} is correct.`, "correct");
    }

    ui.wordInput.focus();
  }

  function loadQuestion() {
    const current = getCurrentQuestion();
    state.expectedTokens = splitWords(current.sentence);
    state.userTokens = [];
    state.tokenStatus = [];
    state.locked = false;

    ui.chips.replaceChildren();
    ui.nextBtn.hidden = true;
    ui.wordInput.value = "";
    ui.answerText.textContent = "";

    if (state.expectedTokens.length === 0) {
      state.locked = true;
      setInputLock(true);
      setFeedback(
        "This sentence has no valid word tokens. Continue to the next sentence.",
        "wrong"
      );
      updateScore();
      updateProgress();
      ui.nextBtn.hidden = false;
      ui.nextBtn.textContent =
        state.currentIndex === state.total - 1 ? "Finish Session" : "Next Question";
      return;
    }

    setInputLock(false);
    setFeedback("Listen to the sentence, then type the full sentence or next word.", "");

    updateScore();
    updateProgress();
    speakCurrentSentence();
  }

  function endSession() {
    showPage("result");
    const maxScore = state.total * 10;
    const accuracy = maxScore > 0 ? Math.round((state.score / maxScore) * 100) : 0;
    ui.finalScore.textContent = `${state.score}/${maxScore}`;
    ui.finalMeta.textContent = `You completed ${state.total} sentences (${accuracy}% accuracy).`;
    if (isTtsSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  function goToNextQuestion() {
    if (!state.locked) {
      return;
    }

    if (state.currentIndex >= state.total - 1) {
      endSession();
      return;
    }

    state.currentIndex += 1;
    loadQuestion();
  }

  function startSession() {
    if (state.total === 0) {
      setFeedback("No sentences found in question bank.", "wrong");
      return;
    }

    if (isTtsSupported()) {
      window.speechSynthesis.cancel();
    }

    state.currentIndex = 0;
    state.score = 0;
    showPage("practice");
    loadQuestion();
  }

  function bindEvents() {
    ui.startBtn.addEventListener("click", startSession);
    ui.restartBtn.addEventListener("click", startSession);

    ui.playBtn.addEventListener("click", speakCurrentSentence);
    ui.repeatBtn.addEventListener("click", speakCurrentSentence);
    ui.showAnswerBtn.addEventListener("click", showCorrectAnswer);

    ui.speedRange.addEventListener("input", () => {
      const value = Number.parseFloat(ui.speedRange.value);
      state.speechRate = Number.isFinite(value) ? value : 1.0;
      ui.speedValue.textContent = `${state.speechRate.toFixed(1)}x`;
    });

    ui.voiceSelect.addEventListener("change", () => {
      state.selectedVoiceProfile = ui.voiceSelect.value;
      setFeedback("Voice updated. Press Play Sentence to preview.", "");
    });

    ui.wordForm.addEventListener("submit", (event) => {
      event.preventDefault();
      submitWord();
    });

    ui.nextBtn.addEventListener("click", goToNextQuestion);
  }

  function init() {
    selectUi();

    state.questions = loadQuestions();
    state.total = state.questions.length;

    bindEvents();
    showPage("home");

    ui.speedValue.textContent = `${state.speechRate.toFixed(1)}x`;
    ui.progressFill.style.width = "0%";
    ui.voiceSelect.value = state.selectedVoiceProfile;

    if (!isTtsSupported()) {
      ui.playBtn.disabled = true;
      ui.repeatBtn.disabled = true;
      ui.voiceSelect.disabled = true;
    } else {
      refreshAvailableVoices();
      window.speechSynthesis.onvoiceschanged = refreshAvailableVoices;
    }

    window.addEventListener("beforeunload", () => {
      if (isTtsSupported()) {
        window.speechSynthesis.cancel();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

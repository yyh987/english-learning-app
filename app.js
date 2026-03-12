const POINTS_PER_QUESTION = 10;
const AUTO_NEXT_DELAY_MS = 800;
const AUTO_PLAY_COUNT = 2;
const REPEAT_PAUSE_MS = 900;
const MAX_WRONG_HISTORY = 3;
const TEXTBOOK_CONTENT_URL = "data/textbooks.json?v=20260312c";
const STUDENT_ROSTER_URL = "data/students.json?v=20260312c";
const AUTH_SESSION_KEY = "lingodictation-student-id";
const AI_CHAT_API_URL =
  window.LingoDictationConfig &&
  (typeof window.LingoDictationConfig.aiChatUrl === "string"
    ? window.LingoDictationConfig.aiChatUrl
    : typeof window.LingoDictationConfig.aiHintUrl === "string"
      ? window.LingoDictationConfig.aiHintUrl
      : "");

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
let studentDirectory = [];
let studentDirectoryPromise = null;
let authenticatedStudent = null;
let aiChatLoading = false;
let aiChatRequestId = 0;
let aiChatMessages = [];
let wrongAnswerHistory = [];
let wrongAnswerAttemptCount = 0;
let preferredSpeechVoice = null;

const login = document.getElementById("login");
const home = document.getElementById("home");
const library = document.getElementById("library");
const practice = document.getElementById("practice");
const result = document.getElementById("result");

const loginBtn = document.getElementById("loginBtn");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const libraryBackBtn = document.getElementById("libraryBackBtn");
const logoutBtn = document.getElementById("logoutBtn");

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
const loginStatusEl = document.getElementById("loginStatus");
const loginFeedbackEl = document.getElementById("loginFeedback");
const studentIdInput = document.getElementById("studentIdInput");
const studentCodeInput = document.getElementById("studentCodeInput");
const demoAccessGrid = document.getElementById("demoAccessGrid");
const aiChatMessagesEl = document.getElementById("aiChatMessages");
const aiChatInput = document.getElementById("aiChatInput");
const aiChatSendBtn = document.getElementById("aiChatSendBtn");
const aiCoachMetaEl = document.getElementById("aiCoachMeta");
const sessionBar = document.getElementById("sessionBar");
const sessionNameEl = document.getElementById("sessionName");
const sessionMetaEl = document.getElementById("sessionMeta");

const skipBtn = document.getElementById("skipBtn");
const showBtn = document.getElementById("showBtn");
const nextBtn = document.getElementById("nextBtn");

const scoreEl = document.getElementById("score");
const feedbackEl = document.getElementById("feedback");
const wrongHistoryCardEl = document.getElementById("wrongHistoryCard");
const wrongHistoryListEl = document.getElementById("wrongHistoryList");
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

function scoreSpeechVoice(voice) {
  const name = `${voice.name || ""} ${voice.voiceURI || ""}`.toLowerCase();
  let score = 0;

  if (/^en/i.test(voice.lang || "")) {
    score += 40;
  }

  if (voice.localService) {
    score += 6;
  }

  if (/natural|premium|enhanced|neural/i.test(name)) {
    score += 40;
  }

  if (/microsoft aria|microsoft jenny|microsoft guy|microsoft libby/i.test(name)) {
    score += 38;
  }

  if (/samantha|alex|ava|allison|serena|moira|daniel|karen/i.test(name)) {
    score += 32;
  }

  if (/google us english|google uk english|google english/i.test(name)) {
    score += 26;
  }

  if (/zira|hazel|fred/i.test(name)) {
    score -= 6;
  }

  return score;
}

function refreshPreferredSpeechVoice() {
  if (!("speechSynthesis" in window)) {
    preferredSpeechVoice = null;
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  const englishVoices = voices.filter((voice) => /^en/i.test(voice.lang || ""));

  if (englishVoices.length === 0) {
    preferredSpeechVoice = null;
    return null;
  }

  preferredSpeechVoice = englishVoices.sort((left, right) => scoreSpeechVoice(right) - scoreSpeechVoice(left))[0] || null;
  return preferredSpeechVoice;
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
  login.classList.add("hidden");
  home.classList.add("hidden");
  library.classList.add("hidden");
  practice.classList.add("hidden");
  result.classList.add("hidden");
  screen.classList.remove("hidden");
}

function normalizeStudentId(studentId) {
  return studentId.trim().toUpperCase();
}

function setLoginFeedback(message, type = "") {
  loginFeedbackEl.className = "feedback loginFeedback";

  if (type === "good") {
    loginFeedbackEl.classList.add("good");
  }

  if (type === "bad") {
    loginFeedbackEl.classList.add("bad");
  }

  loginFeedbackEl.textContent = message;
}

function setLoginStatus(message, type = "") {
  loginStatusEl.className = "statusNote";

  if (type === "bad") {
    loginStatusEl.classList.add("bad");
  }

  loginStatusEl.textContent = message;
}

function setLoginLoading(isLoading) {
  loginBtn.disabled = isLoading;
  loginBtn.textContent = isLoading ? "Signing In..." : "Sign In";
  studentIdInput.disabled = isLoading;
  studentCodeInput.disabled = isLoading;
}

function updateSessionBar() {
  if (!authenticatedStudent) {
    sessionBar.classList.add("hidden");
    return;
  }

  sessionNameEl.textContent = authenticatedStudent.name;
  sessionMetaEl.textContent = `${authenticatedStudent.className} · ${authenticatedStudent.school}`;
  sessionBar.classList.remove("hidden");
}

function getStudentTextbookIds(student = authenticatedStudent) {
  return student && Array.isArray(student.textbookIds) ? student.textbookIds : [];
}

function getAvailableTextbooks(student = authenticatedStudent) {
  const assignedTextbookIds = getStudentTextbookIds(student);

  if (assignedTextbookIds.length === 0) {
    return [];
  }

  const allowedIds = new Set(assignedTextbookIds);
  return textbookCollections.filter((textbook) => allowedIds.has(textbook.id));
}

function getAssignedTextbookSummary(student) {
  const assignedIds = getStudentTextbookIds(student);

  if (assignedIds.length === 0) {
    return "No textbooks assigned";
  }

  if (textbookCollections.length === 0) {
    return `${assignedIds.length} textbooks assigned`;
  }

  const textbookMap = new Map(textbookCollections.map((textbook) => [textbook.id, textbook.title]));
  const titles = assignedIds.map((textbookId) => textbookMap.get(textbookId)).filter(Boolean);

  return titles.length > 0 ? titles.join(" · ") : `${assignedIds.length} textbooks assigned`;
}

function clearPracticeState() {
  clearAutoNextTimer();
  cancelSpeech();
  currentTextbook = null;
  activeQuestions = [];
  score = 0;
  qIndex = 0;
  wordInput.value = "";
  hideAnswerReveal();
  resetWrongAnswerHistory();
  resetAiChatState(null);
  setQuestionLocked(true);
  setFeedback("");
  updateSelectedTextbookCopy();
  updateTop();
  updateProgress();
}

function showLogin() {
  clearPracticeState();
  showScreen(login);
}

function setQuestionLocked(locked) {
  questionLocked = locked;
  wordInput.disabled = locked;
  addBtn.disabled = locked;
  clearBtn.disabled = locked;
  updateAiChatComposerState();
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

function updateAiChatComposerState() {
  aiChatInput.disabled = questionLocked || aiChatLoading;
  aiChatSendBtn.disabled = questionLocked || aiChatLoading;
  aiChatSendBtn.textContent = aiChatLoading ? "Sending..." : "Send";
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

function renderWrongAnswerHistory() {
  wrongHistoryListEl.innerHTML = "";

  if (wrongAnswerHistory.length === 0) {
    wrongHistoryCardEl.classList.add("hidden");
    return;
  }

  wrongAnswerHistory.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "historyItem";

    const attempt = document.createElement("span");
    attempt.className = "historyAttempt";
    attempt.textContent = `Try ${entry.attempt}`;

    const answer = document.createElement("span");
    answer.className = "historyAnswer";
    answer.textContent = entry.answer;

    item.append(attempt, answer);
    wrongHistoryListEl.appendChild(item);
  });

  wrongHistoryCardEl.classList.remove("hidden");
}

function resetWrongAnswerHistory() {
  wrongAnswerHistory = [];
  wrongAnswerAttemptCount = 0;
  renderWrongAnswerHistory();
}

function recordWrongAnswer(answer) {
  wrongAnswerAttemptCount += 1;
  wrongAnswerHistory.push({
    attempt: wrongAnswerAttemptCount,
    answer
  });

  if (wrongAnswerHistory.length > MAX_WRONG_HISTORY) {
    wrongAnswerHistory = wrongAnswerHistory.slice(-MAX_WRONG_HISTORY);
  }

  renderWrongAnswerHistory();
}

function renderAiChatMessages() {
  aiChatMessagesEl.innerHTML = "";

  aiChatMessages.forEach((message) => {
    const bubble = document.createElement("div");
    bubble.className = `aiChatMessage ${message.role}`;

    const text = document.createElement("p");
    text.className = "aiChatMessageText";
    text.textContent = message.text;
    bubble.appendChild(text);

    if (message.meta) {
      const meta = document.createElement("span");
      meta.className = "aiChatMessageMeta";
      meta.textContent = message.meta;
      bubble.appendChild(meta);
    }

    aiChatMessagesEl.appendChild(bubble);
  });

  aiChatMessagesEl.scrollTop = aiChatMessagesEl.scrollHeight;
}

function pushAiChatMessage(role, text, meta = "") {
  aiChatMessages.push({ role, text, meta });
  renderAiChatMessages();
}

function getAiCoachIntro(question) {
  if (!question) {
    return "Ask about meaning, vocabulary, or the part of the sentence that is hard to catch.";
  }

  return "Ask about the meaning, a vocabulary word, or what part of this sentence is easy to miss.";
}

function setAiChatLoading(isLoading) {
  aiChatLoading = isLoading;
  updateAiChatComposerState();
}

function resetAiChatState(question = getCurrentQuestion()) {
  aiChatRequestId += 1;
  aiChatMessages = [];
  setAiChatLoading(false);
  aiCoachMetaEl.textContent = "Sentence support";
  pushAiChatMessage("assistant", getAiCoachIntro(question), "Ask AI");
  aiChatInput.value = "";
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

function normalizeStudentDirectory(payload) {
  const students = Array.isArray(payload) ? payload : payload && Array.isArray(payload.students) ? payload.students : null;

  if (!students) {
    throw new Error("Invalid student roster payload.");
  }

  return students.map((student) => ({
    ...student,
    id: normalizeStudentId(student.id || "")
  }));
}

function renderDemoAccessCards() {
  demoAccessGrid.innerHTML = "";

  studentDirectory.forEach((student) => {
    const card = document.createElement("article");
    card.className = "demoAccessCard";
    const textbookSummary = getAssignedTextbookSummary(student);
    card.innerHTML = `
      <strong>${student.name}</strong>
      <span>${student.className}</span>
      <span>ID: ${student.id}</span>
      <span>Code: ${student.password}</span>
      <span>${textbookSummary}</span>
    `;
    demoAccessGrid.appendChild(card);
  });
}

async function loadStudentDirectory() {
  if (studentDirectory.length > 0) {
    return studentDirectory;
  }

  if (!studentDirectoryPromise) {
    studentDirectoryPromise = fetch(STUDENT_ROSTER_URL, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load student roster (${response.status}).`);
        }

        return response.json();
      })
      .then((payload) => {
        studentDirectory = normalizeStudentDirectory(payload);
        renderDemoAccessCards();
        return studentDirectory;
      })
      .catch((error) => {
        studentDirectoryPromise = null;
        throw error;
      });
  }

  return studentDirectoryPromise;
}

async function ensureStudentDirectoryLoaded() {
  if (studentDirectory.length > 0) {
    setLoginStatus(`${studentDirectory.length} student accounts ready for demo access.`);
    return true;
  }

  setLoginLoading(true);
  setLoginStatus("Loading student access...");

  try {
    await loadStudentDirectory();
    setLoginStatus(`${studentDirectory.length} student accounts ready for demo access.`);
    return true;
  } catch (error) {
    console.error(error);
    setLoginStatus("Unable to load student access. Refresh the page or run the app from a local server.", "bad");
    return false;
  } finally {
    setLoginLoading(false);
  }
}

function findStudentByCredentials(studentId, password) {
  const normalizedId = normalizeStudentId(studentId);
  return studentDirectory.find((student) => student.id === normalizedId && student.password === password) || null;
}

function saveStudentSession(student) {
  authenticatedStudent = student;
  sessionStorage.setItem(AUTH_SESSION_KEY, student.id);
  updateSessionBar();
  const availableCount = getStudentTextbookIds(student).length;
  setHomeStatus(`${availableCount} textbooks assigned to ${student.name}.`);
}

function restoreStudentSession() {
  const studentId = sessionStorage.getItem(AUTH_SESSION_KEY);
  if (!studentId) {
    return false;
  }

  const student = studentDirectory.find((entry) => entry.id === normalizeStudentId(studentId));
  if (!student) {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    return false;
  }

  authenticatedStudent = student;
  updateSessionBar();
  setHomeStatus(`${getStudentTextbookIds(student).length} textbooks assigned to ${student.name}.`);
  return true;
}

async function loginStudent() {
  const isRosterReady = await ensureStudentDirectoryLoaded();
  if (!isRosterReady) {
    return;
  }

  const studentId = studentIdInput.value.trim();
  const password = studentCodeInput.value.trim();

  if (!studentId || !password) {
    setLoginFeedback("Enter both the student ID and access code.", "bad");
    return;
  }

  setLoginLoading(true);

  try {
    const student = findStudentByCredentials(studentId, password);

    if (!student) {
      setLoginFeedback("Student ID or access code is not correct.", "bad");
      return;
    }

    saveStudentSession(student);
    setLoginFeedback(`Welcome, ${student.name}.`, "good");
    studentIdInput.value = "";
    studentCodeInput.value = "";
    showHome();
  } finally {
    setLoginLoading(false);
  }
}

function logoutStudent() {
  authenticatedStudent = null;
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  updateSessionBar();
  setLoginFeedback("");
  studentIdInput.value = "";
  studentCodeInput.value = "";
  showLogin();
}

function getNormalizedWords(sentence) {
  return tokenize(sentence).map(normalizeWord).filter(Boolean);
}

function getQuestionSupport(question) {
  const support = question && question.support && typeof question.support === "object" ? question.support : {};

  return {
    meaning: typeof support.meaning === "string" ? support.meaning : "This sentence is asking you to focus on the exact wording and the main idea.",
    listeningFocus:
      typeof support.listeningFocus === "string"
        ? support.listeningFocus
        : "Listen for the opening subject, the main verb, and the final phrase before you type.",
    vocabulary: support.vocabulary && typeof support.vocabulary === "object" ? support.vocabulary : {}
  };
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

function buildDifferenceReply(question, answer, support) {
  const targetWords = getNormalizedWords(question.sentence);
  const answerWords = getNormalizedWords(answer);

  if (!answerWords.length) {
    return `Start with the opening phrase first. ${support.listeningFocus}`;
  }

  if (normalizeSentence(answer) === normalizeSentence(question.sentence)) {
    return "Your current answer already matches the sentence. Click Check to submit it.";
  }

  if (answerWords.length + 2 < targetWords.length) {
    return `Your answer is much shorter than the target. ${support.listeningFocus}`;
  }

  if (answerWords.length > targetWords.length + 1) {
    return `Your answer is longer than the target. Remove any extra word and match the exact sentence. ${support.listeningFocus}`;
  }

  const mismatch = getFirstMismatch(targetWords, answerWords);

  if (!mismatch) {
    return `The difference is small, so listen again for the exact rhythm and wording. ${support.listeningFocus}`;
  }

  const slot = describeHintSlot(targetWords, mismatch.index);

  if (mismatch.type === "extra") {
    return `There is an extra word near ${slot}. Replay the audio and keep only the words you hear.`;
  }

  const clueWord = mismatch.targetWord;
  const clueStarter = clueWord.charAt(0).toUpperCase();
  const clueLength = describeWordLength(clueWord);

  if (mismatch.type === "missing") {
    return `A ${clueLength} word is missing at ${slot}, and it starts with "${clueStarter}". ${support.listeningFocus}`;
  }

  return `The tricky part is ${slot}. The correct word there is a ${clueLength} word that starts with "${clueStarter}". ${support.listeningFocus}`;
}

function extractReferencedWord(prompt, question, support) {
  const normalizedPrompt = normalizeSentence(prompt);
  const vocabularyWords = Object.keys(support.vocabulary);
  const sentenceWords = getNormalizedWords(question.sentence).filter((word) => word.length > 3);
  const candidates = [...new Set([...vocabularyWords, ...sentenceWords])].sort((left, right) => right.length - left.length);

  return candidates.find((candidate) => normalizedPrompt.includes(candidate)) || "";
}

function buildLocalAiChatReply(question, prompt, answer) {
  const support = getQuestionSupport(question);
  const promptText = prompt.trim();
  const lowerPrompt = promptText.toLowerCase();
  const referencedWord = extractReferencedWord(promptText, question, support);

  if (!promptText) {
    return "Ask about the meaning, a vocabulary word, or what part of the sentence was difficult to hear.";
  }

  if (/(mistake|wrong|difference|missed|why|check my answer)/i.test(lowerPrompt)) {
    return buildDifferenceReply(question, answer, support);
  }

  if (/(mean|meaning|translate|what is this sentence about|什么意思)/i.test(lowerPrompt)) {
    return `${support.meaning} ${support.listeningFocus}`;
  }

  if (referencedWord && support.vocabulary[referencedWord]) {
    return `"${referencedWord}" means ${support.vocabulary[referencedWord]}. ${support.listeningFocus}`;
  }

  if (/(vocabulary|word|phrase|what does)/i.test(lowerPrompt)) {
    const firstEntry = Object.entries(support.vocabulary)[0];

    if (firstEntry) {
      return `A key word here is "${firstEntry[0]}". It means ${firstEntry[1]}.`;
    }
  }

  if (/(listen|hear|catch|sound|spell|hard|difficult|part)/i.test(lowerPrompt)) {
    return support.listeningFocus;
  }

  if (answer.trim()) {
    return `${support.meaning} If you want, you can also ask why your current answer is different from the target sentence.`;
  }

  return `${support.meaning} ${support.listeningFocus}`;
}

async function requestRemoteAiChat(question, prompt, answer) {
  if (!AI_CHAT_API_URL) {
    return null;
  }

  const response = await fetch(AI_CHAT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sentence: question.sentence,
      prompt,
      answer,
      questionIndex: qIndex,
      history: aiChatMessages.map((message) => ({
        role: message.role,
        text: message.text
      })),
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
    throw new Error(`AI chat request failed (${response.status}).`);
  }

  const payload = await response.json();
  if (payload && typeof payload.reply === "string") {
    return payload.reply.trim();
  }

  if (payload && typeof payload.message === "string") {
    return payload.message.trim();
  }

  return null;
}

async function sendAiChatMessage() {
  if (questionLocked) {
    return;
  }

  const question = getCurrentQuestion();
  if (!question) {
    return;
  }

  const prompt = aiChatInput.value.trim();
  const answer = wordInput.value.trim();

  if (!prompt) {
    aiChatInput.focus();
    return;
  }

  pushAiChatMessage("user", prompt, "Student");
  aiChatInput.value = "";

  aiChatRequestId += 1;
  const currentRequestId = aiChatRequestId;
  setAiChatLoading(true);
  aiCoachMetaEl.textContent = "Conversation";
  setFeedback("AI is preparing a sentence-specific response...");

  try {
    let reply = null;
    let meta = "Local support";

    if (AI_CHAT_API_URL) {
      try {
        reply = await requestRemoteAiChat(question, prompt, answer);
        if (reply) {
          meta = "AI coach";
        }
      } catch (error) {
        console.error(error);
      }
    }

    if (!reply) {
      reply = buildLocalAiChatReply(question, prompt, answer);
    }

    if (currentRequestId !== aiChatRequestId) {
      return;
    }

    pushAiChatMessage("assistant", reply, meta);
    setFeedback("You can keep asking follow-up questions about this sentence.");
  } finally {
    if (currentRequestId === aiChatRequestId) {
      setAiChatLoading(false);
      aiChatInput.focus();
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
  const selectedVoice = preferredSpeechVoice || refreshPreferredSpeechVoice();
  const currentRunId = speechRunId;

  function speakRemaining(remaining) {
    if (currentRunId !== speechRunId) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.rate = parseFloat(rateSlider.value);
    utterance.lang = selectedVoice ? selectedVoice.lang : "en-US";
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
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
  const availableTextbooks = getAvailableTextbooks();

  if (textbookCollections.length === 0) {
    textbookGrid.innerHTML = '<p class="practiceSub">No textbook collections are available yet.</p>';
    return;
  }

  if (!authenticatedStudent) {
    textbookGrid.innerHTML = '<p class="practiceSub">Sign in with a student account to view the textbook library.</p>';
    return;
  }

  if (availableTextbooks.length === 0) {
    textbookGrid.innerHTML = '<p class="practiceSub">No textbooks are assigned to this student yet. Ask your teacher to assign a collection.</p>';
    return;
  }

  availableTextbooks.forEach((textbook, index) => {
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
  if (!authenticatedStudent) {
    showLogin();
    return;
  }

  const isLoaded = await ensureTextbookContentLoaded();
  if (!isLoaded) {
    showScreen(home);
    return;
  }

  clearAutoNextTimer();
  cancelSpeech();
  hideAnswerReveal();
  resetAiChatState(null);
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
  resetWrongAnswerHistory();
  resetAiChatState(question);
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
  if (!authenticatedStudent) {
    showLogin();
    return;
  }

  const textbook = getAvailableTextbooks().find((item) => item.id === textbookId);
  if (!textbook) {
    setHomeStatus("This student does not have access to that textbook.", "bad");
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
  resetAiChatState(null);
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

  recordWrongAnswer(answer);

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
  resetAiChatState(null);
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
  if (!authenticatedStudent) {
    showLogin();
    return;
  }

  clearAutoNextTimer();
  cancelSpeech();
  hideAnswerReveal();
  resetAiChatState(null);
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
  resetAiChatState(null);
  updateSelectedTextbookCopy();
  updateTop();
  rateVal.textContent = parseFloat(rateSlider.value).toFixed(1);
  updateSessionBar();
  refreshPreferredSpeechVoice();

  if ("speechSynthesis" in window) {
    window.speechSynthesis.addEventListener("voiceschanged", refreshPreferredSpeechVoice);
  }

  await Promise.all([ensureTextbookContentLoaded(), ensureStudentDirectoryLoaded()]);

  if (restoreStudentSession()) {
    showHome();
    return;
  }

  showScreen(login);
}

loginBtn.addEventListener("click", loginStudent);
startBtn.addEventListener("click", showLibrary);
restartBtn.addEventListener("click", showLibrary);
libraryBackBtn.addEventListener("click", showHome);
logoutBtn.addEventListener("click", logoutStudent);

playBtn.addEventListener("click", playCurrentSentence);
repeatBtn.addEventListener("click", playCurrentSentence);

rateSlider.addEventListener("input", () => {
  rateVal.textContent = parseFloat(rateSlider.value).toFixed(1);
});

addBtn.addEventListener("click", checkAnswer);
studentIdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loginStudent();
  }
});
studentCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loginStudent();
  }
});
wordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    checkAnswer();
  }
});
aiChatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendAiChatMessage();
  }
});

clearBtn.addEventListener("click", clearInput);
aiChatSendBtn.addEventListener("click", sendAiChatMessage);
showBtn.addEventListener("click", showAnswer);
skipBtn.addEventListener("click", skipQuestion);
nextBtn.addEventListener("click", nextQuestion);

initializeApp();

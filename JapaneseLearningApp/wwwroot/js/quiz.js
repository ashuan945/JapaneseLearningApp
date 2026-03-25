
// Auth check from auth.js
requireAuth();

// =======
// State
// =======
let correctCount = 0;
let wrongCount = 0;
let quizQuestions = [];
let currentIndex = 0;
const maxQuestions = 10;
let currentLevel = "";
let userHasInteracted = false;

// ================
// Level pills
// ================
const pillData = [
    { label: "All", value: "" },
    { label: "N5", value: "N5" },
    { label: "N4", value: "N4" },
    { label: "N3", value: "N3" },
    { label: "N2", value: "N2" },
    { label: "N1", value: "N1" }
];

// Build and inject pill buttons
const pillsEl = document.getElementById("pills");
pillData.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "level-pill" + (p.value === currentLevel ? " active" : "");
    btn.textContent = p.label;
    btn.onclick = () => {
        userHasInteracted = true;
        currentLevel = p.value;
        document.querySelectorAll(".level-pill").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // Reset score when switching levels
        correctCount = 0;
        wrongCount = 0;
        updateScoreChips();
        startQuiz();
    };
    pillsEl.appendChild(btn);
});


// ==========================
// Score and progress UI
// ==========================

// Updates the correct/wrong chip counters in the header
function updateScoreChips() {
    document.getElementById("score-correct").textContent = "✓ " + correctCount + " correct";
    document.getElementById("score-wrong").textContent = "✗ " + wrongCount + " wrong";
}

// Updates the progress bar and label based on the current question index
function updateProgress() {
    const pct = Math.round((currentIndex / maxQuestions) * 100);
    document.getElementById("progress-fill").style.width = pct + "%";
    document.getElementById("progress-label").textContent = currentIndex + " / " + maxQuestions;
}

// ==========
// Quiz flow
// ==========

// Resets all state, fetches a fresh set of questions, and shows the first one.
// Called on initial load, level switch, and restart.
async function startQuiz() {
    userHasInteracted = true;

    // Hide end-of-quiz elements and reset UI
    document.getElementById("scoreCard").style.display = "none";
    document.getElementById("restartBtn").style.display = "none";
    document.getElementById("nextBtn").disabled = true;
    document.getElementById("scoreCard").style.visibility = "hidden";
    correctCount = 0;
    wrongCount = 0;
    currentIndex = 0;
    updateScoreChips();
    updateProgress();

    document.getElementById("result").textContent = "";
    document.getElementById("result").className = "result-row";

    // Append level filter if a specific level is selected
    let url = `${window.API_BASE}/api/quiz/${maxQuestions}`;
    if (currentLevel) url += `?level=${currentLevel}`;

    const res = await fetch(url);
    quizQuestions = await res.json();

    if (quizQuestions.length === 0) {
        document.getElementById("question").textContent = "No questions available for this level.";
        document.getElementById("options").innerHTML = "";
        return;
    }

    showQuestion();
}

// Renders the current question and its answer options, then auto-plays pronunciation
function showQuestion() {
    document.getElementById("nextBtn").disabled = true;
    document.getElementById("result").textContent = "";
    document.getElementById("result").className = "result-row";
    document.getElementById("audioBtn")?.classList.remove("playing");

    const q = quizQuestions[currentIndex];
    document.getElementById("question").textContent = q.japaneseWord;

    // Build answer option buttons dynamically
    const optionsDiv = document.getElementById("options");
    optionsDiv.innerHTML = "";
    q.options.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = "opt-btn";
        btn.textContent = opt;
        btn.onclick = () => submitAnswer(btn, opt);
        optionsDiv.appendChild(btn);
    });

    updateProgress();

    // Auto-play pronunciation
    if (userHasInteracted) {
        setTimeout(() => playAudio(), 300);
    }
}

// Submits the selected answer to the API, highlights correct/wrong options, updates the score, then either enables "Next" or shows the summary
async function submitAnswer(btnClicked, selected) {
    const q = quizQuestions[currentIndex];

    // Fall back to unauthenticated headers for guests
    const headers = authHeaders() || { "Content-Type": "application/json" };

    const res = await fetch(`${window.API_BASE}/api/quiz/submit`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            vocabularyId: q.vocabularyId,
            selectedAnswer: selected
        })
    });

    const result = await res.json();

    // Lock all options once an answer has been submitted
    document.querySelectorAll(".opt-btn").forEach(b => b.disabled = true);

    const resultEl = document.getElementById("result");

    if (result.isCorrect) {
        btnClicked.classList.add("correct");
        correctCount++;
        resultEl.textContent = "Correct!";
        resultEl.className = "result-row result-correct";
    } else {
        btnClicked.classList.add("wrong");
        // Highlight the correct answer
        document.querySelectorAll(".opt-btn").forEach(b => {
            if (b.textContent === result.correctAnswer) b.classList.add("correct");
        });
        wrongCount++;
        resultEl.textContent = "Wrong — the answer was: " + result.correctAnswer;
        resultEl.className = "result-row result-wrong";
    }

    updateScoreChips();

    // Show summary after the last question, otherwise enable the Next button
    if (currentIndex >= quizQuestions.length - 1) {
        showSummary();
    } else {
        document.getElementById("nextBtn").disabled = false;
    }
}


// Advances to the next question when the Next button is clicked
function nextQuestion() {
    userHasInteracted = true;
    if (currentIndex < quizQuestions.length - 1) {
        currentIndex++;
        showQuestion();
    }
}

// Displays the end-of-round score card with final correct/wrong counts and percentage
function showSummary() {
    const total = correctCount + wrongCount;
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    // Fill progress bar to 100% and show restart button
    document.getElementById("scoreCard").style.display = "flex";  /* was visibility: visible */
    document.getElementById("progress-fill").style.width = "100%";
    document.getElementById("progress-label").textContent = maxQuestions + " / " + maxQuestions;
    document.getElementById("nextBtn").disabled = true;
    document.getElementById("restartBtn").style.display = "inline-block";


    // Populate and reveal score card
    document.getElementById("sc-number").textContent = correctCount + " / " + total;
    document.getElementById("sc-pct").textContent = pct + "% correct";
    document.getElementById("sc-correct").textContent = "✓ " + correctCount + " correct";
    document.getElementById("sc-wrong").textContent = "✗ " + wrongCount + " wrong";
    document.getElementById("scoreCard").style.visibility = "visible";
}

// =========
// Audio
// =========
function playAudio(event) {
    if (event) event.stopPropagation();

    const text = document.getElementById('question').textContent;
    console.log('playAudio called, text:', text); // check browser console
    if (!text) return;

    const btn = document.getElementById('audioBtn');

    const trySpeak = () => {
        const voices = speechSynthesis.getVoices();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ja-JP';
        utterance.rate = 0.9;
        const jpVoice = voices.find(v => v.lang.includes('ja'));
        if (jpVoice) utterance.voice = jpVoice;

        if (btn) {
            btn.classList.add('playing');
            utterance.onend = () => btn.classList.remove('playing');
            utterance.onerror = () => btn.classList.remove('playing');
        }

        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
    };

    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
        trySpeak();
    } else {
        speechSynthesis.onvoiceschanged = () => trySpeak();
    }
}


// =====
// Init
// =====
startQuiz();
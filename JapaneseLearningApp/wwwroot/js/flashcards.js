
// =========
// State
// =========
const levels = ['ALL', 'N5', 'N4', 'N3', 'N2', 'N1'];
let currentLevel = 'ALL';
let vocabCache = [];
let totalInLevel = 0;
let seenCount = 0;
let isFlipped = false;
let currentWordId = null;
let isFlagged = false;
let isGuest = false;


// ===============
// Level pills
// ===============
// Build level pill buttons
const pillsEl = document.getElementById('pills');
levels.forEach(l => {
    const btn = document.createElement('button');
    btn.className = 'level-pill' + (l === currentLevel ? ' active' : '');
    btn.textContent = l;
    btn.onclick = () => selectLevel(l);
    pillsEl.appendChild(btn);
});


// =================
// Level selection
// =================

async function selectLevel(level) {
    currentLevel = level;

    // Update active pill UI
    document.querySelectorAll('.level-pill').forEach(p => {
        p.classList.toggle('active', p.textContent === level);
    });

    // Reset UI back to card view (in case completion screen was showing)
    hideCompletion();
    document.getElementById('scene').style.display = '';
    document.getElementById('fcControls').style.display = '';

    seenCount = 0;
    isFlipped = false;

    // Reset card rotation
    document.getElementById('card3d').classList.remove('flipped');

    // Load new level data
    await loadVocabulary(level);

    // Load first card
    loadCard();
}


// =====================
// Vocabulary fetching
// =====================

// Fetches the word list for the given level and stores it in vocabCache.
// Guests fall back to unauthenticated headers.
async function loadVocabulary(level) {
    const url = level === 'ALL'
        ? `${window.API_BASE}/api/flashcards/all`
        : `${window.API_BASE}/api/flashcards/by-level?level=${level}`;

    const headers = authHeaders() || { "Content-Type": "application/json" };
    const res = await fetch(url, { headers });
    vocabCache = await res.json();
    totalInLevel = vocabCache.length;
}

// Returns a random word from the current vocabCache
function getRandomCard() {
    return vocabCache[Math.floor(Math.random() * vocabCache.length)];
}

// =======================
// Completion screen
// =======================

// Shows the completion screen once all cards in the level have been seen
function showCompletion() {
    document.getElementById('scene').style.display = 'none';
    document.getElementById('fcControls').style.display = 'none';
    document.getElementById('progressRow').style.display = 'none';
    document.getElementById('completeScreen').classList.add('visible');
    document.getElementById('statSeen').textContent = seenCount;
    document.getElementById('statLevel').textContent = currentLevel;
    document.getElementById('completeTitle').textContent = currentLevel + ' Complete!';
    document.getElementById('completeSub').textContent = isGuest
        ? "Sign in to track your progress and skip cards you've already learned!"
        : "You've reviewed all remaining " + currentLevel + " cards. Great work!";

}

// Hides the completion screen and restores the card + controls
function hideCompletion() {
    document.getElementById('scene').style.display = '';
    document.getElementById('fcControls').style.display = '';
    document.getElementById('progressRow').style.display = 'flex';
    document.getElementById('completeScreen').classList.remove('visible');
}



// ==============
// Card loading
// ==============

// Picks a random card from the cache, updates the UI, and auto-plays pronunciation.
// Shows the completion screen if the cache is empty or all cards have been seen.
async function loadCard() {
    if (!vocabCache.length) {
        showCompletion();
        return;
    }

    // If all cards already reviewed in this level
    if (seenCount >= totalInLevel) {
        showCompletion();
        return;
    }

    // If card is flipped, unflip it first and wait for the CSS transition to finish
    const card = document.getElementById('card3d');
    if (isFlipped) {
        card.classList.remove('flipped');
        isFlipped = false;
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    const word = getRandomCard();
    currentWordId = word.id;

    // Normalise status field (API returns either casing)
    isFlagged = (word.status || word.Status) === 'flagged';
    updateFlagButton();

    // Increment seen count, capping at total so it never exceeds 100%
    seenCount = Math.min(seenCount + 1, totalInLevel);

    // Populate card content
    document.getElementById('japanese').textContent = word.japaneseWord;
    document.getElementById('hiragana').textContent = word.hiragana;
    document.getElementById('meaning').textContent = word.meaning;
    document.getElementById('level-badge').textContent = word.level || word.Level || currentLevel;

    // Update progress bar and label
    const pct = Math.round((seenCount / totalInLevel) * 100);
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-count').textContent = seenCount + ' seen';

    // Re-trigger fade-in animation on text elements
    ['japanese', 'hiragana', 'meaning'].forEach(id => {
        const el = document.getElementById(id);
        el.classList.remove('fade-in');
        void el.offsetWidth;
        el.classList.add('fade-in');
    });

    // Short delay before auto-playing
    setTimeout(() => {
        playAudio();
    }, 200);
}

// Toggles the 3D flip state of the card
function flipCard() {
    const card = document.getElementById('card3d');
    isFlipped = !isFlipped;
    card.classList.toggle('flipped', isFlipped);
}


// ======
// Flag
// ======

// Toggles the flagged status of the current word and updates the button + local cache
async function toggleFlag() {
    if (!currentWordId || !isLoggedIn()) return;

    const res = await fetch(`${window.API_BASE}/api/flashcards/toggle-flag`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ vocabularyId: currentWordId })
    });

    const data = await res.json();
    isFlagged = data.status === 'flagged';
    updateFlagButton();

    // Keep vocabCache in sync so the flag state persists within the session
    const word = vocabCache.find(v => v.id === currentWordId);
    if (word) word.status = data.status;
}

// Reflects the current flag state in the button's appearance and label
function updateFlagButton() {
    const btn = document.getElementById('flagBtn');
    const lbl = document.getElementById('flagLabel');
    btn.classList.toggle('flagged', isFlagged);
    lbl.textContent = isFlagged ? 'Flagged' : 'Flag';
}


// ===========
// Next card
// ===========

// Marks current word as learned (logged-in users only), refreshes the cache, then loads the next card
async function nextCard() {
    if (!currentWordId) { loadCard(); return; }

    if (isLoggedIn()) {
        await fetch(`${window.API_BASE}/api/flashcards/mark-learned`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ vocabularyId: currentWordId })
        });
        // Reload so learned words are excluded from the remaining pool
        await loadVocabulary(currentLevel);
    }
    loadCard();
}

// ============
// Reset level
// ============

// Opens the reset confirmation modal with appropriate warning text for the current level
function openResetModal() {
    const body = document.getElementById('resetModalBody');

    if (currentLevel === 'ALL') {
        body.innerHTML = 'This will reset <strong>all flashcards</strong>. This cannot be undone.';
    } else {
        body.innerHTML = `This will reset all
                <span style="background:#1a1a2e;color:#faf9f6;font-size:0.72rem;font-weight:700;padding:0.15rem 0.55rem;border-radius:4px;letter-spacing:0.05em;">
                ${currentLevel}</span> flashcards. This cannot be undone.`;
    }

    document.getElementById('resetModalBackdrop').classList.add('open');
}

// Close modal
function closeResetModal() {
    document.getElementById('resetModalBackdrop').classList.remove('open');
}

// Close modal when clicking the backdrop (outside the modal panel)
function handleBackdropClick(e) {
    if (e.target.id === 'resetModalBackdrop') closeResetModal();
}

// Sends the reset request, then reloads the level from scratch
async function confirmReset() {
    if (!isLoggedIn()) { alert("Please log in."); return; }

    const res = await fetch(
        `${window.API_BASE}/api/vocabulary/reset?level=${currentLevel}`, {
        method: "PUT",
        headers: authHeaders()
    });

    if (!res.ok) { alert("Failed to reset."); closeResetModal(); return; }

    closeResetModal();
    seenCount = 0;
    hideCompletion();
    await loadVocabulary(currentLevel);
    loadCard();
}


// ===========
// Play audio
// ===========

// Plays the Japanese pronunciation of the current card using the Web Speech API.
// If voices haven't loaded yet, waits for the voiceschanged event before speaking.
function playAudio(event) {
    if (event) event.stopPropagation();

    const text = document.getElementById('japanese').textContent;
    if (!text) return;

    const btn = document.querySelector('.btn-audio');

    const trySpeak = () => {
        const voices = speechSynthesis.getVoices();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ja-JP';
        utterance.rate = 0.9;

        // Prefer a Japanese voice if one is available
        const jpVoice = voices.find(v => v.lang.includes('ja'));
        if (jpVoice) utterance.voice = jpVoice;

        if (btn) {
            btn.classList.add('playing');
            utterance.onend = () => btn.classList.remove('playing');
            utterance.onerror = () => btn.classList.remove('playing');
        }

        speechSynthesis.cancel();  // stop any currently playing speech
        speechSynthesis.speak(utterance);
    };

    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
        trySpeak();
    } else {
        // Voices load asynchronously on some browsers — wait for the event
        speechSynthesis.onvoiceschanged = () => trySpeak();
    }
}

// Returns a promise that resolves once the browser's voice list is available
function ensureVoicesLoaded() {
    return new Promise(resolve => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            voicesLoaded = true;
            resolve();
        } else {
            speechSynthesis.onvoiceschanged = () => {
                voicesLoaded = true;
                resolve();
            };
        }
    });
}




// ======
// Init
// ======
window.onload = async function () {
    isGuest = !isLoggedIn();

    // Disable interactive features that require an account
    if (isGuest) {
        const flagBtn = document.getElementById('flagBtn');
        flagBtn.classList.add('guest-disabled');
        flagBtn.title = 'Sign in to flag words';

        const regenBtn = document.getElementById('btnRegenerate');
        if (regenBtn) regenBtn.disabled = true;
    }

    await loadVocabulary(currentLevel);
    await ensureVoicesLoaded(); // wait for voices before first auto-play
    loadCard();
};
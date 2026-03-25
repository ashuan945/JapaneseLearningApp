
//====================================
// AI Modal — open / close / backdrop
// ===================================
function openAIModal() {
    document.getElementById('aiModalBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeAIModal() {
    document.getElementById('aiModalBackdrop').classList.remove('open');
    document.body.style.overflow = '';
}
// Close modal when clicking outside the modal panel
function handleAIBackdropClick(e) {
    if (e.target.id === 'aiModalBackdrop') closeAIModal();
}
// Close modal on escape key
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAIModal();
});


// ===============
// Loading state
// ===============

// Replace modal content with animated skeleton lines while the API call is in flight
function setAILoading() {
    document.getElementById('aiExplanation').innerHTML = `
        <div class="ai-skeleton">
            <div class="ai-skeleton-line"></div>
            <div class="ai-skeleton-line"></div>
            <div class="ai-skeleton-line"></div>
        </div>`;
    document.getElementById('aiExamples').innerHTML = '';
}


// ====================
// Render AI response
// ====================

// Populate modal with response data
// Expected shape: { explanation: string, examples: [{ jp: string, en: string }] }
function renderAIResponse(data) {
    const expEl = document.getElementById('aiExplanation');

    if (!data || !data.explanation) {
        expEl.innerHTML = `<div class="ai-error">⚠ No explanation available right now.</div>`;
        return;
    }

    expEl.textContent = data.explanation;

    // Build example sentence list
    const list = document.getElementById('aiExamples');
    list.innerHTML = '';
    if (data.examples && data.examples.length) {
        data.examples.forEach(e => {
            const li = document.createElement('li');
            li.className = 'ai-example-item';
            li.innerHTML = `
                <div class="ai-example-jp">${e.jp}</div>
                <div class="ai-example-en">${e.en}</div>`;
            list.appendChild(li);
        });
    }
}


// ====================================
// Flashcard — Explain button handler
// ====================================

// Triggered by the "Explain" button on the flashcard.
// Reads the current card's data, opens the modal with a skeleton, then fetches the AI explanation for the current word.
async function showAI(event) {
    if (event) event.stopPropagation();

    const word = document.getElementById('japanese').textContent;
    const hira = document.getElementById('hiragana').textContent;
    const meaning = document.getElementById('meaning').textContent;
    const level = document.getElementById('level-badge').textContent;

    if (!word) return;

    // Show login gate for guests
    if (!isLoggedIn()) {
        showAILoginGate(word, hira, meaning);
        return;
    }

    // Populate modal header with current card data
    document.getElementById('aiModalKanji').textContent = word;
    document.getElementById('aiModalHira').textContent = hira;
    document.getElementById('aiModalMeaning').textContent = meaning;

    // Disable the button while loading to prevent duplicate requests
    const btn = document.getElementById('btnAI');
    btn.classList.add('loading');
    btn.disabled = true;

    // Open modal immediately with skeleton
    setAILoading();
    openAIModal();

    try {
        const res = await fetch(`${window.API_BASE}/api/ai/explain/${currentWordId}`);
        const data = await res.json();
        renderAIResponse(data);
    } catch (err) {
        document.getElementById('aiExplanation').innerHTML =
            `<div class="ai-error">⚠ Failed to load explanation. Please try again.</div>`;
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// ============================
// Regenerate AI explanation
// ============================

// Called by the regenerate button inside the modal
async function regenerateAI() {
    if (!currentWordId) return;

    setAILoading();

    try {
        const res = await fetch(`${window.API_BASE}/api/ai/regenerate/${currentWordId}`, {
            method: 'POST'
        });

        const data = await res.json();
        renderAIResponse(data);
    } catch (err) {
        document.getElementById('aiExplanation').innerHTML =
            `<div class="ai-error">⚠ Failed to regenerate. Please try again.</div>`;
    }
}




// ==============
// Login gate
// ==============

// Shown when the user is not logged in.
// Displays a prompt to sign in, with the word header still populated for context.
function showAILoginGate(word = '', hira = '', meaning = '') {
    document.getElementById('aiModalKanji').textContent = word;
    document.getElementById('aiModalHira').textContent = hira;
    document.getElementById('aiModalMeaning').textContent = meaning;

    document.getElementById('aiExplanation').innerHTML = `
        <div class="ai-login-gate">
            <div class="ai-gate-top">
                <div class="ai-gate-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#4f5fc4" stroke-width="1.5" width="16" height="16">
                        <path stroke-linecap="round" stroke-linejoin="round"
                            d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z"/>
                    </svg>
                </div>
                <div class="ai-gate-text">
                    <span class="ai-gate-title">Sign in to unlock AI explanations</span>
                    <span class="ai-gate-sub">Get detailed breakdowns and example sentences for every word.</span>
                </div>
            </div>
            <div class="ai-gate-actions">
                <button class="ai-gate-btn-login" onclick="window.location.href='/Auth/Login'">Sign in</button>
                <button class="ai-gate-btn-dismiss" onclick="closeAIModal()">Maybe later</button>
            </div>
        </div>`;

    document.getElementById('aiExamples').innerHTML = '';
    openAIModal();
}


// ====================================
// Vocabulary list — row click handler
// ====================================

// Opens the AI modal when a row in the vocabulary list table is clicked.
// Highlights the selected row and fetches the explanation for that word.
async function openAIModalFromRow(vocabId, rowEl) {
    // show login gate for guest
    if (!isLoggedIn()) {
        const cells = rowEl.children;
        showAILoginGate(
            cells[0].textContent,
            cells[1].textContent,
            cells[2].textContent
        );
        return;
    }

    currentWordId = vocabId;

    // highlight selected row
    document.querySelectorAll('.vocab-row').forEach(r => r.classList.remove('active'));
    rowEl.classList.add('active');

    // show modal + skeleton
    setAILoading();
    openAIModal();

    try {
        const res = await fetch(`${window.API_BASE}/api/ai/explain/${vocabId}`);
        const data = await res.json();

        // Populate modal header from table row cells (index: 0=kanji, 1=hiragana, 2=meaning)
        const cells = rowEl.children;

        document.getElementById('aiModalKanji').textContent = cells[0].textContent;
        document.getElementById('aiModalHira').textContent = cells[1].textContent;
        document.getElementById('aiModalMeaning').textContent = cells[2].textContent;

        renderAIResponse(data);

    } catch (err) {
        document.getElementById('aiExplanation').innerHTML =
            `<div class="ai-error">⚠ Failed to load explanation.</div>`;
    }
}
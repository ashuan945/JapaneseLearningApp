
// Check user login state (runs immediately)
(function () {
    const token = localStorage.getItem("token");
    // mark user state
    if (token) {
        console.log("User is logged in");
    } else {
        console.log("Guest mode");
    }
})();


// Toggle vocabulary status (new → flagged → learned → new)
async function toggleStatus(vocabId, currentStatus) {
    const headers = authHeaders();
    if (!headers) return;  // If guest, do nothing

    // Determine next status
    let newStatus =
        currentStatus === "new" ? "flagged" :
            currentStatus === "flagged" ? "learned" : "new";

    // Send update request
    const res = await fetch(`${window.API_BASE}/api/userprogress/status`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ vocabularyId: vocabId, status: newStatus })
    });

    // Handle error
    if (!res.ok) {
        alert("Failed to update status");
        return;
    }

    // Update UI badge
    const el = document.getElementById("status-" + vocabId);
    if (!el) return;

    const badges = {
        learned: `<span style="background:#e8f5e9;color:#2e7d32;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;">Learned</span>`,
        flagged: `<span style="background:#fff8e0;color:#b87800;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;">Flagged</span>`,
        new: `<span style="background:#f0f0f0;color:#888;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;">New</span>`
    };

    // Update click handler with new status
    el.innerHTML = badges[newStatus];
    el.parentElement.setAttribute("onclick", `event.stopPropagation(); toggleStatus(${vocabId}, '${newStatus}')`);
}


// Open reset confirmation modal
function openResetModal() {
    const level = window.SelectedLevel;
    const body = document.getElementById('resetModalBody');

    // Customize message based on level
    if (level === 'ALL') {
        body.innerHTML = 'This will mark <strong style="color:#1a1a2e;font-weight:500;">all vocabulary</strong> as '
            + '<span style="background:#f0f0f0;color:#888;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;">New</span>. '
            + 'This cannot be undone.';
    } else {
        body.innerHTML = 'This will mark all '
            + `<span style="background:#1a1a2e;color:#faf9f6;font-size:0.72rem;font-weight:700;padding:0.15rem 0.55rem;border-radius:4px;letter-spacing:0.05em;">${level}</span> words as `
            + '<span style="background:#f0f0f0;color:#888;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;">New</span>. '
            + 'This cannot be undone.';
    }

    // Show reset modal
    document.getElementById('resetModalBackdrop').classList.add('open');
}

// Close reset modal
function closeResetModal() {
    document.getElementById('resetModalBackdrop').classList.remove('open');
}

// Close modal when clicking outside
function handleBackdropClick(e) {
    if (e.target === document.getElementById('resetModalBackdrop')) closeResetModal();
}

// Confirm reset action
async function confirmReset() {
    const level = window.SelectedLevel;
    const url = `${window.API_BASE}/api/vocabulary/reset?level=${level}`;

    // Send reset request
    const res = await fetch(url, {
        method: "PUT",
        headers: authHeaders()
    });

    // Handle error
    if (!res.ok) {
        closeResetModal();
        alert("Failed to reset status.");
        return;
    }

    // Close modal and reload page
    closeResetModal();
    window.location.reload();
}

// Load vocabulary list (user vs guest)
async function loadVocabulary() {
    const token = localStorage.getItem("token");

    // Choose API based on login state
    let url = "";
    if (token) {
        url = `${window.API_BASE}/api/vocabulary`;
    } else {
        url = `${window.API_BASE}/api/vocabulary/guest`;
    }

    // Set headers (include token if logged in)
    const headers = token
        ? {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
        : {
            "Content-Type": "application/json"
        };

    // Fetch data
    const res = await fetch(url, { headers });
    const result = await res.json();

    console.log(result);

    // Render vocabulary dynamically here
}


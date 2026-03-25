
// ==========================
// Highlight active nav link
// ==========================
(function () {
    const links = document.querySelectorAll('.nav-link');
    const path = window.location.pathname.toLowerCase();
    links.forEach(function (link) {
        // Use startsWith to handle nested routes (e.g. /flashcards/review still highlights /flashcards)
        if (link.getAttribute('href') && path.startsWith(link.getAttribute('href').toLowerCase())) {
            link.classList.add('active');
        }
    });
})();


// =============
// Menu toggles
// =============

// Toggles the desktop profile dropdown menu open/closed
function toggleMenu() {
    const menu = document.getElementById("profileMenu");
    menu.style.display = menu.style.display === "block" ? "none" : "block";
}

// Toggles the mobile nav drawer open/closed
function toggleMobileMenu() {
    const menu = document.getElementById("mobileMenu");
    menu.classList.toggle("open");
}


// ==============
// Auth actions
// ==============

// Logs the user out: invalidates the session cookie server-side, clears local storage, then redirects to the login page
async function logout() {
    await fetch(`${window.API_BASE}/api/users/logout`, {
        method: "POST",
        credentials: "include"
    });
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.href = "/Auth/Login";
}

// Fetches the logged-in user's profile and updates the avatar image.
// Silently exits if the user is not authenticated or the request fails.
async function loadProfileIcon() {
    const headers = authHeaders();
    if (!headers) return;
    const res = await fetch(`${window.API_BASE}/api/users/me`, { headers });
    if (!res.ok) return;
    const data = await res.json();
    const icon = document.getElementById("profileIcon");
    icon.src = data.profileImage || "/images/default-avatar.png";
}


// =======================================
// Auth state — show/hide nav elements
// =======================================

// Read auth state from local storage
const token = localStorage.getItem("token");
const username = localStorage.getItem("username");
// Grab all nav elements that change based on login state
const welcomeUser = document.getElementById("welcomeUser");
const loginLink = document.getElementById("loginLink");
const mobileWelcome = document.getElementById("mobileWelcome");
const mobileLoginLink = document.getElementById("mobileLoginLink");
const mobileLogoutLink = document.getElementById("mobileLogoutLink");

if (token && username) {
    // Logged in — show welcome text, avatar, and logout link
    welcomeUser.innerText = "Welcome, " + username;
    loginLink.style.display = "none";
    document.getElementById("profileIcon").style.display = "block";

    mobileWelcome.innerText = "Welcome, " + username;
    mobileLoginLink.style.display = "none";
    mobileLogoutLink.style.display = "inline";

    loadProfileIcon();
} else {
    // Guest — show login link and hide user-specific elements
    welcomeUser.innerText = "";
    loginLink.style.display = "inline-flex";
    document.getElementById("profileIcon").style.display = "none";
    mobileWelcome.innerText = "";
    mobileLoginLink.style.display = "inline";
    mobileLogoutLink.style.display = "none";
}

// ================
// Event listeners
// ================

// Open/close the profile dropdown when the avatar is clicked
document.getElementById("profileIcon")?.addEventListener("click", toggleMenu);

// Close the profile dropdown when clicking anywhere outside of it
document.addEventListener("click", function (e) {
    const container = document.getElementById("profileContainer");
    if (container && !container.contains(e.target)) {
        document.getElementById("profileMenu").style.display = "none";
    }
});
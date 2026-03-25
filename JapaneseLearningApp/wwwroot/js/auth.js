
// ==============
// Auth helpers
// ==============

// Retrieves the JWT from storage and validates it.
// Returns the token string if valid, or null if missing, expired, or malformed.
function getToken() {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // If token has an expiry and it has passed, treat as logged out
        if (payload.exp && Date.now() / 1000 > payload.exp) {
            localStorage.removeItem("token");
            localStorage.removeItem("username");
            return null;
        }
    } catch (e) {
        // Malformed token, clear storage to avoid stale state
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        return null;
    }
    return token;
}

// Returns true if a valid, non-expired token exists
function isLoggedIn() {
    return !!getToken();
}

// Returns headers with Bearer token for authenticated API calls.
// Returns null if the user is not logged in.
function authHeaders() {
    const token = getToken();
    if (!token) return null;
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

// Redirects to the login page if the user is not authenticated.
// Call this at the top of any page that requires a login.
function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = "/Auth/Login";
    }
}

// ==============
// Token refresh
// ==============

// Refreshes the JWT if it is close to expiring
// On failure, clears storage and redirects to login.
async function refreshTokenIfNeeded() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiresIn = payload.exp - Date.now() / 1000;

        // If less than 10 minutes left, refresh
        if (expiresIn < 600) {
            const res = await fetch(`${window.API_BASE}/api/users/refresh`, {
                method: "POST",
                credentials: "include"   // sends the HttpOnly cookie
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem("token", data.token);
            } else {
                // Refresh failed, token is dead
                localStorage.clear();
                window.location.href = "/Auth/Login";
            }
        }
    } catch {
        // malformed token, force re-login
        localStorage.clear();
        window.location.href = "/Auth/Login";
    }
}

// Check on page load and every 5 minutes
refreshTokenIfNeeded();
setInterval(refreshTokenIfNeeded, 5 * 60 * 1000);
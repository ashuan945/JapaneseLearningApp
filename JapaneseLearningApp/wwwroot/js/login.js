

// Handles login form submission — validates credentials, stores the JWT, redirects to the vocabulary page on success
async function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const msgEl = document.getElementById("message");
    msgEl.innerText = "";

    const res = await fetch(`${window.API_BASE}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include"
    });

    if (res.ok) {
        const data = await res.json();
        // Store JWT and username for use across pages
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.username);

        // Show success feedback, then redirect after a short delay
        msgEl.style.color = "#2e7d32";
        msgEl.innerText = "Login successful! Redirecting...";
        await new Promise(resolve => setTimeout(resolve, 1500));
        window.location.href = `/Vocabulary`;
    } else {
        msgEl.style.color = "#c0392b";
        msgEl.innerText = "Incorrect username or password.";
    }
}

// Allow Enter key to submit
document.addEventListener("keydown", function (e) {
    if (e.key === "Enter") login();
});
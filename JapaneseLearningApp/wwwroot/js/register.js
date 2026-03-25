
async function register() {
    const username = document.getElementById("username").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const msgEl = document.getElementById("message");
    msgEl.innerText = "";

    // Check empty fields
    if (!username || !email || !password) {
        msgEl.style.color = "#c0392b";
        msgEl.innerText = "Please fill in all fields.";
        return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        msgEl.style.color = "#c0392b";
        msgEl.innerText = "Invalid email format.";
        return;
    }

    // Password length validation
    if (password.length < 6) {
        msgEl.style.color = "#c0392b";
        msgEl.innerText = "Password must be at least 6 characters.";
        return;
    }

    // send to API
    const res = await fetch(`${window.API_BASE}/api/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password })
    });


    if (res.ok) {
        msgEl.style.color = "#2e7d32";
        // Auto Login
        const loginRes = await fetch(`${window.API_BASE}/api/users/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: username,
                password: password
            }),
            credentials: "include"
        });
        

        // Redirect to login
        if (loginRes.ok) {
            const data = await loginRes.json();

            // Store user
            localStorage.setItem("token", data.token);
            localStorage.setItem("username", data.username);

            message.innerText = "Registered successfully! Redirecting...";

            // Redirect
            setTimeout(() => {
                window.location.href = "/Vocabulary";
            }, 1000);
        } else {
            message.innerText = "Registered successfully but login failed";
        }

    } else {
        const error = await res.text();
        msgEl.style.color = "#c0392b";
        msgEl.innerText = error || "Registration failed! Please try again.";
    }
}

document.addEventListener("keydown", function (e) {
    if (e.key === "Enter") register();
});
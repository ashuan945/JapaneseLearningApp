
// Auth check from auth.js
requireAuth();

let cropper = null;
let croppedBlob = null;

// ==========================
// Load profile
// ==========================

// Fetches the current user's profile and populates the form fields and hero section.
// Redirects to login if unauthenticated or token is invalid.
loadProfile();

async function loadProfile() {
    const headers = authHeaders();
    if (!headers) { window.location.href = "/Auth/Login"; return; }

    const res = await fetch(`${window.API_BASE}/api/users/me`, { headers });

    if (!res.ok) {
        if (res.status === 401) {
            localStorage.clear();
            window.location.href = "/Auth/Login";
        }
        return;
    }

    const data = await res.json();

    // Populate form inputs
    document.getElementById("username").value = data.username;
    document.getElementById("email").value = data.email;
    // Populate hero / display section
    document.getElementById("heroName").textContent = data.username;
    document.getElementById("heroEmail").textContent = data.email;

    if (data.profileImage) {
        document.getElementById("profilePreview").src = data.profileImage;
    }
}

// ==========================
// Update profile
// ==========================

// Validates inputs, then sends a PUT request to update username, email and optionally password. 
// Updates local storage and the hero section on success.
async function updateProfile() {
    const username = document.getElementById("username").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const msgEl = document.getElementById("profileMessage");
    msgEl.innerText = "";

    // Client-side validation
    if (!username || !email) {
        msgEl.style.color = "#c0392b";
        msgEl.innerText = "Please fill in username & email.";
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        msgEl.style.color = "#c0392b";
        msgEl.innerText = "Invalid email format.";
        return;
    }

    // Only validate password length if the user is changing it
    if (password && password.length < 6) {
        msgEl.style.color = "#c0392b";
        msgEl.innerText = "Password must be at least 6 characters.";
        return;
    }

    const headers = authHeaders();
    if (!headers) { window.location.href = "/Auth/Login"; return; }

    const res = await fetch(`${window.API_BASE}/api/users/me`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ username, email, password })
    });

    if (res.ok) {
        showMessage(msgEl, "Profile updated successfully.", "#2e7d32");

        // Keep local storage and hero section in sync with the new values
        localStorage.setItem("username", username);
        document.getElementById("heroName").textContent = username;
        document.getElementById("heroEmail").textContent = email;
    } else {
        const errorText = await res.text();
        showMessage(msgEl, errorText || "Update failed. Please try again.", "#c0392b");
    }
}

// ==========================
// Upload image
// ==========================

// Uploads the cropped image blob to the server and updates the avatar everywhere it appears (profile preview and nav icon).
async function uploadImage() {
    const msgEl = document.getElementById("uploadMessage");
    msgEl.innerText = "";

    // Require a crop to have been confirmed before uploading
    if (!croppedBlob) {
        showMessage(msgEl, "Please select an image first.", "#e8a020");
        return;
    }

    const token = getToken();
    if (!token) { window.location.href = "/Auth/Login"; return; }

    // Send as multipart/form-data
    const formData = new FormData();
    formData.append("file", croppedBlob, "avatar.jpg");

    const res = await fetch(`${window.API_BASE}/api/users/me/upload-image`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`
        },
        body: formData
    });

    if (res.ok) {
        const data = await res.json();
        showMessage(msgEl, "Image uploaded successfully.", "#2e7d32");
        // Update storage, reset crop state, and refresh all avatar instances
        localStorage.setItem("profileImage", data.imageUrl);
        croppedBlob = null;
        document.getElementById("fileLabel").textContent = "Choose image";
        document.getElementById("fileInput").value = "";
        document.getElementById("profilePreview").style.border = "3px solid #4f5fc4";

        const navIcon = document.getElementById("profileIcon");
        if (navIcon) navIcon.src = data.imageUrl;
    } else {
        showMessage(msgEl, "Upload failed. Please try again.", "#c0392b");
    }
}

// ==========================
// Crop logic
// ==========================

// When a file is selected, load it into the crop modal and initialise Cropper.js
document.getElementById("fileInput").addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        const cropImage = document.getElementById("cropImage");
        cropImage.src = e.target.result;
        document.getElementById("cropModal").style.display = "flex";

        // Destroy any previous instance before creating a new one
        if (cropper) cropper.destroy();
        cropper = new Cropper(cropImage, {
            aspectRatio: 1,     // enforce square crop for avatars
            viewMode: 1,
            autoCropArea: 0.8
        });
    };
    reader.readAsDataURL(file);
});

// Exports the cropped area as a JPEG blob, updates the preview with an orange border to indicate an unsaved change, then closes the modal
function confirmCrop() {
    cropper.getCroppedCanvas({ width: 300, height: 300 }).toBlob(blob => {
        croppedBlob = blob;
        document.getElementById("profilePreview").src = URL.createObjectURL(blob);
        document.getElementById("profilePreview").style.border = "3px solid #f0a500";
        // Truncate long filenames so they fit the label
        const name = document.getElementById("fileInput").files[0]?.name || "image";
        document.getElementById("fileLabel").textContent = name.length > 20 ? name.substring(0, 18) + "…" : name;
        closeCropModal();
    }, "image/jpeg", 0.9);
}

// Cancels cropping — clears the file input and closes the modal without saving
function cancelCrop() {
    document.getElementById("fileInput").value = "";
    closeCropModal();
}

function closeCropModal() {
    document.getElementById("cropModal").style.display = "none";
    if (cropper) { cropper.destroy(); cropper = null; }
}

// ==========================
// Utility
// ==========================

// Displays a temporary status message inside the given element.
// Auto-clears after `duration` ms. Cancels any existing timeout to avoid flicker.
function showMessage(el, message, color = "#000", duration = 3000) {
    el.style.color = color;
    el.innerText = message;

    if (el._timeoutId) clearTimeout(el._timeoutId);
    el._timeoutId = setTimeout(() => {
        el.innerText = "";
    }, duration);
}

// ==========================
// Delete account
// ==========================
function openDeleteModal() {
    document.getElementById("deleteModal").style.display = "flex";
}

function closeDeleteModal() {
    document.getElementById("deleteModal").style.display = "none";
}

// Permanently deletes the account after confirmation.
// Disables the button during the request to prevent double-submission.
// Clears local storage and redirects to login on success.
async function deleteAccount() {
    const confirmBtn = document.getElementById("deleteConfirmBtn");
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Deleting...";

    const headers = authHeaders();
    if (!headers) { window.location.href = "/Auth/Login"; return; }

    try {
        const res = await fetch(`${window.API_BASE}/api/users/me`, {
            method: "DELETE",
            headers
        });

        if (res.ok) {
            localStorage.clear();
            window.location.href = "/Auth/Login";
        } else {
            const err = await res.text();
            closeDeleteModal();
            const msgEl = document.getElementById("profileMessage");
            showMessage(msgEl, err || "Failed to delete account. Please try again.", "#c0392b", 5000);
        }
    } catch (e) {
        // Handle network-level failures (e.g. no connection)
        closeDeleteModal();
        const msgEl = document.getElementById("profileMessage");
        showMessage(msgEl, "Network error. Please check your connection.", "#c0392b", 5000);
    } finally {
        // Always re-enable the button in case the user wants to retry
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Delete account";
    }
}
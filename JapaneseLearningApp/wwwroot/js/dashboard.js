
// Redirect guests to login since dashboard requires auth
requireAuth();

// ========
// State
// ========
let currentLevel = "";
let donutChart = null;
let barChart = null;

// ============
// Level pills
// ============
const pillData = [
    { label: "All", value: "" },
    { label: "N5", value: "N5" },
    { label: "N4", value: "N4" },
    { label: "N3", value: "N3" },
    { label: "N2", value: "N2" },
    { label: "N1", value: "N1" }
];

// Build and inject pill buttons dynamically
const pillsEl = document.getElementById("pills");
pillData.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "level-pill" + (p.value === currentLevel ? " active" : "");
    btn.textContent = p.label;
    btn.onclick = () => {
        currentLevel = p.value;
        document.querySelectorAll(".level-pill").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        loadDashboard();
    };
    pillsEl.appendChild(btn);
});

// ===================
// Dashboard loader
// ===================

async function loadDashboard() {

    requireAuth();
    const headers = authHeaders();

    // Append level filter if a specific level is selected
    let url = `${window.API_BASE}/api/dashboard`;
    if (currentLevel) url += `?level=${currentLevel}`;

    const res = await fetch(url, { headers });
    if (res.status === 401) { window.location.href = "/Auth/Login"; return; }

    const data = await res.json();

    // Populate stat cards
    document.getElementById("total").innerText = data.total;
    document.getElementById("correct").innerText = data.correct;
    document.getElementById("wrong").innerText = data.wrong;
    document.getElementById("accuracy").innerText = data.accuracy + "%";

    // ── Donut chart (correct vs wrong) ──
    // Destroy the previous instance first to avoid canvas reuse errors
    if (donutChart) donutChart.destroy();
    donutChart = new Chart(document.getElementById("donutChart"), {
        type: "doughnut",
        data: {
            labels: ["Correct", "Wrong"],
            datasets: [{
                data: [data.correct, data.wrong],
                backgroundColor: ["#4caf50", "#e57373"],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { font: { family: "DM Sans", size: 13 }, padding: 16 }
                }
            },
            cutout: "68%"
        }
    });

    // ── Bar chart (accuracy by JLPT level) ──
    const levels = ["N5", "N4", "N3", "N2", "N1"];
    let levelAccuracies = [];

    // API returned per-level breakdown — map it to the fixed level order
    if (data.byLevel && data.byLevel.length) {
        levelAccuracies = levels.map(l => {
            const found = data.byLevel.find(x => x.level === l);
            return found ? found.accuracy : 0;  // default to 0 if a level has no data
        });
    } else {
        // byLevel not available — fetch each level individually in parallel
        levelAccuracies = await Promise.all(levels.map(async l => {
            const r = await fetch(
                `${window.API_BASE}/api/dashboard?level=${l}`, { headers });
            const d = await r.json();
            return d.accuracy || 0;
        }));
    }

    // Destroy previous instance before creating a new one
    if (barChart) barChart.destroy();
    barChart = new Chart(document.getElementById("barChart"), {
        type: "bar",
        data: {
            labels: levels,
            datasets: [{
                label: "Accuracy %",
                data: levelAccuracies,
                backgroundColor: "#4f5fc4",
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    min: 0, max: 100,
                    ticks: { callback: v => v + "%", font: { size: 13 } },
                    grid: { color: "#f0f0f0" }
                },
                x: {
                    ticks: { font: { size: 13 } },
                    grid: { display: false }
                }
            }
        }
    });
}

// Initial load on page ready
loadDashboard();
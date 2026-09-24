/* =====================================================
   ACCOUNT PAGE
===================================================== */


/* =====================================================
   GET LOGGED-IN USER
===================================================== */

function getLoggedInUser() {

    const userData =
        localStorage.getItem("melody_user");

    if (userData) {
        try {
            const parsedUser = JSON.parse(userData);
            if (parsedUser && typeof parsedUser === "object") return parsedUser;
        } catch (error) {
            console.error("Invalid user data:", error);
        }
    }

    const token = localStorage.getItem("melody_token");
    if (!token) return null;
    try {
        const rawPayload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const encodedPayload = rawPayload + "=".repeat((4 - rawPayload.length % 4) % 4);
        const payload = JSON.parse(atob(encodedPayload));
        return { id: payload.userId, name: payload.name, email: payload.sub };
    } catch (error) {
        console.error("Could not read account details from the sign-in token:", error);
        return null;
    }
}


/* =====================================================
   LOAD ACCOUNT
===================================================== */

function loadAccount() {

    const user =
        getLoggedInUser();


    /* ---------- Not Logged In ---------- */

    if (!user) {

        window.location.href =
            "index.html";

        return;
    }


    const name =
        user.name || "User";

    const email =
        user.email || "-";


    /* ---------- Profile ---------- */

    document.getElementById(
        "profileInitial"
    ).textContent =
        name.trim()
            .charAt(0)
            .toUpperCase();


    document.getElementById(
        "profileName"
    ).textContent = name;


    document.getElementById(
        "profileEmail"
    ).textContent = email;


    /* ---------- Account Details ---------- */

    document.getElementById(
        "detailName"
    ).textContent = name;


    document.getElementById(
        "detailEmail"
    ).textContent = email;


    /* ---------- Joining Date ---------- */

    if (user.createdAt) {

        const date = new Date(user.createdAt);

        document.getElementById(
            "detailJoiningDate"
        ).textContent =
            date.toLocaleDateString(
                "en-IN",
                {
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                }
            );

    }
    else {

        document.getElementById(
            "detailJoiningDate"
        ).textContent = "Not available";
    }
}


/* =====================================================
   ACCOUNT DETAILS
===================================================== */

function toggleAccountDetails() {

    const details =
        document.getElementById(
            "accountDetails"
        );

    details.classList.toggle(
        "visible"
    );
}


/* =====================================================
   HISTORY
===================================================== */

function groupAccountHistoryByDate(entries) {
    const groups = new Map();
    const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const todayKey = dateKey(today);
    const yesterdayKey = dateKey(yesterday);

    entries.forEach((entry, index) => {
        const date = new Date(entry.playedAt);
        if (Number.isNaN(date.getTime())) return;
        const key = dateKey(date);
        if (!groups.has(key)) {
            const label = key === todayKey ? "Today"
                : key === yesterdayKey ? "Yesterday"
                    : date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
            groups.set(key, { key, label, entries: [], songIds: new Set() });
        }
        const group = groups.get(key);
        const songId = entry.id == null ? `entry-${index}` : String(entry.id);
        if (group.songIds.has(songId)) return;
        group.songIds.add(songId);
        group.entries.push(entry);
    });

    return [...groups.values()].filter(group => group.entries.length);
}

function openHistory() {
    const panel = document.getElementById("historyPanel");
    const list = document.getElementById("historyList");
    if (!panel || !list) return;

    panel.hidden = false;
    list.replaceChildren();
    const loading = document.createElement("p");
    loading.className = "history-empty";
    loading.textContent = "Loading your listening history…";
    list.appendChild(loading);

    fetch("http://localhost:8080/api/library/history", {
        headers: { Authorization: `Bearer ${localStorage.getItem("melody_token") || ""}` }
    }).then(async response => {
        if (response.status === 401 || response.status === 403) throw new Error("Your sign-in has expired. Please sign in again to view history.");
        if (!response.ok) throw new Error("Could not load your listening history.");
        return response.json();
    }).then(entries => {
        if (!entries) return;
        list.replaceChildren();
        const groups = groupAccountHistoryByDate(entries || []);
        if (!groups.length) {
            const empty = document.createElement("p");
            empty.className = "history-empty";
            empty.textContent = "No songs played in the last 30 days.";
            list.appendChild(empty);
            return;
        }

        groups.forEach((group, groupIndex) => {
            const section = document.createElement("details");
            section.className = "history-day";
            section.open = group.label === "Today";
            const summary = document.createElement("summary");
            summary.className = "history-day-heading";
            const label = document.createElement("strong");
            label.textContent = group.label;
            const count = document.createElement("small");
            count.textContent = `${group.entries.length} ${group.entries.length === 1 ? "song" : "songs"}`;
            summary.append(label, count);
            const rows = document.createElement("div");
            rows.className = "history-day-entries";
            group.entries.forEach((entry, index) => {
                const row = document.createElement("article");
                row.className = "history-entry";
                const cover = document.createElement("div");
                cover.className = `history-cover history-cover-${((groupIndex + index) % 5) + 1}`;
                cover.textContent = (entry.title || "♫").trim().charAt(0).toUpperCase();
                const info = document.createElement("div");
                info.className = "history-song";
                const title = document.createElement("strong");
                title.textContent = entry.title || "Unknown title";
                const artist = document.createElement("span");
                artist.textContent = entry.artist || "Unknown artist";
                info.append(title, artist);
                const playedAt = document.createElement("time");
                const date = new Date(entry.playedAt);
                playedAt.dateTime = entry.playedAt;
                playedAt.textContent = Number.isNaN(date.getTime())
                    ? ""
                    : date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                row.append(cover, info, playedAt);
                rows.appendChild(row);
            });
            section.append(summary, rows);
            list.appendChild(section);
        });
    }).catch(error => {
        list.replaceChildren();
        const message = document.createElement("p");
        message.className = "history-empty history-error";
        message.textContent = error.message || "Could not load your listening history.";
        list.appendChild(message);
    });
}

function closeHistory() {
    const panel = document.getElementById("historyPanel");
    if (panel) panel.hidden = true;
}


/* =====================================================
   SIGN OUT
===================================================== */

function signOut() {

    localStorage.removeItem(
        "melody_token"
    );

    localStorage.removeItem(
        "melody_user"
    );


    window.location.href =
        "index.html";
}


/* =====================================================
   GO HOME
===================================================== */

function goHome() {

    window.location.href =
        "home.html";
}


/* =====================================================
   PAGE LOAD
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    loadAccount
);

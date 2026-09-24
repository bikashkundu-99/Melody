const API_URL = "http://localhost:8080/api";


/* =====================================================
   GLOBAL MUSIC STATE
===================================================== */

let allSongs = [];
let searchResults = [];
let searchRequestId = 0;
let currentSongIndex = -1;
let playbackQueue = null;
let repeatMode = "off";
let currentSong = null;
let userSelectedSongThisSession = false;
let recentlyPlayed = [];
let artistDirectory = [];
let artistDirectoryLoaded = false;
let artistDirectoryLoadFailed = false;
let playlists = [];
let likedSongs = [];
let likedSongIds = new Set();
let pendingSaveSongId = null;
const thumbnailCache = new Map();
const HEART_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5.5-8.8 10.1-8.8 10.1S3.2 14.3 3.2 8.8A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.8 2.4Z"/></svg>';
const REPEAT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/></svg>';
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 12 7-12 7z"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM15 5h4v14h-4z"/></svg>';
const PREVIOUS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M19 6l-9 6 9 6z"/></svg>';
const NEXT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5v14M5 6l9 6-9 6z"/></svg>';
const VOLUME_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4zM17 9a5 5 0 0 1 0 6"/></svg>';
const MUTED_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4zM17 9l5 6m0-6-5 6"/></svg>';


/* =====================================================
   AUTH TOKEN
===================================================== */

function getToken() {
    return localStorage.getItem("melody_token");
}

function getLastSongStorageKey() {
    try {
        const user = JSON.parse(localStorage.getItem("melody_user") || "null");
        let identity = user?.id ?? user?.userId ?? user?.email;
        if (identity == null) {
            const token = getToken();
            const payloadPart = token?.split(".")[1];
            if (payloadPart) {
                const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
                const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
                const payload = JSON.parse(atob(padded));
                identity = payload.userId ?? payload.email ?? payload.sub;
            }
        }
        return identity == null ? null : `melody_last_song_${identity}`;
    } catch (error) {
        return null;
    }
}

function saveLastPlayedSong(song) {
    const key = getLastSongStorageKey();
    if (!key || !song) return;
    try { localStorage.setItem(key, JSON.stringify(song)); } catch (error) { console.warn("Could not save the last played song:", error); }
}

function restoreLastPlayedSong(song = null) {
    if (!song) {
        const key = getLastSongStorageKey();
        if (!key) return;
        try { song = JSON.parse(localStorage.getItem(key) || "null"); } catch (error) { song = null; }
    }
    if (!song?.id) return;
    const savedSong = song;
    currentSong = allSongs.find(item => String(item.id) === String(savedSong.id)) || savedSong;
    if (allSongs.length && !playbackQueue) playbackQueue = allSongs;
    const activeQueue = playbackQueue || allSongs;
    currentSongIndex = activeQueue.findIndex(item => String(item.id) === String(currentSong.id));
    updatePlayerUI(currentSong);
    updatePlayButtons(false);
    syncProgressUI(0);
}


/* =====================================================
   API HEADERS
===================================================== */

function getAuthHeaders() {

    const token = getToken();

    return token
        ? {
            "Authorization": `Bearer ${token}`
        }
        : {};
}


/* =====================================================
   API AUDIO URL
===================================================== */

function getFullUrl(url) {

    if (!url) {
        return "";
    }

    const value = String(url).trim().replace(/\\/g, "/");

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    // Database values can be either web paths or paths copied from the
    // Spring project's static directory. Convert both to the served URL.
    const staticPath = value.match(/\/static\/(.+)$/i);
    let path = staticPath ? staticPath[1] : value;
    path = path.replace(/^\/?src\/main\/resources\//i, "")
        .replace(/^\/?static\//i, "");

    const backendOrigin = new URL(API_URL).origin;
    return new URL(path.startsWith("/") ? path : `/${path}`, backendOrigin).href;
}

function songThumbnailSource(song) {
    if (song?.thumbnailUrl) return getFullUrl(song.thumbnailUrl);

    const knownCovers = {
        afterhours: "AfterHours.jpg",
        blindinglights: "BlindingLights.jpg",
        dieforyou: "DieForYou.jpg",
        mothtoaflame: "MothToAFlame.jpg",
        oneofthegirls: "OneOfTheGirls.jpg",
        saveyourtears: "SaveyourTears.jpg",
        starboy: "Starboy.jpg"
    };
    const titleKey = String(song?.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const filename = knownCovers[titleKey];
    return filename ? `${new URL(API_URL).origin}/images/${filename}` : "";
}

async function getDisplayThumbnailUrl(source) {
    const target = new URL(source, window.location.href);
    const backendOrigin = new URL(API_URL).origin;
    if (target.origin !== backendOrigin) return target.href;

    if (!thumbnailCache.has(target.href)) {
        const request = fetch(target.href, { headers: getAuthHeaders() }).then(async response => {
            if (!response.ok) throw new Error(`Image request failed (${response.status})`);
            const contentType = response.headers.get("content-type") || "";
            if (contentType && !contentType.startsWith("image/")) {
                throw new Error("Thumbnail URL did not return an image.");
            }
            return URL.createObjectURL(await response.blob());
        });
        thumbnailCache.set(target.href, request);
        request.catch(() => {
            if (thumbnailCache.get(target.href) === request) thumbnailCache.delete(target.href);
        });
    }
    return thumbnailCache.get(target.href);
}

function applySongThumbnail(element, song) {
    if (!element) return;
    const isAlbumCard = element.classList.contains("album");
    const thumbnailSource = songThumbnailSource(song);
    element.dataset.thumbnailSource = thumbnailSource;
    element.style.backgroundSize = "cover";
    element.style.backgroundPosition = "center";
    element.style.backgroundImage = "";
    element.classList.remove("has-thumbnail");
    if (!isAlbumCard) element.textContent = "♫";

    if (!thumbnailSource) {
        if (!isAlbumCard) element.textContent = "♫";
        return;
    }

    element.title = song.title || "Song artwork";
    getDisplayThumbnailUrl(thumbnailSource).then(displayUrl => {
        if (element.dataset.thumbnailSource !== thumbnailSource) return;
        const image = new Image();
        image.onload = () => {
            if (element.dataset.thumbnailSource !== thumbnailSource) return;
            element.style.backgroundImage = `url("${displayUrl.replace(/"/g, "%22")}")`;
            if (isAlbumCard) element.classList.add("has-thumbnail");
            else element.textContent = "";
        };
        image.onerror = () => {
            if (element.dataset.thumbnailSource !== thumbnailSource) return;
            element.style.backgroundImage = "";
            element.classList.remove("has-thumbnail");
            if (!isAlbumCard) element.textContent = "♫";
        };
        image.src = displayUrl;
    }).catch(error => {
        console.warn(`Could not load thumbnail for ${song?.title || "song"}:`, error);
    });
}


/* =====================================================
   SEARCH SONGS
===================================================== */

async function searchSongs(query) {

    const text = query.trim();
    const requestId = ++searchRequestId;

    try {

        let url;

        if (!text) {

            url = `${API_URL}/songs`;

        } else {

            url =
                `${API_URL}/songs/search?q=${encodeURIComponent(text)}`;
        }

        const response = await fetch(url, {
            method: "GET",
            headers: getAuthHeaders()
        });

        if (response.status === 401) {

            console.error("Authentication failed.");

            localStorage.removeItem("melody_token");
            localStorage.removeItem("melody_user");

            window.location.href = "index.html";
            return;
        }

        if (!response.ok) {
            throw new Error(
                `Search failed: ${response.status}`
            );
        }

        const songs = await response.json();

        if (requestId !== searchRequestId) return;

        console.log("Search results:", songs);

        searchResults = songs;

        displaySearchResults(songs);

    } catch (error) {

        console.error(
            "Music search error:",
            error
        );
    }
}


/* =====================================================
   LOAD ALL SONGS
===================================================== */

async function loadSongs() {

    try {

        const response = await fetch(
            `${API_URL}/songs`,
            {
                method: "GET",
                headers: getAuthHeaders()
            }
        );

        if (response.status === 401) {

            localStorage.removeItem("melody_token");
            localStorage.removeItem("melody_user");

            window.location.href = "index.html";
            return;
        }

        if (!response.ok) {
            throw new Error(
                `Unable to load songs: ${response.status}`
            );
        }

        allSongs = await response.json();

        console.log(
            "Songs loaded from database:",
            allSongs
        );

        /*
         * Bind database songs to the existing
         * "Made for you" cards.
         */
        bindSongsToMusicCards();
        if (currentSong) {
            const canonicalSong = allSongs.find(song => String(song.id) === String(currentSong.id));
            if (canonicalSong) {
                currentSong = canonicalSong;
                if (!playbackQueue) playbackQueue = allSongs;
                currentSongIndex = (playbackQueue || allSongs).findIndex(song => String(song.id) === String(currentSong.id));
                updatePlayerUI(currentSong);
            }
        }

    } catch (error) {

        console.error(
            "Unable to load songs:",
            error
        );
    }
}


/* =====================================================
   DISPLAY SEARCH RESULTS
===================================================== */

function displaySearchResults(songs) {
    const panel = document.getElementById("searchResultsPanel");
    const grid = document.getElementById("searchResultsGrid");
    if (!panel || !grid) return;
    panel.hidden = false;
    grid.replaceChildren();
    if (!songs || songs.length === 0) {
        const empty = document.createElement("p");
        empty.className = "search-empty";
        empty.textContent = "No songs found. Try another search.";
        grid.appendChild(empty);
        return;
    }
    songs.forEach((song, index) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "search-result-row";
        const cover = document.createElement("span");
        cover.className = `search-result-cover album-${(index % 4) + 1}`;
        cover.textContent = "♫";
        applySongThumbnail(cover, song);
        const info = document.createElement("span");
        info.className = "search-result-info";
        const title = document.createElement("strong");
        title.textContent = song.title || "Unknown title";
        const artist = document.createElement("small");
        artist.textContent = song.artist || "Unknown artist";
        info.append(title, artist);
        row.append(cover, info);
        row.addEventListener("click", () => {
            const input = document.getElementById("searchInput");
            const panel = document.getElementById("searchResultsPanel");
            const grid = document.getElementById("searchResultsGrid");
            if (input) input.value = "";
            searchRequestId++;
            searchResults = [];
            if (panel) panel.hidden = true;
            if (grid) grid.replaceChildren();
            playSong(song, songs);
        });
        grid.appendChild(row);
    });
}

async function apiCall(path, options = {}) {
    const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    if (response.status === 401) {
        localStorage.removeItem("melody_token");
        localStorage.removeItem("melody_user");
        window.location.href = "index.html";
        throw new Error("Your session has expired. Please sign in again.");
    }
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Request failed (${response.status})`);
    }
    if (response.status === 204) return null;
    return response.json();
}

function uniqueSongsById(songs) {
    const seen = new Set();
    return songs.filter(song => {
        const id = song?.id;
        if (id == null) return true;
        const key = String(id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function getTopArtists() {
    const playsByName = new Map();
    recentlyPlayed.forEach(song => {
        const name = String(song?.artist || "").trim();
        if (!name || name.toLowerCase() === "unknown artist") return;
        const key = name.toLocaleLowerCase();
        playsByName.set(key, (playsByName.get(key) || 0) + 1);
    });

    return artistDirectory
        .filter(artist => String(artist?.name || "").trim())
        .map(artist => ({
            ...artist,
            name: String(artist.name).trim(),
            plays: playsByName.get(String(artist.name).trim().toLocaleLowerCase()) || 0
        }))
        .sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name))
        .slice(0, 20);
}

async function loadArtistDirectory() {
    try {
        const artists = await apiCall("/artists");
        artistDirectory = Array.isArray(artists) ? artists : [];
        artistDirectoryLoaded = true;
        artistDirectoryLoadFailed = false;
        renderTopArtists();
        return artistDirectory;
    } catch (error) {
        artistDirectoryLoaded = true;
        artistDirectoryLoadFailed = true;
        renderTopArtists();
        throw error;
    }
}

function artistPhotoSource(artist) {
    const value = String(artist?.photoUrl || artist?.photo_url || "").trim().replace(/\\/g, "/");
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;

    const staticArtistPath = value.match(/(?:^|\/)(images\/artists\/.+)$/i);
    if (staticArtistPath) return getFullUrl(staticArtistPath[1]);

    const artistRelativePath = value.match(/^artists\/(.+)$/i);
    if (artistRelativePath) return getFullUrl(`/images/artists/${artistRelativePath[1]}`);

    if (!value.includes("/")) return getFullUrl(`/images/artists/${value}`);
    return getFullUrl(value);
}

function artistFallbackPhotoSource(artist) {
    const key = String(artist?.name || "").toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
    const knownPhotos = {
        theweeknd: "TheWeeknd.jpg",
        dualipa: "DuaLipa.jpg",
        jennie: "Jennie.jpg",
        lilyrosedepp: "LilyRoseDeep.jpg",
        swedishhousemafia: "SedishHouseMafia.jpg",
        tameimpala: "TameImpala.jpg"
    };
    const filename = knownPhotos[key];
    return filename ? getFullUrl(`/images/artists/${filename}`) : "";
}

function applyArtistPhoto(avatar, artist) {
    if (!avatar) return;
    const photoSources = [...new Set([
        artistPhotoSource(artist),
        artistFallbackPhotoSource(artist)
    ].filter(Boolean))];
    if (!photoSources.length) return;

    const sourceKey = photoSources.join("|");
    const initial = String(artist?.name || "?").trim().charAt(0).toUpperCase();
    avatar.dataset.artistPhotoSource = sourceKey;

    const tryPhoto = index => {
        if (avatar.dataset.artistPhotoSource !== sourceKey) return;
        if (index >= photoSources.length) {
            avatar.replaceChildren();
            avatar.textContent = initial;
            return;
        }

        getDisplayThumbnailUrl(photoSources[index]).then(displayUrl => {
            if (avatar.dataset.artistPhotoSource !== sourceKey) return;

            const image = document.createElement("img");
            image.alt = "";
            image.loading = "lazy";
            image.decoding = "async";
            image.addEventListener("error", () => tryPhoto(index + 1), { once: true });
            image.src = displayUrl;
            avatar.replaceChildren(image);
        }).catch(error => {
            if (index + 1 < photoSources.length) {
                tryPhoto(index + 1);
            } else {
                console.warn(`Could not load photo for ${artist?.name || "artist"}:`, error);
            }
        });
    };

    tryPhoto(0);
}

function renderTopArtists() {
    const grid = document.getElementById("topArtistsGrid");
    if (!grid) return;
    grid.replaceChildren();
    const artists = getTopArtists();
    if (!artists.length) {
        const empty = document.createElement("p");
        empty.className = "artist-empty";
        empty.textContent = !artistDirectoryLoaded
            ? "Loading artists…"
            : artistDirectoryLoadFailed
                ? "Could not load artists."
                : "Add artists to your artist table to see them here.";
        grid.appendChild(empty);
        return;
    }
    artists.slice(0, 8).forEach((artist, index) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "artist-card";
        card.title = artist.name;
        const avatar = document.createElement("span");
        avatar.className = `artist-avatar avatar-${String.fromCharCode(97 + (index % 5))}`;
        avatar.textContent = artist.name.trim().charAt(0).toUpperCase();
        applyArtistPhoto(avatar, artist);
        const name = document.createElement("strong");
        name.textContent = artist.name;
        card.append(avatar, name);
        card.addEventListener("click", () => document.dispatchEvent(new CustomEvent("melody:open-artist", { detail: artist.name })));
        grid.appendChild(card);
    });
}

function renderRecentlyPlayed() {
    const grid = document.getElementById("recentGrid");
    if (!grid) return;

    grid.replaceChildren();
    if (!recentlyPlayed.length) {
        const empty = document.createElement("p");
        empty.className = "recent-empty";
        empty.textContent = "Play a song and it will appear here.";
        grid.appendChild(empty);
        return;
    }

    const uniqueRecentSongs = uniqueSongsById(recentlyPlayed).slice(0, 4);
    uniqueRecentSongs.forEach((song, index) => {
        const card = document.createElement("article");
        card.className = "recent-card";
        const cover = document.createElement("span");
        cover.className = `album-small album-${(index % 4) + 1}`;
        cover.textContent = "♫";
        applySongThumbnail(cover, song);
        const info = document.createElement("span");
        info.className = "song-info";
        const title = document.createElement("strong");
        title.textContent = song.title || "Unknown title";
        const artist = createArtistLink(song.artist, "recent-artist-link");
        info.append(title, artist);
        card.append(cover, info);
        card.addEventListener("click", () => playSong(song, uniqueRecentSongs));
        grid.appendChild(card);
    });
}

/* =====================================================
   BIND DATABASE SONGS TO EXISTING MUSIC CARDS
===================================================== */

function bindSongsToMusicCards() {

    const cards =
        document.querySelectorAll(".music-card");

    if (!cards.length || !allSongs.length) {
        return;
    }


    cards.forEach((card, index) => {

        if (index >= allSongs.length) {
            return;
        }

        const song =
            allSongs[index];


        const title =
            card.querySelector("h3");

        const description =
            card.querySelector("p");


        if (title) {
            title.textContent =
                song.title || "Unknown title";
        }


        if (description) {
            description.replaceWith(createArtistLink(song.artist, "music-card-artist"));
        }

        applySongThumbnail(card.querySelector(".album"), song);


        card.dataset.songIndex = index;


        card.style.cursor = "pointer";


        card.addEventListener(
            "click",
            function (event) {

                /*
                 * Prevent the card click from doing
                 * anything unexpected when clicking
                 * the play button.
                 */

                event.stopPropagation();

                playSong(song, allSongs);

            }
        );
    });
}


/* =====================================================
   AUDIO PLAYER
===================================================== */

const audioPlayer =
    document.getElementById("audioPlayer");
const seekSliders = document.querySelectorAll(".seek-slider");
let progressAnimationFrame = 0;
let playbackRequestId = 0;
let activeAudioObjectUrl = null;
let playbackNoticeTimer = null;

function showPlaybackNotice(message) {
    let notice = document.getElementById("playbackNotice");

    if (!notice) {
        notice = document.createElement("div");
        notice.id = "playbackNotice";
        notice.setAttribute("role", "status");
        notice.setAttribute("aria-live", "polite");
        notice.style.cssText = "position:fixed;left:50%;bottom:105px;transform:translateX(-50%);z-index:10000;padding:10px 16px;border-radius:999px;background:#172033;color:#fff;font:500 14px/1.4 system-ui,sans-serif;box-shadow:0 8px 28px #0005;max-width:min(90vw,520px);text-align:center;";
        document.body.appendChild(notice);
    }

    notice.textContent = message;
    notice.hidden = false;
    clearTimeout(playbackNoticeTimer);
    playbackNoticeTimer = setTimeout(() => { notice.hidden = true; }, 3500);
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remainingSeconds}`;
}
function syncProgressUI(progressOverride = null) {
    if (progressOverride !== null && !Number.isFinite(Number(progressOverride))) progressOverride = null;
    const duration = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : 0;
    const current = progressOverride !== null && duration > 0
        ? Number(progressOverride) / 1000 * duration
        : (Number.isFinite(audioPlayer.currentTime) ? audioPlayer.currentTime : 0);
    const progress = progressOverride !== null
        ? Math.max(0, Math.min(1000, Number(progressOverride)))
        : (duration ? Math.max(0, Math.min(1000, Math.round(current / duration * 1000))) : 0);
    document.querySelectorAll(".current-time").forEach((label) => label.textContent = formatTime(current));
    document.querySelectorAll(".duration-time").forEach((label) => label.textContent = formatTime(duration));
    seekSliders.forEach((slider) => {
        slider.value = String(progress);
        slider.style.background = `linear-gradient(to right,var(--teal) ${progress / 10}%,#52627a ${progress / 10}%)`;
    });
}
function followAudioProgress() {
    syncProgressUI();
    if (!audioPlayer.paused && !audioPlayer.ended) {
        progressAnimationFrame = requestAnimationFrame(followAudioProgress);
    }
}
seekSliders.forEach((slider) => {
    slider.addEventListener("click", (event) => event.stopPropagation());
    slider.addEventListener("input", () => {
        const duration = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : 0;
        if (duration <= 0) return;
        const normalizedProgress = Number(slider.value);
        audioPlayer.currentTime = normalizedProgress / 1000 * duration;
        syncProgressUI(normalizedProgress);
    });
});
["loadedmetadata", "durationchange", "timeupdate", "seeking", "seeked", "emptied"].forEach((eventName) => {
    audioPlayer.addEventListener(eventName, () => syncProgressUI());
});
audioPlayer.addEventListener("play", () => {
    cancelAnimationFrame(progressAnimationFrame);
    followAudioProgress();
});
audioPlayer.addEventListener("pause", () => {
    cancelAnimationFrame(progressAnimationFrame);
    syncProgressUI();
});
audioPlayer.addEventListener("ended", () => syncProgressUI());
audioPlayer.addEventListener("error", () => {
    if (!audioPlayer.src) return;
    const reason = audioPlayer.error?.message || "The audio file could not be decoded or loaded.";
    console.error("Audio resource error:", reason);
    updatePlayButtons(false);
    showPlaybackNotice(`Couldn’t play ${currentSong?.title || "this song"}. Check that the audio file is valid.`);
});
syncProgressUI();


/* =====================================================
   PLAY SONG
===================================================== */

async function playSong(song, queue = null) {

    if (!song) {
        return;
    }

    if (!song.audioUrl) {

        console.error(
            "This song has no audio URL:",
            song
        );

        return;
    }

    userSelectedSongThisSession = true;


    const belongsToAllSongs = allSongs.some(item => String(item.id) === String(song.id));
    if (Array.isArray(queue) && queue.length) playbackQueue = queue;
    else if (!playbackQueue?.some(item => String(item.id) === String(song.id)) && belongsToAllSongs) playbackQueue = allSongs;

    currentSong = song;


    /*
     * Find song inside the complete database list.
     */
    const activeQueue = playbackQueue || allSongs;
    const index = activeQueue.findIndex(item => String(item.id) === String(song.id));


    if (index !== -1) {
        currentSongIndex = index;
    }


    const audioUrl = getFullUrl(song.audioUrl);
    const requestId = ++playbackRequestId;


    console.log(
        "Playing song:",
        song.title
    );

    console.log(
        "Audio URL:",
        audioUrl
    );


    audioPlayer.pause();
    audioPlayer.removeAttribute("src");
    audioPlayer.load();
    if (activeAudioObjectUrl) {
        URL.revokeObjectURL(activeAudioObjectUrl);
        activeAudioObjectUrl = null;
    }
    syncProgressUI(0);

    showPlaybackNotice(`Loading ${song.title || "song"}…`);

    try {
        const targetUrl = new URL(audioUrl, window.location.href);
        const backendOrigin = new URL(API_URL).origin;
        let playableUrl = audioUrl;

        // Native <audio> requests cannot include the app's bearer token.
        // Fetch protected backend audio with the token, then play the blob.
        if (targetUrl.origin === backendOrigin) {
            const response = await fetch(targetUrl.href, {
                method: "GET",
                headers: getAuthHeaders()
            });

            if (requestId !== playbackRequestId) return;

            if (response.status === 401) {
                localStorage.removeItem("melody_token");
                localStorage.removeItem("melody_user");
                window.location.href = "index.html";
                return;
            }

            if (!response.ok) {
                throw new Error(`Audio request failed (${response.status})`);
            }

            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("application/json") || contentType.includes("text/html")) {
                throw new Error("The audio URL returned a page instead of an audio file.");
            }

            const audioBlob = await response.blob();
            if (requestId !== playbackRequestId) return;
            activeAudioObjectUrl = URL.createObjectURL(audioBlob);
            playableUrl = activeAudioObjectUrl;
        }

        audioPlayer.src = playableUrl;
        audioPlayer.load();
        await audioPlayer.play();

        if (requestId !== playbackRequestId) return;
        saveLastPlayedSong(song);
        recentlyPlayed = [song, ...recentlyPlayed];
        renderRecentlyPlayed();
        renderTopArtists();
        updatePlayerUI(song);
        updatePlayButtons(true);
        showPlaybackNotice(`Playing ${song.title || "song"}`);
        apiCall(`/library/recent/${song.id}`, { method: "POST" })
            .catch(error => console.error("Could not save listening history:", error));
    } catch (error) {
        if (requestId !== playbackRequestId) return;
        console.error("Audio playback failed:", error);
        updatePlayButtons(false);
        showPlaybackNotice(`Couldn’t play ${song.title || "this song"}. ${error.message || "Check the audio URL and try again."}`);
    }
}


/* =====================================================
   PLAYER UI
===================================================== */

function updatePlayerUI(song) {

    if (!song) {
        return;
    }


    const title =
        song.title || "Unknown title";

    const artist =
        song.artist || "Unknown artist";


    /*
     * Compact player
     */

    const playerTitle =
        document.querySelector(
            ".now-playing h4"
        );

    const playerArtist = document.getElementById("compactArtist");


    if (playerTitle) {
        playerTitle.textContent = title;
    }


    if (playerArtist) {
        playerArtist.textContent = artist;
        playerArtist.title = `See ${artist}'s songs`;
    }


    /*
     * Compact thumbnail
     */

    const playerCover =
        document.querySelector(
            ".player-cover"
        );


    applySongThumbnail(playerCover, song);


    /*
     * Expanded player
     */

    const expandedTitle =
        document.querySelector(
            ".expanded-song-info h2"
        );

    const expandedArtist = document.getElementById("expandedArtist");


    if (expandedTitle) {
        expandedTitle.textContent = title;
    }


    if (expandedArtist) {
        expandedArtist.textContent = artist;
        expandedArtist.title = `See ${artist}'s songs`;
    }


    /*
     * Expanded thumbnail
     */

    const expandedCover =
        document.querySelector(
            ".expanded-cover"
        );


    applySongThumbnail(expandedCover, song);
    updatePlayerLikeButtons(likedSongIds.has(song.id));
}


function updatePlayerLikeButtons(isLiked) {
    ["playerLikeButton", "expandedLikeButton"].forEach(id => {
        const button = document.getElementById(id);
        if (!button) return;
        button.classList.toggle("liked", isLiked);
        button.innerHTML = HEART_ICON;
        button.setAttribute("aria-pressed", String(isLiked));
        button.setAttribute("aria-label", isLiked ? "Unlike song" : "Like song");
    });
}

function renderLikedSongs() {
    const list = document.getElementById("likedSongsList");
    if (!list) return;
    list.replaceChildren();
    if (!likedSongs.length) {
        const empty = document.createElement("p");
        empty.className = "library-empty";
        empty.textContent = "Songs you like will appear here.";
        list.appendChild(empty);
        return;
    }
    likedSongs.forEach((song, index) => {
        const row = document.createElement("div");
        row.className = "liked-row";
        const cover = document.createElement("div");
        cover.className = `liked-cover album-${(index % 4) + 1}`;
        cover.textContent = "♫";
        applySongThumbnail(cover, song);
        const info = document.createElement("div");
        info.className = "liked-song";
        const title = document.createElement("h3");
        title.textContent = song.title || "Unknown title";
        const artist = createArtistLink(song.artist, "liked-artist-link");
        info.append(title, artist);
        const unlike = document.createElement("button");
        unlike.type = "button";
        unlike.className = "liked-heart active";
        unlike.innerHTML = HEART_ICON;
        unlike.setAttribute("aria-label", `Unlike ${song.title || "song"}`);
        unlike.addEventListener("click", async event => {
            event.stopPropagation();
            try {
                await apiCall(`/library/liked/${song.id}`, { method: "DELETE" });
                await refreshLikedSongs();
            } catch (error) {
                showPlaybackNotice(error.message || "Could not remove liked song.");
            }
        });
        row.append(cover, info, unlike);
        row.addEventListener("click", () => playSong(song, likedSongs));
        list.appendChild(row);
    });
}

async function refreshLikedSongs() {
    likedSongs = await apiCall("/library/liked");
    likedSongIds = new Set(likedSongs.map(song => song.id));
    renderLikedSongs();
    updatePlayerLikeButtons(currentSong ? likedSongIds.has(currentSong.id) : false);
}

async function toggleCurrentSongLike() {
    if (!currentSong) {
        showPlaybackNotice("Play a song before liking it.");
        return;
    }
    const liked = likedSongIds.has(currentSong.id);
    try {
        await apiCall(`/library/liked/${currentSong.id}`, { method: liked ? "DELETE" : "POST" });
        await refreshLikedSongs();
        showPlaybackNotice(liked ? "Removed from Liked Songs" : "Added to Liked Songs");
    } catch (error) {
        showPlaybackNotice(error.message || "Could not update liked songs.");
    }
}

/* =====================================================
   PLAY / PAUSE
===================================================== */

function togglePlayPause() {

    if (!audioPlayer) {
        return;
    }


    if (!audioPlayer.src) {
        const song = currentSong || allSongs[0];
        if (song) playSong(song, playbackQueue || allSongs);

        return;
    }


    if (audioPlayer.paused) {

        audioPlayer.play()
            .then(() => {

                updatePlayButtons(true);

            })
            .catch(error => {

                console.error(
                    "Unable to play:",
                    error
                );

            });

    } else {

        audioPlayer.pause();

        updatePlayButtons(false);
    }
}


/* =====================================================
   UPDATE PLAY BUTTONS
===================================================== */

function updatePlayButtons(isPlaying) {

    const compactPlay =
        document.querySelector(
            ".play-main"
        );


    const expandedPlay =
        document.querySelector(
            ".expanded-play"
        );


    if (compactPlay) {
        compactPlay.innerHTML = isPlaying ? PAUSE_ICON : PLAY_ICON;
        compactPlay.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
        compactPlay.title = isPlaying ? "Pause" : "Play";
    }


    if (expandedPlay) {
        expandedPlay.innerHTML = isPlaying ? PAUSE_ICON : PLAY_ICON;
        expandedPlay.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
        expandedPlay.title = isPlaying ? "Pause" : "Play";
    }

}


/* =====================================================
   PREVIOUS SONG
===================================================== */

function playPreviousSong(queue = null) {
    if (Array.isArray(queue) && queue.length) playbackQueue = queue;
    const activeQueue = playbackQueue?.length ? playbackQueue : allSongs;
    if (!activeQueue.length) return;
    const activeIndex = activeQueue.findIndex(song => String(song.id) === String(currentSong?.id));
    currentSongIndex = activeIndex < 0 || activeIndex === 0 ? activeQueue.length - 1 : activeIndex - 1;
    playSong(activeQueue[currentSongIndex], activeQueue);
}


/* =====================================================
   NEXT SONG
===================================================== */

function playNextSong(queue = null, automatic = false) {
    if (Array.isArray(queue) && queue.length) playbackQueue = queue;
    const activeQueue = playbackQueue?.length ? playbackQueue : allSongs;
    if (!activeQueue.length) return;
    const activeIndex = activeQueue.findIndex(song => String(song.id) === String(currentSong?.id));

    if (automatic && repeatMode === "one") {
        audioPlayer.currentTime = 0;
        audioPlayer.play().catch(error => console.error("Unable to repeat song:", error));
        return;
    }

    if (automatic && repeatMode === "off" && activeIndex >= activeQueue.length - 1) {
        updatePlayButtons(false);
        return;
    }

    currentSongIndex = activeIndex < 0 || activeIndex >= activeQueue.length - 1 ? 0 : activeIndex + 1;
    playSong(activeQueue[currentSongIndex], activeQueue);
}

function createArtistLink(artistName, extraClass = "") {
    const artist = artistName || "Unknown artist";
    const link = document.createElement("button");
    link.type = "button";
    link.className = `player-artist-link ${extraClass}`.trim();
    link.textContent = artist;
    link.title = `See ${artist}'s songs`;
    link.addEventListener("click", event => {
        event.stopPropagation();
        if (artistName) document.dispatchEvent(new CustomEvent("melody:open-artist", { detail: artistName }));
    });
    return link;
}

function groupHistoryByLocalDate(entries) {
    const groups = new Map();
    const localKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const todayKey = localKey(today);
    const yesterdayKey = localKey(yesterday);

    entries.forEach((entry, index) => {
        const date = new Date(entry.playedAt);
        if (Number.isNaN(date.getTime())) return;
        const key = localKey(date);
        if (!groups.has(key)) {
            const label = key === todayKey ? "Today"
                : key === yesterdayKey ? "Yesterday"
                    : date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
            groups.set(key, { key, label, entries: [], seenSongs: new Set() });
        }
        const group = groups.get(key);
        const songKey = entry.id == null ? `entry-${index}` : String(entry.id);
        if (group.seenSongs.has(songKey)) return;
        group.seenSongs.add(songKey);
        group.entries.push(entry);
    });

    return [...groups.values()].filter(group => group.entries.length).map(group => ({
        key: group.key,
        label: group.label,
        entries: group.entries
    }));
}


/* =====================================================
   AUTO NEXT
===================================================== */

if (audioPlayer) {

    audioPlayer.addEventListener(
        "ended",
        function () {

            playNextSong(null, true);

        }
    );


    audioPlayer.addEventListener(
        "play",
        function () {

            updatePlayButtons(true);

        }
    );


    audioPlayer.addEventListener(
        "pause",
        function () {

            updatePlayButtons(false);

        }
    );
}


/* =====================================================
   OPEN ACCOUNT PAGE
===================================================== */

function openAccountPage() {

    const userData =
        localStorage.getItem("melody_user");


    if (!userData) {

        window.location.href =
            "index.html";

        return;
    }


    window.location.href =
        "account.html";
}


/* =====================================================
   DOM READY
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {


        /* =================================================
           PROFILE
        ================================================= */

        const userData =
            localStorage.getItem(
                "melody_user"
            );


        const profileButton =
            document.getElementById(
                "profileButton"
            );


        if (profileButton && userData) {

            try {

                const user =
                    JSON.parse(userData);


                if (user.name) {

                    profileButton.textContent =
                        user.name
                            .trim()
                            .charAt(0)
                            .toUpperCase();
                }

            } catch (error) {

                console.error(
                    "Unable to load profile:",
                    error
                );
            }
        }


        /* =================================================
           ELEMENTS
        ================================================= */

        const playerBar =
            document.getElementById(
                "playerBar"
            );


        const expandedPlayer =
            document.getElementById(
                "expandedPlayer"
            );


        const collapsePlayer =
            document.getElementById(
                "collapsePlayer"
            );


        const playerLikeButton =
            document.getElementById(
                "playerLikeButton"
            );


        const expandedLikeButton =
            document.getElementById(
                "expandedLikeButton"
            );


        const createPlaylistNav =
            document.getElementById(
                "createPlaylistNav"
            );


        const likedSongsNav =
            document.getElementById(
                "likedSongsNav"
            );


        const homeNav =
            document.getElementById(
                "homeNav"
            );


        const playlistModal =
            document.getElementById(
                "playlistModal"
            );


        const likedSongsModal =
            document.getElementById(
                "likedSongsModal"
            );


        const cancelPlaylist =
            document.getElementById(
                "cancelPlaylist"
            );


        const createPlaylist =
            document.getElementById(
                "createPlaylist"
            );


        const closeLikedSongs =
            document.getElementById(
                "closeLikedSongs"
            );


        /* =================================================
           SEARCH
        ================================================= */

        const searchInput =
            document.getElementById(
                "searchInput"
            );


        let searchTimer;


        if (searchInput) {

            searchInput.addEventListener(
                "input",
                () => {

                    clearTimeout(
                        searchTimer
                    );
                    searchRequestId++;
                    const oldPanel = document.getElementById("searchResultsPanel");
                    const oldGrid = document.getElementById("searchResultsGrid");
                    if (oldPanel) oldPanel.hidden = true;
                    if (oldGrid) oldGrid.replaceChildren();


                    searchTimer =
                        setTimeout(() => {
                            const query = searchInput.value.trim();
                            if (!query) {
                                searchRequestId++;
                                searchResults = [];
                                const panel = document.getElementById("searchResultsPanel");
                                const grid = document.getElementById("searchResultsGrid");
                                if (panel) panel.hidden = true;
                                if (grid) grid.replaceChildren();
                                return;
                            }
                            searchSongs(query);
                        }, 300);
                }
            );
        }

        const microphoneButton = document.getElementById("microphoneButton");
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (microphoneButton && !SpeechRecognitionAPI) {
            microphoneButton.hidden = true;
        } else if (microphoneButton && searchInput) {
            const recognition = new SpeechRecognitionAPI();
            let voiceSearchActive = false;
            let voiceSearchError = false;

            recognition.lang = "en-IN";
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            const resetVoiceSearchButton = () => {
                voiceSearchActive = false;
                microphoneButton.classList.remove("is-listening");
                microphoneButton.setAttribute("aria-pressed", "false");
            };

            recognition.onresult = event => {
                const transcript = event.results?.[0]?.[0]?.transcript?.trim();
                if (!transcript) return;

                searchInput.value = transcript;
                searchInput.dispatchEvent(new Event("input", { bubbles: true }));
                searchInput.focus();
                searchInput.setSelectionRange(transcript.length, transcript.length);
            };

            recognition.onerror = event => {
                voiceSearchError = true;
                resetVoiceSearchButton();
                microphoneButton.title = event.error === "not-allowed"
                    ? "Allow microphone access to use voice search"
                    : `Voice search error: ${event.error}`;
            };

            recognition.onend = () => {
                resetVoiceSearchButton();
                if (!voiceSearchError) microphoneButton.title = "Search by voice";
            };

            microphoneButton.addEventListener("click", () => {
                if (voiceSearchActive) {
                    recognition.stop();
                    return;
                }

                try {
                    voiceSearchError = false;
                    microphoneButton.title = "Listening… Click to stop";
                    voiceSearchActive = true;
                    microphoneButton.classList.add("is-listening");
                    microphoneButton.setAttribute("aria-pressed", "true");
                    recognition.start();
                } catch (error) {
                    resetVoiceSearchButton();
                    console.warn("Voice search could not start:", error);
                }
            });
        }


        /* =================================================
           PLAYER OPEN
        ================================================= */

        function openPlayer() {

            if (!expandedPlayer) {
                return;
            }


            expandedPlayer.classList.add(
                "open"
            );


            expandedPlayer.setAttribute(
                "aria-hidden",
                "false"
            );


            document.body.classList.add(
                "player-open"
            );
        }


        /* =================================================
           PLAYER CLOSE
        ================================================= */

        function closePlayer() {

            if (!expandedPlayer) {
                return;
            }


            expandedPlayer.classList.remove(
                "open"
            );


            expandedPlayer.setAttribute(
                "aria-hidden",
                "true"
            );


            document.body.classList.remove(
                "player-open"
            );
            if (expandedPlayer.contains(document.activeElement) || playerBar?.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            playerBar?.blur();
        }


        /* =================================================
           COMPACT PLAYER
        ================================================= */

        if (playerBar) {

            playerBar.addEventListener(
                "click",
                openPlayer
            );


            playerBar.addEventListener(
                "keydown",
                (event) => {

                    if (
                        event.key === "Enter" ||
                        event.key === " "
                    ) {

                        event.preventDefault();

                        openPlayer();
                    }
                }
            );
        }


        /* =================================================
           PLAYER CONTROLS
        ================================================= */

        const playerControls =
            document.querySelectorAll(
                ".player-control"
            );


        playerControls.forEach(
            (control) => {

                control.addEventListener(
                    "click",
                    (event) => {

                        event.stopPropagation();

                    }
                );
            }
        );


        /*
         * Compact previous
         */

        const compactControls =
            document.querySelectorAll(
                ".controls .player-control"
            );


        if (compactControls.length >= 3) {

            compactControls[0]
                .addEventListener(
                    "click",
                    playPreviousSong
                );


            compactControls[1]
                .addEventListener(
                    "click",
                    togglePlayPause
                );


            compactControls[2]
                .addEventListener(
                    "click",
                    playNextSong
                );
        }


        /*
         * Expanded previous
         */

        const expandedControls =
            document.querySelectorAll(
                ".expanded-controls .player-control"
            );


        if (expandedControls.length >= 3) {

            expandedControls[0]
                .addEventListener(
                    "click",
                    playPreviousSong
                );


            expandedControls[1]
                .addEventListener(
                    "click",
                    togglePlayPause
                );


            expandedControls[2]
                .addEventListener(
                    "click",
                    playNextSong
                );
        }


        /* =================================================
           COLLAPSE PLAYER
        ================================================= */

        if (collapsePlayer) {

            collapsePlayer.addEventListener(
                "click",
                (event) => {

                    event.stopPropagation();

                    closePlayer();
                }
            );
        }


        /* =================================================
           LIKE BUTTON
        ================================================= */

        [
            playerLikeButton,
            expandedLikeButton
        ].forEach(
            (button) => {

                if (!button) {
                    return;
                }


                button.addEventListener(
                    "click",
                    (event) => {

                        event.stopPropagation();

                        toggleCurrentSongLike();
                    }
                );
            }
        );


        /* =================================================
           CREATE PLAYLIST
        ================================================= */

        function openPlaylistModal() {

            if (!playlistModal) {
                return;
            }


            playlistModal.classList.add(
                "open"
            );


            playlistModal.setAttribute(
                "aria-hidden",
                "false"
            );


            document.body.classList.add(
                "modal-open"
            );


            document
                .getElementById(
                    "playlistName"
                )
                ?.focus();
        }


        function closePlaylistModal() {

            if (!playlistModal) {
                return;
            }


            playlistModal.classList.remove(
                "open"
            );


            playlistModal.setAttribute(
                "aria-hidden",
                "true"
            );


            document.body.classList.remove(
                "modal-open"
            );
        }


        if (createPlaylistNav) {

            createPlaylistNav.addEventListener(
                "click",
                openPlaylistModal
            );
        }


        if (cancelPlaylist) {

            cancelPlaylist.addEventListener(
                "click",
                () => {
                    pendingSaveSongId = null;
                    closePlaylistModal();
                }
            );
        }


        if (createPlaylist) {

            createPlaylist.addEventListener(
                "click",
                async () => {

                    const nameInput =
                        document.getElementById(
                            "playlistName"
                        );


                    const descriptionInput =
                        document.getElementById(
                            "playlistDescription"
                        );


                    const name =
                        nameInput.value.trim();


                    if (!name) {

                        nameInput.focus();

                        nameInput.setAttribute(
                            "placeholder",
                            "Enter a playlist title"
                        );

                        return;
                    }


                    try {
                        const playlist = await apiCall("/playlists", {
                            method: "POST",
                            body: {
                                name,
                                description: descriptionInput.value.trim(),
                                privacy: "Private",
                                collaborate: false
                            }
                        });
                        const songToSave = pendingSaveSongId;
                        pendingSaveSongId = null;
                        if (songToSave) {
                            await apiCall(`/playlists/${playlist.id}/songs/${songToSave}`, { method: "POST" });
                        }
                        nameInput.value = "";
                        descriptionInput.value = "";
                        closePlaylistModal();
                        await refreshPlaylists();
                        showPlaybackNotice(`Created playlist “${playlist.name}”`);
                    } catch (error) {
                        showPlaybackNotice(error.message || "Could not create playlist.");
                    }
                }
            );
        }


        /* =================================================
           LIKED SONGS
        ================================================= */

        function openLikedSongs() {

            if (!likedSongsModal) {
                return;
            }


            likedSongsModal.classList.add(
                "open"
            );


            likedSongsModal.setAttribute(
                "aria-hidden",
                "false"
            );


            document.body.classList.add(
                "modal-open"
            );
            refreshLikedSongs().catch(error => showPlaybackNotice(error.message || "Could not load liked songs."));
        }


        function closeLikedSongsPanel() {

            if (!likedSongsModal) {
                return;
            }


            likedSongsModal.classList.remove(
                "open"
            );


            likedSongsModal.setAttribute(
                "aria-hidden",
                "true"
            );


            document.body.classList.remove(
                "modal-open"
            );
        }


        if (likedSongsNav) {

            likedSongsNav.addEventListener(
                "click",
                openLikedSongs
            );
        }


        if (closeLikedSongs) {

            closeLikedSongs.addEventListener(
                "click",
                closeLikedSongsPanel
            );
        }

        document.addEventListener("pointerdown", event => {
            if (event.target.closest(".search")) return;
            const panel = document.getElementById("searchResultsPanel");
            if (!panel || panel.hidden) return;
            clearTimeout(searchTimer);
            searchRequestId++;
            panel.hidden = true;
        });
        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                clearTimeout(searchTimer);
                searchRequestId++;
                const panel = document.getElementById("searchResultsPanel");
                if (panel) panel.hidden = true;
            }
        });

        /* =================================================
           LIKED SONG HEARTS
        ================================================= */

        document
            .querySelectorAll(".liked-heart")
            .forEach(
                (button) => {

                    button.addEventListener(
                        "click",
                        (event) => {

                            event.stopPropagation();


                            button.classList.toggle(
                                "active"
                            );


                            button.textContent =
                                button.classList.contains(
                                    "active"
                                )
                                    ? "♥"
                                    : "♡";
                        }
                    );
                }
            );


        /* =================================================
           HOME NAV
        ================================================= */

        if (homeNav) {

            homeNav.addEventListener(
                "click",
                () => {

                    closeLikedSongsPanel();

                    closePlaylistModal();

                    closePlayer();

                    window.location.href =
                        "home.html";
                }
            );
        }


        /* =================================================
           ESCAPE KEY
        ================================================= */

        document.addEventListener(
            "keydown",
            (event) => {

                if (event.key === "Escape") {
                    if (libraryView?.classList.contains("open")) closeLibrary();
                    if (saveToPlaylistModal?.classList.contains("open")) {
                        saveToPlaylistModal.classList.remove("open");
                        saveToPlaylistModal.setAttribute("aria-hidden", "true");
                        document.body.classList.remove("modal-open");
                    }

                    /*
                     * Escape only minimizes
                     * the expanded music player.
                     */

                    if (
                        expandedPlayer &&
                        expandedPlayer.classList.contains(
                            "open"
                        )
                    ) {

                        closePlayer();
                    }
                }
            }
        );


        /* =================================================
           LOAD DATABASE SONGS
        ================================================= */

        /* Volume controls stay in sync between compact and expanded players. */
        let lastVolume = 0.7;
        audioPlayer.volume = lastVolume;
        const volumeSliders = document.querySelectorAll(".volume-slider");
        const muteButtons = document.querySelectorAll(".volume-mute");
        function syncVolumeUI() {
            volumeSliders.forEach((slider) => {
                slider.value = audioPlayer.volume;
                const percent = audioPlayer.volume * 100;
                slider.style.background = `linear-gradient(to right,#fff ${percent}%,#555 ${percent}%)`;
            });
            muteButtons.forEach((button) => {
                const muted = audioPlayer.muted || audioPlayer.volume === 0;
                button.innerHTML = muted ? MUTED_ICON : VOLUME_ICON;
                button.setAttribute("aria-label", muted ? "Unmute" : "Mute");
                button.setAttribute("aria-pressed", String(muted));
            });
        }
        volumeSliders.forEach((slider) => slider.addEventListener("input", () => {
            audioPlayer.volume = Number(slider.value);
            audioPlayer.muted = false;
            if (audioPlayer.volume > 0) lastVolume = audioPlayer.volume;
            syncVolumeUI();
        }));
        muteButtons.forEach((button) => button.addEventListener("click", (event) => {
            event.stopPropagation();
            if (audioPlayer.muted || audioPlayer.volume === 0) {
                audioPlayer.muted = false;
                audioPlayer.volume = lastVolume || 0.7;
            } else {
                lastVolume = audioPlayer.volume;
                audioPlayer.muted = true;
            }
            syncVolumeUI();
        }));
        syncVolumeUI();

        function syncRepeatUI() {
            document.querySelectorAll(".repeat-toggle").forEach(button => {
                const active = repeatMode !== "off";
                button.classList.toggle("active", active);
                button.classList.toggle("repeat-one", repeatMode === "one");
                button.setAttribute("aria-pressed", String(active));
                button.setAttribute("aria-label", `Repeat ${repeatMode}`);
                button.title = repeatMode === "one" ? "Repeat one" : repeatMode === "all" ? "Repeat all" : "Repeat off";
                button.innerHTML = `${REPEAT_ICON}${repeatMode === "one" ? '<span class="repeat-one-badge" aria-hidden="true">1</span>' : ""}`;
            });
        }
        document.querySelectorAll(".repeat-toggle").forEach(button => button.addEventListener("click", event => {
            event.stopPropagation();
            repeatMode = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
            syncRepeatUI();
        }));
        syncRepeatUI();

        document.querySelectorAll(".volume").forEach((control) => control.addEventListener("click", (event) => event.stopPropagation()));

        /* Persistent library, playlists, and artist discography views. */
        const libraryView = document.getElementById("libraryView");
        const libraryTitle = document.getElementById("libraryTitle");
        const libraryList = document.getElementById("libraryList");
        const libraryMinimize = document.getElementById("libraryMinimize");
        const userPlaylists = document.getElementById("userPlaylists");
        const saveToPlaylistModal = document.getElementById("saveToPlaylistModal");
        const savePlaylistOptions = document.getElementById("savePlaylistOptions");

        function showLibrary(title, viewType = "") {
            libraryTitle.textContent = title;
            libraryList.classList.toggle("artist-directory-list", viewType === "artists");
            libraryView.classList.add("open");
            libraryView.setAttribute("aria-hidden", "false");
            document.body.classList.add("library-open");
        }

        function renderLibrarySongs(songs, artistLinks = false) {
            libraryList.replaceChildren();
            if (!songs.length) {
                const empty = document.createElement("p");
                empty.className = "library-empty";
                empty.textContent = "No songs to show yet.";
                libraryList.appendChild(empty);
                return;
            }
            songs.forEach((song, index) => {
                const row = document.createElement("div");
                row.className = "library-row";
                const cover = document.createElement("div");
                cover.className = `album-small album-${(index % 4) + 1}`;
                cover.textContent = "♫";
                applySongThumbnail(cover, song);
                const info = document.createElement("div");
                info.className = "song-info";
                const title = document.createElement("h3");
                title.textContent = song.title || "Unknown title";
                const artist = artistLinks
                    ? createArtistLink(song.artist, "library-artist-link")
                    : document.createElement("p");
                if (!artistLinks) artist.textContent = song.artist || "Unknown artist";
                info.append(title, artist);
                row.append(cover, info);
                row.addEventListener("click", () => playSong(song, songs));
                libraryList.appendChild(row);
            });
        }

        async function openPlaylist(playlistId) {
            try {
                const detail = await apiCall(`/playlists/${playlistId}`);
                const back = document.createElement("button");
                back.type = "button";
                back.className = "library-back-link";
                back.textContent = "‹ My Library";
                back.addEventListener("click", openMyLibrary);
                renderLibrarySongs(detail.songs || [], true);
                libraryList.prepend(back);
                showLibrary(detail.playlist.name);
            } catch (error) {
                showPlaybackNotice(error.message || "Could not open playlist.");
            }
        }

        async function refreshPlaylists() {
            playlists = await apiCall("/playlists");
            userPlaylists.replaceChildren();
            if (!playlists.length) {
                const empty = document.createElement("p");
                empty.className = "sidebar-playlists-empty";
                empty.textContent = "No playlists yet";
                userPlaylists.appendChild(empty);
            }
            playlists.forEach(playlist => {
                const item = document.createElement("button");
                item.type = "button";
                item.className = "nav-item sidebar-playlist";
                item.title = playlist.name;
                item.innerHTML = '<span class="nav-icon">♫</span><span></span>';
                item.querySelector("span:last-child").textContent = playlist.name;
                item.addEventListener("click", () => openPlaylist(playlist.id));
                userPlaylists.appendChild(item);
            });
        }

        async function openMyLibrary() {
            try {
                await refreshPlaylists();
                libraryList.replaceChildren();
                if (!playlists.length) {
                    const empty = document.createElement("p");
                    empty.className = "library-empty";
                    empty.textContent = "Create a playlist and it will appear here.";
                    libraryList.appendChild(empty);
                }
                playlists.forEach(playlist => {
                    const item = document.createElement("button");
                    item.type = "button";
                    item.className = "library-playlist-row";
                    const title = document.createElement("strong");
                    title.textContent = playlist.name;
                    const details = document.createElement("span");
                    details.textContent = `${playlist.songCount} ${playlist.songCount === 1 ? "song" : "songs"}`;
                    item.append(title, details);
                    item.addEventListener("click", () => openPlaylist(playlist.id));
                    libraryList.appendChild(item);
                });
                showLibrary("My Library");
            } catch (error) {
                showPlaybackNotice(error.message || "Could not load your library.");
            }
        }

        function renderArtistDirectory() {
            libraryList.replaceChildren();
            const artists = getTopArtists().slice(0, 20);
            if (!artists.length) {
                const empty = document.createElement("p");
                empty.className = "library-empty";
                empty.textContent = "No artists are available in your artist table.";
                libraryList.appendChild(empty);
                return;
            }
            artists.forEach((artist, index) => {
                const row = document.createElement("button");
                row.type = "button";
                row.className = "top-artist-row";
                row.title = artist.name;
                const avatar = document.createElement("span");
                avatar.className = `top-artist-avatar avatar-${String.fromCharCode(97 + (index % 5))}`;
                avatar.textContent = artist.name.trim().charAt(0).toUpperCase();
                applyArtistPhoto(avatar, artist);
                const name = document.createElement("strong");
                name.textContent = artist.name;
                const details = document.createElement("span");
                details.className = "top-artist-details";
                details.append(name);
                const arrow = document.createElement("span");
                arrow.className = "top-artist-arrow";
                arrow.textContent = "›";
                row.append(avatar, details, arrow);
                row.addEventListener("click", () => openArtistSongs(artist.name, true));
                libraryList.appendChild(row);
            });
        }

        async function openArtistSongs(artistName, fromTopArtists = false) {
            if (!artistName) return;
            try {
                const songs = await apiCall(`/songs/artist?name=${encodeURIComponent(artistName)}`);
                renderLibrarySongs(songs);
                if (fromTopArtists) {
                    const back = document.createElement("button");
                    back.type = "button";
                    back.className = "library-back-link";
                    back.textContent = "‹ Your top artists";
                    back.addEventListener("click", () => openLibrary("artists"));
                    libraryList.prepend(back);
                }
                showLibrary(`${artistName} songs`);
            } catch (error) {
                showPlaybackNotice(error.message || "Could not load artist songs.");
            }
        }

        async function openLibrary(kind) {
            if (!libraryView || !libraryList) return;
            try {
                if (kind === "recent") {
                    recentlyPlayed = await apiCall("/library/recent");
                    renderRecentlyPlayed();
                    renderTopArtists();
                    renderLibrarySongs(uniqueSongsById(recentlyPlayed).slice(0, 30), true);
                    showLibrary("Recently played");
                } else if (kind === "artists") {
                    await loadArtistDirectory();
                    recentlyPlayed = await apiCall("/library/recent");
                    renderTopArtists();
                    renderArtistDirectory();
                    showLibrary("Top 20 artists", "artists");
                } else {
                    renderLibrarySongs(allSongs.slice(0, 30), true);
                    showLibrary("Made for you");
                }
            } catch (error) {
                showPlaybackNotice(error.message || "Could not load songs.");
            }
        }

        async function openSaveToPlaylist() {
            if (!currentSong) {
                showPlaybackNotice("Play a song before saving it to a playlist.");
                return;
            }
            try {
                await refreshPlaylists();
                document.getElementById("savePlaylistSongTitle").textContent = currentSong.title || "Current song";
                savePlaylistOptions.replaceChildren();
                if (!playlists.length) {
                    const empty = document.createElement("p");
                    empty.className = "library-empty";
                    empty.textContent = "You don’t have a playlist yet.";
                    savePlaylistOptions.appendChild(empty);
                }
                playlists.forEach(playlist => {
                    const option = document.createElement("button");
                    option.type = "button";
                    option.className = "save-playlist-option";
                    option.textContent = playlist.name;
                    option.addEventListener("click", async () => {
                        try {
                            await apiCall(`/playlists/${playlist.id}/songs/${currentSong.id}`, { method: "POST" });
                            saveToPlaylistModal.classList.remove("open");
                            saveToPlaylistModal.setAttribute("aria-hidden", "true");
                            document.body.classList.remove("modal-open");
                            await refreshPlaylists();
                            showPlaybackNotice(`Saved to “${playlist.name}”`);
                        } catch (error) {
                            showPlaybackNotice(error.message || "Could not save song.");
                        }
                    });
                    savePlaylistOptions.appendChild(option);
                });
                saveToPlaylistModal.classList.add("open");
                saveToPlaylistModal.setAttribute("aria-hidden", "false");
                document.body.classList.add("modal-open");
            } catch (error) {
                showPlaybackNotice(error.message || "Could not load playlists.");
            }
        }

        function closeLibrary() {
            libraryView?.classList.remove("open");
            libraryView?.setAttribute("aria-hidden", "true");
            document.body.classList.remove("library-open");
        }

        function renderAccountPanel() {
            const rawUser = localStorage.getItem("melody_user");
            let user = {};
            try { user = JSON.parse(rawUser || "{}"); } catch (error) { user = {}; }
            libraryList.replaceChildren();

            const profile = document.createElement("div");
            profile.className = "library-account-profile";
            const avatar = document.createElement("span");
            avatar.className = "library-account-avatar";
            avatar.textContent = String(user.name || "U").trim().charAt(0).toUpperCase();
            const details = document.createElement("div");
            details.className = "library-account-details";
            const name = document.createElement("strong");
            name.textContent = user.name || "Melody listener";
            const email = document.createElement("span");
            email.textContent = user.email || "";
            details.append(name, email);
            profile.append(avatar, details);

            const history = document.createElement("button");
            history.type = "button";
            history.className = "library-account-action";
            const historyTitle = document.createElement("strong");
            historyTitle.textContent = "Listening history";
            const historySubtitle = document.createElement("span");
            historySubtitle.textContent = "Songs played in the last 30 days";
            const historyArrow = document.createElement("span");
            historyArrow.textContent = "›";
            history.append(historyTitle, historySubtitle, historyArrow);
            history.addEventListener("click", openAccountHistory);

            const signOut = document.createElement("button");
            signOut.type = "button";
            signOut.className = "library-account-signout";
            signOut.textContent = "Sign out";
            signOut.addEventListener("click", () => {
                const lastSongKey = getLastSongStorageKey();
                localStorage.removeItem("melody_token");
                localStorage.removeItem("melody_user");
                if (lastSongKey) localStorage.removeItem(lastSongKey);
                window.location.href = "index.html";
            });

            libraryList.append(profile, history, signOut);
            showLibrary("Your account");
        }

        async function openAccountHistory() {
            libraryList.replaceChildren();
            const back = document.createElement("button");
            back.type = "button";
            back.className = "library-back-link";
            back.textContent = "‹ Account";
            back.addEventListener("click", renderAccountPanel);
            libraryList.appendChild(back);
            const loading = document.createElement("p");
            loading.className = "library-empty";
            loading.textContent = "Loading your listening history…";
            libraryList.appendChild(loading);
            showLibrary("Listening history · Last 30 days");

            try {
                const response = await fetch(`${API_URL}/library/history`, { headers: getAuthHeaders() });
                if (response.status === 401) {
                    throw new Error("Your sign-in has expired. Please sign in again to view history.");
                }
                if (response.status === 403) {
                    throw new Error("You are signed in, but do not have permission to view this history.");
                }
                if (!response.ok) throw new Error("Could not load listening history.");
                const entries = await response.json();
                libraryList.replaceChildren(back);
                const historyGroups = groupHistoryByLocalDate(entries || []);
                if (!historyGroups.length) {
                    const empty = document.createElement("p");
                    empty.className = "library-empty";
                    empty.textContent = "No songs played in the last 30 days.";
                    libraryList.appendChild(empty);
                    return;
                }
                historyGroups.forEach((group, groupIndex) => {
                    const section = document.createElement("details");
                    section.className = "library-history-day";
                    section.open = group.label === "Today";
                    const summary = document.createElement("summary");
                    summary.className = "library-history-day-heading";
                    const label = document.createElement("strong");
                    label.textContent = group.label;
                    const count = document.createElement("small");
                    count.textContent = `${group.entries.length} ${group.entries.length === 1 ? "song" : "songs"}`;
                    summary.append(label, count);
                    const rows = document.createElement("div");
                    rows.className = "library-history-entries";
                    group.entries.forEach((entry, index) => {
                        const row = document.createElement("article");
                        row.className = "library-history-row";
                        const cover = document.createElement("span");
                        cover.className = `library-history-cover album-${((groupIndex + index) % 4) + 1}`;
                        cover.textContent = String(entry.title || "♫").trim().charAt(0).toUpperCase();
                        applySongThumbnail(cover, entry);
                        const song = document.createElement("span");
                        song.className = "library-history-song";
                        const title = document.createElement("strong");
                        title.textContent = entry.title || "Unknown title";
                        const artist = createArtistLink(entry.artist, "library-history-artist");
                        song.append(title, artist);
                        const playedAt = document.createElement("time");
                        const date = new Date(entry.playedAt);
                        playedAt.dateTime = entry.playedAt;
                        playedAt.textContent = Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                        row.append(cover, song, playedAt);
                        rows.appendChild(row);
                    });
                    section.append(summary, rows);
                    libraryList.appendChild(section);
                });
            } catch (error) {
                libraryList.replaceChildren(back);
                const message = document.createElement("p");
                message.className = "library-empty library-history-error";
                message.textContent = error.message || "Could not load listening history.";
                libraryList.appendChild(message);
            }
        }

        profileButton?.addEventListener("click", renderAccountPanel);
        document.querySelectorAll(".see-all[data-view]").forEach((button) => {
            button.addEventListener("click", () => openLibrary(button.dataset.view));
        });
        document.addEventListener("melody:open-artist", event => openArtistSongs(event.detail));
        const requestedArtist = new URLSearchParams(window.location.search).get("artist");
        if (requestedArtist) {
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete("artist");
            window.history.replaceState(null, "", cleanUrl);
            openArtistSongs(requestedArtist);
        }
        document.getElementById("myLibraryNav")?.addEventListener("click", event => {
            event.preventDefault();
            openMyLibrary();
        });
        document.querySelectorAll(".player-artist-link").forEach(button => {
            button.addEventListener("click", event => {
                event.stopPropagation();
                if (currentSong?.artist) openArtistSongs(currentSong.artist);
            });
        });
        ["compactSaveButton", "expandedSaveButton"].forEach(id => {
            document.getElementById(id)?.addEventListener("click", event => {
                event.stopPropagation();
                openSaveToPlaylist();
            });
        });
        document.getElementById("closeSavePlaylist")?.addEventListener("click", () => {
            saveToPlaylistModal.classList.remove("open");
            saveToPlaylistModal.setAttribute("aria-hidden", "true");
            document.body.classList.remove("modal-open");
        });
        document.getElementById("newPlaylistFromSave")?.addEventListener("click", () => {
            pendingSaveSongId = currentSong?.id || null;
            saveToPlaylistModal.classList.remove("open");
            saveToPlaylistModal.setAttribute("aria-hidden", "true");
            document.body.classList.remove("modal-open");
            openPlaylistModal();
        });
        libraryMinimize?.addEventListener("click", closeLibrary);
        libraryView?.addEventListener("click", (event) => {
            if (event.target === libraryView || event.target.matches("[data-close-library]")) closeLibrary();
        });
        document.querySelector(".hero-follow")?.addEventListener("click", (event) => {
            const button = event.currentTarget;
            button.textContent = button.textContent === "Follow" ? "Following" : "Follow";
            button.classList.toggle("is-following");
        });
        const maximizePlayer = document.getElementById("maximizePlayer");
        maximizePlayer?.addEventListener("click", (event) => {
            event.stopPropagation();
            openPlayer();
        });
        restoreLastPlayedSong();
        loadSongs();
        loadArtistDirectory().catch(error => console.error("Could not load artists:", error));
        refreshLikedSongs().catch(error => console.error("Could not load liked songs:", error));
        refreshPlaylists().catch(error => console.error("Could not load playlists:", error));
        apiCall("/library/recent")
            .then(songs => {
                recentlyPlayed = songs;
                renderRecentlyPlayed();
                renderTopArtists();
                if (!userSelectedSongThisSession && !currentSong && songs.length) {
                    restoreLastPlayedSong(songs[0]);
                    saveLastPlayedSong(songs[0]);
                }
            })
            .catch(error => console.error("Could not load listening history:", error));

    }
);

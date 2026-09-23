const API_URL = "http://localhost:8080/api";


/* =====================================================
   GLOBAL MUSIC STATE
===================================================== */

let allSongs = [];
let searchResults = [];
let searchRequestId = 0;
let currentSongIndex = -1;
let currentSong = null;
let recentlyPlayed = [];
let playlists = [];
let likedSongs = [];
let likedSongIds = new Set();
let pendingSaveSongId = null;


/* =====================================================
   AUTH TOKEN
===================================================== */

function getToken() {
    return localStorage.getItem("melody_token");
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

        if (response.status === 401 ||
            response.status === 403) {

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

        if (response.status === 401 ||
            response.status === 403) {

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
        const info = document.createElement("span");
        info.className = "search-result-info";
        const title = document.createElement("strong");
        title.textContent = song.title || "Unknown title";
        const artist = document.createElement("small");
        artist.textContent = song.artist || "Unknown artist";
        info.append(title, artist);
        const play = document.createElement("span");
        play.className = "search-result-play";
        play.textContent = "▶";
        row.append(cover, info, play);
        row.addEventListener("click", () => playSong(song));
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

    if (response.status === 401 || response.status === 403) {
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

    const uniqueRecentSongs = [...new Map(recentlyPlayed.map(song => [song.id, song])).values()].slice(0, 4);
    uniqueRecentSongs.forEach((song, index) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "recent-card";
        const cover = document.createElement("span");
        cover.className = `album-small album-${(index % 4) + 1}`;
        cover.textContent = "♫";
        if (song.thumbnailUrl) {
            cover.style.backgroundImage = `url("${getFullUrl(song.thumbnailUrl)}")`;
            cover.style.backgroundSize = "cover";
            cover.style.backgroundPosition = "center";
            cover.textContent = "";
        }
        const info = document.createElement("span");
        info.className = "song-info";
        const title = document.createElement("strong");
        title.textContent = song.title || "Unknown title";
        const artist = document.createElement("span");
        artist.textContent = song.artist || "Unknown artist";
        info.append(title, artist);
        card.append(cover, info);
        card.addEventListener("click", () => playSong(song));
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

            description.textContent =
                song.artist || "Unknown artist";
        }


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

                playSong(song);

            }
        );


        const playButton =
            card.querySelector(".play-button");


        if (playButton) {

            playButton.addEventListener(
                "click",
                function (event) {

                    event.stopPropagation();

                    playSong(song);

                }
            );
        }
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

async function playSong(song) {

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


    currentSong = song;


    /*
     * Find song inside the complete database list.
     */
    const index =
        allSongs.findIndex(
            item => item.id === song.id
        );


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

            if (response.status === 401 || response.status === 403) {
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
        recentlyPlayed = [song, ...recentlyPlayed];
        renderRecentlyPlayed();
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


    if (playerCover) {

        if (song.thumbnailUrl) {

            playerCover.style.backgroundImage =
                `url("${getFullUrl(song.thumbnailUrl)}")`;

            playerCover.style.backgroundSize =
                "cover";

            playerCover.style.backgroundPosition =
                "center";

            playerCover.textContent = "";

        } else {

            playerCover.style.backgroundImage =
                "";

            playerCover.textContent = "♫";
        }
    }


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


    if (expandedCover) {

        if (song.thumbnailUrl) {

            expandedCover.style.backgroundImage =
                `url("${getFullUrl(song.thumbnailUrl)}")`;

            expandedCover.style.backgroundSize =
                "cover";

            expandedCover.style.backgroundPosition =
                "center";

            expandedCover.textContent = "";

        } else {

            expandedCover.style.backgroundImage =
                "";

            expandedCover.textContent = "♫";
        }
    }
    updatePlayerLikeButtons(likedSongIds.has(song.id));
}


function updatePlayerLikeButtons(isLiked) {
    ["playerLikeButton", "expandedLikeButton"].forEach(id => {
        const button = document.getElementById(id);
        if (!button) return;
        button.classList.toggle("liked", isLiked);
        button.textContent = isLiked ? "♥" : "♡";
        button.setAttribute("aria-pressed", String(isLiked));
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
        const number = document.createElement("span");
        number.className = "liked-number";
        number.textContent = String(index + 1);
        const cover = document.createElement("div");
        cover.className = `liked-cover album-${(index % 4) + 1}`;
        cover.textContent = "♫";
        const info = document.createElement("div");
        info.className = "liked-song";
        const title = document.createElement("h3");
        title.textContent = song.title || "Unknown title";
        const artist = document.createElement("p");
        artist.textContent = song.artist || "Unknown artist";
        info.append(title, artist);
        const unlike = document.createElement("button");
        unlike.type = "button";
        unlike.className = "liked-heart active";
        unlike.textContent = "♥";
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
        row.append(number, cover, info, unlike);
        row.addEventListener("click", () => playSong(song));
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

        if (allSongs.length > 0) {

            playSong(allSongs[0]);

        }

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

        compactPlay.textContent =
            isPlaying ? "❚❚" : "▶";
    }


    if (expandedPlay) {

        expandedPlay.textContent =
            isPlaying ? "❚❚" : "▶";
    }
}


/* =====================================================
   PREVIOUS SONG
===================================================== */

function playPreviousSong() {

    if (!allSongs.length) {
        return;
    }


    if (currentSongIndex <= 0) {

        currentSongIndex =
            allSongs.length - 1;

    } else {

        currentSongIndex--;
    }


    playSong(
        allSongs[currentSongIndex]
    );
}


/* =====================================================
   NEXT SONG
===================================================== */

function playNextSong() {

    if (!allSongs.length) {
        return;
    }


    if (
        currentSongIndex < 0 ||
        currentSongIndex >= allSongs.length - 1
    ) {

        currentSongIndex = 0;

    } else {

        currentSongIndex++;
    }


    playSong(
        allSongs[currentSongIndex]
    );
}


/* =====================================================
   AUTO NEXT
===================================================== */

if (audioPlayer) {

    audioPlayer.addEventListener(
        "ended",
        function () {

            playNextSong();

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


        const collaborateToggle =
            document.getElementById(
                "collaborateToggle"
            );


        const privacySelect =
            document.getElementById(
                "privacySelect"
            );


        const privacyValue =
            document.getElementById(
                "privacyValue"
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
                                privacy: privacyValue.textContent,
                                collaborate: collaborateToggle.classList.contains("on")
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
           COLLABORATE
        ================================================= */

        if (collaborateToggle) {

            collaborateToggle.addEventListener(
                "click",
                () => {

                    const enabled =
                        collaborateToggle.classList.toggle(
                            "on"
                        );


                    collaborateToggle.setAttribute(
                        "aria-pressed",
                        String(enabled)
                    );
                }
            );
        }


        /* =================================================
           PRIVACY
        ================================================= */

        if (privacySelect) {

            privacySelect.addEventListener(
                "click",
                () => {

                    const isPublic =
                        privacyValue.textContent ===
                        "Public";


                    privacyValue.textContent =
                        isPublic
                            ? "Private"
                            : "Public";
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
                button.textContent = muted ? "🔇" : "🔊";
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

        document.querySelectorAll(".volume").forEach((control) => control.addEventListener("click", (event) => event.stopPropagation()));

        /* Persistent library, playlists, and artist discography views. */
        const libraryView = document.getElementById("libraryView");
        const libraryTitle = document.getElementById("libraryTitle");
        const libraryList = document.getElementById("libraryList");
        const libraryMinimize = document.getElementById("libraryMinimize");
        const userPlaylists = document.getElementById("userPlaylists");
        const saveToPlaylistModal = document.getElementById("saveToPlaylistModal");
        const savePlaylistOptions = document.getElementById("savePlaylistOptions");

        function showLibrary(title) {
            libraryTitle.textContent = title;
            libraryView.classList.add("open");
            libraryView.setAttribute("aria-hidden", "false");
            document.body.classList.add("library-open");
        }

        function renderLibrarySongs(songs) {
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
                const number = document.createElement("span");
                number.className = "liked-number";
                number.textContent = String(index + 1);
                const cover = document.createElement("div");
                cover.className = `album-small album-${(index % 4) + 1}`;
                cover.textContent = "♫";
                if (song.thumbnailUrl) {
                    cover.style.backgroundImage = `url("${getFullUrl(song.thumbnailUrl)}")`;
                    cover.style.backgroundSize = "cover";
                }
                const info = document.createElement("div");
                info.className = "song-info";
                const title = document.createElement("h3");
                title.textContent = song.title || "Unknown title";
                const artist = document.createElement("p");
                artist.textContent = song.artist || "Unknown artist";
                info.append(title, artist);
                const play = document.createElement("span");
                play.className = "library-play";
                play.textContent = "▶";
                row.append(number, cover, info, play);
                row.addEventListener("click", () => playSong(song));
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
                renderLibrarySongs(detail.songs || []);
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

        async function openArtistSongs(artistName) {
            if (!artistName) return;
            try {
                const songs = await apiCall(`/songs/artist?name=${encodeURIComponent(artistName)}`);
                renderLibrarySongs(songs);
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
                    renderLibrarySongs(recentlyPlayed);
                    showLibrary("Recently played");
                } else {
                    renderLibrarySongs(allSongs);
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
        document.querySelectorAll(".see-all[data-view]").forEach((button) => {
            button.addEventListener("click", () => openLibrary(button.dataset.view));
        });
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
        loadSongs();
        refreshLikedSongs().catch(error => console.error("Could not load liked songs:", error));
        refreshPlaylists().catch(error => console.error("Could not load playlists:", error));
        apiCall("/library/recent")
            .then(songs => { recentlyPlayed = songs; renderRecentlyPlayed(); })
            .catch(error => console.error("Could not load listening history:", error));

    }
);

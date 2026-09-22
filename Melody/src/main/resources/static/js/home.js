const API_URL = "http://localhost:8080/api";


/* =====================================================
   GLOBAL MUSIC STATE
===================================================== */

let allSongs = [];
let searchResults = [];
let currentSongIndex = -1;
let currentSong = null;


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

    if (url.startsWith("http://") ||
        url.startsWith("https://")) {

        return url;
    }

    return "http://localhost:8080" + url;
}


/* =====================================================
   SEARCH SONGS
===================================================== */

async function searchSongs(query) {

    const text = query.trim();

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

    const recentGrid =
        document.querySelector(".recent-grid");

    const recentTitle =
        document.querySelector(
            ".section:first-of-type .section-header h2"
        );

    if (!recentGrid) {
        return;
    }

    if (!songs || songs.length === 0) {

        if (recentTitle) {
            recentTitle.textContent = "Search results";
        }

        recentGrid.innerHTML = `
            <div class="recent-card">
                <div class="song-info">
                    <h3>No songs found</h3>
                    <p>Try another song, artist or album.</p>
                </div>
            </div>
        `;

        return;
    }


    if (recentTitle) {
        recentTitle.textContent = "Search results";
    }


    recentGrid.innerHTML = "";


    songs.forEach((song, index) => {

        const card =
            document.createElement("div");

        card.className = "recent-card";

        card.dataset.songIndex = index;

        const album =
            document.createElement("div");

        album.className =
            "album-small album-1";

        album.textContent = "♫";


        const info =
            document.createElement("div");

        info.className = "song-info";


        const title =
            document.createElement("h3");

        title.textContent =
            song.title || "Unknown title";


        const artist =
            document.createElement("p");

        artist.textContent =
            song.artist || "Unknown artist";


        info.appendChild(title);
        info.appendChild(artist);

        card.appendChild(album);
        card.appendChild(info);


        card.addEventListener(
            "click",
            function () {

                playSong(song);

            }
        );


        recentGrid.appendChild(card);
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


/* =====================================================
   PLAY SONG
===================================================== */

function playSong(song) {

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


    const audioUrl =
        getFullUrl(song.audioUrl);


    console.log(
        "Playing song:",
        song.title
    );

    console.log(
        "Audio URL:",
        audioUrl
    );


    audioPlayer.src = audioUrl;

    audioPlayer.load();


    audioPlayer.play()
        .then(() => {

            updatePlayerUI(song);

            updatePlayButtons(true);

        })
        .catch(error => {

            console.error(
                "Audio playback failed:",
                error
            );

        });
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

    const playerArtist =
        document.querySelector(
            ".now-playing p"
        );


    if (playerTitle) {
        playerTitle.textContent = title;
    }


    if (playerArtist) {
        playerArtist.textContent = artist;
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

    const expandedArtist =
        document.querySelector(
            ".expanded-song-info p"
        );


    if (expandedTitle) {
        expandedTitle.textContent = title;
    }


    if (expandedArtist) {
        expandedArtist.textContent = artist;
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


                    searchTimer =
                        setTimeout(
                            () => {

                                searchSongs(
                                    searchInput.value
                                );

                            },
                            300
                        );
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

        let liked = false;


        function updateLikeButtons() {

            if (playerLikeButton) {

                playerLikeButton.classList.toggle(
                    "liked",
                    liked
                );


                playerLikeButton.textContent =
                    liked ? "♥" : "♡";
            }


            if (expandedLikeButton) {

                expandedLikeButton.classList.toggle(
                    "liked",
                    liked
                );


                expandedLikeButton.textContent =
                    liked ? "♥" : "♡";
            }
        }


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

                        liked = !liked;

                        updateLikeButtons();
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
                closePlaylistModal
            );
        }


        if (createPlaylist) {

            createPlaylist.addEventListener(
                "click",
                () => {

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


                    console.log(
                        "Playlist created:",
                        {
                            name: name,

                            description:
                                descriptionInput.value.trim(),

                            privacy:
                                privacyValue.textContent,

                            collaborate:
                                collaborateToggle.classList.contains(
                                    "on"
                                )
                        }
                    );


                    nameInput.value = "";

                    descriptionInput.value = "";

                    closePlaylistModal();
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

        loadSongs();

    }
);
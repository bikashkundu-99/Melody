const API_URL = "http://localhost:8080/api";
async function searchSongs(query) {

    if (!query.trim()) {
        return;
    }

    try {

        const response =
            await fetch(
                `${API_URL}/songs/search?q=${encodeURIComponent(query)}`
            );

        if (!response.ok) {
            throw new Error("Search failed");
        }

        const songs =
            await response.json();

        console.log("Search results:", songs);

        displaySearchResults(songs);

    } catch (error) {

        console.error(
            "Music search error:",
            error
        );
    }
}

const audioPlayer =
    document.getElementById("audioPlayer");

function playSong(song) {

    audioPlayer.src =
        song.audioUrl;

    audioPlayer.play();

    console.log(
        "Playing:",
        song.title
    );
}

const searchInput = document.getElementById("searchInput");
if (searchInput) {
    searchInput.addEventListener( "input",
        () => {
            searchSongs(searchInput.value);
        }
    );
}

function openAccountPage() {
    const userData = localStorage.getItem("melody_user");

    if (!userData) {
        window.location.href = "index.html";
        return;
    }

    window.location.href = "account.html";
}


document.addEventListener("DOMContentLoaded", () => {

    /* ================= PROFILE ================= */

    const userData = localStorage.getItem("melody_user");
    const profileButton = document.getElementById("profileButton");

    if (profileButton && userData) {
        try {
            const user = JSON.parse(userData);

            if (user.name) {
                profileButton.textContent =
                    user.name.trim().charAt(0).toUpperCase();
            }

        } catch (error) {
            console.error("Unable to load profile:", error);
        }
    }


    /* ================= ELEMENTS ================= */

    const playerBar =
        document.getElementById("playerBar");

    const expandedPlayer =
        document.getElementById("expandedPlayer");

    const collapsePlayer =
        document.getElementById("collapsePlayer");

    const playerLikeButton =
        document.getElementById("playerLikeButton");

    const expandedLikeButton =
        document.getElementById("expandedLikeButton");

    const createPlaylistNav =
        document.getElementById("createPlaylistNav");

    const likedSongsNav =
        document.getElementById("likedSongsNav");

    const homeNav =
        document.getElementById("homeNav");

    const playlistModal =
        document.getElementById("playlistModal");

    const likedSongsModal =
        document.getElementById("likedSongsModal");

    const cancelPlaylist =
        document.getElementById("cancelPlaylist");

    const createPlaylist =
        document.getElementById("createPlaylist");

    const closeLikedSongs =
        document.getElementById("closeLikedSongs");

    const collaborateToggle =
        document.getElementById("collaborateToggle");

    const privacySelect =
        document.getElementById("privacySelect");

    const privacyValue =
        document.getElementById("privacyValue");


    /* ================= PLAYER ================= */

    function openPlayer() {

        if (!expandedPlayer) return;

        expandedPlayer.classList.add("open");

        expandedPlayer.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "player-open"
        );
    }


    function closePlayer() {

        if (!expandedPlayer) return;

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


    if (collapsePlayer) {

        collapsePlayer.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                closePlayer();
            }
        );
    }


    /* ================= LIKE BUTTON ================= */

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
    ].forEach((button) => {

        if (!button) return;

        button.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                liked = !liked;

                updateLikeButtons();
            }
        );
    });


    /* ================= CREATE PLAYLIST ================= */

    function openPlaylistModal() {

        if (!playlistModal) return;

        playlistModal.classList.add("open");

        playlistModal.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "modal-open"
        );

        document
            .getElementById("playlistName")
            ?.focus();
    }


    function closePlaylistModal() {

        if (!playlistModal) return;

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


    /* ================= COLLABORATE ================= */

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


    /* ================= PRIVACY ================= */

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


    /* ================= LIKED SONGS ================= */

    function openLikedSongs() {

        if (!likedSongsModal) return;

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

        if (!likedSongsModal) return;

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


    /* ================= LIKED SONG HEARTS ================= */

    document
        .querySelectorAll(".liked-heart")
        .forEach((button) => {

            button.addEventListener(
                "click",
                () => {

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
        });


    /* ================= HOME NAV ================= */

    /* ================= HOME NAV ================= */

    if (homeNav) {

        homeNav.addEventListener("click", () => {

            // Close any open panels
            closeLikedSongsPanel();
            closePlaylistModal();
            closePlayer();

            // Return to the Home page
            window.location.href = "home.html";
        });
    }


    /* ================= ESCAPE KEY ================= */

    document.addEventListener("keydown", (event) => {

        if (event.key === "Escape") {

            if (
                expandedPlayer &&
                expandedPlayer.classList.contains("open")
            ) {
                closePlayer();
            }
        }
    });

});
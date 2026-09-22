/* =====================================================
   ACCOUNT PAGE
===================================================== */


/* =====================================================
   GET LOGGED-IN USER
===================================================== */

function getLoggedInUser() {

    const userData =
        localStorage.getItem("melody_user");

    if (!userData) {
        return null;
    }

    try {

        return JSON.parse(userData);

    } catch (error) {

        console.error(
            "Invalid user data:",
            error
        );

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

function openHistory() {

    /*
     * History page will be implemented later.
     */

    alert(
        "History will be added next."
    );
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
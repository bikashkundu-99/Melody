/* =====================================================
API CONFIGURATION
===================================================== */

const API_URL = "http://localhost:8080/api/auth";

/* =====================================================
HELPER
===================================================== */

function hideAllForms() {

    document.getElementById("loginForm").classList.remove("active");
    document.getElementById("signupForm").classList.remove("active");
    document.getElementById("forgotForm").classList.remove("active");
}

function resetTabs() {

    document.getElementById("loginTab").classList.remove("active");
    document.getElementById("signupTab").classList.remove("active");
}

/* =====================================================
LOGIN FORM
===================================================== */

function showLogin() {

    hideAllForms();
    resetTabs();
    document.getElementById("loginForm").classList.add("active");
    document.getElementById("loginTab").classList.add("active");
    clearMessage();

}

/* =====================================================
SIGN UP FORM
===================================================== */

function showSignup() {

    hideAllForms();
    resetTabs();
    document.getElementById("signupForm").classList.add("active");
    document.getElementById("signupTab").classList.add("active");
    clearMessage();

}

/* =====================================================
FORGOT PASSWORD FORM
===================================================== */

function showForgot() {
    hideAllForms();
    resetTabs();
    document.getElementById("forgotForm").classList.add("active");
    clearMessage();

}

/* =====================================================
LOGIN ACTION
===================================================== */

async function login() {

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;


    /* ---------- Validation ---------- */

    if (!email || !password) {

        showMessage("Please enter your email and password.","error");
        return;
    }

    if (!isValidEmail(email)) {

        showMessage("Please enter a valid email address.","error");
        return;
    }


/* ---------- API Call ---------- */

    try {
        const response =
            await fetch(
                `${API_URL}/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                }
            );
        const data =  await response.json();

        /* ---------- Error ---------- */

        if (!response.ok) {
            showMessage( data.message || "Invalid email or password.", "error");
            return;
        }


        /* ---------- Save Login ---------- */

        localStorage.setItem("melody_token",data.token);
        localStorage.setItem("melody_user",
            JSON.stringify(
                {
                    id: data.userId,
                    name: data.name,
                    email: data.email,
                    createdAt: data.createdAt
                }) );


        showMessage("Login successful!","success");

        /* ---------- Redirect ---------- */
        setTimeout(() => {
            window.location.href = "home.html";
        }, 700);

    }
    catch (error) {
        console.error(error);
        showMessage("Cannot connect to Melody server.","error");
    }

}

/* =====================================================
SIGN UP ACTION
===================================================== */

async function signup() {

const name =
    document
        .getElementById("signupName")
        .value
        .trim();


const email =
    document
        .getElementById("signupEmail")
        .value
        .trim();


const password =
    document
        .getElementById("signupPassword")
        .value;


const confirmPassword =
    document
        .getElementById("confirmPassword")
        .value;


/* ---------- Validation ---------- */

if (
    !name ||
    !email ||
    !password ||
    !confirmPassword
) {

    showMessage(
        "Please fill in all fields.",
        "error"
    );

    return;
}


if (!isValidEmail(email)) {

    showMessage(
        "Please enter a valid email address.",
        "error"
    );

    return;
}


if (password.length < 6) {

    showMessage(
        "Password must contain at least 6 characters.",
        "error"
    );

    return;
}


if (password !== confirmPassword) {

    showMessage(
        "Passwords do not match.",
        "error"
    );

    return;
}


/* ---------- API Call ---------- */

try {

    const response =
        await fetch(
            `${API_URL}/register`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    name: name,
                    email: email,
                    password: password
                })
            }
        );


    const data =
        await response.json();


    /* ---------- Error ---------- */

    if (!response.ok) {

        showMessage(
            data.message ||
            "Registration failed.",
            "error"
        );

        return;
    }


    /* ---------- Success ---------- */

    showMessage(
        "Account created successfully!",
        "success"
    );


    setTimeout(() => {

        showLogin();

        document
            .getElementById("loginEmail")
            .value = email;

    }, 1000);

}
catch (error) {

    console.error(error);

    showMessage(
        "Cannot connect to Melody server.",
        "error"
    );
}

}

/* =====================================================
FORGOT PASSWORD
===================================================== */

async function resetPassword() {

const email =
    document
        .getElementById("forgotEmail")
        .value
        .trim();


/* ---------- Validation ---------- */

if (!email) {

    showMessage(
        "Please enter your email.",
        "error"
    );

    return;
}


if (!isValidEmail(email)) {

    showMessage(
        "Please enter a valid email address.",
        "error"
    );

    return;
}


/* ---------- API Call ---------- */

try {

    const response =
        await fetch(
            `${API_URL}/forgot-password`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    email: email
                })
            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        showMessage(
            data.message ||
            "Unable to process password reset.",
            "error"
        );

        return;
    }


    showMessage(
        data.message ||
        "Password reset link has been sent.",
        "success"
    );

}
catch (error) {

    console.error(error);

    showMessage(
        "Cannot connect to Melody server.",
        "error"
    );
}

}

/* =====================================================
GOOGLE LOGIN
===================================================== */

function googleLogin() {

showMessage(
    "Google login will be connected later.",
    "error"
);

}

/* =====================================================
EMAIL VALIDATION
===================================================== */

function isValidEmail(email) {

return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

}

/* =====================================================
MESSAGE
===================================================== */

function showMessage(message, type) {

const element =
    document.getElementById("message");


element.textContent = message;


element.className =
    "message show " + type;

}

function clearMessage() {

const element =
    document.getElementById("message");


element.textContent = "";


element.className = "message";

}
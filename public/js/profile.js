
"use strict";

console.log("PROFILE JS LOADED");

// ===============================
// V MART - PROFILE ELEMENTS
// ===============================

const profileForm = document.getElementById("profileForm");

const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const phoneInput = document.getElementById("phone");

const editBtn = document.getElementById("editProfileBtn");
const updateBtn = document.getElementById("updateProfileBtn");
const logoutBtn = document.getElementById("logoutBtn");

const message = document.getElementById("profileMessage");


// ===============================
// GET CUSTOMER TOKEN
// ===============================

function getToken() {
    return (
        localStorage.getItem("token") ||
        localStorage.getItem("customerToken") ||
        sessionStorage.getItem("token") ||
        sessionStorage.getItem("customerToken") ||
        ""
    );
}


// ===============================
// SHOW MESSAGE
// ===============================

function showMessage(text, success = true) {
    message.textContent = text;
    message.style.display = "block";
    message.style.color = success ? "green" : "red";
}


// ===============================
// EDIT MODE
// ===============================

function setEditMode(enabled) {

    nameInput.readOnly = !enabled;
    phoneInput.readOnly = !enabled;

    updateBtn.disabled = !enabled;

    editBtn.textContent = enabled
        ? "Cancel Edit"
        : "Edit Profile";

    if (!enabled) {
        loadProfile();
    }
}


// ===============================
// LOGOUT CUSTOMER
// ===============================

function logoutCustomer() {

    localStorage.removeItem("token");
    localStorage.removeItem("customerToken");
    localStorage.removeItem("customer");

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("customerToken");

    window.location.href = "login.html";
}


// ===============================
// LOAD PROFILE
// ===============================

async function loadProfile() {

    const token = getToken();

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    try {

        const response = await fetch("/api/auth/me", {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        if (response.status === 401) {
            logoutCustomer();
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to load profile.");
        }

        const customer = await response.json();

        nameInput.value =
            customer.name ||
            customer.fullName ||
            "";

        emailInput.value = customer.email || "";

        phoneInput.value = customer.phone || "";

        nameInput.readOnly = true;
        phoneInput.readOnly = true;

        updateBtn.disabled = true;

        editBtn.textContent = "Edit Profile";

    } catch (error) {

        console.error("Profile loading error:", error);

        showMessage(error.message, false);
    }
}


// ===============================
// EDIT PROFILE BUTTON
// ===============================

editBtn.addEventListener("click", function () {

    if (nameInput.readOnly && phoneInput.readOnly) {

        nameInput.readOnly = false;
        phoneInput.readOnly = false;

        updateBtn.disabled = false;

        editBtn.textContent = "Cancel Edit";

        showMessage("You can now edit your profile details.");

        nameInput.focus();

    } else {

        // Cancel editing and reload original details

        loadProfile();

        message.style.display = "none";
    }
});


// ===============================
// UPDATE PROFILE
// ===============================

profileForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const token = getToken();

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();

    if (!name) {
        showMessage("Please enter your name.", false);
        nameInput.focus();
        return;
    }

    updateBtn.disabled = true;
    updateBtn.textContent = "Updating...";

    try {

        const response = await fetch("/api/profile", {

            method: "PUT",

            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },

            body: JSON.stringify({
                name: name,
                phone: phone
            })
        });

        const data = await response.json();

        if (response.status === 401) {
            logoutCustomer();
            return;
        }

        if (!response.ok) {
            throw new Error(
                data.message || "Profile update failed."
            );
        }

        // Update local customer information

        let customer = {};

        try {
            customer = JSON.parse(
                localStorage.getItem("customer") || "{}"
            );
        } catch (error) {
            customer = {};
        }

        customer.name = name;
        customer.fullName = name;
        customer.phone = phone;

        localStorage.setItem(
            "customer",
            JSON.stringify(customer)
        );

        // Return to view mode

        nameInput.readOnly = true;
        phoneInput.readOnly = true;

        updateBtn.disabled = true;
        editBtn.textContent = "Edit Profile";

        updateBtn.textContent = "Update Profile";

        showMessage(
            data.message || "Profile updated successfully!",
            true
        );

        await loadProfile();

    } catch (error) {

        console.error("Profile update error:", error);

        showMessage(error.message, false);

        updateBtn.disabled = false;

    } finally {

        updateBtn.textContent = "Update Profile";
    }
});


// ===============================
// LOGOUT BUTTON
// ===============================

logoutBtn.addEventListener("click", function () {

    const confirmed = confirm(
        "Are you sure you want to logout from V Mart?"
    );

    if (confirmed) {
        logoutCustomer();
    }
});


// ===============================
// LOAD PROFILE WHEN PAGE OPENS
// ===============================

document.addEventListener("DOMContentLoaded", function () {
    loadProfile();
});

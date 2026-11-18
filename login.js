"use strict";

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("loginForm");

    if (!form) {
        console.error("Login form not found");
        return;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        if (!email || !password) {
            alert("Please enter email and password.");
            return;
        }

        try {

            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    password
                })
            });

            const data = await response.json();

            console.log("Login response:", data);

            if (!response.ok) {
                alert(data.message || "Login failed.");
                return;
            }

            // Save login permanently in this browser
            localStorage.setItem("token", data.token);

            localStorage.setItem(
                "customer",
                JSON.stringify(data.customer)
            );

            alert("Login successful!");

            // Go to home page
            window.location.href = "index.html";

        } catch (error) {

            console.error("LOGIN ERROR:", error);

            alert("Unable to login. Please try again.");
        }
    });

});
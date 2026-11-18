
"use strict";

// ============================================================
// V MART - CUSTOMER SESSION
// ============================================================

// ============================================================
// GET TOKEN
// ============================================================

function getToken() {
    return (
        localStorage.getItem("token") ||
        localStorage.getItem("customerToken") ||
        sessionStorage.getItem("token") ||
        sessionStorage.getItem("customerToken") ||
        ""
    );
}

window.getToken = getToken;


// ============================================================
// COMMON API FUNCTION
// ============================================================

async function api(endpoint, options = {}) {
    const token = getToken();

    const headers = { ...(options.headers || {}) };

    if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers["Authorization"] = "Bearer " + token;
    }

    let url = endpoint.startsWith("/")
        ? endpoint
        : "/" + endpoint;

    if (!url.startsWith("/api")) {
        url = "/api" + url;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("customerToken");
        localStorage.removeItem("customer");

        if (!location.pathname.endsWith("login.html")) {
            location.href = "/login.html";
        }

        throw new Error(data.message || "Login required.");
    }

    if (!response.ok) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}

window.api = api;


// ============================================================
// LOAD CUSTOMER
// ============================================================

async function loadCustomer() {
    const token = getToken();

    if (!token) return null;

    try {
        const response = await fetch("/api/auth/me", {
            method: "GET",
            headers: {
                Authorization: "Bearer " + token
            }
        });

        if (!response.ok) return null;

        const data = await response.json();

        const customer = data.customer || data;

        localStorage.setItem(
            "customer",
            JSON.stringify(customer)
        );

        return customer;

    } catch (error) {
        console.error("Customer loading error:", error);
        return null;
    }
}

window.loadCustomer = loadCustomer;


// ============================================================
// LOGIN REQUIRED
// ============================================================

async function loginRequired() {
    if (!getToken()) {
        location.href = "/login.html";
        return null;
    }

    const customer = await loadCustomer();

    if (!customer) {
        location.href = "/login.html";
        return null;
    }

    return customer;
}

window.loginRequired = loginRequired;


// ============================================================
// ADD PRODUCT TO CART
// ============================================================

async function addToCart(
    productId,
    selectedSize = "",
    selectedColor = ""
) {
    const token = getToken();

    if (!token) {
        alert("Please login first.");
        location.href = "/login.html";
        return;
    }

    if (selectedSize && typeof selectedSize === "object") {
        selectedSize = selectedSize.value || "";
    }

    if (selectedColor && typeof selectedColor === "object") {
        selectedColor = selectedColor.value || "";
    }

    selectedSize = String(selectedSize || "").trim();
    selectedColor = String(selectedColor || "").trim();

    try {
        const response = await fetch("/api/cart", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token
            },
            body: JSON.stringify({
                productId: Number(productId),
                quantity: 1,
                size: selectedSize,
                color: selectedColor,
                selectedSize: selectedSize,
                selectedColor: selectedColor
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            alert(data.message || "Unable to add product.");
            return;
        }

        alert(data.message || "Product added to cart.");

        await updateCartCount();

    } catch (error) {
        console.error("Cart error:", error);
        alert("Unable to connect to server.");
    }
}

async function addCart(productId, size = "", color = "") {
    return addToCart(productId, size, color);
}

window.addToCart = addToCart;
window.addCart = addCart;


// ============================================================
// ADD PRODUCT TO WISHLIST
// ============================================================

async function addWishlist(productId) {
    const token = getToken();

    if (!token) {
        alert("Please login first.");
        location.href = "/login.html";
        return;
    }

    try {
        const response = await fetch("/api/wishlist", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token
            },
            body: JSON.stringify({
                productId: Number(productId)
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            alert(data.message || "Unable to add wishlist.");
            return;
        }

        alert(data.message || "Added to wishlist.");

        await updateWishlistCount();

    } catch (error) {
        console.error("Wishlist error:", error);
        alert("Unable to add wishlist.");
    }
}

window.addWishlist = addWishlist;


// ============================================================
// UPDATE CART COUNT
// ============================================================

async function updateCartCount() {
    const elements = document.querySelectorAll(".cart-count");

    if (!getToken()) {
        elements.forEach(el => el.textContent = "0");
        return;
    }

    try {
        const response = await fetch("/api/cart", {
            method: "GET",
            headers: {
                Authorization: "Bearer " + getToken()
            }
        });

        if (!response.ok) return;

        const cart = await response.json();

        const count = Array.isArray(cart)
            ? cart.reduce((sum, item) => {
                return sum + Math.max(
                    0,
                    Number(item.quantity) || 0
                );
            }, 0)
            : 0;

        elements.forEach(el => {
            el.textContent = String(count);
        });

    } catch (error) {
        console.error("Cart count error:", error);
    }
}

window.updateCartCount = updateCartCount;


// ============================================================
// UPDATE WISHLIST COUNT
// ============================================================

async function updateWishlistCount() {
    const elements = document.querySelectorAll(".wishlist-count");

    if (!getToken()) {
        elements.forEach(el => el.textContent = "0");
        return;
    }

    try {
        const response = await fetch("/api/wishlist", {
            method: "GET",
            headers: {
                Authorization: "Bearer " + getToken()
            }
        });

        if (!response.ok) return;

        const wishlist = await response.json();

        const count = Array.isArray(wishlist)
            ? wishlist.length
            : 0;

        elements.forEach(el => {
            el.textContent = String(count);
        });

    } catch (error) {
        console.error("Wishlist count error:", error);
    }
}

window.updateWishlistCount = updateWishlistCount;


// ============================================================
// LOGOUT
// ============================================================

async function logout() {
    const token = getToken();

    if (token) {
        try {
            await fetch("/api/auth/logout", {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + token
                }
            });

        } catch (error) {
            console.error("Logout error:", error);
        }
    }

    localStorage.removeItem("token");
    localStorage.removeItem("customerToken");
    localStorage.removeItem("customer");

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("customerToken");

    location.href = "/login.html";
}

window.logout = logout;


// ============================================================
// UPDATE CUSTOMER HEADER
// ============================================================

async function updateCustomerHeader() {

    const customer = await loadCustomer();

    // Select profile/login links except Categories page links.
    // Both Categories profile links will always display My Profile.

    const profileLinks = document.querySelectorAll(
        'a[href="profile.html"]:not(.categories-profile-link), ' +
        'a[href="/profile.html"]:not(.categories-profile-link), ' +
        'a[href="login.html"]:not(.categories-profile-link), ' +
        'a[href="/login.html"]:not(.categories-profile-link)'
    );

    profileLinks.forEach(link => {

        if (customer) {

            const name =
                customer.name ||
                customer.Name ||
                customer.fullName ||
                customer.customerName ||
                "Customer";

            link.textContent = name;
            link.href = "/profile.html";
            link.title = "My Profile";

        } else {

            link.textContent = "Login";
            link.href = "/login.html";
            link.title = "Login";

        }

    });

    // Update cart and wishlist counts.

    await updateCartCount();
    await updateWishlistCount();
}

window.updateCustomerHeader = updateCustomerHeader;


// ============================================================
// PAGE LOAD
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    updateCustomerHeader();
});





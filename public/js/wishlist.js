
"use strict";

// ============================================================
// V MART - WISHLIST PAGE
// FLIPKART STYLE SIZE AND COLOUR SELECTION
// ============================================================

// ============================================================
// GET TOKEN
// ============================================================

function getWishlistToken() {
    return localStorage.getItem("token");
}

// ============================================================
// LOGIN CHECK
// ============================================================

function wishlistLoginRequired() {
    if (!getWishlistToken()) {
        window.location.href = "login.html";
        return false;
    }

    return true;
}

// ============================================================
// ESCAPE HTML
// ============================================================

function wishlistEscape(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ============================================================
// CONVERT SIZE AND COLOUR INTO ARRAYS
// ============================================================

function getWishlistOptions(value) {
    if (Array.isArray(value)) {
        return value.map(v => String(v).trim()).filter(Boolean);
    }

    return String(value || "")
        .split(",")
        .map(v => v.trim())
        .filter(Boolean);
}

// ============================================================
// FLIPKART STYLE CSS
// ============================================================

function addWishlistStyles() {

    if (document.getElementById("wishlist-selection-styles")) {
        return;
    }

    const style = document.createElement("style");

    style.id = "wishlist-selection-styles";

    style.textContent = `

        .wishlist-selection {
            margin: 15px 0;
        }

        .wishlist-selection-label {
            display: block;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 10px;
            color: #333;
        }

        .wishlist-size-options {
            display: flex;
            flex-wrap: wrap;
            gap: 9px;
        }

        .wishlist-choice {
            cursor: pointer;
            border: 1px solid #ddd;
            background: #fff;
            transition: 0.2s ease;
        }

        .wishlist-size-choice {
            min-width: 43px;
            height: 40px;
            padding: 0 12px;
            border-radius: 5px;
            font-size: 14px;
            font-weight: 600;
            color: #333;
        }

        .wishlist-choice:hover {
            border-color: #2874f0;
        }

        .wishlist-choice.is-selected {
            border: 2px solid #2874f0;
            background: #edf4ff;
            color: #2874f0;
        }

        .wishlist-color-options {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
        }

        .wishlist-color-choice {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 5px;
            min-width: 55px;
            padding: 7px 5px;
            border-radius: 6px;
            font-size: 11px;
            color: #333;
        }

        .wishlist-color-circle {
            width: 25px;
            height: 25px;
            border-radius: 50%;
            display: block;
            border: 1px solid #ccc;
            background: var(--swatch-color, #ddd);
        }

        .wishlist-color-choice.is-selected {
            border: 2px solid #2874f0;
            background: #edf4ff;
        }

        .wishlist-not-required {
            font-size: 13px;
            color: #777;
            margin: 10px 0;
        }

        .wishlist-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
        }

        @media (max-width: 480px) {
            .wishlist-size-choice {
                min-width: 38px;
                height: 37px;
                padding: 0 9px;
            }

            .wishlist-color-options {
                gap: 7px;
            }
        }

    `;

    document.head.appendChild(style);
}

// ============================================================
// COLOUR SWATCH
// ============================================================

function getWishlistColorCode(color) {

    const name = String(color).trim().toLowerCase();

    const colors = {
        red: "#e53935",
        blue: "#2874d0",
        black: "#222222",
        white: "#ffffff",
        green: "#2e8b57",
        yellow: "#ffeb3b",
        pink: "#ff69b4",
        purple: "#800080",
        orange: "#ff9800",
        brown: "#8b4513",
        grey: "#808080",
        gray: "#808080",
        maroon: "#800000",
        navy: "#000080",
        cream: "#fffdd0",
        beige: "#f5f5dc",
        gold: "#d4af37",
        silver: "#c0c0c0",
        skyblue: "#87ceeb",
        "light blue": "#add8e6",
        "dark blue": "#00008b",
        lavender: "#e6e6fa"
    };

    if (colors[name]) {
        return colors[name];
    }

    // Allow valid HEX colours from database.
    if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(name)) {
        return name;
    }

    return "#dddddd";
}

// ============================================================
// WISHLIST API
// ============================================================

async function wishlistApi(url, options = {}) {

    const token = getWishlistToken();

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = "Bearer " + token;
    }

    const response = await fetch("/api" + url, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {

        if (response.status === 401) {

            localStorage.removeItem("token");
            localStorage.removeItem("customer");

            window.location.href = "login.html";

            throw new Error("Please login again.");
        }

        throw new Error(
            data.message || data.error || "Request failed."
        );
    }

    return data;
}

// ============================================================
// CREATE SIZE BUTTONS
// ============================================================

function createWishlistSizeOptions(productId, sizes) {

    if (!sizes.length) {
        return `
            <p class="wishlist-not-required">
                Size: Not required
            </p>
        `;
    }

    return `

        <div class="wishlist-selection">

            <label class="wishlist-selection-label">
                Select Size:
            </label>

            <div class="wishlist-size-options">

                ${sizes.map(size => `

                    <button
                        type="button"
                        class="wishlist-choice wishlist-size-choice"
                        data-product-id="${productId}"
                        data-option-type="size"
                        data-option-value="${wishlistEscape(size)}"
                        aria-pressed="false"
                    >
                        ${wishlistEscape(size)}
                    </button>

                `).join("")}

            </div>

        </div>

    `;
}

// ============================================================
// CREATE COLOUR BUTTONS
// ============================================================

function createWishlistColorOptions(productId, colors) {

    if (!colors.length) {
        return `
            <p class="wishlist-not-required">
                Colour: Not required
            </p>
        `;
    }

    return `

        <div class="wishlist-selection">

            <label class="wishlist-selection-label">
                Select Colour:
            </label>

            <div class="wishlist-color-options">

                ${colors.map(color => {

                    const colorCode = getWishlistColorCode(color);

                    return `

                        <button
                            type="button"
                            class="wishlist-choice wishlist-color-choice"
                            data-product-id="${productId}"
                            data-option-type="color"
                            data-option-value="${wishlistEscape(color)}"
                            aria-pressed="false"
                            title="${wishlistEscape(color)}"
                            style="--swatch-color: ${colorCode};"
                        >

                            <span class="wishlist-color-circle"></span>

                            <span>
                                ${wishlistEscape(color)}
                            </span>

                        </button>

                    `;

                }).join("")}

            </div>

        </div>

    `;
}

// ============================================================
// HANDLE SIZE AND COLOUR SELECTION
// ============================================================

function wishlistSelectOption(button) {

    const productId = button.dataset.productId;
    const optionType = button.dataset.optionType;

    const container = button.parentElement;

    if (!container) return;

    // Remove previous selection from this group.
    container.querySelectorAll(".wishlist-choice").forEach(item => {

        item.classList.remove("is-selected");

        item.setAttribute("aria-pressed", "false");

    });

    // Select clicked option.
    button.classList.add("is-selected");

    button.setAttribute("aria-pressed", "true");

}

// ============================================================
// LOAD WISHLIST
// ============================================================

async function loadWishlist() {

    if (!wishlistLoginRequired()) return;

    const box = document.getElementById("wishlist");

    if (!box) return;

    addWishlistStyles();

    box.innerHTML = "<p>Loading wishlist...</p>";

    try {

        const list = await wishlistApi("/wishlist");

        console.log("VMART WISHLIST:", list);

        if (!Array.isArray(list) || list.length === 0) {

            showEmptyWishlist(box);

            return;
        }

        let html = "";

        // ====================================================
        // LOAD PRODUCTS
        // ====================================================

        for (const item of list) {

            try {

                const productId = Number(
                    item.productId ??
                    item.ProductID ??
                    item.id
                );

                if (!productId) continue;

                const product = item.product ||
                    await wishlistApi("/products/" + productId);

                if (!product || product.message) continue;

                const id = Number(product.id || productId);

                const price = Number(product.price || 0);

                const productName = product.name || "Product";

                const productImage =
                    product.image ||
                    "https://placehold.co/300x400?text=V+MART";

                const brand = product.brand || "";

                // Available sizes and colours.
                const sizes = getWishlistOptions(
                    product.sizes ?? product.size
                );

                const colors = getWishlistOptions(
                    product.colors ?? product.colours
                );

                // Flipkart-style size buttons.
                const sizeHtml = createWishlistSizeOptions(
                    id,
                    sizes
                );

                // Flipkart-style colour buttons.
                const colorHtml = createWishlistColorOptions(
                    id,
                    colors
                );

                // =================================================
                // PRODUCT CARD
                // =================================================

                html += `

                    <div class="wishlist-item">

                        <img
                            src="${wishlistEscape(productImage)}"
                            alt="${wishlistEscape(productName)}"
                            class="wishlist-product-image"
                            onerror="this.onerror=null;this.src='https://placehold.co/300x400?text=V+MART';"
                        >

                        <div class="wishlist-info">

                            <h3>
                                ${wishlistEscape(productName)}
                            </h3>

                            ${brand ? `
                                <p class="wishlist-brand">
                                    Brand: ${wishlistEscape(brand)}
                                </p>
                            ` : ""}

                            ${sizeHtml}

                            ${colorHtml}

                            <p class="wishlist-price">
                                ₹${price.toLocaleString("en-IN")}
                            </p>

                            <div class="wishlist-actions">

                                <button
                                    type="button"
                                    class="cart-btn"
                                    onclick="wishlistAddToCart(${id})"
                                >
                                    🛒 Add to Cart
                                </button>

                                <button
                                    type="button"
                                    class="remove-btn"
                                    onclick="removeWishlist(${id})"
                                >
                                    Remove
                                </button>

                            </div>

                        </div>

                    </div>

                `;

            } catch (productError) {

                console.error(
                    "Wishlist product error:",
                    item.productId,
                    productError
                );
            }
        }

        // ====================================================
        // DISPLAY WISHLIST
        // ====================================================

        if (!html) {

            showEmptyWishlist(box);

            return;
        }

        box.innerHTML = html;

        // Attach click events to size and colour buttons.
        box.querySelectorAll(".wishlist-choice").forEach(button => {

            button.addEventListener("click", function () {

                wishlistSelectOption(this);

            });

        });

        if (typeof updateWishlistCount === "function") {
            updateWishlistCount();
        }

    } catch (error) {

        console.error("Wishlist loading error:", error);

        box.innerHTML = `

            <div class="empty-wishlist">

                <h3>Unable to load wishlist</h3>

                <p>${wishlistEscape(error.message)}</p>

                <button
                    type="button"
                    onclick="loadWishlist()"
                >
                    Try Again
                </button>

            </div>

        `;
    }
}

// ============================================================
// EMPTY WISHLIST
// ============================================================

function showEmptyWishlist(box) {

    box.innerHTML = `

        <div class="empty-wishlist">

            <h3>Your wishlist is empty</h3>

            <p>
                Add products to your wishlist
                to see them here.
            </p>

            <a href="categories.html">
                Continue Shopping
            </a>

        </div>

    `;
}

// ============================================================
// ADD WISHLIST PRODUCT TO CART
// ============================================================

async function wishlistAddToCart(productId) {

    try {

        productId = Number(productId);

        if (!productId) {

            alert("Invalid product.");

            return;
        }

        // Get selected size button.
        const selectedSize = document.querySelector(
            `.wishlist-choice[data-product-id="${productId}"][data-option-type="size"].is-selected`
        );

        // Get selected colour button.
        const selectedColor = document.querySelector(
            `.wishlist-choice[data-product-id="${productId}"][data-option-type="color"].is-selected`
        );

        const size = selectedSize
            ? selectedSize.dataset.optionValue
            : "";

        const color = selectedColor
            ? selectedColor.dataset.optionValue
            : "";

        // ====================================================
        // VALIDATE SIZE
        // ====================================================

        const sizeOptions = document.querySelectorAll(
            `.wishlist-choice[data-product-id="${productId}"][data-option-type="size"]`
        );

        if (sizeOptions.length > 0 && !size) {

            alert("Please select a size.");

            sizeOptions[0].focus();

            return;
        }

        // ====================================================
        // VALIDATE COLOUR
        // ====================================================

        const colorOptions = document.querySelectorAll(
            `.wishlist-choice[data-product-id="${productId}"][data-option-type="color"]`
        );

        if (colorOptions.length > 0 && !color) {

            alert("Please select a colour.");

            colorOptions[0].focus();

            return;
        }

        // ====================================================
        // ADD TO CART API
        // ====================================================

        const result = await wishlistApi(
            "/cart",
            {
                method: "POST",

                body: JSON.stringify({

                    productId: productId,

                    quantity: 1,

                    size: size,

                    color: color

                })
            }
        );

        console.log("WISHLIST TO CART:", result);

        alert("Product added to cart successfully!");

        // Update cart count.
        if (typeof updateCartCount === "function") {
            await updateCartCount();
        }

    } catch (error) {

        console.error("Wishlist Add To Cart Error:", error);

        alert(
            error.message ||
            "Unable to add product to cart."
        );
    }
}

// ============================================================
// REMOVE FROM WISHLIST
// ============================================================

async function removeWishlist(productId) {

    try {

        const confirmed = confirm(
            "Are you sure you want to remove this product from your wishlist?"
        );

        if (!confirmed) return;

        await wishlistApi(
            "/wishlist/" + Number(productId),
            {
                method: "DELETE"
            }
        );

        await loadWishlist();

        if (typeof updateWishlistCount === "function") {
            updateWishlistCount();
        }

    } catch (error) {

        console.error("Remove wishlist error:", error);

        alert(
            error.message ||
            "Unable to remove product."
        );
    }
}

// ============================================================
// PAGE LOAD
// ============================================================

document.addEventListener("DOMContentLoaded", function () {

    if (!wishlistLoginRequired()) return;

    loadWishlist();

});

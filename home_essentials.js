
"use strict";

/* =========================================================
   V MART - HOME ESSENTIALS PRODUCTS
   MYSQL PRODUCTS + DYNAMIC FILTERS + CART + BUY NOW
========================================================= */

let homeProducts = [];
let homeSearchText = "";

const homeSelections = {};

/* =========================================================
   COMMON DATABASE HELPERS
========================================================= */

function getHomeValue(product, keys, fallback = "") {
    for (const key of keys) {
        const value = product?.[key];

        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }

    return fallback;
}

function getHomeProductId(product) {
    return Number(getHomeValue(product, [
        "id",
        "productId",
        "ProductID",
        "productID"
    ], 0));
}

function getHomeProductName(product) {
    return String(getHomeValue(product, [
        "name",
        "ProductName",
        "productName"
    ], "Product"));
}

function getHomeBrand(product) {
    return String(getHomeValue(product, [
        "brand",
        "Brand"
    ], "")).trim();
}

function getHomePrice(product) {
    return Number(getHomeValue(product, [
        "price",
        "Price"
    ], 0)) || 0;
}

/* =========================================================
   CATEGORY FROM MYSQL

   Products table contains Category.
   It does not contain SubCategory.
========================================================= */

function getHomeCategory(product) {
    return String(getHomeValue(product, [
        "category",
        "Category"
    ], "")).trim();
}

/* Optional: use Gender only if the API supplies it. */

function getHomeGender(product) {
    return String(getHomeValue(product, [
        "gender",
        "Gender"
    ], "")).trim();
}

/* =========================================================
   SIZE AND COLOUR OPTIONS
========================================================= */

function parseHomeOptions(value) {
    if (value === undefined || value === null || value === "") {
        return [];
    }

    if (Array.isArray(value)) {
        return [...new Set(
            value.map(item => String(item).trim()).filter(Boolean)
        )];
    }

    let text = String(value).trim();

    if (!text) return [];

    try {
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed)) {
            return [...new Set(
                parsed.map(item => String(item).trim()).filter(Boolean)
            )];
        }
    } catch (error) {
        // Continue with normal string parsing.
    }

    return [...new Set(
        text.split(/[,;|/]+/)
            .map(item => item.trim())
            .filter(Boolean)
    )];
}

function getHomeSizes(product) {
    return parseHomeOptions(getHomeValue(product, [
        "sizes",
        "Sizes",
        "size",
        "Size"
    ]));
}

function getHomeColors(product) {
    return parseHomeOptions(getHomeValue(product, [
        "colors",
        "Colors",
        "color",
        "Color",
        "colour",
        "Colour"
    ]));
}

/* =========================================================
   STOCK STATUS
========================================================= */

function getHomeStock(product) {
    const value = getHomeValue(product, [
        "availableStock",
        "AvailableStock",
        "InventoryAvailableStock",
        "stock",
        "available_stock"
    ], 0);

    return Math.max(0, Number(value) || 0);
}

function getHomeStockStatus(product) {
    const availableStock = getHomeStock(product);

    const status = String(getHomeValue(product, [
        "stockStatus",
        "InventoryStockStatus",
        "inventoryStockStatus"
    ], "")).trim().toLowerCase();

    if (status.includes("out of stock") || availableStock <= 0) {
        return "Out of Stock";
    }

    if (status.includes("high stock")) return "High Stock";
    if (status.includes("medium stock")) return "Medium Stock";
    if (status.includes("low stock")) return "Low Stock";

    if (availableStock >= 20) return "High Stock";
    if (availableStock >= 6) return "Medium Stock";

    return "Low Stock";
}

/* =========================================================
   CUSTOMER TOKEN
========================================================= */

function getHomeToken() {
    return (
        localStorage.getItem("token") ||
        localStorage.getItem("customerToken") ||
        sessionStorage.getItem("token") ||
        sessionStorage.getItem("customerToken") ||
        ""
    );
}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHomeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================================================
   PRODUCT IMAGE
========================================================= */

function getHomeImage(product) {
    let image = String(getHomeValue(product, [
        "image",
        "imageUrl",
        "imageURL",
        "ImagePath",
        "photo"
    ], "")).trim();

    if (!image) {
        return "../images/placeholder.jpg";
    }

    if (
        image.startsWith("http://") ||
        image.startsWith("https://") ||
        image.startsWith("/") ||
        image.startsWith("../")
    ) {
        return image;
    }

    return "../images/" + image;
}

/* =========================================================
   PRODUCT STYLES
========================================================= */

function addHomeProductStyles() {
    if (document.getElementById("home-product-options-style")) {
        return;
    }

    const style = document.createElement("style");

    style.id = "home-product-options-style";

    style.textContent = `
        .home-options {
            width: 100%;
            padding: 10px 12px;
            box-sizing: border-box;
        }

        .home-option-group {
            margin-bottom: 15px;
        }

        .home-option-title {
            display: block;
            margin-bottom: 10px;
            font-size: 14px;
            font-weight: 600;
            color: #222;
        }

        .home-option-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .home-option-btn {
            min-width: 48px;
            min-height: 42px;
            padding: 9px 12px;
            border: 1px solid #ccc;
            border-radius: 7px;
            background: #fff;
            color: #333;
            font-size: 14px;
            cursor: pointer;
            transition: 0.2s ease;
        }

        .home-option-btn:hover {
            border-color: #8f0c05;
            color: #8f0c05;
        }

        .home-option-btn.selected {
            border: 2px solid #8f0c05;
            background: #fff5f4;
            color: #8f0c05;
            font-weight: 600;
        }

        .home-option-btn:focus-visible {
            outline: 2px solid #8f0c05;
            outline-offset: 2px;
        }

        .home-selection-message {
            display: none;
            margin: 5px 12px 10px;
            color: #8f0c05;
            font-size: 12px;
        }

        .home-selection-message.show {
            display: block;
        }

        .variant-unavailable {
            color: #777;
            font-size: 13px;
        }

        .stock-status {
            display: inline-block;
            width: fit-content;
            padding: 6px 12px;
            margin: 8px 0;
            border-radius: 5px;
            font-size: 13px;
            font-weight: 600;
        }

        .high-stock {
            color: #16803c;
            background: #e5f7eb;
        }

        .medium-stock {
            color: #b77900;
            background: #fff3cd;
        }

        .low-stock {
            color: #d93025;
            background: #fde8e7;
        }

        .out-of-stock {
            color: #fff;
            background: #555;
        }

        .product-buttons {
            display: flex;
            flex-direction: column;
            gap: 9px;
            padding: 10px 12px 15px;
        }

        .product-buttons button {
            width: 100%;
            min-height: 42px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
        }

        .product-buttons button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .product-buttons .add-cart-btn {
            background: #8f0c05;
            color: white;
        }

        .product-buttons .buy-now-btn {
            background: #222;
            color: white;
        }

        .home-description {
            margin-top: 8px;
            font-size: 13px;
            color: #555;
        }
    `;

    document.head.appendChild(style);
}

/* =========================================================
   DYNAMIC FILTER DROPDOWN
========================================================= */

function populateHomeFilter(id, values, defaultText) {
    const filter = document.getElementById(id);

    if (!filter) return;

    const currentValue = filter.value;

    filter.innerHTML = "";

    const defaultOption = document.createElement("option");

    defaultOption.value = "";
    defaultOption.textContent = defaultText;

    filter.appendChild(defaultOption);

    const uniqueValues = [...new Set(
        values
            .map(value => String(value || "").trim())
            .filter(Boolean)
    )];

    uniqueValues.sort((a, b) =>
        a.localeCompare(b, undefined, {
            numeric: true,
            sensitivity: "base"
        })
    );

    uniqueValues.forEach(value => {
        const option = document.createElement("option");

        option.value = value;
        option.textContent = value;

        filter.appendChild(option);
    });

    if (
        [...filter.options].some(option => option.value === currentValue)
    ) {
        filter.value = currentValue;
    }
}

/* =========================================================
   CREATE FILTER OPTIONS FROM MYSQL PRODUCTS
========================================================= */

function createHomeFilterOptions() {
    const sizes = homeProducts.flatMap(getHomeSizes);

    const brands = homeProducts.map(getHomeBrand);

    const categories = homeProducts.map(getHomeCategory);

    const genders = homeProducts.map(getHomeGender);

    // SIZE
    populateHomeFilter(
        "sizeFilter",
        sizes,
        "All Sizes"
    );

    // BRAND
    populateHomeFilter(
        "brandFilter",
        brands,
        "All Brands"
    );

    // CATEGORY
    populateHomeFilter(
        "categoryFilter",
        categories,
        "All Categories"
    );

    // GENDER (only if supplied by API)
    populateHomeFilter(
        "genderFilter",
        genders,
        "All Genders"
    );

    // PRICE
    createHomePriceOptions();
}

/* =========================================================
   DYNAMIC PRICE FILTER
========================================================= */

function createHomePriceOptions() {
    const filter = document.getElementById("priceFilter");

    if (!filter) return;

    const currentValue = filter.value;

    const prices = homeProducts
        .map(getHomePrice)
        .filter(price => Number.isFinite(price) && price > 0);

    filter.innerHTML = "";

    const defaultOption = document.createElement("option");

    defaultOption.value = "";
    defaultOption.textContent = "All Prices";

    filter.appendChild(defaultOption);

    if (!prices.length) return;

    const minPrice = Math.floor(Math.min(...prices) / 500) * 500;
    const maxPrice = Math.floor(Math.max(...prices) / 500) * 500;

    for (let min = minPrice; min <= maxPrice; min += 500) {
        const max = min + 499;

        const option = document.createElement("option");

        option.value = `${min}-${max}`;

        option.textContent =
            `₹${min.toLocaleString("en-IN")} - ₹${max.toLocaleString("en-IN")}`;

        filter.appendChild(option);
    }

    if (
        [...filter.options].some(option => option.value === currentValue)
    ) {
        filter.value = currentValue;
    }
}

/* =========================================================
   SETUP FILTER EVENTS
========================================================= */

function setupHomeFilters() {
    [
        "sizeFilter",
        "categoryFilter",
        "genderFilter",
        "brandFilter",
        "priceFilter"
    ].forEach(id => {
        const element = document.getElementById(id);

        if (
            element &&
            element.dataset.homeFilterReady !== "true"
        ) {
            element.dataset.homeFilterReady = "true";

            element.addEventListener(
                "change",
                displayHomeProducts
            );
        }
    });
}

/* =========================================================
   SEARCH
========================================================= */

function setupHomeSearch() {
    const input = document.getElementById("pageSearch");

    if (
        !input ||
        input.dataset.homeSearchReady === "true"
    ) {
        return;
    }

    input.dataset.homeSearchReady = "true";

    input.addEventListener("input", function() {
        homeSearchText = this.value.trim().toLowerCase();

        displayHomeProducts();
    });

    input.addEventListener("keydown", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            searchCurrentPage();
        }
    });
}

function searchCurrentPage() {
    const input = document.getElementById("pageSearch");

    if (!input) return;

    homeSearchText = input.value.trim().toLowerCase();

    displayHomeProducts();
}

/* =========================================================
   SEARCH MESSAGE
========================================================= */

function showHomeSearchMessage(message) {
    const box = document.getElementById("pageSearchMessage");

    if (box) {
        box.style.display = message ? "block" : "none";
        box.textContent = message || "";
    }
}

/* =========================================================
   FILTER AND DISPLAY PRODUCTS
========================================================= */

function displayHomeProducts() {
    const box = document.getElementById("products");

    if (!box) return;

    const size = String(
        document.getElementById("sizeFilter")?.value || ""
    ).trim().toLowerCase();

    const category = String(
        document.getElementById("categoryFilter")?.value || ""
    ).trim().toLowerCase();

    const gender = String(
        document.getElementById("genderFilter")?.value || ""
    ).trim().toLowerCase();

    const brand = String(
        document.getElementById("brandFilter")?.value || ""
    ).trim().toLowerCase();

    const price = document.getElementById("priceFilter")?.value || "";

    const filtered = homeProducts.filter(product => {
        const productName = getHomeProductName(product).toLowerCase();

        const productBrand = getHomeBrand(product).toLowerCase();

        const productCategory = getHomeCategory(product).toLowerCase();

        const productGender = getHomeGender(product).toLowerCase();

        // SEARCH
        if (homeSearchText) {
            const searchContent = [
                productName,
                productBrand,
                productCategory,
                productGender,
                getHomeSizes(product).join(" "),
                getHomeColors(product).join(" "),
                getHomeValue(product, [
                    "description",
                    "Description"
                ], "")
            ].join(" ").toLowerCase();

            if (!searchContent.includes(homeSearchText)) {
                return false;
            }
        }

        // SIZE
        if (size) {
            const productSizes = getHomeSizes(product)
                .map(item => item.toLowerCase());

            if (!productSizes.includes(size)) {
                return false;
            }
        }

        // CATEGORY
        if (
            category &&
            productCategory !== category
        ) {
            return false;
        }

        // GENDER
        if (
            gender &&
            productGender !== gender
        ) {
            return false;
        }

        // BRAND
        if (
            brand &&
            productBrand !== brand
        ) {
            return false;
        }

        // PRICE
        if (price) {
            const [min, max] = price.split("-").map(Number);

            const productPrice = getHomePrice(product);

            if (
                productPrice < min ||
                productPrice > max
            ) {
                return false;
            }
        }

        return true;
    });

    if (!filtered.length) {
        box.innerHTML = `
            <div class="no-products">
                <h3>No products found</h3>
                <p>No home essentials products match your search or filters.</p>
            </div>
        `;
    } else {
        box.innerHTML = filtered
            .map(product => productHTML(product))
            .join("");
    }

    const count = document.getElementById("productCount");

    if (count) {
        count.textContent = `${filtered.length} Products`;
    }

    if (homeSearchText) {
        showHomeSearchMessage(
            `${filtered.length} product(s) found for "${homeSearchText}"`
        );
    } else {
        showHomeSearchMessage("");
    }
}

/* =========================================================
   CREATE PRODUCT CARD
========================================================= */

function productHTML(product) {
    const productId = getHomeProductId(product);

    const productName = getHomeProductName(product);

    const brand = getHomeBrand(product);

    const price = getHomePrice(product);

    const image = getHomeImage(product);

    const description = String(getHomeValue(product, [
        "description",
        "Description"
    ], "")).trim();

    const stockStatus = getHomeStockStatus(product);

    const stockClass = stockStatus
        .toLowerCase()
        .replace(/\s+/g, "-");

    const sizes = getHomeSizes(product);

    const colors = getHomeColors(product);

    const selection = initializeHomeSelection(productId);

    const sizeButtons = sizes.length
        ? sizes.map(item => {
            const selected = selection.size === item;

            return `
                <button
                    type="button"
                    class="home-option-btn ${selected ? "selected" : ""}"
                    data-product-id="${productId}"
                    data-option-type="size"
                    data-option-value="${escapeHomeHTML(item)}"
                    aria-pressed="${selected ? "true" : "false"}"
                >
                    ${escapeHomeHTML(item)}
                </button>
            `;
        }).join("")
        : `<span class="variant-unavailable">Size not available</span>`;

    const colorButtons = colors.length
        ? colors.map(item => {
            const selected =
                selection.color.toLowerCase() === item.toLowerCase();

            return `
                <button
                    type="button"
                    class="home-option-btn ${selected ? "selected" : ""}"
                    data-product-id="${productId}"
                    data-option-type="color"
                    data-option-value="${escapeHomeHTML(item)}"
                    aria-pressed="${selected ? "true" : "false"}"
                >
                    ${escapeHomeHTML(item)}
                </button>
            `;
        }).join("")
        : `<span class="variant-unavailable">Colour not available</span>`;

    const isOutOfStock = stockStatus === "Out of Stock";

    return `
        <div class="product" data-product-id="${productId}">

            <div class="product-image-box">

                <img
                    src="${escapeHomeHTML(image)}"
                    alt="${escapeHomeHTML(productName)}"
                    loading="lazy"
                    onerror="this.onerror=null;this.src='../images/placeholder.jpg';"
                >

                <button
                    type="button"
                    class="wishlist-heart"
                    onclick="addWishlist(${productId})"
                    title="Add to Wishlist"
                >
                    ♡
                </button>

            </div>

            <div class="product-details">

                <h3>${escapeHomeHTML(productName)}</h3>

                <p class="brand">
                    ${escapeHomeHTML(brand)}
                </p>

                <p class="price">
                    ₹${price.toLocaleString("en-IN")}
                </p>

                <div class="stock-status ${stockClass}">
                    ${escapeHomeHTML(stockStatus)}
                </div>

                <div class="home-description">
                    <strong>Description:</strong>
                    <span>
                        ${description
                            ? escapeHomeHTML(description)
                            : "Description not available"}
                    </span>
                </div>

            </div>

            <div class="home-options">

                <div class="home-option-group">

                    <span class="home-option-title">
                        Select Size
                    </span>

                    <div class="home-option-buttons">
                        ${sizeButtons}
                    </div>

                </div>

                <div class="home-option-group">

                    <span class="home-option-title">
                        Select Colour
                    </span>

                    <div class="home-option-buttons">
                        ${colorButtons}
                    </div>

                </div>

            </div>

            <p
                class="home-selection-message"
                id="home-message-${productId}"
            ></p>

            <div class="product-buttons">

                <button
                    type="button"
                    class="add-cart-btn"
                    onclick="addHomeToCart(${productId})"
                    ${isOutOfStock ? "disabled" : ""}
                >
                    🛒 Add to Cart
                </button>

                <button
                    type="button"
                    class="buy-now-btn"
                    onclick="buyHomeNow(${productId})"
                    ${isOutOfStock ? "disabled" : ""}
                >
                    ⚡ Buy Now
                </button>

            </div>

        </div>
    `;
}

/* =========================================================
   INITIALIZE PRODUCT SELECTION
========================================================= */

function initializeHomeSelection(productId) {
    if (!homeSelections[productId]) {
        homeSelections[productId] = {
            size: "",
            color: ""
        };
    }

    return homeSelections[productId];
}

/* =========================================================
   SELECT SIZE AND COLOUR
========================================================= */

function setupHomeOptionSelection() {
    const box = document.getElementById("products");

    if (
        !box ||
        box.dataset.homeOptionsReady === "true"
    ) {
        return;
    }

    box.dataset.homeOptionsReady = "true";

    box.addEventListener("click", function(event) {
        const button = event.target.closest(".home-option-btn");

        if (!button || !box.contains(button)) return;

        const productId = Number(button.dataset.productId);

        const optionType = button.dataset.optionType;

        const optionValue = button.dataset.optionValue;

        if (
            !productId ||
            !["size", "color"].includes(optionType) ||
            !optionValue
        ) {
            return;
        }

        const selection = initializeHomeSelection(productId);

        selection[optionType] = optionValue;

        const group = button.closest(".home-option-buttons");

        if (group) {
            group.querySelectorAll(".home-option-btn")
                .forEach(item => {
                    const selected = item === button;

                    item.classList.toggle("selected", selected);

                    item.setAttribute(
                        "aria-pressed",
                        String(selected)
                    );
                });
        }

        const message = document.getElementById(
            `home-message-${productId}`
        );

        if (message) {
            message.textContent = "";
            message.classList.remove("show");
        }
    });
}

/* =========================================================
   VALIDATE SIZE AND COLOUR
========================================================= */

function validateHomeSelection(productId) {
    const product = homeProducts.find(
        item => getHomeProductId(item) === Number(productId)
    );

    if (!product) {
        alert("Product not found. Please refresh the page.");
        return false;
    }

    const sizes = getHomeSizes(product);

    const colors = getHomeColors(product);

    const selection = initializeHomeSelection(productId);

    const message = document.getElementById(
        `home-message-${productId}`
    );

    let error = "";

    if (sizes.length && !selection.size) {
        error = "Please select a size.";
    } else if (colors.length && !selection.color) {
        error = "Please select a colour.";
    }

    if (error) {
        if (message) {
            message.textContent = error;
            message.classList.add("show");
        }

        alert(error);
        return false;
    }

    if (message) {
        message.textContent = "";
        message.classList.remove("show");
    }

    return true;
}

/* =========================================================
   ADD TO CART
========================================================= */

async function addHomeToCart(productId) {
    const token = getHomeToken();

    if (!token) {
        alert("Please login to add products to your cart.");

        window.location.href = "login.html";

        return;
    }

    const product = homeProducts.find(
        item => getHomeProductId(item) === Number(productId)
    );

    if (!product) {
        alert("Product not found. Please refresh the page.");
        return;
    }

    if (getHomeStockStatus(product) === "Out of Stock") {
        alert("This product is currently out of stock.");
        return;
    }

    if (!validateHomeSelection(productId)) return;

    const selection = initializeHomeSelection(productId);

    try {
        const response = await fetch("/api/cart", {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },

            body: JSON.stringify({
                productId: Number(productId),
                quantity: 1,

                size: selection.size,
                selectedSize: selection.size,

                color: selection.color,
                selectedColor: selection.color,
                selectedColour: selection.color
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                "Unable to add product to cart."
            );
        }

        alert(
            data.message ||
            "Home Essentials product added to cart successfully!"
        );

    } catch (error) {
        console.error("Home Essentials Add to Cart Error:", error);

        alert(
            error.message ||
            "Unable to add product to cart."
        );
    }
}

/* =========================================================
   BUY NOW
========================================================= */

async function buyHomeNow(productId) {
    const token = getHomeToken();

    if (!token) {
        alert("Please login to continue.");

        window.location.href = "login.html";

        return;
    }

    const product = homeProducts.find(
        item => getHomeProductId(item) === Number(productId)
    );

    if (!product) {
        alert("Product not found. Please refresh the page.");
        return;
    }

    if (getHomeStockStatus(product) === "Out of Stock") {
        alert("This product is currently out of stock.");
        return;
    }

    if (!validateHomeSelection(productId)) return;

    const selection = initializeHomeSelection(productId);

    const params = new URLSearchParams();

    params.set("buyNow", String(productId));
    params.set("quantity", "1");
    params.set("size", selection.size);
    params.set("color", selection.color);

    window.location.href = "checkout.html?" + params.toString();
}

/* =========================================================
   LOAD HOME ESSENTIALS PRODUCTS FROM MYSQL
========================================================= */

async function loadHomeProducts() {
    const box = document.getElementById("products");

    if (!box) {
        console.error("Home Essentials products container not found.");
        return;
    }

    try {
        box.innerHTML = `
            <div class="loading-message">
                Loading home essentials products...
            </div>
        `;

        const response = await fetch(
            "/api/products?category=home_essentials"
        );

        if (!response.ok) {
            throw new Error(
                `Server returned ${response.status}`
            );
        }

        const data = await response.json();

        homeProducts = Array.isArray(data)
            ? data
            : Array.isArray(data.products)
                ? data.products
                : Array.isArray(data.data)
                    ? data.data
                    : [];

        console.log(
            "HOME ESSENTIALS PRODUCTS FROM MYSQL:",
            homeProducts
        );

        createHomeFilterOptions();

        setupHomeFilters();
        setupHomeSearch();
        setupHomeOptionSelection();

        displayHomeProducts();

    } catch (error) {
        console.error(
            "Home Essentials products loading error:",
            error
        );

        box.innerHTML = `
            <div class="error-message">
                <h3>Unable to load Home Essentials products</h3>
                <p>Please check your server and try again.</p>

                <button
                    type="button"
                    onclick="loadHomeProducts()"
                >
                    Try Again
                </button>
            </div>
        `;

        const count = document.getElementById("productCount");

        if (count) {
            count.textContent = "0 Products";
        }
    }
}

/* =========================================================
   START HOME ESSENTIALS PAGE
========================================================= */

function startHomePage() {
    console.log("V MART HOME ESSENTIALS PAGE STARTED");

    addHomeProductStyles();

    setupHomeFilters();
    setupHomeSearch();
    setupHomeOptionSelection();

    loadHomeProducts();
}

/* =========================================================
   PAGE INITIALIZATION
========================================================= */

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        startHomePage
    );
} else {
    startHomePage();
}

"use strict";

/* =========================================================
   WOMEN PRODUCTS
========================================================= */

let womenProducts = [];
let womenSearchText = "";

/* =========================================================
   GET PRODUCT VALUES
========================================================= */

function getWomenValue(product, keys) {
    for (const key of keys) {
        if (
            product[key] !== undefined &&
            product[key] !== null &&
            String(product[key]).trim() !== ""
        ) {
            return product[key];
        }
    }
    return "";
}

function getWomenOptions(value) {
    if (Array.isArray(value)) {
        return [...new Set(
            value.map(item => String(item).trim()).filter(Boolean)
        )];
    }

    if (value === null || value === undefined) return [];

    const text = String(value).trim();
    if (!text) return [];

    try {
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed)) {
            return [...new Set(
                parsed.map(item => String(item).trim()).filter(Boolean)
            )];
        }
    } catch (error) {
        // Continue with normal text.
    }

    if (/^(XXS|XXL|XS|XL|S|M|L)+$/i.test(text)) {
        const matches = text.match(/XXS|XXL|XS|XL|S|M|L/gi);
        if (matches) return [...new Set(matches)];
    }

    return [...new Set(
        text.split(/[,;|/]+/)
            .map(item => item.trim())
            .filter(Boolean)
    )];
}

function getWomenProductId(product) {
    return Number(getWomenValue(product, [
        "id", "ProductID", "productId"
    ]));
}

function getWomenName(product) {
    return getWomenValue(product, [
        "name", "productName", "ProductName"
    ]) || "Product";
}

function getWomenBrand(product) {
    return String(getWomenValue(product, [
        "brand", "Brand"
    ])).trim();
}

function getWomenPrice(product) {
    return Number(getWomenValue(product, [
        "price", "Price"
    ])) || 0;
}

function getWomenSizes(product) {
    return getWomenOptions(getWomenValue(product, [
        "sizes", "Sizes", "size", "Size"
    ]));
}

function getWomenColors(product) {
    return getWomenOptions(getWomenValue(product, [
        "colors", "Colors", "color", "Color",
        "colour", "Colour"
    ]));
}

/* CATEGORY FROM MYSQL PRODUCTS TABLE */
function getWomenCategory(product) {
    return String(getWomenValue(product, [
        "category", "Category"
    ])).trim();
}

/* =========================================================
   STOCK STATUS
========================================================= */

function getWomenStockStatus(product) {
    const status = String(
        product.stockStatus || product.StockStatus || "Out of Stock"
    ).trim();

    const allowedStatuses = [
        "High Stock",
        "Medium Stock",
        "Low Stock",
        "Out of Stock"
    ];

    return allowedStatuses.find(
        item => item.toLowerCase() === status.toLowerCase()
    ) || "Out of Stock";
}

/* =========================================================
   LOAD WOMEN PRODUCTS FROM MYSQL API
========================================================= */

async function loadWomenProducts() {
    const productsBox = document.getElementById("products");

    if (!productsBox) {
        console.error("#products element not found");
        return;
    }

    try {
        productsBox.innerHTML =
            '<div class="loading-message">Loading women products...</div>';

        const response = await fetch("/api/products?category=women");

        if (!response.ok) {
            throw new Error("API Error: " + response.status);
        }

        const data = await response.json();

        womenProducts = Array.isArray(data)
            ? data
            : Array.isArray(data.products)
                ? data.products
                : Array.isArray(data.data)
                    ? data.data
                    : [];

        if (!womenProducts.length) {
            productsBox.innerHTML =
                '<div class="no-products"><h3>No women products found</h3></div>';
            updateWomenCount(0);
            return;
        }

        createWomenFilterOptions();
        setupWomenFilters();
        setupWomenSearch();
        setupWomenOptionButtons();
        displayWomenProducts();

    } catch (error) {
        console.error("Women products error:", error);

        productsBox.innerHTML = `
            <div class="error-message">
                <h3>Unable to load women's products</h3>
                <p>Please check the server and try again.</p>
                <button type="button" onclick="loadWomenProducts()">
                    Try Again
                </button>
            </div>
        `;
    }
}

/* =========================================================
   CREATE DYNAMIC FILTER OPTIONS FROM PRODUCTS TABLE
========================================================= */

function setWomenDropdown(id, defaultText, values, previousValue) {
    const select = document.getElementById(id);
    if (!select) return;

    select.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = defaultText;
    select.appendChild(defaultOption);

    values.forEach(item => {
        const option = document.createElement("option");
        option.value = item.value;
        option.textContent = item.label;
        select.appendChild(option);
    });

    if (
        previousValue &&
        [...select.options].some(option => option.value === previousValue)
    ) {
        select.value = previousValue;
    }
}

function createWomenFilterOptions() {
    const oldSize = document.getElementById("sizeFilter")?.value || "";
    const oldBrand = document.getElementById("brandFilter")?.value || "";
    const oldCategory = document.getElementById("categoryFilter")?.value || "";
    const oldPrice = document.getElementById("priceFilter")?.value || "";

    /* SIZE */
    const sizes = [...new Set(
        womenProducts.flatMap(product => getWomenSizes(product))
    )].sort((a, b) => {
        const order = [
            "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"
        ];

        const aIndex = order.indexOf(a.toUpperCase());
        const bIndex = order.indexOf(b.toUpperCase());

        if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
        }

        return a.localeCompare(b);
    });

    setWomenDropdown(
        "sizeFilter",
        "All Sizes",
        sizes.map(size => ({ value: size, label: size })),
        oldSize
    );

    /* BRAND */
    const brands = [...new Set(
        womenProducts.map(getWomenBrand).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    setWomenDropdown(
        "brandFilter",
        "All Brands",
        brands.map(brand => ({ value: brand, label: brand })),
        oldBrand
    );

    /* CATEGORY */
    const categories = [...new Set(
        womenProducts.map(getWomenCategory).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    setWomenDropdown(
        "categoryFilter",
        "All Categories",
        categories.map(category => ({
            value: category,
            label: category
        })),
        oldCategory
    );

    /* PRICE RANGES FROM MYSQL PRODUCT PRICES */
    const prices = womenProducts
        .map(getWomenPrice)
        .filter(price => Number.isFinite(price) && price >= 0);

    const uniquePrices = [...new Set(prices)].sort((a, b) => a - b);

    const ranges = [];

    if (uniquePrices.length) {
        const minPrice = Math.floor(uniquePrices[0] / 500) * 500;
        const maxPrice = Math.ceil(uniquePrices[uniquePrices.length - 1] / 500) * 500;

        if (minPrice === maxPrice) {
            ranges.push({
                min: minPrice,
                max: minPrice + 500
            });
        } else {
            for (let min = minPrice; min < maxPrice; min += 500) {
                ranges.push({
                    min,
                    max: min + 500
                });
            }
        }
    }

    setWomenDropdown(
        "priceFilter",
        "All Prices",
        ranges.map(range => ({
            value: `${range.min}-${range.max}`,
            label: `₹${range.min.toLocaleString("en-IN")} - ₹${range.max.toLocaleString("en-IN")}`
        })),
        oldPrice
    );
}

/* =========================================================
   DISPLAY FILTERED PRODUCTS
========================================================= */

function displayWomenProducts() {
    const productsBox = document.getElementById("products");
    if (!productsBox) return;

    const sizeFilter = document.getElementById("sizeFilter")?.value || "";
    const brandFilter = document.getElementById("brandFilter")?.value || "";
    const categoryFilter = document.getElementById("categoryFilter")?.value || "";
    const priceFilter = document.getElementById("priceFilter")?.value || "";

    const filtered = womenProducts.filter(product => {
        const name = getWomenName(product);
        const brand = getWomenBrand(product);
        const category = getWomenCategory(product);

        /* SEARCH */
        if (womenSearchText) {
            const searchContent = [
                name,
                brand,
                category,
                product.description || product.Description || "",
                getWomenSizes(product).join(" "),
                getWomenColors(product).join(" ")
            ].join(" ").toLowerCase();

            if (!searchContent.includes(womenSearchText)) {
                return false;
            }
        }

        /* SIZE */
        if (sizeFilter) {
            const sizes = getWomenSizes(product).map(
                value => value.toLowerCase()
            );

            if (!sizes.includes(sizeFilter.toLowerCase())) {
                return false;
            }
        }

        /* BRAND */
        if (
            brandFilter &&
            brand.toLowerCase() !== brandFilter.toLowerCase()
        ) {
            return false;
        }

        /* CATEGORY */
        if (
            categoryFilter &&
            category.toLowerCase() !== categoryFilter.toLowerCase()
        ) {
            return false;
        }

        /* PRICE */
        if (priceFilter) {
            const [min, max] = priceFilter.split("-").map(Number);
            const price = getWomenPrice(product);

            if (price < min || price > max) {
                return false;
            }
        }

        return true;
    });

    productsBox.innerHTML = filtered.length
        ? filtered.map(createWomenProductHTML).join("")
        : `
            <div class="no-products">
                <h3>No products found</h3>
                <p>Try changing your search or filters.</p>
            </div>
        `;

    updateWomenCount(filtered.length);

    const message = document.getElementById("pageSearchMessage");

    if (message) {
        message.style.display = womenSearchText ? "block" : "none";
        message.textContent = womenSearchText
            ? `${filtered.length} product(s) found for "${womenSearchText}"`
            : "";
    }
}

function updateWomenCount(count) {
    const element = document.getElementById("productCount");
    if (element) element.textContent = `${count} Products`;
}

/* =========================================================
   CREATE PRODUCT CARD
========================================================= */

function createWomenProductHTML(product) {
    const productId = getWomenProductId(product);
    const productName = getWomenName(product);
    const productBrand = getWomenBrand(product);
    const price = getWomenPrice(product);
    const stockStatus = getWomenStockStatus(product);

    const stockClass = stockStatus.toLowerCase().replace(/\s+/g, "-");

    const productDescription = String(
        product.description ?? product.Description ?? ""
    ).trim();

    let image = getWomenValue(product, [
        "image", "imageUrl", "imageURL", "ImagePath", "photo"
    ]) || "../images/placeholder.jpg";

    if (
        image &&
        !image.startsWith("http://") &&
        !image.startsWith("https://") &&
        !image.startsWith("/") &&
        !image.startsWith("../")
    ) {
        image = "../images/" + image;
    }

    const sizes = getWomenSizes(product);
    const colors = getWomenColors(product);

    const sizeButtons = sizes.length
        ? `
            <div class="variant-section">
                <p class="variant-heading">Select Size</p>
                <div class="variant-options">
                    ${sizes.map(size => `
                        <button
                            type="button"
                            class="variant-option size-option"
                            data-product-id="${productId}"
                            data-option-type="size"
                            data-option-value="${escapeWomenHTML(size)}"
                            aria-pressed="false"
                        >${escapeWomenHTML(size)}</button>
                    `).join("")}
                </div>
            </div>
        `
        : `
            <div class="variant-section">
                <p class="variant-heading">Size</p>
                <span class="variant-unavailable">Free Size</span>
            </div>
        `;

    const colorButtons = colors.length
        ? `
            <div class="variant-section">
                <p class="variant-heading">Select Colour</p>
                <div class="variant-options">
                    ${colors.map(color => `
                        <button
                            type="button"
                            class="variant-option color-option"
                            data-product-id="${productId}"
                            data-option-type="color"
                            data-option-value="${escapeWomenHTML(color)}"
                            aria-pressed="false"
                        >${escapeWomenHTML(color)}</button>
                    `).join("")}
                </div>
            </div>
        `
        : "";

    return `
        <div class="product" data-product-id="${productId}">
            <div class="product-image-box">
                <img
                    src="${escapeWomenHTML(image)}"
                    alt="${escapeWomenHTML(productName)}"
                    loading="lazy"
                    onerror="this.onerror=null;this.src='../images/placeholder.jpg';"
                >

                <button
                    type="button"
                    class="wishlist-heart"
                    onclick="addWishlist(${productId})"
                    title="Add to Wishlist"
                >♡</button>
            </div>

            <div class="product-details">
                <h3>${escapeWomenHTML(productName)}</h3>

                <p class="brand">${escapeWomenHTML(productBrand)}</p>

                <p class="price">
                    ₹${price.toLocaleString("en-IN")}
                </p>

                <div class="stock-status ${stockClass}">
                    ${escapeWomenHTML(stockStatus)}
                </div>

                <div class="product-description">
                    <strong>Description:</strong>
                    <span>
                        ${productDescription
                            ? escapeWomenHTML(productDescription)
                            : "Description not available"}
                    </span>
                </div>

                <div class="product-variant-selectors">
                    ${sizeButtons}
                    ${colorButtons}
                </div>

                <div class="product-buttons">
                    <button
                        type="button"
                        class="add-cart-btn"
                        onclick="addWomenProductToCart(${productId})"
                    >🛒 Add to Cart</button>

                    <button
                        type="button"
                        class="buy-now-btn"
                        onclick="buyWomenNow(${productId})"
                    >⚡ Buy Now</button>
                </div>
            </div>
        </div>
    `;
}

/* =========================================================
   SELECT SIZE / COLOUR
========================================================= */

function setupWomenOptionButtons() {
    const productsBox = document.getElementById("products");

    if (!productsBox || productsBox.dataset.optionButtonsReady === "true") {
        return;
    }

    productsBox.dataset.optionButtonsReady = "true";

    productsBox.addEventListener("click", function(event) {
        const button = event.target.closest(".variant-option");
        if (!button) return;

        const optionsBox = button.closest(".variant-options");
        if (!optionsBox) return;

        optionsBox.querySelectorAll(".variant-option").forEach(option => {
            option.classList.remove("selected");
            option.setAttribute("aria-pressed", "false");
        });

        button.classList.add("selected");
        button.setAttribute("aria-pressed", "true");
    });
}

function getWomenSelectedOptions(productId) {
    const card = document.querySelector(
        `.product[data-product-id="${Number(productId)}"]`
    );

    if (!card) return { size: "", color: "" };

    const selectedSize = card.querySelector(
        '.variant-option[data-option-type="size"].selected'
    );

    const selectedColor = card.querySelector(
        '.variant-option[data-option-type="color"].selected'
    );

    return {
        size: selectedSize?.dataset.optionValue || "",
        color: selectedColor?.dataset.optionValue || ""
    };
}

/* =========================================================
   ADD TO CART
========================================================= */

async function addWomenProductToCart(productId) {
    const product = womenProducts.find(
        item => getWomenProductId(item) === Number(productId)
    );

    if (!product) {
        alert("Product not found. Please refresh the page.");
        return;
    }

    const sizes = getWomenSizes(product);
    const colors = getWomenColors(product);
    const selected = getWomenSelectedOptions(productId);

    if (sizes.length && !selected.size) {
        alert("Please select a size before adding this product to your cart.");
        return;
    }

    if (colors.length && !selected.color) {
        alert("Please select a colour before adding this product to your cart.");
        return;
    }

    if (typeof window.addCart !== "function") {
        alert("Cart function is not loaded. Please refresh the page.");
        return;
    }

    try {
        await window.addCart(
            Number(productId),
            selected.size,
            selected.color
        );
    } catch (error) {
        console.error("Add to cart error:", error);
        alert(error.message || "Unable to add product to cart.");
    }
}

/* =========================================================
   BUY NOW
========================================================= */

async function buyWomenNow(productId) {
    const token =
        localStorage.getItem("token") ||
        localStorage.getItem("customerToken") ||
        sessionStorage.getItem("token") ||
        sessionStorage.getItem("customerToken") ||
        "";

    if (!token) {
        alert("Please login before buying this product.");
        window.location.href = "login.html";
        return;
    }

    const product = womenProducts.find(
        item => getWomenProductId(item) === Number(productId)
    );

    if (!product) {
        alert("Product not found. Please refresh the page.");
        return;
    }

    const sizes = getWomenSizes(product);
    const colors = getWomenColors(product);
    const selected = getWomenSelectedOptions(productId);

    if (sizes.length && !selected.size) {
        alert("Please select a size before clicking Buy Now.");
        return;
    }

    if (colors.length && !selected.color) {
        alert("Please select a colour before clicking Buy Now.");
        return;
    }

    const params = new URLSearchParams();

    params.set("buyNow", String(productId));
    params.set("quantity", "1");
    params.set("size", selected.size);
    params.set("color", selected.color);

    window.location.href = "checkout.html?" + params.toString();
}

/* =========================================================
   SEARCH
========================================================= */

function searchWomenProducts() {
    const input = document.getElementById("pageSearch");
    if (!input) return;

    womenSearchText = input.value.trim().toLowerCase();
    displayWomenProducts();
}

function searchCurrentPage() {
    searchWomenProducts();
}

function setupWomenSearch() {
    const input = document.getElementById("pageSearch");

    if (!input || input.dataset.womenSearchReady === "true") return;

    input.dataset.womenSearchReady = "true";

    input.addEventListener("input", function() {
        womenSearchText = this.value.trim().toLowerCase();
        displayWomenProducts();
    });

    input.addEventListener("keydown", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            searchWomenProducts();
        }
    });
}

/* =========================================================
   FILTER EVENTS
========================================================= */

function setupWomenFilters() {
    [
        "sizeFilter",
        "brandFilter",
        "categoryFilter",
        "priceFilter"
    ].forEach(id => {
        const element = document.getElementById(id);

        if (element && element.dataset.womenFilterReady !== "true") {
            element.dataset.womenFilterReady = "true";
            element.addEventListener("change", displayWomenProducts);
        }
    });
}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeWomenHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================================================
   START WOMEN PAGE
========================================================= */

function startWomenPage() {
    console.log("WOMEN PAGE STARTED");

    setupWomenSearch();
    setupWomenFilters();
    setupWomenOptionButtons();
    loadWomenProducts();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWomenPage);
} else {
    startWomenPage();
}
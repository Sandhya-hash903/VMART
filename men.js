
"use strict";

/* =========================================================
   V MART - MEN PRODUCTS
   MYSQL DATABASE CONNECTED FILTERS
========================================================= */

let menProducts = [];
let menSearchText = "";

const MEN_SIZE_ORDER = [
    "XS", "S", "M", "L", "XL", "XXL", "XXXL", "Free Size"
];

/* =========================================================
   DATABASE VALUE HELPERS
========================================================= */

function getOptionList(value) {
    if (Array.isArray(value)) {
        return [...new Set(value.map(x => String(x).trim()).filter(Boolean))];
    }

    if (value === null || value === undefined) return [];

    const text = String(value).trim();
    if (!text) return [];

    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            return [...new Set(parsed.map(x => String(x).trim()).filter(Boolean))];
        }
    } catch (error) {}

    const parts = text.split(/[,;|/]+/).map(x => x.trim()).filter(Boolean);
    if (parts.length > 1) return [...new Set(parts)];

    const compact = text.toUpperCase().replace(/\s/g, "");
    const sizes = compact.match(/XXXL|XXL|XXS|XS|XL|S|M|L/g);

    if (sizes && sizes.join("") === compact && sizes.length > 1) {
        return [...new Set(sizes)];
    }

    return [text];
}

function getMenProductId(p) {
    return Number(p.id ?? p.ProductID ?? p.productId);
}

function getMenProductName(p) {
    return p.name || p.productName || p.ProductName || "Product";
}

function getMenProductBrand(p) {
    return String(p.brand ?? p.Brand ?? "").trim();
}

function getMenProductPrice(p) {
    return Number(p.price ?? p.Price) || 0;
}

function getMenProductSizes(p) {
    return getOptionList(p.sizes ?? p.Sizes ?? p.size ?? p.Size);
}

function getMenProductColors(p) {
    return getOptionList(p.colors ?? p.Colors ?? p.color ?? p.Color);
}

/* Products table has Category, not SubCategory */
function getMenProductCategory(p) {
    return String(p.category ?? p.Category ?? "").trim();
}

function getMenStockStatus(p) {
    const status = String(p.stockStatus || p.StockStatus || "").trim();

    if (status) return status;

    const stock = Number(p.availableStock ?? p.AvailableStock ?? 0);

    if (stock <= 0) return "Out of Stock";
    if (stock <= 5) return "Low Stock";
    if (stock <= 15) return "Medium Stock";
    return "High Stock";
}

/* =========================================================
   LOAD PRODUCTS FROM MYSQL
========================================================= */

async function loadMenProducts() {
    const box = document.getElementById("products");
    if (!box) return;

    try {
        box.innerHTML = "<p>Loading men's products...</p>";

        const response = await fetch("/api/products?category=men");

        if (!response.ok) {
            throw new Error("Products API error: " + response.status);
        }

        const result = await response.json();

        menProducts = Array.isArray(result)
            ? result
            : result.products || result.data || [];

        if (!Array.isArray(menProducts)) {
            throw new Error("Invalid products response");
        }

        console.log("MEN PRODUCTS FROM MYSQL:", menProducts);

        createMenFilterOptions();
        setupMenFilters();
        setupMenSearch();
        setupMenOptionButtons();
        displayMenProducts();

    } catch (error) {
        console.error("Men products error:", error);

        box.innerHTML = `
            <div class="error-message">
                <h3>Unable to load men's products</h3>
                <p>Please check the server and try again.</p>
                <button onclick="loadMenProducts()">Try Again</button>
            </div>
        `;
    }
}

/* =========================================================
   FILL FILTER DROPDOWNS
========================================================= */

function fillMenDropdown(id, values, defaultText, previousValue) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;

    dropdown.innerHTML = "";

    const first = document.createElement("option");
    first.value = "";
    first.textContent = defaultText;
    dropdown.appendChild(first);

    values.forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        dropdown.appendChild(option);
    });

    const match = values.find(
        value => value.toLowerCase() === String(previousValue).toLowerCase()
    );

    dropdown.value = match || "";
}

/* =========================================================
   CREATE DYNAMIC FILTERS FROM MYSQL PRODUCTS
========================================================= */

function createMenFilterOptions() {
    const oldSize = document.getElementById("sizeFilter")?.value || "";
    const oldBrand = document.getElementById("brandFilter")?.value || "";
    const oldCategory = document.getElementById("categoryFilter")?.value || "";
    const oldPrice = document.getElementById("priceFilter")?.value || "";

    // SIZE - Products.Sizes
    const sizes = [...new Set(
        menProducts.flatMap(getMenProductSizes)
    )].sort((a, b) => {
        const ai = MEN_SIZE_ORDER.findIndex(x => x.toLowerCase() === a.toLowerCase());
        const bi = MEN_SIZE_ORDER.findIndex(x => x.toLowerCase() === b.toLowerCase());

        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });

    fillMenDropdown("sizeFilter", sizes, "All Sizes", oldSize);

    // BRAND - Products.Brand
    const brands = [...new Set(
        menProducts.map(getMenProductBrand).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    fillMenDropdown("brandFilter", brands, "All Brands", oldBrand);

    // CATEGORY - Products.Category
    const categories = [...new Set(
        menProducts.map(getMenProductCategory).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    fillMenDropdown("categoryFilter", categories, "All Categories", oldCategory);

    // PRICE - Products.Price
    const prices = menProducts
        .map(getMenProductPrice)
        .filter(x => Number.isFinite(x) && x >= 0);

    const priceFilter = document.getElementById("priceFilter");

    if (priceFilter) {
        priceFilter.innerHTML = '<option value="">All Prices</option>';

        if (prices.length) {
            const min = Math.floor(Math.min(...prices) / 500) * 500;
            const max = Math.ceil(Math.max(...prices) / 500) * 500;

            const end = max <= min ? min + 500 : max;

            for (let start = min; start < end; start += 500) {
                const option = document.createElement("option");
                option.value = `${start}-${start + 500}`;
                option.textContent =
                    `₹${start.toLocaleString("en-IN")} - ₹${(start + 500).toLocaleString("en-IN")}`;
                priceFilter.appendChild(option);
            }
        }

        priceFilter.value = [...priceFilter.options].some(
            option => option.value === oldPrice
        ) ? oldPrice : "";
    }
}

/* =========================================================
   FILTER AND SEARCH PRODUCTS
========================================================= */

function displayMenProducts() {
    const box = document.getElementById("products");
    if (!box) return;

    const size = document.getElementById("sizeFilter")?.value || "";
    const brand = document.getElementById("brandFilter")?.value || "";
    const category = document.getElementById("categoryFilter")?.value || "";
    const priceRange = document.getElementById("priceFilter")?.value || "";

    const filtered = menProducts.filter(p => {
        const name = getMenProductName(p);
        const productBrand = getMenProductBrand(p);
        const productCategory = getMenProductCategory(p);
        const price = getMenProductPrice(p);

        if (menSearchText) {
            const searchData = [
                name,
                productBrand,
                productCategory,
                p.description || p.Description || "",
                getMenProductSizes(p).join(" "),
                getMenProductColors(p).join(" ")
            ].join(" ").toLowerCase();

            if (!searchData.includes(menSearchText)) return false;
        }

        if (size && !getMenProductSizes(p).some(
            x => x.toLowerCase() === size.toLowerCase()
        )) return false;

        if (brand && productBrand.toLowerCase() !== brand.toLowerCase()) {
            return false;
        }

        if (category && productCategory.toLowerCase() !== category.toLowerCase()) {
            return false;
        }

        if (priceRange) {
            const [min, max] = priceRange.split("-").map(Number);
            if (price < min || price >= max) return false;
        }

        return true;
    });

    box.innerHTML = filtered.length
        ? filtered.map(createMenProductHTML).join("")
        : `<div class="no-products">
               <h3>No products found</h3>
               <p>Try changing your filters.</p>
           </div>`;

    const count = document.getElementById("productCount");
    if (count) count.textContent = `${filtered.length} Products`;

    const message = document.getElementById("pageSearchMessage");
    if (message) {
        message.style.display = menSearchText ? "block" : "none";
        message.textContent = menSearchText
            ? `${filtered.length} product(s) found for "${menSearchText}"`
            : "";
    }
}

/* =========================================================
   PRODUCT CARD
========================================================= */

function createMenProductHTML(p) {
    const id = getMenProductId(p);
    const name = getMenProductName(p);
    const brand = getMenProductBrand(p);
    const price = getMenProductPrice(p);
    const stockStatus = getMenStockStatus(p);

    const description = String(p.description ?? p.Description ?? "").trim();

    let image = p.image || p.imageUrl || p.ImagePath || p.photo ||
        "../images/placeholder.jpg";

    if (
        image &&
        !image.startsWith("http") &&
        !image.startsWith("/") &&
        !image.startsWith("../")
    ) {
        image = "../images/" + image;
    }

    const sizes = getMenProductSizes(p);
    const colors = getMenProductColors(p);

    const sizeHTML = sizes.length
        ? `<div class="variant-section">
               <p class="variant-heading">Select Size</p>
               <div class="variant-options">
                   ${sizes.map(s => `
                       <button type="button"
                           class="variant-option size-option"
                           data-option-type="size"
                           data-option-value="${escapeMenHTML(s)}"
                           aria-pressed="false">
                           ${escapeMenHTML(s)}
                       </button>
                   `).join("")}
               </div>
           </div>`
        : `<div class="variant-section">
               <p class="variant-heading">Size</p>
               <span class="variant-unavailable">Free Size</span>
           </div>`;

    const colorHTML = colors.length
        ? `<div class="variant-section">
               <p class="variant-heading">Select Colour</p>
               <div class="variant-options">
                   ${colors.map(c => `
                       <button type="button"
                           class="variant-option color-option"
                           data-option-type="color"
                           data-option-value="${escapeMenHTML(c)}"
                           aria-pressed="false">
                           ${escapeMenHTML(c)}
                       </button>
                   `).join("")}
               </div>
           </div>`
        : "";

    return `
        <div class="product" data-product-id="${id}">
            <div class="product-image-box">
                <img src="${escapeMenHTML(image)}"
                     alt="${escapeMenHTML(name)}"
                     loading="lazy"
                     onerror="this.onerror=null;this.src='../images/placeholder.jpg';">

                <button type="button"
                    class="wishlist-heart"
                    onclick="addWishlist(${id})"
                    title="Add to Wishlist">♡</button>
            </div>

            <div class="product-details">
                <h3>${escapeMenHTML(name)}</h3>
                <p class="brand">${escapeMenHTML(brand)}</p>
                <p class="price">₹${price.toLocaleString("en-IN")}</p>

                <div class="stock-status">
                    ${escapeMenHTML(stockStatus)}
                </div>

                <div class="product-description">
                    <strong>Description:</strong>
                    <span>${description
                        ? escapeMenHTML(description)
                        : "Description not available"}</span>
                </div>

                <div class="product-variant-selectors">
                    ${sizeHTML}
                    ${colorHTML}
                </div>

                <div class="product-buttons">
                    <button type="button" class="add-cart-btn"
                        onclick="addMenProductToCart(${id})">
                        🛒 Add to Cart
                    </button>

                    <button type="button" class="buy-now-btn"
                        onclick="buyMenNow(${id})">
                        ⚡ Buy Now
                    </button>
                </div>
            </div>
        </div>
    `;
}

/* =========================================================
   SIZE AND COLOUR SELECTION
========================================================= */

function setupMenOptionButtons() {
    const box = document.getElementById("products");

    if (!box || box.dataset.optionButtonsReady === "true") return;

    box.dataset.optionButtonsReady = "true";

    box.addEventListener("click", event => {
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

function getMenSelectedOptions(productId) {
    const card = document.querySelector(
        `.product[data-product-id="${Number(productId)}"]`
    );

    if (!card) return { size: "", color: "" };

    return {
        size: card.querySelector(
            '.variant-option[data-option-type="size"].selected'
        )?.dataset.optionValue || "",

        color: card.querySelector(
            '.variant-option[data-option-type="color"].selected'
        )?.dataset.optionValue || ""
    };
}

/* =========================================================
   ADD TO CART
========================================================= */

async function addMenProductToCart(productId) {
    const product = menProducts.find(
        p => getMenProductId(p) === Number(productId)
    );

    if (!product) {
        alert("Product not found. Please refresh.");
        return;
    }

    const selected = getMenSelectedOptions(productId);

    if (getMenProductSizes(product).length && !selected.size) {
        alert("Please select a size.");
        return;
    }

    if (getMenProductColors(product).length && !selected.color) {
        alert("Please select a colour.");
        return;
    }

    if (typeof window.addCart !== "function") {
        alert("Cart function is not loaded. Please refresh.");
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

async function buyMenNow(productId) {
    const token =
        localStorage.getItem("token") ||
        localStorage.getItem("customerToken") ||
        sessionStorage.getItem("token") ||
        sessionStorage.getItem("customerToken");

    if (!token) {
        alert("Please login before buying this product.");
        window.location.href = "login.html";
        return;
    }

    const product = menProducts.find(
        p => getMenProductId(p) === Number(productId)
    );

    if (!product) {
        alert("Product not found. Please refresh.");
        return;
    }

    const selected = getMenSelectedOptions(productId);

    if (getMenProductSizes(product).length && !selected.size) {
        alert("Please select a size.");
        return;
    }

    if (getMenProductColors(product).length && !selected.color) {
        alert("Please select a colour.");
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

function searchCurrentPage() {
    const input = document.getElementById("pageSearch");
    if (!input) return;

    menSearchText = input.value.trim().toLowerCase();
    displayMenProducts();
}

function setupMenSearch() {
    const input = document.getElementById("pageSearch");

    if (!input || input.dataset.menSearchReady === "true") return;

    input.dataset.menSearchReady = "true";

    input.addEventListener("input", function() {
        menSearchText = this.value.trim().toLowerCase();
        displayMenProducts();
    });

    input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            searchCurrentPage();
        }
    });
}

/* =========================================================
   FILTER EVENTS
========================================================= */

function setupMenFilters() {
    [
        "sizeFilter",
        "brandFilter",
        "categoryFilter",
        "priceFilter"
    ].forEach(id => {
        const element = document.getElementById(id);

        if (element && element.dataset.menFilterReady !== "true") {
            element.dataset.menFilterReady = "true";
            element.addEventListener("change", displayMenProducts);
        }
    });
}

/* =========================================================
   CLEAR FILTERS
========================================================= */

function clearMenFilters() {
    [
        "sizeFilter",
        "brandFilter",
        "categoryFilter",
        "priceFilter"
    ].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = "";
    });

    const search = document.getElementById("pageSearch");
    if (search) search.value = "";

    menSearchText = "";
    displayMenProducts();
}

/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeMenHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================================================
   START MEN PAGE
========================================================= */

function startMenPage() {
    console.log("MEN JS LOADED");

    setupMenFilters();
    setupMenSearch();
    setupMenOptionButtons();

    loadMenProducts();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startMenPage);
} else {
    startMenPage();
}

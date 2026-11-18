
"use strict";

/* =========================================================
   V MART - KIDS PRODUCTS
   MYSQL DYNAMIC FILTERS + SIZE + COLOUR + CART
========================================================= */

let kidsProducts = [];
let kidsSearchText = "";

const kidsSelections = {};

/* =========================================================
   COMMON HELPERS
========================================================= */

function getKidsValue(product, keys) {
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

function getKidsProductId(product) {
    return Number(getKidsValue(product, [
        "id", "productId", "ProductID", "productID"
    ]));
}

function getKidsProductName(product) {
    return getKidsValue(product, [
        "name", "productName", "ProductName"
    ]) || "Product";
}

function getKidsBrand(product) {
    return String(getKidsValue(product, [
        "brand", "Brand"
    ])).trim();
}

function getKidsPrice(product) {
    return Number(getKidsValue(product, [
        "price", "Price"
    ])) || 0;
}

/* =========================================================
   CATEGORY FROM MYSQL PRODUCTS TABLE

   Your Products table has Category.
   It does not have SubCategory.
========================================================= */

function getKidsCategory(product) {
    return String(getKidsValue(product, [
        "category", "Category"
    ])).trim();
}

/* =========================================================
   PARSE SIZE AND COLOUR OPTIONS
========================================================= */

function parseKidsOptions(value) {
    if (Array.isArray(value)) {
        return [...new Set(
            value.map(item => String(item).trim()).filter(Boolean)
        )];
    }

    if (value === null || value === undefined) {
        return [];
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

    // Handles compact sizes such as SMLXLXXL.
    if (/^(XXXS|XXXL|XXS|XXL|XS|XL|S|M|L)+$/i.test(text)) {
        const matches = text.match(/XXXS|XXXL|XXS|XXL|XS|XL|S|M|L/gi);
        if (matches) return [...new Set(matches)];
    }

    return [...new Set(
        text.split(/[,;|/]+/).map(item => item.trim()).filter(Boolean)
    )];
}

function getKidsSizes(product) {
    return parseKidsOptions(getKidsValue(product, [
        "sizes", "Sizes", "size", "Size"
    ]));
}

function getKidsColors(product) {
    return parseKidsOptions(getKidsValue(product, [
        "colors", "Colors", "color", "Color", "colour", "Colour"
    ]));
}

/* =========================================================
   STOCK
========================================================= */

function getKidsAvailableStock(product) {
    const values = [
        product.InventoryAvailableStock,
        product.inventoryAvailableStock,
        product.availableStock,
        product.AvailableStock,
        product.available_stock
    ];

    for (const value of values) {
        if (value !== undefined && value !== null && value !== "") {
            const stock = Number(value);
            if (Number.isFinite(stock)) return Math.max(0, stock);
        }
    }

    return 0;
}

function getKidsStockStatus(product) {
    const status = String(getKidsValue(product, [
        "stockStatus",
        "InventoryStockStatus",
        "inventoryStockStatus",
        "stock_status"
    ])).trim();

    const allowed = [
        "High Stock",
        "Medium Stock",
        "Low Stock",
        "Out of Stock"
    ];

    const matched = allowed.find(
        item => item.toLowerCase() === status.toLowerCase()
    );

    if (matched) return matched;

    const stock = getKidsAvailableStock(product);

    if (stock <= 0) return "Out of Stock";
    if (stock >= 20) return "High Stock";
    if (stock >= 6) return "Medium Stock";

    return "Low Stock";
}

/* =========================================================
   CUSTOMER TOKEN
========================================================= */

function getKidsToken() {
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

function escapeKidsHTML(value) {
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

function getKidsImage(product) {
    let image = String(getKidsValue(product, [
        "image",
        "imageUrl",
        "imageURL",
        "ImagePath",
        "photo"
    ])).trim();

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

function addKidsProductStyles() {
    if (document.getElementById("kids-product-options-style")) return;

    const style = document.createElement("style");
    style.id = "kids-product-options-style";

    style.textContent = `
        .product {
            height: auto;
        }

        .kids-options {
            padding: 10px 12px;
            width: 100%;
            box-sizing: border-box;
        }

        .kids-option-group {
            margin-bottom: 15px;
        }

        .kids-option-title {
            display: block;
            font-size: 14px;
            font-weight: 600;
            color: #222;
            margin-bottom: 10px;
        }

        .kids-option-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .kids-option-btn {
            min-width: 45px;
            min-height: 40px;
            padding: 8px 12px;
            border: 1px solid #ccc;
            border-radius: 7px;
            background: white;
            color: #333;
            cursor: pointer;
        }

        .kids-option-btn.selected {
            border: 2px solid #8f0c05;
            background: #fff5f4;
            color: #8f0c05;
            font-weight: 600;
        }

        .kids-selection-message {
            display: none;
            margin: 5px 12px 10px;
            color: #8f0c05;
            font-size: 12px;
        }

        .kids-selection-message.show {
            display: block;
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

        .product-buttons .add-cart-btn {
            background: #8f0c05;
            color: white;
        }

        .product-buttons .buy-now-btn {
            background: #222;
            color: white;
        }

        .stock-status {
            font-size: 13px;
            margin: 8px 0;
        }

        .variant-unavailable {
            color: #777;
            font-size: 13px;
        }
    `;

    document.head.appendChild(style);
}

/* =========================================================
   LOAD KIDS PRODUCTS FROM MYSQL
========================================================= */

async function loadKidsProducts() {
    const box = document.getElementById("products");

    if (!box) {
        console.error("Products container not found.");
        return;
    }

    try {
        box.innerHTML = `
            <div class="loading-message">
                Loading kids products...
            </div>
        `;

        const response = await fetch("/api/products?category=kids");

        if (!response.ok) {
            throw new Error("Server returned " + response.status);
        }

        const data = await response.json();

        kidsProducts = Array.isArray(data)
            ? data
            : Array.isArray(data.products)
                ? data.products
                : Array.isArray(data.data)
                    ? data.data
                    : [];

        console.log("KIDS PRODUCTS FROM MYSQL:", kidsProducts);

        createKidsFilterOptions();
        setupKidsSearch();
        setupKidsFilters();
        setupKidsOptionSelection();
        displayKidsProducts();

    } catch (error) {
        console.error("Kids products error:", error);

        box.innerHTML = `
            <div class="error-message">
                <h3>Unable to load kids products</h3>
                <p>Please check your server and try again.</p>
                <button type="button" onclick="loadKidsProducts()">
                    Try Again
                </button>
            </div>
        `;

        updateKidsCount(0);
    }
}

/* =========================================================
   CREATE FILTER DROPDOWNS
========================================================= */

function setKidsDropdown(id, defaultText, values, previousValue) {
    const filter = document.getElementById(id);
    if (!filter) return;

    filter.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = defaultText;
    filter.appendChild(defaultOption);

    values.forEach(item => {
        const option = document.createElement("option");
        option.value = item.value;
        option.textContent = item.label;
        filter.appendChild(option);
    });

    if (
        previousValue &&
        [...filter.options].some(option => option.value === previousValue)
    ) {
        filter.value = previousValue;
    }
}

/* =========================================================
   DYNAMIC SIZE / BRAND / CATEGORY / PRICE FILTERS
========================================================= */

function createKidsFilterOptions() {
    const oldSize = document.getElementById("sizeFilter")?.value || "";
    const oldBrand = document.getElementById("brandFilter")?.value || "";
    const oldCategory = document.getElementById("categoryFilter")?.value || "";
    const oldPrice = document.getElementById("priceFilter")?.value || "";

    // SIZE FROM Products.Sizes
    const sizes = [
        ...new Set(kidsProducts.flatMap(getKidsSizes))
    ].sort((a, b) => a.localeCompare(b));

    setKidsDropdown(
        "sizeFilter",
        "All Sizes",
        sizes.map(size => ({ value: size, label: size })),
        oldSize
    );

    // BRAND FROM Products.Brand
    const brands = [
        ...new Set(kidsProducts.map(getKidsBrand).filter(Boolean))
    ].sort((a, b) => a.localeCompare(b));

    setKidsDropdown(
        "brandFilter",
        "All Brands",
        brands.map(brand => ({ value: brand, label: brand })),
        oldBrand
    );

    // CATEGORY FROM Products.Category
    const categories = [
        ...new Set(kidsProducts.map(getKidsCategory).filter(Boolean))
    ].sort((a, b) => a.localeCompare(b));

    setKidsDropdown(
        "categoryFilter",
        "All Categories",
        categories.map(category => ({
            value: category,
            label: category
        })),
        oldCategory
    );

    // PRICE FROM Products.Price
    const prices = kidsProducts
        .map(getKidsPrice)
        .filter(price => Number.isFinite(price) && price >= 0);

    const uniquePrices = [...new Set(prices)].sort((a, b) => a - b);

    const ranges = [];

    if (uniquePrices.length) {
        const minPrice = Math.floor(uniquePrices[0] / 500) * 500;
        const maxPrice = Math.ceil(
            uniquePrices[uniquePrices.length - 1] / 500
        ) * 500;

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

    setKidsDropdown(
        "priceFilter",
        "All Prices",
        ranges.map(range => ({
            value: `${range.min}-${range.max}`,
            label:
                `₹${range.min.toLocaleString("en-IN")} - ₹${range.max.toLocaleString("en-IN")}`
        })),
        oldPrice
    );
}

/* =========================================================
   FILTER EVENT LISTENERS
========================================================= */

function setupKidsFilters() {
    [
        "sizeFilter",
        "brandFilter",
        "categoryFilter",
        "priceFilter"
    ].forEach(id => {
        const element = document.getElementById(id);

        if (element && element.dataset.kidsFilterReady !== "true") {
            element.dataset.kidsFilterReady = "true";
            element.addEventListener("change", displayKidsProducts);
        }
    });
}

/* =========================================================
   DISPLAY FILTERED PRODUCTS
========================================================= */

function displayKidsProducts() {
    const box = document.getElementById("products");
    if (!box) return;

    const size = String(
        document.getElementById("sizeFilter")?.value || ""
    ).trim().toLowerCase();

    const brand = String(
        document.getElementById("brandFilter")?.value || ""
    ).trim().toLowerCase();

    const category = String(
        document.getElementById("categoryFilter")?.value || ""
    ).trim().toLowerCase();

    const price = document.getElementById("priceFilter")?.value || "";

    const filtered = kidsProducts.filter(product => {
        const productName = getKidsProductName(product);
        const productBrand = getKidsBrand(product);
        const productCategory = getKidsCategory(product);

        if (kidsSearchText) {
            const fields = [
                productName,
                productBrand,
                productCategory,
                product.description || product.Description || "",
                getKidsSizes(product).join(" "),
                getKidsColors(product).join(" ")
            ];

            const found = fields.some(field =>
                String(field || "").toLowerCase().includes(kidsSearchText)
            );

            if (!found) return false;
        }

        if (size) {
            const productSizes = getKidsSizes(product)
                .map(item => item.toLowerCase());

            if (!productSizes.includes(size)) return false;
        }

        if (brand && productBrand.toLowerCase() !== brand) {
            return false;
        }

        if (category && productCategory.toLowerCase() !== category) {
            return false;
        }

        if (price) {
            const [min, max] = price.split("-").map(Number);
            const productPrice = getKidsPrice(product);

            if (productPrice < min || productPrice > max) {
                return false;
            }
        }

        return true;
    });

    if (!filtered.length) {
        box.innerHTML = `
            <div class="no-products">
                <div class="no-products-icon">🔍</div>
                <h3>No products found</h3>
                <p>No kids products found for the selected filters.</p>
            </div>
        `;
    } else {
        box.innerHTML = filtered.map(createKidsProductHTML).join("");
    }

    updateKidsCount(filtered.length);

    const message = document.getElementById("pageSearchMessage");

    if (message) {
        message.style.display = kidsSearchText ? "block" : "none";
        message.textContent = kidsSearchText
            ? `${filtered.length} product(s) found for "${kidsSearchText}"`
            : "";
    }
}

/* =========================================================
   PRODUCT COUNT
========================================================= */

function updateKidsCount(count) {
    const element = document.getElementById("productCount");

    if (element) {
        element.textContent = `${count} Products`;
    }
}

/* =========================================================
   PRODUCT CARD
========================================================= */

function createKidsProductHTML(product) {
    const productId = getKidsProductId(product);
    const productName = getKidsProductName(product);
    const productBrand = getKidsBrand(product);
    const productPrice = getKidsPrice(product);

    const description = String(
        product.description ?? product.Description ?? ""
    ).trim();

    const image = getKidsImage(product);

    const stockStatus = getKidsStockStatus(product);
    const stockClass = stockStatus.toLowerCase().replace(/\s+/g, "-");

    const sizes = getKidsSizes(product);
    const colors = getKidsColors(product);

    const selection = initializeKidsSelection(productId);

    const sizeButtons = sizes.length
        ? sizes.map(item => {
            const selected = selection.size === item ? "selected" : "";

            return `
                <button
                    type="button"
                    class="kids-option-btn ${selected}"
                    data-product-id="${productId}"
                    data-option-type="size"
                    data-option-value="${escapeKidsHTML(item)}"
                    aria-pressed="${selected ? "true" : "false"}"
                >
                    ${escapeKidsHTML(item)}
                </button>
            `;
        }).join("")
        : `<span class="variant-unavailable">Size not available</span>`;

    const colorButtons = colors.length
        ? colors.map(item => {
            const selected =
                selection.color.toLowerCase() === item.toLowerCase()
                    ? "selected"
                    : "";

            return `
                <button
                    type="button"
                    class="kids-option-btn ${selected}"
                    data-product-id="${productId}"
                    data-option-type="color"
                    data-option-value="${escapeKidsHTML(item)}"
                    aria-pressed="${selected ? "true" : "false"}"
                >
                    ${escapeKidsHTML(item)}
                </button>
            `;
        }).join("")
        : `<span class="variant-unavailable">Colour not available</span>`;

    return `
        <div class="product" data-product-id="${productId}">

            <div class="product-image-box">
                <img
                    src="${escapeKidsHTML(image)}"
                    alt="${escapeKidsHTML(productName)}"
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
                <h3>${escapeKidsHTML(productName)}</h3>

                <p class="brand">
                    ${escapeKidsHTML(productBrand)}
                </p>

                <p class="price">
                    ₹${productPrice.toLocaleString("en-IN")}
                </p>

                <div class="stock-status ${stockClass}">
                    ${escapeKidsHTML(stockStatus)}
                </div>

                <div class="product-description">
                    <strong>Description:</strong>
                    <span>
                        ${description
                            ? escapeKidsHTML(description)
                            : "Description not available"}
                    </span>
                </div>
            </div>

            <div class="kids-options">

                <div class="kids-option-group">
                    <span class="kids-option-title">Select Size</span>
                    <div class="kids-option-buttons">
                        ${sizeButtons}
                    </div>
                </div>

                <div class="kids-option-group">
                    <span class="kids-option-title">Select Colour</span>
                    <div class="kids-option-buttons">
                        ${colorButtons}
                    </div>
                </div>

            </div>

            <p
                class="kids-selection-message"
                id="kids-message-${productId}"
            ></p>

            <div class="product-buttons">
                <button
                    type="button"
                    class="add-cart-btn"
                    onclick="addKidsToCart(${productId})"
                >
                    🛒 Add to Cart
                </button>

                <button
                    type="button"
                    class="buy-now-btn"
                    onclick="buyKidsNow(${productId})"
                >
                    ⚡ Buy Now
                </button>
            </div>

        </div>
    `;
}

/* =========================================================
   INITIALIZE PRODUCT SIZE / COLOUR SELECTION
========================================================= */

function initializeKidsSelection(productId) {
    if (!kidsSelections[productId]) {
        kidsSelections[productId] = {
            size: "",
            color: ""
        };
    }

    return kidsSelections[productId];
}

/* =========================================================
   SELECT SIZE AND COLOUR
========================================================= */

function setupKidsOptionSelection() {
    const box = document.getElementById("products");

    if (!box || box.dataset.kidsOptionsReady === "true") {
        return;
    }

    box.dataset.kidsOptionsReady = "true";

    box.addEventListener("click", function(event) {
        const button = event.target.closest(".kids-option-btn");

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

        const selection = initializeKidsSelection(productId);
        selection[optionType] = optionValue;

        const group = button.closest(".kids-option-buttons");

        if (group) {
            group.querySelectorAll(".kids-option-btn").forEach(item => {
                const selected = item === button;

                item.classList.toggle("selected", selected);
                item.setAttribute("aria-pressed", String(selected));
            });
        }

        const message = document.getElementById(
            `kids-message-${productId}`
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

function validateKidsSelection(productId) {
    const product = kidsProducts.find(
        item => getKidsProductId(item) === Number(productId)
    );

    if (!product) {
        alert("Product not found. Please refresh the page.");
        return false;
    }

    const sizes = getKidsSizes(product);
    const colors = getKidsColors(product);
    const selection = initializeKidsSelection(productId);

    const message = document.getElementById(
        `kids-message-${productId}`
    );

    if (sizes.length && !selection.size) {
        if (message) {
            message.textContent = "Please select a size.";
            message.classList.add("show");
        }

        alert("Please select a size.");
        return false;
    }

    if (colors.length && !selection.color) {
        if (message) {
            message.textContent = "Please select a colour.";
            message.classList.add("show");
        }

        alert("Please select a colour.");
        return false;
    }

    return true;
}

/* =========================================================
   ADD TO CART
========================================================= */

async function addKidsToCart(productId) {
    const token = getKidsToken();

    if (!token) {
        alert("Please login to add products to your cart.");
        window.location.href = "login.html";
        return;
    }

    if (!validateKidsSelection(productId)) return;

    const selection = initializeKidsSelection(productId);

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
            "Kids product added to cart successfully!"
        );

    } catch (error) {
        console.error("Kids Add to Cart Error:", error);
        alert(error.message || "Unable to add product to cart.");
    }
}

/* =========================================================
   BUY NOW
========================================================= */

async function buyKidsNow(productId) {
    const token = getKidsToken();

    if (!token) {
        alert("Please login to continue.");
        window.location.href = "login.html";
        return;
    }

    if (!validateKidsSelection(productId)) return;

    const selection = initializeKidsSelection(productId);

    const params = new URLSearchParams();

    params.set("buyNow", String(productId));
    params.set("quantity", "1");
    params.set("size", selection.size);
    params.set("color", selection.color);

    window.location.href = "checkout.html?" + params.toString();
}

/* =========================================================
   SEARCH
========================================================= */

function searchKidsProducts() {
    const input = document.getElementById("pageSearch");
    if (!input) return;

    kidsSearchText = input.value.trim().toLowerCase();
    displayKidsProducts();
}

function searchCurrentPage() {
    searchKidsProducts();
}

function setupKidsSearch() {
    const input = document.getElementById("pageSearch");

    if (!input || input.dataset.kidsSearchReady === "true") {
        return;
    }

    input.dataset.kidsSearchReady = "true";

    input.addEventListener("input", function() {
        kidsSearchText = this.value.trim().toLowerCase();
        displayKidsProducts();
    });

    input.addEventListener("keydown", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            searchKidsProducts();
        }
    });
}

/* =========================================================
   START KIDS PAGE
========================================================= */

function startKidsPage() {
    console.log("V MART KIDS PAGE STARTED");

    addKidsProductStyles();
    setupKidsSearch();
    setupKidsFilters();
    setupKidsOptionSelection();

    loadKidsProducts();
}

/* =========================================================
   PAGE INITIALIZATION
========================================================= */

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startKidsPage);
} else {
    startKidsPage();
}

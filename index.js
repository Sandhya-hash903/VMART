"use strict";


/* =========================================================
   PRODUCT CARD
========================================================= */

function productHTML(product) {

    const productId = Number(product.id || 0);

    const name =
        product.name ||
        "Product";

    const brand =
        product.brand ||
        "";

    const price =
        Number(product.price || 0);


    /* =====================================================
       PRODUCT IMAGE
    ===================================================== */

    let image =
        product.image ||
        product.imageUrl ||
        product.imageURL ||
        product.photo ||
        "";


    /*
     * If no image is available,
     * use placeholder image.
     */

    if (!image) {

        image = "../images/placeholder.jpg";

    }


    /*
     * If the database contains only
     * an image filename such as:
     *
     * shirt.jpg
     *
     * automatically use:
     *
     * ../images/shirt.jpg
     */

    else if (
        !image.startsWith("http://") &&
        !image.startsWith("https://") &&
        !image.startsWith("/") &&
        !image.startsWith("../")
    ) {

        image = "../images/" + image;

    }


    return `
        <div class="product-card">

            <div
                class="product-image-wrapper"
                onclick="viewProduct(${productId})"
            >

                <img
                    src="${image}"
                    alt="${escapeHTML(name)}"
                    class="product-image"
                    onerror="this.onerror=null; this.src='../images/placeholder.jpg';"
                >

            </div>


            <div class="product-info">

                <h3>
                    ${escapeHTML(name)}
                </h3>


                ${
                    brand
                        ? `
                            <p class="product-brand">
                                ${escapeHTML(brand)}
                            </p>
                          `
                        : ""
                }


                <p class="product-price">
                    ₹${price.toLocaleString("en-IN")}
                </p>


                <button
                    type="button"
                    class="view-product-btn"
                    onclick="viewProduct(${productId})"
                >
                    View Product
                </button>

            </div>

        </div>
    `;
}


/* =========================================================
   VIEW PRODUCT
========================================================= */

function viewProduct(productId) {

    if (!productId) {

        console.error(
            "Product ID is missing."
        );

        return;
    }


    window.location.href =
        "product.html?id=" +
        encodeURIComponent(productId);
}


/* =========================================================
   LOAD TRENDING PRODUCTS
========================================================= */

async function loadTrendingProducts() {

    const box =
        document.getElementById("products");


    if (!box) {

        console.error(
            "Home page products container #products not found."
        );

        return;
    }


    try {

        /*
         * Loading message
         */

        box.innerHTML =
            `
                <p class="products-loading">
                    Loading products...
                </p>
            `;


        /*
         * Get products from server
         */

        const response =
            await fetch("/api/products");


        /*
         * Check API response
         */

        if (!response.ok) {

            throw new Error(
                "Products API returned status " +
                response.status
            );
        }


        /*
         * Convert response to JSON
         */

        const data =
            await response.json();


        console.log(
            "Products API Response:",
            data
        );


        /*
         * Support different API response formats
         *
         * Format 1:
         * [
         *   {...},
         *   {...}
         * ]
         *
         * Format 2:
         * {
         *   products: [...]
         * }
         *
         * Format 3:
         * {
         *   data: [...]
         * }
         */

        let products = [];


        if (Array.isArray(data)) {

            products = data;

        }

        else if (
            data &&
            Array.isArray(data.products)
        ) {

            products =
                data.products;

        }

        else if (
            data &&
            Array.isArray(data.data)
        ) {

            products =
                data.data;

        }


        /*
         * Check whether products exist
         */

        if (
            !Array.isArray(products) ||
            products.length === 0
        ) {

            box.innerHTML =
                `
                    <p class="no-products-message">
                        No products available.
                    </p>
                `;

            return;
        }


        console.log(
            "Total Products:",
            products.length
        );


        /* =================================================
           SHOW FIRST 4 TRENDING PRODUCTS
        ================================================= */

        const trendingProducts =
            products.slice(0, 4);


        /*
         * Display product cards
         */

        box.innerHTML =
            trendingProducts
                .map(function (product) {

                    return productHTML(product);

                })
                .join("");


    }

    catch (error) {

        console.error(
            "TRENDING PRODUCTS ERROR:",
            error
        );


        box.innerHTML =
            `
                <p class="no-products-message">
                    Unable to load products.
                </p>
            `;
    }
}


/* =========================================================
   SEARCH PRODUCTS
========================================================= */

function performSearch() {

    const searchInput =
        document.getElementById("searchInput");


    if (!searchInput) {

        console.error(
            "Search input #searchInput not found."
        );

        return;
    }


    const searchText =
        searchInput.value.trim();


    /*
     * Do not search empty text
     */

    if (searchText === "") {

        alert(
            "Please enter a product name to search."
        );

        searchInput.focus();

        return;
    }


    /*
     * Open categories page with
     * search text.
     *
     * Example:
     *
     * categories.html?search=shirt
     */

    window.location.href =
        "categories.html?search=" +
        encodeURIComponent(searchText);
}


/* =========================================================
   SEARCH USING ENTER KEY
========================================================= */

function setupSearch() {

    const searchInput =
        document.getElementById("searchInput");


    if (!searchInput) {

        console.log(
            "Search input not found on this page."
        );

        return;
    }


    searchInput.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Enter") {

                event.preventDefault();

                performSearch();

            }

        }
    );
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );
}


/* =========================================================
   START HOME PAGE
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        /*
         * Load trending products
         */

        loadTrendingProducts();


        /*
         * Activate search bar
         */

        setupSearch();

    }
);
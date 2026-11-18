
"use strict";

/* =========================================================
   V MART - CART PAGE
   Smooth quantity updates without page blinking
========================================================= */

function getToken() {
    return localStorage.getItem("token");
}

function loginRequired() {
    if (!getToken()) {
        window.location.href = "login.html";
        return false;
    }
    return true;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================================================
   CART API
========================================================= */

async function cartApi(url, options = {}) {
    const token = getToken();

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
            throw new Error("Your session expired. Please log in again.");
        }

        throw new Error(
            data.message || data.error || "Request failed."
        );
    }

    return data;
}

/* =========================================================
   CART DATA HELPERS
========================================================= */

function getCartProductId(item) {
    return Number(
        item?.productId ??
        item?.product_id ??
        item?.ProductID ??
        item?.id ??
        item?.product?.id ??
        item?.product?.ProductID ??
        0
    );
}

function getCartSize(item) {
    return String(
        item?.size ??
        item?.Size ??
        item?.selectedSize ??
        item?.selected_size ??
        item?.productSize ??
        item?.product_size ??
        ""
    ).trim();
}

function getCartColor(item) {
    return String(
        item?.color ??
        item?.colour ??
        item?.Color ??
        item?.Colour ??
        item?.selectedColor ??
        item?.selectedColour ??
        item?.selected_color ??
        item?.selected_colour ??
        ""
    ).trim();
}

function getCartQuantity(item) {
    return Math.max(
        1,
        Number(item?.quantity ?? item?.qty ?? 1) || 1
    );
}

function normalizeCartResponse(result) {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.cart)) return result.cart;
    if (Array.isArray(result?.items)) return result.items;

    return [];
}

/* =========================================================
   FIND CART ITEM IN CURRENT PAGE
========================================================= */

function findCartItem(productId, size = "", color = "") {
    const items = document.querySelectorAll(".cart-item");

    return Array.from(items).find(item => {
        return (
            Number(item.dataset.productId) === Number(productId) &&
            item.dataset.size === String(size || "") &&
            item.dataset.color === String(color || "")
        );
    });
}

/* =========================================================
   UPDATE CART TOTAL WITHOUT RELOADING
========================================================= */

function updateCartSummary() {
    const cartItems = document.querySelectorAll(".cart-item");

    let total = 0;
    let quantityCount = 0;

    cartItems.forEach(item => {
        const price = Number(item.dataset.price || 0);

        const quantityElement =
            item.querySelector(".cart-quantity");

        const quantity = Number(
            quantityElement?.textContent || 1
        );

        const itemTotal = price * quantity;

        item.dataset.lineTotal = String(itemTotal);

        total += itemTotal;
        quantityCount += quantity;
    });

    const totalBox = document.getElementById("cartTotal");

    if (totalBox) {
        totalBox.textContent =
            "₹" + total.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
    }

    document.querySelectorAll("#cartCount, .cart-count")
        .forEach(element => {
            element.textContent = String(quantityCount);
        });
}

/* =========================================================
   LOAD CART
========================================================= */

async function loadCart() {
    if (!loginRequired()) return;

    const box = document.getElementById("cartItems");
    const totalBox = document.getElementById("cartTotal");

    if (!box) return;

    box.innerHTML = `
        <div class="cart-loading">
            Loading your shopping cart...
        </div>
    `;

    if (totalBox) {
        totalBox.textContent = "₹0.00";
    }

    try {
        const result = await cartApi("/cart");
        const items = normalizeCartResponse(result);

        console.log("VMART CART ITEMS:", items);

        if (!items.length) {
            showEmptyCart(box, totalBox);
            updateCartCountFromPage();
            return;
        }

        let html = "";
        let validProducts = 0;

        for (const item of items) {
            const productId = getCartProductId(item);

            if (!productId) {
                console.error("Invalid cart product:", item);
                continue;
            }

            try {
                const product =
                    item.product ||
                    await cartApi("/products/" + productId);

                if (!product || product.message) continue;

                const quantity = getCartQuantity(item);
                const size = getCartSize(item);
                const color = getCartColor(item);

                const price = Number(
                    product.price ?? product.Price ?? 0
                );

                if (!Number.isFinite(price) || price < 0) {
                    continue;
                }

                const amount = price * quantity;

                const image = String(
                    product.image ?? product.ImagePath ?? ""
                );

                const name = String(
                    product.name ?? product.ProductName ?? "Product"
                );

                const brand = String(
                    product.brand ?? product.Brand ?? ""
                );

                const sizeArg = JSON.stringify(size);
                const colorArg = JSON.stringify(color);

                validProducts++;

                html += `
                    <div
                        class="cart-item"
                        data-product-id="${productId}"
                        data-size="${escapeHtml(size)}"
                        data-color="${escapeHtml(color)}"
                        data-price="${price}"
                        data-line-total="${amount}"
                    >

                        <img
                            src="${escapeHtml(image)}"
                            alt="${escapeHtml(name)}"
                            class="cart-product-image"
                            onerror="this.onerror=null;this.src='https://placehold.co/300x400?text=V+MART';"
                        >

                        <div class="cart-info">

                            <h3>${escapeHtml(name)}</h3>

                            ${brand ? `
                                <p class="cart-brand">
                                    Brand: ${escapeHtml(brand)}
                                </p>
                            ` : ""}

                            <p class="cart-size">
                                Size: ${size
                                    ? escapeHtml(size)
                                    : "Not selected"}
                            </p>

                            <p class="cart-color">
                                Colour: ${color
                                    ? escapeHtml(color)
                                    : "Not selected"}
                            </p>

                            <p class="cart-price">
                                ₹${price.toLocaleString("en-IN")} ×
                                <span class="cart-price-quantity">
                                    ${quantity}
                                </span>
                            </p>

                            <p class="cart-item-total">
                                Item Total:
                                <strong>
                                    ₹${amount.toLocaleString("en-IN")}
                                </strong>
                            </p>

                            <div class="cart-controls">

                                <button
                                    type="button"
                                    class="quantity-btn"
                                    onclick='changeCartQuantity(
                                        ${productId},
                                        -1,
                                        ${sizeArg},
                                        ${colorArg}
                                    )'
                                    aria-label="Decrease quantity"
                                >−</button>

                                <strong class="cart-quantity">
                                    ${quantity}
                                </strong>

                                <button
                                    type="button"
                                    class="quantity-btn"
                                    onclick='changeCartQuantity(
                                        ${productId},
                                        1,
                                        ${sizeArg},
                                        ${colorArg}
                                    )'
                                    aria-label="Increase quantity"
                                >+</button>

                            </div>

                            <div class="cart-actions">

                                <button
                                    type="button"
                                    class="individual-checkout-btn"
                                    onclick='checkoutSingleItem(
                                        ${productId},
                                        ${quantity},
                                        ${sizeArg},
                                        ${colorArg}
                                    )'
                                >
                                    Buy Now
                                </button>

                                <button
                                    type="button"
                                    class="remove-btn"
                                    onclick='removeCart(
                                        ${productId},
                                        ${sizeArg},
                                        ${colorArg}
                                    )'
                                >
                                    Remove
                                </button>

                            </div>

                        </div>
                    </div>
                `;

            } catch (productError) {
                console.error(
                    "Unable to load product:",
                    productId,
                    productError
                );
            }
        }

        if (validProducts === 0) {
            showEmptyCart(box, totalBox);
            updateCartCountFromPage();
            return;
        }

        box.innerHTML = html;

        updateCartSummary();

        console.log("Cart loaded successfully.");

    } catch (error) {
        console.error("Cart loading error:", error);

        box.innerHTML = `
            <div class="cart-error">
                <h3>Unable to load shopping cart</h3>
                <p>${escapeHtml(error.message)}</p>

                <button
                    type="button"
                    onclick="loadCart()"
                >
                    Try Again
                </button>
            </div>
        `;

        if (totalBox) {
            totalBox.textContent = "₹0.00";
        }
    }
}

/* =========================================================
   EMPTY CART
========================================================= */

function showEmptyCart(box, totalBox) {
    if (box) {
        box.innerHTML = `
            <div class="empty-cart">
                <h3>Your cart is empty</h3>

                <p>
                    You haven't added any products yet.
                </p>

                <a href="categories.html">
                    Continue Shopping
                </a>
            </div>
        `;
    }

    if (totalBox) {
        totalBox.textContent = "₹0.00";
    }

    updateCartCountFromPage();
}

/* =========================================================
   CHANGE QUANTITY
   Reads the latest quantity from the page
========================================================= */

async function changeCartQuantity(
    productId,
    change,
    size = "",
    color = ""
) {
    const cartItem = findCartItem(productId, size, color);

    if (!cartItem) return;

    const quantityElement =
        cartItem.querySelector(".cart-quantity");

    const currentQuantity = Number(
        quantityElement?.textContent || 1
    );

    const newQuantity = currentQuantity + Number(change);

    if (newQuantity < 1) {
        await removeCart(productId, size, color);
        return;
    }

    await updateQuantity(
        productId,
        newQuantity,
        size,
        color
    );
}

/* =========================================================
   UPDATE QUANTITY
   NO PAGE RELOAD
========================================================= */

async function updateQuantity(
    productId,
    quantity,
    size = "",
    color = ""
) {
    productId = Number(productId);
    quantity = Number(quantity);

    if (!productId || !Number.isInteger(quantity)) {
        alert("Invalid product or quantity.");
        return;
    }

    if (quantity < 1) {
        await removeCart(productId, size, color);
        return;
    }

    const cartItem = findCartItem(productId, size, color);

    if (!cartItem) return;

    const buttons = cartItem.querySelectorAll(
        ".quantity-btn"
    );

    // Prevent multiple rapid clicks while updating.
    buttons.forEach(button => {
        button.disabled = true;
    });

    try {
        // Update database first.
        await cartApi("/cart/" + productId, {
            method: "PUT",

            body: JSON.stringify({
                quantity: quantity,
                size: size,
                color: color
            })
        });

        // Update only the selected product on the page.
        const quantityElement =
            cartItem.querySelector(".cart-quantity");

        const priceQuantityElement =
            cartItem.querySelector(".cart-price-quantity");

        const itemTotalElement =
            cartItem.querySelector(".cart-item-total strong");

        const price = Number(cartItem.dataset.price || 0);

        const newAmount = price * quantity;

        if (quantityElement) {
            quantityElement.textContent = String(quantity);
        }

        if (priceQuantityElement) {
            priceQuantityElement.textContent = String(quantity);
        }

        if (itemTotalElement) {
            itemTotalElement.textContent =
                "₹" + newAmount.toLocaleString("en-IN");
        }

        cartItem.dataset.lineTotal = String(newAmount);

        // Recalculate overall cart total and count.
        updateCartSummary();

        console.log(
            "Quantity updated:",
            productId,
            quantity,
            size,
            color
        );

    } catch (error) {
        console.error("Quantity update error:", error);

        alert(error.message || "Unable to update quantity.");

    } finally {
        // Enable buttons again.
        buttons.forEach(button => {
            button.disabled = false;
        });
    }
}

/* =========================================================
   REMOVE CART ITEM
========================================================= */

async function removeCart(
    productId,
    size = "",
    color = ""
) {
    productId = Number(productId);

    if (!productId) {
        alert("Invalid product.");
        return;
    }

    if (!confirm(
        "Are you sure you want to remove this product from your cart?"
    )) {
        return;
    }

    const cartItem = findCartItem(productId, size, color);

    try {
        const params = new URLSearchParams();

        params.set("size", size || "");
        params.set("color", color || "");

        await cartApi(
            "/cart/" + productId + "?" + params.toString(),
            {
                method: "DELETE"
            }
        );

        // Remove only the selected item.
        if (cartItem) {
            cartItem.remove();
        }

        const remainingItems =
            document.querySelectorAll(".cart-item");

        if (!remainingItems.length) {
            const box = document.getElementById("cartItems");
            const totalBox = document.getElementById("cartTotal");

            showEmptyCart(box, totalBox);
        } else {
            updateCartSummary();
        }

    } catch (error) {
        console.error("Remove cart error:", error);

        alert(error.message || "Unable to remove product.");
    }
}

/* =========================================================
   BUY NOW - INDIVIDUAL PRODUCT
========================================================= */

function checkoutSingleItem(
    productId,
    quantity,
    size = "",
    color = ""
) {
    productId = Number(productId);
    quantity = Math.max(1, Number(quantity) || 1);

    if (!productId) {
        alert("Invalid product.");
        return;
    }

    sessionStorage.setItem(
        "checkoutProductId",
        String(productId)
    );

    sessionStorage.setItem(
        "checkoutQuantity",
        String(quantity)
    );

    sessionStorage.setItem(
        "checkoutSize",
        String(size || "")
    );

    sessionStorage.setItem(
        "checkoutColor",
        String(color || "")
    );

    sessionStorage.removeItem("checkoutItems");

    const checkoutUrl =
        "checkout.html" +
        "?buyNow=" + encodeURIComponent(productId) +
        "&quantity=" + encodeURIComponent(quantity) +
        "&fromCart=true" +
        "&size=" + encodeURIComponent(size || "") +
        "&color=" + encodeURIComponent(color || "");

    window.location.href = checkoutUrl;
}

/* =========================================================
   UPDATE CART COUNT
========================================================= */

function updateCartCountFromPage() {
    const items = document.querySelectorAll(".cart-item");

    let count = 0;

    items.forEach(item => {
        const quantity = Number(
            item.querySelector(".cart-quantity")?.textContent || 0
        );

        count += quantity;
    });

    document.querySelectorAll("#cartCount, .cart-count")
        .forEach(element => {
            element.textContent = String(count);
        });
}

async function updateCartCount() {
    const countElements = document.querySelectorAll(
        "#cartCount, .cart-count"
    );

    if (!countElements.length) return;

    if (!getToken()) {
        countElements.forEach(element => {
            element.textContent = "0";
        });

        return;
    }

    try {
        const result = await cartApi("/cart");

        const items = normalizeCartResponse(result);

        const count = items.reduce(
            (total, item) => {
                return total + getCartQuantity(item);
            },
            0
        );

        countElements.forEach(element => {
            element.textContent = String(count);
        });

    } catch (error) {
        console.error("Cart count error:", error);
    }
}

/* =========================================================
   CONTINUE SHOPPING
========================================================= */

function continueShopping() {
    window.location.href = "categories.html";
}

/* =========================================================
   REFRESH CART - MANUAL ONLY
========================================================= */

function refreshCart() {
    loadCart();
}

/* =========================================================
   PAGE LOAD
========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    if (!loginRequired()) return;

    loadCart();
});

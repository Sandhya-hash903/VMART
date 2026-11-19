
"use strict";

console.log("V MART ORDERS JS LOADED");

/* =========================================================
   AUTHENTICATION
========================================================= */

function getCustomerToken() {
    return (
        localStorage.getItem("token") ||
        localStorage.getItem("customerToken") ||
        sessionStorage.getItem("token") ||
        sessionStorage.getItem("customerToken") ||
        ""
    );
}

const token = getCustomerToken();

if (!token) {
    window.location.replace("login.html");
}

/* =========================================================
   WHATSAPP SETTINGS
========================================================= */

// India country code + WhatsApp number
const EXCHANGE_WHATSAPP_NUMBER = "919993589997";

// Store loaded orders for the Exchange Order button
const ordersById = new Map();

/* =========================================================
   API HELPERS
========================================================= */

async function readResponse(response) {
    try {
        return await response.json();
    } catch (error) {
        return {
            message: "Invalid server response. Please try again."
        };
    }
}

function handleUnauthorized(response) {
    if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("customerToken");
        localStorage.removeItem("customer");

        sessionStorage.removeItem("token");
        sessionStorage.removeItem("customerToken");

        window.location.replace("login.html");
        return true;
    }

    return false;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatPrice(value) {
    return Number(value || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 2
    });
}

/* =========================================================
   ORDER ITEMS
========================================================= */

function getOrderItems(order) {
    let items = order.items ?? order.Items ?? [];

    if (typeof items === "string") {
        try {
            items = JSON.parse(items);
        } catch (error) {
            console.error("ORDER ITEMS ERROR:", error);
            items = [];
        }
    }

    return Array.isArray(items) ? items : [];
}

/* =========================================================
   PRODUCT IMAGE
========================================================= */

function getProductImage(item) {
    const image =
        item.image ??
        item.ImagePath ??
        item.productImage ??
        item.product_image ??
        "";

    return String(image).trim() || "../images/no-image.png";
}

/* =========================================================
   ORDER ITEM DETAILS
========================================================= */

function getItemName(item) {
    return (
        item.name ??
        item.productName ??
        item.product_name ??
        "Product"
    );
}

function getItemSize(item) {
    return (
        item.size ??
        item.Size ??
        item.selectedSize ??
        item.selected_size ??
        ""
    );
}

function getItemColor(item) {
    return (
        item.color ??
        item.Color ??
        item.colour ??
        item.Colour ??
        item.selectedColor ??
        item.selectedColour ??
        item.selected_color ??
        item.selected_colour ??
        ""
    );
}

function getItemQuantity(item) {
    return Math.max(
        1,
        Number(item.quantity ?? item.Quantity ?? 1)
    );
}

function getItemPrice(item) {
    return Number(
        item.price ??
        item.unitPrice ??
        item.unit_price ??
        0
    );
}

function getItemAmount(item) {
    const quantity = getItemQuantity(item);
    const price = getItemPrice(item);

    return Number(
        item.amount ??
        item.total ??
        price * quantity
    );
}

/* =========================================================
   RENDER SINGLE ORDER ITEM
========================================================= */

function renderOrderItem(item) {
    const image = getProductImage(item);
    const itemName = getItemName(item);
    const quantity = getItemQuantity(item);
    const price = getItemPrice(item);
    const amount = getItemAmount(item);
    const size = getItemSize(item);
    const color = getItemColor(item);

    return `
        <div class="order-item">

            <div class="order-product-image">
                <img
                    src="${escapeHtml(image)}"
                    alt="${escapeHtml(itemName)}"
                    loading="lazy"
                    decoding="async"
                    onerror="this.onerror=null;this.src='../images/no-image.png';"
                >
            </div>

            <div class="order-item-details">

                <strong>${escapeHtml(itemName)}</strong>

                <p>
                    ₹${formatPrice(price)} × ${quantity}
                </p>

                ${
                    size
                        ? `
                            <p>
                                <strong>Size:</strong>
                                ${escapeHtml(size)}
                            </p>
                        `
                        : ""
                }

                ${
                    color
                        ? `
                            <p>
                                <strong>Colour:</strong>
                                ${escapeHtml(color)}
                            </p>
                        `
                        : ""
                }

                <p>
                    <strong>Amount:</strong>
                    ₹${formatPrice(amount)}
                </p>

            </div>

        </div>
    `;
}

/* =========================================================
   ORDER ID
========================================================= */

function getOrderId(order) {
    return (
        order.id ??
        order.orderId ??
        order.order_id ??
        order._id ??
        order.orderNo ??
        order.order_number ??
        null
    );
}

/* =========================================================
   WHATSAPP EXCHANGE MESSAGE
========================================================= */

function exchangeOrder(orderId) {

    if (!orderId) {
        alert("Order ID not found.");
        return;
    }

    const order = ordersById.get(String(orderId));

    if (!order) {
        alert("Order details not found. Please refresh the page.");
        return;
    }

    const orderNumber =
        order.orderNo ??
        order.order_number ??
        orderId;

    const items = getOrderItems(order);

    if (!items.length) {
        alert("Product details are not available for this order.");
        return;
    }

    let productDetails = "";

    items.forEach((item, index) => {

        const name = getItemName(item);
        const size = getItemSize(item);
        const color = getItemColor(item);
        const quantity = getItemQuantity(item);
        const price = getItemPrice(item);

        productDetails +=
            `\n${index + 1}. Product: ${name}` +
            `\n   Quantity: ${quantity}` +
            `\n   Price: Rs. ${formatPrice(price)}`;

        if (size) {
            productDetails += `\n   Size: ${size}`;
        }

        if (color) {
            productDetails += `\n   Colour: ${color}`;
        }

        productDetails += "\n";
    });

    const message =
        "Hello V Mart,\n\n" +
        "I would like to request an exchange for my order.\n\n" +
        "Order Number: " + orderNumber + "\n\n" +
        "Product Details:\n" +
        productDetails +
        "\nPlease help me with the exchange process.\n\n" +
        "Thank you.";

    const whatsappURL =
        "https://wa.me/" +
        EXCHANGE_WHATSAPP_NUMBER +
        "?text=" +
        encodeURIComponent(message);

    // Open WhatsApp in a new tab
    window.open(
        whatsappURL,
        "_blank",
        "noopener,noreferrer"
    );
}

/* =========================================================
   RENDER COMPLETE ORDER
========================================================= */

function renderOrder(order) {

    const items = getOrderItems(order);
    const orderId = getOrderId(order);

    const safeOrderId = escapeHtml(orderId ?? "");

    const orderStatus = String(
        order.orderStatus ??
        order.order_status ??
        "Placed"
    );

    const orderDate =
        order.date ??
        order.orderDate ??
        order.order_date;

    const parsedDate = orderDate
        ? new Date(orderDate)
        : null;

    const formattedDate =
        parsedDate && !Number.isNaN(parsedDate.getTime())
            ? parsedDate.toLocaleDateString("en-IN")
            : "N/A";

    const total = Number(
        order.total ??
        order.totalAmount ??
        order.total_amount ??
        0
    );

    const paymentStatus =
        order.paymentStatus ??
        order.payment_status ??
        "Pending";

    const paymentMethod =
        order.paymentMethod ??
        order.payment_method ??
        "COD";

    // EXCHANGE BUTTON
    const exchangeButton = orderId
        ? `
            <button
                type="button"
                class="exchange-order-btn"
                onclick="exchangeOrder('${safeOrderId}')">
                🔄 Exchange Order
            </button>
        `
        : "";

    // DELETE BUTTON
    const deleteButton = orderId
        ? `
            <button
                type="button"
                class="delete-order-btn"
                onclick="deleteOrder('${safeOrderId}')">
                🗑️ Delete Order
            </button>
        `
        : "";

    // DELIVERY ADDRESS
    const address =
        order.address ||
        order.deliveryAddress ||
        order.delivery_address ||
        {};

    const hasAddress =
        address.fullName ||
        address.full_name ||
        address.phone ||
        address.address ||
        address.city ||
        address.state ||
        address.pincode;

    return `
        <div class="order" data-order-id="${safeOrderId}">

            <div class="order-header">

                <div>
                    <h3>
                        Order No:
                        ${escapeHtml(
                            order.orderNo ??
                            order.order_number ??
                            "N/A"
                        )}
                    </h3>

                    <p>
                        <strong>Date:</strong>
                        ${escapeHtml(formattedDate)}
                    </p>
                </div>

                <div class="order-total">
                    <strong>Total</strong>
                    <span>₹${formatPrice(total)}</span>
                </div>

            </div>

            <div class="order-info">

                <p>
                    <strong>Payment:</strong>

                    <span class="status-badge">
                        ${escapeHtml(paymentStatus)}
                    </span>
                </p>

                <p>
                    <strong>Order Status:</strong>

                    <span class="status-badge">
                        ${escapeHtml(orderStatus)}
                    </span>
                </p>

                <p>
                    <strong>Payment Method:</strong>
                    ${escapeHtml(paymentMethod)}
                </p>

            </div>

            <h4>Items</h4>

            <div class="order-items">

                ${
                    items.length
                        ? items.map(renderOrderItem).join("")
                        : "<p>No item details available.</p>"
                }

            </div>

            <div class="order-address">

                <h4>Delivery Address</h4>

                ${
                    hasAddress
                        ? `
                            <p>
                                ${escapeHtml(
                                    address.fullName ??
                                    address.full_name ??
                                    ""
                                )}
                            </p>

                            <p>
                                ${escapeHtml(address.phone ?? "")}
                            </p>

                            <p>
                                ${escapeHtml(address.address ?? "")},
                                ${escapeHtml(address.city ?? "")},
                                ${escapeHtml(address.state ?? "")}
                                - ${escapeHtml(address.pincode ?? "")}
                            </p>
                        `
                        : "<p>Address details not available.</p>"
                }

            </div>

            <div class="order-actions">

                ${exchangeButton}

                ${deleteButton}

            </div>

        </div>
    `;
}

/* =========================================================
   REMOVE DUPLICATE ORDERS
========================================================= */

function removeDuplicateOrders(orders) {

    const uniqueOrders = [];
    const seenOrders = new Set();

    orders.forEach(order => {

        const id = getOrderId(order);

        if (id === null || id === undefined || id === "") {
            uniqueOrders.push(order);
            return;
        }

        const uniqueKey = String(id);

        if (!seenOrders.has(uniqueKey)) {
            seenOrders.add(uniqueKey);
            uniqueOrders.push(order);
        }

    });

    return uniqueOrders;
}

/* =========================================================
   NO ORDERS
========================================================= */

function showNoOrders(box) {

    box.innerHTML = `
        <div class="no-orders">

            <h3>No orders found.</h3>

            <p>Your placed orders will appear here.</p>

            <a href="index.html">Continue Shopping</a>

        </div>
    `;
}

/* =========================================================
   LOAD ORDERS
========================================================= */

let ordersController = null;
let requestVersion = 0;

async function loadOrders() {

    const box = document.getElementById("orders");

    if (!box) {
        console.error("Orders container #orders not found.");
        return;
    }

    if (!token) {
        window.location.replace("login.html");
        return;
    }

    if (ordersController) {
        ordersController.abort();
    }

    const currentRequest = ++requestVersion;
    const controller = new AbortController();

    ordersController = controller;

    const timeout = setTimeout(() => {
        controller.abort();
    }, 30000);

    try {

        box.innerHTML = `
            <div class="orders-loading">
                <p>Loading your orders...</p>
            </div>
        `;

        const response = await fetch("/api/orders", {

            method: "GET",

            headers: {
                "Authorization": "Bearer " + token,
                "Accept": "application/json"
            },

            signal: controller.signal,
            cache: "no-store"
        });

        if (currentRequest !== requestVersion) {
            return;
        }

        if (handleUnauthorized(response)) {
            return;
        }

        const data = await readResponse(response);

        if (currentRequest !== requestVersion) {
            return;
        }

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to load your orders."
            );
        }

        let orders = Array.isArray(data)
            ? data
            : Array.isArray(data.orders)
                ? data.orders
                : [];

        orders = removeDuplicateOrders(orders);

        if (currentRequest !== requestVersion) {
            return;
        }

        if (!orders.length) {
            ordersById.clear();
            showNoOrders(box);
            return;
        }

        // Store order details for WhatsApp exchange messages.
        ordersById.clear();

        orders.forEach(order => {

            const id = getOrderId(order);

            if (id !== null && id !== undefined && id !== "") {
                ordersById.set(String(id), order);
            }

        });

        const html = orders
            .map(order => renderOrder(order))
            .join("");

        if (currentRequest !== requestVersion) {
            return;
        }

        box.innerHTML = html;

        console.log(
            "V MART: Orders displayed successfully:",
            orders.length
        );

    } catch (error) {

        if (currentRequest !== requestVersion) {
            return;
        }

        if (error.name === "AbortError") {

            console.error("ORDER REQUEST TIMEOUT OR CANCELLED");

            box.innerHTML = `
                <div class="no-orders">

                    <h3>Loading is taking too long.</h3>

                    <p>
                        Please check your internet connection
                        and try again.
                    </p>

                    <button
                        type="button"
                        onclick="loadOrders()">
                        Try Again
                    </button>

                </div>
            `;

        } else {

            console.error("ORDERS ERROR:", error);

            box.innerHTML = `
                <div class="no-orders">

                    <h3>Unable to load orders</h3>

                    <p>${escapeHtml(error.message)}</p>

                    <button
                        type="button"
                        onclick="loadOrders()">
                        Try Again
                    </button>

                </div>
            `;
        }

    } finally {

        clearTimeout(timeout);

        if (ordersController === controller) {
            ordersController = null;
        }
    }
}

/* =========================================================
   DELETE ORDER
========================================================= */

async function deleteOrder(orderId) {

    if (!orderId) {
        alert("Order ID not found.");
        return;
    }

    if (!confirm("Are you sure you want to delete this order?")) {
        return;
    }

    const orderElement = document.querySelector(
        `.order[data-order-id="${CSS.escape(String(orderId))}"]`
    );

    const button = orderElement?.querySelector(
        ".delete-order-btn"
    );

    if (button) {
        button.disabled = true;
        button.textContent = "Deleting...";
    }

    try {

        const response = await fetch(
            `/api/orders/${encodeURIComponent(orderId)}`,
            {
                method: "DELETE",

                headers: {
                    "Authorization": "Bearer " + token,
                    "Accept": "application/json"
                }
            }
        );

        if (handleUnauthorized(response)) {
            return;
        }

        const data = await readResponse(response);

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to delete order."
            );
        }

        if (orderElement) {
            orderElement.remove();
        }

        ordersById.delete(String(orderId));

        const box = document.getElementById("orders");

        if (box && !box.querySelector(".order")) {
            showNoOrders(box);
        }

        alert(
            data.message || "Order deleted successfully."
        );

    } catch (error) {

        console.error("DELETE ORDER ERROR:", error);

        if (button) {
            button.disabled = false;
            button.textContent = "🗑️ Delete Order";
        }

        alert(
            error.message || "Unable to delete order."
        );
    }
}

/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.loadOrders = loadOrders;
window.deleteOrder = deleteOrder;
window.exchangeOrder = exchangeOrder;

/* =========================================================
   START ORDERS PAGE
========================================================= */

let ordersPageStarted = false;

function startOrdersPage() {

    if (ordersPageStarted) {
        return;
    }

    ordersPageStarted = true;

    loadOrders();
}

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        startOrdersPage,
        { once: true }
    );

} else {

    startOrdersPage();

}

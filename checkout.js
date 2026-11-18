
"use strict";

/* =========================================================
   V MART CHECKOUT.JS

   FEATURES:
   1. Address management
   2. Normal cart checkout - all products
   3. Buy Now checkout
   4. Buy Now from cart
   5. Size and colour support
   6. Cash on Delivery
   7. Razorpay code preserved in comments

   IMPORTANT:
   Normal cart checkout sends every cart row separately.
   Quantity is preserved for each cart row.
========================================================= */

let selectedAddressId = null;
let selectedPayment = "COD";

let cartItems = [];
let checkoutItems = [];
let cartTotal = 0;

let editingAddressId = null;

let buyNowProductId = null;
let buyNowQuantity = 1;
let checkoutFromCart = false;

let checkoutSize = "";
let checkoutColor = "";

let checkoutProductDetails = null;

const API_BASE = "";

/* =========================================================
   COMMON FUNCTIONS
========================================================= */

function getCheckoutToken() {
    return (
        localStorage.getItem("token") ||
        localStorage.getItem("customerToken") ||
        sessionStorage.getItem("token") ||
        sessionStorage.getItem("customerToken") ||
        ""
    );
}

function checkoutHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + getCheckoutToken()
    };
}

function checkoutMessage(message, isError = false) {
    const element = document.getElementById("paymentMessage");

    if (!element) return;

    element.textContent = message;
    element.style.color = isError ? "red" : "green";
}

function formatPrice(amount) {
    return "₹" + Number(amount || 0).toFixed(2);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function getOptionList(value) {
    if (Array.isArray(value)) {
        return [...new Set(
            value.map(item => String(item).trim()).filter(Boolean)
        )];
    }

    if (value === null || value === undefined) {
        return [];
    }

    const text = String(value).trim();

    if (!text) return [];

    try {
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed)) {
            return [...new Set(
                parsed.map(item => String(item).trim()).filter(Boolean)
            )];
        }
    } catch (_) {
        // Continue with normal text.
    }

    return [...new Set(
        text.split(/[,;|/]+/)
            .map(item => item.trim())
            .filter(Boolean)
    )];
}

function getProductSizes(product) {
    return getOptionList(
        product?.sizes ??
        product?.Sizes ??
        product?.size
    );
}

function getProductColors(product) {
    return getOptionList(
        product?.colors ??
        product?.Colors ??
        product?.color
    );
}

/* =========================================================
   PRODUCT AND CART FIELD HELPERS
========================================================= */

function getItemProduct(item) {
    return item?.product || item?.Product || {};
}

function getProductId(item) {
    const product = getItemProduct(item);

    return Number(
        item.productId ??
        item.product_id ??
        item.ProductID ??
        item.productID ??
        product.productId ??
        product.product_id ??
        product.ProductID ??
        product.productID ??
        product.id ??
        item.id ??
        0
    );
}

function getItemSize(item) {
    const product = getItemProduct(item);

    return (
        item.size ??
        item.Size ??
        item.selectedSize ??
        item.selected_size ??
        item.productSize ??
        item.product_size ??
        product.size ??
        ""
    );
}

function getItemColor(item) {
    const product = getItemProduct(item);

    return (
        item.color ??
        item.Color ??
        item.colour ??
        item.Colour ??
        item.selectedColor ??
        item.selectedColour ??
        item.selected_color ??
        item.selected_colour ??
        item.productColor ??
        item.product_color ??
        product.color ??
        ""
    );
}

function getItemName(item) {
    const product = getItemProduct(item);

    return (
        item.name ??
        item.productName ??
        item.ProductName ??
        product.name ??
        product.productName ??
        product.ProductName ??
        "Product"
    );
}

function getItemPrice(item) {
    const product = getItemProduct(item);

    return Number(
        item.price ??
        item.Price ??
        product.price ??
        product.Price ??
        0
    );
}

function getItemImage(item) {
    const product = getItemProduct(item);

    return (
        item.image ??
        item.imagePath ??
        item.ImagePath ??
        product.image ??
        product.imagePath ??
        product.ImagePath ??
        ""
    );
}

function getItemQuantity(item) {
    const quantity = Number(
        item.quantity ??
        item.Quantity ??
        1
    );

    return Number.isFinite(quantity) && quantity > 0
        ? Math.floor(quantity)
        : 1;
}

function getImageURL(imagePath) {
    if (!imagePath) return "";

    const image = String(imagePath).trim();

    if (/^https?:\/\//i.test(image)) {
        return image;
    }

    return image.startsWith("/")
        ? image
        : "/" + image;
}

/* =========================================================
   EXTRACT CART RESPONSE

   Server GET /api/cart currently returns an array.
   This helper also supports other common response formats.
========================================================= */

function extractCartItems(data) {
    if (Array.isArray(data)) {
        return data;
    }

    if (!data || typeof data !== "object") {
        return [];
    }

    if (Array.isArray(data.cart)) {
        return data.cart;
    }

    if (Array.isArray(data.items)) {
        return data.items;
    }

    if (Array.isArray(data.cartItems)) {
        return data.cartItems;
    }

    if (data.data) {
        return extractCartItems(data.data);
    }

    return [];
}

/* =========================================================
   API FUNCTION
========================================================= */

async function checkoutFetch(url, options = {}) {
    const response = await fetch(API_BASE + url, {
        ...options,
        headers: {
            ...checkoutHeaders(),
            ...(options.headers || {})
        }
    });

    let data = {};

    try {
        data = await response.json();
    } catch (_) {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            "Something went wrong. Please try again."
        );
    }

    return data;
}

/* =========================================================
   PAGE INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", async function () {

    if (!getCheckoutToken()) {
        alert("Please login before checkout.");
        window.location.href = "login.html";
        return;
    }

    readCheckoutParameters();

    setupAddressEvents();
    setupPaymentEvents();

    await Promise.all([
        loadAddresses(),
        loadCheckoutProducts()
    ]);
});

/* =========================================================
   READ URL PARAMETERS
========================================================= */

function readCheckoutParameters() {
    const params = new URLSearchParams(window.location.search);

    buyNowProductId = Number(
        params.get("buyNow") ||
        params.get("productId") ||
        0
    ) || null;

    buyNowQuantity = Math.max(
        1,
        Number(params.get("quantity") || 1)
    );

    checkoutFromCart = params.get("fromCart") === "true";

    checkoutSize =
        params.get("size") ||
        sessionStorage.getItem("checkoutSize") ||
        "";

    checkoutColor =
        params.get("color") ||
        sessionStorage.getItem("checkoutColor") ||
        "";

    if (buyNowProductId) {
        checkoutItems = [];
    }
}

/* =========================================================
   LOAD ADDRESSES
========================================================= */

async function loadAddresses() {
    const addressList = document.getElementById("addressList");

    if (!addressList) return;

    addressList.innerHTML = "Loading addresses...";

    try {
        const data = await checkoutFetch("/api/addresses");

        const addresses = Array.isArray(data)
            ? data
            : (data.addresses || data.data || []);

        if (!addresses.length) {
            addressList.innerHTML = `
                <p>No saved addresses found.</p>
                <p>Please add a delivery address.</p>
            `;

            selectedAddressId = null;
            return;
        }

        renderAddresses(addresses);

    } catch (error) {
        console.error("Address loading error:", error);

        addressList.innerHTML = `
            <p>Unable to load addresses.</p>
            <p>${escapeHTML(error.message)}</p>
        `;
    }
}

/* =========================================================
   DISPLAY ADDRESSES
========================================================= */

function renderAddresses(addresses) {
    const addressList = document.getElementById("addressList");

    if (!addressList) return;

    addressList.innerHTML = "";

    addresses.forEach((address, index) => {

        const id =
            address.id ??
            address.addressId ??
            address.address_id;

        const fullName =
            address.fullName ||
            address.full_name ||
            address.name ||
            "";

        const phone =
            address.phone ||
            address.phoneNumber ||
            "";

        const addressText =
            address.address ||
            address.fullAddress ||
            "";

        const city = address.city || "";
        const state = address.state || "";
        const pincode = address.pincode || "";

        const card = document.createElement("div");

        card.className = "address-card";

        const checked =
            String(selectedAddressId) === String(id) ||
            (!selectedAddressId && index === 0);

        if (checked) {
            selectedAddressId = id;
        }

        card.innerHTML = `
            <label class="address-radio">
                <input
                    type="radio"
                    name="selectedAddress"
                    value="${escapeHTML(id)}"
                    ${checked ? "checked" : ""}>

                <span>
                    <strong>${escapeHTML(fullName)}</strong>
                </span>
            </label>

            <p>${escapeHTML(phone)}</p>
            <p>${escapeHTML(addressText)}</p>

            <p>
                ${escapeHTML(city)},
                ${escapeHTML(state)} -
                ${escapeHTML(pincode)}
            </p>

            <div class="address-actions">
                <button type="button" class="edit-address-btn">
                    Edit
                </button>

                <button type="button" class="delete-address-btn">
                    Delete
                </button>
            </div>
        `;

        card.querySelector("input").addEventListener("change", function () {
            selectedAddressId = id;
        });

        card.querySelector(".edit-address-btn")
            .addEventListener("click", function () {
                editAddress(address);
            });

        card.querySelector(".delete-address-btn")
            .addEventListener("click", function () {
                deleteAddress(id);
            });

        addressList.appendChild(card);
    });
}

/* =========================================================
   ADDRESS FORM EVENTS
========================================================= */

function setupAddressEvents() {
    const showButton = document.getElementById("showAddressFormBtn");
    const cancelButton = document.getElementById("cancelAddressBtn");
    const addressForm = document.getElementById("addressForm");

    if (showButton) {
        showButton.addEventListener("click", function () {

            editingAddressId = null;

            if (addressForm) {
                addressForm.reset();
            }

            const title = document.getElementById("addressFormTitle");
            const saveButton = document.getElementById("saveAddressBtn");
            const container = document.getElementById("addressFormContainer");

            if (title) title.textContent = "Add New Address";
            if (saveButton) saveButton.textContent = "Save Address";
            if (container) container.style.display = "block";
        });
    }

    if (cancelButton) {
        cancelButton.addEventListener("click", function () {

            const container = document.getElementById("addressFormContainer");

            if (container) container.style.display = "none";

            if (addressForm) addressForm.reset();

            editingAddressId = null;
        });
    }

    if (addressForm) {
        addressForm.addEventListener("submit", saveAddress);
    }
}

/* =========================================================
   SAVE OR UPDATE ADDRESS
========================================================= */

async function saveAddress(event) {
    event.preventDefault();

    const addressData = {
        fullName: document.getElementById("addressName").value.trim(),
        phone: document.getElementById("addressPhone").value.trim(),
        address: document.getElementById("address").value.trim(),
        city: document.getElementById("city").value.trim(),
        state: document.getElementById("state").value.trim(),
        pincode: document.getElementById("pincode").value.trim()
    };

    if (Object.values(addressData).some(value => !value)) {
        alert("Please fill all address fields.");
        return;
    }

    if (!/^[0-9]{10}$/.test(addressData.phone)) {
        alert("Please enter a valid 10-digit phone number.");
        return;
    }

    if (!/^[0-9]{6}$/.test(addressData.pincode)) {
        alert("Please enter a valid 6-digit pincode.");
        return;
    }

    const saveButton = document.getElementById("saveAddressBtn");

    if (!saveButton) return;

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        let result;

        if (editingAddressId !== null) {
            result = await checkoutFetch(
                "/api/addresses/" + encodeURIComponent(editingAddressId),
                {
                    method: "PUT",
                    body: JSON.stringify(addressData)
                }
            );
        } else {
            result = await checkoutFetch(
                "/api/addresses",
                {
                    method: "POST",
                    body: JSON.stringify(addressData)
                }
            );
        }

        document.getElementById("addressForm").reset();

        document.getElementById("addressFormContainer")
            .style.display = "none";

        editingAddressId = null;

        selectedAddressId =
            result.address?.id ??
            result.address?.addressId ??
            result.id ??
            selectedAddressId;

        await loadAddresses();

        alert(result.message || "Address saved successfully.");

    } catch (error) {
        console.error("Save address error:", error);
        alert(error.message);

    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Address";
    }
}

/* =========================================================
   EDIT ADDRESS
========================================================= */

function editAddress(address) {

    editingAddressId =
        address.id ??
        address.addressId ??
        address.address_id;

    document.getElementById("addressName").value =
        address.fullName || address.full_name || address.name || "";

    document.getElementById("addressPhone").value =
        address.phone || address.phoneNumber || "";

    document.getElementById("address").value =
        address.address || address.fullAddress || "";

    document.getElementById("city").value =
        address.city || "";

    document.getElementById("state").value =
        address.state || "";

    document.getElementById("pincode").value =
        address.pincode || "";

    document.getElementById("addressFormTitle")
        .textContent = "Edit Address";

    document.getElementById("saveAddressBtn")
        .textContent = "Update Address";

    document.getElementById("addressFormContainer")
        .style.display = "block";

    window.scrollTo({
        top: document.getElementById("addressFormContainer").offsetTop,
        behavior: "smooth"
    });
}

/* =========================================================
   DELETE ADDRESS
========================================================= */

async function deleteAddress(id) {

    if (!confirm("Are you sure you want to delete this address?")) {
        return;
    }

    try {
        const result = await checkoutFetch(
            "/api/addresses/" + encodeURIComponent(id),
            {
                method: "DELETE"
            }
        );

        if (String(selectedAddressId) === String(id)) {
            selectedAddressId = null;
        }

        await loadAddresses();

        alert(result.message || "Address deleted successfully.");

    } catch (error) {
        console.error("Delete address error:", error);
        alert(error.message);
    }
}

/* =========================================================
   PAYMENT METHOD
   COD ACTIVE
========================================================= */

function setupPaymentEvents() {

    const paymentOptions =
        document.querySelectorAll('input[name="payment"]');

    paymentOptions.forEach(option => {

        if (option.value === "ONLINE") {
            option.checked = false;
        }

        if (option.value === "COD") {
            option.checked = true;
        }

        option.addEventListener("change", function () {

            selectedPayment = this.value;

            const onlineBox =
                document.getElementById("onlinePaymentBox");

            if (onlineBox) {
                onlineBox.style.display =
                    selectedPayment === "ONLINE" ? "block" : "none";
            }

            checkoutMessage("");
        });
    });

    selectedPayment = "COD";

    const codRadio = document.querySelector(
        'input[name="payment"][value="COD"]'
    );

    if (codRadio) {
        codRadio.checked = true;
    }

    const onlineBox = document.getElementById("onlinePaymentBox");

    if (onlineBox) {
        onlineBox.style.display = "none";
    }

    const placeButton = document.getElementById("placeOrderBtn");

    if (placeButton) {
        placeButton.addEventListener("click", placeOrder);
    }

    /*
    RAZORPAY ONLINE PAYMENT - PRESERVED

    const onlineButton = document.getElementById("onlinePayBtn");

    if (onlineButton) {
        onlineButton.addEventListener("click", payOnline);
    }
    */
}

/* =========================================================
   LOAD CHECKOUT PRODUCTS
========================================================= */

async function loadCheckoutProducts() {

    const summary = document.getElementById("orderSummary");

    if (!summary) return;

    summary.innerHTML = "Loading products...";

    try {

        if (buyNowProductId) {
            await loadBuyNowProduct();
        } else {
            await loadCartProducts();
        }

        console.log("FINAL CHECKOUT ITEMS:", checkoutItems);

        renderOrderSummary();

    } catch (error) {

        console.error("Checkout product error:", error);

        summary.innerHTML = `
            <p>Unable to load checkout products.</p>
            <p>${escapeHTML(error.message)}</p>
        `;
    }
}

/* =========================================================
   LOAD ALL CART PRODUCTS
========================================================= */

async function loadCartProducts() {

    const data = await checkoutFetch("/api/cart");

    console.log("CHECKOUT CART API RESPONSE:", data);

    cartItems = extractCartItems(data);

    console.log("CHECKOUT CART ITEMS:", cartItems);

    checkoutItems = cartItems.map(item => {

        const product = getItemProduct(item);

        return {
            cartId: Number(item.cartId ?? item.cart_id ?? 0),
            productId: getProductId(item),
            name: getItemName(item),
            price: getItemPrice(item),
            quantity: getItemQuantity(item),
            size: getItemSize(item),
            color: getItemColor(item),
            image: getItemImage(item),

            category:
                item.category ||
                item.Category ||
                product.category ||
                product.Category ||
                ""
        };

    }).filter(item => item.productId > 0);

    if (cartItems.length !== checkoutItems.length) {
        console.warn(
            "Some cart rows could not be converted:",
            cartItems.length,
            checkoutItems.length
        );
    }

    if (!checkoutItems.length) {
        throw new Error("Your cart is empty. Please add products first.");
    }

    console.log(
        "TOTAL CART ROWS:",
        cartItems.length,
        "| CHECKOUT PRODUCTS:",
        checkoutItems.length
    );
}

/* =========================================================
   LOAD BUY NOW PRODUCT
========================================================= */

async function loadBuyNowProduct() {

    let product = null;

    if (checkoutFromCart) {

        const data = await checkoutFetch("/api/cart");

        cartItems = extractCartItems(data);

        const matchingItem = cartItems.find(item => {

            if (getProductId(item) !== Number(buyNowProductId)) {
                return false;
            }

            const sizeMatches =
                !checkoutSize ||
                String(getItemSize(item)).toLowerCase() ===
                String(checkoutSize).toLowerCase();

            const colorMatches =
                !checkoutColor ||
                String(getItemColor(item)).toLowerCase() ===
                String(checkoutColor).toLowerCase();

            return sizeMatches && colorMatches;
        });

        if (!matchingItem) {
            throw new Error(
                "The selected product variation was not found in your cart. Please return to the cart and try again."
            );
        }

        product = getItemProduct(matchingItem);

        checkoutSize = getItemSize(matchingItem);
        checkoutColor = getItemColor(matchingItem);

        // Use the saved cart quantity for Buy Now from cart.
        buyNowQuantity = getItemQuantity(matchingItem);

    } else {

        const data = await checkoutFetch(
            "/api/products/" + encodeURIComponent(buyNowProductId)
        );

        product = data.product || data.data || data;
    }

    if (!product || !Object.keys(product).length) {
        throw new Error("Product details could not be found.");
    }

    checkoutProductDetails = product;

    checkoutItems = [{
        productId: Number(buyNowProductId),

        name:
            product.name ||
            product.productName ||
            product.ProductName ||
            "Product",

        price: Number(
            product.price ??
            product.Price ??
            0
        ),

        quantity: buyNowQuantity,

        size: checkoutSize,

        color: checkoutColor,

        image:
            product.image ||
            product.imagePath ||
            product.ImagePath ||
            "",

        category:
            product.category ||
            product.Category ||
            ""
    }];
}

/* =========================================================
   DISPLAY ORDER SUMMARY
========================================================= */

function renderOrderSummary() {

    const summary = document.getElementById("orderSummary");

    if (!summary) return;

    summary.innerHTML = "";

    if (!checkoutItems.length) {

        summary.innerHTML = `<p>Your cart is empty.</p>`;

        cartTotal = 0;

        updateCheckoutTotal();

        return;
    }

    cartTotal = 0;

    checkoutItems.forEach(item => {

        const itemTotal = Number(
            (Number(item.price) * Number(item.quantity)).toFixed(2)
        );

        cartTotal += itemTotal;

        const imageURL = getImageURL(item.image);

        const productDiv = document.createElement("div");

        productDiv.className = "checkout-product";

        productDiv.innerHTML = `
            <div class="checkout-product-image">
                ${
                    imageURL
                    ? `<img
                            src="${escapeHTML(imageURL)}"
                            alt="${escapeHTML(item.name)}"
                            loading="lazy"
                            decoding="async"
                            style="width:90px;height:100px;object-fit:cover;">`
                    : `<div>No Image</div>`
                }
            </div>

            <div class="checkout-product-details">

                <h3>${escapeHTML(item.name)}</h3>

                <p>Price: ${formatPrice(item.price)}</p>

                <p>Quantity: ${item.quantity}</p>

                <p>
                    Size:
                    <strong>
                        ${escapeHTML(item.size || "Not selected")}
                    </strong>
                </p>

                <p>
                    Colour:
                    <strong>
                        ${escapeHTML(item.color || "Not selected")}
                    </strong>
                </p>

                <p>
                    Subtotal:
                    <strong>${formatPrice(itemTotal)}</strong>
                </p>

            </div>
        `;

        summary.appendChild(productDiv);
    });

    cartTotal = Number(cartTotal.toFixed(2));

    updateCheckoutTotal();
}

/* =========================================================
   UPDATE TOTAL
========================================================= */

function updateCheckoutTotal() {

    const totalElement = document.getElementById("checkoutTotal");

    if (totalElement) {
        totalElement.textContent = formatPrice(cartTotal);
    }
}

/* =========================================================
   VALIDATE CHECKOUT
========================================================= */

function validateCheckout() {

    if (!selectedAddressId) {
        alert("Please select or add a delivery address.");
        return false;
    }

    if (!checkoutItems.length) {
        alert("Your cart is empty.");
        return false;
    }

    for (const item of checkoutItems) {

        if (!item.productId || item.quantity < 1) {
            alert("Invalid product details.");
            return false;
        }

        if (!Number.isFinite(item.price) || item.price <= 0) {
            alert("Invalid product price for " + item.name);
            return false;
        }
    }

    // Validate Buy Now size and colour.
    if (buyNowProductId && !checkoutFromCart && checkoutProductDetails) {

        const availableSizes = getProductSizes(checkoutProductDetails);
        const availableColors = getProductColors(checkoutProductDetails);

        if (availableSizes.length > 0) {

            if (!checkoutSize) {
                alert("Please select a size before placing your order.");
                return false;
            }

            if (!availableSizes.some(
                size => size.toLowerCase() === checkoutSize.toLowerCase()
            )) {
                alert("The selected size is not available for this product.");
                return false;
            }
        }

        if (availableColors.length > 0) {

            if (!checkoutColor) {
                alert("Please select a colour before placing your order.");
                return false;
            }

            if (!availableColors.some(
                color => color.toLowerCase() === checkoutColor.toLowerCase()
            )) {
                alert("The selected colour is not available for this product.");
                return false;
            }
        }
    }

    return true;
}

/* =========================================================
   CREATE ORDER REQUEST BODY

   NORMAL CART:
   Sends every product row with its quantity.

   BUY NOW:
   Sends only the selected product.
========================================================= */

function getOrderRequestBody() {

    const body = {
        addressId: selectedAddressId,
        paymentMethod: "COD"
    };

    if (buyNowProductId) {

        body.buyNowProductId = buyNowProductId;
        body.buyNowQuantity = buyNowQuantity;
        body.fromCart = checkoutFromCart;

        body.size = checkoutSize;
        body.color = checkoutColor;

    } else {

        body.items = checkoutItems.map(item => ({
            productId: Number(item.productId),
            quantity: Number(item.quantity),
            size: item.size || "",
            color: item.color || ""
        }));

        console.log("ORDER ITEMS BEING SENT:", body.items);
    }

    return body;
}

/* =========================================================
   PLACE ORDER - COD
========================================================= */

async function placeOrder() {

    if (!validateCheckout()) {
        return;
    }

    const button = document.getElementById("placeOrderBtn");

    if (!button) return;

    button.disabled = true;
    button.textContent = "Placing Order...";

    checkoutMessage("Processing your order...");

    try {

        const body = getOrderRequestBody();

        body.paymentMethod = "COD";

        // Prevent incomplete normal cart orders.
        if (!buyNowProductId) {

            if (!Array.isArray(body.items) || body.items.length === 0) {
                throw new Error(
                    "No cart products found. Please return to your cart."
                );
            }

            if (body.items.length !== checkoutItems.length) {
                throw new Error(
                    "Some cart products are missing. Please refresh checkout."
                );
            }
        }

        console.log("FINAL ORDER REQUEST BODY:", body);

        const result = await checkoutFetch(
            "/api/orders",
            {
                method: "POST",
                body: JSON.stringify(body)
            }
        );

        if (!result.success) {
            throw new Error(
                result.message || "Order could not be placed."
            );
        }

        console.log("ORDER CREATED SUCCESSFULLY:", result.order);

        sessionStorage.removeItem("checkoutSize");
        sessionStorage.removeItem("checkoutColor");

        checkoutMessage("Order placed successfully! Redirecting...");

        window.location.replace("orders.html");

    } catch (error) {

        console.error("Place order error:", error);

        checkoutMessage(error.message, true);

        alert(error.message);

        button.disabled = false;
        button.textContent = "Place Order";
    }
}

/* =========================================================
   RAZORPAY - PRESERVED FOR FUTURE USE

   COD is currently active.
   Razorpay has not been enabled.
========================================================= */

/*

async function payOnline() {

    if (!validateCheckout()) {
        return;
    }

    if (typeof Razorpay === "undefined") {
        alert("Razorpay could not be loaded.");
        return;
    }

    const button = document.getElementById("onlinePayBtn");

    button.disabled = true;
    button.textContent = "Starting Payment...";

    checkoutMessage("Creating secure payment...");

    try {

        const body = getOrderRequestBody();

        body.paymentMethod = "ONLINE";

        const result = await checkoutFetch(
            "/api/payment/create-order",
            {
                method: "POST",
                body: JSON.stringify(body)
            }
        );

        if (!result.success) {
            throw new Error(
                result.message || "Unable to create payment order."
            );
        }

        const options = {
            key: result.key || result.keyId,
            amount: result.amount,
            currency: result.currency || "INR",
            name: "V Mart",
            description: "V Mart Order Payment",
            order_id: result.orderId,

            handler: async function (response) {
                await verifyRazorpayPayment(response);
            },

            theme: {
                color: "#8f0c05"
            }
        };

        const razorpay = new Razorpay(options);

        razorpay.open();

    } catch (error) {

        console.error("Online payment error:", error);

        checkoutMessage(error.message, true);

        alert(error.message);

        button.disabled = false;
        button.textContent = "Pay Online";
    }
}

async function verifyRazorpayPayment(response) {

    checkoutMessage("Verifying your payment...");

    try {

        const result = await checkoutFetch(
            "/api/payment/verify",
            {
                method: "POST",

                body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature
                })
            }
        );

        if (!result.success) {
            throw new Error(
                result.message || "Payment verification failed."
            );
        }

        sessionStorage.removeItem("checkoutSize");
        sessionStorage.removeItem("checkoutColor");

        window.location.href = "orders.html";

    } catch (error) {

        console.error("Payment verification error:", error);

        checkoutMessage(error.message, true);

        alert(error.message);
    }
}

*/

/* =========================================================
   END OF CHECKOUT.JS
========================================================= */

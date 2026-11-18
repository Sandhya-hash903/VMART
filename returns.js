"use strict";

console.log("↩️ RETURNS JS LOADED");

const token =
    localStorage.getItem("token");

if (!token) {

    window.location.href =
        "login.html";
}


/* =========================================================
   LOAD RETURNS
========================================================= */

async function loadReturns() {

    const box =
        document.getElementById("returns");

    try {

        const response =
            await fetch("/api/returns", {

                method: "GET",

                headers: {
                    "Authorization":
                        "Bearer " + token
                }

            });

        const data =
            await response.json();

        /* =====================================================
           LOGIN EXPIRED
        ===================================================== */

        if (response.status === 401) {

            localStorage.removeItem(
                "token"
            );

            localStorage.removeItem(
                "customer"
            );

            window.location.href =
                "login.html";

            return;
        }

        /* =====================================================
           ERROR
        ===================================================== */

        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to load returns."
            );
        }

        const returns =
            Array.isArray(data.returns)
                ? data.returns
                : [];

        /* =====================================================
           NO RETURNS
        ===================================================== */

        if (!returns.length) {

            box.innerHTML = `

                <div class="no-returns">

                    <h3>
                        No returns found
                    </h3>

                    <p>
                        Your return requests
                        will appear here.
                    </p>

                    <a href="orders.html">
                        View My Orders
                    </a>

                </div>

            `;

            return;
        }

        /* =====================================================
           DISPLAY RETURNS
        ===================================================== */

        box.innerHTML =
            returns
                .map(renderReturn)
                .join("");

    } catch (error) {

        console.error(
            "❌ RETURNS ERROR:",
            error
        );

        box.innerHTML = `

            <div class="error">

                <strong>
                    Unable to load returns
                </strong>

                <p>
                    ${escapeHtml(
                        error.message
                    )}
                </p>

            </div>

        `;
    }
}


/* =========================================================
   RENDER RETURN
========================================================= */

function renderReturn(order) {

    const items =
        Array.isArray(order.items)
            ? order.items
            : [];

    const returnStatus =
        String(
            order.returnStatus ||
            "Requested"
        );

    const refundStatus =
        String(
            order.refundStatus ||
            "Pending"
        );

    const orderStatus =
        String(
            order.orderStatus ||
            "Placed"
        );

    const returnDate =
        order.returnRequestedAt
            ? formatDate(
                order.returnRequestedAt
            )
            : "N/A";

    const statusClass =
        getStatusClass(
            returnStatus
        );

    return `

        <div class="return-card">

            <!-- ==========================================
                 HEADER
            =========================================== -->

            <div class="return-header">

                <div>

                    <h3>
                        Order:
                        ${escapeHtml(
                            order.orderNo ||
                            "N/A"
                        )}
                    </h3>

                    <p>

                        <strong>
                            Order Date:
                        </strong>

                        ${
                            order.date
                                ? formatDate(
                                    order.date
                                )
                                : "N/A"
                        }

                    </p>

                </div>

                <div>

                    <span
                        class="status ${statusClass}"
                    >
                        ${escapeHtml(
                            returnStatus
                        )}
                    </span>

                </div>

            </div>


            <!-- ==========================================
                 ITEMS
            =========================================== -->

            <h4>
                Returned Items
            </h4>

            <div class="items">

                ${
                    items.length

                    ? items.map(
                        renderItem
                    ).join("")

                    : `
                        <p>
                            No item details available.
                        </p>
                    `
                }

            </div>


            <!-- ==========================================
                 RETURN INFORMATION
            =========================================== -->

            <div class="return-details">

                <div class="detail-box">

                    <strong>
                        Return Status
                    </strong>

                    <span
                        class="status ${statusClass}"
                    >
                        ${escapeHtml(
                            returnStatus
                        )}
                    </span>

                </div>


                <div class="detail-box">

                    <strong>
                        Order Status
                    </strong>

                    ${escapeHtml(
                        orderStatus
                    )}

                </div>


                <div class="detail-box">

                    <strong>
                        Return Requested
                    </strong>

                    ${escapeHtml(
                        returnDate
                    )}

                </div>


                <div class="detail-box">

                    <strong>
                        Refund Status
                    </strong>

                    ${escapeHtml(
                        refundStatus
                    )}

                </div>


                <div class="detail-box">

                    <strong>
                        Return Reason
                    </strong>

                    ${escapeHtml(
                        order.returnReason ||
                        "Customer requested return"
                    )}

                </div>


                <div class="detail-box">

                    <strong>
                        Order Total
                    </strong>

                    ₹${Number(
                        order.total || 0
                    ).toLocaleString(
                        "en-IN"
                    )}

                </div>

            </div>

        </div>

    `;
}


/* =========================================================
   RENDER ITEM
========================================================= */

function renderItem(item) {

    const image =
        item.image ||
        "../images/no-image.png";

    const name =
        item.name ||
        "Product";

    const quantity =
        Number(
            item.quantity || 1
        );

    const price =
        Number(
            item.price || 0
        );

    const amount =
        Number(
            item.amount ||
            price * quantity
        );

    return `

        <div class="item">

            <img
                src="${escapeHtml(image)}"
                alt="${escapeHtml(name)}"
                onerror="
                    this.src='../images/no-image.png';
                "
            >

            <div class="item-details">

                <strong>
                    ${escapeHtml(name)}
                </strong>

                <p>
                    ₹${price.toLocaleString(
                        "en-IN"
                    )}
                    ×
                    ${quantity}
                </p>

                <p>

                    <strong>
                        Amount:
                    </strong>

                    ₹${amount.toLocaleString(
                        "en-IN"
                    )}

                </p>

            </div>

        </div>

    `;
}


/* =========================================================
   STATUS CLASS
========================================================= */

function getStatusClass(status) {

    const value =
        String(status)
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();

    if (
        value === "requested"
    ) {
        return "status-requested";
    }

    if (
        value === "approved"
    ) {
        return "status-approved";
    }

    if (
        value === "rejected"
    ) {
        return "status-rejected";
    }

    if (
        value === "picked up" ||
        value === "pickedup"
    ) {
        return "status-picked";
    }

    if (
        value === "received"
    ) {
        return "status-received";
    }

    if (
        value === "completed" ||
        value === "refunded"
    ) {
        return "status-completed";
    }

    return "status-pending";
}


/* =========================================================
   DATE
========================================================= */

function formatDate(value) {

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "N/A";
    }

    return date.toLocaleString(
        "en-IN",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

    return String(value ?? "")

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
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    loadReturns
);
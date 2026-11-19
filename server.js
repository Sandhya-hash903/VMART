
"use strict";

require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
// const Razorpay = require("razorpay");
const { pool, testConnection } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicPath = path.join(__dirname, "public");
const htmlPath = path.join(publicPath, "html");
const dataFile = path.join(__dirname, "data.json");
const uploadsDir = path.join(__dirname, "uploads");
const publicUploadsDir = path.join(publicPath, "uploads");

fs.mkdirSync(uploadsDir, { recursive: true });

app.use(express.static(publicPath));
app.use("/uploads", express.static(uploadsDir));
app.use("/uploads", express.static(publicUploadsDir));

/* =====================================================
   RAZORPAY CONFIGURATION - TEMPORARILY DISABLED

   const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
   const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

   const razorpay = razorpayKeyId && razorpayKeySecret
       ? new Razorpay({
           key_id: razorpayKeyId,
           key_secret: razorpayKeySecret
       })
       : null;

   console.log("Razorpay:", razorpay ? "Loaded" : "Not configured");

   Razorpay code is preserved below in comments.
===================================================== */

/* JSON STORAGE */

let db = {
    addresses: [],
    orders: [],
    paymentOrders: []
};

function loadData() {
    try {
        if (!fs.existsSync(dataFile)) return;
        const saved = JSON.parse(fs.readFileSync(dataFile, "utf8"));

        Object.keys(db).forEach(key => {
            db[key] = Array.isArray(saved[key]) ? saved[key] : [];
        });
    } catch (error) {
        console.error("DATA FILE ERROR:", error.message);
    }
}

function saveData() {
    fs.writeFileSync(dataFile, JSON.stringify(db, null, 2), "utf8");
}

loadData();

/* =====================================================
   IMAGE PATH - CLOUDPANEL ADMIN IMAGE SUPPORT

   Admin uploads:
   https://lms.sandhyasrisolutions.com/VMART/uploads/

   Customer module displays images directly from CloudPanel.
===================================================== */

function getPublicImagePath(value) {
    if (!value) return "";

    let image = String(value).trim().replace(/\\/g, "/");

    if (!image) return "";

    // If the database already contains a complete URL,
    // return that URL without adding the base URL again.
    if (/^https?:\/\//i.test(image)) {
        return image;
    }

    const baseUrl = String(
        process.env.IMAGE_BASE_URL ||
        "https://lms.sandhyasrisolutions.com/VMART/uploads"
    ).trim().replace(/\/+$/, "");

    // Remove leading slash and uploads folder.
    image = image.replace(/^\/+/, "");
    image = image.replace(/^uploads\//i, "");

    const parts = image.split("/");

    if (
        !image ||
        parts.some(part =>
            !part || part === "." || part === ".."
        )
    ) {
        return "";
    }

    return `${baseUrl}/${parts
        .map(part => encodeURIComponent(part))
        .join("/")}`;
}

/* HTML PAGES */

const pages = [
    "index", "login", "register", "men", "women", "kids",
    "home_essentials", "categories", "profile", "wishlist",
    "cart", "checkout", "orders", "returns"
];

pages.forEach(page => {
    app.get(`/${page}.html`, (req, res) => {
        res.sendFile(path.join(htmlPath, `${page}.html`));
    });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(htmlPath, "index.html"));
});

/* PRODUCT HELPERS */

function normalizeCategory(value) {
    const category = String(value || "").trim().toLowerCase();

    const aliases = {
        "men's clothing": "men",
        "mens clothing": "men",
        "men clothing": "men",
        "men's wear": "men",
        "mens wear": "men",
        male: "men",
        "women's clothing": "women",
        "womens clothing": "women",
        "women clothing": "women",
        "women's wear": "women",
        "womens wear": "women",
        female: "women",
        children: "kids",
        child: "kids",
        kid: "kids",
        "kids clothing": "kids",
        "kids wear": "kids",
        "home essentials": "home_essentials",
        "home-essentials": "home_essentials",
        home: "home_essentials"
    };

    return aliases[category] || category.replace(/[\s-]+/g, "_");
}

/* INVENTORY STOCK STATUS */


/* PRODUCT MAPPING */

function mapProduct(row) {
    const stock = Number(row.InventoryAvailableStock || 0);

    return {
        id: Number(row.ProductID),
        productCode: row.ProductCode || "",
        name: row.ProductName || "",
        category: normalizeCategory(row.Category),
        brand: row.Brand || "",
        subCategory: row.SubCategory || "",
        size: String(row.Sizes || ""),
        sizes: String(row.Sizes || ""),
        colors: String(row.Colors || ""),
        price: Number(row.Price || 0),
        availableStock: stock,
        inventoryAvailableStock: stock,
        stockStatus: row.InventoryStockStatus || "Out of Stock",
        status: row.Status || "",
        image: getPublicImagePath(row.ImagePath),
        description: row.Description || ""
    };
}

/* PRODUCT SQL - INVENTORY JOIN FIXED */

const productSelect = `
    SELECT
        p.ProductID,
        p.ProductCode,
        p.ProductName,
        p.Category,
        p.Price,
        p.Status,
        p.Sizes,
        p.Colors,
        p.ImagePath,
        p.Description,
        p.Brand,
        COALESCE(inv.total_available_stock, 0)
            AS InventoryAvailableStock,
        COALESCE(inv.stock_status, 'Out of Stock')
            AS InventoryStockStatus
    FROM Products p
    LEFT JOIN (
        SELECT
            TRIM(product_code) AS product_code,
            SUM(COALESCE(available_stock, 0))
                AS total_available_stock,
            MAX(stock_status) AS stock_status
        FROM inventory
        GROUP BY TRIM(product_code)
    ) inv ON TRIM(p.ProductCode) = inv.product_code
`;


async function getAllProducts() {
    const [rows] = await pool.execute(
        productSelect + `
            WHERE p.Status = 'Active'
            ORDER BY p.ProductID DESC
        `
    );
    return rows.map(mapProduct);
}

async function getProductById(id) {
    const productId = Number(id);
    if (!Number.isInteger(productId) || productId <= 0) return null;

    const [rows] = await pool.execute(
        productSelect + `
            WHERE p.ProductID = ?
            AND p.Status = 'Active'
            LIMIT 1
        `,
        [productId]
    );

    return rows.length ? mapProduct(rows[0]) : null;
}

function filterProducts(products, query) {
    let result = [...products];

    if (query.category) {
        const category = normalizeCategory(query.category);
        result = result.filter(p => p.category === category);
    }

    if (query.size) {
        const size = String(query.size).trim().toLowerCase();
        result = result.filter(p =>
            String(p.sizes || "").split(",")
                .some(v => v.trim().toLowerCase() === size)
        );
    }

    if (query.brand) {
        const brand = String(query.brand).trim().toLowerCase();
        result = result.filter(p =>
            String(p.brand).trim().toLowerCase() === brand
        );
    }

    if (query.subCategory) {
        const sub = String(query.subCategory).trim().toLowerCase();
        result = result.filter(p =>
            String(p.subCategory).trim().toLowerCase() === sub
        );
    }

    if (query.minPrice !== undefined && query.minPrice !== "") {
        const min = Number(query.minPrice);
        if (!Number.isFinite(min)) return [];
        result = result.filter(p => p.price >= min);
    }

    if (query.maxPrice !== undefined && query.maxPrice !== "") {
        const max = Number(query.maxPrice);
        if (!Number.isFinite(max)) return [];
        result = result.filter(p => p.price <= max);
    }

    if (query.search) {
        const search = String(query.search).trim().toLowerCase();
        result = result.filter(p =>
            [p.name, p.productCode, p.brand, p.category]
                .some(v => String(v || "").toLowerCase().includes(search))
        );
    }

    return result;
}

/* AUTHENTICATION */

async function auth(req, res, next) {
    try {
        const header = req.headers.authorization || "";
        const token = header.startsWith("Bearer ")
            ? header.slice(7).trim()
            : "";

        if (!token) {
            return res.status(401).json({ message: "Login required." });
        }

        const tokenHash = crypto.createHash("sha256")
            .update(token).digest("hex");

        const [sessions] = await pool.execute(
            `SELECT session_id, customer_id
             FROM customer_sessions
             WHERE token_hash = ? AND expires_at > NOW()
             LIMIT 1`,
            [tokenHash]
        );

        if (!sessions.length) {
            return res.status(401).json({
                message: "Session expired. Please login again."
            });
        }

        const session = sessions[0];

        const [customers] = await pool.execute(
            `SELECT CustomerID, Name, Email, Phone, Status
             FROM Customers WHERE CustomerID = ? LIMIT 1`,
            [Number(session.customer_id)]
        );

        if (!customers.length) {
            return res.status(401).json({ message: "Customer not found." });
        }

        const row = customers[0];

        if (String(row.Status).toLowerCase() !== "active") {
            return res.status(403).json({ message: "Account is inactive." });
        }

        await pool.execute(
            "UPDATE customer_sessions SET last_activity = NOW() WHERE session_id = ?",
            [Number(session.session_id)]
        );

        req.customer = {
            id: Number(row.CustomerID),
            name: row.Name,
            email: row.Email,
            phone: row.Phone || "",
            status: row.Status
        };

        req.token = token;
        req.sessionId = Number(session.session_id);
        next();
    } catch (error) {
        console.error("AUTH ERROR:", error);
        res.status(500).json({ message: "Unable to verify login." });
    }
}

/* REGISTER */

app.post("/api/auth/register", async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const phone = String(req.body.phone || "").trim();
        const password = String(req.body.password || "");

        if (!name || !email || !phone || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email, phone and password are required."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 6 characters."
            });
        }

        const [existing] = await pool.execute(
            "SELECT CustomerID FROM Customers WHERE Email = ? LIMIT 1",
            [email]
        );

        if (existing.length) {
            return res.status(409).json({
                success: false,
                message: "Email already registered. Please login."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.execute(
            `INSERT INTO Customers (Name, Email, Phone, Status, Password)
             VALUES (?, ?, ?, 'Active', ?)`,
            [name, email, phone, hashedPassword]
        );

        res.status(201).json({
            success: true,
            message: "Registration successful.",
            customer: {
                id: result.insertId, name, email, phone, status: "Active"
            }
        });
    } catch (error) {
        console.error("REGISTER ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Customer registration failed."
        });
    }
});

/* LOGIN */

app.post("/api/auth/login", async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const [rows] = await pool.execute(
            `SELECT CustomerID, Name, Email, Phone, Status, Password
             FROM Customers WHERE Email = ? LIMIT 1`,
            [email]
        );

        if (!rows.length) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const row = rows[0];

        if (String(row.Status).toLowerCase() !== "active") {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive."
            });
        }

        if (!await bcrypt.compare(password, row.Password)) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256")
            .update(token).digest("hex");

        await pool.execute(
            `INSERT INTO customer_sessions
             (customer_id, token_hash, expires_at, last_activity)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY), NOW())`,
            [Number(row.CustomerID), tokenHash]
        );

        res.json({
            success: true,
            message: "Login successful.",
            token,
            customer: {
                id: Number(row.CustomerID),
                name: row.Name,
                email: row.Email,
                phone: row.Phone || "",
                status: row.Status
            }
        });
    } catch (error) {
        console.error("LOGIN ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Login failed due to a server error."
        });
    }
});

/* CURRENT CUSTOMER / LOGOUT */

app.get("/api/auth/me", auth, (req, res) => {
    res.json({ success: true, customer: req.customer });
});

app.post("/api/auth/logout", auth, async (req, res) => {
    try {
        const tokenHash = crypto.createHash("sha256")
            .update(req.token).digest("hex");

        await pool.execute(
            "DELETE FROM customer_sessions WHERE token_hash = ?",
            [tokenHash]
        );

        res.json({ success: true, message: "Logged out successfully." });
    } catch (error) {
        console.error("LOGOUT ERROR:", error);
        res.status(500).json({ message: "Unable to log out." });
    }
});

/* PROFILE */

app.put("/api/profile", auth, async (req, res) => {
    try {
        const name = req.body.name !== undefined
            ? String(req.body.name).trim() : req.customer.name;

        const phone = req.body.phone !== undefined
            ? String(req.body.phone).trim() : req.customer.phone;

        if (!name) {
            return res.status(400).json({
                success: false, message: "Name is required."
            });
        }

        await pool.execute(
            "UPDATE Customers SET Name = ?, Phone = ? WHERE CustomerID = ?",
            [name, phone, req.customer.id]
        );

        res.json({
            success: true,
            message: "Profile updated successfully.",
            customer: { ...req.customer, name, phone }
        });
    } catch (error) {
        console.error("PROFILE ERROR:", error);
        res.status(500).json({ message: "Unable to update profile." });
    }
});

/* DELETE PROFILE */

app.delete("/api/profile", auth, async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        const customerId = req.customer.id;

        const [customer] = await connection.execute(
            "UPDATE Customers SET Status = 'Inactive' WHERE CustomerID = ?",
            [customerId]
        );

        if (!customer.affectedRows) {
            await connection.rollback();
            return res.status(404).json({
                success: false, message: "Customer account not found."
            });
        }

        await connection.execute(
            "DELETE FROM customer_sessions WHERE customer_id = ?",
            [customerId]
        );
        await connection.execute(
            "DELETE FROM carts WHERE customer_id = ?",
            [customerId]
        );
        await connection.execute(
            "DELETE FROM Wishlist WHERE CustomerID = ?",
            [customerId]
        );

        await connection.commit();

        db.addresses = db.addresses.filter(
            a => Number(a.customerId) !== customerId
        );
        saveData();

        res.json({
            success: true,
            message: "Your V Mart profile has been deleted successfully."
        });
    } catch (error) {
        await connection.rollback();
        console.error("DELETE PROFILE ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Unable to delete your profile. Please try again."
        });
    } finally {
        connection.release();
    }
});

/* PRODUCTS API */

app.get("/api/products", async (req, res) => {
    try {
        res.json(filterProducts(await getAllProducts(), req.query));
    } catch (error) {
        console.error("PRODUCTS ERROR:", error);
        res.status(500).json({ message: "Unable to load products." });
    }
});

app.get("/api/products/category/:category", async (req, res) => {
    try {
        const category = normalizeCategory(req.params.category);
        const products = await getAllProducts();
        res.json(products.filter(p => p.category === category));
    } catch (error) {
        console.error("CATEGORY ERROR:", error);
        res.status(500).json({
            message: "Unable to load category products."
        });
    }
});


app.get("/api/products/:id", async (req, res) => {
    try {
        const product = await getProductById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: "Product not found." });
        }

        res.json(product);
    } catch (error) {
        console.error("SINGLE PRODUCT ERROR:", error);
        res.status(500).json({ message: "Unable to load product." });
    }
});


/* TOWEL IMAGE DIAGNOSTIC */

app.get("/api/products/15/image-check", async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT ProductID, ProductName, Category, ImagePath
             FROM Products
             WHERE ProductID = 15
             LIMIT 1`
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Towel product not found."
            });
        }

        const row = rows[0];

        res.json({
            success: true,
            productId: Number(row.ProductID),
            productName: row.ProductName,
            category: row.Category,
            databaseImagePath: row.ImagePath,
            customerImageURL: getPublicImagePath(row.ImagePath)
        });

    } catch (error) {
        console.error("TOWEL IMAGE CHECK ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Unable to check towel image."
        });
    }
});


/* CART */

app.get("/api/cart", auth, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT cart_id, customer_id, product_id, quantity,
                    size, color, created_at, updated_at
             FROM carts WHERE customer_id = ?
             ORDER BY cart_id DESC`,
            [req.customer.id]
        );

        const cart = await Promise.all(rows.map(async item => ({
            cartId: Number(item.cart_id),
            customerId: Number(item.customer_id),
            productId: Number(item.product_id),
            quantity: Number(item.quantity),
            size: item.size || "",
            color: item.color || "",
            createdAt: item.created_at,
            updatedAt: item.updated_at,
            product: await getProductById(item.product_id)
        })));

        res.json(cart);
    } catch (error) {
        console.error("GET CART ERROR:", error);
        res.status(500).json({ message: "Unable to load cart." });
    }
});

app.post("/api/cart", auth, async (req, res) => {
    try {
        const productId = Number(
            req.body.productId ?? req.body.product_id ?? req.body.id
        );
        const quantity = Math.max(1, Math.floor(Number(req.body.quantity) || 1));

        const size = String(
            req.body.selectedSize ?? req.body.selected_size ??
            req.body.size ?? req.body.Size ?? ""
        ).trim();

        const color = String(
            req.body.selectedColor ?? req.body.selectedColour ??
            req.body.selected_color ?? req.body.selected_colour ??
            req.body.color ?? req.body.colour ??
            req.body.Color ?? req.body.Colour ?? ""
        ).trim();

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false, message: "Valid product ID is required."
            });
        }

        const product = await getProductById(productId);

        if (!product) {
            return res.status(404).json({
                success: false, message: "Product not found or inactive."
            });
        }

        if (quantity > product.availableStock) {
            return res.status(400).json({
                success: false,
                message: "Requested quantity exceeds available stock."
            });
        }

        const sizes = String(product.sizes || "").split(",")
            .map(v => v.trim()).filter(Boolean);
        const colors = String(product.colors || "").split(",")
            .map(v => v.trim()).filter(Boolean);

        if (sizes.length && !size) {
            return res.status(400).json({
                success: false, message: "Please select a size."
            });
        }

        if (colors.length && !color) {
            return res.status(400).json({
                success: false, message: "Please select a colour."
            });
        }

        if (size && sizes.length &&
            !sizes.some(v => v.toLowerCase() === size.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: "Selected size is unavailable.",
                availableSizes: sizes
            });
        }

        if (color && colors.length &&
            !colors.some(v => v.toLowerCase() === color.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: "Selected colour is unavailable.",
                availableColors: colors
            });
        }

        const [existing] = await pool.execute(
            `SELECT cart_id, quantity FROM carts
             WHERE customer_id = ? AND product_id = ?
             AND COALESCE(size, '') = ? AND COALESCE(color, '') = ?
             LIMIT 1`,
            [req.customer.id, productId, size, color]
        );

        const newQuantity = existing.length
            ? Number(existing[0].quantity) + quantity : quantity;

        if (newQuantity > product.availableStock) {
            return res.status(400).json({
                success: false,
                message: "Requested quantity exceeds available stock."
            });
        }

        let cartId;

        if (existing.length) {
            cartId = Number(existing[0].cart_id);
            await pool.execute(
                `UPDATE carts SET quantity = ?, updated_at = NOW()
                 WHERE cart_id = ? AND customer_id = ?`,
                [newQuantity, cartId, req.customer.id]
            );
        } else {
            const [result] = await pool.execute(
                `INSERT INTO carts
                 (customer_id, product_id, quantity, size, color)
                 VALUES (?, ?, ?, ?, ?)`,
                [req.customer.id, productId, quantity, size || null, color || null]
            );
            cartId = Number(result.insertId);
        }

        res.status(201).json({
            success: true,
            message: "Product added to cart.",
            cartItem: { cartId, productId, quantity: newQuantity, size, color }
        });
    } catch (error) {
        console.error("ADD CART ERROR:", error);
        res.status(500).json({
            message: "Unable to add product to cart."
        });
    }
});

app.put("/api/cart/:productId", auth, async (req, res) => {
    try {
        const productId = Number(req.params.productId);
        const quantity = Math.max(1, Math.floor(Number(req.body.quantity) || 1));
        const size = String(req.body.selectedSize ?? req.body.size ?? "").trim();
        const color = String(
            req.body.selectedColor ?? req.body.selectedColour ??
            req.body.color ?? req.body.colour ?? ""
        ).trim();

        const product = await getProductById(productId);

        if (!product) {
            return res.status(404).json({ message: "Product not found." });
        }

        if (quantity > product.availableStock) {
            return res.status(400).json({
                message: "Requested quantity exceeds available stock."
            });
        }

        const [result] = await pool.execute(
            `UPDATE carts SET quantity = ?, updated_at = NOW()
             WHERE customer_id = ? AND product_id = ?
             AND COALESCE(size, '') = ? AND COALESCE(color, '') = ?`,
            [quantity, req.customer.id, productId, size, color]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ message: "Cart item not found." });
        }

        res.json({ success: true, message: "Cart updated." });
    } catch (error) {
        console.error("UPDATE CART ERROR:", error);
        res.status(500).json({ message: "Unable to update cart." });
    }
});

app.delete("/api/cart/:productId", auth, async (req, res) => {
    try {
        let sql = "DELETE FROM carts WHERE customer_id = ? AND product_id = ?";
        const params = [req.customer.id, Number(req.params.productId)];

        if (Object.hasOwn(req.query, "size")) {
            sql += " AND COALESCE(size, '') = ?";
            params.push(String(req.query.size || ""));
        }

        if (Object.hasOwn(req.query, "color")) {
            sql += " AND COALESCE(color, '') = ?";
            params.push(String(req.query.color || ""));
        }

        const [result] = await pool.execute(sql, params);

        if (!result.affectedRows) {
            return res.status(404).json({ message: "Cart item not found." });
        }

        res.json({ success: true, message: "Product removed from cart." });
    } catch (error) {
        console.error("DELETE CART ERROR:", error);
        res.status(500).json({ message: "Unable to remove cart item." });
    }
});

/* WISHLIST */

app.get("/api/wishlist", auth, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT WishlistID, CustomerID, ProductID, AddedAt
             FROM Wishlist WHERE CustomerID = ?
             ORDER BY AddedAt DESC`,
            [req.customer.id]
        );

        const wishlist = await Promise.all(rows.map(async row => ({
            id: Number(row.WishlistID),
            customerId: Number(row.CustomerID),
            productId: Number(row.ProductID),
            addedAt: row.AddedAt,
            product: await getProductById(row.ProductID)
        })));

        res.json(wishlist);
    } catch (error) {
        console.error("GET WISHLIST ERROR:", error);
        res.status(500).json({ message: "Unable to load wishlist." });
    }
});

app.post("/api/wishlist", auth, async (req, res) => {
    try {
        const productId = Number(req.body.productId);
        const product = await getProductById(productId);

        if (!product) {
            return res.status(404).json({
                success: false, message: "Product not found."
            });
        }

        await pool.execute(
            `INSERT INTO Wishlist (CustomerID, ProductID)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE WishlistID = LAST_INSERT_ID(WishlistID)`,
            [req.customer.id, productId]
        );

        res.json({
            success: true,
            message: "Product added to wishlist.",
            productId,
            product
        });
    } catch (error) {
        console.error("ADD WISHLIST ERROR:", error);
        res.status(500).json({ message: "Unable to add wishlist item." });
    }
});

app.delete("/api/wishlist/:productId", auth, async (req, res) => {
    try {
        const [result] = await pool.execute(
            "DELETE FROM Wishlist WHERE CustomerID = ? AND ProductID = ?",
            [req.customer.id, Number(req.params.productId)]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                message: "Wishlist item not found."
            });
        }

        res.json({ success: true, message: "Product removed from wishlist." });
    } catch (error) {
        console.error("DELETE WISHLIST ERROR:", error);
        res.status(500).json({ message: "Unable to remove wishlist item." });
    }
});

/* ADDRESS HELPERS */

function validAddress(body) {
    return ["fullName", "phone", "address", "city", "state", "pincode"]
        .every(key => String(body[key] || "").trim());
}

app.get("/api/addresses", auth, (req, res) => {
    res.json(db.addresses.filter(a =>
        Number(a.customerId) === req.customer.id
    ));
});

app.post("/api/addresses", auth, (req, res) => {
    if (!validAddress(req.body)) {
        return res.status(400).json({
            message: "All address fields are required."
        });
    }

    const address = {
        id: Date.now(),
        customerId: req.customer.id,
        fullName: String(req.body.fullName).trim(),
        phone: String(req.body.phone).trim(),
        address: String(req.body.address).trim(),
        city: String(req.body.city).trim(),
        state: String(req.body.state).trim(),
        pincode: String(req.body.pincode).trim(),
        createdAt: new Date().toISOString()
    };

    db.addresses.push(address);
    saveData();

    res.json({
        success: true, message: "Address saved.", id: address.id, address
    });
});

app.put("/api/addresses/:id", auth, (req, res) => {
    const address = db.addresses.find(a =>
        Number(a.id) === Number(req.params.id) &&
        Number(a.customerId) === req.customer.id
    );

    if (!address) {
        return res.status(404).json({ message: "Address not found." });
    }

    if (!validAddress(req.body)) {
        return res.status(400).json({
            message: "All address fields are required."
        });
    }

    ["fullName", "phone", "address", "city", "state", "pincode"]
        .forEach(key => address[key] = String(req.body[key]).trim());

    address.updatedAt = new Date().toISOString();
    saveData();

    res.json({ success: true, message: "Address updated.", address });
});

app.delete("/api/addresses/:id", auth, (req, res) => {
    const oldLength = db.addresses.length;

    db.addresses = db.addresses.filter(a =>
        !(Number(a.id) === Number(req.params.id) &&
          Number(a.customerId) === req.customer.id)
    );

    if (oldLength === db.addresses.length) {
        return res.status(404).json({ message: "Address not found." });
    }

    saveData();
    res.json({ success: true, message: "Address deleted." });
});

/* ORDER ITEM HELPERS */

function selectedOption(options, keys) {
    for (const key of keys) {
        if (options[key] !== undefined &&
            options[key] !== null &&
            String(options[key]).trim()) {
            return String(options[key]).trim();
        }
    }
    return "";
}

async function buildOrderItem(productId, quantityValue, options = {}) {
    const product = await getProductById(productId);

    if (!product) {
        return { error: `Product not found or inactive: ${productId}` };
    }

    const quantity = Math.max(1, Math.floor(Number(quantityValue) || 1));

    if (quantity > product.availableStock) {
        return { error: `Insufficient stock for ${product.name}.` };
    }

    const size = selectedOption(options, [
        "selectedSize", "selected_size", "size", "Size"
    ]);

    const color = selectedOption(options, [
        "selectedColor", "selectedColour", "selected_color",
        "selected_colour", "color", "colour", "Color", "Colour"
    ]);

    const sizes = String(product.sizes || "").split(",")
        .map(v => v.trim()).filter(Boolean);
    const colors = String(product.colors || "").split(",")
        .map(v => v.trim()).filter(Boolean);

    if (sizes.length && !size) {
        return { error: `Please select a size for ${product.name}.` };
    }

    if (colors.length && !color) {
        return { error: `Please select a colour for ${product.name}.` };
    }

    if (size && sizes.length &&
        !sizes.some(v => v.toLowerCase() === size.toLowerCase())) {
        return { error: `Selected size is unavailable for ${product.name}.` };
    }

    if (color && colors.length &&
        !colors.some(v => v.toLowerCase() === color.toLowerCase())) {
        return { error: `Selected colour is unavailable for ${product.name}.` };
    }

    const price = Number(product.price);

    return {
        productId: product.id,
        name: product.name,
        price,
        quantity,
        size,
        color,
        category: product.category,
        image: product.image,
        amount: Number((price * quantity).toFixed(2))
    };
}


async function getOrderItems(customerId, body = {}) {
    const buyNowId = body.buyNowProductId ?? body.productId ?? null;
    const buyNowQuantity = body.buyNowQuantity ?? body.quantity ?? 1;
    const requestedItems = Array.isArray(body.items) ? body.items : null;

    // =====================================================
    // BUY NOW FROM CART
    // Use the actual quantity saved in the customer's cart.
    // Do not trust a browser value that may incorrectly be 1.
    // =====================================================

    if (buyNowId && body.fromCart) {
        const [rows] = await pool.execute(
            `SELECT quantity, size, color
             FROM carts
             WHERE customer_id = ? AND product_id = ?
             ORDER BY cart_id DESC`,
            [customerId, Number(buyNowId)]
        );

        if (!rows.length) {
            return { error: "Selected cart item was not found." };
        }

        const requestedSize = selectedOption(body, [
            "size", "selectedSize", "selected_size"
        ]);

        const requestedColor = selectedOption(body, [
            "color", "colour", "selectedColor",
            "selectedColour", "selected_color", "selected_colour"
        ]);

        const normalize = value =>
            String(value || "").trim().toLowerCase();

        const cartItem = rows.find(item =>
            (!requestedSize ||
                normalize(item.size) === normalize(requestedSize)) &&
            (!requestedColor ||
                normalize(item.color) === normalize(requestedColor))
        );

        if (!cartItem) {
            return {
                error: "The selected size and colour were not found in your cart."
            };
        }

        const cartQuantity = Number(cartItem.quantity);

        if (!Number.isInteger(cartQuantity) || cartQuantity < 1) {
            return { error: "Invalid quantity in your cart." };
        }

        // IMPORTANT: Use cartQuantity, not buyNowQuantity.
        const item = await buildOrderItem(
            buyNowId,
            cartQuantity,
            {
                size: cartItem.size,
                color: cartItem.color
            }
        );

        return item.error ? item : { items: [item] };
    }

    // =====================================================
    // BUY NOW DIRECTLY FROM PRODUCT PAGE
    // =====================================================

    if (buyNowId) {
        const item = await buildOrderItem(
            buyNowId,
            buyNowQuantity,
            body
        );

        return item.error ? item : { items: [item] };
    }

    // =====================================================
    // DIRECT ORDER ITEMS
    // =====================================================

    if (requestedItems && requestedItems.length) {
        const orderItems = [];

        for (const item of requestedItems) {
            const built = await buildOrderItem(
                item.productId ?? item.product_id ?? item.id,
                item.quantity,
                item
            );

            if (built.error) return built;

            orderItems.push(built);
        }

        return { items: orderItems };
    }

    // =====================================================
    // NORMAL CART CHECKOUT
    // Validate the full quantity first, then create one
    // order entry per unit.
    // =====================================================

    const [cartRows] = await pool.execute(
        `SELECT product_id, quantity, size, color
         FROM carts
         WHERE customer_id = ?
         ORDER BY cart_id DESC`,
        [customerId]
    );

    if (!cartRows.length) {
        return { error: "Cart is empty." };
    }

    const orderItems = [];

    for (const row of cartRows) {
        const quantity = Number(row.quantity);

        if (!Number.isInteger(quantity) || quantity < 1) {
            return { error: "Invalid cart quantity." };
        }

        // Validate total requested quantity against current stock.
        const validated = await buildOrderItem(
            row.product_id,
            quantity,
            {
                size: row.size,
                color: row.color
            }
        );

        if (validated.error) {
            return validated;
        }

        // Store each unit as a separate entry with quantity 1.
        for (let i = 0; i < quantity; i++) {
            orderItems.push({
                ...validated,
                quantity: 1,
                amount: Number(validated.price.toFixed(2))
            });
        }
    }

    return { items: orderItems };
}

/* CREATE MYSQL ORDER */


/* =====================================================
   CREATE MYSQL ORDER - UPDATED
   MySQL is the main storage for orders.
   Do not save orders to data.json.
===================================================== */

async function createOrder({
    customer,
    address,
    items,
    paymentMethod,
    paymentStatus,
    paymentId = null,
    razorpayOrderId = null,
    orderType = "CART"
}) {
    const subtotal = Number(
        items.reduce(
            (sum, item) =>
                sum + Number(item.price) * Number(item.quantity),
            0
        ).toFixed(2)
    );

    const shippingCharge = 0;
    const discount = 0;

    const total = Number(
        (subtotal + shippingCharge - discount).toFixed(2)
    );

    if (!Number.isFinite(total) || total <= 0) {
        throw new Error("Invalid order amount.");
    }

    const orderNumber =
        "VMART-" +
        Date.now() +
        "-" +
        crypto.randomBytes(3).toString("hex").toUpperCase();

    const connection = await pool.getConnection();

    let committed = false;

    try {
        await connection.beginTransaction();

        const [result] = await connection.execute(
            `INSERT INTO orders (
                order_number,
                customer_id,
                email,
                order_date,
                subtotal,
                shipping_charge,
                discount,
                total_amount,
                payment_method,
                payment_status,
                order_status,
                delivery_full_name,
                delivery_phone,
                delivery_address,
                delivery_city,
                delivery_state,
                delivery_pincode,
                razorpay_order_id,
                razorpay_payment_id,
                Items,
                updated_at
            ) VALUES (
                ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, 'Placed',
                ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()
            )`,
            [
                orderNumber,
                customer.id,
                String(customer.email || "").toLowerCase(),
                subtotal,
                shippingCharge,
                discount,
                total,
                paymentMethod,
                paymentStatus,
                address.fullName,
                address.phone,
                address.address,
                address.city,
                address.state,
                address.pincode,
                razorpayOrderId,
                paymentId,
                JSON.stringify(items)
            ]
        );

        await connection.commit();
        committed = true;

        console.log(
            "ORDER SAVED SUCCESSFULLY:",
            orderNumber,
            "| MySQL ID:",
            result.insertId
        );

        return {
            id: Number(result.insertId),
            orderNo: orderNumber,
            customerId: Number(customer.id),
            email: customer.email,
            date: new Date().toISOString(),
            items,
            subtotal,
            shippingCharge,
            discount,
            total,
            paymentMethod,
            paymentStatus,
            paymentId,
            razorpayOrderId,
            orderStatus: "Placed",
            orderType,
            address: {
                fullName: address.fullName,
                phone: address.phone,
                address: address.address,
                city: address.city,
                state: address.state,
                pincode: address.pincode
            }
        };

    } catch (error) {

        if (!committed) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    "ORDER ROLLBACK ERROR:",
                    rollbackError.message
                );
            }
        }

        console.error("CREATE ORDER MYSQL ERROR:", error);

        throw error;

    } finally {
        connection.release();
    }
}


/* COD / PLACE ORDER */

/* =====================================================
   COD / PLACE ORDER - UPDATED
===================================================== */

app.post("/api/orders", auth, async (req, res) => {
    try {
        const body = req.body || {};

        const paymentMethod = String(
            body.paymentMethod || "COD"
        ).toUpperCase();

        if (paymentMethod !== "COD") {
            return res.status(400).json({
                success: false,
                message:
                    "Only Cash on Delivery (COD) is currently available."
            });
        }

        const address = db.addresses.find(a =>
            Number(a.id) === Number(body.addressId) &&
            Number(a.customerId) === req.customer.id
        );

        if (!address) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid delivery address."
            });
        }

        const result = await getOrderItems(
            req.customer.id,
            body
        );

        if (result.error) {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }

        const orderType =
            body.buyNowProductId || body.productId
                ? "BUY_NOW"
                : body.items
                    ? "DIRECT"
                    : "CART";

        const order = await createOrder({
            customer: req.customer,
            address,
            items: result.items,
            paymentMethod: "COD",
            paymentStatus: "Pending",
            orderType
        });

        /*
         * The order is already committed to MySQL.
         * Cart deletion is cleanup and must not turn
         * a successfully created order into a failed response.
         */

        if (orderType === "CART") {
            try {
                await pool.execute(
                    `DELETE FROM carts WHERE customer_id = ?`,
                    [req.customer.id]
                );

                console.log(
                    "ORDER CART CLEARED:",
                    req.customer.id
                );

            } catch (cartError) {
                console.error(
                    "ORDER SAVED BUT CART CLEANUP FAILED:",
                    cartError
                );
            }
        }

        return res.status(201).json({
            success: true,
            message: "Order placed successfully.",
            order
        });

    } catch (error) {
        console.error("PLACE ORDER ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to place order."
        });
    }
});


/* =====================================================
   RAZORPAY CREATE ORDER API - DISABLED

   Original code preserved:

   app.post("/api/payment/create-order", auth, async (req, res) => {
       try {
           if (!razorpay) {
               return res.status(500).json({
                   message: "Razorpay is not configured. Check your .env file."
               });
           }

           const body = req.body || {};
           const address = db.addresses.find(a =>
               Number(a.id) === Number(body.addressId) &&
               Number(a.customerId) === req.customer.id
           );

           if (!address) {
               return res.status(400).json({
                   message: "Please select a valid delivery address."
               });
           }

           const result = await getOrderItems(req.customer.id, body);
           if (result.error) {
               return res.status(400).json({ message: result.error });
           }

           const items = result.items;
           const total = Number(items.reduce(
               (sum, item) => sum + Number(item.amount), 0
           ).toFixed(2));

           if (!Number.isFinite(total) || total <= 0) {
               return res.status(400).json({ message: "Invalid order amount." });
           }

           const orderType = body.buyNowProductId || body.productId
               ? "BUY_NOW" : body.items ? "DIRECT" : "CART";

           const paymentOrder = await razorpay.orders.create({
               amount: Math.round(total * 100),
               currency: "INR",
               receipt: "VMART_" + Date.now(),
               notes: {
                   customerId: String(req.customer.id),
                   addressId: String(address.id),
                   orderType
               }
           });

           db.paymentOrders.push({
               id: Date.now(),
               razorpayOrderId: paymentOrder.id,
               customerId: req.customer.id,
               addressId: address.id,
               items,
               orderType,
               amount: total,
               amountInPaise: Math.round(total * 100),
               status: "CREATED",
               createdAt: new Date().toISOString()
           });

           saveData();

           res.json({
               success: true,
               key: razorpayKeyId,
               keyId: razorpayKeyId,
               orderId: paymentOrder.id,
               amount: paymentOrder.amount,
               currency: paymentOrder.currency,
               receipt: paymentOrder.receipt
           });
       } catch (error) {
           console.error("RAZORPAY CREATE ERROR:", error);
           res.status(500).json({
               message: "Unable to create online payment order."
           });
       }
   });

===================================================== */

/* =====================================================
   RAZORPAY VERIFY PAYMENT API - DISABLED

   Original code preserved:

   app.post("/api/payment/verify", auth, async (req, res) => {
       try {
           if (!razorpayKeySecret) {
               return res.status(500).json({
                   message: "Razorpay secret key is missing."
               });
           }

           const {
               razorpay_order_id,
               razorpay_payment_id,
               razorpay_signature
           } = req.body || {};

           if (!razorpay_order_id || !razorpay_payment_id ||
               !razorpay_signature) {
               return res.status(400).json({
                   message: "Payment verification details are missing."
               });
           }

           const paymentOrder = db.paymentOrders.find(item =>
               item.razorpayOrderId === razorpay_order_id &&
               Number(item.customerId) === req.customer.id
           );

           if (!paymentOrder) {
               return res.status(404).json({
                   message: "Payment order not found."
               });
           }

           if (paymentOrder.status === "PAID") {
               return res.status(400).json({
                   message: "Payment already processed."
               });
           }

           const expected = crypto.createHmac(
               "sha256", razorpayKeySecret
           ).update(
               razorpay_order_id + "|" + razorpay_payment_id
           ).digest("hex");

           const expectedBuffer = Buffer.from(expected, "utf8");
           const suppliedBuffer = Buffer.from(
               String(razorpay_signature), "utf8"
           );

           const validSignature =
               expectedBuffer.length === suppliedBuffer.length &&
               crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);

           if (!validSignature) {
               paymentOrder.status = "FAILED";
               saveData();
               return res.status(400).json({
                   message: "Payment verification failed."
               });
           }

           const address = db.addresses.find(a =>
               Number(a.id) === Number(paymentOrder.addressId) &&
               Number(a.customerId) === req.customer.id
           );

           if (!address) {
               return res.status(400).json({
                   message: "Delivery address not found."
               });
           }

           const items = Array.isArray(paymentOrder.items)
               ? paymentOrder.items : [];

           const totalPaise = Math.round(items.reduce(
               (sum, item) => sum + Number(item.amount), 0
           ) * 100);

           if (totalPaise !== Number(paymentOrder.amountInPaise)) {
               return res.status(400).json({
                   message: "Payment amount verification failed."
               });
           }

           const order = await createOrder({
               customer: req.customer,
               address,
               items,
               paymentMethod: "ONLINE",
               paymentStatus: "Paid",
               paymentId: razorpay_payment_id,
               razorpayOrderId: razorpay_order_id,
               orderType: paymentOrder.orderType
           });

           paymentOrder.status = "PAID";
           paymentOrder.paymentId = razorpay_payment_id;
           paymentOrder.paidAt = new Date().toISOString();

           if (paymentOrder.orderType === "CART") {
               await pool.execute(
                   "DELETE FROM carts WHERE customer_id = ?",
                   [req.customer.id]
               );
           }

           saveData();

           res.json({
               success: true,
               message: "Payment successful and order placed.",
               order
           });
       } catch (error) {
           console.error("RAZORPAY VERIFY ERROR:", error);
           res.status(500).json({
               message: "Unable to verify payment."
           });
       }
   });

===================================================== */

/* ORDER HELPERS */

function parseItems(value, fallback = []) {
    if (!value) return fallback;

    try {
        const items = typeof value === "string" ? JSON.parse(value) : value;
        return Array.isArray(items) ? items : fallback;
    } catch (error) {
        console.error("ORDER ITEMS PARSE ERROR:", error.message);
        return fallback;
    }
}

function mapOrder(row) {
    const saved = db.orders.find(item =>
        Number(item.id) === Number(row.order_id)
    );

    return {
        id: Number(row.order_id),
        orderNo: row.order_number,
        customerId: Number(row.customer_id),
        email: row.email || "",
        date: row.order_date,
        items: parseItems(row.Items, saved?.items || []),
        subtotal: Number(row.subtotal || 0),
        shippingCharge: Number(row.shipping_charge || 0),
        discount: Number(row.discount || 0),
        total: Number(row.total_amount || 0),
        paymentMethod: row.payment_method || "",
        paymentStatus: row.payment_status || "",
        paymentId: row.razorpay_payment_id || null,
        razorpayOrderId: row.razorpay_order_id || null,
        orderStatus: row.order_status || "",
        address: {
            fullName: row.delivery_full_name || "",
            phone: row.delivery_phone || "",
            address: row.delivery_address || "",
            city: row.delivery_city || "",
            state: row.delivery_state || "",
            pincode: row.delivery_pincode || ""
        }
    };
}

/* GET CUSTOMER ORDERS */

/* =====================================================
   GET CUSTOMER ORDERS - UPDATED
===================================================== */

app.get("/api/orders", auth, async (req, res) => {
    const startedAt = Date.now();

    try {
        const [rows] = await pool.execute(
            `SELECT
                order_id,
                order_number,
                customer_id,
                email,
                order_date,
                subtotal,
                shipping_charge,
                discount,
                total_amount,
                payment_method,
                payment_status,
                order_status,
                delivery_full_name,
                delivery_phone,
                delivery_address,
                delivery_city,
                delivery_state,
                delivery_pincode,
                razorpay_order_id,
                razorpay_payment_id,
                Items
             FROM orders
             WHERE customer_id = ?
             ORDER BY order_date DESC, order_id DESC`,
            [req.customer.id]
        );

        const orders = rows.map(mapOrder);

        console.log(
            `GET ORDERS SUCCESS | Customer: ${req.customer.id} | ` +
            `Count: ${orders.length} | Time: ${Date.now() - startedAt} ms`
        );

        return res.json({
            success: true,
            orders
        });

    } catch (error) {
        console.error(
            "GET ORDERS ERROR:",
            error.code || "",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to load customer orders."
        });
    }
});


/* GET ONE ORDER */

app.get("/api/orders/:id", auth, async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid order ID." });
        }

        const [rows] = await pool.execute(
            `SELECT * FROM orders
             WHERE order_id = ? AND customer_id = ?
             LIMIT 1`,
            [id, req.customer.id]
        );

        if (!rows.length) {
            return res.status(404).json({ message: "Order not found." });
        }

        res.json(mapOrder(rows[0]));
    } catch (error) {
        console.error("GET ORDER ERROR:", error);
        res.status(500).json({
            message: "Unable to load order details."
        });
    }
});

/* RETURN ORDER */

app.post("/api/orders/:id/return", auth, async (req, res) => {
    try {
        const id = Number(req.params.id);

        const [rows] = await pool.execute(
            `SELECT order_id, order_status FROM orders
             WHERE order_id = ? AND customer_id = ? LIMIT 1`,
            [id, req.customer.id]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false, message: "Order not found."
            });
        }

        if (String(rows[0].order_status).toLowerCase() !== "delivered") {
            return res.status(400).json({
                success: false,
                message: "Only delivered orders can be returned."
            });
        }

        const reason = String(
            req.body.reason || "Customer requested return"
        ).trim();

        await pool.execute(
            `UPDATE orders SET order_status = 'Return Requested',
             updated_at = NOW()
             WHERE order_id = ? AND customer_id = ?`,
            [id, req.customer.id]
        );

        const saved = db.orders.find(item => Number(item.id) === id);

        if (saved) {
            saved.orderStatus = "Return Requested";
            saved.returnStatus = "Requested";
            saved.returnReason = reason;
            saved.returnRequestedAt = new Date().toISOString();
        }

        saveData();

        res.json({
            success: true,
            message: "Return request submitted successfully."
        });
    } catch (error) {
        console.error("RETURN ERROR:", error);
        res.status(500).json({
            success: false, message: "Unable to submit return request."
        });
    }
});

/* GET RETURNS */

app.get("/api/returns", auth, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT * FROM orders
             WHERE customer_id = ?
             AND order_status IN ('Return Requested', 'Returned')
             ORDER BY updated_at DESC, order_id DESC`,
            [req.customer.id]
        );

        const returns = rows.map(row => {
            const saved = db.orders.find(
                item => Number(item.id) === Number(row.order_id)
            );

            return {
                id: Number(row.order_id),
                orderNo: row.order_number,
                date: row.order_date,
                total: Number(row.total_amount),
                orderStatus: row.order_status,
                returnStatus: saved?.returnStatus || row.order_status,
                returnReason: saved?.returnReason || ""
            };
        });

        res.json({ success: true, returns });
    } catch (error) {
        console.error("GET RETURNS ERROR:", error);
        res.status(500).json({
            success: false, message: "Unable to load returns."
        });
    }
});

/* DELETE ORDER */

app.delete("/api/orders/:id", auth, async (req, res) => {
    try {
        const id = Number(req.params.id);

        const [result] = await pool.execute(
            "DELETE FROM orders WHERE order_id = ? AND customer_id = ?",
            [id, req.customer.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false, message: "Order not found."
            });
        }

        db.orders = db.orders.filter(item =>
            !(Number(item.id) === id &&
              Number(item.customerId) === req.customer.id)
        );

        saveData();
        res.json({ success: true, message: "Order deleted successfully." });
    } catch (error) {
        console.error("DELETE ORDER ERROR:", error);
        res.status(500).json({
            success: false, message: "Unable to delete order."
        });
    }
});

/* HEALTH CHECK */

app.get("/api/health", async (req, res) => {
    try {
        const [products] = await pool.execute(
            "SELECT COUNT(*) AS total FROM Products WHERE Status = 'Active'"
        );
        const [orders] = await pool.execute(
            "SELECT COUNT(*) AS total FROM orders"
        );
        const [customers] = await pool.execute(
            "SELECT COUNT(*) AS total FROM Customers"
        );
        const [inventory] = await pool.execute(
            "SELECT COUNT(*) AS total FROM inventory"
        );

        res.json({
            status: "OK",
            mysql: "Connected",
            razorpay: false,
            products: Number(products[0].total),
            inventoryRecords: Number(inventory[0].total),
            customers: Number(customers[0].total),
            orders: Number(orders[0].total)
        });
    } catch (error) {
        console.error("HEALTH CHECK ERROR:", error);
        res.status(500).json({
            status: "ERROR",
            mysql: "Disconnected or query failed",
            razorpay: false
        });
    }
});

/* UNKNOWN API ROUTES */

app.use("/api", (req, res) => {
    res.status(404).json({ message: "API route not found." });
});

/* START SERVER */

async function startServer() {
    try {
        await testConnection();

        const [productTables] = await pool.execute(
            "SHOW TABLES LIKE 'Products'"
        );
        const [orderTables] = await pool.execute(
            "SHOW TABLES LIKE 'orders'"
        );
        const [inventoryTables] = await pool.execute(
            "SHOW TABLES LIKE 'inventory'"
        );

        if (!productTables.length) {
            throw new Error("Products table was not found.");
        }

        if (!orderTables.length) {
            throw new Error("Orders table was not found.");
        }

        if (!inventoryTables.length) {
            throw new Error("Inventory table was not found.");
        }

        const products = await getAllProducts();

        app.listen(PORT, () => {
            console.log("");
            console.log("====================================");
            console.log("       V MART E-COMMERCE SERVER");
            console.log("====================================");
            console.log(`Server: http://localhost:${PORT}`);
            console.log(`Active MySQL products: ${products.length}`);
            console.log("Inventory: Connected");
            console.log("Customers: MySQL");
            console.log("Cart: MySQL");
            console.log("Wishlist: MySQL");
            console.log("Orders: MySQL");
            console.log("Addresses: data.json");
            console.log("Payment: COD Only");
            console.log("Razorpay: Temporarily Disabled");
            console.log("MySQL: Connected");
            console.log("====================================");
            console.log("");
        });
    } catch (error) {
        console.error("");
        console.error("V MART SERVER STARTUP FAILED");
        console.error("Error:", error.message);
        console.error("Code:", error.code || "N/A");
        console.error("");
        process.exitCode = 1;
    }
}

startServer();

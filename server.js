// server.js

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authMiddleware = require("./authMiddleware");
const config = require("./config");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const receiptStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./uploads/receipts";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, "receipt-" + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: receiptStorage });

// --- 路由部分 ---

app.post("/api/register", express.json(), async (req, res) => {
  const { name, email, user_class, phone, password } = req.body;
  if (!name || !email || !password || !user_class || !phone) {
    return res.status(400).json({ message: "All fields are required." });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query =
      "INSERT INTO users (name, email, password, user_class, phone) VALUES (?, ?, ?, ?, ?)";
    const [result] = await db.execute(query, [
      name,
      email,
      hashedPassword,
      user_class,
      phone,
    ]);
    res.status(201).json({
      message: "User registered successfully!",
      userId: result.insertId,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email already exists." });
    }
    res.status(500).json({ message: "Server error", error });
  }
});

app.post("/api/login", express.json(), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide email and password." });
  }
  try {
    const query = "SELECT * FROM users WHERE email = ?";
    const [users] = await db.execute(query, [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    const user = users[0];
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    const token = jwt.sign(
      {
        userId: user.id,
        name: user.name,
        role: user.role,
        phone: user.phone,
        user_class: user.user_class,
      },
      config.JWT_SECRET,
      { expiresIn: "8h" }
    );
    res.json({
      message: "Login successful!",
      token,
      name: user.name,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

app.post(
  "/api/orders",
  authMiddleware,
  upload.single("receipt"),
  async (req, res, next) => {
    try {
      const { userId, name, phone } = req.user;
      const {
        orderNumber,
        orderType,
        class: userClass,
        items,
        notes,
        total,
        paymentMethod,
      } = req.body;

      let finalNotes = notes || "";

      if (req.file) {
        const filePath = `/uploads/receipts/${req.file.filename}`;
        finalNotes += `\n[Receipt: ${filePath}]`;
      }

      const query = `
        INSERT INTO orders
        (user_id, customer_name, order_number, order_type, user_class, user_phone, order_details, notes, payment_method, total_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await db.execute(query, [
        userId,
        name,
        orderNumber,
        orderType,
        userClass,
        phone,
        items,
        finalNotes,
        paymentMethod,
        total,
      ]);
      res.status(201).json({ message: "Order created successfully!" });
    } catch (error) {
      next(error);
    }
  }
);

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Forbidden: Admins only." });
  }
};

app.get("/api/admin/users", authMiddleware, adminOnly, async (req, res) => {
  try {
    const [users] = await db.execute(
      "SELECT id, name, email, phone, user_class, role, created_at FROM users ORDER BY created_at DESC"
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users", error });
  }
});

app.get("/api/admin/orders", authMiddleware, adminOnly, async (req, res) => {
  try {
    const query = `
            SELECT id, customer_name, order_number, order_type, user_class, user_phone, order_details, notes, payment_method, total_amount, created_at
            FROM orders
            ORDER BY created_at DESC
        `;
    const [orders] = await db.execute(query);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch orders", error });
  }
});

// --- 新增：删除订单的 API 路由 ---
app.delete(
  "/api/admin/orders/:id",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const { id } = req.params; // 从 URL 中获取订单 ID
      const query = "DELETE FROM orders WHERE id = ?";
      const [result] = await db.execute(query, [id]);

      if (result.affectedRows > 0) {
        res.status(200).json({ message: "Order deleted successfully." });
      } else {
        res.status(404).json({ message: "Order not found." });
      }
    } catch (error) {
      console.error("Delete order error:", error);
      res.status(500).json({ message: "Failed to delete order", error });
    }
  }
);

// 全局错误捕获中间件 (保持不变)
app.use((err, req, res, next) => {
  console.error("\n--- [GLOBAL ERROR HANDLER] An error was caught! ---");
  console.error("Error Name:", err.name);
  console.error("Error Message:", err.message);
  console.error("Stack Trace:", err.stack);

  if (err instanceof multer.MulterError) {
    return res
      .status(400)
      .json({ message: `File Upload Error: ${err.message}` });
  }

  res.status(500).json({
    message:
      "An unexpected server error occurred. Please check the server logs.",
    error: err.message,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

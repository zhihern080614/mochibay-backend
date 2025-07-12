// authMiddleware.js

const jwt = require("jsonwebtoken");
const config = require("./config"); // 导入统一的配置文件

// --- START: 添加详细日志 ---
console.log("--- authMiddleware.js loaded ---");
console.log(
  "Using JWT_SECRET from config:",
  config.JWT_SECRET
    ? `...${config.JWT_SECRET.slice(-6)}`
    : "SECRET IS UNDEFINED!"
);
// --- END: 添加详细日志 ---

const authMiddleware = (req, res, next) => {
  // --- START: 添加详细日志 ---
  console.log(`\n[AUTH] Request received for: ${req.method} ${req.path}`);
  // --- END: 添加详细日志 ---

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // --- START: 添加详细日志 ---
    console.error(
      "[AUTH ERROR] No 'Bearer' token found in authorization header."
    );
    // --- END: 添加详细日志 ---
    return res
      .status(401)
      .json({ message: "Unauthorized: No token provided." });
  }

  const token = authHeader.split(" ")[1];

  // --- START: 添加详细日志 ---
  console.log("[AUTH] Token found. Attempting to verify...");
  console.log("[AUTH] Token to verify:", token.substring(0, 15) + "..."); // 只打印前15个字符，保护隐私
  // --- END: 添加详细日志 ---

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;

    // --- START: 添加详细日志 ---
    console.log("[AUTH SUCCESS] Token verified successfully!");
    console.log("[AUTH SUCCESS] Decoded user:", decoded);
    // --- END: 添加详细日志 ---

    next(); // 验证成功，放行请求到下一个处理函数（订单逻辑）
  } catch (error) {
    // --- START: 添加详细日志 ---
    console.error("\n!!! [AUTH FATAL ERROR] JWT Verification Failed !!!");
    console.error("!!! Error Details:", {
      errorMessage: error.message,
      errorName: error.name,
      tokenReceived: token, // 在开发环境中打印完整token以供调试
      secretUsed: config.JWT_SECRET
        ? `...${config.JWT_SECRET.slice(-6)}`
        : "SECRET IS UNDEFINED!",
    });
    console.error(
      "!!! This is likely due to a mismatch between the secret key used to sign the token (during login) and the key used to verify it now.\n"
    );
    // --- END: 添加详细日志 ---

    // 保留详细的错误日志，以防万一 (这部分你原来就有，很好)
    console.error("JWT Verification Failed:", {
      errorMessage: error.message,
      errorName: error.name,
    });

    return res.status(401).json({ message: `Unauthorized: ${error.message}` });
  }
};

module.exports = authMiddleware;

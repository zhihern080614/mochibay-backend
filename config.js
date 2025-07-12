// config.js

// 这个文件是项目中所有配置的“唯一真相来源”。
// 我们在这里从 .env 文件读取密钥，并统一导出。
// 这可以彻底避免因模块缓存或环境变量加载顺序导致的密钥不一致问题。
module.exports = {
  JWT_SECRET:
    process.env.JWT_SECRET ||
    "fallback_debug_secret_key_12345_please_set_in_env_file",
};

// 在服务器启动时检查一下，如果使用的是备用密钥，就发出警告。
if (!process.env.JWT_SECRET) {
  console.warn("\n!!! WARNING: JWT_SECRET is not defined in your .env file.");
  console.warn("!!! Using a temporary, insecure fallback key for debugging.\n");
}

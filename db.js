// 新的 db.js 代码，增加了错误捕获
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// 打印出配置，方便调试
console.log("Attempting to connect to database with config:", {
    host: dbConfig.host,
    user: dbConfig.user,
    database: dbConfig.database,
    password: dbConfig.password ? '******' : 'EMPTY' // 不直接打印密码
});

const pool = mysql.createPool(dbConfig);

// 添加一个连接测试，以便立即发现问题
pool.getConnection()
    .then(connection => {
        console.log('✅ Database connected successfully!');
        connection.release(); // 释放连接
    })
    .catch(err => {
        console.error('❌ FATAL: Could not connect to the database.');
        console.error('Error details:', err.code, err.message);
        // 如果是因为密码问题，给出明确提示
        if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('Hint: This is an access denied error. Please double-check your DB_USER and DB_PASSWORD in the .env file.');
        }
        // 如果是找不到数据库，给出提示
        if (err.code === 'ER_BAD_DB_ERROR') {
            console.error(`Hint: The database '${process.env.DB_NAME}' was not found. Please ensure it has been created in phpMyAdmin.`);
        }
        process.exit(1); // 关键：如果连接失败，直接退出程序
    });

module.exports = pool;
const Database = require('better-sqlite3');
const path = require('path');

// 创建数据库连接
const db = new Database(path.join(__dirname, '../data.db'));

// 初始化数据库表
function initDatabase() {
  // 商品表
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT DEFAULT '自动发货',
      name TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER DEFAULT 0,
      sold INTEGER DEFAULT 0
    )
  `);

  // 兑换码表
  db.exec(`
    CREATE TABLE IF NOT EXISTS codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'available',
      order_id TEXT,
      machine_id TEXT,
      activated_at DATETIME,
      expire_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // 订单表
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL UNIQUE,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      amount REAL NOT NULL,
      user_id INTEGER,
      code TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      plain_password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 迁移：为 codes 表添加新字段（如果不存在）
  try {
    const columns = db.prepare("PRAGMA table_info(codes)").all();
    const columnNames = columns.map(c => c.name);

    if (!columnNames.includes('machine_id')) {
      db.exec('ALTER TABLE codes ADD COLUMN machine_id TEXT');
      console.log('已添加 machine_id 字段');
    }
    if (!columnNames.includes('activated_at')) {
      db.exec('ALTER TABLE codes ADD COLUMN activated_at DATETIME');
      console.log('已添加 activated_at 字段');
    }
    if (!columnNames.includes('expire_at')) {
      db.exec('ALTER TABLE codes ADD COLUMN expire_at DATETIME');
      console.log('已添加 expire_at 字段');
    }
    if (!columnNames.includes('disabled')) {
      db.exec('ALTER TABLE codes ADD COLUMN disabled INTEGER DEFAULT 0');
      console.log('已添加 disabled 字段');
    }
  } catch (e) {
    console.log('迁移检查:', e.message);
  }

  // 迁移：为 products 表添加 duration_minutes 字段
  try {
    const productColumns = db.prepare("PRAGMA table_info(products)").all();
    const productColumnNames = productColumns.map(c => c.name);

    if (!productColumnNames.includes('duration_minutes')) {
      db.exec('ALTER TABLE products ADD COLUMN duration_minutes INTEGER DEFAULT 0');
      console.log('已添加 duration_minutes 字段');
    }
  } catch (e) {
    console.log('products迁移检查:', e.message);
  }

  // 历史记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      code TEXT,
      product_name TEXT,
      machine_id TEXT,
      username TEXT,
      amount REAL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // API请求日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      machine_id TEXT,
      code TEXT,
      ip TEXT,
      user_agent TEXT,
      request_body TEXT,
      response_status INTEGER,
      response_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 检查是否已有数据
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get();

  if (productCount.count === 0) {
    // 插入初始商品数据
    const insertProduct = db.prepare('INSERT INTO products (name, price, stock, sold) VALUES (?, ?, ?, ?)');

    insertProduct.run('字字动画即梦插件1天会员兑换码', 1.2, 44, 56);
    insertProduct.run('字字动画即梦插件3天会员兑换码', 3, 41, 39);
    insertProduct.run('字字动画即梦插件30天会员兑换码', 22, 102, 23);
    insertProduct.run('字字动画即梦插件365天会员兑换码', 168, 99, 10);

    // 插入测试兑换码
    const insertCode = db.prepare('INSERT INTO codes (product_id, code) VALUES (?, ?)');

    // 为每个商品添加一些测试兑换码
    for (let productId = 1; productId <= 4; productId++) {
      for (let i = 0; i < 50; i++) {
        const code = generateCode();
        insertCode.run(productId, code);
      }
    }

    console.log('数据库初始化完成，已插入测试数据');
  }
}

// 生成随机兑换码
function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    if (i > 0) code += '-';
    for (let j = 0; j < 4; j++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return code;
}

// 从商品名称或 duration_minutes 提取时长（返回分钟数）
function extractDuration(product) {
  // 优先使用 duration_minutes 字段
  if (product && product.duration_minutes && product.duration_minutes > 0) {
    return product.duration_minutes;
  }

  // 兼容旧数据：从商品名称提取天数
  const productName = (product && product.name) || product || '';
  if (typeof productName !== 'string') {
    return 24 * 60; // 默认1天
  }

  const match = productName.match(/(\d+)天/);
  if (match) {
    return parseInt(match[1]) * 24 * 60; // 天转分钟
  }

  // 尝试匹配小时
  const hourMatch = productName.match(/(\d+)小时/);
  if (hourMatch) {
    return parseInt(hourMatch[1]) * 60;
  }

  // 尝试匹配分钟
  const minuteMatch = productName.match(/(\d+)分钟/);
  if (minuteMatch) {
    return parseInt(minuteMatch[1]);
  }

  return 24 * 60; // 默认1天（1440分钟）
}

// 兼容旧代码
function extractDays(productName) {
  const minutes = extractDuration({ name: productName });
  return minutes / (24 * 60);
}

module.exports = { db, initDatabase, generateCode, extractDays, extractDuration };

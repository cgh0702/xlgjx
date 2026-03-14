const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./models/database');

// 初始化数据库
initDatabase();

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 路由
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/pay', require('./routes/payment'));
app.use('/api/users', require('./routes/users')); // 用户接口
app.use('/api/admin', require('./routes/admin')); // 后台管理接口
app.use('/api/license', require('./routes/license')); // 会员验证接口

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 后端服务已启动: http://localhost:${PORT}`);
  console.log(`📦 API地址: http://localhost:${PORT}/api`);
});

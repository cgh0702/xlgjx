const express = require('express');
const router = express.Router();
const { db } = require('../models/database');
const svgCaptcha = require('svg-captcha');

// 管理员账号（写死，不可删除）
const ADMIN_USERNAME = '15802011996';
const ADMIN_PASSWORD = '84455999aA*';

// 简单的密码加密（生产环境应使用bcrypt）
const crypto = require('crypto');
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// 验证码存储（生产环境应使用Redis）
const captchaStore = new Map();

// IP注册频率限制（生产环境应使用Redis）
const ipRegisterStore = new Map();
const IP_REGISTER_LIMIT = 5; // 每小时最多注册次数
const IP_REGISTER_WINDOW = 60 * 60 * 1000; // 1小时窗口（毫秒）

// 检查IP注册次数
const checkIpLimit = (ip) => {
  const now = Date.now();
  const record = ipRegisterStore.get(ip);

  if (!record) {
    return { allowed: true, remaining: IP_REGISTER_LIMIT };
  }

  // 过滤掉过期的注册记录
  const validTimestamps = record.timestamps.filter(t => now - t < IP_REGISTER_WINDOW);

  if (validTimestamps.length >= IP_REGISTER_LIMIT) {
    const oldestTimestamp = validTimestamps[0];
    const resetTime = Math.ceil((oldestTimestamp + IP_REGISTER_WINDOW - now) / 60000);
    return { allowed: false, resetMinutes: resetTime };
  }

  return { allowed: true, remaining: IP_REGISTER_LIMIT - validTimestamps.length };
};

// 记录IP注册
const recordIpRegister = (ip) => {
  const now = Date.now();
  const record = ipRegisterStore.get(ip);

  if (!record) {
    ipRegisterStore.set(ip, { timestamps: [now] });
  } else {
    // 过滤掉过期的注册记录
    record.timestamps = record.timestamps.filter(t => now - t < IP_REGISTER_WINDOW);
    record.timestamps.push(now);
  }
};

// 清理过期IP记录（每小时执行一次）
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRegisterStore) {
    record.timestamps = record.timestamps.filter(t => now - t < IP_REGISTER_WINDOW);
    if (record.timestamps.length === 0) {
      ipRegisterStore.delete(ip);
    }
  }
}, 60 * 60 * 1000);

// 生成验证码
router.get('/captcha', (req, res) => {
  const captcha = svgCaptcha.create({
    size: 4,
    noise: 2,
    color: true,
    background: '#f0f0f0'
  });

  const captchaId = Date.now().toString() + Math.random().toString(36).substring(2);
  captchaStore.set(captchaId, captcha.text.toLowerCase());

  // 5分钟后过期
  setTimeout(() => captchaStore.delete(captchaId), 5 * 60 * 1000);

  res.json({
    success: true,
    data: {
      captchaId,
      captchaSvg: captcha.data
    }
  });
});

// 注册
router.post('/register', (req, res) => {
  try {
    const { username, password, captchaId, captchaCode } = req.body;

    // 获取客户端IP
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

    // 检查IP注册频率
    const ipCheck = checkIpLimit(clientIp);
    if (!ipCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: `注册过于频繁，请 ${ipCheck.resetMinutes} 分钟后再试`
      });
    }

    // 验证码校验
    if (!captchaId || !captchaCode) {
      return res.status(400).json({ success: false, message: '请输入验证码' });
    }

    const storedCode = captchaStore.get(captchaId);
    if (!storedCode) {
      return res.status(400).json({ success: false, message: '验证码已过期，请重新获取' });
    }

    if (storedCode !== captchaCode.toLowerCase()) {
      return res.status(400).json({ success: false, message: '验证码错误' });
    }

    // 验证成功后删除验证码
    captchaStore.delete(captchaId);

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ success: false, message: '用户名需要3-20个字符' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: '密码至少6个字符' });
    }

    // 禁止注册管理员账号
    if (username === ADMIN_USERNAME) {
      return res.status(400).json({ success: false, message: '该用户名不可使用' });
    }

    // 检查用户名是否已存在
    const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(400).json({ success: false, message: '用户名已存在' });
    }

    // 创建用户（存储加密密码和明文密码）
    const hashedPassword = hashPassword(password);
    const result = db.prepare('INSERT INTO users (username, password, plain_password) VALUES (?, ?, ?)').run(username, hashedPassword, password);

    // 记录IP注册
    recordIpRegister(clientIp);

    res.json({
      success: true,
      message: '注册成功',
      data: {
        id: result.lastInsertRowid,
        username
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ success: false, message: '注册失败' });
  }
});

// 登录
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    // 检查是否是管理员账号
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      return res.json({
        success: true,
        message: '登录成功',
        data: {
          id: 0, // 管理员使用特殊ID
          username: ADMIN_USERNAME,
          isAdmin: true
        }
      });
    }

    // 查找用户
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(400).json({ success: false, message: '用户名或密码错误' });
    }

    // 验证密码
    const hashedPassword = hashPassword(password);
    if (user.password !== hashedPassword) {
      return res.status(400).json({ success: false, message: '用户名或密码错误' });
    }

    res.json({
      success: true,
      message: '登录成功',
      data: {
        id: user.id,
        username: user.username,
        isAdmin: false
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

// 获取用户信息（根据用户ID）
router.get('/:id', (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取用户信息失败' });
  }
});

// 获取用户订单
router.get('/:id/orders', (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC
    `).all(req.params.id);

    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取订单失败' });
  }
});

module.exports = router;

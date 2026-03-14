const express = require('express');
const router = express.Router();
const { db, generateCode } = require('../models/database');

// 添加历史记录
function addHistory(action, data) {
  try {
    db.prepare(`
      INSERT INTO history (action, code, product_name, machine_id, username, amount, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      action,
      data.code || null,
      data.product_name || null,
      data.machine_id || null,
      data.username || null,
      data.amount || null,
      data.details || null
    );
  } catch (e) {
    console.error('添加历史记录失败:', e);
  }
}

// ============ 商品管理 ============

// 获取所有商品（详细信息）
router.get('/products', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products ORDER BY id ASC').all();
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取商品失败' });
  }
});

// 创建商品（支持自定义时长）
router.post('/products', (req, res) => {
  try {
    const { name, price, duration_minutes } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: '请输入商品名称' });
    }

    if (price === undefined || price === null) {
      return res.status(400).json({ success: false, message: '请输入价格' });
    }

    // duration_minutes 为 0 或未提供时，尝试从名称提取
    let duration = duration_minutes || 0;
    if (!duration) {
      // 从名称提取时长
      const dayMatch = name.match(/(\d+)天/);
      const hourMatch = name.match(/(\d+)小时/);
      const minuteMatch = name.match(/(\d+)分钟/);

      if (dayMatch) {
        duration = parseInt(dayMatch[1]) * 24 * 60;
      } else if (hourMatch) {
        duration = parseInt(hourMatch[1]) * 60;
        if (minuteMatch) {
          duration += parseInt(minuteMatch[1]);
        }
      } else if (minuteMatch) {
        duration = parseInt(minuteMatch[1]);
      } else {
        duration = 24 * 60; // 默认1天
      }
    }

    const result = db.prepare('INSERT INTO products (name, price, stock, sold, duration_minutes) VALUES (?, ?, 0, 0, ?)')
      .run(name, price, duration);

    res.json({
      success: true,
      message: '商品创建成功',
      data: {
        id: result.lastInsertRowid,
        name,
        price,
        duration_minutes: duration
      }
  });
  } catch (error) {
    console.error('创建商品失败:', error);
    res.status(500).json({ success: false, message: '创建商品失败' });
  }
});

// 更新商品信息
router.put('/products/:id', (req, res) => {
  try {
    const { name, price, stock, duration_minutes } = req.body;
    const { id } = req.params;

    if (duration_minutes !== undefined) {
      db.prepare('UPDATE products SET name = ?, price = ?, stock = ?, duration_minutes = ? WHERE id = ?')
        .run(name, price, stock, duration_minutes, id);
    } else {
      db.prepare('UPDATE products SET name = ?, price = ?, stock = ? WHERE id = ?')
        .run(name, price, stock, id);
    }

    res.json({ success: true, message: '商品更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新商品失败' });
  }
});

// 删除商品
router.delete('/products/:id', (req, res) => {
  try {
    const { id } = req.params;

    // 检查是否有未使用的兑换码
    const unusedCodes = db.prepare("SELECT COUNT(*) as count FROM codes WHERE product_id = ? AND status = 'available'").get(id);
    if (unusedCodes.count > 0) {
      return res.status(400).json({
        success: false,
        message: `该商品还有 ${unusedCodes.count} 个未使用的兑换码，请先删除兑换码`
      });
    }

    // 删除商品
    db.prepare('DELETE FROM products WHERE id = ?').run(id);

    res.json({ success: true, message: '商品删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除商品失败' });
  }
});

// ============ 兑换码管理 ============

// 获取兑换码列表
router.get('/codes', (req, res) => {
  try {
    const { productId, status, page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    let sql = `SELECT c.*, p.name as product_name
               FROM codes c
               LEFT JOIN products p ON c.product_id = p.id
               WHERE 1=1`;
    const params = [];

    if (productId) {
      sql += ' AND c.product_id = ?';
      params.push(productId);
    }

    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }

    // 获取总数
    const countSql = sql.replace('SELECT c.*, p.name as product_name', 'SELECT COUNT(*) as total');
    const total = db.prepare(countSql).get(...params).total;

    // 获取分页数据
    sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const codes = db.prepare(sql).all(...params);

    res.json({
      success: true,
      data: {
        list: codes,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取兑换码失败' });
  }
});

// 批量添加兑换码
router.post('/codes/batch', (req, res) => {
  try {
    const { productId, count, codes: customCodes } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: '请选择商品' });
    }

    // 检查商品是否存在
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: '商品不存在' });
    }

    const insertCode = db.prepare('INSERT INTO codes (product_id, code) VALUES (?, ?)');
    const addedCodes = [];

    if (customCodes && customCodes.length > 0) {
      // 使用自定义兑换码
      for (const code of customCodes) {
        try {
          insertCode.run(productId, code.trim());
          addedCodes.push(code.trim());
        } catch (e) {
          // 忽略重复的兑换码
        }
      }
    } else {
      // 自动生成兑换码
      const codeCount = parseInt(count) || 10;
      for (let i = 0; i < codeCount; i++) {
        const code = generateCode();
        insertCode.run(productId, code);
        addedCodes.push(code);
      }
    }

    // 更新库存
    db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
      .run(addedCodes.length, productId);

    res.json({
      success: true,
      message: `成功添加 ${addedCodes.length} 个兑换码`,
      data: addedCodes
    });
  } catch (error) {
    console.error('添加兑换码失败:', error);
    res.status(500).json({ success: false, message: '添加兑换码失败' });
  }
});

// 删除单个兑换码（仅未使用的）
router.delete('/codes/:id', (req, res) => {
  try {
    const { id } = req.params;

    const code = db.prepare('SELECT c.*, p.name as product_name FROM codes c LEFT JOIN products p ON c.product_id = p.id WHERE c.id = ?').get(id);
    if (!code) {
      return res.status(404).json({ success: false, message: '兑换码不存在' });
    }

    if (code.status !== 'available') {
      return res.status(400).json({ success: false, message: '只能删除未使用的兑换码' });
    }

    // 记录历史
    addHistory('删除兑换码', {
      code: code.code,
      product_name: code.product_name,
      details: '管理员删除未使用的兑换码'
    });

    // 删除兑换码并减少库存
    db.prepare('DELETE FROM codes WHERE id = ?').run(id);
    db.prepare('UPDATE products SET stock = stock - 1 WHERE id = ?').run(code.product_id);

    res.json({ success: true, message: '兑换码删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除兑换码失败' });
  }
});

// 撤销激活（取消用户会员资格，兑换码不可再用）
router.post('/codes/:id/revoke', (req, res) => {
  try {
    const { id } = req.params;

    const code = db.prepare('SELECT c.*, p.name as product_name FROM codes c LEFT JOIN products p ON c.product_id = p.id WHERE c.id = ?').get(id);
    if (!code) {
      return res.status(404).json({ success: false, message: '兑换码不存在' });
    }

    if (code.status !== 'used') {
      return res.status(400).json({ success: false, message: '只能撤销已使用的兑换码' });
    }

    // 记录历史
    addHistory('撤销激活', {
      code: code.code,
      product_name: code.product_name,
      machine_id: code.machine_id,
      details: `管理员撤销会员资格，原到期时间: ${code.expire_at || '无'}`
    });

    // 撤销激活：状态改为 revoked，清除到期时间，保留机器码和激活时间作为记录
    db.prepare(`
      UPDATE codes
      SET status = 'revoked',
          expire_at = NULL
      WHERE id = ?
    `).run(id);

    res.json({ success: true, message: '已撤销激活，用户会员资格已取消' });
  } catch (error) {
    res.status(500).json({ success: false, message: '撤销激活失败' });
  }
});

// 撤销该机器所有会员（一键撤销）
router.post('/codes/revoke-machine/:machine_id', (req, res) => {
  try {
    const { machine_id } = req.params;

    if (!machine_id) {
      return res.status(400).json({ success: false, message: '缺少机器标识' });
    }

    // 获取该机器所有有效的会员兑换码
    const codes = db.prepare(`
      SELECT c.*, p.name as product_name
      FROM codes c
      LEFT JOIN products p ON c.product_id = p.id
      WHERE c.machine_id = ? AND c.status = 'used'
    `).all(machine_id);

    if (codes.length === 0) {
      return res.status(400).json({ success: false, message: '该机器没有有效的会员记录' });
    }

    // 记录历史并撤销
    for (const code of codes) {
      addHistory('撤销激活', {
        code: code.code,
        product_name: code.product_name,
        machine_id: code.machine_id,
        details: `批量撤销会员资格，原到期时间: ${code.expire_at || '无'}`
      });
    }

    // 批量撤销
    const result = db.prepare(`
      UPDATE codes
      SET status = 'revoked',
          expire_at = NULL
      WHERE machine_id = ? AND status = 'used'
    `).run(machine_id);

    res.json({
      success: true,
      message: `已撤销 ${result.changes} 个会员记录`,
      data: { count: result.changes }
    });
  } catch (error) {
    console.error('批量撤销失败:', error);
    res.status(500).json({ success: false, message: '批量撤销失败' });
  }
});

// ============ 订单管理 ============

// 获取订单列表
router.get('/orders', (req, res) => {
  try {
    const { status, page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    // 获取总数
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const total = db.prepare(countSql).get(...params).total;

    // 获取分页数据
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const orders = db.prepare(sql).all(...params);

    res.json({
      success: true,
      data: {
        list: orders,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取订单失败' });
  }
});

// 删除订单（仅限非已支付订单）
router.delete('/orders/:id', (req, res) => {
  try {
    const { id } = req.params;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }

    if (order.status === 'paid') {
      return res.status(400).json({ success: false, message: '已支付订单无法删除' });
    }

    // 释放锁定的兑换码
    db.prepare("UPDATE codes SET status = 'available', order_id = NULL WHERE order_id = ?").run(order.order_id);

    // 恢复库存
    if (order.status === 'pending') {
      db.prepare('UPDATE products SET stock = stock + 1 WHERE id = ?').run(order.product_id);
    }

    // 删除订单
    db.prepare('DELETE FROM orders WHERE id = ?').run(id);

    res.json({ success: true, message: '订单已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除订单失败' });
  }
});

// 获取统计数据
router.get('/stats', (req, res) => {
  try {
    // 商品统计
    const productStats = db.prepare(`
      SELECT id, name, stock, sold,
        (SELECT COUNT(*) FROM codes WHERE product_id = products.id AND status = 'available') as available_codes
      FROM products
    `).all();

    // 订单统计
    const orderStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_amount
      FROM orders
    `).get();

    // 兑换码统计
    const codeStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'locked' THEN 1 ELSE 0 END) as locked,
        SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as used
      FROM codes
    `).get();

    // 用户统计
    const userStats = db.prepare(`SELECT COUNT(*) as total FROM users`).get();

    res.json({
      success: true,
      data: {
        products: productStats,
        orders: orderStats,
        codes: codeStats,
        users: userStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取统计失败' });
  }
});

// ============ 用户管理 ============

// 获取会员列表（已激活的兑换码）
router.get('/members', (req, res) => {
  try {
    const { status, page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    // 使用子查询获取用户名，避免 JOIN 导致重复
    let sql = `SELECT c.*, p.name as product_name,
               (SELECT u.username FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.code = c.code LIMIT 1) as username
               FROM codes c
               LEFT JOIN products p ON c.product_id = p.id
               WHERE c.status IN ('used', 'revoked')`;
    const params = [];

    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }

    // 获取总数
    const countSql = sql.replace(/SELECT c\.\*, p\.name as product_name,\s*\(SELECT[^)]+\) as username/, 'SELECT COUNT(*) as total');
    const total = db.prepare(countSql).get(...params).total;

    // 获取分页数据
    sql += ' ORDER BY c.activated_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const members = db.prepare(sql).all(...params);

    res.json({
      success: true,
      data: {
        list: members,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取会员列表失败' });
  }
});

// 禁用会员
router.post('/members/:id/disable', (req, res) => {
  try {
    const { id } = req.params;

    const code = db.prepare('SELECT c.*, p.name as product_name FROM codes c LEFT JOIN products p ON c.product_id = p.id WHERE c.id = ?').get(id);
    if (!code) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }

    // 切换禁用状态
    const newDisabled = code.disabled ? 0 : 1;
    db.prepare('UPDATE codes SET disabled = ? WHERE id = ?').run(newDisabled, id);

    // 记录历史
    addHistory(newDisabled ? '禁用会员' : '启用会员', {
      code: code.code,
      product_name: code.product_name,
      machine_id: code.machine_id,
      details: newDisabled ? '管理员禁用会员' : '管理员启用会员'
    });

    res.json({ success: true, message: newDisabled ? '已禁用' : '已启用', disabled: newDisabled });
  } catch (error) {
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

// 获取用户列表
router.get('/users', (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    // 获取总数
    const total = db.prepare('SELECT COUNT(*) as total FROM users').get().total;

    // 获取分页数据（关联订单数）
    const users = db.prepare(`
      SELECT u.id, u.username, u.plain_password, u.created_at,
        (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count,
        (SELECT COALESCE(SUM(amount), 0) FROM orders WHERE user_id = u.id AND status = 'paid') as total_spent
      FROM users u
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `).all(parseInt(pageSize), offset);

    res.json({
      success: true,
      data: {
        list: users,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取用户失败' });
  }
});

// 删除用户
router.delete('/users/:id', (req, res) => {
  try {
    const { id } = req.params;

    // 获取用户信息
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 检查用户是否有已支付订单
    const paidOrders = db.prepare(
      "SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND status = 'paid'"
    ).get(id);

    if (paidOrders.count > 0) {
      return res.status(400).json({
        success: false,
        message: '该用户有已支付订单，无法删除'
      });
    }

    // 记录历史
    addHistory('删除用户', {
      username: user.username,
      details: `管理员删除用户，ID: ${id}`
    });

    // 删除用户的待支付订单
    db.prepare("DELETE FROM orders WHERE user_id = ? AND status != 'paid'").run(id);

    // 删除用户
    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    res.json({ success: true, message: '用户删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除用户失败' });
  }
});

// ============ 设备管理（按机器码分组） ============

// 获取设备列表（按机器码分组）
router.get('/devices', (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    // 按机器码分组，获取每个设备的统计信息
    const countSql = `
      SELECT COUNT(DISTINCT machine_id) as total
      FROM codes
      WHERE machine_id IS NOT NULL AND machine_id != ''
    `;
    const total = db.prepare(countSql).get().total;

    // 获取设备列表
    const sql = `
      SELECT
        c.machine_id,
        COUNT(*) as code_count,
        SUM(CASE WHEN c.status = 'used' AND c.disabled = 0 THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN c.disabled = 1 THEN 1 ELSE 0 END) as disabled_count,
        SUM(CASE WHEN c.status = 'revoked' THEN 1 ELSE 0 END) as revoked_count,
        MAX(c.expire_at) as latest_expire,
        MAX(c.activated_at) as latest_activated
      FROM codes c
      WHERE c.machine_id IS NOT NULL AND c.machine_id != ''
      GROUP BY c.machine_id
      ORDER BY latest_activated DESC
      LIMIT ? OFFSET ?
    `;

    const devices = db.prepare(sql).all(parseInt(pageSize), offset);

    // 获取每个设备的兑换码详情
    const result = devices.map(device => {
      const codesSql = `
        SELECT c.code, c.status, c.expire_at, p.name as product_name
        FROM codes c
        LEFT JOIN products p ON c.product_id = p.id
        WHERE c.machine_id = ?
        ORDER BY c.activated_at DESC
      `;
      const codes = db.prepare(codesSql).all(device.machine_id);

      // 计算状态
      const now = new Date();
      let status = 'inactive';
      let remainingText = '-';

      if (device.active_count > 0 && device.latest_expire) {
        const expireDate = new Date(device.latest_expire);
        if (expireDate > now) {
          status = 'active';
          const diffMs = expireDate - now;
          const totalMinutes = Math.floor(diffMs / (1000 * 60));
          const days = Math.floor(totalMinutes / (24 * 60));
          const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
          if (days > 0) {
            remainingText = `${days}天${hours}小时`;
          } else if (hours > 0) {
            remainingText = `${hours}小时`;
          } else {
            remainingText = '不足1小时';
          }
        } else {
          status = 'expired';
          remainingText = '已过期';
        }
      } else if (device.disabled_count > 0) {
        status = 'disabled';
        remainingText = '已禁用';
      } else if (device.revoked_count > 0) {
        status = 'revoked';
        remainingText = '已撤销';
      }

      return {
        machine_id: device.machine_id,
        code_count: device.code_count,
        active_count: device.active_count,
        disabled_count: device.disabled_count,
        revoked_count: device.revoked_count,
        latest_expire: device.latest_expire,
        latest_activated: device.latest_activated,
        status,
        remaining_text: remainingText,
        codes
      };
    });

    res.json({
      success: true,
      data: {
        list: result,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error('获取设备列表失败:', error);
    res.status(500).json({ success: false, message: '获取设备列表失败' });
  }
});

// ============ 历史记录 ============

// 获取历史记录
router.get('/history', (req, res) => {
  try {
    const { action, page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    let sql = 'SELECT * FROM history WHERE 1=1';
    const params = [];

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }

    // 获取总数
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const total = db.prepare(countSql).get(...params).total;

    // 获取分页数据
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const history = db.prepare(sql).all(...params);

    res.json({
      success: true,
      data: {
        list: history,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取历史记录失败' });
  }
});

// ============ API请求日志 ============

// 获取API日志列表
router.get('/api-logs', (req, res) => {
  try {
    const { endpoint, machine_id, page = 1, pageSize = 50 } = req.query;
    const offset = (page - 1) * pageSize;

    let sql = 'SELECT * FROM api_logs WHERE 1=1';
    const params = [];

    if (endpoint) {
      sql += ' AND endpoint = ?';
      params.push(endpoint);
    }

    if (machine_id) {
      sql += ' AND machine_id LIKE ?';
      params.push(`%${machine_id}%`);
    }

    // 获取总数
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const total = db.prepare(countSql).get(...params).total;

    // 获取分页数据
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const logs = db.prepare(sql).all(...params);

    res.json({
      success: true,
      data: {
        list: logs,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error('获取API日志失败:', error);
    res.status(500).json({ success: false, message: '获取API日志失败' });
  }
});

// 删除API日志（支持批量删除和清空）
router.delete('/api-logs', (req, res) => {
  try {
    const { ids, beforeDate } = req.body;

    if (beforeDate) {
      // 删除指定日期之前的日志
      const result = db.prepare('DELETE FROM api_logs WHERE created_at < ?').run(beforeDate);
      return res.json({ success: true, message: `已删除 ${result.changes} 条日志` });
    }

    if (ids && ids.length > 0) {
      // 删除指定ID的日志
      const placeholders = ids.map(() => '?').join(',');
      const result = db.prepare(`DELETE FROM api_logs WHERE id IN (${placeholders})`).run(...ids);
      return res.json({ success: true, message: `已删除 ${result.changes} 条日志` });
    }

    // 清空所有日志
    const result = db.prepare('DELETE FROM api_logs').run();
    res.json({ success: true, message: `已清空 ${result.changes} 条日志` });
  } catch (error) {
    console.error('删除API日志失败:', error);
    res.status(500).json({ success: false, message: '删除API日志失败' });
  }
});

module.exports = router;

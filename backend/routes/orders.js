const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../models/database');

// 创建订单
router.post('/', (req, res) => {
  try {
    const { productId, userId } = req.body;

    // 验证参数
    if (!productId || !userId) {
      return res.status(400).json({ success: false, message: '请先登录后再购买' });
    }

    // 检查用户是否存在
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(400).json({ success: false, message: '用户不存在，请重新登录' });
    }

    // 检查商品是否存在
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: '商品不存在' });
    }

    // 检查是否有可用兑换码
    const availableCode = db.prepare(
      "SELECT * FROM codes WHERE product_id = ? AND status = 'available' LIMIT 1"
    ).get(productId);

    if (!availableCode) {
      return res.status(400).json({ success: false, message: '兑换码暂无库存' });
    }

    // 生成订单号
    const orderId = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();

    // 创建订单（关联用户）
    db.prepare(`
      INSERT INTO orders (order_id, product_id, product_name, amount, user_id, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(orderId, product.id, product.name, product.price, userId);

    // 锁定兑换码
    db.prepare("UPDATE codes SET status = 'locked', order_id = ? WHERE id = ?").run(orderId, availableCode.id);

    // 减少库存
    db.prepare('UPDATE products SET stock = stock - 1 WHERE id = ?').run(productId);

    res.json({
      success: true,
      data: {
        orderId,
        productName: product.name,
        amount: product.price
      }
    });
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ success: false, message: '创建订单失败' });
  }
});

// 查询订单状态
router.get('/:orderId', (req, res) => {
  try {
    const order = db.prepare(`
      SELECT o.*, p.name as product_name
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      WHERE o.order_id = ?
    `).get(req.params.orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }

    res.json({
      success: true,
      data: {
        orderId: order.order_id,
        productName: order.product_name,
        amount: order.amount,
        userId: order.user_id,
        status: order.status,
        code: order.code,
        createdAt: order.created_at,
        paidAt: order.paid_at
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '查询订单失败' });
  }
});

// 取消订单（直接删除）
router.post('/:orderId/cancel', (req, res) => {
  try {
    const { orderId } = req.params;

    // 查询订单
    const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, message: '只能取消待支付的订单' });
    }

    // 释放锁定的兑换码
    db.prepare("UPDATE codes SET status = 'available', order_id = NULL WHERE order_id = ?").run(orderId);

    // 恢复库存
    db.prepare('UPDATE products SET stock = stock + 1 WHERE id = ?').run(order.product_id);

    // 直接删除订单
    db.prepare('DELETE FROM orders WHERE order_id = ?').run(orderId);

    res.json({ success: true, message: '订单已取消' });
  } catch (error) {
    console.error('取消订单失败:', error);
    res.status(500).json({ success: false, message: '取消订单失败' });
  }
});

module.exports = router;

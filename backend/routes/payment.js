const express = require('express');
const router = express.Router();
const { db } = require('../models/database');

// 模拟支付
router.post('/:orderId', (req, res) => {
  try {
    const { orderId } = req.params;

    // 查询订单
    const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, message: '订单状态异常' });
    }

    // 查询锁定的兑换码
    const lockedCode = db.prepare(
      "SELECT * FROM codes WHERE order_id = ? AND status = 'locked' LIMIT 1"
    ).get(orderId);

    if (!lockedCode) {
      return res.status(400).json({ success: false, message: '兑换码锁定失败' });
    }

    // 更新订单状态和兑换码
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE orders SET status = 'paid', code = ?, paid_at = ? WHERE order_id = ?
    `).run(lockedCode.code, now, orderId);

    // 更新兑换码状态
    db.prepare("UPDATE codes SET status = 'used' WHERE id = ?").run(lockedCode.id);

    // 增加销量
    db.prepare('UPDATE products SET sold = sold + 1 WHERE id = ?').run(order.product_id);

    // 获取更新后的订单信息
    const updatedOrder = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);

    res.json({
      success: true,
      data: {
        orderId: updatedOrder.order_id,
        status: 'paid',
        code: updatedOrder.code,
        paidAt: updatedOrder.paid_at
      }
    });
  } catch (error) {
    console.error('支付处理失败:', error);
    res.status(500).json({ success: false, message: '支付处理失败' });
  }
});

module.exports = router;

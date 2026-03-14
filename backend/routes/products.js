const express = require('express');
const router = express.Router();
const { db } = require('../models/database');

// 获取商品列表
router.get('/', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products ORDER BY price ASC').all();
    res.json({
      success: true,
      data: products.map(p => ({
        id: p.id,
        tag: p.tag,
        name: p.name,
        price: p.price,
        stock: p.stock,
        sold: p.sold
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取商品列表失败' });
  }
});

// 获取单个商品
router.get('/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: '商品不存在' });
    }
    res.json({
      success: true,
      data: {
        id: product.id,
        tag: product.tag,
        name: product.name,
        price: product.price,
        stock: product.stock,
        sold: product.sold
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取商品失败' });
  }
});

module.exports = router;

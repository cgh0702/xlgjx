const express = require('express');
const router = express.Router();
const { db, extractDays, extractDuration } = require('../models/database');

// 机器码生成函数（简单版本，基于硬件信息）
const crypto = require('crypto');

// 记录API请求日志的中间件
router.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);

  // 拦截 res.json
  res.json = (data) => {
    // 记录日志（排除 /status 心跳检测）
    if (req.path !== '/status') {
      try {
        const endpoint = req.path;
        const method = req.method;
        const machineId = req.body.machine_id || null;
        const code = req.body.code || null;
        const ip = req.ip || req.connection.remoteAddress || null;
        const userAgent = req.get('User-Agent') || null;
        const requestBody = JSON.stringify(req.body);
        const responseStatus = res.statusCode;
        // 成功时不显示"success"，只显示有意义的消息
        const responseMessage = data?.message || null;

        db.prepare(`
          INSERT INTO api_logs (endpoint, method, machine_id, code, ip, user_agent, request_body, response_status, response_message)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(endpoint, method, machineId, code, ip, userAgent, requestBody, responseStatus, responseMessage);
      } catch (e) {
        console.error('记录API日志失败:', e);
      }
    }

    return originalJson(data);
  };

  next();
});

// 验证兑换码并激活
router.post('/verify', (req, res) => {
  try {
    const { code, machine_id } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: '请输入兑换码' });
    }

    if (!machine_id) {
      return res.status(400).json({ success: false, message: '缺少机器标识' });
    }

    // 查找兑换码（包含商品信息）
    const codeRecord = db.prepare(`
      SELECT c.*, p.name as product_name, p.duration_minutes
      FROM codes c
      LEFT JOIN products p ON c.product_id = p.id
      WHERE c.code = ?
    `).get(code);

    if (!codeRecord) {
      return res.status(400).json({ success: false, message: '兑换码不存在' });
    }

    // 检查状态
    if (codeRecord.status === 'used') {
      // 检查是否被禁用
      if (codeRecord.disabled) {
        return res.status(400).json({ success: false, message: '会员已被禁用' });
      }
      // 如果 machine_id 不为空，检查是否同一台机器
      if (codeRecord.machine_id) {
        if (codeRecord.machine_id === machine_id) {
          // 同一台机器，返回会员信息
          return res.json({
            success: true,
            message: '已激活',
            data: {
              expire_date: codeRecord.expire_at,
              days_left: Math.max(0, Math.ceil((new Date(codeRecord.expire_at) - new Date()) / (1000 * 60 * 60 * 24)))
            }
          });
        } else {
          // 不同机器
          return res.status(400).json({ success: false, message: '兑换码已被其他设备使用' });
        }
      }
      // machine_id 为空，继续执行激活流程（订单发货但未在启动器激活的情况）
    }

    if (codeRecord.status === 'locked') {
      return res.status(400).json({ success: false, message: '兑换码已被锁定' });
    }

    if (codeRecord.status === 'revoked') {
      return res.status(400).json({ success: false, message: '兑换码已被撤销，无法使用' });
    }

    // 计算时长（分钟）和到期时间
    const durationMinutes = extractDuration(codeRecord);
    const now = new Date();

    // 查询该机器当前最晚的到期时间（只计算有效且未过期未禁用的）
    const existingLicense = db.prepare(`
      SELECT MAX(expire_at) as latest_expire
      FROM codes
      WHERE machine_id = ? AND status = 'used' AND disabled = 0 AND expire_at > ?
    `).get(machine_id, now.toISOString());

    // 如果有有效的会员，从到期时间开始累加；否则从当前时间开始
    let baseTime = now;
    if (existingLicense && existingLicense.latest_expire) {
      baseTime = new Date(existingLicense.latest_expire);
    }

    const expireAt = new Date(baseTime.getTime() + durationMinutes * 60 * 1000);

    // 激活兑换码
    db.prepare(`
      UPDATE codes
      SET status = 'used',
          machine_id = ?,
          activated_at = ?,
          expire_at = ?,
          disabled = 0
      WHERE code = ?
    `).run(machine_id, now.toISOString(), expireAt.toISOString(), code);

    // 格式化时长显示
    let durationText = '';
    if (durationMinutes >= 24 * 60) {
      const days = Math.floor(durationMinutes / (24 * 60));
      durationText = `${days}天`;
    } else if (durationMinutes >= 60) {
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      durationText = mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
    } else {
      durationText = `${durationMinutes}分钟`;
    }

    // 记录历史
    try {
      db.prepare(`
        INSERT INTO history (action, code, product_name, machine_id, details)
        VALUES (?, ?, ?, ?, ?)
      `).run('激活会员', code, codeRecord.product_name, machine_id, `激活${durationText}，到期时间: ${expireAt.toISOString().split('T')[0]}`);
    } catch (e) {
      console.error('记录历史失败:', e);
    }

    res.json({
      success: true,
      message: '激活成功',
      data: {
        product_name: codeRecord.product_name,
        days: durationMinutes / (24 * 60), // 兼容旧接口
        duration_minutes: durationMinutes,
        duration_text: durationText,
        expire_date: expireAt.toISOString().split('T')[0],
        activated_at: now.toISOString()
      }
    });

  } catch (error) {
    console.error('验证失败:', error);
    res.status(500).json({ success: false, message: '验证失败' });
  }
});

// 查询会员状态
router.post('/status', (req, res) => {
  try {
    const { machine_id } = req.body;

    if (!machine_id) {
      return res.status(400).json({ success: false, message: '缺少机器标识' });
    }

    // 查找该机器所有有效的激活记录（status='used' 且未禁用）
    const validCodes = db.prepare(`
      SELECT c.*, p.name as product_name
      FROM codes c
      LEFT JOIN products p ON c.product_id = p.id
      WHERE c.machine_id = ? AND c.status = 'used' AND c.disabled = 0
      ORDER BY c.expire_at DESC
    `).all(machine_id);

    // 检查是否有被禁用的兑换码（用于提示）
    const disabledCodes = db.prepare(`
      SELECT COUNT(*) as count
      FROM codes
      WHERE machine_id = ? AND status = 'used' AND disabled = 1
    `).get(machine_id);

    if (validCodes.length === 0) {
      // 没有任何有效兑换码
      return res.json({
        success: true,
        data: {
          activated: false,
          disabled: disabledCodes.count > 0,
          message: disabledCodes.count > 0 ? '会员已被禁用' : '未激活'
        }
      });
    }

    // 取最晚的到期时间
    const latestCode = validCodes[0];
    const now = new Date();

    // 检查 expire_at 是否有效
    if (!latestCode.expire_at) {
      return res.json({
        success: true,
        data: {
          activated: false,
          message: '会员数据异常，请联系客服'
        }
      });
    }

    const expireDate = new Date(latestCode.expire_at);
    const diffMs = Math.max(0, expireDate - now);
    const isExpired = expireDate < now;

    // 计算剩余时间（精确到分钟）
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const daysLeft = Math.floor(totalMinutes / (24 * 60));
    const hoursLeft = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutesLeft = totalMinutes % 60;

    // 格式化剩余时间文本
    let timeLeftText = '';
    if (daysLeft > 0) {
      timeLeftText = `${daysLeft}天${hoursLeft}小时`;
    } else if (hoursLeft > 0) {
      timeLeftText = `${hoursLeft}小时${minutesLeft}分钟`;
    } else {
      timeLeftText = `${minutesLeft}分钟`;
    }

    res.json({
      success: true,
      data: {
        activated: !isExpired,
        disabled: false,
        product_name: latestCode.product_name,
        expire_date: latestCode.expire_at,
        days_left: daysLeft,
        hours_left: hoursLeft,
        minutes_left: minutesLeft,
        time_left_text: timeLeftText,
        is_expired: isExpired,
        activated_at: latestCode.activated_at,
        active_codes_count: validCodes.length
      }
    });

  } catch (error) {
    console.error('查询状态失败:', error);
    res.status(500).json({ success: false, message: '查询状态失败' });
  }
});

// 检查兑换码是否有效（不激活，仅检查）
router.post('/check', (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: '请输入兑换码' });
    }

    const codeRecord = db.prepare(`
      SELECT c.*, p.name as product_name, p.duration_minutes
      FROM codes c
      LEFT JOIN products p ON c.product_id = p.id
      WHERE c.code = ?
    `).get(code);

    if (!codeRecord) {
      return res.status(400).json({ success: false, message: '兑换码不存在' });
    }

    if (codeRecord.status !== 'available') {
      return res.status(400).json({ success: false, message: '兑换码已被使用' });
    }

    const durationMinutes = extractDuration(codeRecord);

    // 格式化时长显示
    let durationText = '';
    if (durationMinutes >= 24 * 60) {
      const days = Math.floor(durationMinutes / (24 * 60));
      durationText = `${days}天`;
    } else if (durationMinutes >= 60) {
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      durationText = mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
    } else {
      durationText = `${durationMinutes}分钟`;
    }

    res.json({
      success: true,
      data: {
        product_name: codeRecord.product_name,
        days: durationMinutes / (24 * 60), // 兼容旧接口
        duration_minutes: durationMinutes,
        duration_text: durationText
      }
    });

  } catch (error) {
    console.error('检查失败:', error);
    res.status(500).json({ success: false, message: '检查失败' });
  }
});

module.exports = router;

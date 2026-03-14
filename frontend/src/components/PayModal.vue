<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    title="支付订单"
    width="400px"
    :close-on-click-modal="false"
    :show-close="false"
  >
    <div class="pay-content">
      <!-- 订单信息 -->
      <div class="order-info">
        <div class="info-row">
          <span class="label">商品</span>
          <span class="value">{{ order?.productName }}</span>
        </div>
        <div class="info-row">
          <span class="label">金额</span>
          <span class="amount">¥{{ order?.amount?.toFixed(2) }}</span>
        </div>
      </div>

      <!-- 模拟支付 -->
      <div class="pay-methods">
        <div class="method-title">选择支付方式</div>
        <div class="methods-list">
          <div class="method-item" :class="{ active: payMethod === 'wechat' }" @click="payMethod = 'wechat'">
            <span class="icon">💚</span>
            <span>微信支付</span>
          </div>
          <div class="method-item" :class="{ active: payMethod === 'alipay' }" @click="payMethod = 'alipay'">
            <span class="icon">💙</span>
            <span>支付宝</span>
          </div>
        </div>
      </div>

      <!-- 倒计时 -->
      <div class="countdown" v-if="countdown > 0">
        支付剩余时间：{{ formatTime(countdown) }}
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">取消支付</el-button>
        <el-button type="primary" @click="handlePay" :loading="loading">
          确认支付（模拟）
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { mockPay, getOrder, cancelOrder } from '../api'
import { ElMessage } from 'element-plus'

const props = defineProps({
  visible: Boolean,
  order: Object
})

const emit = defineEmits(['update:visible', 'success', 'cancel'])

const payMethod = ref('wechat')
const loading = ref(false)
const countdown = ref(900) // 15分钟
let timer = null

// 格式化时间
const formatTime = (seconds) => {
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

// 开始倒计时
watch(() => props.visible, (val) => {
  if (val) {
    countdown.value = 900
    timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(timer)
        ElMessage.warning('支付超时，订单已取消')
        handleCancel()
      }
    }, 1000)
  } else {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})

// 取消支付
const handleCancel = async () => {
  try {
    // 调用取消订单API
    await cancelOrder(props.order.orderId)
  } catch (error) {
    console.error('取消订单失败:', error)
  }
  emit('update:visible', false)
  emit('cancel')
}

// 模拟支付
const handlePay = async () => {
  loading.value = true
  try {
    // 模拟支付延迟
    await new Promise(resolve => setTimeout(resolve, 1000))

    const { data } = await mockPay(props.order.orderId)
    if (data.success) {
      // 获取完整订单信息
      const { data: orderData } = await getOrder(props.order.orderId)
      ElMessage.success('支付成功！')
      emit('success', orderData.data)
    } else {
      ElMessage.error(data.message || '支付失败')
    }
  } catch (error) {
    ElMessage.error('支付失败，请重试')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.pay-content {
  padding: 10px 0;
}

.order-info {
  background: #F7F8FA;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.label {
  color: #86909C;
  font-size: 14px;
}

.value {
  color: #1D2129;
  font-size: 14px;
}

.amount {
  font-size: 18px;
  font-weight: 700;
  color: #F53F3F;
}

.pay-methods {
  margin-bottom: 20px;
}

.method-title {
  font-size: 14px;
  color: #1D2129;
  margin-bottom: 12px;
}

.methods-list {
  display: flex;
  gap: 12px;
}

.method-item {
  flex: 1;
  padding: 12px;
  border: 2px solid #E5E6EB;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: border-color 0.2s;
}

.method-item:hover {
  border-color: #1677FF;
}

.method-item.active {
  border-color: #1677FF;
  background: #F0F5FF;
}

.icon {
  font-size: 20px;
}

.countdown {
  text-align: center;
  font-size: 14px;
  color: #FF7D00;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>

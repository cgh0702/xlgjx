<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    title="我的订单"
    width="600px"
  >
    <div class="orders-list" v-loading="loading">
      <div v-if="orders.length === 0" class="empty">
        暂无订单
      </div>
      <div v-else class="order-item" v-for="order in orders" :key="order.id">
        <div class="order-header">
          <span class="order-id">订单号: {{ order.order_id }}</span>
          <el-tag :type="statusType(order.status)" size="small">{{ statusText(order.status) }}</el-tag>
        </div>
        <div class="order-body">
          <div class="product-name">{{ order.product_name }}</div>
          <div class="order-info">
            <span>金额: ¥{{ order.amount?.toFixed(2) }}</span>
            <span>{{ order.created_at }}</span>
          </div>
          <div v-if="order.code" class="code-box">
            <span>兑换码: </span>
            <span class="code">{{ order.code }}</span>
            <el-button type="primary" size="small" @click="copyCode(order.code)">复制</el-button>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

const props = defineProps({
  visible: Boolean,
  userId: [Number, null]
})

const emit = defineEmits(['update:visible'])

const orders = ref([])
const loading = ref(false)

// 加载订单
const loadOrders = async () => {
  if (!props.userId) return
  loading.value = true
  try {
    const { data } = await api.get(`/users/${props.userId}/orders`)
    if (data.success) {
      orders.value = data.data
    }
  } finally {
    loading.value = false
  }
}

// 监听弹窗打开
watch(() => props.visible, (val) => {
  if (val && props.userId) {
    loadOrders()
  }
})

// 状态文本
const statusText = (status) => {
  const map = { pending: '待支付', paid: '已支付', expired: '已过期' }
  return map[status] || status
}

const statusType = (status) => {
  const map = { pending: 'warning', paid: 'success', expired: 'info' }
  return map[status] || ''
}

// 复制兑换码
const copyCode = async (code) => {
  try {
    await navigator.clipboard.writeText(code)
    ElMessage.success('兑换码已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}
</script>

<style scoped>
.orders-list {
  max-height: 400px;
  overflow-y: auto;
}

.empty {
  text-align: center;
  color: #86909C;
  padding: 40px;
}

.order-item {
  border: 1px solid #E5E6EB;
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
}

.order-header {
  background: #F7F8FA;
  padding: 10px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.order-id {
  font-size: 12px;
  color: #86909C;
}

.order-body {
  padding: 14px;
}

.product-name {
  font-weight: 600;
  margin-bottom: 8px;
}

.order-info {
  font-size: 13px;
  color: #86909C;
  display: flex;
  gap: 16px;
}

.code-box {
  margin-top: 12px;
  padding: 10px;
  background: #F0F5FF;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.code {
  font-family: monospace;
  font-weight: 600;
  color: #1677FF;
}
</style>

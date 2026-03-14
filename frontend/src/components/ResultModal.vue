<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    title="支付成功"
    width="400px"
    :close-on-click-modal="false"
  >
    <div class="result-content">
      <!-- 成功图标 -->
      <div class="success-icon">
        <el-icon :size="48" color="#00B42A"><SuccessFilled /></el-icon>
      </div>

      <div class="success-text">支付成功！</div>

      <!-- 兑换码 -->
      <div class="code-box">
        <div class="code-label">您的兑换码</div>
        <div class="code-value">{{ order?.code }}</div>
        <el-button type="primary" @click="copyCode" class="copy-btn">
          {{ copied ? '已复制' : '一键复制' }}
        </el-button>
      </div>

      <!-- 提示 -->
      <div class="tips">
        <p>请妥善保存您的兑换码</p>
        <p>您可以在「我的订单」中查看所有购买记录</p>
      </div>
    </div>

    <template #footer>
      <el-button type="primary" @click="$emit('update:visible', false)" class="done-btn">
        完成
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { SuccessFilled } from '@element-plus/icons-vue'

const props = defineProps({
  visible: Boolean,
  order: Object
})

const emit = defineEmits(['update:visible'])

const copied = ref(false)

// 复制兑换码
const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(props.order?.code || '')
    copied.value = true
    ElMessage.success('兑换码已复制到剪贴板')
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (error) {
    ElMessage.error('复制失败，请手动复制')
  }
}
</script>

<style scoped>
.result-content {
  text-align: center;
  padding: 20px 0;
}

.success-icon {
  margin-bottom: 16px;
}

.success-text {
  font-size: 20px;
  font-weight: 600;
  color: #1D2129;
  margin-bottom: 24px;
}

.code-box {
  background: #F0F5FF;
  border: 2px dashed #1677FF;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.code-label {
  font-size: 14px;
  color: #86909C;
  margin-bottom: 12px;
}

.code-value {
  font-size: 24px;
  font-weight: 700;
  color: #1677FF;
  letter-spacing: 2px;
  margin-bottom: 16px;
  font-family: 'Courier New', monospace;
}

.copy-btn {
  width: 100%;
}

.tips {
  font-size: 13px;
  color: #86909C;
  line-height: 1.8;
}

.done-btn {
  width: 100%;
}
</style>

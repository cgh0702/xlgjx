<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    :title="isLogin ? '登录' : '注册'"
    width="380px"
    :close-on-click-modal="false"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
      <el-form-item prop="username">
        <el-input
          v-model="form.username"
          placeholder="用户名"
          prefix-icon="User"
          size="large"
        />
      </el-form-item>
      <el-form-item prop="password">
        <el-input
          v-model="form.password"
          type="password"
          placeholder="密码"
          prefix-icon="Lock"
          size="large"
          show-password
        />
      </el-form-item>
    </el-form>

    <div class="switch-mode">
      <span @click="isLogin = !isLogin">
        {{ isLogin ? '没有账号？去注册' : '已有账号？去登录' }}
      </span>
    </div>

    <template #footer>
      <el-button type="primary" @click="handleSubmit" :loading="loading" size="large" style="width: 100%">
        {{ isLogin ? '登录' : '注册' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['update:visible', 'success'])

const formRef = ref(null)
const loading = ref(false)
const isLogin = ref(true)

const form = reactive({
  username: '',
  password: ''
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名需要3-20个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6个字符', trigger: 'blur' }
  ]
}

// 重置表单
watch(() => props.visible, (val) => {
  if (!val) {
    form.username = ''
    form.password = ''
    isLogin.value = true  // 重置为登录模式
    formRef.value?.resetFields()
  }
})

// 提交
const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    loading.value = true

    const url = isLogin.value ? '/users/login' : '/users/register'
    const { data } = await api.post(url, form)

    if (data.success) {
      ElMessage.success(data.message)
      emit('success', data.data)
      emit('update:visible', false)
    } else {
      ElMessage.error(data.message)
    }
  } catch (error) {
    if (error.response?.data?.message) {
      ElMessage.error(error.response.data.message)
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.switch-mode {
  text-align: center;
  margin-top: 16px;
}

.switch-mode span {
  color: #1677FF;
  cursor: pointer;
  font-size: 14px;
}

.switch-mode span:hover {
  text-decoration: underline;
}
</style>

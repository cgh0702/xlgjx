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
      <!-- 验证码（仅注册时显示） -->
      <el-form-item v-if="!isLogin" prop="captchaCode">
        <div class="captcha-row">
          <el-input
            v-model="form.captchaCode"
            placeholder="验证码"
            prefix-icon="Key"
            size="large"
            style="flex: 1"
          />
          <div
            class="captcha-img"
            v-html="captchaSvg"
            @click="fetchCaptcha"
            title="点击刷新验证码"
          ></div>
        </div>
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
const captchaSvg = ref('')
const captchaId = ref('')

const form = reactive({
  username: '',
  password: '',
  captchaCode: ''
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名需要3-20个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6个字符', trigger: 'blur' }
  ],
  captchaCode: [
    { required: true, message: '请输入验证码', trigger: 'blur' }
  ]
}

// 获取验证码
const fetchCaptcha = async () => {
  try {
    const { data } = await api.get('/users/captcha')
    if (data.success) {
      captchaSvg.value = data.data.captchaSvg
      captchaId.value = data.data.captchaId
      form.captchaCode = ''
    }
  } catch (error) {
    console.error('获取验证码失败:', error)
  }
}

// 重置表单
watch(() => props.visible, (val) => {
  if (!val) {
    form.username = ''
    form.password = ''
    form.captchaCode = ''
    isLogin.value = true  // 重置为登录模式
    captchaSvg.value = ''
    captchaId.value = ''
    formRef.value?.resetFields()
  }
})

// 切换到注册模式时获取验证码
watch(isLogin, (val) => {
  if (!val) {
    fetchCaptcha()
  }
})

// 提交
const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    loading.value = true

    const url = isLogin.value ? '/users/login' : '/users/register'
    const payload = isLogin.value
      ? { username: form.username, password: form.password }
      : { username: form.username, password: form.password, captchaId: captchaId.value, captchaCode: form.captchaCode }

    const { data } = await api.post(url, payload)

    if (data.success) {
      ElMessage.success(data.message)
      emit('success', data.data)
      emit('update:visible', false)
    } else {
      ElMessage.error(data.message)
      if (!isLogin.value) fetchCaptcha()
    }
  } catch (error) {
    if (error.response?.data?.message) {
      ElMessage.error(error.response.data.message)
      if (!isLogin.value) fetchCaptcha()
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

.captcha-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.captcha-img {
  width: 120px;
  height: 40px;
  cursor: pointer;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.captcha-img:hover {
  border-color: #1677FF;
}

.captcha-img :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>

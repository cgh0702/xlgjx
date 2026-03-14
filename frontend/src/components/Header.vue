<template>
  <header class="header">
    <div class="container">
      <div class="logo">
        <span class="logo-icon">🎁</span>
        <span class="logo-text">字字插件效率工具</span>
      </div>
      <div class="header-right">
        <span class="auto-badge">⚡ 自动发货</span>

        <!-- 未登录状态 -->
        <template v-if="!user">
          <a href="#" class="service-link" @click.prevent="$emit('login')">登录/注册</a>
        </template>

        <!-- 已登录状态 -->
        <template v-else>
          <a href="#" class="service-link" @click.prevent="$emit('myOrders')">我的订单</a>
          <span class="username">{{ user.username }}</span>
          <a href="#" class="service-link logout" @click.prevent="$emit('logout')">退出</a>
        </template>

        <!-- 只有管理员才显示后台管理按钮 -->
        <a v-if="user?.isAdmin" href="?admin" class="service-link">后台管理</a>
      </div>
    </div>
  </header>
</template>

<script setup>
defineProps({
  user: Object
})

defineEmits(['login', 'logout', 'myOrders'])
</script>

<style scoped>
.header {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  position: sticky;
  top: 0;
  z-index: 100;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  font-size: 24px;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: #1D2129;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.auto-badge {
  background: linear-gradient(135deg, #1677FF 0%, #40a9ff 100%);
  color: #fff;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.service-link {
  color: #1677FF;
  text-decoration: none;
  font-size: 14px;
}

.service-link:hover {
  text-decoration: underline;
}

.username {
  color: #1D2129;
  font-size: 14px;
  font-weight: 500;
}

.logout {
  color: #86909C;
}
</style>

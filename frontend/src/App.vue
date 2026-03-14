<template>
  <div class="app">
    <Home v-if="!isAdmin" />
    <Admin v-else />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Home from './views/Home.vue'
import Admin from './views/Admin.vue'

// 简单路由：访问 /admin.html 或带 ?admin 参数时显示后台
const isAdmin = computed(() => {
  return window.location.pathname.includes('admin') || window.location.search.includes('admin')
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background-color: #F2F3F5;
  color: #1D2129;
  line-height: 1.5;
}

.app {
  min-height: 100vh;
}
</style>

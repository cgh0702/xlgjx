<template>
  <div class="home">
    <!-- 页面头部 -->
    <Header :user="user" @login="showAuthModal = true" @logout="handleLogout" @myOrders="showMyOrders = true" />

    <!-- 商品展示区 -->
    <main class="main">
      <div class="container">
        <h2 class="section-title">商品列表</h2>
        <div class="products-grid">
          <ProductCard
            v-for="product in products"
            :key="product.id"
            :product="product"
            @buy="handleBuy"
          />
        </div>
      </div>
    </main>

    <!-- 购买须知 -->
    <section class="notice">
      <div class="container">
        <h2 class="section-title">购买须知</h2><p>本站为第三方服务，非官方平台。<br>虚拟商品一经售出，不支持退款</p><br>
        <div class="notice-content">
          <div class="notice-item">
            <h3>如何使用兑换码？</h3>
            <ol>
              <li>复制您收到的兑换码</li>
              <li>打开api启动器</li>
              <li>在“会员服务”填入兑换码</li>
              <li>点击“兑换”</li>
            </ol>
          </div>
          <div class="notice-item">
            <h3>常见问题</h3>
            <ul>
              <li><strong>Q: 兑换码有效期多久？</strong><br>A: 兑换码永久有效，激活后开始计时</li>
              <li><strong>Q: 可以退款吗？</strong><br>A: 虚拟商品一经售出，不支持退款</li>
              <li><strong>Q: 购买后多久能收到？</strong><br>A: 支付成功后立即自动发放到您的订单</li>
            </ul>
          </div>
          <div class="notice-item">
            <h3>联系客服</h3>
            <p>如遇问题请联系客服：<br>QQ：527055995<br>QQ群：341770096</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 页面底部 -->
    <footer class="footer">
      <div class="container">
        <p>© 2024 字字插件兑换码自动发货平台 版权所有</p>
        <p class="disclaimer">本站为第三方服务，非官方平台。如有疑问请联系客服。</p>
      </div>
    </footer>

    <!-- 弹窗组件 -->
    <AuthModal
      v-model:visible="showAuthModal"
      @success="handleAuthSuccess"
    />

    <PayModal
      v-model:visible="showPayModal"
      :order="currentOrder"
      @success="handlePaySuccess"
      @cancel="handlePayCancel"
    />

    <ResultModal
      v-model:visible="showResultModal"
      :order="paidOrder"
    />

    <MyOrders
      v-model:visible="showMyOrders"
      :userId="user?.id"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import Header from '../components/Header.vue'
import ProductCard from '../components/ProductCard.vue'
import AuthModal from '../components/AuthModal.vue'
import PayModal from '../components/PayModal.vue'
import ResultModal from '../components/ResultModal.vue'
import MyOrders from '../components/MyOrders.vue'
import { getProducts, createOrder } from '../api'

// 用户状态（从localStorage恢复）
const user = ref(null)
const savedUser = localStorage.getItem('user')
if (savedUser) {
  try {
    user.value = JSON.parse(savedUser)
  } catch (e) {}
}

// 商品列表
const products = ref([])

// 当前订单
const currentOrder = ref(null)

// 已支付订单
const paidOrder = ref(null)

// 弹窗状态
const showAuthModal = ref(false)
const showPayModal = ref(false)
const showResultModal = ref(false)
const showMyOrders = ref(false)

// 选中的商品
const selectedProduct = ref(null)

// 加载商品列表
onMounted(async () => {
  try {
    const { data } = await getProducts()
    if (data.success) {
      products.value = data.data
    }
  } catch (error) {
    ElMessage.error('加载商品失败，请刷新重试')
  }
})

// 点击购买
const handleBuy = (product) => {
  // 检查是否登录
  if (!user.value) {
    ElMessage.warning('请先登录后再购买')
    showAuthModal.value = true
    selectedProduct.value = product
    return
  }

  selectedProduct.value = product
  createOrderAndPay()
}

// 创建订单并支付
const createOrderAndPay = async () => {
  try {
    const { data } = await createOrder({
      productId: selectedProduct.value.id,
      userId: user.value.id
    })
    if (data.success) {
      currentOrder.value = {
        orderId: data.data.orderId,
        productName: data.data.productName,
        amount: data.data.amount
      }
      showPayModal.value = true
    } else {
      ElMessage.error(data.message || '创建订单失败')
    }
  } catch (error) {
    ElMessage.error('创建订单失败，请重试')
  }
}

// 登录成功后继续购买
const handleAuthSuccess = (userData) => {
  user.value = userData
  localStorage.setItem('user', JSON.stringify(userData))

  // 如果有待购买的商品，继续购买流程
  if (selectedProduct.value) {
    createOrderAndPay()
  }
}

// 退出登录
const handleLogout = () => {
  user.value = null
  localStorage.removeItem('user')
  ElMessage.success('已退出登录')
}

// 支付成功
const handlePaySuccess = (order) => {
  paidOrder.value = order
  showPayModal.value = false
  showResultModal.value = true

  // 刷新商品列表
  loadProducts()
}

// 取消支付
const handlePayCancel = () => {
  showPayModal.value = false
  selectedProduct.value = null
  ElMessage.info('订单已取消，您可以重新下单')
}

// 加载商品列表
const loadProducts = async () => {
  try {
    const { data } = await getProducts()
    if (data.success) {
      products.value = data.data
    }
  } catch (error) {
    console.error('刷新商品列表失败')
  }
}
</script>

<style scoped>
.home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main {
  flex: 1;
  padding: 24px 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #1D2129;
  margin-bottom: 20px;
  padding-left: 12px;
  border-left: 4px solid #1677FF;
}

/* 商品网格布局 */
.products-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 1024px) {
  .products-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .products-grid {
    grid-template-columns: 1fr;
  }
}

/* 购买须知 */
.notice {
  background: #fff;
  padding: 32px 0;
  margin-top: 24px;
}

.notice-content {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

@media (max-width: 768px) {
  .notice-content {
    grid-template-columns: 1fr;
  }
}

.notice-item {
  background: #F7F8FA;
  padding: 20px;
  border-radius: 8px;
}

.notice-item h3 {
  font-size: 16px;
  color: #1D2129;
  margin-bottom: 12px;
}

.notice-item ol,
.notice-item ul {
  padding-left: 20px;
  color: #4E5969;
  font-size: 14px;
}

.notice-item li {
  margin-bottom: 8px;
}

.notice-item p {
  color: #4E5969;
  font-size: 14px;
}

/* 页脚 */
.footer {
  background: #1D2129;
  color: #86909C;
  padding: 24px 0;
  text-align: center;
}

.footer p {
  font-size: 14px;
  margin-bottom: 8px;
}

.footer .disclaimer {
  font-size: 12px;
  color: #4E5969;
}
</style>

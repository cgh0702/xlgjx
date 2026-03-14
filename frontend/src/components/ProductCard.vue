<template>
  <div class="product-card">
    <div class="tag">{{ product.tag }}</div>
    <h3 class="name">{{ product.name }}</h3>
    <div class="price">¥{{ product.price.toFixed(2) }}</div>
    <div class="info">
      <span class="sold">已售：{{ product.sold }}</span>
    </div>
    <button class="buy-btn" @click="handleBuy">
      立即购买
    </button>
  </div>
</template>

<script setup>
const props = defineProps({
  product: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['buy'])

const handleBuy = () => {
  emit('buy', props.product)
}
</script>

<style scoped>
.product-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative;
  overflow: hidden;
}

.product-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.tag {
  position: absolute;
  top: 12px;
  left: 12px;
  background: linear-gradient(135deg, #1677FF 0%, #40a9ff 100%);
  color: #fff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.name {
  font-size: 15px;
  font-weight: 600;
  color: #1D2129;
  margin: 28px 0 12px;
  line-height: 1.4;
  min-height: 42px;
}

.price {
  font-size: 24px;
  font-weight: 700;
  color: #F53F3F;
  margin-bottom: 12px;
}

.info {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #86909C;
  margin-bottom: 16px;
}

.buy-btn {
  width: 100%;
  height: 44px;
  background: linear-gradient(135deg, #1677FF 0%, #40a9ff 100%);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.buy-btn:hover {
  opacity: 0.9;
}
</style>

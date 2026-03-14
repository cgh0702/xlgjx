import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// 获取商品列表
export const getProducts = () => api.get('/products')

// 创建订单
export const createOrder = (data) => api.post('/orders', data)

// 查询订单状态
export const getOrder = (orderId) => api.get(`/orders/${orderId}`)

// 取消订单
export const cancelOrder = (orderId) => api.post(`/orders/${orderId}/cancel`)

// 模拟支付
export const mockPay = (orderId) => api.post(`/pay/${orderId}`)

export default api

<template>
  <div class="admin">
    <!-- 头部 -->
    <header class="admin-header">
      <div class="header-content">
        <h1>📦 后台管理系统</h1>
        <a href="/" class="back-link">返回前台</a>
      </div>
    </header>

    <!-- 统计卡片 -->
    <div class="stats-container">
      <div class="stat-card">
        <div class="stat-value">{{ stats.orders?.total || 0 }}</div>
        <div class="stat-label">总订单</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.orders?.paid || 0 }}</div>
        <div class="stat-label">已完成</div>
      </div>
      <div class="stat-card highlight">
        <div class="stat-value">¥{{ (stats.orders?.total_amount || 0).toFixed(2) }}</div>
        <div class="stat-label">总收入</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.users?.total || 0 }}</div>
        <div class="stat-label">注册用户</div>
      </div>
    </div>

    <!-- 标签页 -->
    <el-tabs v-model="activeTab" class="admin-tabs">
      <!-- 商品管理 -->
      <el-tab-pane label="商品管理" name="products">
        <div class="section-header">
          <h3>商品列表</h3>
          <el-button type="primary" @click="showAddProduct = true">添加商品</el-button>
        </div>
        <el-table :data="products" stripe>
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="name" label="商品名称" min-width="200" />
          <el-table-column label="时长" width="120">
            <template #default="{ row }">
              {{ formatDuration(row.duration_minutes) }}
            </template>
          </el-table-column>
          <el-table-column prop="price" label="价格" width="100">
            <template #default="{ row }">
              ¥{{ row.price?.toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column prop="stock" label="库存" width="80" />
          <el-table-column prop="sold" label="已售" width="80" />
          <el-table-column label="可用兑换码" width="100">
            <template #default="{ row }">
              {{ row.available_codes || 0 }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="editProduct(row)">编辑</el-button>
              <el-button type="danger" size="small" @click="deleteProduct(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 兑换码管理 -->
      <el-tab-pane label="兑换码管理" name="codes">
        <!-- 添加兑换码 -->
        <div class="section-header">
          <h3>添加兑换码</h3>
        </div>
        <el-form :inline="true" class="add-code-form">
          <el-form-item label="选择商品">
            <el-select v-model="addCodeForm.productId" placeholder="选择商品" style="width: 200px">
              <el-option
                v-for="p in products"
                :key="p.id"
                :label="p.name"
                :value="p.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="生成数量">
            <el-input-number v-model="addCodeForm.count" :min="1" :max="100" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="addCodes" :loading="addingCodes">
              批量生成
            </el-button>
          </el-form-item>
        </el-form>

        <!-- 兑换码列表 -->
        <div class="section-header">
          <h3>兑换码列表（仅显示可用）</h3>
          <div>
            <el-select v-model="codeFilter.productId" placeholder="全部商品" clearable style="width: 150px" @change="loadCodes">
              <el-option v-for="p in products" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
            <el-checkbox v-model="showAllCodes" style="margin-left: 15px" @change="loadCodes">显示已使用/撤销</el-checkbox>
          </div>
        </div>
        <el-table :data="codes" stripe v-loading="loadingCodes">
          <el-table-column prop="code" label="兑换码" width="180" />
          <el-table-column prop="product_name" label="所属商品" min-width="180" />
          <el-table-column prop="created_at" label="创建时间" width="160">
            <template #default="{ row }">
              {{ formatTime(row.created_at) }}
            </template>
          </el-table-column>
          <el-table-column v-if="showAllCodes" prop="status" label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.status === 'available'" type="danger" size="small" @click="deleteCode(row)">删除</el-button>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="codePagination.page"
          :page-size="codePagination.pageSize"
          :total="codePagination.total"
          layout="prev, pager, next"
          @current-change="loadCodes"
          style="margin-top: 16px; justify-content: center"
        />
      </el-tab-pane>

      <!-- 订单管理 -->
      <el-tab-pane label="订单管理" name="orders">
        <div class="section-header">
          <h3>订单列表</h3>
          <el-select v-model="orderFilter.status" placeholder="已支付" clearable style="width: 120px" @change="loadOrders">
            <el-option label="已支付" value="paid" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </div>
        <el-table :data="orders" stripe v-loading="loadingOrders">
          <el-table-column prop="order_id" label="订单号" width="200" />
          <el-table-column prop="product_name" label="商品" min-width="180" />
          <el-table-column prop="amount" label="金额" width="100">
            <template #default="{ row }">
              ¥{{ row.amount?.toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="orderStatusType(row.status)">{{ orderStatusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="code" label="兑换码" width="180">
            <template #default="{ row }">
              {{ row.code || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="创建时间" width="160" />
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.status !== 'paid'" type="danger" size="small" @click="deleteOrder(row)">删除</el-button>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="orderPagination.page"
          :page-size="orderPagination.pageSize"
          :total="orderPagination.total"
          layout="prev, pager, next"
          @current-change="loadOrders"
          style="margin-top: 16px; justify-content: center"
        />
      </el-tab-pane>

      <!-- 用户管理 -->
      <el-tab-pane label="用户管理" name="users">
        <el-table :data="users" stripe v-loading="loadingUsers">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="username" label="用户名" width="150" />
          <el-table-column prop="plain_password" label="密码" width="150">
            <template #default="{ row }">
              <span class="password-cell">{{ row.plain_password || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="order_count" label="订单数" width="80" />
          <el-table-column prop="total_spent" label="消费金额" width="100">
            <template #default="{ row }">
              ¥{{ (row.total_spent || 0).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="注册时间" width="180" />
          <el-table-column label="操作" width="80">
            <template #default="{ row }">
              <el-button type="danger" size="small" @click="deleteUser(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="userPagination.page"
          :page-size="userPagination.pageSize"
          :total="userPagination.total"
          layout="prev, pager, next"
          @current-change="loadUsers"
          style="margin-top: 16px; justify-content: center"
        />
      </el-tab-pane>

      <!-- 会员/设备管理（合并） -->
      <el-tab-pane label="会员管理" name="members">
        <div class="section-header">
          <h3>{{ memberViewMode === 'device' ? '设备列表' : '会员列表' }}</h3>
          <div>
            <el-radio-group v-model="memberViewMode" style="margin-right: 10px">
              <el-radio-button label="device">按设备</el-radio-button>
              <el-radio-button label="code">按兑换码</el-radio-button>
            </el-radio-group>
            <el-select v-if="memberViewMode === 'code'" v-model="memberFilter.status" placeholder="全部状态" clearable style="width: 120px" @change="loadMembers">
              <el-option label="已激活" value="used" />
              <el-option label="已撤销" value="revoked" />
            </el-select>
          </div>
        </div>

        <!-- 按设备视图 -->
        <template v-if="memberViewMode === 'device'">
          <el-table :data="devices" stripe v-loading="loadingDevices" @row-click="expandDevice" row-key="machine_id">
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="deviceStatusType(row.status)">{{ deviceStatusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="剩余时间" width="120">
              <template #default="{ row }">
                <span :class="{ 'text-danger': row.status === 'expired' }">{{ row.remaining_text }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="machine_id" label="机器码" min-width="200" />
            <el-table-column label="兑换码数" width="100">
              <template #default="{ row }">
                <el-tag>{{ row.code_count }} 个</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="latest_activated" label="最近激活" width="160">
              <template #default="{ row }">
                <span v-if="row.latest_activated">{{ formatTime(row.latest_activated) }}</span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="latest_expire" label="到期时间" width="160">
              <template #default="{ row }">
                <span v-if="row.latest_expire">{{ formatTime(row.latest_expire) }}</span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button type="danger" size="small" @click.stop="revokeDevice(row)">全部撤销</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="devicePagination.page"
            :page-size="devicePagination.pageSize"
            :total="devicePagination.total"
            layout="prev, pager, next"
            @current-change="loadDevices"
            style="margin-top: 16px; justify-content: center"
          />
        </template>

        <!-- 按兑换码视图 -->
        <template v-else>
          <el-table :data="members" stripe v-loading="loadingMembers">
            <el-table-column prop="code" label="兑换码" width="180" />
            <el-table-column prop="username" label="账号" width="120">
              <template #default="{ row }">
                <span v-if="row.username">{{ row.username }}</span>
                <span v-else class="text-muted">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="product_name" label="会员类型" min-width="150" />
            <el-table-column prop="machine_id" label="机器码" width="150">
              <template #default="{ row }">
                <span v-if="row.machine_id" class="machine-id">{{ row.machine_id.slice(0, 12) }}...</span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="activated_at" label="激活时间" width="160">
              <template #default="{ row }">
                <span v-if="row.activated_at">{{ formatTime(row.activated_at) }}</span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="expire_at" label="到期时间" width="160">
              <template #default="{ row }">
                <span v-if="row.expire_at">{{ formatTime(row.expire_at) }}</span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="剩余时间" width="140">
              <template #default="{ row }">
                <template v-if="row.status === 'used' && row.expire_at">
                  <span :class="{ 'text-danger': isExpired(row.expire_at) }">
                    {{ getRemainingTime(row.expire_at) }}
                  </span>
                </template>
                <template v-else-if="row.status === 'revoked'">
                  <el-tag type="info">已撤销</el-tag>
                </template>
                <template v-else>-</template>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.disabled" type="danger">已禁用</el-tag>
                <el-tag v-else :type="memberStatusType(row.status, row.expire_at)">
                  {{ memberStatusText(row.status, row.expire_at) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <template v-if="row.status === 'used'">
                  <el-button :type="row.disabled ? 'success' : 'danger'" size="small" @click="toggleDisable(row)">
                    {{ row.disabled ? '启用' : '禁用' }}
                  </el-button>
                  <el-button type="warning" size="small" @click="revokeMember(row)">撤销</el-button>
                  <el-button v-if="row.machine_id" type="danger" size="small" plain @click="revokeAllForMachine(row)">全部撤销</el-button>
                </template>
                <span v-else class="text-muted">-</span>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="memberPagination.page"
            :page-size="memberPagination.pageSize"
            :total="memberPagination.total"
            layout="prev, pager, next"
            @current-change="loadMembers"
            style="margin-top: 16px; justify-content: center"
          />
        </template>

        <!-- 设备详情弹窗 -->
        <el-dialog v-model="deviceDialogVisible" :title="'设备兑换码详情 - ' + currentDevice?.machine_id" width="700px">
          <el-table :data="currentDevice?.codes" stripe size="small">
            <el-table-column prop="code" label="兑换码" width="180" />
            <el-table-column prop="product_name" label="会员类型" min-width="150" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="codeStatusType(row.status)" size="small">{{ codeStatusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="expire_at" label="到期时间" width="160">
              <template #default="{ row }">
                <span v-if="row.expire_at">{{ formatTime(row.expire_at) }}</span>
                <span v-else>-</span>
              </template>
            </el-table-column>
          </el-table>
        </el-dialog>
      </el-tab-pane>

      <!-- 历史记录 -->
      <el-tab-pane label="历史记录" name="history">
        <div class="section-header">
          <h3>操作记录</h3>
          <el-select v-model="historyFilter.action" placeholder="全部操作" clearable style="width: 150px" @change="loadHistory">
            <el-option label="激活会员" value="激活会员" />
            <el-option label="撤销激活" value="撤销激活" />
            <el-option label="禁用会员" value="禁用会员" />
            <el-option label="启用会员" value="启用会员" />
            <el-option label="删除兑换码" value="删除兑换码" />
            <el-option label="删除用户" value="删除用户" />
          </el-select>
        </div>
        <el-table :data="history" stripe v-loading="loadingHistory">
          <el-table-column prop="action" label="操作类型" width="120">
            <template #default="{ row }">
              <el-tag :type="historyActionType(row.action)">{{ row.action }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="code" label="兑换码" width="180">
            <template #default="{ row }">
              {{ row.code || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="product_name" label="商品" min-width="150">
            <template #default="{ row }">
              {{ row.product_name || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="machine_id" label="机器码" width="150">
            <template #default="{ row }">
              <span v-if="row.machine_id" class="machine-id">{{ row.machine_id.slice(0, 12) }}...</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="username" label="用户" width="120">
            <template #default="{ row }">
              {{ row.username || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="details" label="详情" min-width="200" />
          <el-table-column prop="created_at" label="操作时间" width="170">
            <template #default="{ row }">
              {{ formatTime(row.created_at) }}
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="historyPagination.page"
          :page-size="historyPagination.pageSize"
          :total="historyPagination.total"
          layout="prev, pager, next"
          @current-change="loadHistory"
          style="margin-top: 16px; justify-content: center"
        />
      </el-tab-pane>

      <!-- API请求日志 -->
      <el-tab-pane label="API日志" name="apiLogs">
        <div class="section-header">
          <h3>请求日志</h3>
          <div>
            <el-input v-model="apiLogFilter.machine_id" placeholder="搜索机器码" clearable style="width: 200px; margin-right: 10px" @keyup.enter="loadApiLogs" />
            <el-button type="danger" @click="clearApiLogs">清空日志</el-button>
          </div>
        </div>
        <el-table :data="apiLogs" stripe v-loading="loadingApiLogs" max-height="500">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="endpoint" label="接口" width="100">
            <template #default="{ row }">
              <el-tag size="small">{{ row.endpoint }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="machine_id" label="机器码" width="180">
            <template #default="{ row }">
              <span v-if="row.machine_id" class="machine-id">{{ row.machine_id.slice(0, 16) }}...</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="code" label="兑换码" width="160">
            <template #default="{ row }">
              {{ row.code || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="response_status" label="状态码" width="80">
            <template #default="{ row }">
              <el-tag :type="row.response_status === 200 ? 'success' : 'danger'" size="small">
                {{ row.response_status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="response_message" label="响应消息" min-width="150">
            <template #default="{ row }">
              {{ row.response_message || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="ip" label="IP" width="120">
            <template #default="{ row }">
              {{ row.ip || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="时间" width="170">
            <template #default="{ row }">
              {{ formatTime(row.created_at) }}
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="apiLogPagination.page"
          :page-size="apiLogPagination.pageSize"
          :total="apiLogPagination.total"
          layout="prev, pager, next"
          @current-change="loadApiLogs"
          style="margin-top: 16px; justify-content: center"
        />
      </el-tab-pane>
    </el-tabs>

    <!-- 编辑商品弹窗 -->
    <el-dialog v-model="showEditProduct" title="编辑商品" width="400px">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="商品名称">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="价格">
          <el-input-number v-model="editForm.price" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="库存">
          <el-input-number v-model="editForm.stock" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditProduct = false">取消</el-button>
        <el-button type="primary" @click="saveProduct" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 添加商品对话框 -->
    <el-dialog v-model="showAddProduct" title="添加商品" width="450px">
      <el-form :model="addProductForm" label-width="80px">
        <el-form-item label="商品名称">
          <el-input v-model="addProductForm.name" placeholder="如：测试会员兑换码1分钟" />
        </el-form-item>
        <el-form-item label="价格">
          <el-input-number v-model="addProductForm.price" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="时长类型">
          <el-radio-group v-model="addProductForm.durationType">
            <el-radio label="days">天</el-radio>
            <el-radio label="hours">小时</el-radio>
            <el-radio label="minutes">分钟</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="时长数值">
          <el-input-number v-model="addProductForm.durationValue" :min="1" :max="365" />
          <span style="margin-left: 10px; color: #999">
            {{ addProductForm.durationType === 'days' ? '天' : addProductForm.durationType === 'hours' ? '小时' : '分钟' }}
          </span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddProduct = false">取消</el-button>
        <el-button type="primary" @click="createProduct" :loading="creating">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../api/index.js'

// 当前标签页
const activeTab = ref('products')

// 统计数据
const stats = ref({})

// 商品数据
const products = ref([])

// 兑换码数据
const codes = ref([])
const loadingCodes = ref(false)
const codeFilter = reactive({ productId: null, status: null })
const codePagination = reactive({ page: 1, pageSize: 20, total: 0 })
const showAllCodes = ref(false)

// 订单数据
const orders = ref([])
const loadingOrders = ref(false)
const orderFilter = reactive({ status: 'paid' })
const orderPagination = reactive({ page: 1, pageSize: 20, total: 0 })

// 用户数据
const users = ref([])
const loadingUsers = ref(false)
const userPagination = reactive({ page: 1, pageSize: 20, total: 0 })

// 会员数据
const members = ref([])
const loadingMembers = ref(false)
const memberFilter = reactive({ status: 'used' })
const memberPagination = reactive({ page: 1, pageSize: 20, total: 0 })
const memberViewMode = ref('device') // 'device' 或 'code'

// 设备数据
const devices = ref([])
const loadingDevices = ref(false)
const devicePagination = reactive({ page: 1, pageSize: 20, total: 0 })
const deviceDialogVisible = ref(false)
const currentDevice = ref(null)

// 历史记录数据
const history = ref([])
const loadingHistory = ref(false)
const historyFilter = reactive({ action: null })
const historyPagination = reactive({ page: 1, pageSize: 20, total: 0 })

// API日志数据
const apiLogs = ref([])
const loadingApiLogs = ref(false)
const apiLogFilter = reactive({ machine_id: null })
const apiLogPagination = reactive({ page: 1, pageSize: 50, total: 0 })

// 添加兑换码表单
const addCodeForm = reactive({ productId: null, count: 10 })
const addingCodes = ref(false)

// 编辑商品
const showEditProduct = ref(false)
const editForm = reactive({ id: null, name: '', price: 0, stock: 0 })
const saving = ref(false)

// 添加商品
const showAddProduct = ref(false)
const creating = ref(false)
const addProductForm = reactive({
  name: '',
  price: 0,
  durationType: 'minutes',
  durationValue: 30
})

// 格式化时长显示
const formatDuration = (minutes) => {
  if (!minutes || minutes === 0) {
    // 尝试从商品名提取
    return '-'
  }
  if (minutes >= 24 * 60) {
    const days = Math.floor(minutes / (24 * 60))
    return `${days}天`
  } else if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
  } else {
    return `${minutes}分钟`
  }
}

// 创建商品
const createProduct = async () => {
  if (!addProductForm.name) {
    ElMessage.warning('请输入商品名称')
    return
  }
  if (addProductForm.price <= 0) {
    ElMessage.warning('请输入价格')
    return
  }

  creating.value = true
  try {
    let durationMinutes = 0
    if (addProductForm.durationType === 'days') {
      durationMinutes = addProductForm.durationValue * 24 * 60
    } else if (addProductForm.durationType === 'hours') {
      durationMinutes = addProductForm.durationValue * 60
    } else {
      durationMinutes = addProductForm.durationValue
    }

    const { data } = await api.post('/admin/products', {
      name: addProductForm.name,
      price: addProductForm.price,
      duration_minutes: durationMinutes
    })
    if (data.success) {
      ElMessage.success('商品创建成功')
      showAddProduct.value = false
      // 重置表单
      addProductForm.name = ''
      addProductForm.price = 0
      addProductForm.durationType = 'minutes'
      addProductForm.durationValue = 30
      loadStats()
    }
  } catch (e) {
    ElMessage.error('创建失败')
  } finally {
    creating.value = false
  }
}

// 删除商品
const deleteProduct = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除商品"${row.name}"吗？`, '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const { data } = await api.delete(`/admin/products/${row.id}`)
    if (data.success) {
      ElMessage.success('删除成功')
      loadStats()
    } else {
      ElMessage.warning(data.message)
    }
  } catch (e) {
    if (e !== 'cancel') {
      const message = e.response?.data?.message || '删除失败'
      ElMessage.error(message)
    }
  }
}

// 加载统计数据
const loadStats = async () => {
  const { data } = await api.get('/admin/stats')
  if (data.success) {
    stats.value = data.data
    products.value = data.data.products
  }
}

// 加载兑换码列表
const loadCodes = async () => {
  loadingCodes.value = true
  try {
    const params = { page: codePagination.page, pageSize: codePagination.pageSize }
    if (codeFilter.productId) params.productId = codeFilter.productId
    // 默认只显示可用，勾选后显示全部
    if (!showAllCodes.value) params.status = 'available'

    const { data } = await api.get('/admin/codes', { params })
    if (data.success) {
      codes.value = data.data.list
      codePagination.total = data.data.total
    }
  } finally {
    loadingCodes.value = false
  }
}

// 加载订单列表
const loadOrders = async () => {
  loadingOrders.value = true
  try {
    const params = { page: orderPagination.page, pageSize: orderPagination.pageSize }
    // 默认显示已支付，清空时显示全部（待支付除外）
    params.status = orderFilter.status || 'paid'

    const { data } = await api.get('/admin/orders', { params })
    if (data.success) {
      orders.value = data.data.list
      orderPagination.total = data.data.total
    }
  } finally {
    loadingOrders.value = false
  }
}

// 加载用户列表
const loadUsers = async () => {
  loadingUsers.value = true
  try {
    const params = { page: userPagination.page, pageSize: userPagination.pageSize }
    const { data } = await api.get('/admin/users', { params })
    if (data.success) {
      users.value = data.data.list
      userPagination.total = data.data.total
    }
  } finally {
    loadingUsers.value = false
  }
}

// 加载会员列表
const loadMembers = async () => {
  loadingMembers.value = true
  try {
    const params = { page: memberPagination.page, pageSize: memberPagination.pageSize }
    if (memberFilter.status) params.status = memberFilter.status

    const { data } = await api.get('/admin/members', { params })
    if (data.success) {
      members.value = data.data.list
      memberPagination.total = data.data.total
    }
  } finally {
    loadingMembers.value = false
  }
}

// 加载设备列表
const loadDevices = async () => {
  loadingDevices.value = true
  try {
    const params = { page: devicePagination.page, pageSize: devicePagination.pageSize }
    const { data } = await api.get('/admin/devices', { params })
    if (data.success) {
      devices.value = data.data.list
      devicePagination.total = data.data.total
    }
  } finally {
    loadingDevices.value = false
  }
}

// 展开设备详情
const expandDevice = (row) => {
  currentDevice.value = row
  deviceDialogVisible.value = true
}

// 设备状态
const deviceStatusType = (status) => {
  const map = { active: 'success', expired: 'danger', disabled: 'warning', revoked: 'info', inactive: 'info' }
  return map[status] || 'info'
}
const deviceStatusText = (status) => {
  const map = { active: '有效', expired: '过期', disabled: '禁用', revoked: '撤销', inactive: '无效' }
  return map[status] || status
}

// 兑换码状态
const codeStatusType = (status) => {
  const map = { used: 'success', revoked: 'info' }
  return map[status] || 'info'
}
const codeStatusText = (status) => {
  const map = { used: '已激活', revoked: '已撤销' }
  return map[status] || status
}

// 撤销设备所有会员
const revokeDevice = async (row) => {
  if (!confirm(`确定要撤销该设备的所有会员吗？\n机器码: ${row.machine_id}`)) return
  try {
    const { data } = await api.post(`/admin/codes/revoke-machine/${row.machine_id}`)
    if (data.success) {
      alert(data.message)
      loadDevices()
    } else {
      alert(data.message)
    }
  } catch (e) {
    alert('操作失败')
  }
}

// 加载历史记录
const loadHistory = async () => {
  loadingHistory.value = true
  try {
    const params = { page: historyPagination.page, pageSize: historyPagination.pageSize }
    if (historyFilter.action) params.action = historyFilter.action

    const { data } = await api.get('/admin/history', { params })
    if (data.success) {
      history.value = data.data.list
      historyPagination.total = data.data.total
    }
  } finally {
    loadingHistory.value = false
  }
}

// 加载API日志
const loadApiLogs = async () => {
  loadingApiLogs.value = true
  try {
    const params = { page: apiLogPagination.page, pageSize: apiLogPagination.pageSize }
    if (apiLogFilter.machine_id) params.machine_id = apiLogFilter.machine_id

    const { data } = await api.get('/admin/api-logs', { params })
    if (data.success) {
      apiLogs.value = data.data.list
      apiLogPagination.total = data.data.total
    }
  } finally {
    loadingApiLogs.value = false
  }
}

// 清空API日志
const clearApiLogs = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有API日志吗？此操作不可恢复！', '确认清空', {
      type: 'warning'
    })
    const { data } = await api.delete('/admin/api-logs', { data: {} })
    if (data.success) {
      ElMessage.success(data.message)
      loadApiLogs()
    }
  } catch (e) {
    // 取消操作
  }
}

// 添加兑换码
const addCodes = async () => {
  if (!addCodeForm.productId) {
    return ElMessage.warning('请选择商品')
  }

  addingCodes.value = true
  try {
    const { data } = await api.post('/admin/codes/batch', addCodeForm)
    if (data.success) {
      ElMessage.success(data.message)
      loadStats()
      loadCodes()
    }
  } finally {
    addingCodes.value = false
  }
}

// 编辑商品
const editProduct = (row) => {
  editForm.id = row.id
  editForm.name = row.name
  editForm.price = row.price
  editForm.stock = row.stock
  showEditProduct.value = true
}

// 保存商品
const saveProduct = async () => {
  saving.value = true
  try {
    const { data } = await api.put(`/admin/products/${editForm.id}`, {
      name: editForm.name,
      price: editForm.price,
      stock: editForm.stock
    })
    if (data.success) {
      ElMessage.success('保存成功')
      showEditProduct.value = false
      loadStats()
    }
  } finally {
    saving.value = false
  }
}

// 删除用户
const deleteUser = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除用户「${row.username}」吗？`, '确认删除', {
      type: 'warning'
    })
    const { data } = await api.delete(`/admin/users/${row.id}`)
    if (data.success) {
      ElMessage.success('删除成功')
      loadUsers()
      loadStats()
    } else {
      ElMessage.error(data.message)
    }
  } catch (e) {
    // 取消删除
  }
}

// 状态文本转换
const statusText = (status) => {
  const map = { available: '可用', locked: '已锁定', used: '已使用', revoked: '已撤销' }
  return map[status] || status
}

const statusType = (status) => {
  const map = { available: 'success', locked: 'warning', used: 'info', revoked: 'danger' }
  return map[status] || ''
}

const orderStatusText = (status) => {
  const map = { pending: '待支付', paid: '已支付', cancelled: '已取消' }
  return map[status] || status
}

const orderStatusType = (status) => {
  const map = { pending: 'warning', paid: 'success', cancelled: 'info' }
  return map[status] || ''
}

// 历史记录操作类型
const historyActionType = (action) => {
  const map = {
    '激活会员': 'success',
    '撤销激活': 'danger',
    '删除兑换码': 'warning',
    '删除用户': 'info',
    '禁用会员': 'danger',
    '启用会员': 'success'
  }
  return map[action] || ''
}

// 会员状态
const memberStatusText = (status, expireAt) => {
  if (status === 'revoked') return '已撤销'
  if (status === 'used') {
    if (isExpired(expireAt)) return '已过期'
    return '有效'
  }
  return status
}

const memberStatusType = (status, expireAt) => {
  if (status === 'revoked') return 'danger'
  if (status === 'used') {
    if (isExpired(expireAt)) return 'info'
    return 'success'
  }
  return ''
}

// 判断是否过期
const isExpired = (expireAt) => {
  if (!expireAt) return true
  return new Date(expireAt) < new Date()
}

// 计算剩余时间
const getRemainingTime = (expireAt) => {
  if (!expireAt) return '-'
  const now = new Date()
  const expire = new Date(expireAt)
  const diff = expire - now

  if (diff <= 0) return '已过期'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) {
    return `${days}天${hours}小时`
  } else if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  } else {
    return `${minutes}分钟`
  }
}

// 撤销会员
const revokeMember = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要撤销该会员吗？\n兑换码：${row.code}\n撤销后会员资格将取消，兑换码不可再用。`,
      '确认撤销',
      { type: 'warning' }
    )
    const { data } = await api.post(`/admin/codes/${row.id}/revoke`)
    if (data.success) {
      ElMessage.success('撤销成功')
      loadMembers()
      loadStats()
      loadHistory()
    } else {
      ElMessage.error(data.message)
    }
  } catch (e) {
    // 取消撤销
  }
}

// 撤销该机器所有会员
const revokeAllForMachine = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要撤销该机器的所有会员吗？\n机器码：${row.machine_id}\n这将撤销该用户所有的会员资格，操作不可恢复！`,
      '确认批量撤销',
      { type: 'warning' }
    )
    const { data } = await api.post(`/admin/codes/revoke-machine/${encodeURIComponent(row.machine_id)}`)
    if (data.success) {
      ElMessage.success(data.message)
      loadMembers()
      loadStats()
      loadHistory()
    } else {
      ElMessage.error(data.message)
    }
  } catch (e) {
    // 取消撤销
  }
}

// 禁用/启用会员
const toggleDisable = async (row) => {
  try {
    const action = row.disabled ? '启用' : '禁用'
    await ElMessageBox.confirm(
      `确定要${action}该会员吗？\n兑换码：${row.code}`,
      `确认${action}`,
      { type: 'warning' }
    )
    const { data } = await api.post(`/admin/members/${row.id}/disable`)
    if (data.success) {
      ElMessage.success(data.message)
      loadMembers()
      loadHistory()
    } else {
      ElMessage.error(data.message)
    }
  } catch (e) {
    // 取消操作
  }
}

// 格式化时间（处理时区问题）
const formatTime = (time) => {
  if (!time) return '-'
  // 如果时间字符串不带时区信息，添加 Z 表示 UTC 时间
  const timeStr = time.includes('T') && !time.includes('Z') && !time.includes('+')
    ? time + 'Z'
    : time
  const date = new Date(timeStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai'
  })
}

// 删除兑换码
const deleteCode = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除兑换码「${row.code}」吗？`, '确认删除', {
      type: 'warning'
    })
    const { data } = await api.delete(`/admin/codes/${row.id}`)
    if (data.success) {
      ElMessage.success('删除成功')
      loadCodes()
      loadStats()
    } else {
      ElMessage.error(data.message)
    }
  } catch (e) {
    // 取消删除
  }
}

// 删除订单
const deleteOrder = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除订单「${row.order_id}」吗？`, '确认删除', {
      type: 'warning'
    })
    const { data } = await api.delete(`/admin/orders/${row.id}`)
    if (data.success) {
      ElMessage.success('删除成功')
      loadOrders()
      loadStats()
    } else {
      ElMessage.error(data.message)
    }
  } catch (e) {
    // 取消删除
  }
}

// 撤销激活
const revokeCode = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要撤销兑换码「${row.code}」的激活吗？\n撤销后用户会员资格将取消，兑换码不可再用。`, '确认撤销', {
      type: 'warning'
    })
    const { data } = await api.post(`/admin/codes/${row.id}/revoke`)
    if (data.success) {
      ElMessage.success('撤销成功')
      loadCodes()
      loadStats()
    } else {
      ElMessage.error(data.message)
    }
  } catch (e) {
    // 取消撤销
  }
}

// 初始化
onMounted(() => {
  // 检查管理员权限
  const savedUser = localStorage.getItem('user')
  if (!savedUser) {
    ElMessage.warning('请先登录管理员账号')
    window.location.href = '/'
    return
  }
  try {
    const user = JSON.parse(savedUser)
    if (!user.isAdmin) {
      ElMessage.warning('您没有管理员权限')
      window.location.href = '/'
      return
    }
  } catch (e) {
    ElMessage.warning('请先登录管理员账号')
    window.location.href = '/'
    return
  }

  loadStats()
  loadCodes()
  loadOrders()
  loadUsers()
  loadDevices() // 会员管理默认显示设备视图
  loadHistory()
  loadApiLogs()
})

// 监听会员视图切换
watch(memberViewMode, (newMode) => {
  if (newMode === 'device') {
    loadDevices()
  } else {
    loadMembers()
  }
})
</script>

<style scoped>
.admin {
  min-height: 100vh;
  background: #f5f7fa;
}

.admin-header {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 16px 24px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-content h1 {
  font-size: 20px;
  margin: 0;
}

.back-link {
  color: #1677FF;
  text-decoration: none;
}

.stats-container {
  max-width: 1200px;
  margin: 24px auto;
  padding: 0 24px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
  .stats-container {
    grid-template-columns: repeat(2, 1fr);
  }
}

.stat-card {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.stat-card.highlight {
  background: linear-gradient(135deg, #1677FF, #40a9ff);
  color: #fff;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
}

.stat-label {
  font-size: 14px;
  color: #86909C;
  margin-top: 4px;
}

.stat-card.highlight .stat-label {
  color: rgba(255, 255, 255, 0.8);
}

.admin-tabs {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px 24px;
  background: #fff;
  border-radius: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 16px 0;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
}

.add-code-form {
  margin-bottom: 16px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.password-cell {
  font-family: monospace;
  background: #FFF7E6;
  padding: 2px 8px;
  border-radius: 4px;
  color: #FA8C16;
}

.machine-id {
  font-family: monospace;
  font-size: 12px;
  color: #86909C;
}

.text-danger {
  color: #F53F3F;
}

.text-muted {
  color: #C9CDD4;
}
</style>
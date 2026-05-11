import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { wechatLogin, fetchCurrentUser } from '@/api/auth'
import type { LoginResult } from '@/api/auth'
import type { UserProfile } from '@/api/user'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(uni.getStorageSync('jwt_token') || '')
  const user = ref<UserProfile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isLoggedIn = computed(() => !!token.value)

  async function login() {
    loading.value = true
    error.value = null
    try {
      const result: LoginResult = await wechatLogin()
      token.value = result.token
      user.value = result.user
      uni.setStorageSync('jwt_token', result.token)
      return result
    } catch (e: any) {
      error.value = e.errMsg || e.message || '登录失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function checkLogin() {
    if (!token.value) return false
    try {
      const u = await fetchCurrentUser()
      user.value = u
      return true
    } catch {
      token.value = ''
      uni.removeStorageSync('jwt_token')
      return false
    }
  }

  function logout() {
    token.value = ''
    user.value = null
    uni.removeStorageSync('jwt_token')
  }

  /** 获取带认证的请求头 */
  function authHeader(): Record<string, string> {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {}
  }

  return { token, user, loading, error, isLoggedIn, login, checkLogin, logout, authHeader }
})

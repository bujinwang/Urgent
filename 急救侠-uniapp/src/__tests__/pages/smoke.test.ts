import { describe, it, expect, beforeEach } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

describe('cert/push-settings page', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('renders header', async () => {
    const page = await import('@/pages/cert/push-settings.vue')
    const wrapper = shallowMount(page.default)
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.text()).toContain('消息通知')
  })

  it('renders toggle list', async () => {
    const page = await import('@/pages/cert/push-settings.vue')
    const wrapper = shallowMount(page.default)
    expect(wrapper.text()).toContain('新救援任务')
    expect(wrapper.text()).toContain('任务状态变更')
  })
})

describe('home/index page', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('renders without crash', async () => {
    const page = await import('@/pages/home/index.vue')
    const wrapper = shallowMount(page.default)
    expect(wrapper.exists()).toBe(true)
  })
})

describe('learn/index page', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('renders without crash', async () => {
    const page = await import('@/pages/learn/index.vue')
    const wrapper = shallowMount(page.default)
    expect(wrapper.exists()).toBe(true)
  })
})

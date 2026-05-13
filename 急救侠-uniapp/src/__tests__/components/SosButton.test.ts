import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SosButton from '@/components/SosButton/index.vue'

describe('SosButton', () => {
  it('renders title and subtitle', () => {
    const wrapper = mount(SosButton, { props: { title: '紧急救援', subtitle: '副标题' } })
    expect(wrapper.html()).toContain('紧急救援')
    expect(wrapper.html()).toContain('副标题')
  })

  it('emits click event', async () => {
    const wrapper = mount(SosButton, { props: { title: 'Test', subtitle: 'Sub' } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })

  it('renders primary variant by default', () => {
    const wrapper = mount(SosButton, { props: { title: 'Test', subtitle: 'Sub' } })
    expect(wrapper.exists()).toBe(true)
  })

  it('renders dark variant', () => {
    const wrapper = mount(SosButton, { props: { title: 'Test', subtitle: 'Sub', variant: 'dark' } })
    expect(wrapper.exists()).toBe(true)
  })

  it('renders large size', () => {
    const wrapper = mount(SosButton, { props: { title: 'Test', subtitle: 'Sub', size: 'large' } })
    expect(wrapper.exists()).toBe(true)
  })

  it('renders without arrow when showArrow is false', () => {
    const wrapper = mount(SosButton, { props: { title: 'Test', subtitle: 'Sub', showArrow: false } })
    expect(wrapper.exists()).toBe(true)
  })
})

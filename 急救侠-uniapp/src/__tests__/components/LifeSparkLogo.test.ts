import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LifeSparkLogo from '@/components/LifeSparkLogo/index.vue'

describe('LifeSparkLogo', () => {
  it('renders with default size', () => {
    const wrapper = mount(LifeSparkLogo)
    expect(wrapper.exists()).toBe(true)
  })

  it('accepts size prop', () => {
    const wrapper = mount(LifeSparkLogo, { props: { size: 128 } })
    expect(wrapper.props('size')).toBe(128)
  })

  it('accepts custom colors', () => {
    const wrapper = mount(LifeSparkLogo, {
      props: { colorBg: '#FF0000', colorHeart: '#00FF00' }
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('accepts pulse prop', () => {
    const wrapper = mount(LifeSparkLogo, { props: { pulse: false } })
    expect(wrapper.props('pulse')).toBe(false)
  })

  it('renders SVG content', () => {
    const wrapper = mount(LifeSparkLogo)
    expect(wrapper.html()).toContain('svg')
  })
})

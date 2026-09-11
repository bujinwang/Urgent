import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GovStat from '@/components/GovStat/index.vue'

describe('GovStat 指标卡（null 不渲染 0）', () => {
  it('value=null ⇒ 渲染「数据积累中」，且绝不显示 0', () => {
    const wrapper = mount(GovStat, { props: { label: '响应 P95', value: null } })
    expect(wrapper.text()).toContain('数据积累中')
    expect(wrapper.text()).not.toContain('0')
  })

  it('整数原样展示，并渲染单位', () => {
    const wrapper = mount(GovStat, { props: { label: '在线志愿者', value: 12, unit: '人' } })
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('人')
  })

  it('非整数按默认 digits=1 保留一位（0.5 → 0.5）', () => {
    const wrapper = mount(GovStat, { props: { label: '可用率', value: 0.5 } })
    expect(wrapper.text()).toContain('0.5')
  })

  it('digits=2 时保留两位（0.5 → 0.50）', () => {
    const wrapper = mount(GovStat, { props: { label: '可用率', value: 0.5, digits: 2 } })
    expect(wrapper.text()).toContain('0.50')
  })

  it('渲染 label 与 hint', () => {
    const wrapper = mount(GovStat, { props: { label: '测试指标', value: 3, hint: '有节奏' } })
    expect(wrapper.text()).toContain('测试指标')
    expect(wrapper.text()).toContain('有节奏')
  })
})

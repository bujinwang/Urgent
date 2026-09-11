import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GovBarChart from '@/components/GovBarChart/index.vue'

describe('GovBarChart 条形图（归一化 / 钳制 / 空态）', () => {
  it('空数据 ⇒ 显示「暂无数据」且无任何条目', () => {
    const wrapper = mount(GovBarChart, { props: { items: [] } })
    expect(wrapper.text()).toContain('暂无数据')
    expect(wrapper.findAll('.gov-bar-row')).toHaveLength(0)
  })

  it('按最大值归一化：10 → 100%，5 → 50%', () => {
    const wrapper = mount(GovBarChart, {
      props: { items: [{ label: 'a', value: 10 }, { label: 'b', value: 5 }] },
    })
    const fills = wrapper.findAll('.gov-bar-fill')
    expect(fills).toHaveLength(2)
    expect(fills[0].attributes('style')).toContain('width: 100%')
    expect(fills[1].attributes('style')).toContain('width: 50%')
  })

  it('正的最小值仍保留至少 2% 可见宽度', () => {
    const wrapper = mount(GovBarChart, {
      props: { items: [{ label: 'a', value: 1000 }, { label: 'b', value: 1 }] },
    })
    const fills = wrapper.findAll('.gov-bar-fill')
    expect(fills[1].attributes('style')).toContain('width: 2%')
  })

  it('value<=0 ⇒ 宽度 0%', () => {
    const wrapper = mount(GovBarChart, {
      props: { items: [{ label: 'a', value: 0 }, { label: 'b', value: -5 }] },
    })
    const fills = wrapper.findAll('.gov-bar-fill')
    expect(fills[0].attributes('style')).toContain('width: 0%')
    expect(fills[1].attributes('style')).toContain('width: 0%')
  })

  it('非有限值 ⇒ 宽度 0%（不被 NaN 污染）', () => {
    const wrapper = mount(GovBarChart, { props: { items: [{ label: 'a', value: Infinity }] } })
    expect(wrapper.find('.gov-bar-fill').attributes('style')).toContain('width: 0%')
  })

  it('渲染每一项的 label 与 value 文案', () => {
    const wrapper = mount(GovBarChart, { props: { items: [{ label: '交通事故', value: 4 }] } })
    expect(wrapper.text()).toContain('交通事故')
    expect(wrapper.text()).toContain('4')
  })
})

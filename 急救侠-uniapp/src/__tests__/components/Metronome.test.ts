import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Metronome from '@/components/Metronome/index.vue'

describe('Metronome', () => {
  it('renders with default props', () => {
    const wrapper = mount(Metronome)
    expect(wrapper.exists()).toBe(true)
  })

  it('displays count value', () => {
    const wrapper = mount(Metronome, { props: { display: '15', label: '按压' } })
    expect(wrapper.html()).toContain('15')
  })

  it('displays label', () => {
    const wrapper = mount(Metronome, { props: { display: '0', label: '测试标签' } })
    expect(wrapper.html()).toContain('测试标签')
  })

  it('emits reset when wrapper clicked', async () => {
    const wrapper = mount(Metronome, { props: { display: '10', label: 'reset' } })
    await wrapper.find('.metronome').trigger('click')
    expect(wrapper.emitted('reset')).toBeTruthy()
  })

  it('renders with running state', () => {
    const wrapper = mount(Metronome, { props: { display: '5', running: true } })
    expect(wrapper.exists()).toBe(true)
  })

  it('renders with stopped state', () => {
    const wrapper = mount(Metronome, { props: { display: '5', running: false } })
    expect(wrapper.exists()).toBe(true)
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import StepTimer from '@/components/StepTimer/index.vue'

describe('StepTimer', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders with seconds prop', () => {
    const wrapper = mount(StepTimer, { props: { seconds: 10, autoStart: false } })
    expect(wrapper.exists()).toBe(true)
  })

  it('displays remaining seconds', () => {
    const wrapper = mount(StepTimer, { props: { seconds: 5, autoStart: false } })
    expect(wrapper.html()).toContain('5')
  })

  it('counts down and ticks', async () => {
    const wrapper = mount(StepTimer, { props: { seconds: 5, autoStart: true } })
    vi.advanceTimersByTime(1100)
    await wrapper.vm.$nextTick()
    const emitted = wrapper.emitted('tick')
    expect(emitted).toBeTruthy()
  })

  it('emits done when timer expires', async () => {
    const wrapper = mount(StepTimer, { props: { seconds: 3, autoStart: true } })
    vi.advanceTimersByTime(3500)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('done')).toBeTruthy()
  })

  it('renders label when provided', () => {
    const wrapper = mount(StepTimer, { props: { seconds: 5, label: '倒计时', autoStart: false } })
    expect(wrapper.html()).toContain('倒计时')
  })

  it('exposes start/stop methods', () => {
    const wrapper = mount(StepTimer, { props: { seconds: 5, autoStart: false } })
    expect(typeof (wrapper.vm as any).start).toBe('function')
    expect(typeof (wrapper.vm as any).stop).toBe('function')
  })
})

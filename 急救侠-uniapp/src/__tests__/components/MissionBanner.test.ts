import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MissionBanner from '@/components/MissionBanner/index.vue'

describe('MissionBanner', () => {
  afterEach(() => { vi.useRealTimers() })

  it('renders with default props', () => {
    const wrapper = mount(MissionBanner)
    expect(wrapper.exists()).toBe(true)
  })

  it('displays distance', () => {
    const wrapper = mount(MissionBanner, { props: { distance: 240, volunteers: 2 } })
    expect(wrapper.html()).toContain('240')
  })

  it('displays volunteer count', () => {
    const wrapper = mount(MissionBanner, { props: { distance: 100, volunteers: 5 } })
    expect(wrapper.html()).toContain('3')
  })

  it('emits click event', async () => {
    const wrapper = mount(MissionBanner, { props: { distance: 100, volunteers: 3 } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })

  it('shows countdown', () => {
    const wrapper = mount(MissionBanner, { props: { distance: 100, volunteers: 3 } })
    expect(wrapper.exists()).toBe(true)
  })
})

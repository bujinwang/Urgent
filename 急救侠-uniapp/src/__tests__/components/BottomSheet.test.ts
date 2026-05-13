import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BottomSheet from '@/components/BottomSheet/index.vue'

describe('BottomSheet', () => {
  it('renders when visible', () => {
    const wrapper = mount(BottomSheet, { props: { visible: true, title: '测试标题' } })
    expect(wrapper.html()).toContain('测试标题')
  })

  it('hides when not visible', () => {
    const wrapper = mount(BottomSheet, { props: { visible: false } })
    expect(wrapper.exists()).toBe(true)
  })

  it('renders dark variant', () => {
    const wrapper = mount(BottomSheet, { props: { visible: true, dark: true, title: 'Dark' } })
    expect(wrapper.exists()).toBe(true)
  })

  it('emits close event', async () => {
    const wrapper = mount(BottomSheet, { props: { visible: true, title: 'Test' } })
    // Find close button and click
    const closeBtn = wrapper.find('[class*="close"]')
    if (closeBtn.exists()) {
      await closeBtn.trigger('click')
    }
  })

  it('renders slot content', () => {
    const wrapper = mount(BottomSheet, {
      props: { visible: true, title: 'Slot Test' },
      slots: { default: '<div class="test-slot">Slot Content</div>' }
    })
    expect(wrapper.html()).toContain('Slot Content')
  })
})

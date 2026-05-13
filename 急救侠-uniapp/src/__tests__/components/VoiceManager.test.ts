import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VoiceManager from '@/components/VoiceManager/index.vue'

describe('VoiceManager', () => {
  it('mounts without errors', () => {
    const wrapper = mount(VoiceManager)
    expect(wrapper.exists()).toBe(true)
  })

  it('exposes speak method', () => {
    const wrapper = mount(VoiceManager)
    expect(typeof (wrapper.vm as any).speak).toBe('function')
  })

  it('exposes stop method', () => {
    const wrapper = mount(VoiceManager)
    expect(typeof (wrapper.vm as any).stop).toBe('function')
  })

  it('exposes command method', () => {
    const wrapper = mount(VoiceManager)
    expect(typeof (wrapper.vm as any).command).toBe('function')
  })

  it('exposes guide method', () => {
    const wrapper = mount(VoiceManager)
    expect(typeof (wrapper.vm as any).guide).toBe('function')
  })

  it('exposes comfort method', () => {
    const wrapper = mount(VoiceManager)
    expect(typeof (wrapper.vm as any).comfort).toBe('function')
  })

  it('exposes count method', () => {
    const wrapper = mount(VoiceManager)
    expect(typeof (wrapper.vm as any).count).toBe('function')
  })

  it('exposes speakSequence method', () => {
    const wrapper = mount(VoiceManager)
    expect(typeof (wrapper.vm as any).speakSequence).toBe('function')
  })

  it('renders empty UI', () => {
    const wrapper = mount(VoiceManager)
    expect(wrapper.html()).toContain('display: none')
  })
})

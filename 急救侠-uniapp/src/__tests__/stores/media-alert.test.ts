import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMediaAlertStore } from '@/stores/media-alert'

describe('Media Alert Store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('initializes in idle phase', () => {
    const store = useMediaAlertStore()
    expect(store.phase).toBe('idle')
    expect(store.mediaList).toEqual([])
  })

  it('addMedia adds items and transitions to ready', () => {
    const store = useMediaAlertStore()
    store.addMedia([{ type: 'image', path: '/test.jpg' }])
    expect(store.mediaList.length).toBe(1)
    expect(store.phase).toBe('ready')
  })

  it('hasMedia computed', () => {
    const store = useMediaAlertStore()
    expect(store.hasMedia).toBe(false)
    store.addMedia([{ type: 'image', path: '/test.jpg' }])
    expect(store.hasMedia).toBe(true)
  })

  it('fileCount computed', () => {
    const store = useMediaAlertStore()
    store.addMedia([{ type: 'image', path: '/a.jpg' }, { type: 'video', path: '/b.mp4' }])
    expect(store.fileCount).toBe(2)
  })

  it('removeMedia removes items', () => {
    const store = useMediaAlertStore()
    store.addMedia([{ type: 'image', path: '/test.jpg' }])
    store.removeMedia(0)
    expect(store.mediaList.length).toBe(0)
    expect(store.phase).toBe('idle')
  })

  it('okCount and failCount initialized', () => {
    const store = useMediaAlertStore()
    expect(store.okCount).toBe(0)
    expect(store.failCount).toBe(0)
  })

  it('reset clears state', () => {
    const store = useMediaAlertStore()
    store.addMedia([{ type: 'image', path: '/test.jpg' }])
    store.reset()
    expect(store.phase).toBe('idle')
    expect(store.mediaList.length).toBe(0)
  })
})

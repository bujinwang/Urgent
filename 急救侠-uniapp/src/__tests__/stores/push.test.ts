import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePushStore } from '@/stores/push'

describe('Push Store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('initializes with no subscriptions', () => {
    const store = usePushStore()
    expect(store.templateOptions.length).toBe(4)
    expect(store.isSubscribed).toBe(false)
    for (const opt of store.templateOptions) {
      expect(opt.subscribed).toBe(false)
    }
  })

  it('template options have expected keys', () => {
    const store = usePushStore()
    const keys = store.templateOptions.map((t) => t.key)
    expect(keys).toEqual(['newMission', 'taskUpdate', 'drillReminder', 'aedMaintenance'])
  })

  it('template options have labels and descriptions', () => {
    const store = usePushStore()
    for (const opt of store.templateOptions) {
      expect(opt.label).toBeTruthy()
      expect(opt.description).toBeTruthy()
      expect(opt.templateId).toBeTruthy()
    }
  })

  it('subscribeOne marks template as subscribed', async () => {
    const store = usePushStore()
    await store.subscribeOne('tpl_new_mission')
    expect(store.isSubscribed).toBe(true)
    const tmpl = store.templateOptions.find((t) => t.templateId === 'tpl_new_mission')
    expect(tmpl?.subscribed).toBe(true)
  })

  it('unsubscribeOne marks template as unsubscribed', async () => {
    const store = usePushStore()
    await store.subscribeOne('tpl_new_mission')
    await store.unsubscribeOne('tpl_new_mission')
    expect(store.isSubscribed).toBe(false)
    const tmpl = store.templateOptions.find((t) => t.templateId === 'tpl_new_mission')
    expect(tmpl?.subscribed).toBe(false)
  })

  it('tracks multiple subscribed templates', async () => {
    const store = usePushStore()
    await store.subscribeOne('tpl_new_mission')
    await store.subscribeOne('tpl_task_update')
    expect(store.isSubscribed).toBe(true)
    expect(store.subscribedTemplates.size).toBe(2)
  })
})

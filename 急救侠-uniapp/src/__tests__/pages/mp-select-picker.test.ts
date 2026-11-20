import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import fs from 'node:fs'
import path from 'node:path'
import { setLocale } from '@/i18n'
import { messages } from '@/locales'

/**
 * Regression guard for replacing HTML <select> with a single-column <picker> on mp-weixin.
 *
 * Why runtime tests alone are not enough: the vitest config uses only @vitejs/plugin-vue
 * (no uni conditional-compilation plugin), so both template branches stay in the test DOM.
 * The source-level checks below are what actually protect the platform split.
 *
 * ⚠️ Directive tokens are assembled from fragments on purpose: uni-app's preprocessor
 * regex is not line-anchored and would treat a literal token in this file as a real
 * conditional-compilation instruction.
 */
const MP_OPEN = '<' + '!-- #' + 'ifdef MP-WEIXIN --' + '>'
const MP_CLOSE = '<' + '!-- #' + 'endif --' + '>'
const H5_OPEN = '<' + '!-- #' + 'ifndef MP-WEIXIN --' + '>'

function read(rel: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8')
}
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}
/** Text between the first opening token and the following closing token. */
function blockBetween(src: string, open: string): string {
  const start = src.indexOf(open)
  expect(start, `missing opening token: ${open}`).toBeGreaterThan(-1)
  const end = src.indexOf(MP_CLOSE, start + open.length)
  expect(end, 'unpaired closing token').toBeGreaterThan(start)
  return src.slice(start + open.length, end)
}

type PageVm = Record<string, any>
function vm(wrapper: { vm: unknown }): PageVm {
  return wrapper.vm as PageVm
}

function stubFetch(): void {
  const data: unknown[] = []
  vi.stubGlobal('fetch', vi.fn((_url: string) =>
    Promise.resolve({ json: () => Promise.resolve({ data }) })
  ))
}

async function mountDrillForm() {
  stubFetch()
  const page = await import('@/pages/drill/index.vue')
  const wrapper = mount(page.default)
  vm(wrapper).showCreate = true
  await nextTick()
  return wrapper
}

async function mountMobilizeForm() {
  const page = await import('@/pages/rescue/mobilize.vue')
  const wrapper = mount(page.default)
  vm(wrapper).showCreate = true
  await nextTick()
  return wrapper
}

async function mountWildlifeForm() {
  stubFetch()
  const page = await import('@/pages/wildlife/index.vue')
  const wrapper = mount(page.default)
  await flushPromises()
  vm(wrapper).showReport = true
  await nextTick()
  return wrapper
}

describe('mp-weixin single-column picker replacing select', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setLocale('zh-CN')
    vi.clearAllMocks()
  })

  afterEach(() => {
    setLocale('zh-CN')
    vi.unstubAllGlobals()
  })

  describe('conditional template structure', () => {
    const cases = [
      {
        rel: 'src/pages/drill/index.vue',
        values: ['cpr', 'aed', 'trauma', 'choking', 'mass'],
        bindings: [':range="scenarioLabels"', ':value="scenarioIndex"', '@change="onScenarioChange"'],
        model: 'form.scenario',
      },
      {
        rel: 'src/pages/rescue/mobilize.vue',
        values: ['rescue', 'training', 'assist'],
        bindings: [':range="mobTypeLabels"', ':value="mobTypeIndex"', '@change="onMobTypeChange"'],
        model: 'form.type',
      },
      {
        rel: 'src/pages/wildlife/index.vue',
        values: ['pet', 'wildlife'],
        bindings: [':range="reportCategoryLabels"', ':value="reportCategoryIndex"', '@change="onReportCategoryChange"'],
        model: 'form.category',
      },
    ] as const

    for (const c of cases) {
      it(`${c.rel}: one paired MP block with a selector picker, one paired non-MP block with the original select`, () => {
        const src = read(c.rel)
        expect(count(src, MP_OPEN), 'MP branch count').toBe(1)
        expect(count(src, H5_OPEN), 'non-MP branch count').toBe(1)
        expect(count(src, MP_CLOSE), 'paired closing token count').toBe(2)
        expect(src.indexOf(MP_OPEN)).toBeLessThan(src.indexOf(H5_OPEN))

        const mp = blockBetween(src, MP_OPEN)
        expect(mp).toContain('<picker')
        expect(mp).toContain('mode="selector"')
        for (const binding of c.bindings) expect(mp, binding).toContain(binding)
        expect(mp).not.toContain('<select')

        const h5 = blockBetween(src, H5_OPEN)
        expect(h5).toContain(`<select v-model="${c.model}">`)
        for (const value of c.values) expect(h5, value).toContain(`value="${value}"`)
        expect(h5).not.toContain('<picker')
      })
    }
  })

  describe('drill scenario', () => {
    it('picker change writes the raw scenario value back to form and the index follows', async () => {
      const wrapper = await mountDrillForm()
      expect(vm(wrapper).form.scenario).toBe('cpr')
      expect(vm(wrapper).scenarioIndex).toBe(0)

      await wrapper.find('picker').trigger('change', { detail: { value: 3 } })
      expect(vm(wrapper).form.scenario).toBe('choking')
      expect(vm(wrapper).scenarioIndex).toBe(3)
      expect(wrapper.find('.modal-picker-value').text()).toBe(messages['zh-CN'].drill.scenario.choking)
      wrapper.unmount()
    })

    it('H5 v-model on select still drives form, and the picker index is re-derived from it', async () => {
      const wrapper = await mountDrillForm()
      const options = wrapper.findAll('select option')
      expect(options.map(o => o.attributes('value'))).toEqual(['cpr', 'aed', 'trauma', 'choking', 'mass'])

      await wrapper.find('select').setValue('mass')
      expect(vm(wrapper).form.scenario).toBe('mass')
      expect(vm(wrapper).scenarioIndex).toBe(4)
      expect(vm(wrapper).scenarioLabelText).toBe(messages['zh-CN'].drill.scenario.mass)
      wrapper.unmount()
    })

    it('picker labels are localized inside a computed and react to locale switches', async () => {
      const wrapper = await mountDrillForm()
      expect(vm(wrapper).scenarioLabels).toEqual(['CPR 心肺复苏', 'AED 使用', '创伤急救', '异物窒息', '群体伤'])

      setLocale('en-US')
      await nextTick()
      expect(vm(wrapper).scenarioLabels).toEqual([
        messages['en-US'].drill.scenario.cpr,
        messages['en-US'].drill.scenario.aed,
        messages['en-US'].drill.scenario.trauma,
        messages['en-US'].drill.scenario.choking,
        messages['en-US'].drill.scenario.mass,
      ])
      expect(wrapper.find('.modal-picker-value').text()).toBe(messages['en-US'].drill.scenario.cpr)
      wrapper.unmount()
    })

    it('invalid / out-of-range picker index falls back instead of writing a label or undefined', async () => {
      const wrapper = await mountDrillForm()
      await wrapper.find('picker').trigger('change', { detail: { value: 'not-a-number' } })
      expect(vm(wrapper).form.scenario).toBe('cpr')
      await wrapper.find('picker').trigger('change', { detail: { value: 99 } })
      expect(vm(wrapper).form.scenario).toBe('mass')
      expect(vm(wrapper).scenarioIndex).toBe(4)
      wrapper.unmount()
    })
  })

  describe('rescue mobilization type', () => {
    it('picker change writes raw value and label follows', async () => {
      const wrapper = await mountMobilizeForm()
      expect(vm(wrapper).form.type).toBe('rescue')
      expect(vm(wrapper).mobTypeLabels).toEqual(['救援', '训练', '协助'])

      await wrapper.find('picker').trigger('change', { detail: { value: 2 } })
      expect(vm(wrapper).form.type).toBe('assist')
      expect(vm(wrapper).mobTypeIndex).toBe(2)
      expect(vm(wrapper).mobTypeLabel).toBe('协助')

      await wrapper.find('picker').trigger('change', { detail: { value: 'bad' } })
      expect(vm(wrapper).form.type).toBe('rescue')
      expect(vm(wrapper).mobTypeIndex).toBe(0)
      wrapper.unmount()
    })

    it('H5 select keeps its three raw values and drives the index', async () => {
      const wrapper = await mountMobilizeForm()
      expect(wrapper.findAll('select option').map(o => o.attributes('value'))).toEqual(['rescue', 'training', 'assist'])
      await wrapper.find('select').setValue('training')
      expect(vm(wrapper).form.type).toBe('training')
      expect(vm(wrapper).mobTypeIndex).toBe(1)
      expect(vm(wrapper).mobTypeLabel).toBe('训练')
      wrapper.unmount()
    })
  })

  describe('wildlife report category', () => {
    it('picker change writes raw value and label follows', async () => {
      const wrapper = await mountWildlifeForm()
      expect(vm(wrapper).form.category).toBe('pet')
      expect(vm(wrapper).reportCategoryLabels).toEqual(['🐱 流浪宠物', '🦅 野生动物（保护机构处理）'])

      await wrapper.find('picker').trigger('change', { detail: { value: 1 } })
      expect(vm(wrapper).form.category).toBe('wildlife')
      expect(vm(wrapper).reportCategoryIndex).toBe(1)
      expect(vm(wrapper).reportCategoryLabel).toBe('🦅 野生动物（保护机构处理）')

      await wrapper.find('picker').trigger('change', { detail: { value: 50 } })
      expect(vm(wrapper).form.category).toBe('wildlife')
      wrapper.unmount()
    })

    it('H5 select keeps its two raw values and drives the index', async () => {
      const wrapper = await mountWildlifeForm()
      expect(wrapper.findAll('select option').map(o => o.attributes('value'))).toEqual(['pet', 'wildlife'])
      await wrapper.find('select').setValue('wildlife')
      expect(vm(wrapper).form.category).toBe('wildlife')
      expect(vm(wrapper).reportCategoryIndex).toBe(1)

      vm(wrapper).formReset()
      await nextTick()
      expect(vm(wrapper).form.category).toBe('pet')
      expect(vm(wrapper).reportCategoryIndex).toBe(0)
      wrapper.unmount()
    })
  })

  describe('fractional picker index hardening', () => {
    it('fractional / negative indices are truncated and still write a valid raw value (never undefined)', async () => {
      const drill = await mountDrillForm()
      await drill.find('picker').trigger('change', { detail: { value: 1.5 } })
      expect(vm(drill).form.scenario).toBe('aed')
      expect(vm(drill).form.scenario).not.toBeUndefined()
      expect(vm(drill).scenarioIndex).toBe(1)
      drill.unmount()

      const mob = await mountMobilizeForm()
      await mob.find('picker').trigger('change', { detail: { value: 2.9 } })
      expect(vm(mob).form.type).toBe('assist')
      expect(vm(mob).form.type).not.toBeUndefined()
      expect(vm(mob).mobTypeIndex).toBe(2)
      mob.unmount()

      const wild = await mountWildlifeForm()
      vm(wild).form.category = 'wildlife'
      await nextTick()
      await wild.find('picker').trigger('change', { detail: { value: -1.5 } })
      expect(vm(wild).form.category).toBe('pet')
      expect(vm(wild).form.category).not.toBeUndefined()
      expect(vm(wild).reportCategoryIndex).toBe(0)
      wild.unmount()
    })
  })
})

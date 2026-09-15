/**
 * F2 双语 —— 「裸 CJK 源码守卫」的**共享扫描清单**与工具。
 *
 * 为什么抽成共享模块：`rescue-i18n.test.ts` 与 `guide-aed-i18n.test.ts` 都要对**同一份
 * 已本地化页面清单**做「剥离注释后是否仍残留中文字面量」的扫描。清单若各写一份，
 * 两边一定会漂移（新加一个页面只被其中一边扫到 ⇒ 另一边的守卫形同虚设）。
 * 把清单收敛到**唯一事实源**，是本模块存在的唯一目的。
 *
 * ⚠️ 本清单**只**服务于「裸 CJK 源码守卫」；它不是 `i18n.test.ts` 里那份
 * `SCOPE_FILES`（那份是更广的「静态 key 使用扫描」范围，含尚未抽 key 的文件）。
 */
import fs from 'node:fs'
import path from 'node:path'

/**
 * 裸 CJK 源码守卫的**扫描范围** —— 仅限「已完成本地化」的页面。
 *
 * 增删规则（重要）：
 * - 某页面**完成**文案双语化后，**必须**加到这里，否则它的「中文抽漏」不会被任何守卫发现。
 * - 页面**尚未**本地化时**不得**加入：守卫会对既存中文误报红。
 *
 * P0-4b 已补：`src/pages/aed/detail.vue`、`src/pages/drill/index.vue`
 * （二者文案已双语化 ⇒ 必须纳入，否则它们的「中文抽漏」不会被任何守卫发现）。
 */
export const SCOPE_FILES = [
  'src/pages/rescue/index.vue',
  'src/pages/guide/index.vue',
  'src/pages/aed/index.vue',
  'src/pages/aed/detail.vue',
  'src/pages/drill/index.vue',
] as const

/** 中文字符（CJK 统一表意文字）。 */
export const RE_CJK = /[\u4e00-\u9fa5]/

/** 是否含中文字符。 */
export const hasCjk = (s: string): boolean => RE_CJK.test(s)

/**
 * 剥离 HTML / 块 / 行注释。行注释仅在 `//` 前是空白或行首时剥离，避免误伤字符串里的 `//`。
 *
 * ⚠️ **已知理论边界**（当前范围内代码无此形态 ⇒ 非现网问题，如需改动此正则请留意）：
 * 若某个**字符串字面量内部**含「空格 + `//` + 中文」（如 `const x = 'a // 中文'`），
 * 该行会被误剥成空 ⇒ 可能造成**假阴性**（漏报一个真实的中文字面量）。如需彻底排除，
 * 得换成真正的词法扫描；当前收益不值这个复杂度，故保留此简单实现并在此标注。
 */
export function stripComments(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n')
}

/**
 * 读取范围文件（相对项目根），返回「行号: 该行去注释后的内容」中**仍含中文**的行。
 *
 * 返回空数组 ⇒ 该文件无裸中文字面量（通过）；非空 ⇒ 失败信息可直指「第几行漏抽了」。
 */
export function findNakedCjkLines(rel: string): string[] {
  const abs = path.resolve(process.cwd(), rel)
  const src = fs.readFileSync(abs, 'utf8')
  return stripComments(src)
    .split('\n')
    .map((line, i) => ({ line: line.trim(), n: i + 1 }))
    .filter((x) => hasCjk(x.line))
    .map((o) => `${o.n}: ${o.line}`)
}

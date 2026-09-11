#!/usr/bin/env node
/**
 * 断言「安装后的依赖树中只有一份 Vue」。
 *
 * 为什么需要这个检查：
 *   uni-app（@dcloudio/*）精确锁定 vue@3.4.21，而 pinia（2.2+ / 3.x / 4.x）的 peer 要求
 *   vue@^3.5.11 —— 两者**无法同时满足于同一份 Vue**。因此 `急救侠-uniapp/.npmrc` 显式声明
 *   `legacy-peer-deps=true`，使 npm 放弃 peer 校验、把 Vue 压平为唯一的一份 3.4.21（与 uni-app 对齐）。
 *
 *   风险在于：一旦有人删掉该标志并**重新生成 package-lock.json**，`npm install` 不会报错，
 *   而是静默地装出「根目录 vue@3.5.42 + 若干嵌套 vue@3.4.21」的分裂树；随后 `npm ci` 也会
 *   因为 lock 自洽而**通过**。CI 于是变绿，而运行时是两套 Vue 实例（响应式 / provide-inject /
 *   app.use(pinia) 全部错配）—— 这正是本脚本要拦下的**静默失败**。
 *
 * 用法：node scripts/check-vue-singleton.mjs   （CI 在 `npm ci` 之后调用）
 * 退出码：0 = 恰好一份 Vue；1 = 0 份或多份（依赖树分裂 / 未安装依赖）
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const nodeModules = path.join(root, 'node_modules')

if (!fs.existsSync(nodeModules)) {
  console.error('✗ 未找到 node_modules —— 请先安装依赖（npm ci）。')
  process.exit(1)
}

/** 递归收集所有真正的 `vue` 包（含嵌套），按 realpath 去重以兼容 pnpm 符号链接布局。 */
const found = new Map() // realpath -> { version, relPath }

/**
 * 在某个 node_modules 目录内扫描包。
 * 只沿「node_modules」边界下钻（<pkg>/node_modules），不遍历包源码，避免全树慢扫。
 * 以 package.json 的 name === 'vue' 判定，避免把 @vue/* 之类的 scope 目录误判。
 */
function scanNodeModules(nmDir, depth) {
  if (depth > 8) return
  let entries
  try {
    entries = fs.readdirSync(nmDir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue // .bin / .pnpm / .package-lock.json 等
    const p = path.join(nmDir, e.name)
    if (!e.isDirectory() && !e.isSymbolicLink()) continue

    if (e.name.startsWith('@')) {
      scanNodeModules(p, depth + 1) // scope 目录：其子项才是包
      continue
    }

    const pkgJson = path.join(p, 'package.json')
    if (fs.existsSync(pkgJson)) {
      let meta = null
      try {
        meta = JSON.parse(fs.readFileSync(pkgJson, 'utf8'))
      } catch {
        /* ignore */
      }
      if (meta && meta.name === 'vue') {
        let real = p
        try {
          real = fs.realpathSync(p)
        } catch {
          /* 保留原路径 */
        }
        if (!found.has(real)) {
          found.set(real, { version: meta.version || '?', relPath: path.relative(root, p) })
        }
        continue // vue 包内部不再下钻
      }
    }

    const nested = path.join(p, 'node_modules')
    if (fs.existsSync(nested)) scanNodeModules(nested, depth + 1)
  }
}
scanNodeModules(nodeModules, 0)

const list = [...found.values()]
if (list.length === 1) {
  console.log(`✓ 依赖树中恰好一份 Vue：${list[0].version}  (${list[0].relPath})`)
  process.exit(0)
}

if (list.length === 0) {
  console.error('✗ 依赖树中找不到 Vue —— 依赖未安装或安装不完整，请先执行 `npm ci`。')
  process.exit(1)
}

console.error(`✗ 依赖树中的 Vue 不是唯一一份（实际 ${list.length} 份）：`)
for (const v of list) console.error(`    - ${v.version}  ${v.relPath}`)
console.error('')
console.error('这就是「Vue 分裂」：应用代码与 uni-app 运行时会各自加载一套 Vue 实例，')
console.error('导致响应式 / provide-inject / app.use(pinia) 错配（运行时静默出错）。')
console.error('多半是有人删掉了 急救侠-uniapp/.npmrc 的 legacy-peer-deps=true 并重新生成了 lock。')
console.error('处理：恢复该标志 → 删除 node_modules 与 package-lock.json → npm install → 重新提交 lock。')
process.exit(1)

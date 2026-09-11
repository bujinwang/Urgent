#!/usr/bin/env node
/**
 * 急救侠 · 上线前/部署后一键冒烟脚本
 *
 * 目标：把「手工端到端验证」固化成可重复执行的一条命令，零安装即可运行。
 *
 * 用法：
 *   node scripts/smoke.mjs                                   # 默认打本机 https://localhost:8443
 *   node scripts/smoke.mjs --base https://jiujiaxia.example.com
 *   node scripts/smoke.mjs --phone 13900000001 --password test1234
 *   node scripts/smoke.mjs --verbose                          # 打印每个请求 method/url/status
 *
 * 约束：
 *   - 仅使用 Node 内置模块（fetch / process）与内置断言，不新增任何依赖。
 *   - 幂等：固定手机号 + 固定口令；重复运行不会反复新增用户。
 *   - 全部断言通过 exit 0，任一失败 exit 1（绝不吞异常）。
 */

import assert from 'node:assert/strict';
import process from 'node:process';

/** @typedef {{
 *   base: string,
 *   insecure: boolean,
 *   phone: string,
 *   password: string,
 *   verbose: boolean,
 * }} Options */

const DEFAULT_BASE = 'https://localhost:8443';
const DEFAULT_PHONE = '19900000000';
const DEFAULT_PASSWORD = 'smoke-test-1234';

const HELP = `急救侠 · 端到端冒烟脚本

用法: node scripts/smoke.mjs [选项]

选项:
  --base <url>      被测站点根地址（默认 ${DEFAULT_BASE}）
  --insecure        跳过 TLS 校验（主机为 localhost/127.0.0.1 时自动开启）
  --phone <手机号>  测试用手机号（默认 ${DEFAULT_PHONE}）
  --password <口令> 测试用口令（默认 ${DEFAULT_PASSWORD}）
  --verbose, -v     打印每个请求的 method/url/status
  --help, -h        显示本帮助
`;

/**
 * 解析命令行参数。
 * @param {string[]} argv process.argv.slice(2)
 * @returns {Options}
 */
function parseArgs(argv) {
  /** @type {Options} */
  const opts = {
    base: DEFAULT_BASE,
    insecure: false,
    phone: DEFAULT_PHONE,
    password: DEFAULT_PASSWORD,
    verbose: false,
  };

  const requireValue = (flag, value) => {
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`参数 ${flag} 缺少取值`);
    }
    return value;
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--base':
        opts.base = requireValue(arg, argv[++i]);
        break;
      case '--insecure':
        opts.insecure = true;
        break;
      case '--phone':
        opts.phone = requireValue(arg, argv[++i]);
        break;
      case '--password':
        opts.password = requireValue(arg, argv[++i]);
        break;
      case '--verbose':
      case '-v':
        opts.verbose = true;
        break;
      case '--help':
      case '-h':
        process.stdout.write(HELP);
        process.exit(0);
        break;
      default:
        throw new Error(`未知参数: ${arg}（用 --help 查看用法）`);
    }
  }

  // 归一化 base：去掉尾部斜杠，避免拼出双斜杠。
  opts.base = opts.base.replace(/\/+$/, '');
  return opts;
}

/**
 * 拼接 base 与 path，保证不会出现双斜杠。
 * @param {string} base
 * @param {string} path
 * @returns {string}
 */
function joinUrl(base, path) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/+$/, '')}${suffix}`;
}

const opts = parseArgs(process.argv.slice(2));
const baseUrl = opts.base;

// ---- TLS：本机 / 显式 --insecure 时跳过证书校验（自签证书） ----
let hostname = '';
try {
  hostname = new URL(baseUrl).hostname;
} catch {
  process.stderr.write(`错误: --base 不是合法 URL: ${baseUrl}\n`);
  process.exit(1);
}
const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
if (opts.insecure || isLocalHost) {
  // 屏蔽 Node 自带的 NODE_TLS_REJECT_UNAUTHORIZED 告警（下方已明确打印提示），
  // 其余告警原样转发，避免掩盖真实问题。
  const originalEmitWarning = process.emitWarning.bind(process);
  process.emitWarning = (warning, ...rest) => {
    const message = typeof warning === 'string' ? warning : (warning && warning.message) || '';
    if (message.includes('NODE_TLS_REJECT_UNAUTHORIZED')) return;
    return originalEmitWarning(warning, ...rest);
  };
  // 必须在任何 TLS 请求之前设置。
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  process.stdout.write(
    `提示: 已跳过 TLS 校验${isLocalHost && !opts.insecure ? '（本机地址，自签证书默认放行）' : ''}。\n`,
  );
}

const baseOrigin = new URL(baseUrl).origin;

// ---- 断言执行器 ----
let passed = 0;
let failed = 0;
/** @type {string[]} */
const failureDetails = [];

/**
 * 执行一条断言：成功打印 PASS，失败打印 FAIL 与原因。
 * @param {string} name 断言名称
 * @param {() => (void | Promise<void>)} fn 断言体，抛错即视为失败
 */
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    process.stdout.write(`PASS  ${name}\n`);
  } catch (err) {
    failed += 1;
    const reason = err && err.message ? err.message : String(err);
    process.stdout.write(`FAIL  ${name}\n`);
    process.stdout.write(`      → ${reason}\n`);
    failureDetails.push(`${name}: ${reason}`);
  }
}

/**
 * 发起一次 HTTP 请求（基于内置 fetch）。
 * @param {string} method
 * @param {string} path
 * @param {{headers?: Record<string,string>, body?: unknown, redirect?: RequestRedirect}} [options]
 * @returns {Promise<{status:number, headers:Headers, text:string, json:any, url:string}>}
 */
async function request(method, path, options = {}) {
  const { headers = {}, body, redirect = 'follow' } = options;
  const url = joinUrl(baseUrl, path);
  /** @type {RequestInit} */
  const init = { method, headers, redirect };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new Error(`请求失败 ${method} ${url}: ${err && err.message ? err.message : err}`);
  }
  sawAnyResponse = true;

  if (opts.verbose) {
    process.stdout.write(`      ${method} ${url} → ${res.status}\n`);
  }

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, headers: res.headers, text, json, url };
}

/**
 * 判断响应是否命中了 /api/auth 限流（15 分钟 / 20 次，见 server app.ts）。
 * @param {{status:number, json:any}} res
 * @returns {boolean}
 */
function isRateLimited(res) {
  if (res.status === 429) return true;
  return !!(res.json && typeof res.json.message === 'string' && res.json.message.includes('请求过于频繁'));
}

/**
 * 命中限流时追加明确诊断，避免与真实代码回归混淆。
 * @param {{status:number, json:any}} res
 * @returns {string}
 */
function rateLimitHint(res) {
  return isRateLimited(res)
    ? '\n          ⚠ 疑似命中 /api/auth 限流（同一来源 15 分钟最多 20 次）。等待窗口重置后再跑即可——这是限流，不是代码回归。'
    : '';
}

/**
 * 断言 HTTP 状态码。
 * @param {{status:number, json:any}} res
 * @param {number} expected
 * @param {string} context
 */
function assertStatus(res, expected, context) {
  assert.equal(
    res.status,
    expected,
    `${context}: 期望 HTTP ${expected}，实际 ${res.status}（body: ${truncate(res.text)}）${rateLimitHint(res)}`,
  );
}

/**
 * 截断长文本用于错误信息。
 * @param {string} text
 * @param {number} [max]
 * @returns {string}
 */
function truncate(text, max = 200) {
  const s = text ?? '';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** 业务令牌（登录后填充），供后续用例复用。 */
let token = '';
/** 是否至少收到过一个 HTTP 响应（用于区分「连不上服务」与「业务失败」）。 */
let sawAnyResponse = false;

async function run() {
  const start = Date.now();
  process.stdout.write(`急救侠 冒烟测试 → ${baseUrl}\n`);
  process.stdout.write(`测试账号: ${opts.phone}\n\n`);

  // ---- 1. SPA 首页 ----
  await check('1. GET / 返回 SPA（200 / text/html / 含「急救侠」与 <div id="app"）', async () => {
    const res = await request('GET', '/');
    assertStatus(res, 200, 'GET /');
    const ct = res.headers.get('content-type') || '';
    assert.ok(ct.includes('text/html'), `content-type 应含 text/html，实际 "${ct}"`);
    assert.ok(res.text.includes('急救侠'), 'body 应包含「急救侠」');
    assert.ok(res.text.includes('<div id="app"'), 'body 应包含 <div id="app"');
  });

  // ---- 2. 首页引用的静态资源可访问 ----
  await check('2. /assets/* 静态资源（应为 4 个）逐个可访问（200）', async () => {
    const res = await request('GET', '/');
    const assets = Array.from(new Set(res.text.match(/\/assets\/[A-Za-z0-9._-]+/g) || []));
    assert.equal(assets.length, 4, `应提取到 4 个 /assets 引用，实际 ${assets.length}: ${assets.join(', ')}`);
    for (const asset of assets) {
      const r = await request('GET', asset);
      assertStatus(r, 200, `GET ${asset}`);
    }
  });

  // ---- 3. 健康检查 ----
  await check('3. GET /api/health 返回 200 且 code === 0', async () => {
    const res = await request('GET', '/api/health');
    assertStatus(res, 200, 'GET /api/health');
    assert.ok(res.json, 'health 应为合法 JSON');
    assert.equal(res.json.code, 0, `code 应为 0，实际 ${JSON.stringify(res.json)}`);
  });

  // ---- 4. 注册（幂等：已注册视为通过） ----
  await check('4. POST /api/auth/register 成功或「该手机号已注册」', async () => {
    const res = await request('POST', '/api/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      body: { phone: opts.phone, password: opts.password, name: 'Smoke 冒烟' },
    });
    const message = res.json && res.json.message;
    const okNew = res.json && res.json.code === 0 && typeof message === 'string' && message.includes('注册成功');
    const okDup = typeof message === 'string' && message.includes('该手机号已注册');
    assert.ok(okNew || okDup, `注册响应不符合预期: HTTP ${res.status} ${truncate(res.text)}`);
  });

  // ---- 5. 登录取得真实 JWT ----
  await check('5. POST /api/auth/login 返回 200 / code 0 / JWT 令牌', async () => {
    const res = await request('POST', '/api/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      body: { phone: opts.phone, password: opts.password },
    });
    assertStatus(res, 200, 'POST /api/auth/login');
    assert.ok(res.json, `登录应返回 JSON: ${truncate(res.text)}`);
    assert.equal(res.json.code, 0, `登录 code 应为 0，实际 ${JSON.stringify(res.json)}`);
    const t = res.json.data && res.json.data.token;
    assert.ok(typeof t === 'string' && t.length > 0, 'data.token 应存在');
    const parts = t.split('.');
    assert.equal(parts.length, 3, `令牌应为 3 段 JWT，实际 ${parts.length} 段`);
    assert.ok(parts.every((p) => p.length > 0), 'JWT 每段均不应为空');
    token = t;
  });

  // ---- 6. 受保护端点（带令牌） ----
  await check('6. GET /api/auth/me 带令牌返回 200 / code 0 / id === u_<phone>', async () => {
    assert.ok(token, '缺少业务令牌（登录用例未通过）');
    const res = await request('GET', '/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    assertStatus(res, 200, 'GET /api/auth/me');
    assert.ok(res.json && res.json.code === 0, `code 应为 0，实际 ${truncate(res.text)}`);
    assert.equal(res.json.data && res.json.data.id, `u_${opts.phone}`, `data.id 应为 u_${opts.phone}`);
  });

  // ---- 7. 负例：无令牌 ----
  await check('7. GET /api/auth/me 不带令牌返回 401', async () => {
    const res = await request('GET', '/api/auth/me');
    assertStatus(res, 401, 'GET /api/auth/me（无令牌）');
  });

  // ---- 8. 负例：错误口令 ----
  await check('8. POST /api/auth/login 错误口令返回 code -1 / 含「密码错误」', async () => {
    const res = await request('POST', '/api/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      body: { phone: opts.phone, password: 'wrong-' + opts.password },
    });
    assert.ok(res.json, `应返回 JSON: ${truncate(res.text)}`);
    assert.equal(res.json.code, -1, `code 应为 -1，实际 ${JSON.stringify(res.json)}`);
    assert.ok(
      typeof res.json.message === 'string' && res.json.message.includes('密码错误'),
      `message 应含「密码错误」，实际 ${JSON.stringify(res.json.message)}${rateLimitHint(res)}`,
    );
  });

  // ---- 9. 令牌隔离：业务令牌不得穿透政府鉴权 ----
  await check('9. GET /api/gov/dashboard 带业务令牌返回 401（令牌隔离 P2-8）', async () => {
    assert.ok(token, '缺少业务令牌（登录用例未通过）');
    const res = await request('GET', '/api/gov/dashboard', { headers: { Authorization: `Bearer ${token}` } });
    assertStatus(res, 401, 'GET /api/gov/dashboard（业务令牌）');
  });

  // ---- 10. 授权：普通用户访问平台管理端点 → 403 ----
  await check('10. GET /api/gov/viewers 带业务令牌返回 403（非平台管理员）', async () => {
    assert.ok(token, '缺少业务令牌（登录用例未通过）');
    const res = await request('GET', '/api/gov/viewers', { headers: { Authorization: `Bearer ${token}` } });
    assertStatus(res, 403, 'GET /api/gov/viewers（业务令牌）');
  });

  // ---- 11. CORS 白名单 ----
  await check('11. CORS：白名单 Origin 有 allow-origin，evil Origin 无 allow-origin', async () => {
    const allowed = await request('POST', '/api/auth/login', {
      headers: { 'Content-Type': 'application/json', Origin: baseOrigin },
      body: { phone: opts.phone, password: opts.password },
    });
    assert.ok(
      allowed.headers.get('access-control-allow-origin'),
      `白名单 Origin(${baseOrigin}) 应返回 access-control-allow-origin`,
    );

    const blocked = await request('POST', '/api/auth/login', {
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: { phone: opts.phone, password: opts.password },
    });
    assert.ok(
      !blocked.headers.get('access-control-allow-origin'),
      'evil Origin 不应返回 access-control-allow-origin',
    );
  });

  // ---- 12. 请求体上限 ----
  await check('12. 超大请求体（约 1.6MB）返回 413', async () => {
    const payload = JSON.stringify({ phone: opts.phone, password: 'x'.repeat(1_600_000) });
    const res = await request('POST', '/api/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    assertStatus(res, 413, 'POST /api/auth/login（超大请求体）');
  });

  // ---- 13. 安全响应头（helmet） ----
  await check('13. GET /api/health 含 helmet 安全响应头', async () => {
    const res = await request('GET', '/api/health');
    const expect = {
      'x-content-type-options': 'nosniff',
      'x-frame-options': null,
      'strict-transport-security': null,
      'referrer-policy': null,
    };
    for (const [header, value] of Object.entries(expect)) {
      const actual = res.headers.get(header);
      assert.ok(actual, `缺少响应头 ${header}`);
      if (value !== null) {
        assert.equal(actual, value, `${header} 应为 ${value}，实际 ${actual}`);
      }
    }
  });

  // ---- 汇总 ----
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  process.stdout.write(`\n${passed} passed, ${failed} failed (${elapsed}s)\n`);
  if (failed > 0) {
    process.stdout.write('\n失败详情:\n');
    for (const detail of failureDetails) {
      process.stdout.write(`  - ${detail}\n`);
    }
    if (!token) {
      process.stdout.write(
        sawAnyResponse
          ? '\n提示: 登录失败，可用 --phone 换一个测试号重试。\n'
          : '\n提示: 未能连接被测服务，请确认 --base 指向的栈已启动。\n',
      );
    }
  }
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  process.stderr.write(`冒烟脚本异常退出: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
});

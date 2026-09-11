# 急救侠 — 生产部署手册

面向对象：运维/开发同学，在一台**全新 Linux 主机**上把 急救侠 上线（自动 HTTPS + 自动部署）。

> 本手册对应生产形态 **`docker-compose.prod.yml`**（Caddy TLS + GHCR 镜像）。
> **本地开发**请继续使用 `docker-compose.yml`（本地构建、无 TLS），两者互不影响。

---

## 1. 主机前提

| 项 | 要求 | 说明 |
|---|---|---|
| Docker | Engine 24+ | `docker --version` |
| Compose | **v2**（`docker compose`，带连字符的子命令） | `docker compose version` |
| 端口 | 放行 **80** 与 **443**（TCP），建议同时放行 **443/UDP** | 80 用于 ACME HTTP-01 质询与 HTTPS 跳转 |
| 域名 | 一条 **A 记录**（IPv6 则 AAAA）指向主机公网 IP | 未解析成功会导致证书签不下来 |
| 磁盘 | ≥ 5 GB 可用 | 镜像 + SQLite 数据 + 证书 |

```bash
# 主机侧检查
docker --version && docker compose version
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp
```

> 若主机在云厂商安全组内，**安全组也要放行 80/443**，仅开 ufw 不够。

---

## 2. 首次部署（在主机上）

```bash
sudo mkdir -p /opt/jiujiaxia && sudo chown "$USER" /opt/jiujiaxia
cd /opt/jiujiaxia

# 2.1 取得部署文件（三种方式任选）
#   a) 由 CD 自动上传（配置 Secrets 后 push main 即可）
#   b) 手动从仓库拷贝：
#      scp docker-compose.prod.yml Caddyfile .env.example  <user>@<host>:/opt/jiujiaxia/
#   c) 在主机上 git clone 后取这两个文件

# 2.2 生成两个**不同**的强随机密钥
openssl rand -hex 32   # → JWT_SECRET
openssl rand -hex 32   # → GOV_JWT_SECRET（必须与上面不同！）

# 2.3 创建运行时配置
cp .env.example .env
vim .env
```

`.env` 至少确认这几项：

```ini
DOMAIN=jiujiaxia.example.com          # 你的域名（A 记录已指向本机）—— 必填
TLS_EMAIL=you@example.com             # 证书到期提醒邮箱 —— **不能留空**（见下方说明）
PORT=3001
JWT_SECRET=<粘贴第 1 个 openssl 输出>
GOV_JWT_SECRET=<粘贴第 2 个 openssl 输出>
DB_PATH=./data/jiujiaxia.db
CORS_ORIGINS=https://jiujiaxia.example.com
```

> ⚠️ **`TLS_EMAIL` 不能留空**：空值会让 Caddyfile 的 `tls` 行退化为「裸 `tls`」而解析失败
> （`caddy validate` 实测报 `wrong argument count ... after 'tls'`），容器会启动失败。
> 若确实不想提供邮箱，请**删除 `Caddyfile` 中的 `tls {$TLS_EMAIL}` 一行** ——
> Caddy 对域名默认仍会自动签发/续期证书（实测「不写 `tls`」= Valid configuration），仅无到期提醒。
> ⚠️ **`GOV_JWT_SECRET` 必须与 `JWT_SECRET` 不同**：两者相同会削弱政府令牌与业务令牌的隔离
> （政府令牌穿透业务鉴权的缺陷在 P2-8 已修复并加固，此处是同一原则的部署侧要求）。
> ⚠️ **`CORS_ORIGINS` 生产必填**：未配置时后端会放开跨域并打印告警。

```bash
# 2.4 启动
docker compose -f docker-compose.prod.yml --env-file .env pull
docker compose -f docker-compose.prod.yml --env-file .env up -d --remove-orphans
docker compose -f docker-compose.prod.yml --env-file .env ps
```

首次启动 Caddy 会自动向 Let's Encrypt 申请证书（约 10–60 秒）。验证：

```bash
curl -I https://jiujiaxia.example.com            # 期望 HTTP/2 200
curl -s https://jiujiaxia.example.com/api/health # 期望后端健康响应
docker compose -f docker-compose.prod.yml logs --tail=50 caddy
```

---

## 3. GitHub Secrets 配置（启用自动部署）

进入仓库 **Settings → Secrets and variables → Actions → New repository secret**，新增 4 项：

| Secret | 必填 | 说明 |
|---|---|---|
| `SSH_HOST` | ✅ | 主机 IP 或域名 |
| `SSH_USER` | ✅ | 登录用户，**需有 docker 权限**（在 `docker` 组或可 sudo） |
| `SSH_PORT` | ➖ | SSH 端口，留空默认 `22` |
| `SSH_KEY` | ✅ | 部署用**私钥**全文（含 `-----BEGIN ...-----` 行） |

建议用**专用部署密钥**（不要复用个人密钥）：

```bash
# 本地生成
ssh-keygen -t ed25519 -C "jiujiaxia-deploy" -f ~/.ssh/jiujiaxia_deploy -N ""

# 公钥装到主机
ssh-copy-id -i ~/.ssh/jiujiaxia_deploy.pub <user>@<host>
# 或手动：把 ~/.ssh/jiujiaxia_deploy.pub 内容追加到主机 ~/.ssh/authorized_keys

# 私钥全文（含首尾行）粘贴为 SSH_KEY
cat ~/.ssh/jiujiaxia_deploy
```

主机用户需能免密执行 docker：

```bash
sudo usermod -aG docker <user>   # 重新登录生效
```

> **未配置 Secrets 时**：CD 的 `deploy` 作业会**跳过**部署并打印提示（CI 保持绿色），
> 只有 `build-and-push` 照常把镜像推到 GHCR。拿到机器后补上 Secrets，下一次 push main 即自动部署。

---

## 4. 触发部署

**方式一：自动（推荐）** — push 到 `main` ⇒ `build-and-push` 推送 `:latest` 镜像 ⇒ `deploy` 上传
`docker-compose.prod.yml` + `Caddyfile`（`.env` 始终只留在主机，不入库）⇒ 主机执行 `pull` + `up -d`。

**方式二：手动（主机上）**

```bash
cd /opt/jiujiaxia
docker compose -f docker-compose.prod.yml --env-file .env pull
docker compose -f docker-compose.prod.yml --env-file .env up -d --remove-orphans
```

**方式三：只重启某个服务**

```bash
docker compose -f docker-compose.prod.yml --env-file .env restart web
```

---

## 5. 回滚

### 5.1 回滚镜像版本（最快）
GHCR 上镜像以 `:latest` 滚动覆盖，回滚需要**指向旧的 digest 或自建 tag**：

```bash
# 查看主机上已有的镜像（含 digest）
docker images --digests ghcr.io/bujinwang/jiujiaxia-server
docker images --digests ghcr.io/bujinwang/jiujiaxia-web
```

把 `/opt/jiujiaxia/docker-compose.prod.yml` 里的 `image:` 从 `:latest` 改为目标 digest：

```yaml
server:
  image: ghcr.io/bujinwang/jiujiaxia-server@sha256:<旧 digest>
web:
  image: ghcr.io/bujinwang/jiujiaxia-web@sha256:<旧 digest>
```

然后 `docker compose -f docker-compose.prod.yml --env-file .env up -d`。
下次 CD 上传 compose 文件会覆盖回 `latest`，属预期（即时回滚即可）。

### 5.2 回滚代码
`git revert <commit>` 后 push main ⇒ CD 自动重建镜像并部署。
（数据库不回滚，请确认新旧版本的迁移兼容性。）

### 5.3 暂停部署
在 GitHub 上删除/改名 `SSH_HOST` Secret，或用 `workflow_dispatch` 手动流程；
也可以临时把 `deploy` 作业的 `needs` 链断开（不推荐，仅应急）。

---

## 6. 常见问题

| 现象 | 排查 / 处理 |
|---|---|
| 证书签不下来 | ① `dig +short <DOMAIN>` 确认解析到本机；② 云安全组与 ufw 都放行 80；③ `docker compose logs caddy` 看 ACME 报错 |
| caddy 容器反复重启，日志含 `tls: wrong argument count` | `TLS_EMAIL` 为空。填入邮箱，或删除 `Caddyfile` 的 `tls {$TLS_EMAIL}` 一行 |
| 提示 `too many certificates already issued` | ACME 速率限制。确认 `caddy-data` 卷存在（证书已持久化），不要反复 `down -v` |
| `docker pull` 401/403 | 当前镜像是 **public**，无需登录；若改为 private，主机需 `echo <PAT> \| docker login ghcr.io -u <user> --password-stdin` |
| `deploy` 作业报 `主机 /opt/jiujiaxia/.env 不存在` | 按第 2 节在主机创建 `.env`（CD **不会**上传 `.env`，避免密钥入库） |
| 部署后仍是旧页面 | `docker compose -f docker-compose.prod.yml --env-file .env pull` 后 `up -d`；或浏览器强刷（web 用 nginx 默认缓存策略） |
| 数据库数据看不到 | 确认 `server-data` 卷存在：`docker volume ls \| grep server-data`；`DB_PATH=./data/jiujiaxia.db` 落在卷内 |
| 想临时停 TLS 调试 | 不建议改 Caddyfile；可先 `curl -H 'Host: <DOMAIN>' http://<IP>/` 验证 web 容器链路 |
| 端口 80/443 被占用 | `sudo ss -lntp \| grep -E ':80\|:443'`，停掉占用进程（如宿主机自带 nginx/apache） |

---

## 7. 架构与职责边界（便于排障）

```
Internet ──443──▶ caddy (TLS 终止, 自动证书, HTTP/3)
                    │  reverse_proxy web:80
                    ▼
                  web (nginx: SPA 静态 + /api/、/uploads/ 反代)
                    │  proxy_pass http://server:3001
                    ▼
                  server (Node API, SQLite @ server-data 卷)
```

- **只有 `caddy` 暴露宿主端口**（80/443/443udp）；`server` 与 `web` 仅在内网互通。
- SPA 回退与 `/api/`、`/uploads/` 三条路由由 `web` 容器内的 `nginx.conf` 负责（该链路已验证，本次未改动）。
- Caddy 默认设置 `X-Forwarded-For` / `X-Forwarded-Proto` / `X-Forwarded-Host`，nginx 侧也有
  `proxy_set_header X-Forwarded-Proto $scheme`，转发链完整。
- 数据持久化：`server-data`（SQLite）、`caddy-data`（**证书，务必保留**）、`caddy-config`。

---

## 8. 日常运维速查

```bash
cd /opt/jiujiaxia
DC="docker compose -f docker-compose.prod.yml --env-file .env"

$DC ps                       # 服务状态与健康
$DC logs -f --tail=100 web   # 前端 nginx 日志
$DC logs -f --tail=100 server
$DC logs -f --tail=100 caddy # 证书/ACME/访问日志
$DC restart server           # 重启单服务
$DC down                     # 停止（**不要**加 -v，会删数据卷与证书）
```

备份 SQLite：

```bash
docker run --rm -v jiujiaxia_server-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/jiujiaxia-db-$(date +%F).tar.gz -C /data .
```

---

## 9. 本机生产同构自测（macOS / colima，上线前）

上线前想在**本机**跑一套与生产**同构**的栈（Caddy TLS + web nginx + Node API）做端到端测试，
用这组专用文件，**不要**碰生产文件：

| 文件 | 作用 |
|---|---|
| `docker-compose.local.yml` | 与 `docker-compose.prod.yml` 同构；差别仅在：本机 `build:` 构建（arm64 原生）、端口 **8443**、Caddy 用 `Caddyfile.local` |
| `Caddyfile.local` | `localhost { tls internal ... }` —— Caddy 内部 CA 自签，**不联网**、不需域名、不需 80 端口 |
| `.env.local` | 本机运行时变量（随机 `JWT_SECRET`/`GOV_JWT_SECRET` + `CORS_ORIGINS=https://localhost:8443`）；**含密钥，已 gitignore** |

> ⚠️ `docker-compose.local.yml` / `Caddyfile.local` **不可**用于生产；生产走第 1–4 节的 GitHub Actions + `docker-compose.prod.yml`。

### 9.1 前置：安装容器运行时（colima，无需 Docker Desktop）

```bash
brew install colima docker docker-compose
# 若 ~/.docker/config.json 残留 Docker Desktop 的 "credsStore": "desktop"，
# 会报 docker-credential-desktop: executable file not found —— 删掉该行即可。
export PATH="/opt/homebrew/bin:$PATH"
colima start --cpu 2 --memory 4 --disk 30     # 首次约 1 分钟（macOS 虚拟化框架，arm64 原生）
docker context use colima
docker info --format '{{.ServerVersion}} {{.Architecture}}'   # 期望 29.x aarch64
```

### 9.2 生成 `.env.local` 并启动

```bash
cd <项目根>
# 两个密钥必须不同（与生产同一要求，见第 2 节说明）
{ echo "PORT=3001";
  echo "JWT_SECRET=$(openssl rand -hex 32)";
  echo "GOV_JWT_SECRET=$(openssl rand -hex 32)";
  echo "DB_PATH=./data/jiujiaxia.db";
  echo "CORS_ORIGINS=https://localhost:8443"; } > .env.local
chmod 600 .env.local

docker compose -f docker-compose.local.yml --env-file .env.local up -d --build
docker compose -f docker-compose.local.yml --env-file .env.local ps   # 三个服务均应 healthy
```

### 9.3 端到端验证

**一键冒烟（推荐）** —— 一条命令跑完全部 **13 项断言**（SPA 及 4 个静态资源、健康检查、
注册/登录/受保护端点、无令牌与错口令负例、令牌隔离、角色授权、CORS 白名单、请求体上限、安全响应头）：

```bash
node scripts/smoke.mjs                          # 本机默认 https://localhost:8443
node scripts/smoke.mjs --base https://<域名>    # 生产（走真实证书，无需额外参数）
```

- 仅用 Node 内置模块（`fetch`/`process`/`assert`），**零安装**即可运行；
  本机自签证书在 `--base` 主机为 `localhost`/`127.0.0.1` 时**自动跳过 TLS 校验**。
- 期望结尾输出 `13 passed, 0 failed`，**退出码 0**；任一失败退出码 **1** 并逐条打印 `FAIL` 与原因。
- 幂等：固定测试号 `19900000000`（可用 `--phone` 覆盖），重复运行不会新增用户。

> ⚠️ `/api/auth/*` 有**限流：同一来源 15 分钟 20 次**（见 server `app.ts`）。
> 脚本已把 CORS（#11）与超大请求体 413（#12）两条断言改打**无任何限流器**的 `/api/health`，
> 故**每轮仅消耗 5 次** `/api/auth` 额度 → 同一来源约可连跑 **4 轮**；连续跑撞 429 时脚本会在
> 汇总行**显式标注**（这是限流，不是代码回归），重跑前等窗口重置即可。

**分步排查（手工 curl 备选）**：

```bash
curl -k https://localhost:8443/                 # SPA（自签证书，-k 跳过校验）
curl -k https://localhost:8443/api/health       # {"code":0,"message":"急救侠 API 运行中"}

# 业务链路：注册 → 登录（真实 JWT）→ 受保护端点
curl -k -X POST https://localhost:8443/api/auth/register \
  -H 'Content-Type: application/json' -d '{"phone":"13900000001","password":"test1234","name":"测试"}'
TOKEN=$(curl -k -X POST https://localhost:8443/api/auth/login \
  -H 'Content-Type: application/json' -d '{"phone":"13900000001","password":"test1234"}' \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
curl -k https://localhost:8443/api/auth/me -H "Authorization: Bearer $TOKEN"   # 200
curl -k https://localhost:8443/api/auth/me                                     # 401（未登录）
```

### 9.4 消除浏览器证书警告（可选）

```bash
docker compose -f docker-compose.local.yml --env-file .env.local cp \
  caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain ./caddy-root.crt
```

### 9.5 停止 / 清理

```bash
DC="docker compose -f docker-compose.local.yml --env-file .env.local"
$DC down              # 停止（保留数据卷）
$DC down -v           # 停止并删除数据卷（SQLite 数据一并清空，慎用）
colima stop           # 停掉虚拟机
```

### 9.6 本机自测踩坑记录

| 现象 | 根因 / 处理 |
|---|---|
| `docker compose up` 立即失败：`docker-credential-desktop: executable file not found` | `~/.docker/config.json` 残留 Docker Desktop 的 `"credsStore": "desktop"`；删该行（及失效的 `desktop-linux` context） |
| `web` 容器一直 `health: starting`，`caddy` 卡在 `Waiting`，整个 `up` 挂住 | `nginx.conf` 自定义 `server{}` 覆盖了基础镜像的 `default.conf`，导致镜像自带的 IPv6 监听脚本失效 → 容器内 `localhost` 解析为 `::1` 却无监听。**已修**：`nginx.conf` 增加 `listen [::]:80;`，健康检查改用 `http://127.0.0.1/`（生产 `docker-compose.prod.yml` 同一处也修） |
| `colima start` 报 `limactl: executable file not found` | brew 前缀未进 PATH；用 `export PATH="/opt/homebrew/bin:$PATH"` 前缀重跑 |

---

## 10. 运维：平台管理员收窄

### 10.1 背景：为什么需要「收窄」

迁移 036 做了角色拆分——`is_leader`（队伍队长）与 `is_platform_admin`（平台管理员）
自此**正交**。为避免拆分造成**静默失权**，036 挂了一次性回填
`backfillPlatformAdmins()`：把既有 `is_leader = 1` 的账号**同时**保权为平台管理员。

这是**保权而非授权**，副作用是：历史上因队伍角色拿到管理面权限的账号被**固化**为平台管理员。
把不该有管理权的账号降级（`is_platform_admin: 1 → 0`）就是「**收窄**」。

### 10.2 ⚠️ 为什么收窄必须走本工具（而不是随手改库）

回填的 WHERE 条件是 `is_leader = 1 AND is_platform_admin = 0`。
若你**只是手动把某账号降级**、而没有留下任何痕迹，那么**下一次**有人再触发回填
（或误调 `backfillPlatformAdmins()`）时，该账号会因 `is_leader` 仍为 1 而被**静默重新提权**——
收窄被自己抵消。

因此本工具在完成收窄后，会写入一个**持久标记** `app_meta.platform_admin_narrowing_done = '1'`，
`backfillPlatformAdmins()` 的**首行**即据此早退（返回 0、不查库、不打日志）。
**一旦收窄发生，回填永久停用** —— 这是「降级不被静默撤销」的机制保证，
从此**不再需要靠人记住「收窄后别调 backfill」**（规则变成了机制）。

> 若从未收窄，标记为空，回填行为与既往完全一致（首次保权不受影响）。

### 10.3 `--list`：先看清候选名单

```bash
cd 急救侠-server
npm run admin:narrow -- --list          # 无参数时默认也是 --list
```

范围：`is_leader = 1 OR is_platform_admin = 1`。输出列：
`id | name | affiliation | is_leader | is_platform_admin`，并：

- **显式标注「回填固化候选」**（`is_leader = 1 且 is_platform_admin = 1`）——
  这些是最可能需要收窄的账号（保权遗留）。
- 打印标记状态：「未置位（尚未收窄）」/「已置位（收窄已发生 → 回填已停用）」。

`--list` 只读，不做任何修改、不改标记。

### 10.4 `--downgrade`：执行收窄

```bash
# 把 id 逗号分隔列出；仅且仅这些 id 被降级
npm run admin:narrow -- --downgrade u_leader_a,u_leader_b

# 仅当操作会把平台管理员清零、且你确需清零时，才追加 --force
npm run admin:narrow -- --downgrade <id> --force
```

行为与护栏：

| 行为 | 说明 |
|---|---|
| 只降级列出的 id | `is_platform_admin` 置 0；**不做任何其它改动** |
| 逐条打印 before→after | 便于审计留痕 |
| 完成后置位标记 | `setMeta('platform_admin_narrowing_done','1')` —— 使收窄 **durable**（回填永久停用） |
| `--downgrade` 后无 id | 打印用法并 **exit 2** |
| 任一 id 不存在 | **整体中止、不做任何修改、exit 2**（避免半途生效） |
| 会清零（自锁保护） | 默认**拒绝**并提示「会导致无平台管理员，如确需请加 --force」，**exit 2**；加 `--force` 才执行 |
| `--help` / `-h` | 打印全部用法 |

**退出码**：`0` 成功；`2` 用法错误 / 被拒；`1` 意外错误。

### 10.5 典型流程

```bash
cd 急救侠-server
npm run admin:narrow -- --list                       # 1) 与业务/运营核对名单
npm run admin:narrow -- --downgrade <确认的 id 列表>    # 2) 执行收窄（自动置位标记）
npm run admin:narrow -- --list                       # 3) 复核：标记应为「已置位」、目标账号已为 0
```

> **安全边界**：收窄是**运维侧脚本**，**不暴露任何 HTTP 接口** —— 攻击面保持不变。
> 具体降级**名单**属产品/业务决策，须由业务/运营确认（本工具只提供机制与手段）。

### 10.6 ⚠️ 迁移「后处理」失败时的处置（不可自动重试）

启动日志若出现形如：

```
[DB] 迁移 036_add_user_is_platform_admin 已应用，但迁移后处理失败（需人工处理，重启不会重试）: no such column: is_leader
```

含义：该迁移的**主体已应用**（`_migrations` 已登记该迁移号），但其 `after` 回调（如一次性回填 `backfillPlatformAdmins()`）**抛错**。

处置要点：

- **重启不会重试** —— `_migrations` 已写入该编号，runner 不会再执行其 `after`；此错误只打一次 `console.error`，**无自动补偿**。
- **先定根因**（上例是真实库缺列），修好后再**手动补跑**该 `after` 的语义。
- **结合 §10 机制判断**：若 `platform_admin_narrowing_done` 已置位（收窄已执行），则回填**应保持停用**，不要手动调用 `backfillPlatformAdmins()` 去"补"——否则会把已降级账号静默重新提权。
- 因该路径**一次性且不自动重试**，出现该 error 必须人工确认，**不能只以「服务已启动」判定正常**。



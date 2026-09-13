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

### 2.0 ⚠️ 环境变量该写进哪个文件（生产 / 本机自测 / 本地开发**各不相同**）

三个 compose 文件各自 `env_file:` **不同的**文件，**写错 = 变量静默缺失**
（`ALIYUN_*` 的门控是「任一为空即关闭」，**不报错** ⇒ 短信/语音会**永久不发出**且无任何日志）：

| 场景 | compose 文件 | 实际读取的 env 文件 | 用途 |
|---|---|---|---|
| **生产部署**（本手册） | `docker-compose.prod.yml` | 仓库根 **`.env`** | Caddy TLS + GHCR 镜像；server 运行时变量（含 `ALIYUN_*`）**全部**写这里 |
| **本机生产同构自测** | `docker-compose.local.yml` | 仓库根 **`.env.local`** | 见 §9（含随机密钥，已 gitignore） |
| **本地开发 / 裸跑后端** | `docker-compose.yml`（或 `cd 急救侠-server && npm run dev`） | **`急救侠-server/.env`** | 仅本地；**生产部署下不被读取** |

依据（三个 compose 文件里的 `env_file:` 原文，逐字引用）：

```yaml
# docker-compose.prod.yml:45-47
    env_file:
      # 与 compose 同目录的根级 .env（**不是** 急救侠-server/.env）
      - ./.env

# docker-compose.local.yml:43-44
    env_file:
      - ./.env.local

# docker-compose.yml:20-21
    env_file:
      - ./急救侠-server/.env
```

> ⚠️ **生产请把 `ALIYUN_*` / `TRUST_PROXY_HOPS` / 反滥用限流等全部填进仓库根 `.env`**
> （根 `.env.example` 已按此列全并带注释）；写进 `急救侠-server/.env` 在生产里**完全不生效**。

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

## 11. 阿里云短信 / 语音 · 联调验收清单（拿到凭证后照此跑）

> 代码侧已完成（配置门控 + 确定性单测 + 两轮突变验证），**唯一未验证的是真实调用**。本清单把"真机联调"固化为可复跑步骤。
>
> ⚠️ **口径来源**：本节的**签名来源 / 报备时效 / 文案纪律**以
> `deliverables/software-company/aliyun-approval.md`（依据阿里云官方文档整理，附录含全部 URL）为**唯一权威**；
> 若两者冲突，**以该报备材料为准**（关键依据：签名实名报备
> <https://help.aliyun.com/document_detail/2873145.html>，2026-08-20 更新）。

### 11.1 阿里云控制台（一次性）
1. **企业实名认证**（⚠️ **个人**实名自用资质**无法**通过签名实名报备，**仅企业资质**可报备）。
2. **短信签名** —— 来源**只能是**：① **企事业单位名**（**优先**；简称须含省/市等地域信息、为全称子集且能唯一标识主体）或 ② **已注册商标名**（商标所有方须 = 阿里云账号主体）。
   - ⚠️「APP 名 / 公众号小程序名 / 电商店铺名 / 已备案网站名」**已不支持**运营商实名报备。
   - ⚠️ **「急救侠」作签名**需主体**持有该商标**、或**企业名本身含「急救侠」**，否则报备**大概率被拒**。
   - **时效**：审核约 **0.5–1 天** + **运营商实名报备 5–10 个工作日**（不承诺）⇒ **按 ≥10 个工作日预留上线窗口**。
   - 权威口径：`deliverables/software-company/aliyun-approval.md` §2（依据 <https://help.aliyun.com/document_detail/2873145.html>，2026-08-20 更新）。
3. **短信模板**：类型选「**通知短信**」（非营销/推广）；变量名必须与代码 `templateParam` 的键**逐字一致**（现为 `device`、`address`；如需改动，改 `routes/aed.ts` 里 `sendSms(phone, {...})` 的键名，只此一处）。
4. **语音 TTS 模板**（`TtsCode`）→ 语音通知用。
5. **语音主叫模式**：**公共模式**（用公共号码池，**无需购买号码**）或**专属模式**（须已购号码，且模板的**外呼模式必须与之一致**）。
6. **开启短信状态报告 → HTTP 批量推送**，回调 URL 填 `https://<你的域名>/api/public/aliyun-sms-report`。

### 11.2 后端环境变量
```
ALIYUN_SMS_ACCESS_KEY_ID / ALIYUN_SMS_ACCESS_KEY_SECRET
ALIYUN_SMS_SIGN_NAME / ALIYUN_SMS_TEMPLATE_CODE / ALIYUN_SMS_REGION   # region 默认 cn-hangzhou
ALIYUN_SMS_REPORT_SECRET        # 回调验真；未配置则回调端点整体关闭（返 404）
ALIYUN_VOICE_TTS_CODE
ALIYUN_VOICE_CALLER_NUMBER      # 可留空 = 公共模式
ALIYUN_VOICE_DAILY_LIMIT        # 可选，默认 200
```
> **写入位置（务必按环境选对，见 §2.0）**：
> **生产 → 仓库根 `.env`**；**本机同构自测 → 仓库根 `.env.local`**；**本地裸跑后端 → `急救侠-server/.env`**。
> ⚠️ `NEXT_STEPS.md`「阿里云联调待办」第 5 条的旧写法（「写入 `急救侠-server/.env` **或** 根 `.env.local`」）
> **对生产是错的** —— 生产 compose 的 `env_file` 只读根 `.env`，写错文件时短信/语音会**静默失效**。

**任一 `ALIYUN_SMS_*` 缺失 ⇒ 短信功能整体关闭（不发起任何网络请求）**；语音同理（需 AK/SK + TTS code）。

### 11.3 逐项验收
| # | 操作 | 期望 |
|---|---|---|
| 1 | 让责任人**无推送订阅**，触发一次 `POST /api/aed/:id/notify-custodian` | 手机**收到短信**；`aed_sms_dispatches` 新增一行且 `biz_id` 非空；该 alert `delivery_state='sms_fallback'`、`status='sent'` |
| 2 | 等阿里云推送状态报告（通常数秒~数十秒） | 该行 `report_status` 被写入阿里云返回的 `err_code`（成功态如 `DELIVERED`） |
| 3 | 制造**送达失败**（如把 `ALIYUN_SMS_TEMPLATE_CODE` 临时配错，或用确实收不到短信的号码） | **收到语音呼叫**；该行 `voice_state='called'`、`voice_at_ms` 非空；`aedAudit` 出现 `custodian_voice_fallback` |
| 4 | **重推同一份状态报告**（控制台重试 / 手工重放） | **不再产生第二次呼叫**（幂等；`voice_state` 已是 `called`） |
| 5 | 请求回调端点时**不带**或**带错** `x-sms-report-secret`（含**长度不同**的错密钥） | **404**，且**无任何呼叫**；服务不崩 |
| 6 | `ALIYUN_VOICE_DAILY_LIMIT=1` 下推两条 FAIL | **只呼 1 次**（第 2 条走 `daily_cap`） |
| 7 | **清空**全部 `ALIYUN_*` 后重复 #1 | 行为与上线前一致（`no_subscription`/`unreachable` 不变），**零网络请求** |

### 11.4 计费与文案
- 短信**按 70 字/条**计费，超出按 **67 字/条拆分多条** ⇒ 模板文案须压在 70 字内（含签名）。
  示例模板正文（提审时**不写签名**，发送时系统自动加 `【】`；签名见 §11.1 第 2 条）：
  `${device}（${address}）被取用，请责任人尽快确认授权。`（正文字面 36 字，含签名合计 ≈41 字 → ≤70 ✓）。
  ⚠️ **文案纪律**：代码语义是责任人远程**确认授权**（MVP **不做物理开锁**）—— **切勿使用「开箱 / 开锁」字样**
  （会误导收信人以为能物理开门，且对模板审核亦无益）。与 `deliverables/software-company/aliyun-approval.md` §3 候选 A 口径一致，另有候选 B 见该文件。
- 语音按分钟、**不足 1 分钟按 1 分钟**计（**公共模式** ≈ 0.11 元/分钟，是短信的 ~2.4 倍）；**专属模式另有号码月租（约 35 元/个/月）**。

### 11.5 报错排查
以接口返回的 `Code` / `Message` 为准。常见成因：签名或模板**未审核通过**；模板**变量名与代码不一致**；语音模板的**外呼模式与主叫号模式不匹配**；AccessKey 权限不足（需 `dysms:SendSms`、`dyvms:SingleCallByTts`）；回调 URL 不可公网访问或被网关拦截。

## 12. 运维：阿里云签名「保活」巡检

### 12.1 背景：为什么需要「保活」

阿里云规定：**签名报备通过后，超过 6 个月无任何发送记录 ⇒ 报备状态变为「报备失效」且发送失败**，须**重新报备**后才能发送
（官方文档 <https://help.aliyun.com/document_detail/2873145.html>；本项目报备材料已收录该约束，见
`deliverables/software-company/aliyun-approval.md` **§8.6**）。

本项目的 AED 取用 / 降级短信属**低频**业务 —— 一旦某段时间**无真实告警发送**，签名可能**静默失效**，
直到**下一次真实取用**才暴露（彼时已发不出短信）。因此把「巡检」**机制化**为一条可复跑命令：

- **零新增依赖 / 无新表 / 无新迁移 / 无新 HTTP 端点 / 无后台定时器**；
- `aed_sms_dispatches` **只读**（仅取最近发送时间）；保活记录写入既有 `app_meta`（迁移 037）；
- **零 PII**：输出绝不含完整手机号（一律 `maskPhone` 脱敏）；
- **绝不静默**：短信未配置时 `--send-test` 明确报错并**非零退出**。

### 12.2 命令与退出码

> 在 `急救侠-server/` 下运行。判定为**纯函数**（`src/scripts/keepalive-plan.ts`），CLI 为 `src/scripts/aliyun-keepalive.ts`。

```bash
# 巡检（默认模式）：打印最近发送时间 / 距今 / 剩余 / 等级 / 是否需动作 + 配置齐备性 + 语音日用量
npm run aliyun:keepalive -- --status

# 保活发送：发一条测试短信，成功后更新保活时间戳（app_meta）。必须显式传号（无默认值，防误发）
npm run aliyun:keepalive -- --send-test <11 位手机号>

# 销账：在「阿里云控制台」手工测试发送后回来登记（写保活时间戳并立刻复算；见下方 ⚠️）
npm run aliyun:keepalive -- --mark-sent
npm run aliyun:keepalive -- --mark-sent --at 2026-09-12T20:00:00Z   # 指定发送时刻（ISO8601）

# 自定义阈值（仅影响本次判定的分级，不改默认值）
npm run aliyun:keepalive -- --days 90

# 帮助
npx tsx src/scripts/aliyun-keepalive.ts --help
```

| 模式 | 退出码 | 含义 |
|---|---|---|
| `--status` | `0` | `ok` / `warn`（**无需人工动作**） |
| `--status` | `1` | `action_due`（**临近**阈值，需安排保活） |
| `--status` | `2` | `overdue`（已超期）/ `never_sent`（从未发送） |
| `--send-test` | `0` | 发送**已受理**（已写入保活时间戳） |
| `--send-test` | `2` | 用法错误 / **短信未配置** / 号码非法 |
| `--send-test` | `1` | 发送失败（凭阿里云返回的 `Code`/`Message` 排查，见 §11.5） |
| `--mark-sent` | `0` | 销账后**复算**为 `ok` / `warn`（**销账成功**的常见结果） |
| `--mark-sent` | `1` / `2` | 复算为 `action_due` / `overdue`·`never_sent`（**登记的时刻距现在仍偏旧**，请核对 `--at`）；用法错误 / `--at` 不可解析 → `2` |

> **退出码接 cron / CI**：`0` 视为达标；非 `0` 触发告警（如 `1` 提醒安排、`2` 立即处理）。这样「低频静默失效」被转成**可观测的失败**，而不是等症状出现。

> ⚠️ **`--mark-sent` 的定位 —— 「销账」，不是「检测」**：它把 `app_meta.aliyun_signature_last_sent_ms` 写为**指定时刻**（默认当前）并**立刻复算**分级。
> 存在的**唯一理由**：运维发现 `overdue` 后，**最自然的动作是去阿里云控制台点「测试发送」** —— 那一次发送**不经过本项目**，
> 因此 `aed_sms_dispatches` 无记录、`app_meta` 也不会自动更新 ⇒ 若不销账，巡检会**一直报 overdue**（明明修好了却永远报警）。
> **仅在确实已发送后使用；不得用它伪造记录掩盖问题。**（`--at` 不可解析时明确报错 `exit 2`，**绝不静默回落 now**。）

### 12.3 分级表与建议动作（默认阈值 180 天）

| 等级 | 触发条件（距上次发送天数 `d`） | 需人工动作 | 建议动作 |
|---|---|---|---|
| `never_sent` | 无任何发送记录（`d = null`） | ✅ | **尽快**发一次保活（`--send-test`）或触发一次真实链路；确认签名/模板可用。**若走阿里云控制台发送，发后必须回来 `--mark-sent` 销账** |
| `overdue` | `d ≥ 180` | ✅ | **已超期**：立即发保活；若发送失败 → 按 §8.6 重新报备（预留 5–10 工作日）。**发送后若走的是控制台，务必回来 `--mark-sent` 销账**，否则会**一直报 overdue** |
| `action_due` | `150 ≤ d < 180` | ✅ | 本周期内安排一次保活发送。**发送后若走的是控制台，务必回来 `--mark-sent` 销账** |
| `warn` | `120 ≤ d < 150` | ⛔ | 关注即可，下个巡检窗口留意（**不触发告警**，见 §12.4） |
| `ok` | `d < 120` | ⛔ | 无需动作 |

> 边界：**恰好 180 天即 `overdue`**；`d` 对**未来时间戳**防御性归零（时钟回拨不会产生负数）。分级边界有确定性单测覆盖（`src/__tests__/signature-keepalive.test.ts`，含 119/120/149/150/179/180/181 等）。

### 12.4 建议巡检频率

- **人工节奏**：**每季度**跑一次 `--status`（舒适地落在 180 天窗口内，留够余量）。若某季度有真实告警发送，`--status` 会显示 `d` 很小，无需额外保活。
- **自动化（可选，推荐）**：接入 **cron 或 CI 定时**，例如「每月 1 日 09:00」执行 `--status`，**非零退出即告警**：
  ```bash
  cd 急救侠-server && npm run aliyun:keepalive -- --status || echo "ALERT: 阿里云签名保活巡检未达标"
  ```
  ⚠️ 自动执行**只做 `--status` 巡检**；`--send-test` / `--mark-sent` **不要**放进无人值守的定时任务（前者产生真实计费与外呼且**必须显式传号**；后者是**人工销账动作**，自动化等于伪造发送记录）。

### 12.5 看板字段 `smsSignature`

`GET /api/admin/dashboard`（需平台管理员）响应新增只读字段 **`smsSignature`**，结构即上文 `KeepAliveStatus`：

```jsonc
{
  "smsSignature": {
    "lastSentAtMs": 1730000000000,   // null = 从未发送
    "daysSinceLastSent": 100,        // null = never_sent
    "daysRemaining": 80,             // 可为负
    "level": "ok",                   // never_sent | overdue | action_due | warn | ok
    "actionRequired": false
  }
  // …既有 6 个字段 + custodianReach 均**未改动**
}
```

> 取数同时看两处并取**较晚者**：`aed_sms_dispatches.created_at` 的 `MAX`（UTC 文本，经 `strftime('%s', …)` 转 ms，**与 `Date.now()` 同基准**）与 `app_meta.aliyun_signature_last_sent_ms`（`--send-test` 发送成功后、或 `--mark-sent` 销账时写入）；**两处皆空返回 `null`**（区别于「很久以前发送过」，不假报 0）。

### 12.6 ⚠️ 无法自动化的部分：资质 / 证件有效期

签名**保活**只覆盖「6 个月无发送」这一失效路径。**另有**「**资质/证件有效期过期 → 关联资质失效 → 签名失效**」路径
（官方明确控制台**不提供**证件过期主动通知，须**人工定期自查**，见 `aliyun-approval.md` **§8.8**）—— **本 CLI 覆盖不到，只能人工自查**：

- **自查路径**：阿里云短信控制台 → **资质管理** → 该资质「详情」→ 核对**营业执照有效期 / 管理员身份证有效期**；
- **节奏**：**每月**核对一次（比保活更频），**到期前**更新资质（更新后系统**自动重新报备**，又需 **5–7 工作日**，请预留）；
- 建议把该自查项**并入 §12.4 的季度巡检清单**，与 `--status` 一并执行（一个命令管签名保活，一个人工动作管证件有效期）。



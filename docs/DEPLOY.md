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

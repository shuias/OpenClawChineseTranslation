<a id="top"></a>

# Docker 部署指南

<p align="center">
  <a href="../README.md">首页</a> ·
  <a href="INSTALL_GUIDE.md">安装指南</a> ·
  <b>Docker 部署</b> ·
  <a href="FAQ.md">常见问题</a> ·
  <a href="CONTRIBUTING.md">贡献指南</a> ·
  <a href="TRANSLATION_GUIDE.md">翻译规范</a>
</p>

本文档详细介绍如何使用 Docker 部署 OpenClaw 汉化版。

---

<a id="toc"></a>
## 目录

- [一键部署脚本（推荐）](#quick-deploy)
- [镜像地址](#images)
- [本地快速启动](#local-start)
- [服务器远程部署](#remote-deploy)
- [远程访问与 Token 认证](#remote-access)
- [Nginx + HTTPS 反向代理](#nginx-https)
- [Docker Compose](#docker-compose)
- [自行构建镜像](#build-image)
- [常用命令](#commands)
- [空间清理](#cleanup)
- [常见错误排查](#troubleshoot)
- [更新 Docker 镜像](#update-image)

---

<a id="quick-deploy"></a>
## 一键部署脚本（推荐）

自动完成初始化、配置远程访问、启动容器：

```bash
# Linux / macOS
curl -fsSL https://cdn.jsdelivr.net/gh/1186258278/OpenClawChineseTranslation@main/docker-deploy.sh | bash

# Windows PowerShell
irm https://cdn.jsdelivr.net/gh/1186258278/OpenClawChineseTranslation@main/docker-deploy.ps1 | iex
```

<p align="right"><a href="#top">回到顶部</a></p>

---

<a id="images"></a>
## 镜像地址

| 镜像源 | 地址 | 适用场景 |
|--------|------|----------|
| **Docker Hub** | `1186258278/openclaw-zh` | **国内用户推荐**，速度快 |
| **ghcr.io** | `ghcr.io/1186258278/openclaw-zh` | 海外用户 / 默认 |

> 以下命令默认使用 ghcr.io 地址。**国内用户**将 `ghcr.io/1186258278/openclaw-zh` 替换为 `1186258278/openclaw-zh` 即可加速。

<p align="right"><a href="#top">回到顶部</a></p>

---

<a id="local-start"></a>
## 本地快速启动

适用于在本机运行并通过 `localhost` 访问：

```bash
# 镜像地址（国内用户推荐使用 Docker Hub 加速）
# 海外: ghcr.io/1186258278/openclaw-zh:latest
# 国内: 1186258278/openclaw-zh:latest
IMAGE=ghcr.io/1186258278/openclaw-zh:latest

# 1. 初始化配置（首次运行，需要交互式配置 AI 模型和 API 密钥）

# Linux/macOS:
docker run --rm -it -v openclaw-data:/root/.openclaw \
  $IMAGE openclaw onboard

# Windows (PowerShell):
docker run --rm -it -v openclaw-data:/root/.openclaw `
  $IMAGE openclaw onboard

# 2. 配置网关模式（本地访问）

# Linux/macOS:
docker run --rm -v openclaw-data:/root/.openclaw \
  $IMAGE openclaw config set gateway.mode local

# Windows (PowerShell):
docker run --rm -v openclaw-data:/root/.openclaw `
  $IMAGE openclaw config set gateway.mode local

# 3. 启动容器（守护进程模式，容器会一直运行）

# Linux/macOS:
docker run -d \
  --name openclaw \
  -p 18789:18789 \
  -v openclaw-data:/root/.openclaw \
  --restart unless-stopped \
  $IMAGE \
  openclaw gateway run

# Windows (PowerShell):
docker run -d --name openclaw -p 18789:18789 -v openclaw-data:/root/.openclaw --restart unless-stopped $IMAGE openclaw gateway run
```

访问：`http://localhost:18789`

<p align="right"><a href="#top">回到顶部</a></p>

---

<a id="remote-deploy"></a>
## 服务器远程部署

部署到服务器并从其他设备访问时，需要额外配置：

```bash
# 镜像地址（国内服务器推荐 Docker Hub）
# 海外: ghcr.io/1186258278/openclaw-zh:latest
# 国内: 1186258278/openclaw-zh:latest
IMAGE=ghcr.io/1186258278/openclaw-zh:latest

# 1. 创建数据卷
docker volume create openclaw-data

# 2. 初始化配置（首次运行，需要交互式配置 AI 模型和 API 密钥）

# Linux/macOS:
docker run --rm -it -v openclaw-data:/root/.openclaw \
  $IMAGE openclaw onboard

# Windows (PowerShell):
docker run --rm -it -v openclaw-data:/root/.openclaw `
  $IMAGE openclaw onboard

# 3. 配置远程访问参数

# Linux/macOS:
docker run --rm -v openclaw-data:/root/.openclaw \
  $IMAGE openclaw config set gateway.mode local
docker run --rm -v openclaw-data:/root/.openclaw \
  $IMAGE openclaw config set gateway.bind lan

# Windows (PowerShell):
docker run --rm -v openclaw-data:/root/.openclaw `
  $IMAGE openclaw config set gateway.mode local
docker run --rm -v openclaw-data:/root/.openclaw `
  $IMAGE openclaw config set gateway.bind lan

# 4. 设置访问令牌（推荐）

# Linux/macOS:
docker run --rm -v openclaw-data:/root/.openclaw \
  $IMAGE openclaw config set gateway.auth.token your-secure-token

# Windows (PowerShell):
docker run --rm -v openclaw-data:/root/.openclaw `
  $IMAGE openclaw config set gateway.auth.token your-secure-token

# 5. 启动容器（守护进程模式，容器会一直运行）

# Linux/macOS:
docker run -d \
  --name openclaw \
  -p 18789:18789 \
  -v openclaw-data:/root/.openclaw \
  --restart unless-stopped \
  $IMAGE \
  openclaw gateway run

# Windows (PowerShell):
docker run -d --name openclaw -p 18789:18789 -v openclaw-data:/root/.openclaw --restart unless-stopped $IMAGE openclaw gateway run
```

访问：`http://服务器IP:18789` → 在 Dashboard 输入 token 连接

<p align="right"><a href="#top">回到顶部</a></p>

---

<a id="remote-access"></a>
## 远程访问与 Token 认证

通过 HTTP 从非 localhost 访问时，浏览器会阻止设备身份验证（Web Crypto API 需要 secure context）。

**推荐解决方案：设置 Token 认证**

```bash
# 1. 设置访问令牌
docker exec openclaw openclaw config set gateway.auth.token YOUR_TOKEN
docker restart openclaw

# 2. 在浏览器访问远程地址
http://服务器IP:18789/overview

# 3. 在「网关令牌」输入框填入 YOUR_TOKEN，点击「连接」
```

> 设置 `gateway.auth.token` 后，即使通过远程 HTTP 访问，只要在 Dashboard 输入正确的 token 就能连接成功。

**其他解决方案对比：**

| 方案 | 说明 | 适用场景 |
|------|------|----------|
| **设置 Token** | 设置 `gateway.auth.token`，Dashboard 输入 token | 内网（最简单） |
| **SSH 端口转发** | `ssh -L 18789:127.0.0.1:18789 user@server` | 更安全 |
| **Tailscale Serve** | 自动 HTTPS 访问 | 跨网络访问 |
| **Nginx + HTTPS** | 配置 SSL 证书反向代理 | 生产环境 |

<p align="right"><a href="#top">回到顶部</a></p>

---

## Nginx + HTTPS 反向代理

如果使用 Nginx 等反向代理，需要额外配置 `gateway.trustedProxies`，否则会提示 `Proxy headers detected from untrusted address`。

**1. 配置 OpenClaw 信任代理地址**

```bash
# Docker 环境
docker exec openclaw openclaw config set gateway.trustedProxies '["127.0.0.1", "::1"]'
docker restart openclaw

# npm 安装环境
openclaw config set gateway.trustedProxies '["127.0.0.1", "::1"]'
openclaw gateway restart
```

> 如果 Nginx 和 OpenClaw 在不同服务器，将 `127.0.0.1` 替换为 Nginx 服务器的 IP 地址。

**2. Nginx 配置示例**

```nginx
# /etc/nginx/sites-available/openclaw
server {
    listen 443 ssl http2;
    server_name oc.example.com;
    
    # SSL 证书配置（推荐使用 Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/oc.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/oc.example.com/privkey.pem;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    location / {
        proxy_pass http://127.0.0.1:18789;
        proxy_http_version 1.1;
        
        # WebSocket 支持（必须）
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 转发真实客户端信息
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时配置
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name oc.example.com;
    return 301 https://$server_name$request_uri;
}
```

**3. 启用配置**

```bash
sudo ln -s /etc/nginx/sites-available/openclaw /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

<p align="right"><a href="#top">回到顶部</a></p>

---

## Docker Compose

项目提供了开箱即用的 `docker-compose.yml`：

```bash
# 下载配置文件
curl -fsSL https://cdn.jsdelivr.net/gh/1186258278/OpenClawChineseTranslation@main/docker-compose.yml -o docker-compose.yml

# 启动（首次会自动初始化）
docker-compose up -d
```

或手动创建 `docker-compose.yml`：

```yaml
version: '3.8'
services:
  openclaw:
    # 国内用户可替换为: 1186258278/openclaw-zh:latest
    image: ghcr.io/1186258278/openclaw-zh:latest
    container_name: openclaw
    ports:
      - "18789:18789"
    volumes:
      - openclaw-data:/root/.openclaw
    environment:
      - OPENCLAW_GATEWAY_TOKEN=your-secure-token
    restart: unless-stopped

volumes:
  openclaw-data:
```

<p align="right"><a href="#top">回到顶部</a></p>

---

<a id="build-image"></a>
## 自行构建镜像

本仓库不包含 OpenClaw 应用源码，只保存汉化规则（`translations/`）和构建脚本。[Dockerfile](../Dockerfile) 也不编译源码：它只安装 `openclaw-runtime.tgz`（`npm pack` 生成的已汉化运行时），且 [.dockerignore](../.dockerignore) 用 `**` 屏蔽了其它所有文件。

所以本地构建的正确顺序是：**先在本仓库根目录的 `openclaw/` 里完成“汉化 → 上游构建 → 打包”，再把 tgz 交给 Docker**。

### 方式 A：复用已发布的 npm 运行时（不克隆上游，推荐）

npm 上的 `@qingchencloud/openclaw-zh` 已是汉化并构建完成的运行时，可直接作为 Docker 输入。适合重建镜像、不改翻译的场景：

```bash
cd OpenClawChineseTranslation

# 1. 拉取与 package.json 同版本的运行时包
VERSION=$(node -p 'require("./package.json").version')
mkdir -p docker-context
npm pack "@qingchencloud/openclaw-zh@$VERSION" --ignore-scripts --pack-destination docker-context
mv docker-context/qingchencloud-openclaw-zh-*.tgz docker-context/openclaw-runtime.tgz

# 2. 组装构建上下文：只允许 tgz + Dockerfile + .dockerignore
cp Dockerfile .dockerignore docker-context/

# 3. 构建并验证（smoke 会真实启动 gateway 并检查 healthz / control-ui）
docker build -t openclaw-zh:local docker-context
bash scripts/smoke-docker.sh openclaw-zh:local "$VERSION"
```

> `--ignore-scripts` 只能用在 `npm pack` 上。Dockerfile 内的 `npm install` 必须执行安装脚本，否则 `tree-sitter-bash`、`koffi` 等原生依赖装不上。

### 方式 B：从上游源码完整构建（需要自定义翻译）

汉化规则命中的是上游 `src/` 下的源码文件，因此汉化必须发生在编译之前：

```bash
# 1. 克隆汉化项目，并在其根目录克隆上游源码（目录名必须是 openclaw）
git clone https://github.com/1186258278/OpenClawChineseTranslation.git
cd OpenClawChineseTranslation
git clone --depth 1 --branch v2026.10.7 \
  https://github.com/openclaw/openclaw.git openclaw   # nightly 则克隆 main 分支

# 2. 应用汉化（规则作用于源码）
npm run cli -- apply

# 3. 安装依赖并构建上游（完整子步骤见 .github/workflows/build-core.yml）
cd openclaw
pnpm install --no-frozen-lockfile
pnpm canvas:a2ui:bundle
if [ -f scripts/tsdown-build.mts ]; then node --import tsx scripts/tsdown-build.mts; else node scripts/tsdown-build.mjs; fi
node scripts/runtime-postbuild.mjs
pnpm ui:build
cd ..
# 上游若新增了 build-stamp / plugins:assets:* / write-build-info 等脚本，
# 需按 build-core.yml 的顺序一并执行；直接跑上游 pnpm build 常因上游类型错误中断。

# 4. 注入功能面板（作用于 dist/control-ui 产物，必须在 ui:build 之后）
python3 scripts/inject_panel.py

# 5. 改写发布清单：包名改为 @qingchencloud/openclaw-zh，
#    并把 workspace:* 依赖固定为 npm 可安装的版本
node scripts/prepare-publish-package.mjs \
  openclaw/package.json 2026.10.7-zh.1 2026.10.7 stable

# 6. 同步 dist/ 中的 self-reference，否则运行时报 Cannot find package 'openclaw'
find openclaw/dist -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \) -print0 | \
  xargs -0 sed -i -E 's#(from |import |import\(|require\()"openclaw(["/])#\1"@qingchencloud/openclaw-zh\2#g'

# 7. 打包独立运行时（在拷贝/传产物之前执行，保留软链接与权限）
mkdir -p docker-context
(cd openclaw && npm pack --ignore-scripts --pack-destination ../docker-context)
mv docker-context/qingchencloud-openclaw-zh-*.tgz docker-context/openclaw-runtime.tgz

# 8. 组装构建上下文并构建镜像
cp Dockerfile .dockerignore docker-context/
docker build -t openclaw-zh:local docker-context
bash scripts/smoke-docker.sh openclaw-zh:local 2026.10.7-zh.1

# 9. 运行
docker run -d --name openclaw -p 127.0.0.1:18789:18789 \
  -e OPENCLAW_GATEWAY_TOKEN="$(openssl rand -hex 32)" \
  -v openclaw-data:/root/.openclaw openclaw-zh:local
```

> 不要 `cd openclaw && docker build .`：那样会命中上游自带的 Dockerfile，跳过 pack 产物路径、包名改写和功能面板注入。版本号需满足稳定版校验 `<上游版本>-zh.<序号>`。

### 方式 A 的自动化：每天检查上游更新并重建

[scripts/docker-autobuild.sh](../scripts/docker-autobuild.sh) 把方式 A 做成可重复执行的定时任务：查询 npm 上 `@qingchencloud/openclaw-zh` 的 `latest`（或 `nightly`）发行版本，与 `docker-image/.built-version` 比对；只有版本变化才重新下载运行时包、构建镜像，并把镜像导出到 `docker-image/openclaw-zh-<版本>.tar.gz`（默认保留最近 3 个）。

```bash
# 手动跑一次（无更新时会直接跳过）
NPM_MIRROR=https://registry.npmmirror.com \
APT_MIRROR=http://mirrors.tuna.tsinghua.edu.cn \
bash scripts/docker-autobuild.sh

# 每天 06:00 触发（crontab 无权限时可用 systemd user timer）
mkdir -p ~/.config/systemd/user
# openclaw-zh-autobuild.service / openclaw-zh-autobuild.timer 见下
systemctl --user enable --now openclaw-zh-autobuild.timer
loginctl enable-linger "$USER"      # 未登录也触发
```

`openclaw-zh-autobuild.timer` 用 `OnCalendar=*-*-* 06:00:00` + `Persistent=true`（错过时间点会在开机后补跑），`openclaw-zh-autobuild.service` 为 `Type=oneshot`，`ExecStart=/usr/bin/env bash <repo>/scripts/docker-autobuild.sh`。日志：`journalctl --user -u openclaw-zh-autobuild.service`。

国内网络下建议带上两个换源变量（脚本只改 `docker-context/Dockerfile` 副本，不动仓库里的 [Dockerfile](../Dockerfile)）：`NPM_MIRROR` 让镜像内 `npm install` 走 npm 镜像站，`APT_MIRROR` 让 apt 走 Debian 镜像站。官方源限速时，构建会卡在 `apt-get install` 或 `npm install` 数十分钟。

### 本地构建常见错误

| 现象 | 原因 |
|------|------|
| `EUNSUPPORTEDPROTOCOL` | 漏了第 5 步，`package.json` 里仍有 `workspace:*` 依赖 |
| `Cannot find package 'openclaw'` | 漏了第 6 步 dist 内的 self-reference 替换 |
| Dashboard 没有汉化功能面板 | 第 4 步在 `ui:build` 之前执行了 |
| 容器内原生模块报错 / `node-gyp-build: not found` | 安装时加了 `--ignore-scripts`，或把 `node_modules` 直接 COPY 进了镜像 |

本地只能构建当前机器架构的镜像；发布用的 amd64 + arm64 双架构镜像由 [docker-publish.yml](../.github/workflows/docker-publish.yml) 在两种架构上分别构建并验证。

<p align="right"><a href="#top">回到顶部</a></p>

---

## 常用命令

```bash
# 查看日志
docker logs -f openclaw

# 停止/重启容器
docker stop openclaw
docker restart openclaw

# 进入容器
docker exec -it openclaw sh

# 删除容器
docker stop openclaw && docker rm openclaw

# 查看配置
docker exec openclaw openclaw config get gateway

# 在容器内执行 OpenClaw 命令
docker exec openclaw openclaw --help
docker exec openclaw openclaw status
```

<p align="right"><a href="#top">回到顶部</a></p>

---

## 空间清理

Docker 镜像和容器会占用大量磁盘空间（OpenClaw 镜像约 4GB），建议定期清理：

```bash
# 查看 Docker 空间占用
docker system df

# 清理已停止的容器
docker container prune -f

# 清理未使用的镜像
docker image prune -f

# 清理构建缓存
docker builder prune -f

# 一键清理所有未使用资源（镜像、容器、网络、缓存）
docker system prune -a

# 连同未使用的数据卷一起清理（会删除数据，谨慎使用）
docker system prune -a --volumes
```

<p align="right"><a href="#top">回到顶部</a></p>

---

## 常见错误排查

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `Gateway auth is set to token, but no token is configured` | 需要 token 认证但未配置 | `docker exec openclaw openclaw config set gateway.auth.token YOUR_TOKEN` |
| `Missing config. Run openclaw setup` | 未初始化配置 | `docker exec openclaw openclaw setup` |
| `control ui requires HTTPS or localhost` | HTTP 远程访问被浏览器安全策略阻止 | 使用 Token 认证或配置 HTTPS 反向代理 |
| `Proxy headers detected from untrusted address` | 反向代理地址未添加到信任列表 | `docker exec openclaw openclaw config set gateway.trustedProxies '["127.0.0.1"]'` |
| `pairing required` | 新设备需要配对授权 | `docker exec openclaw openclaw devices list` 然后 `devices approve <id>` |
| `gateway token mismatch` | Token 认证失败 | `docker exec openclaw openclaw dashboard --print-url` 获取带 token 的 URL |
| 容器启动后立即退出 | 缺少必要配置 | `docker logs openclaw` 查看日志 |
| `EACCES: permission denied` | 数据卷权限问题 | 确保使用 named volume 而非 bind mount |
| Docker 拉取镜像提示 denied | 登录缓存问题 | `docker logout ghcr.io` 后重试 |

<p align="right"><a href="#top">回到顶部</a></p>

---

## 更新 Docker 镜像

```bash
# 镜像地址（国内用户推荐 Docker Hub）
# 海外: ghcr.io/1186258278/openclaw-zh:latest
# 国内: 1186258278/openclaw-zh:latest
IMAGE=ghcr.io/1186258278/openclaw-zh:latest

# 1. 拉取最新镜像
docker pull $IMAGE

# 2. 停止并删除旧容器
docker stop openclaw && docker rm openclaw

# 3. 用新镜像启动（配置自动保留，存储在数据卷中）
docker run -d --name openclaw -p 18789:18789 \
  -v openclaw-data:/root/.openclaw \
  --restart unless-stopped \
  $IMAGE \
  openclaw gateway run
```

<p align="right"><a href="#top">回到顶部</a></p>

---

> 返回 [README](../README.md)

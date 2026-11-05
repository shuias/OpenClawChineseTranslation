#!/usr/bin/env bash
# ============================================================
# 从源码构建本地 Docker 镜像（Node 26 + 完整插件系统）
#
# 与 docker-autobuild.sh（npm 包方式）的区别：
#   - 构建上下文是 openclaw/ 完整源码树（含 pnpm-workspace.yaml / extensions / patches）
#   - 运行时是上游官方布局（非 root node 用户，配置在 /home/node/.openclaw）
#   - 插件系统可用：可从 npm / 路径 / ClawHub 安装插件
#
# 前置条件：
#   - openclaw/ 已同步到目标版本，且已执行 `node cli/index.mjs apply` 应用汉化
#   - 本地已有 node:26.12.1-bookworm / -slim / oven/bun:1.4.2 镜像
#
# 用法：
#   scripts/docker-build-from-source.sh                  # 用 openclaw/ 当前版本
#   VERSION=2026.10.9 scripts/docker-build-from-source.sh
#
# 可覆盖项：
#   VERSION        镜像版本号（默认取 openclaw/package.json）
#   OUT_DIR        tar 输出目录（默认 <repo>/docker-image）
#   BUILD_NETWORK  构建网络（默认 host，便于容器内走宿主机代理）
#   HTTP_PROXY / HTTPS_PROXY  容器内代理（默认取同名环境变量）
#   NO_CACHE=1     禁用构建缓存
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/openclaw"
CTX_DIR="$REPO_ROOT/docker-context-src"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/docker-image}"
BUILD_NETWORK="${BUILD_NETWORK:-host}"

log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }

[ -d "$SRC_DIR" ] || { log "缺少源码目录 $SRC_DIR（先克隆上游并应用汉化）"; exit 1; }
[ -f "$SRC_DIR/package.json" ] || { log "$SRC_DIR/package.json 不存在"; exit 1; }

VERSION="${VERSION:-$(node -p "require('$SRC_DIR/package.json').version" 2>/dev/null || true)}"
[ -n "$VERSION" ] || { log "无法确定版本号，请用 VERSION= 指定"; exit 1; }

# 汉化校验：源码里应有中文翻译，否则说明 apply 没跑
if ! grep -rlq '历史会话' "$SRC_DIR/src" --include='*.ts' 2>/dev/null; then
  log "警告：源码中未检测到汉化文本，镜像将是英文原版（先执行 node cli/index.mjs apply）"
fi

log "构建上下文 $CTX_DIR（源码 $VERSION）"
rm -rf "$CTX_DIR"
mkdir -p "$CTX_DIR"
rsync -a \
  --exclude=node_modules --exclude=dist --exclude=.git --exclude=.artifacts \
  --exclude=dist-runtime --exclude='*.map' --exclude='*.tsbuildinfo' \
  --exclude='apps/macos/.build' --exclude='apps/ios/build' --exclude='*.trace' \
  "$SRC_DIR"/ "$CTX_DIR"/
cp "$REPO_ROOT/Dockerfile.source" "$CTX_DIR/Dockerfile"
# 构建上下文需要汉化面板资源与注入脚本（Dockerfile.source 的注入步骤会用到）
mkdir -p "$CTX_DIR/translations" "$CTX_DIR/scripts"
cp -R "$REPO_ROOT/translations/panel" "$CTX_DIR/translations/panel"
cp "$REPO_ROOT/scripts/inject_panel.py" "$CTX_DIR/scripts/inject_panel.py"

mkdir -p "$OUT_DIR"
log "docker build openclaw-zh:$VERSION（Node 26 源码构建）"
build_args=()
[ -n "${HTTP_PROXY:-}" ] && build_args+=(--build-arg "HTTP_PROXY=$HTTP_PROXY")
[ -n "${HTTPS_PROXY:-}" ] && build_args+=(--build-arg "HTTPS_PROXY=$HTTPS_PROXY")
build_args+=(--build-arg "OPENCLAW_DOCKER_BUILD_VERSION=$VERSION")
[ "${NO_CACHE:-0}" = "1" ] && build_args+=(--no-cache)

docker build --pull=false --network="$BUILD_NETWORK" --progress=plain \
  "${build_args[@]}" \
  -t "openclaw-zh:$VERSION" -t "openclaw-zh:local" \
  -f "$CTX_DIR/Dockerfile" "$CTX_DIR"

log "导出镜像到 $OUT_DIR/openclaw-zh-$VERSION.tar.gz"
docker save "openclaw-zh:$VERSION" | gzip > "$OUT_DIR/openclaw-zh-$VERSION.tar.gz"
printf '%s\n' "$VERSION" > "$OUT_DIR/.built-version"

log "完成：$VERSION（$(du -h "$OUT_DIR/openclaw-zh-$VERSION.tar.gz" | cut -f1)）"
log "注意：该镜像以非 root node 用户运行，数据卷应挂载到 /home/node/.openclaw"

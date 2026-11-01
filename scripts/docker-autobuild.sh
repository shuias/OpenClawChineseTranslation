#!/usr/bin/env bash
# ============================================================
# 每日自动构建本地 Docker 镜像（docs/DOCKER_GUIDE.md 方式 A）
#
# 只在 npm 上 @qingchencloud/openclaw-zh 的发行版本变化时才重建，
# 也就是上游 OpenClaw 有更新并且汉化项目已发布新镜像时才会动作。
# 构建完成后把镜像 docker save 到 docker-image/ 下。
#
# 可覆盖项：
#   NPM_REGISTRY          npm registry（默认 https://registry.npmjs.org）
#   DIST_TAG              发行通道：latest（默认）或 nightly
#   OPENCLAW_ZH_IMAGE_DIR 镜像 tar 输出目录（默认 <repo>/docker-image）
#   NPM_MIRROR            给镜像内 npm install 换源（默认空＝用官方 registry）
#   APT_MIRROR            给镜像内 apt 换源，如 http://mirrors.tuna.tsinghua.edu.cn
#   SKIP_SMOKE=1          跳过 smoke 验证（本机没有 node 时会自动跳过）
#   KEEP_IMAGES           保留最近几个 tar（默认 3，0 表示不清理）
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG="@qingchencloud/openclaw-zh"
REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org}"
DIST_TAG="${DIST_TAG:-latest}"
PKG_ENC="$(printf '%s' "$PKG" | sed 's#/#%2F#')"
OUT_DIR="${OPENCLAW_ZH_IMAGE_DIR:-$REPO_ROOT/docker-image}"
CTX_DIR="$REPO_ROOT/docker-context"
STATE_FILE="$OUT_DIR/.built-version"
KEEP_IMAGES="${KEEP_IMAGES:-3}"
NPM_MIRROR="${NPM_MIRROR:-}"
APT_MIRROR="${APT_MIRROR:-}"

log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }

latest_version() {
  curl -fsSL --connect-timeout 20 "$REGISTRY/-/package/$PKG_ENC/dist-tags" |
    tr ',' '\n' | grep -o "\"$DIST_TAG\":\"[^\"]*\"" | head -1 | cut -d'"' -f4
}

download_tarball() {
  local version="$1" dest="$2" meta tarball integrity attempt ok=0
  meta="$(curl -fsSL --connect-timeout 20 "$REGISTRY/$PKG_ENC/$version")"
  tarball="$(printf '%s' "$meta" | tr ',' '\n' | grep -o '"tarball":"[^"]*"' | cut -d'"' -f4)"
  integrity="$(printf '%s' "$meta" | tr ',' '\n' | grep -o '"integrity":"[^"]*"' | cut -d'"' -f4)"
  [ -n "$tarball" ] || { log "拿不到 tarball 地址"; return 1; }

  # 上下文里已有完整性正确的包就不再重复下载（官方 registry 限速时很重要）
  if [ -s "$dest" ] && verify_integrity "$dest" "$integrity"; then
    log "运行时包已存在且校验通过：$(basename "$dest")"
    return 0
  fi
  rm -f "$dest"

  for attempt in 1 2 3 4 5 6 7 8; do
    # registry 可能限速，用断点续传补齐
    curl -fSL -C - --connect-timeout 20 -o "$dest" "$tarball" 2>/dev/null || true
    if verify_integrity "$dest" "$integrity"; then ok=1; break; fi
    log "tarball 校验未通过或下载不完整，续传 ($attempt/8)"
    sleep 5
  done
  [ "$ok" = 1 ] || { log "tarball 下载失败：$tarball"; return 1; }
}

verify_integrity() {
  local file="$1" integrity="$2"
  if [ ! -f "$file" ] || [ ! -s "$file" ]; then return 1; fi
  if ! command -v python3 >/dev/null 2>&1; then
    log "警告：缺少 python3，跳过完整性校验"
    return 0
  fi
  if [ -z "$integrity" ]; then return 0; fi
  python3 - "$file" "$integrity" <<'PY'
import base64, hashlib, sys

path, integrity = sys.argv[1], sys.argv[2]
algo, _, want = integrity.partition("-")
data = open(path, "rb").read()
got = base64.b64encode(getattr(hashlib, algo)(data).digest()).decode()
sys.exit(0 if got == want else 1)
PY
}

prune_old_archives() {
  [ "$KEEP_IMAGES" -gt 0 ] 2>/dev/null || return 0
  local -a files
  mapfile -t files < <(ls -1t "$OUT_DIR"/openclaw-zh-*.tar.gz 2>/dev/null || true)
  [ "${#files[@]}" -gt "$KEEP_IMAGES" ] || return 0
  local stale
  for stale in "${files[@]:$KEEP_IMAGES}"; do
    log "清理旧镜像包：$(basename "$stale")"
    rm -f "$stale"
  done
}

main() {
  local version current
  version="$(latest_version || true)"
  if [ -z "$version" ]; then
    log "查询 $PKG 的 $DIST_TAG 版本失败，跳过本次构建"
    return 1
  fi

  mkdir -p "$OUT_DIR" "$CTX_DIR"
  current="$(cat "$STATE_FILE" 2>/dev/null || echo '')"
  if [ "$current" = "$version" ] && [ -f "$OUT_DIR/openclaw-zh-$version.tar.gz" ]; then
    log "上游无更新（$version 已构建），跳过"
    return 0
  fi

  log "检测到新版本 $current -> $version，开始构建"
  download_tarball "$version" "$CTX_DIR/openclaw-runtime.tgz"

  # 构建上下文只允许 tgz + Dockerfile + .dockerignore（见 .dockerignore）
  cp "$REPO_ROOT/Dockerfile" "$REPO_ROOT/.dockerignore" "$CTX_DIR/"
  if [ -n "$NPM_MIRROR$APT_MIRROR" ]; then
    # 只对上下文里的副本生效：镜像内换源，官方 registry / deb.debian.org 限速时用
    awk -v npm_reg="$NPM_MIRROR" -v apt_mir="$APT_MIRROR" '
      { print }
      /^FROM / {
        if (apt_mir != "")
          print "RUN sed -i \"s#http://deb.debian.org#" apt_mir "#g\" /etc/apt/sources.list.d/debian.sources"
        if (npm_reg != "")
          print "RUN npm config set registry " npm_reg
      }' "$REPO_ROOT/Dockerfile" > "$CTX_DIR/Dockerfile"
    [ -z "$APT_MIRROR" ] || log "镜像内 apt 源 -> $APT_MIRROR"
    [ -z "$NPM_MIRROR" ] || log "镜像内 npm registry -> $NPM_MIRROR"
  fi

  log "docker build openclaw-zh:$version"
  docker build -t "openclaw-zh:$version" -t "openclaw-zh:local" "$CTX_DIR"

  if [ "${SKIP_SMOKE:-0}" != "1" ] && ! command -v node >/dev/null 2>&1; then
    log "本机没有 node，smoke 脚本无法运行，跳过（构建后用 docker run 自行验证）"
    SKIP_SMOKE=1
  fi
  if [ "${SKIP_SMOKE:-0}" != "1" ] && [ -f "$REPO_ROOT/scripts/smoke-docker.sh" ]; then
    log "smoke 验证"
    bash "$REPO_ROOT/scripts/smoke-docker.sh" "openclaw-zh:$version" "$version"
  fi

  log "导出镜像到 docker-image/openclaw-zh-$version.tar.gz"
  docker save "openclaw-zh:$version" | gzip > "$OUT_DIR/openclaw-zh-$version.tar.gz"

  printf '%s\n' "$version" > "$STATE_FILE"
  prune_old_archives
  log "完成：$version（$(du -h "$OUT_DIR/openclaw-zh-$version.tar.gz" | cut -f1)）"
}

main "$@"

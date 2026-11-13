<p align="center">
  <img src="https://github.com/QingChenCloud/OpenClawChineseTranslation/raw/main/assets/logo.png" alt="OpenClaw Chinese" width="120"/>
</p>

<h1 align="center">OpenClaw Chinese Edition</h1>

<p align="center">
  Full Chinese localization of OpenClaw, kept in sync with upstream.<br/>
  中文完整文档请见 <a href="README.md">README.md</a>。
</p>

<p align="center">
  <a href="#custom-features">Fork Customizations</a> ·
  <a href="#install">Installation</a> ·
  <a href="#docker">Docker</a> ·
  <a href="docs/DOCKER_GUIDE.md">Docker Guide</a>
</p>

---

<a id="custom-features"></a>

## Fork Customizations

> Beyond full translation, this repository ships the following customizations on top of upstream. All of them are included in the localized npm releases and source-built images.

### new-api Custom Model Provider (Control UI)

- The web console **Models → Providers** page gains a "new-api custom provider" wizard for connecting a new-api / OpenAI-compatible gateway with Base URL and API Key.
- **Auto model discovery**: click "Test connection & discover models" to fetch the model list from the provider's `/models` endpoint, then select and add models in one click.
- **Connectivity check**: models are probed automatically after saving; provider cards also have a "Test connection" button for on-demand re-checks.

### Per-Model Connectivity Probe

- For custom providers configured with **2 or more models**, "Test connection" probes every model individually and shows per-model status and latency (upstream probes a single representative model only).
- Probe requests use `max_tokens = 128`, compatible with reasoning models (e.g. Qwen3 series) that spend output tokens on thinking first.

### Plugin Version Compatibility with `-zh` Suffix

- Plugin host-version validation understands localized version numbers with the `-zh` suffix (e.g. `2026.10.9-zh.1`), so installing or updating official plugins no longer fails with a false "incompatible version" error.

### Local Image Build & Operations

- [Dockerfile.source](Dockerfile.source): builds a Node 26 runtime image from source, running as a non-root user.
- [scripts/docker-build-from-source.sh](scripts/docker-build-from-source.sh): one-click source build producing the `openclaw-zh:local` image.
- [scripts/docker-autobuild.sh](scripts/docker-autobuild.sh): daily automated local image build.
- [docker-compose.yml](docker-compose.yml) uses the locally built image by default; [mise.toml](mise.toml) pins the local Node version; [env.example](env.example) provides environment variable samples.
- Full workflows: [Docker guide](docs/DOCKER_GUIDE.md) and [local operations guide](docs/DOCKER_OPS_GUIDE.html).

<p align="right"><a href="#top">Back to top</a></p>

---

<a id="install"></a>

## Installation

```bash
# Stable release (recommended)
npm install -g @qingchencloud/openclaw-zh@latest --registry=https://registry.npmjs.org

# Nightly build (synced with upstream hourly)
npm install -g @qingchencloud/openclaw-zh@nightly --registry=https://registry.npmjs.org

# One-click setup script (Linux / macOS / WSL2)
curl -fsSL https://raw.githubusercontent.com/QingChenCloud/OpenClawChineseTranslation/main/install.sh | bash
```

Upgrade at any time:

```bash
npm install -g @qingchencloud/openclaw-zh@latest --registry=https://registry.npmjs.org
```

---

<a id="docker"></a>

## Docker

```bash
docker run -d --name openclaw \
  -e OPENCLAW_GATEWAY_TOKEN="<your-token>" \
  -p 127.0.0.1:18789:18789 \
  -v "$HOME/.openclaw:/home/openclaw/.openclaw" \
  -v "$HOME/openclaw-workspace:/home/openclaw/workspace" \
  --restart unless-stopped \
  1186258278/openclaw-zh:latest
```

- Build from this repository's source: `bash scripts/docker-build-from-source.sh` (produces `openclaw-zh:local`, non-root, Node 26 runtime).
- `docker compose up -d` uses the local image by default; set `OPENCLAW_IMAGE=1186258278/openclaw-zh:latest` to use the published image instead.
- See [docs/DOCKER_GUIDE.md](docs/DOCKER_GUIDE.md) for the full deployment workflow.

<p align="right"><a href="#top">Back to top</a></p>

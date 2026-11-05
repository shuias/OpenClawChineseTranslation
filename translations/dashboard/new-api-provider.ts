import { html, nothing, type TemplateResult } from "lit";

export type NewApiProviderMessage = {
  kind: "success" | "warning" | "error";
  text: string;
};

export type NewApiProviderDialogProps = {
  open: boolean;
  providerId: string;
  baseUrl: string;
  apiKey: string;
  models: string;
  busy: boolean;
  disabled: boolean;
  message: NewApiProviderMessage | null;
  discovering: boolean;
  discovered: string[] | null;
  discoverSelected: string[];
  onToggle: () => void;
  onProviderIdChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onModelsChange: (value: string) => void;
  onDiscover: () => void;
  onDiscoverToggle: (id: string) => void;
  onDiscoverSelectAll: (select: boolean) => void;
  onDiscoverApply: () => void;
  onSave: () => void;
};

const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** 把逗号/空格/换行分隔的模型 ID 解析成去重后的列表。 */
export function parseNewApiModelIds(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,，]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

export function isValidNewApiProviderId(value: string): boolean {
  return PROVIDER_ID_PATTERN.test(value);
}

function renderMessage(message: NewApiProviderMessage | null) {
  if (!message) {
    return nothing;
  }
  const className =
    message.kind === "error" ? "callout danger" : message.kind === "warning" ? "callout warning" : "callout";
  return html`<div class=${className} role="status">${message.text}</div>`;
}

function renderDiscoveredModels(props: NewApiProviderDialogProps) {
  if (props.discovered === null) {
    return nothing;
  }
  if (props.discovered.length === 0) {
    return nothing;
  }
  const selected = new Set(props.discoverSelected);
  const fieldsDisabled = props.disabled || props.busy || props.discovering;
  return html`
    <div
      style="border: 1px solid var(--border, #3a3d46); border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px;"
      data-new-api-discovered
    >
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        <span style="font-weight: 600;">发现 ${props.discovered.length} 个模型</span>
        <button
          type="button"
          class="btn btn--sm"
          ?disabled=${fieldsDisabled}
          @click=${() => props.onDiscoverSelectAll(true)}
        >全选</button>
        <button
          type="button"
          class="btn btn--sm"
          ?disabled=${fieldsDisabled}
          @click=${() => props.onDiscoverSelectAll(false)}
        >清空</button>
        <button
          type="button"
          class="btn btn--sm primary"
          ?disabled=${fieldsDisabled || selected.size === 0}
          @click=${props.onDiscoverApply}
        >添加选中的 ${selected.size} 个模型</button>
      </div>
      <div style="max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;">
        ${props.discovered.map(
          (id) => html`
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85em;">
              <input
                type="checkbox"
                .checked=${selected.has(id)}
                ?disabled=${fieldsDisabled}
                @change=${() => props.onDiscoverToggle(id)}
              />
              <code>${id}</code>
            </label>
          `,
        )}
      </div>
    </div>
  `;
}

export function renderNewApiProvider(
  props: NewApiProviderDialogProps,
): TemplateResult | typeof nothing {
  if (!props.open) {
    return nothing;
  }
  const modelIds = parseNewApiModelIds(props.models);
  const canSave =
    !props.disabled &&
    !props.busy &&
    isValidNewApiProviderId(props.providerId.trim()) &&
    /^https?:\/\//.test(props.baseUrl.trim()) &&
    props.apiKey.trim().length > 0 &&
    modelIds.length > 0;
  return html`
    <openclaw-modal-dialog
      label="添加自定义模型提供商"
      @modal-cancel=${(event: Event) => {
        event.preventDefault();
        if (!props.busy) {
          props.onToggle();
        }
      }}
    >
      <div class="model-setup-wizard" data-new-api-provider-dialog>
        <div class="model-setup-wizard__header">
          <h2>自定义模型提供商（OpenAI 兼容）</h2>
        </div>
        <div class="model-setup-wizard__body">
          <p>
            适用于 new-api、LiteLLM 等 OpenAI 兼容网关。保存后会写入
            <code>models.providers.&lt;ID&gt;</code>，然后可在「默认模型」中选择使用。
          </p>
          <label class="field">
            <span>提供商 ID</span>
            <input
              type="text"
              .value=${props.providerId}
              ?disabled=${props.disabled || props.busy}
              placeholder="new-api"
              @input=${(event: Event) =>
                props.onProviderIdChange((event.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <label class="field">
            <span>Base URL</span>
            <input
              type="url"
              .value=${props.baseUrl}
              ?disabled=${props.disabled || props.busy}
              placeholder="http://127.0.0.1:3000/v1"
              @input=${(event: Event) =>
                props.onBaseUrlChange((event.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <label class="field">
            <span>API Key</span>
            <input
              type="password"
              .value=${props.apiKey}
              ?disabled=${props.disabled || props.busy}
              placeholder="sk-..."
              @input=${(event: Event) =>
                props.onApiKeyChange((event.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button
              type="button"
              class="btn btn--sm"
              ?disabled=${props.disabled || props.busy || props.discovering || !/^https?:\/\//.test(props.baseUrl.trim())}
              @click=${props.onDiscover}
            >
              ${props.discovering ? "正在测试连接…" : "测试连接并查询模型"}
            </button>
            <span style="color: var(--muted, #8b8b94); font-size: 0.85em;">验证连通性并拉取可用模型列表</span>
          </div>
          ${renderDiscoveredModels(props)}
          <label class="field">
            <span>模型 ID（逗号或换行分隔）</span>
            <textarea
              rows="3"
              .value=${props.models}
              ?disabled=${props.disabled || props.busy}
              placeholder="gpt-4o, deepseek-chat"
              @input=${(event: Event) =>
                props.onModelsChange((event.currentTarget as HTMLTextAreaElement).value)}
            ></textarea>
          </label>
          ${renderMessage(props.message)}
        </div>
        <div class="model-setup-wizard__footer">
          <button class="btn" ?disabled=${props.busy} @click=${props.onToggle}>取消</button>
          <button class="btn primary" ?disabled=${!canSave} @click=${props.onSave}>
            ${props.busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </openclaw-modal-dialog>
  `;
}

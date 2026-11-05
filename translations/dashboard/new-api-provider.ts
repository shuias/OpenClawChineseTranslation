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
  onToggle: () => void;
  onProviderIdChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onModelsChange: (value: string) => void;
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

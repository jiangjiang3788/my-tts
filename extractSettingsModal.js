// extractSettingsModal.js
import { $ } from "./dom.js";
import {
  loadPersonaExtractSettings,
  savePersonaExtractSettings,
  resetPersonaExtractSettings,
  getPersonaKey
} from "./personaExtractSettings.js";

let $modal = null;

function ensureModal() {
  if ($modal?.length) return;

  // ⚠️ 注意：这里不能出现反引号字符 ` ，否则会把模板字符串截断导致报错
  $modal = $(`
    <div class="tts-extract-modal-backdrop" style="display:none;">
      <div class="tts-extract-modal" role="dialog" aria-modal="true">
        <div class="tts-extract-header">
          <div class="tts-extract-title">本人物：文本提取规则</div>
          <div class="tts-extract-close" role="button" tabindex="0">×</div>
        </div>

        <div class="tts-extract-body">
          <div class="tts-extract-row">
            <label>适用范围</label>
            <div class="tts-extract-hint">
              当前人物（persona/character）下所有对话共用。Key：<span id="tts_persona_key" style="opacity:.9;"></span>
            </div>
          </div>

          <div class="tts-extract-row">
            <label>模式</label>
            <select id="tts_extract_mode">
              <option value="inherit">标记提取（start/end；未命中回落）</option>
              <option value="full">朗读全文</option>
              <option value="marked">只朗读标记命中</option>
              <option value="regex">正则提取</option>
              <option value="smart">智能过滤（可跳过代码/引用）</option>
            </select>
          </div>

          <div class="tts-extract-row">
            <label>开始标记（start）</label>
            <input id="tts_extract_start" type="text" placeholder="例如：（ 或 【 或 &quot;" />
          </div>

          <div class="tts-extract-row">
            <label>结束标记（end）</label>
            <input id="tts_extract_end" type="text" placeholder="例如：） 或 】 或 &quot;" />
          </div>

          <div class="tts-extract-row">
            <label>正则（regex，支持 group1）</label>
            <input id="tts_extract_regex" type="text" placeholder="例如：\\[(.*?)\\]" />
            <div class="tts-extract-hint">提示：regex 模式下，会拼接所有命中；优先使用第 1 个捕获组。</div>
          </div>

          <div class="tts-extract-row">
            <label>未命中时</label>
            <select id="tts_extract_fallback">
              <option value="full">回落全文</option>
              <option value="empty">不朗读（空）</option>
            </select>
          </div>

          <div class="tts-extract-row tts-extract-inline">
            <label>
              <input type="checkbox" id="tts_extract_skip_code" />
              smart 模式：跳过 markdown 代码块
            </label>
          </div>

          <div class="tts-extract-row">
            <label>预览（粘贴一段文本看看会读什么）</label>
            <textarea id="tts_extract_preview_src" rows="4" placeholder="在这里粘贴文本..."></textarea>
            <div class="tts-extract-preview-label">将被朗读：</div>
            <div id="tts_extract_preview_out" class="tts-extract-preview-out"></div>
          </div>
        </div>

        <div class="tts-extract-footer">
          <button class="menu_button" id="tts_extract_reset">恢复默认（本人物）</button>
          <div style="flex:1;"></div>
          <button class="menu_button" id="tts_extract_cancel">取消</button>
          <button class="menu_button" id="tts_extract_save">保存</button>
        </div>
      </div>
    </div>
  `);

  $("body").append($modal);

  // 关闭
  $modal.on("click", ".tts-extract-close, #tts_extract_cancel", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });

  // 点背景关闭
  $modal.on("click", (e) => {
    if ($(e.target).is(".tts-extract-modal-backdrop")) closeModal();
  });

  // ESC 关闭
  $(document).on("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // 保存
  $modal.on("click", "#tts_extract_save", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const patch = {
      mode: ($("#tts_extract_mode").val() || "inherit").trim(),
      start: ($("#tts_extract_start").val() || "").trim(),
      end: ($("#tts_extract_end").val() || "").trim(),
      regex: ($("#tts_extract_regex").val() || "").trim(),
      fallback: ($("#tts_extract_fallback").val() || "full").trim(),
      skipCodeBlocks: $("#tts_extract_skip_code").prop("checked") === true
    };

    savePersonaExtractSettings(patch);
    toastr.success("已保存（本人物下所有对话生效）");
    closeModal();
  });

  // 重置
  $modal.on("click", "#tts_extract_reset", (e) => {
    e.preventDefault();
    e.stopPropagation();

    resetPersonaExtractSettings();
    toastr.info("已恢复默认（本人物）");
    fillForm(loadPersonaExtractSettings());
    refreshPreview();
  });

  // 任何输入变化 -> 更新预览
  $modal.on(
    "input change",
    "#tts_extract_mode, #tts_extract_start, #tts_extract_end, #tts_extract_regex, #tts_extract_fallback, #tts_extract_skip_code, #tts_extract_preview_src",
    () => refreshPreview()
  );
}

function fillForm(cfg) {
  $("#tts_extract_mode").val(cfg.mode || "inherit");
  $("#tts_extract_start").val(cfg.start ?? "");
  $("#tts_extract_end").val(cfg.end ?? "");
  $("#tts_extract_regex").val(cfg.regex ?? "");
  $("#tts_extract_fallback").val(cfg.fallback || "full");
  $("#tts_extract_skip_code").prop("checked", cfg.skipCodeBlocks === true);

  $("#tts_persona_key").text(getPersonaKey());
}

function closeModal() {
  if ($modal?.length) $modal.hide();
}

function extractPreview(src, cfg) {
  const text = String(src || "");
  const fallbackFull = (cfg.fallback || "full") === "full";
  if (!text.trim()) return "";

  if (cfg.mode === "full") return text;

  if (cfg.mode === "smart") {
    let t = text;
    if (cfg.skipCodeBlocks) t = t.replace(/```[\s\S]*?```/g, "").trim();
    t = t.replace(/^\s*>\s.*$/gm, "").trim();
    return t || (fallbackFull ? text : "");
  }

  if (cfg.mode === "regex") {
    if (!cfg.regex) return fallbackFull ? text : "";
    try {
      const re = new RegExp(cfg.regex, "g");
      const matches = [];
      let m;
      while ((m = re.exec(text)) !== null) {
        const v = (m[1] ?? m[0] ?? "").trim();
        if (v) matches.push(v);
        if (m.index === re.lastIndex) re.lastIndex++;
      }
      return matches.length ? matches.join(" ") : (fallbackFull ? text : "");
    } catch {
      return fallbackFull ? text : "";
    }
  }

  // inherit / marked
  const start = (cfg.start || "").trim();
  const end = (cfg.end || "").trim();
  if (!start || !end) return fallbackFull ? text : "";

  const quotePair = { "“": "”", "”": "“", "‘": "’", "’": "‘" };
  let finalEnd = end;
  if (start === end && quotePair[start]) finalEnd = quotePair[start];

  const parts = [];
  if (start === finalEnd) {
    let inside = false;
    let buf = "";
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === start) {
        if (!inside) {
          inside = true;
          buf = "";
        } else {
          if (buf.trim()) parts.push(buf.trim());
          inside = false;
          buf = "";
        }
      } else if (inside) {
        buf += ch;
      }
    }
  } else {
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`${esc(start)}(.*?)${esc(finalEnd)}`, "g");
    const matches = text.match(re);
    if (matches?.length) {
      for (const m of matches) {
        const clean = m.replace(start, "").replace(finalEnd, "").trim();
        if (clean) parts.push(clean);
      }
    }
  }

  if (parts.length) return parts.join(" ");
  return fallbackFull ? text : "";
}

function refreshPreview() {
  const cfg = {
    mode: ($("#tts_extract_mode").val() || "inherit").trim(),
    start: ($("#tts_extract_start").val() || "").trim(),
    end: ($("#tts_extract_end").val() || "").trim(),
    regex: ($("#tts_extract_regex").val() || "").trim(),
    fallback: ($("#tts_extract_fallback").val() || "full").trim(),
    skipCodeBlocks: $("#tts_extract_skip_code").prop("checked") === true
  };

  const src = $("#tts_extract_preview_src").val() || "";
  const out = extractPreview(src, cfg);
  $("#tts_extract_preview_out").text(out || "（空）");
}

export function openExtractSettingsModal() {
  ensureModal();
  const cfg = loadPersonaExtractSettings();
  $modal.show();
  fillForm(cfg);
  refreshPreview();
}

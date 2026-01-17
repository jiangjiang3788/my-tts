import { $ } from "./dom.js";
import { extensionName, TTS_MODELS } from "./constants.js";
import { extension_settings } from "./context.js";
import { log, logDebug, logError } from "./logger.js";
import { apiFetch } from "./api.js";

export function updateVoiceOptions() {
  const model = $("#tts_model").val();
  const voiceSelect = $("#tts_voice");
  const currentValue = voiceSelect.val();

  voiceSelect.empty();

  if (TTS_MODELS[model]?.voices) {
    voiceSelect.append('<optgroup label="预设音色">');
    Object.entries(TTS_MODELS[model].voices).forEach(([value, name]) => {
      voiceSelect.append(`<option value="${value}">${name}</option>`);
    });
    voiceSelect.append("</optgroup>");
  }

  const customVoices = extension_settings[extensionName].customVoices || [];
  log(`更新音色选项，自定义音色数量: ${customVoices.length}`);

  if (customVoices.length > 0) {
    voiceSelect.append('<optgroup label="自定义音色">');
    customVoices.forEach((voice) => {
      const voiceName = voice.name || voice.customName || voice.custom_name || "未命名";
      const voiceUri = voice.uri || voice.id || voice.voice_id;
      log(`添加自定义音色: ${voiceName} -> ${voiceUri}`);
      voiceSelect.append(`<option value="${voiceUri}">${voiceName} (自定义)</option>`);
    });
    voiceSelect.append("</optgroup>");
  }

  if (currentValue && voiceSelect.find(`option[value="${currentValue}"]`).length > 0) {
    voiceSelect.val(currentValue);
  } else {
    voiceSelect.val(extension_settings[extensionName].ttsVoice || Object.keys(TTS_MODELS[model]?.voices || {})[0]);
  }
}

export async function loadCustomVoices() {
  const apiKey = extension_settings[extensionName].apiKey;
  if (!apiKey) return;

  try {
    const { res, data } = await apiFetch("/audio/voice/list", {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    log("自定义音色列表:", data);
    extension_settings[extensionName].customVoices = data?.result || data?.results || [];

    if (extension_settings[extensionName].customVoices.length > 0) {
      logDebug("第一个自定义音色结构:", extension_settings[extensionName].customVoices[0]);
    }

    updateCustomVoicesList();
    updateVoiceOptions();
  } catch (error) {
    logError("Load Custom Voices Error:", error);
  }
}

export function updateCustomVoicesList() {
  const customVoices = extension_settings[extensionName].customVoices || [];
  const listContainer = $("#custom_voices_list");

  if (customVoices.length === 0) {
    listContainer.html("<small>暂无自定义音色</small>");
    return;
  }

  let html = "";
  customVoices.forEach((voice) => {
    const voiceName = voice.name || voice.customName || voice.custom_name || "未命名";
    const voiceUri = voice.uri || voice.id || voice.voice_id;
    html += `
      <div class="custom-voice-item" style="margin: 5px 0; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
        <span>${voiceName}</span>
        <button class="menu_button delete-voice" data-uri="${voiceUri}" data-name="${voiceName}" style="float: right; padding: 2px 8px; font-size: 12px;">删除</button>
      </div>
    `;
  });

  listContainer.html(html);
}

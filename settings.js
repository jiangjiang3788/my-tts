// settings.js
import { $ } from "./dom.js";
import { extensionName, defaultSettings } from "./constants.js";
import { extension_settings, saveSettingsDebounced } from "./context.js";
import { updateVoiceOptions } from "./voices.js";

export async function loadSettings() {
  extension_settings[extensionName] = extension_settings[extensionName] || {};

  if (Object.keys(extension_settings[extensionName]).length === 0) {
    Object.assign(extension_settings[extensionName], defaultSettings);
  } else {
    // ✅ 兼容老用户：补齐新增字段
    Object.assign(
      extension_settings[extensionName],
      { ...defaultSettings },
      extension_settings[extensionName]
    );
  }

  $("#siliconflow_api_key").val(extension_settings[extensionName].apiKey || "");
  $("#siliconflow_api_url").val(extension_settings[extensionName].apiUrl || defaultSettings.apiUrl);
  $("#tts_model").val(extension_settings[extensionName].ttsModel || defaultSettings.ttsModel);
  $("#tts_voice").val(extension_settings[extensionName].ttsVoice || defaultSettings.ttsVoice);

  $("#tts_speed").val(extension_settings[extensionName].ttsSpeed ?? defaultSettings.ttsSpeed);
  $("#tts_speed_value").text(extension_settings[extensionName].ttsSpeed ?? defaultSettings.ttsSpeed);

  $("#tts_gain").val(extension_settings[extensionName].ttsGain ?? defaultSettings.ttsGain);
  $("#tts_gain_value").text(extension_settings[extensionName].ttsGain ?? defaultSettings.ttsGain);

  $("#response_format").val(extension_settings[extensionName].responseFormat || defaultSettings.responseFormat);
  $("#sample_rate").val(extension_settings[extensionName].sampleRate || defaultSettings.sampleRate);

  $("#image_size").val(extension_settings[extensionName].imageSize || defaultSettings.imageSize);
  $("#image_text_start").val(extension_settings[extensionName].textStart ?? defaultSettings.textStart);
  $("#image_text_end").val(extension_settings[extensionName].textEnd ?? defaultSettings.textEnd);
  $("#generation_frequency").val(extension_settings[extensionName].generationFrequency ?? defaultSettings.generationFrequency);

  $("#auto_play_audio").prop("checked", extension_settings[extensionName].autoPlay !== false);
  $("#auto_play_user").prop("checked", extension_settings[extensionName].autoPlayUser === true);

  // ✅ GitHub 更新设置
  $("#github_repo").val(extension_settings[extensionName].githubRepo || "");
  $("#github_branch").val(extension_settings[extensionName].githubBranch || "main");
  $("#github_path").val(extension_settings[extensionName].githubPath || "");
  $("#auto_check_updates").prop("checked", extension_settings[extensionName].autoCheckUpdates === true);
  $("#update_check_interval").val(extension_settings[extensionName].updateCheckIntervalHours ?? 12);

  // 展示当前已安装 commit（如果有）
  const installed = extension_settings[extensionName].lastInstalledCommit || "";
  const remote = extension_settings[extensionName].lastRemoteCommit || "";
  if ($("#installed_commit").length) $("#installed_commit").text(installed ? installed.slice(0, 12) : "（未初始化）");
  if ($("#remote_commit").length) $("#remote_commit").text(remote ? remote.slice(0, 12) : "—");

  updateVoiceOptions();
}

export function saveSettings() {
  extension_settings[extensionName].apiKey = $("#siliconflow_api_key").val();
  extension_settings[extensionName].apiUrl = $("#siliconflow_api_url").val();
  extension_settings[extensionName].ttsModel = $("#tts_model").val();
  extension_settings[extensionName].ttsVoice = $("#tts_voice").val();

  extension_settings[extensionName].ttsSpeed = parseFloat($("#tts_speed").val());
  extension_settings[extensionName].ttsGain = parseFloat($("#tts_gain").val());

  extension_settings[extensionName].responseFormat = $("#response_format").val();
  extension_settings[extensionName].sampleRate = parseInt($("#sample_rate").val());

  extension_settings[extensionName].imageSize = $("#image_size").val();
  extension_settings[extensionName].textStart = $("#image_text_start").val();
  extension_settings[extensionName].textEnd = $("#image_text_end").val();
  extension_settings[extensionName].generationFrequency = parseInt($("#generation_frequency").val());

  extension_settings[extensionName].autoPlay = $("#auto_play_audio").prop("checked");
  extension_settings[extensionName].autoPlayUser = $("#auto_play_user").prop("checked");

  // ✅ GitHub 更新设置保存
  extension_settings[extensionName].githubRepo = ($("#github_repo").val() || "").trim();
  extension_settings[extensionName].githubBranch = ($("#github_branch").val() || "main").trim();
  extension_settings[extensionName].githubPath = ($("#github_path").val() || "").trim();
  extension_settings[extensionName].autoCheckUpdates = $("#auto_check_updates").prop("checked") === true;
  extension_settings[extensionName].updateCheckIntervalHours = parseInt($("#update_check_interval").val() || "12", 10);

  saveSettingsDebounced();
}

// ui.js
import { $ } from "./dom.js";
import { extensionName } from "./constants.js";
import { extension_settings, saveSettingsDebounced } from "./context.js";
import { log, logDebug, logWarn } from "./logger.js";
import { saveSettings } from "./settings.js";
import { updateVoiceOptions, loadCustomVoices } from "./voices.js";
import { uploadVoice, deleteCustomVoice } from "./voiceClone.js";
import { generateTTS } from "./tts.js";
import { testConnection } from "./utils_testConnection.js";

function probeUI() {
  const ids = [
    "#save_siliconflow_settings",
    "#test_siliconflow_connection",
    "#tts_model",
    "#tts_voice",
    "#tts_speed",
    "#tts_gain",
    "#auto_play_audio",
    "#auto_play_user",
    "#image_text_start",
    "#image_text_end",
    "#test_tts",
  ];

  const result = {};
  for (const id of ids) result[id] = $(id).length;
  return result;
}

export function initUI() {
  const probe = probeUI();
  log("initUI() called, probe:", probe);

  // 如果关键按钮都不存在，说明 settings DOM 根本没插入页面（云端最常见）
  const hasAny =
    probe["#save_siliconflow_settings"] ||
    probe["#test_siliconflow_connection"] ||
    probe["#tts_model"] ||
    probe["#tts_voice"];

  if (!hasAny) {
    logWarn("initUI() 未发现关键设置节点：可能 settings 面板未注入/未渲染。");
  }

  // Inline drawer 折叠/展开
  setTimeout(() => {
    $(".siliconflow-extension-settings .inline-drawer-toggle").each(function () {
      $(this)
        .off("click")
        .on("click", function (e) {
          e.preventDefault();
          e.stopPropagation();

          const $header = $(this);
          const $icon = $header.find(".inline-drawer-icon");
          const $content = $header.next(".inline-drawer-content");
          const isOpen = $content.data("open") === true;

          if (isOpen) {
            $content.data("open", false);
            $content.hide();
            $icon.removeClass("down");
          } else {
            $content.data("open", true);
            $content.show();
            $icon.addClass("down");
          }
        });
    });
  }, 100);

  // 下面是你原先的绑定逻辑（保持不变，只加了日志）
  $("#save_siliconflow_settings").off("click").on("click", saveSettings);

  $("#upload_voice").off("click").on("click", uploadVoice);
  $("#refresh_custom_voices").off("click").on("click", loadCustomVoices);

  $(document)
    .off("click", ".delete-voice")
    .on("click", ".delete-voice", function () {
      const uri = $(this).data("uri");
      const name = $(this).data("name");
      deleteCustomVoice(uri, name);
    });

  $("#auto_play_audio")
    .off("change")
    .on("change", function () {
      extension_settings[extensionName].autoPlay = $(this).prop("checked");
      saveSettingsDebounced();
      log("自动朗读角色消息:", $(this).prop("checked"));
    });

  $("#auto_play_user")
    .off("change")
    .on("change", function () {
      extension_settings[extensionName].autoPlayUser = $(this).prop("checked");
      saveSettingsDebounced();
      log("自动朗读用户消息:", $(this).prop("checked"));
    });

  $("#image_text_start, #image_text_end")
    .off("input")
    .on("input", function () {
      extension_settings[extensionName].textStart = $("#image_text_start").val();
      extension_settings[extensionName].textEnd = $("#image_text_end").val();
      saveSettingsDebounced();
    });

  $("#test_siliconflow_connection").off("click").on("click", testConnection);

  $("#tts_model").off("change").on("change", updateVoiceOptions);

  $("#tts_voice")
    .off("change")
    .on("change", function () {
      extension_settings[extensionName].ttsVoice = $(this).val();
      log("选择的音色:", $(this).val());
    });

  $("#tts_speed")
    .off("input")
    .on("input", function () {
      $("#tts_speed_value").text($(this).val());
    });

  $("#tts_gain")
    .off("input")
    .on("input", function () {
      $("#tts_gain_value").text($(this).val());
    });

  $("#test_tts")
    .off("click")
    .on("click", async function () {
      extension_settings[extensionName].ttsVoice = $("#tts_voice").val();
      const testText = $("#tts_test_text").val() || "你好，这是一个测试语音。";
      await generateTTS(testText);
    });

  logDebug("UI events bound OK");
}

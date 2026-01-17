import { $ } from "./dom.js";
import { extensionName } from "./constants.js";
import { extension_settings, saveSettingsDebounced } from "./context.js";
import { log, logDebug } from "./logger.js";
import { saveSettings } from "./settings.js";
import { updateVoiceOptions, loadCustomVoices } from "./voices.js";
import { uploadVoice, deleteCustomVoice } from "./voiceClone.js";
import { generateTTS } from "./tts.js";
import { testConnection } from "./utils_testConnection.js";

export function initUI() {
  // Inline drawer 折叠/展开（延迟绑定，和你原逻辑一致）
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

  $("#save_siliconflow_settings").on("click", saveSettings);

  $("#upload_voice").on("click", uploadVoice);
  $("#refresh_custom_voices").on("click", loadCustomVoices);

  $(document).on("click", ".delete-voice", function () {
    const uri = $(this).data("uri");
    const name = $(this).data("name");
    deleteCustomVoice(uri, name);
  });

  $("#auto_play_audio").on("change", function () {
    extension_settings[extensionName].autoPlay = $(this).prop("checked");
    saveSettingsDebounced();
    log("自动朗读角色消息:", $(this).prop("checked"));
  });

  $("#auto_play_user").on("change", function () {
    extension_settings[extensionName].autoPlayUser = $(this).prop("checked");
    saveSettingsDebounced();
    log("自动朗读用户消息:", $(this).prop("checked"));
  });

  $("#image_text_start, #image_text_end").on("input", function () {
    extension_settings[extensionName].textStart = $("#image_text_start").val();
    extension_settings[extensionName].textEnd = $("#image_text_end").val();
    saveSettingsDebounced();
  });

  $("#test_siliconflow_connection").on("click", testConnection);

  $("#tts_model").on("change", updateVoiceOptions);

  $("#tts_voice").on("change", function () {
    extension_settings[extensionName].ttsVoice = $(this).val();
    log("选择的音色:", $(this).val());
  });

  $("#tts_speed").on("input", function () {
    $("#tts_speed_value").text($(this).val());
  });

  $("#tts_gain").on("input", function () {
    $("#tts_gain_value").text($(this).val());
  });

  $("#test_tts").on("click", async function () {
    extension_settings[extensionName].ttsVoice = $("#tts_voice").val();
    const testText = $("#tts_test_text").val() || "你好，这是一个测试语音。";
    await generateTTS(testText);
  });

  logDebug("UI events bound");
}

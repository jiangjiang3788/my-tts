// ui.js
import { $ } from "./dom.js";
import { extensionName } from "./constants.js";
import { extension_settings, saveSettingsDebounced } from "./context.js";
import { log, logDebug, logWarn } from "./logger.js";
import { saveSettings } from "./settings.js";
import { loadCustomVoices } from "./voices.js";
import { uploadVoice, deleteCustomVoice } from "./voiceClone.js";
import { generateTTS } from "./tts.js";
import { testConnection } from "./utils_testConnection.js";
import { checkAndUpdateFromGithub, checkGithubUpdate } from "./updater.js";

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

    // ✅ updater
    "#check_github_update",
    "#github_repo",
    "#github_branch",
    "#github_path",
    "#auto_check_updates",
    "#update_check_interval",
    "#installed_commit",
    "#remote_commit",
  ];

  const result = {};
  for (const id of ids) result[id] = $(id).length;
  return result;
}

function refreshCommitBadges() {
  try {
    const cfg = extension_settings[extensionName] || {};
    const installed = cfg.lastInstalledCommit || "";
    const remote = cfg.lastRemoteCommit || "";
    if ($("#installed_commit").length) $("#installed_commit").text(installed ? installed.slice(0, 12) : "（未初始化）");
    if ($("#remote_commit").length) $("#remote_commit").text(remote ? remote.slice(0, 12) : "—");
  } catch {}
}

export function initUI() {
  const probe = probeUI();
  log("initUI() called, probe:", probe);

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

  // 保存设置（包含 GitHub 字段）
  $("#save_siliconflow_settings").off("click").on("click", () => {
    saveSettings();
    refreshCommitBadges();
  });

  // 测试连接
  $("#test_siliconflow_connection")
    .off("click")
    .on("click", async () => {
      await testConnection();
    });

  // 上传/刷新/删除音色
  $("#upload_voice").off("click").on("click", uploadVoice);
  $("#refresh_custom_voices").off("click").on("click", loadCustomVoices);

  $(document)
    .off("click", ".delete-voice")
    .on("click", ".delete-voice", function () {
      const uri = $(this).data("uri");
      const name = $(this).data("name");
      deleteCustomVoice(uri, name);
    });

  // 自动朗读开关
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

  // 文本提取标记变化：即时保存
  $("#image_text_start, #image_text_end")
    .off("input change")
    .on("input change", function () {
      extension_settings[extensionName].textStart = ($("#image_text_start").val() || "").trim();
      extension_settings[extensionName].textEnd = ($("#image_text_end").val() || "").trim();
      saveSettingsDebounced();
    });

  // 语速/增益滑条显示值
  $("#tts_speed")
    .off("input change")
    .on("input change", function () {
      $("#tts_speed_value").text($(this).val());
    });

  $("#tts_gain")
    .off("input change")
    .on("input change", function () {
      $("#tts_gain_value").text($(this).val());
    });

  // 测试 TTS
  $("#test_tts")
    .off("click")
    .on("click", async () => {
      try {
        await generateTTS();
      } catch (e) {
        console.error(e);
      }
    });

  // ✅ GitHub 更新：立即检查
  $("#check_github_update")
    .off("click")
    .on("click", async () => {
      // 先保存输入框内容
      saveSettings();
      refreshCommitBadges();

      // 强制检查并在发现更新时引导更新
      await checkAndUpdateFromGithub({ silent: false, force: true });
      refreshCommitBadges();
    });

  // ✅ GitHub 更新配置变更：即时落盘（避免用户忘了点保存）
  $("#github_repo, #github_branch, #github_path, #update_check_interval")
    .off("change blur")
    .on("change blur", () => {
      saveSettings();
      refreshCommitBadges();
    });

  $("#auto_check_updates")
    .off("change")
    .on("change", () => {
      saveSettings();
      refreshCommitBadges();
    });

  // 首次进 UI 时刷新徽标
  refreshCommitBadges();

  // 进入设置页时，轻量拉一次远端 sha 用于展示（不弹窗）
  // 注意：不会强制更新，只更新 remote_commit 显示
  setTimeout(async () => {
    try {
      saveSettings(); // 确保 repo 等字段已入 settings
      const r = await checkGithubUpdate({ silent: true, force: true });
      logDebug("checkGithubUpdate (silent) =>", r);
      refreshCommitBadges();
    } catch {}
  }, 300);
}

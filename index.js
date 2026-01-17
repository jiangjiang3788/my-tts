// index.js
import { $ } from "./dom.js";
import { log, logDebug, logWarn, logError } from "./logger.js";
import { extensionFolderPath } from "./constants.js";
import { loadSettings } from "./settings.js";
import { loadCustomVoices } from "./voices.js";
import { setupMessageListener } from "./messageListener.js";
import { initUI } from "./ui.js";
import { generateTTS } from "./tts.js";
import { extension_settings } from "./context.js";
import { checkAndUpdateFromGithub } from "./updater.js";

/**
 * 在云/本地不同壳里，settings 容器 id 可能不同，甚至不存在。
 * 这里做多候选探测。
 */
function findSettingsContainer() {
  const candidates = [
    "#extensions_settings",
    "#extensionsSettings",
    "#extensions_settings2",
    "#settings_container",
    "#settings",
    ".extensions_settings",
    ".settings",
  ];

  for (const sel of candidates) {
    const $el = $(sel);
    if ($el && $el.length) return $el;
  }
  return null;
}

function toast(type, msg, title = "my-tts") {
  try {
    if (window.toastr && typeof window.toastr[type] === "function") {
      window.toastr[type](msg, title);
      return;
    }
  } catch {}
  if (type === "error") console.error(`【${title}】`, msg);
  else if (type === "warning") console.warn(`【${title}】`, msg);
  else console.log(`【${title}】`, msg);
}

function ensureFloatingSettingsUI(settingsHtml) {
  if (document.getElementById("mytts-floating-btn")) return;

  const btn = document.createElement("button");
  btn.id = "mytts-floating-btn";
  btn.textContent = "my-tts 设置";
  btn.style.cssText = [
    "position:fixed",
    "right:14px",
    "bottom:14px",
    "z-index:99999",
    "padding:10px 12px",
    "border-radius:10px",
    "border:1px solid rgba(255,255,255,0.18)",
    "background:rgba(0,0,0,0.55)",
    "color:#fff",
    "cursor:pointer",
    "font-size:14px",
  ].join(";");

  const backdrop = document.createElement("div");
  backdrop.id = "mytts-settings-backdrop";
  backdrop.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:99998",
    "display:none",
    "background:rgba(0,0,0,0.5)",
  ].join(";");

  const modal = document.createElement("div");
  modal.id = "mytts-settings-modal";
  modal.style.cssText = [
    "position:absolute",
    "right:14px",
    "bottom:60px",
    "width:min(520px, calc(100vw - 28px))",
    "max-height:min(80vh, 720px)",
    "overflow:auto",
    "border-radius:12px",
    "border:1px solid rgba(255,255,255,0.18)",
    "background:rgba(20,20,20,0.95)",
    "padding:12px",
  ].join(";");

  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:10px;";

  const title = document.createElement("div");
  title.textContent = "my-tts 设置（云端兜底面板）";
  title.style.cssText = "color:#fff;font-weight:700;font-size:14px;opacity:0.95;";

  const close = document.createElement("button");
  close.textContent = "×";
  close.style.cssText = [
    "width:34px",
    "height:34px",
    "border-radius:10px",
    "border:1px solid rgba(255,255,255,0.18)",
    "background:rgba(255,255,255,0.08)",
    "color:#fff",
    "cursor:pointer",
    "font-size:18px",
    "line-height:1",
  ].join(";");

  const body = document.createElement("div");
  body.style.cssText = "color:#fff;";
  body.innerHTML = settingsHtml;

  header.appendChild(title);
  header.appendChild(close);

  modal.appendChild(header);
  modal.appendChild(body);
  backdrop.appendChild(modal);

  document.body.appendChild(backdrop);
  document.body.appendChild(btn);

  const open = () => {
    backdrop.style.display = "block";
    initUI();
    toast("info", "已打开云端兜底设置面板（用于确认插件已运行）");
  };

  const hide = () => {
    backdrop.style.display = "none";
  };

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    open();
  });

  close.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    hide();
  });

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) hide();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
  });

  toast("warning", "未找到酒馆设置容器：已启用右下角“my-tts 设置”兜底按钮");
  logWarn("Settings container not found, fallback floating settings enabled.");
}

jQuery(async () => {
  log("my-tts 启动：开始加载插件…");
  toast("info", "插件启动：正在初始化…");

  try {
    // 1) 读取设置面板 HTML
    const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);

    // 2) 找 settings 容器并注入
    const $container = findSettingsContainer();
    logDebug("Settings container probe result:", {
      found: !!$container,
      selector:
        $container?.attr("id")
          ? `#${$container.attr("id")}`
          : ($container?.get?.(0)?.className ? `.${$container.get(0).className}` : "unknown"),
      length: $container?.length || 0,
    });

    if ($container && $container.length) {
      $container.append(settingsHtml);
      toast("success", "已注入设置面板到酒馆设置页");
      log("设置面板已注入到 settings 容器内。");
      initUI();
    } else {
      ensureFloatingSettingsUI(settingsHtml);
    }

    // 3) 加载设置并刷新 UI
    await loadSettings();

    // 4) 拉取自定义音色并刷新下拉/列表
    await loadCustomVoices();

    // 5) 设置消息监听（自动朗读）
    setupMessageListener();

    // ✅ 6) 自动检查 GitHub 更新（按文件变动/提交）
    // 注意：不会依赖 manifest version，只看 commit sha 是否变化
    try {
      const cfg = extension_settings?.["my-tts"] || {};
      if (cfg.autoCheckUpdates === true) {
        // 非强制：按间隔策略决定是否检查
        await checkAndUpdateFromGithub({ silent: true, force: false });
      }
    } catch (e) {
      logWarn("auto update check failed (ignored):", e);
    }

    toast("success", "插件已加载完成（控制台可看更多日志）");
    log("硅基流动插件已加载");
    logDebug("extension_settings:", extension_settings);
  } catch (e) {
    toast("error", `插件初始化失败：${e?.message || e}`);
    logError("Plugin init failed:", e);
  }
});

export { generateTTS };

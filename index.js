import { $ } from "./dom.js";
import { log, logDebug } from "./logger.js";
import { extensionName, extensionFolderPath } from "./constants.js";
import { loadSettings } from "./settings.js";
import { loadCustomVoices } from "./voices.js";
import { setupMessageListener } from "./messageListener.js";
import { initUI } from "./ui.js";
import { generateTTS } from "./tts.js";
import { extension_settings } from "./context.js";

jQuery(async () => {
  // 1) 注入设置面板 HTML
  const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);
  $("#extensions_settings").append(settingsHtml);

  // 2) 初始化 UI 事件绑定
  initUI();

  // 3) 加载设置并刷新 UI
  await loadSettings();

  // 4) 拉取自定义音色并刷新下拉/列表
  await loadCustomVoices();

  // 5) 设置消息监听（自动朗读）
  setupMessageListener();

  log("硅基流动插件已加载");
  log("自动朗读功能已启用，请在控制台查看调试信息");
  logDebug("extension_settings:", extension_settings?.[extensionName]);
});

export { generateTTS };

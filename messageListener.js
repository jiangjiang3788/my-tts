// messageListener.js
import { $ } from "./dom.js";
import { log, logDebug, logError } from "./logger.js";
import { eventSource, event_types } from "./context.js";
import { ensureButton } from "./ttsManager.js";
import { bindMessageButtonEvents } from "./messageButtons.js";

function isValidMesId(mesid) {
  const s = String(mesid || "").trim();
  return /^[0-9]+$/.test(s);
}

function injectForAllMessages(reason = "unknown") {
  try {
    const all = $(".mes");
    console.log("【tts】注入扫描", { reason, mesCount: all.length });

    let injected = 0;
    all.each(function () {
      const $mes = $(this);
      const mesid = $mes.attr("mesid");
      if (!isValidMesId(mesid)) return;
      // ensureButton 只从 messageEl.attr("mesid") 取，所以直接传 $mes
      ensureButton($mes);
      injected++;
    });

    console.log("【tts】注入扫描完成", { reason, injected, totalBtns: document.querySelectorAll(".tts-btn").length });
  } catch (e) {
    console.error("【tts】injectForAllMessages error:", e);
  }
}

function setupDomObserver() {
  // 聊天消息一般在 #chat 或 #chat_history（不同版本可能不一样）
  const root =
    document.querySelector("#chat") ||
    document.querySelector("#chat_history") ||
    document.querySelector("#chat_wrapper") ||
    document.querySelector(".chat") ||
    document.body;

  console.log("【tts】DOM 观察根节点:", root?.id || root?.className || root?.tagName);

  const obs = new MutationObserver((mutations) => {
    let touched = false;

    for (const m of mutations) {
      // 只关心新增节点
      for (const node of m.addedNodes || []) {
        if (!(node instanceof HTMLElement)) continue;

        // 新增的是 .mes 或里面包含 .mes
        if (node.classList?.contains("mes")) {
          const mesid = node.getAttribute("mesid");
          if (isValidMesId(mesid)) {
            ensureButton($(node));
            touched = true;
          }
        } else {
          const mesList = node.querySelectorAll?.(".mes");
          if (mesList && mesList.length) {
            mesList.forEach((mes) => {
              const mesid = mes.getAttribute("mesid");
              if (isValidMesId(mesid)) {
                ensureButton($(mes));
                touched = true;
              }
            });
          }
        }
      }
    }

    if (touched) {
      console.log("【tts】DOM 观察到新消息，当前按钮数:", document.querySelectorAll(".tts-btn").length);
    }
  });

  obs.observe(root, { childList: true, subtree: true });
  console.log("【tts】MutationObserver 已启用");
}

export function setupMessageListener() {
  bindMessageButtonEvents();

  log("【tts】setupMessageListener 已执行");
  logDebug("【tts】event_types:", event_types);

  // ✅ 手动调试：控制台直接 __ttsInject(20)
  window.__ttsInject = (mesid) => {
    const id = String(mesid || "").trim();
    const el = $(`.mes[mesid="${id}"]`);
    console.log("【tts】__ttsInject:", { id, found: el.length });
    if (!el.length) return false;
    ensureButton(el);
    console.log("【tts】__ttsInject done, btnCount:", el.find(`.tts-btn[data-mesid="${id}"]`).length);
    return true;
  };

  window.__ttsScan = () => injectForAllMessages("manual");

  // ✅ 关键：启动后立刻扫一次（安全过滤，避免模板污染）
  setTimeout(() => injectForAllMessages("startup-800ms"), 800);
  setTimeout(() => injectForAllMessages("startup-2000ms"), 2000);

  // ✅ 不依赖 eventSource：DOM 观察器
  setupDomObserver();

  // ✅ 仍然尝试挂 eventSource（可用就更快，不可用也无所谓）
  try {
    if (event_types?.CHARACTER_MESSAGE_RENDERED) {
      eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (messageId) => {
        const mesid = String(messageId || "").trim();
        console.log("【tts】事件 CHARACTER_MESSAGE_RENDERED:", mesid);
        if (!isValidMesId(mesid)) return;
        const el = $(`.mes[mesid="${mesid}"]`);
        if (el.length) ensureButton(el);
      });
    } else {
      logError("【tts】event_types.CHARACTER_MESSAGE_RENDERED 不存在");
    }

    if (event_types?.USER_MESSAGE_RENDERED) {
      eventSource.on(event_types.USER_MESSAGE_RENDERED, (messageId) => {
        const mesid = String(messageId || "").trim();
        console.log("【tts】事件 USER_MESSAGE_RENDERED:", mesid);
        if (!isValidMesId(mesid)) return;
        const el = $(`.mes[mesid="${mesid}"]`);
        if (el.length) ensureButton(el);
      });
    } else {
      logError("【tts】event_types.USER_MESSAGE_RENDERED 不存在");
    }
  } catch (e) {
    logError("【tts】eventSource 监听挂载异常:", e);
  }

  log("【tts】监听器已挂载（DOM观察 + 安全扫描 + 可选事件）");
}

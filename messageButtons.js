// messageButtons.js
import { $ } from "./dom.js";
import {
  handleButtonClickByEl,
  pauseCurrent,
  resumeCurrent,
  stopCurrent,
  playFromStartByEl,
  playFromParagraphByEl
} from "./ttsManager.js";

import { openExtractSettingsModal } from "./extractSettingsModal.js";

const UI = {
  idle: { title: "TTS 生成 / 播放", icon: "fa-volume-high", disabled: false },
  loading: { title: "生成中...", icon: "fa-spinner", disabled: true },
  ready: { title: "播放", icon: "fa-play", disabled: false },
  playing: { title: "暂停", icon: "fa-pause", disabled: false },
  paused: { title: "继续", icon: "fa-play", disabled: false },
  error: { title: "失败，点我重试", icon: "fa-triangle-exclamation", disabled: false }
};

let bound = false;
let $menu = null;

function ensureMenu() {
  if ($menu?.length) return;

  $menu = $(`
    <div class="tts-more-menu" style="display:none;">
      <div class="tts-more-item" data-action="resume">继续播放</div>
      <div class="tts-more-item" data-action="restart">从头播放</div>
      <div class="tts-more-item" data-action="from_para">从第 1 段开始</div>
      <div class="tts-more-sep"></div>
      <div class="tts-more-item" data-action="pause">暂停</div>
      <div class="tts-more-item" data-action="stop">停止（清队列）</div>
      <div class="tts-more-sep"></div>
      <div class="tts-more-item" data-action="extract">设置本对话文本提取规则…</div>
    </div>
  `);

  $("body").append($menu);

  // 点击菜单项
  $(document).on("click", ".tts-more-menu .tts-more-item", async function (e) {
    e.preventDefault();
    e.stopPropagation();

    const action = $(this).data("action");
    const mesid = $menu.data("mesid");
    const $mes = $(`.mes[mesid="${mesid}"]`);

    hideMenu();

    if (!$mes.length) return;

    if (action === "resume") {
      await resumeCurrent();
      return;
    }

    if (action === "restart") {
      await playFromStartByEl($mes);
      return;
    }

    if (action === "from_para") {
      // 这里默认从第 1 段（index=0）
      await playFromParagraphByEl($mes, 0);
      return;
    }

    if (action === "pause") {
      pauseCurrent();
      return;
    }

    if (action === "stop") {
      stopCurrent();
      return;
    }

    if (action === "extract") {
      openExtractSettingsModal();
      return;
    }
  });

  // 点击空白关闭
  $(document).on("click", () => hideMenu());

  // ESC 关闭
  $(document).on("keydown", (e) => {
    if (e.key === "Escape") hideMenu();
  });

  // 滚动/resize 也关闭，避免定位错位
  $(window).on("scroll resize", () => hideMenu());
}

function showMenuNear($anchor, mesid) {
  ensureMenu();

  $menu.data("mesid", mesid);

  const off = $anchor.offset();
  const anchorH = $anchor.outerHeight() || 0;

  // 先显示以便拿宽高
  $menu.css({ display: "block", visibility: "hidden", left: 0, top: 0 });
  const menuW = $menu.outerWidth() || 180;
  const menuH = $menu.outerHeight() || 200;

  const vw = $(window).width();
  const vh = $(window).height();
  const scrollTop = $(window).scrollTop();
  const scrollLeft = $(window).scrollLeft();

  let left = off.left;
  let top = off.top + anchorH + 6;

  // 右侧溢出就向左贴
  if (left + menuW > scrollLeft + vw - 10) {
    left = scrollLeft + vw - menuW - 10;
  }
  // 下方溢出就向上弹
  if (top + menuH > scrollTop + vh - 10) {
    top = off.top - menuH - 8;
  }

  $menu.css({ left, top, visibility: "visible" });
}

function hideMenu() {
  if ($menu?.length) $menu.hide();
}

export function bindMessageButtonEvents() {
  if (bound) return;
  bound = true;

  // 主按钮：播放/暂停/继续（由 ttsManager 自己判断）
  $(document).on("click", ".tts-btn", async function (e) {
    e.preventDefault();
    e.stopPropagation();

    const $mes = $(this).closest(".mes");
    if (!$mes.length || !String($mes.attr("mesid") || "").trim()) {
      toastr.warning("无法定位到消息节点（可能点到了模板/占位节点）");
      return;
    }
    await handleButtonClickByEl($mes);
  });

  // 主按钮键盘
  $(document).on("keydown", ".tts-btn", async function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();

    const $mes = $(this).closest(".mes");
    if (!$mes.length || !String($mes.attr("mesid") || "").trim()) {
      toastr.warning("无法定位到消息节点");
      return;
    }
    await handleButtonClickByEl($mes);
  });

  // 更多按钮：打开菜单
  $(document).on("click", ".tts-more", function (e) {
    e.preventDefault();
    e.stopPropagation();

    const $mes = $(this).closest(".mes");
    const mesid = String($mes.attr("mesid") || "").trim();
    if (!mesid) return;

    showMenuNear($(this), mesid);
  });

  // 更多按钮键盘
  $(document).on("keydown", ".tts-more", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();

    const $mes = $(this).closest(".mes");
    const mesid = String($mes.attr("mesid") || "").trim();
    if (!mesid) return;

    showMenuNear($(this), mesid);
  });
}

/**
 * 仍保持按 data-mesid 更新
 */
export function setButtonStateByMesEl(messageId, state) {
  const cfg = UI[state] || UI.idle;

  const btn = $(`.tts-btn[data-mesid="${messageId}"]`);
  if (!btn.length) return;

  btn.attr("title", cfg.title);
  btn.attr("role", "button");
  btn.attr("tabindex", "0");

  btn.removeClass("fa-volume-high fa-spinner fa-play fa-stop fa-triangle-exclamation fa-pause");

  if (state === "loading") {
    btn.addClass("fa-solid").addClass(cfg.icon).addClass("fa-spin");
    btn.css("pointer-events", "none").css("opacity", "0.6");
  } else {
    btn.removeClass("fa-spin");
    btn.addClass("fa-solid").addClass(cfg.icon);
    btn.css("pointer-events", "").css("opacity", "");
  }

  btn.attr("data-tts-state", state);
}


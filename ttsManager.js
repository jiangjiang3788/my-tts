// ttsManager.js
import { $ } from "./dom.js";
import { getContext } from "./context.js";
import { requestTTSBlob } from "./tts.js";
import { setButtonStateByMesEl } from "./messageButtons.js";
import { loadPersonaExtractSettings, getPersonaKey } from "./personaExtractSettings.js";

// cacheKey -> Promise<{blob,url}>
const cache = new Map();

let currentAudio = null;
let currentPlayingMesId = null;

let currentQueue = [];          // [{ mesid, idx, text, mode }]
let currentQueueIndex = 0;

// 暂停/续播信息（段落级 + 段内时间）
let isPaused = false;
let resumeInfo = null; // { mesid, queueIndex, timeInSegment }

function isValidMesId(mesid) {
  return /^[0-9]+$/.test(String(mesid || "").trim());
}

function getCurrentParamsKey() {
  const voice = $("#tts_voice").val() || "";
  const speed = $("#tts_speed").val() || "";
  const gain = $("#tts_gain").val() || "";

  const personaCfg = loadPersonaExtractSettings() || {};
  const mode = personaCfg?.mode || "inherit";

  // persona 优先；没填则回落到设置页（兼容你现有 UI）
  const start = (personaCfg?.start ?? "").trim();
  const end = (personaCfg?.end ?? "").trim();

  const pageStart = ($("#image_text_start").val() || "").trim();
  const pageEnd = ($("#image_text_end").val() || "").trim();

  const finalStart = start || pageStart;
  const finalEnd = end || pageEnd;

  const regex = (personaCfg?.regex ?? "").trim();
  const fallback = personaCfg?.fallback || "full";
  const skipCode = personaCfg?.skipCodeBlocks === true ? "1" : "0";

  return {
    voice,
    speed,
    gain,
    personaKey: getPersonaKey(),
    extractMode: mode,
    start: finalStart,
    end: finalEnd,
    regex,
    fallback,
    skipCode
  };
}

function buildCacheKey(mesid, idx, mode) {
  const p = getCurrentParamsKey();
  return `${mesid}|p${idx}|${mode}|${p.voice}|${p.speed}|${p.gain}|${p.personaKey}|em:${p.extractMode}|s:${p.start}|e:${p.end}|re:${p.regex}|fb:${p.fallback}|sc:${p.skipCode}`;
}

export function ensureButton(messageEl) {
  if (!messageEl || messageEl.length === 0) return;

  const mesid = String(messageEl.attr("mesid") || "").trim();
  if (!isValidMesId(mesid)) return;

  if (messageEl.find(`.tts-btn[data-mesid="${mesid}"]`).length > 0) return;

  const mesButtons = messageEl.find(".mes_buttons").first();
  if (!mesButtons.length) return;

  const btn = $(`
    <div class="mes_button tts-btn fa-solid fa-volume-high interactable"
      title="TTS 播放/暂停" data-mesid="${mesid}" tabindex="0" role="button"></div>
  `);

  const more = $(`
    <div class="mes_button tts-more fa-solid fa-ellipsis-vertical interactable"
      title="更多" data-mesid="${mesid}" tabindex="0" role="button"></div>
  `);

  mesButtons.append(btn);
  mesButtons.append(more);
}

export function getMessageText(messageEl) {
  // 读整条消息的纯文本（用于“先全文提取”）
  return messageEl?.find(".mes_text")?.first()?.text?.() || "";
}

function getEffectiveExtractConfig() {
  const personaCfg = loadPersonaExtractSettings() || {};
  const mode = personaCfg.mode || "inherit";

  let start = (personaCfg.start ?? "").trim();
  let end = (personaCfg.end ?? "").trim();

  // 回落到设置页（兼容）
  const pageStart = ($("#image_text_start").val() || "").trim();
  const pageEnd = ($("#image_text_end").val() || "").trim();
  if (!start) start = pageStart;
  if (!end) end = pageEnd;

  return {
    mode,
    start,
    end,
    regex: (personaCfg.regex ?? "").trim(),
    fallback: personaCfg.fallback || "full",
    skipCodeBlocks: personaCfg.skipCodeBlocks === true
  };
}

/**
 * ✅ 文本提取（对“整段文本”生效）
 */
export function getSpeechText(text) {
  if (!text) return { mode: "none", text: "" };

  const cfg = getEffectiveExtractConfig();

  if (cfg.mode === "smart") {
    let t = String(text);

    if (cfg.skipCodeBlocks) {
      t = t.replace(/```[\s\S]*?```/g, "").trim();
    }
    t = t.replace(/^\s*>\s.*$/gm, "").trim();

    if (!t) return cfg.fallback === "empty" ? { mode: "none", text: "" } : { mode: "full", text };
    return { mode: "smart", text: t };
  }

  if (cfg.mode === "full") return { mode: "full", text };

  if (cfg.mode === "regex") {
    if (!cfg.regex) return cfg.fallback === "empty" ? { mode: "none", text: "" } : { mode: "full", text };
    try {
      const re = new RegExp(cfg.regex, "g");
      const matches = [];
      let m;
      while ((m = re.exec(text)) !== null) {
        const v = (m[1] ?? m[0] ?? "").trim();
        if (v) matches.push(v);
        if (m.index === re.lastIndex) re.lastIndex++;
      }
      if (matches.length) return { mode: "regex", text: matches.join(" ") };
      return cfg.fallback === "empty" ? { mode: "none", text: "" } : { mode: "full", text };
    } catch {
      return cfg.fallback === "empty" ? { mode: "none", text: "" } : { mode: "full", text };
    }
  }

  // inherit / marked：走 start/end 标记提取
  let start = (cfg.start || "").trim();
  let end = (cfg.end || "").trim();

  if (!start || !end) {
    // 没有标记就全文
    return { mode: "full", text };
  }

  const quotePair = { "“": "”", "”": "“", "‘": "’", "’": "‘" };
  if (start === end && quotePair[start]) end = quotePair[start];

  const parts = extractBetween(text, start, end);
  if (parts.length > 0) return { mode: "marked", text: parts.join(" ") };

  return cfg.fallback === "empty" ? { mode: "none", text: "" } : { mode: "full", text };
}

/**
 * ✅ 把任意文本切成“朗读段落队列”
 * 规则：
 * - 优先按空行拆
 * - 其次按换行拆
 * - 再做一次空白压缩
 */
function splitTextToParagraphs(text) {
  const raw = String(text || "");
  return raw
    .split(/\n\s*\n|\r\n\s*\r\n/g) // 空行优先
    .flatMap((blk) => blk.split(/\n|\r\n/g)) // 再按单行
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * ✅ 生成某段音频（Promise 缓存，支持并发预取）
 */
async function generateParagraph(mesid, idx, text, mode) {
  const cacheKey = buildCacheKey(mesid, idx, mode);

  if (cache.has(cacheKey)) {
    return await cache.get(cacheKey);
  }

  const p = (async () => {
    const blob = await requestTTSBlob(text);
    const url = URL.createObjectURL(blob);
    return { blob, url };
  })();

  cache.set(cacheKey, p);

  try {
    const item = await p;
    cache.set(cacheKey, Promise.resolve(item));
    return item;
  } catch (e) {
    cache.delete(cacheKey);
    throw e;
  }
}

/**
 * ✅ 预取下一段（后台生成，不阻塞播放）
 */
function prefetchNext(index) {
  if (!currentQueue.length) return;
  if (index >= currentQueue.length) return;

  const next = currentQueue[index];
  generateParagraph(next.mesid, next.idx, next.text, next.mode).catch(() => {});
}

/**
 * ✅ 暂停
 */
export function pauseCurrent() {
  if (!currentAudio || !currentPlayingMesId) return;

  try {
    resumeInfo = {
      mesid: currentPlayingMesId,
      queueIndex: currentQueueIndex,
      timeInSegment: currentAudio.currentTime || 0
    };
    currentAudio.pause();
    isPaused = true;
    setButtonStateByMesEl(currentPlayingMesId, "paused");
  } catch {}
}

/**
 * ✅ 继续播放
 */
export async function resumeCurrent() {
  if (!resumeInfo) return;
  if (!currentPlayingMesId) return;
  if (resumeInfo.mesid !== currentPlayingMesId) return;

  isPaused = false;
  await playQueueFrom(resumeInfo.queueIndex, { seek: resumeInfo.timeInSegment });
}

/**
 * ✅ 停止
 */
export function stopCurrent() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
  }

  if (currentPlayingMesId != null) {
    setButtonStateByMesEl(currentPlayingMesId, "ready");
  }

  currentAudio = null;
  currentPlayingMesId = null;
  currentQueue = [];
  currentQueueIndex = 0;

  isPaused = false;
  resumeInfo = null;
}

/**
 * ✅ 播放队列（并行预取下一段）
 */
async function playQueueFrom(index = 0, opts = {}) {
  if (!currentQueue.length) return;

  currentQueueIndex = index;

  if (currentQueueIndex >= currentQueue.length) {
    setButtonStateByMesEl(currentPlayingMesId, "ready");

    currentAudio = null;
    currentPlayingMesId = null;
    currentQueue = [];
    currentQueueIndex = 0;

    isPaused = false;
    resumeInfo = null;
    return;
  }

  const item = currentQueue[currentQueueIndex];
  const { mesid, idx, text, mode } = item;

  setButtonStateByMesEl(mesid, "loading");

  try {
    const audioItem = await generateParagraph(mesid, idx, text, mode);

    // 播放过程中被切走
    if (currentPlayingMesId !== mesid) return;

    if (currentAudio) {
      try { currentAudio.pause(); } catch {}
    }

    currentAudio = new Audio(audioItem.url);

    if (opts && typeof opts.seek === "number" && opts.seek > 0) {
      try { currentAudio.currentTime = opts.seek; } catch {}
    }

    setButtonStateByMesEl(mesid, "playing");

    currentAudio.addEventListener("ended", () => {
      resumeInfo = null;
      isPaused = false;
      playQueueFrom(currentQueueIndex + 1);
    });

    currentAudio.addEventListener("error", () => {
      resumeInfo = null;
      isPaused = false;
      playQueueFrom(currentQueueIndex + 1);
    });

    await currentAudio.play();

    // ✅ 播放开始就预取下一段
    prefetchNext(currentQueueIndex + 1);
  } catch (e) {
    resumeInfo = null;
    isPaused = false;
    playQueueFrom(currentQueueIndex + 1);
  }
}

/**
 * ✅ 构建队列（关键改动：先全文提取，再分段）
 */
function buildQueueFromMessageEl(messageEl) {
  const mesid = String(messageEl.attr("mesid") || "").trim();

  const raw = getMessageText(messageEl);
  if (!raw || !raw.trim()) return { mesid, queue: [] };

  // ✅ 关键：先对“整条消息全文”做一次提取
  const extracted = getSpeechText(raw);
  const extractedText = (extracted?.text || "").trim();

  if (!extractedText) {
    return { mesid, queue: [] };
  }

  // ✅ 再把提取结果切成段落队列
  const paras = splitTextToParagraphs(extractedText);
  if (!paras.length) return { mesid, queue: [] };

  return {
    mesid,
    queue: paras.map((t, i) => ({ mesid, idx: i, text: t, mode: extracted.mode || "full" }))
  };
}

/**
 * ✅ 主按钮点击：播放/暂停/继续
 */
export async function handleButtonClickByEl(messageEl) {
  const mesid = String(messageEl.attr("mesid") || "").trim();
  if (!isValidMesId(mesid)) {
    toastr.warning("无法定位到消息ID（mesid无效）");
    return;
  }

  // 同一条：播放 <-> 暂停/继续
  if (currentPlayingMesId === mesid) {
    if (currentAudio && !isPaused) {
      pauseCurrent();
      return;
    }
    if (currentAudio && isPaused) {
      await resumeCurrent();
      return;
    }
  }

  // 新消息：停旧的 -> 从头播放
  stopCurrent();

  const { queue } = buildQueueFromMessageEl(messageEl);
  if (!queue.length) {
    toastr.info("未找到可朗读的文本（可能提取结果为空）");
    return;
  }

  currentQueue = queue;
  currentPlayingMesId = mesid;

  isPaused = false;
  resumeInfo = null;

  setButtonStateByMesEl(mesid, "ready");
  await playQueueFrom(0);
}

/**
 * ✅ 菜单：从头播放
 */
export async function playFromStartByEl(messageEl) {
  const mesid = String(messageEl.attr("mesid") || "").trim();
  if (!isValidMesId(mesid)) return;

  stopCurrent();

  const { queue } = buildQueueFromMessageEl(messageEl);
  if (!queue.length) {
    toastr.info("未找到可朗读的文本（可能提取结果为空）");
    return;
  }

  currentQueue = queue;
  currentPlayingMesId = mesid;

  isPaused = false;
  resumeInfo = null;

  setButtonStateByMesEl(mesid, "ready");
  await playQueueFrom(0);
}

/**
 * ✅ 菜单：从第 N 段开始
 */
export async function playFromParagraphByEl(messageEl, paragraphIndex = 0) {
  const mesid = String(messageEl.attr("mesid") || "").trim();
  if (!isValidMesId(mesid)) return;

  stopCurrent();

  const { queue } = buildQueueFromMessageEl(messageEl);
  if (!queue.length) {
    toastr.info("未找到可朗读的文本（可能提取结果为空）");
    return;
  }

  currentQueue = queue;
  currentPlayingMesId = mesid;

  isPaused = false;
  resumeInfo = null;

  const idx = Math.max(0, Math.min(paragraphIndex, currentQueue.length - 1));
  setButtonStateByMesEl(mesid, "ready");
  await playQueueFrom(idx);
}

/**
 * start==end 的配对扫描 / start!=end 正则提取
 */
function extractBetween(message, start, end) {
  const extracted = [];
  if (!message) return extracted;

  if (start === end) {
    let inside = false;
    let buf = "";
    for (let i = 0; i < message.length; i++) {
      const ch = message[i];
      if (ch === start) {
        if (!inside) {
          inside = true;
          buf = "";
        } else {
          if (buf.trim()) extracted.push(buf.trim());
          inside = false;
          buf = "";
        }
      } else if (inside) {
        buf += ch;
      }
    }
    return extracted;
  }

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${esc(start)}(.*?)${esc(end)}`, "g");
  const matches = message.match(re);

  if (matches?.length) {
    for (const m of matches) {
      const clean = m.replace(start, "").replace(end, "").trim();
      if (clean) extracted.push(clean);
    }
  }
  return extracted;
}

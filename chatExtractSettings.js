// chatExtractSettings.js
import { getContext } from "./context.js";

const LS_PREFIX = "siliconflow_tts_extract_v1:";

function getChatKeySafe() {
  try {
    const ctx = getContext?.();
    return (
      ctx?.chatId ||
      ctx?.chat_id ||
      ctx?.activeChatId ||
      ctx?.characterId ||
      ctx?.character_id ||
      "global"
    );
  } catch {
    return "global";
  }
}

export function loadChatExtractSettings(chatKey = null) {
  const key = LS_PREFIX + (chatKey || getChatKeySafe());
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

export function saveChatExtractSettings(patch, chatKey = null) {
  const key = LS_PREFIX + (chatKey || getChatKeySafe());
  const cur = loadChatExtractSettings(chatKey);
  const next = { ...cur, ...patch };
  localStorage.setItem(key, JSON.stringify(next));
  return next;
}

export function resetChatExtractSettings(chatKey = null) {
  const key = LS_PREFIX + (chatKey || getChatKeySafe());
  localStorage.removeItem(key);
}

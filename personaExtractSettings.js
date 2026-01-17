// personaExtractSettings.js
import { getContext } from "./context.js";

const LS_PREFIX = "siliconflow_tts_extract_persona_v1:";

export function getPersonaKey() {
  try {
    const ctx = getContext?.();

    // ✅ 优先人物/角色
    const persona =
      ctx?.characterId ||
      ctx?.character_id ||
      ctx?.personaId ||
      ctx?.persona_id ||
      ctx?.avatarId ||
      ctx?.avatar_id;

    if (persona != null && String(persona).trim() !== "") {
      return `persona:${String(persona).trim()}`;
    }

    // 兜底：用 chat
    const chat = ctx?.chatId || ctx?.chat_id || ctx?.activeChatId;
    if (chat != null && String(chat).trim() !== "") {
      return `chat:${String(chat).trim()}`;
    }

    return "global";
  } catch {
    return "global";
  }
}

export function loadPersonaExtractSettings() {
  const key = LS_PREFIX + getPersonaKey();
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

export function savePersonaExtractSettings(patch) {
  const key = LS_PREFIX + getPersonaKey();
  const cur = loadPersonaExtractSettings();
  const next = { ...cur, ...patch };
  localStorage.setItem(key, JSON.stringify(next));
  return next;
}

export function resetPersonaExtractSettings() {
  const key = LS_PREFIX + getPersonaKey();
  localStorage.removeItem(key);
}

import { extensionName } from "./constants.js";
import { extension_settings } from "./context.js";

export function getApiBaseUrl() {
  return extension_settings[extensionName].apiUrl;
}

export function getApiKey() {
  return extension_settings[extensionName].apiKey;
}

export async function apiFetch(path, { method = "GET", headers = {}, body, json = true } = {}) {
  const apiKey = getApiKey();
  const base = getApiBaseUrl();

  const finalHeaders = {
    Authorization: `Bearer ${apiKey}`,
    ...headers
  };

  const res = await fetch(`${base}${path}`, {
    method,
    headers: finalHeaders,
    body
  });

  return { res, data: json ? await safeJson(res) : null };
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

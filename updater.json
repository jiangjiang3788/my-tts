// updater.js
import { extensionName } from "./constants.js";
import { extension_settings, saveSettingsDebounced } from "./context.js";
import { log, logWarn, logError } from "./logger.js";

/**
 * ✅ 目标：
 * - 不看版本号
 * - 看 GitHub 上该插件路径（path）最后一次提交 sha
 * - sha 变了 => 说明文件有改动 => 提示更新并调用 /api/extensions/update
 */

// -------------------------
// 工具：toast / headers
// -------------------------
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

function getRequestHeadersSafe() {
  // SillyTavern 常见：window.getRequestHeaders()
  try {
    if (typeof window.getRequestHeaders === "function") {
      return window.getRequestHeaders();
    }
  } catch {}
  return { "Content-Type": "application/json" };
}

// -------------------------
// 解析 repo 配置
// -------------------------
function normalizeRepo(input) {
  const raw = String(input || "").trim();
  if (!raw) return { owner: "", repo: "" };

  // 允许：
  // - owner/repo
  // - https://github.com/owner/repo
  // - git@github.com:owner/repo.git
  let s = raw;

  // git@github.com:owner/repo.git
  if (s.startsWith("git@github.com:")) {
    s = s.replace("git@github.com:", "");
  }

  // https://github.com/owner/repo
  s = s.replace(/^https?:\/\/github\.com\//i, "");

  // 去掉 .git、尾部斜杠
  s = s.replace(/\.git$/i, "").replace(/\/+$/g, "");

  const parts = s.split("/");
  if (parts.length < 2) return { owner: "", repo: "" };
  return { owner: parts[0], repo: parts[1] };
}

function getUpdateConfig() {
  const cfg = extension_settings[extensionName] || {};
  return {
    repo: cfg.githubRepo || "",
    branch: cfg.githubBranch || "main",
    path: cfg.githubPath || "",

    autoCheck: cfg.autoCheckUpdates === true,
    intervalHours: Number(cfg.updateCheckIntervalHours ?? 12),

    lastInstalledCommit: cfg.lastInstalledCommit || "",
    lastAutoCheckAt: Number(cfg.lastAutoCheckAt ?? 0),
  };
}

function setUpdateMeta(patch) {
  extension_settings[extensionName] = extension_settings[extensionName] || {};
  Object.assign(extension_settings[extensionName], patch);
  saveSettingsDebounced();
}

// -------------------------
// GitHub：取 path 最新 commit sha（按文件变动）
// -------------------------
async function fetchLatestCommitSha({ owner, repo, branch, path }) {
  // ✅ commits?path=xxx 会返回“影响该路径的最新提交”
  // 如果 path 为空，则等价于仓库最新提交（也算文件变动）
  const params = new URLSearchParams();
  if (branch) params.set("sha", branch);
  if (path) params.set("path", path);
  params.set("per_page", "1");

  const url = `https://api.github.com/repos/${owner}/${repo}/commits?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub API 请求失败：HTTP ${res.status} ${text || ""}`.trim());
  }

  const list = await res.json();
  const sha = list?.[0]?.sha || "";
  if (!sha) throw new Error("未获取到最新 commit sha（可能 repo/branch/path 配置不对）");
  return sha;
}

// -------------------------
// 是否到点自动检查
// -------------------------
function shouldAutoCheck(now, lastAt, intervalHours) {
  if (!lastAt) return true;
  const intervalMs = Math.max(1, intervalHours) * 3600 * 1000;
  return now - lastAt >= intervalMs;
}

// -------------------------
// 外部可调用：检查更新
// -------------------------
export async function checkGithubUpdate({ silent = false, force = false } = {}) {
  const cfg = getUpdateConfig();
  const { owner, repo } = normalizeRepo(cfg.repo);

  if (!owner || !repo) {
    if (!silent) toast("warning", "未配置 GitHub 仓库（owner/repo）。", "更新检查");
    return { ok: false, hasUpdate: false, reason: "no_repo" };
  }

  const now = Date.now();
  if (!force && cfg.autoCheck && !shouldAutoCheck(now, cfg.lastAutoCheckAt, cfg.intervalHours)) {
    log("skip auto check: not due");
    return { ok: true, hasUpdate: false, skipped: true };
  }

  try {
    const remoteSha = await fetchLatestCommitSha({
      owner,
      repo,
      branch: cfg.branch,
      path: cfg.path,
    });

    // 记录最近一次检查时间（无论是否有更新）
    setUpdateMeta({ lastAutoCheckAt: now, lastRemoteCommit: remoteSha });

    const localSha = cfg.lastInstalledCommit || "";
    const hasUpdate = !!localSha && remoteSha !== localSha;

    // 第一次启用（本地还没存 sha）：把“当前远端 sha”当作已安装基线，避免一上来就提示更新
    if (!localSha) {
      setUpdateMeta({ lastInstalledCommit: remoteSha });
      if (!silent) toast("info", "已初始化更新基线（后续将按提交变动提示更新）。", "更新检查");
      return { ok: true, hasUpdate: false, initialized: true, remoteSha };
    }

    return { ok: true, hasUpdate, remoteSha, localSha };
  } catch (e) {
    logError("checkGithubUpdate failed:", e);
    if (!silent) toast("error", e?.message || String(e), "更新检查失败");
    return { ok: false, hasUpdate: false, reason: "error", error: e };
  }
}

// -------------------------
// 执行更新：调用后端 /api/extensions/update
// -------------------------
export async function performExtensionUpdate({ remoteSha = "" } = {}) {
  toast("info", "正在请求后端更新插件，请不要刷新页面…", "正在更新");

  const res = await fetch("/api/extensions/update", {
    method: "POST",
    headers: getRequestHeadersSafe(),
    body: JSON.stringify({
      extensionName: extensionName,
      global: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`更新失败：HTTP ${res.status} ${text || ""}`.trim());
  }

  const result = await res.json().catch(() => ({}));

  // 不依赖 result.isUpToDate（因为你要“按文件变动”）
  // 只要更新接口成功，就把 remoteSha 记为 installedSha
  if (remoteSha) {
    setUpdateMeta({ lastInstalledCommit: remoteSha });
  }

  toast("success", "更新成功！即将刷新页面…", "更新完成");
  setTimeout(() => location.reload(), 1200);

  return result;
}

// -------------------------
// 一键：发现更新 -> 弹窗确认 -> 更新
// -------------------------
export async function checkAndUpdateFromGithub({ silent = false, force = false } = {}) {
  const r = await checkGithubUpdate({ silent, force });
  if (!r.ok) return r;

  if (!r.hasUpdate) {
    if (!silent && !r.skipped) toast("success", "当前已是最新（按提交变动判断）。", "更新检查");
    return r;
  }

  const ok = window.confirm(
    `检测到 GitHub 有新提交（按路径变动）。\n\n本地：${String(r.localSha).slice(0, 7)}\n远端：${String(r.remoteSha).slice(0, 7)}\n\n是否立即更新？`
  );

  if (!ok) {
    if (!silent) toast("info", "已取消更新。", "更新检查");
    return { ...r, cancelled: true };
  }

  try {
    await performExtensionUpdate({ remoteSha: r.remoteSha });
    return { ...r, updated: true };
  } catch (e) {
    logError("performExtensionUpdate failed:", e);
    if (!silent) toast("error", e?.message || String(e), "更新失败");
    return { ...r, updated: false, error: e };
  }
}

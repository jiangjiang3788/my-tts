// tts.js
import { $ } from "./dom.js";
import { extensionName } from "./constants.js";
import { extension_settings } from "./context.js";
import { audioState } from "./state.js";
import { log, logDebug, logError, logWarn } from "./logger.js";

/**
 * 原功能：生成 +（可选）自动播放 + 在 #tts_output 放下载链接
 * （保留给原来的“测试TTS”按钮使用）
 */
export async function generateTTS(text) {
  const apiKey = extension_settings[extensionName].apiKey;

  if (!apiKey) {
    toastr.error("请先配置API密钥", "TTS错误");
    return;
  }
  if (!text) {
    toastr.error("文本不能为空", "TTS错误");
    return;
  }
  if (audioState.isPlaying) {
    log("音频正在处理中，跳过此次请求");
    return;
  }

  try {
    log("正在生成语音...");

    const voiceValue = $("#tts_voice").val() || "alex";
    const speed = parseFloat($("#tts_speed").val()) || 1.0;
    const gain = parseFloat($("#tts_gain").val()) || 0;

    const voiceParam = voiceValue.startsWith("speech:")
      ? voiceValue
      : `FunAudioLLM/CosyVoice2-0.5B:${voiceValue}`;

    const requestBody = {
      model: "FunAudioLLM/CosyVoice2-0.5B",
      input: text,
      voice: voiceParam,
      response_format: "mp3",
      speed,
      gain
    };

    logDebug("TTS请求参数:", {
      音色: voiceParam,
      语速: speed,
      音量: gain,
      文本预览: text.substring(0, 50) + "..."
    });

    const response = await fetch(`${extension_settings[extensionName].apiUrl}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    const audio = new Audio(audioUrl);

    if (extension_settings[extensionName].autoPlay) {
      audioState.isPlaying = true;

      audio.addEventListener("ended", () => {
        audioState.isPlaying = false;
        log("音频播放完成");
      });

      audio.addEventListener("error", () => {
        audioState.isPlaying = false;
        logWarn("音频播放错误");
      });

      audio.play().catch((err) => {
        audioState.isPlaying = false;
        logError("播放失败:", err);
      });
    }

    const downloadLink = $(
      `<a href="${audioUrl}" download="tts_output.${extension_settings[extensionName].responseFormat}">下载音频</a>`
    );
    $("#tts_output").empty().append(downloadLink);

    log("语音生成成功！");
    return audioUrl;
  } catch (error) {
    logError("TTS Error:", error);
    toastr.error(`语音生成失败: ${error.message}`, "TTS错误");
  }
}

/**
 * 新增：只生成 Blob，不做 UI/播放
 * 给 message button / manager 用
 */
export async function requestTTSBlob(text) {
  const apiKey = extension_settings[extensionName].apiKey;

  if (!apiKey) throw new Error("Missing API key");
  if (!text) throw new Error("Empty text");

  const voiceValue = $("#tts_voice").val() || "alex";
  const speed = parseFloat($("#tts_speed").val()) || 1.0;
  const gain = parseFloat($("#tts_gain").val()) || 0;

  const voiceParam = voiceValue.startsWith("speech:")
    ? voiceValue
    : `FunAudioLLM/CosyVoice2-0.5B:${voiceValue}`;

  const requestBody = {
    model: "FunAudioLLM/CosyVoice2-0.5B",
    input: text,
    voice: voiceParam,
    response_format: "mp3",
    speed,
    gain
  };

  const response = await fetch(`${extension_settings[extensionName].apiUrl}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return await response.blob();
}

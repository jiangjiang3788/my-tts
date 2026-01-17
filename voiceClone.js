import { $ } from "./dom.js";
import { extensionName } from "./constants.js";
import { extension_settings } from "./context.js";
import { log, logError } from "./logger.js";
import { loadCustomVoices } from "./voices.js";

export async function uploadVoice() {
  const apiKey = extension_settings[extensionName].apiKey;
  const voiceName = $("#clone_voice_name").val();
  const voiceText = $("#clone_voice_text").val();
  const audioFile = $("#clone_voice_audio")[0].files[0];

  if (!apiKey) return toastr.error("请先配置API密钥", "克隆音色错误");
  if (!voiceName || !voiceText || !audioFile) return toastr.error("请填写音色名称、参考文本并选择音频文件", "克隆音色错误");

  const namePattern = /^[a-zA-Z0-9_-]+$/;
  if (!namePattern.test(voiceName)) return toastr.error("音色名称只能包含英文字母、数字、下划线和连字符", "格式错误");
  if (voiceName.length > 64) return toastr.error("音色名称不能超过64个字符", "格式错误");

  try {
    log("开始上传音色...");
    const reader = new FileReader();

    reader.onload = async function (e) {
      try {
        const base64Audio = e.target.result;

        const requestBody = {
          model: "FunAudioLLM/CosyVoice2-0.5B",
          customName: voiceName,
          text: voiceText,
          audio: base64Audio
        };

        const response = await fetch(`${extension_settings[extensionName].apiUrl}/uploads/audio/voice`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          // JSON 失败，转 FormData
          const formData = new FormData();
          formData.append("model", "FunAudioLLM/CosyVoice2-0.5B");
          formData.append("customName", voiceName);
          formData.append("text", voiceText);

          const base64Data = base64Audio.split(",")[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: audioFile.type });

          formData.append("audio", blob, audioFile.name);

          const response2 = await fetch(`${extension_settings[extensionName].apiUrl}/uploads/audio/voice`, {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: formData
          });

          if (!response2.ok) throw new Error(`HTTP ${response2.status}: ${await response2.text()}`);
          await response2.json();
        } else {
          await response.json();
        }

        $("#clone_voice_name").val("");
        $("#clone_voice_text").val("");
        $("#clone_voice_audio").val("");

        toastr.success(`音色 "${voiceName}" 克隆成功！`, "克隆音色");

        await loadCustomVoices();
      } catch (error) {
        logError("Voice Clone Error:", error);
        toastr.error(`音色克隆失败: ${error.message}`, "克隆音色错误");
      }
    };

    reader.readAsDataURL(audioFile);
  } catch (error) {
    logError("Voice Clone Error:", error);
    toastr.error(`音色克隆失败: ${error.message}`, "克隆音色错误");
  }
}

export async function deleteCustomVoice(uri, name) {
  const apiKey = extension_settings[extensionName].apiKey;
  if (!apiKey) return toastr.error("请先配置API密钥", "删除音色错误");
  if (!confirm(`确定要删除音色 "${name}" 吗？`)) return;

  try {
    const response = await fetch(`${extension_settings[extensionName].apiUrl}/audio/voice/deletions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uri })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    toastr.success(`音色 "${name}" 已删除`, "删除成功");
    await loadCustomVoices();
  } catch (error) {
    logError("Delete Voice Error:", error);
    toastr.error(`删除失败: ${error.message}`, "删除音色错误");
  }
}

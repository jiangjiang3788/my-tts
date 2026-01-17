// constants.js
// 这里的 extensionName 建议与扩展文件夹名、manifest.json 的 display_name 保持一致
export const extensionName = "my-tts";
export const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

export const defaultSettings = {
  apiKey: "",
  apiUrl: "https://api.siliconflow.cn/v1",
  ttsModel: "FunAudioLLM/CosyVoice2-0.5B",
  ttsVoice: "alex",
  ttsSpeed: 1.0,
  ttsGain: 0,
  responseFormat: "mp3",
  sampleRate: 32000,
  imageModel: "",
  imageSize: "512",
  textStart: "（",
  textEnd: "）",
  generationFrequency: 5,
  autoPlay: true,
  autoPlayUser: false,
  customVoices: []
};

export const TTS_MODELS = {
  "FunAudioLLM/CosyVoice2-0.5B": {
    name: "CosyVoice2-0.5B",
    voices: {
      alex: "Alex (男声)",
      anna: "Anna (女声)",
      bella: "Bella (女声)",
      benjamin: "Benjamin (男声)",
      charles: "Charles (男声)",
      claire: "Claire (女声)",
      david: "David (男声)",
      diana: "Diana (女声)"
    }
  }
};

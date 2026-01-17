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
  customVoices: [],

  // ✅ GitHub 更新检查（按文件变动/提交）
  // 支持写法：
  // - "owner/repo"
  // - "https://github.com/jiangjiang3788/my-tts"
  githubRepo: "jiangjiang3788/my-tts",
  githubBranch: "main",
  // 只检查该路径下文件变动（推荐填插件目录在仓库中的路径）
  // 例： "scripts/extensions/third-party/my-tts"
  githubPath: "",

  // 自动检查更新
  autoCheckUpdates: true,
  // 自动检查间隔（小时）
  updateCheckIntervalHours: 1,

  // 记录本地“已安装提交 sha”（用于判断是否有新变动）
  lastInstalledCommit: "",
  // 最近一次自动检查时间戳
  lastAutoCheckAt: 0,
  // 最近一次看到的远端 sha（仅用于展示/调试）
  lastRemoteCommit: ""
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

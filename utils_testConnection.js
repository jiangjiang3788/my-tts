import { $ } from "./dom.js";
import { extensionName } from "./constants.js";
import { extension_settings } from "./context.js";
import { log, logError } from "./logger.js";

export async function testConnection() {
  const apiKey = $("#siliconflow_api_key").val();
  if (!apiKey) {
    toastr.error("请先输入API密钥", "连接失败");
    return;
  }

  try {
    const response = await fetch(`${extension_settings[extensionName].apiUrl}/audio/voice/list`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });

    if (response.ok) {
      $("#connection_status").text("已连接").css("color", "green");
      log("API连接成功");
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    toastr.error(`连接失败: ${error.message}`, "硅基流动插件");
    $("#connection_status").text("未连接").css("color", "red");
    logError("API连接失败:", error);
  }
}

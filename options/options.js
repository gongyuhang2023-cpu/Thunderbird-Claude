/* ThunderCraft AI - Options Page */

(function () {
  "use strict";

  const DEFAULTS = {
    api_base_url: "https://cc1.zhihuiapi.top",
    api_key: "",
    api_model: "claude-opus-4-6",
    temperature: "0.7",
    max_tokens: 4096,
    system_prompt: ""
  };

  const DEFAULT_SYSTEM_PROMPT = "你是一位专业的邮件写作助手。请直接输出结果，不要添加额外解释、标题或署名。保持原文的语言（除非用户要求翻译）。";

  // DOM refs
  const apiBaseUrl = document.getElementById("api_base_url");
  const apiKey = document.getElementById("api_key");
  const apiModel = document.getElementById("api_model");
  const temperature = document.getElementById("temperature");
  const maxTokens = document.getElementById("max_tokens");
  const systemPrompt = document.getElementById("system_prompt");

  const btnToggleKey = document.getElementById("btn-toggle-key");
  const btnTest = document.getElementById("btn-test");
  const testResult = document.getElementById("test-result");
  const btnSave = document.getElementById("btn-save");
  const saveStatus = document.getElementById("save-status");

  // --- Load Settings ---
  async function loadSettings() {
    const stored = await browser.storage.sync.get(Object.keys(DEFAULTS));
    const settings = { ...DEFAULTS, ...stored };

    apiBaseUrl.value = settings.api_base_url;
    apiKey.value = settings.api_key;
    apiModel.value = settings.api_model;
    temperature.value = settings.temperature;
    maxTokens.value = settings.max_tokens;
    systemPrompt.value = settings.system_prompt;
    systemPrompt.placeholder = DEFAULT_SYSTEM_PROMPT;
  }

  // --- Save Settings ---
  async function saveSettings() {
    const settings = {
      api_base_url: apiBaseUrl.value.trim().replace(/\/+$/, ""),
      api_key: apiKey.value.trim(),
      api_model: apiModel.value.trim(),
      temperature: temperature.value.trim(),
      max_tokens: parseInt(maxTokens.value) || 4096,
      system_prompt: systemPrompt.value.trim()
    };

    await browser.storage.sync.set(settings);

    // Request host permission for the API URL
    if (settings.api_base_url) {
      try {
        const url = new URL(settings.api_base_url);
        const origin = url.origin + "/*";
        await browser.permissions.request({ origins: [origin] });
      } catch (e) {
        console.warn("Permission request failed:", e);
      }
    }

    saveStatus.textContent = "已保存 ✓";
    setTimeout(() => { saveStatus.textContent = ""; }, 2000);
  }

  // --- Toggle API Key Visibility ---
  btnToggleKey.addEventListener("click", () => {
    if (apiKey.type === "password") {
      apiKey.type = "text";
      btnToggleKey.textContent = "隐藏";
    } else {
      apiKey.type = "password";
      btnToggleKey.textContent = "显示";
    }
  });

  // --- Test Connection ---
  btnTest.addEventListener("click", async () => {
    // Temporarily save current values so the background script can use them
    const tempSettings = {
      api_base_url: apiBaseUrl.value.trim().replace(/\/+$/, ""),
      api_key: apiKey.value.trim(),
      api_model: apiModel.value.trim(),
      temperature: temperature.value.trim(),
      max_tokens: parseInt(maxTokens.value) || 4096,
      system_prompt: systemPrompt.value.trim()
    };
    await browser.storage.sync.set(tempSettings);

    // Request host permission first
    if (tempSettings.api_base_url) {
      try {
        const url = new URL(tempSettings.api_base_url);
        await browser.permissions.request({ origins: [url.origin + "/*"] });
      } catch { /* ignore */ }
    }

    btnTest.disabled = true;
    btnTest.textContent = "测试中...";
    testResult.textContent = "正在连接...";
    testResult.className = "test-result loading";

    try {
      const result = await browser.runtime.sendMessage({ command: "testConnection" });
      if (result.success) {
        testResult.textContent = result.message;
        testResult.className = "test-result success";
      } else {
        testResult.textContent = result.error;
        testResult.className = "test-result error";
      }
    } catch (err) {
      testResult.textContent = "测试失败: " + err.message;
      testResult.className = "test-result error";
    }

    btnTest.disabled = false;
    btnTest.textContent = "测试连接";
  });

  // --- Save ---
  btnSave.addEventListener("click", saveSettings);

  // --- Init ---
  loadSettings();

})();

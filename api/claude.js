/* ThunderCraft AI - API Client (OpenAI Compatible Format) */

var ThunderCraftAPI = {

  async getSettings() {
    const defaults = {
      api_base_url: "https://cc1.zhihuiapi.top",
      api_key: "",
      api_model: "claude-opus-4-6",
      temperature: "0.7",
      max_tokens: 4096,
      system_prompt: "你是一位专业的邮件写作助手。请直接输出结果，不要添加额外解释、标题或署名。保持原文的语言（除非用户要求翻译）。"
    };
    const stored = await browser.storage.sync.get(Object.keys(defaults));
    return { ...defaults, ...stored };
  },

  async testConnection() {
    const settings = await this.getSettings();
    if (!settings.api_key) {
      return { success: false, error: "请先填写 API Key" };
    }
    if (!settings.api_base_url) {
      return { success: false, error: "请先填写 API 地址" };
    }

    const baseUrl = settings.api_base_url.replace(/\/+$/, "");
    const body = {
      model: settings.api_model,
      max_tokens: 10,
      messages: [{ role: "user", content: "Hi" }],
      stream: false
    };

    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.api_key}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMsg;
        try {
          const errorData = JSON.parse(text);
          const code = errorData.error?.code || "";
          if (response.status === 401) {
            errorMsg = "API Key 无效";
          } else if (response.status === 404) {
            errorMsg = "API 地址错误，请检查 Base URL";
          } else if (response.status === 429) {
            errorMsg = "请求频率过高，请稍后再试";
          } else if (code === "model_not_found") {
            errorMsg = `模型 "${settings.api_model}" 不可用，请检查模型名称`;
          } else {
            errorMsg = errorData.error?.message || `HTTP ${response.status}`;
          }
        } catch {
          errorMsg = `HTTP ${response.status}: ${text.substring(0, 200)}`;
        }
        return { success: false, error: errorMsg };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        return { success: true, message: `连接成功！模型: ${data.model || settings.api_model}` };
      } else {
        return { success: false, error: "API 返回了空响应" };
      }
    } catch (err) {
      if (err.name === "TypeError" && err.message.includes("fetch")) {
        return { success: false, error: "无法连接到 API 服务器，请检查网络和地址" };
      }
      return { success: false, error: `连接失败: ${err.message}` };
    }
  },

  async fetchStream(messages, onToken, onDone, onError, abortSignal) {
    const settings = await this.getSettings();
    if (!settings.api_key) {
      onError("请先在设置中配置 API Key");
      return;
    }

    const baseUrl = settings.api_base_url.replace(/\/+$/, "");
    const allMessages = [];

    if (settings.system_prompt) {
      allMessages.push({ role: "system", content: settings.system_prompt });
    }
    allMessages.push(...messages);

    const body = {
      model: settings.api_model,
      max_tokens: parseInt(settings.max_tokens) || 4096,
      messages: allMessages,
      stream: true
    };

    const temp = parseFloat(settings.temperature);
    if (!isNaN(temp)) {
      body.temperature = temp;
    }

    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.api_key}`
        },
        body: JSON.stringify(body),
        signal: abortSignal
      });

      if (!response.ok) {
        const text = await response.text();
        try {
          const errorData = JSON.parse(text);
          const code = errorData.error?.code || "";
          if (code === "model_not_found") {
            onError(`模型 "${settings.api_model}" 不可用，请在设置中检查模型名称`);
          } else {
            onError(errorData.error?.message || `HTTP ${response.status}`);
          }
        } catch {
          onError(`HTTP ${response.status}`);
        }
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === "[DONE]") {
            onDone(fullText);
            return;
          }

          try {
            const data = JSON.parse(dataStr);
            const token = data.choices?.[0]?.delta?.content;
            if (token) {
              fullText += token;
              onToken(token);
            }
          } catch {
            // skip malformed JSON
          }
        }
      }

      // Stream ended without [DONE]
      onDone(fullText);

    } catch (err) {
      if (err.name === "AbortError") {
        onDone(null); // user cancelled
      } else {
        onError(`请求失败: ${err.message}`);
      }
    }
  }
};

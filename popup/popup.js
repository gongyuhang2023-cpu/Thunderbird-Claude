/* ThunderCraft AI - Popup Script */

(function () {
  "use strict";

  // --- DOM refs ---
  const viewActions = document.getElementById("view-actions");
  const viewInput = document.getElementById("view-input");
  const viewResult = document.getElementById("view-result");

  const noConfig = document.getElementById("no-config");
  const actionList = document.getElementById("action-list");

  const inputTitle = document.getElementById("input-title");
  const customInput = document.getElementById("custom-input");

  const resultTitle = document.getElementById("result-title");
  const resultContent = document.getElementById("result-content");
  const resultError = document.getElementById("result-error");
  const resultActions = document.getElementById("result-actions");

  const btnSettings = document.getElementById("btn-settings");
  const btnGoSettings = document.getElementById("btn-go-settings");
  const btnBackInput = document.getElementById("btn-back-input");
  const btnBackResult = document.getElementById("btn-back-result");
  const btnSend = document.getElementById("btn-send");
  const btnStop = document.getElementById("btn-stop");
  const btnInsert = document.getElementById("btn-insert");
  const btnReplace = document.getElementById("btn-replace");
  const btnReply = document.getElementById("btn-reply");
  const btnCopy = document.getElementById("btn-copy");

  // --- State ---
  let context = null;
  let currentAction = null;
  let fullResult = "";
  let isStreaming = false;

  // --- Init ---
  async function init() {
    // Check if API is configured
    const settings = await browser.storage.sync.get(["api_key"]);
    if (!settings.api_key) {
      noConfig.style.display = "block";
      actionList.style.display = "none";
    }

    // Get context from background
    context = await browser.runtime.sendMessage({ command: "getContext" });
    renderActions();
  }

  // --- Render Action List ---
  function renderActions() {
    actionList.innerHTML = "";

    // Load prompts from background
    // Since we don't have direct access to ThunderCraftPrompts in popup,
    // we maintain a local copy of the prompt definitions
    const prompts = getPromptDefs();
    const contextType = context?.tabType || "unknown";

    let lastWasCompose = null;

    for (const p of prompts) {
      // Filter by context
      if (p.type !== "both" && p.type !== contextType) continue;

      // Add separator between compose and display actions
      if (lastWasCompose !== null && (p.type === "display") !== !lastWasCompose) {
        const sep = document.createElement("div");
        sep.className = "action-separator";
        actionList.appendChild(sep);
      }
      lastWasCompose = p.type !== "display";

      const item = document.createElement("div");
      item.className = "action-item";

      // Check if action is available
      const needsSelection = p.needSelection && !context?.hasSelection && !context?.selectedText;
      const isDisabled = needsSelection;

      if (isDisabled) {
        item.classList.add("disabled");
      }

      item.innerHTML = `
        <span class="icon">${p.icon}</span>
        <span class="name">${p.name}</span>
        ${needsSelection ? '<span class="hint">需选中文本</span>' : ''}
      `;

      if (!isDisabled) {
        item.addEventListener("click", () => onActionClick(p));
      }

      actionList.appendChild(item);
    }
  }

  // --- Action Click ---
  function onActionClick(promptDef) {
    currentAction = promptDef;

    if (promptDef.needCustomText) {
      showView("input");
      inputTitle.textContent = promptDef.name;
      customInput.value = "";
      customInput.focus();
    } else {
      executeAction("");
    }
  }

  // --- Execute Action ---
  async function executeAction(customText) {
    showView("result");
    resultTitle.textContent = "AI 生成中...";
    resultContent.innerHTML = '<span class="cursor"></span>';
    resultError.style.display = "none";
    resultActions.style.display = "none";
    btnStop.style.display = "";
    fullResult = "";
    isStreaming = true;

    const message = {
      command: "executeAction",
      actionId: currentAction.id,
      tabId: context?.tabId,
      customText: customText
    };

    // Include context data
    if (context?.selectedText) {
      message.selectedText = context.selectedText;
    }
    if (context?.tabType === "display") {
      message.mailBody = context.mailBody;
      message.mailSubject = context.mailSubject;
      message.author = context.author;
      message.messageId = context.messageId;
    }

    await browser.runtime.sendMessage(message);
  }

  // --- Listen for streaming messages from background ---
  browser.runtime.onMessage.addListener((message) => {
    switch (message.command) {
      case "streamToken":
        onStreamToken(message.token);
        break;
      case "streamDone":
        onStreamDone(message.fullText);
        break;
      case "streamError":
        onStreamError(message.error);
        break;
    }
  });

  function onStreamToken(token) {
    if (!isStreaming) return;
    fullResult += token;

    // Remove cursor, add text, re-add cursor
    const cursor = resultContent.querySelector(".cursor");
    const textNode = document.createTextNode(token);
    if (cursor) {
      resultContent.insertBefore(textNode, cursor);
    } else {
      resultContent.appendChild(textNode);
    }

    // Auto-scroll
    resultContent.scrollTop = resultContent.scrollHeight;
  }

  function onStreamDone(text) {
    isStreaming = false;
    if (text !== null) {
      fullResult = text || fullResult;
    }

    // Remove cursor
    const cursor = resultContent.querySelector(".cursor");
    if (cursor) cursor.remove();

    resultTitle.textContent = "生成完成";
    btnStop.style.display = "none";

    // Show appropriate action buttons
    resultActions.style.display = "flex";

    if (currentAction) {
      const action = currentAction.action;
      const isDisplay = context?.tabType === "display";

      btnInsert.style.display = (!isDisplay && (action === "insert" || action === "replace")) ? "" : "none";
      btnReplace.style.display = (!isDisplay && action === "replace" && context?.hasSelection) ? "" : "none";
      btnReply.style.display = (action === "reply") ? "" : "none";

      // Summarize or display-tab translate: only show copy
      if (action === "display") {
        btnInsert.style.display = "none";
        btnReplace.style.display = "none";
        btnReply.style.display = "none";
      }
    }

    btnCopy.style.display = "";
  }

  function onStreamError(error) {
    isStreaming = false;
    const cursor = resultContent.querySelector(".cursor");
    if (cursor) cursor.remove();

    resultTitle.textContent = "生成失败";
    btnStop.style.display = "none";
    resultError.textContent = error;
    resultError.style.display = "block";

    // Still show copy if there's partial result
    if (fullResult) {
      resultActions.style.display = "flex";
      btnInsert.style.display = "none";
      btnReplace.style.display = "none";
      btnReply.style.display = "none";
      btnCopy.style.display = "";
    }
  }

  // --- View Switching ---
  function showView(name) {
    viewActions.style.display = name === "actions" ? "" : "none";
    viewInput.style.display = name === "input" ? "" : "none";
    viewResult.style.display = name === "result" ? "" : "none";
  }

  // --- Button Handlers ---
  btnSettings.addEventListener("click", () => {
    browser.runtime.openOptionsPage();
  });

  btnGoSettings.addEventListener("click", () => {
    browser.runtime.openOptionsPage();
  });

  btnBackInput.addEventListener("click", () => {
    showView("actions");
  });

  btnBackResult.addEventListener("click", () => {
    if (isStreaming) {
      browser.runtime.sendMessage({ command: "stopStream" });
    }
    showView("actions");
  });

  btnSend.addEventListener("click", () => {
    const text = customInput.value.trim();
    if (!text) return;
    executeAction(text);
  });

  // Ctrl+Enter to send
  customInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      btnSend.click();
    }
  });

  btnStop.addEventListener("click", () => {
    browser.runtime.sendMessage({ command: "stopStream" });
  });

  btnInsert.addEventListener("click", async () => {
    if (!fullResult) return;
    await browser.runtime.sendMessage({
      command: "insertResult",
      tabId: context.tabId,
      text: fullResult
    });
    window.close();
  });

  btnReplace.addEventListener("click", async () => {
    if (!fullResult) return;
    await browser.runtime.sendMessage({
      command: "replaceSelection",
      tabId: context.tabId,
      text: fullResult
    });
    window.close();
  });

  btnReply.addEventListener("click", async () => {
    if (!fullResult || !context?.messageId) return;
    btnReply.disabled = true;
    btnReply.textContent = "创建中...";
    await browser.runtime.sendMessage({
      command: "createReply",
      messageId: context.messageId,
      text: fullResult
    });
    window.close();
  });

  btnCopy.addEventListener("click", async () => {
    if (!fullResult) return;
    try {
      await navigator.clipboard.writeText(fullResult);
      btnCopy.textContent = "已复制 ✓";
      setTimeout(() => { btnCopy.textContent = "复制"; }, 1500);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = fullResult;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      btnCopy.textContent = "已复制 ✓";
      setTimeout(() => { btnCopy.textContent = "复制"; }, 1500);
    }
  });

  // --- Local prompt definitions (mirror of defaults.js) ---
  function getPromptDefs() {
    return [
      { id: "polish", name: "润色文本", icon: "✨", type: "compose", action: "replace", needSelection: true, needCustomText: false },
      { id: "formal", name: "正式化", icon: "👔", type: "compose", action: "replace", needSelection: true, needCustomText: false },
      { id: "casual", name: "口语化", icon: "😊", type: "compose", action: "replace", needSelection: true, needCustomText: false },
      { id: "translate_en", name: "翻译为英文", icon: "🇬🇧", type: "both", action: "replace", needSelection: false, needCustomText: false },
      { id: "translate_zh", name: "翻译为中文", icon: "🇨🇳", type: "both", action: "replace", needSelection: false, needCustomText: false },
      { id: "proofread", name: "检查语法", icon: "🔍", type: "compose", action: "replace", needSelection: false, needCustomText: false },
      { id: "write_new", name: "撰写新邮件", icon: "📧", type: "compose", action: "insert", needSelection: false, needCustomText: true },
      { id: "custom", name: "自定义指令", icon: "⚙️", type: "both", action: "replace", needSelection: false, needCustomText: true },
      { id: "reply", name: "智能回复", icon: "💬", type: "display", action: "reply", needSelection: false, needCustomText: false },
      { id: "reply_custom", name: "按要求回复", icon: "📝", type: "display", action: "reply", needSelection: false, needCustomText: true },
      { id: "summarize", name: "总结邮件", icon: "📋", type: "display", action: "display", needSelection: false, needCustomText: false }
    ];
  }

  // --- Start ---
  init();

})();

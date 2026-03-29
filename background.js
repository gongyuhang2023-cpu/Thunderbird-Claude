/* ThunderCraft AI - Background Script (Central Message Hub) */

(function () {
  "use strict";

  // --- State ---
  let currentAbortController = null;

  // --- Register compose content script ---
  browser.composeScripts.register({
    js: [{ file: "/compose-script.js" }]
  });

  // --- Context Menus ---
  function createMenus() {
    browser.menus.removeAll().then(() => {
      browser.menus.create({
        id: "thundercraft-parent",
        title: "ThunderCraft AI",
        contexts: ["compose_body"]
      });

      const quickActions = [
        { id: "polish", title: "润色文本" },
        { id: "formal", title: "正式化" },
        { id: "translate_en", title: "翻译为英文" },
        { id: "translate_zh", title: "翻译为中文" }
      ];

      for (const action of quickActions) {
        browser.menus.create({
          id: `thundercraft-${action.id}`,
          parentId: "thundercraft-parent",
          title: action.title,
          contexts: ["compose_body"]
        });
      }
    });
  }

  createMenus();

  // --- Context Menu Handler ---
  browser.menus.onClicked.addListener(async (info, tab) => {
    if (!info.menuItemId.startsWith("thundercraft-") || info.menuItemId === "thundercraft-parent") return;

    const actionId = info.menuItemId.replace("thundercraft-", "");
    const promptDef = ThunderCraftPrompts.getById(actionId);
    if (!promptDef) return;

    try {
      // Get selected text from compose editor
      const selectedText = await browser.tabs.sendMessage(tab.id, { command: "getSelectedText" });
      if (!selectedText) return;

      const resolvedPrompt = ThunderCraftPrompts.resolvePlaceholders(promptDef.prompt, {
        selectedText: selectedText
      });

      // Stream and collect full result
      let fullText = "";
      await new Promise((resolve, reject) => {
        ThunderCraftAPI.fetchStream(
          [{ role: "user", content: resolvedPrompt }],
          (token) => { fullText += token; },
          (text) => { resolve(text !== null ? text : fullText); },
          (error) => { reject(new Error(error)); }
        );
      });

      if (fullText) {
        const html = ThunderCraftHTML.textToHtml(fullText);
        await browser.tabs.sendMessage(tab.id, {
          command: "replaceSelectedText",
          html: html
        });
      }
    } catch (err) {
      console.error("ThunderCraft menu action error:", err);
    }
  });

  // --- Message Handler ---
  browser.runtime.onMessage.addListener((message, sender) => {
    switch (message.command) {

      case "getContext":
        return handleGetContext(message.tabId);

      case "executeAction":
        return handleExecuteAction(message);

      case "insertResult":
        return handleInsertResult(message);

      case "replaceSelection":
        return handleReplaceSelection(message);

      case "createReply":
        return handleCreateReply(message);

      case "stopStream":
        if (currentAbortController) {
          currentAbortController.abort();
          currentAbortController = null;
        }
        return Promise.resolve({ ok: true });

      case "testConnection":
        return ThunderCraftAPI.testConnection();

      default:
        return false;
    }
  });

  // --- Get Context ---
  async function handleGetContext(tabId) {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab) return { tabType: "unknown", tabId: null };

      const realTabId = tabId || tab.id;

      // Check if it's a compose tab
      try {
        const details = await browser.compose.getComposeDetails(realTabId);
        if (details) {
          // It's a compose tab
          let selectedText = "";
          try {
            selectedText = await browser.tabs.sendMessage(realTabId, { command: "getSelectedText" });
          } catch { /* script may not be loaded yet */ }

          return {
            tabType: "compose",
            tabId: realTabId,
            selectedText: selectedText || "",
            hasSelection: !!selectedText
          };
        }
      } catch {
        // Not a compose tab
      }

      // Check if it's a message display tab
      try {
        const msgList = await messenger.messageDisplay.getDisplayedMessages(realTabId);
        if (msgList && msgList.length > 0) {
          const msg = msgList[0];
          const fullMsg = await browser.messages.getFull(msg.id);
          const mailBody = ThunderCraftHTML.extractTextFromMimeParts(fullMsg);

          // Grab selected text via executeScript (selection persists even when grayed out)
          let selectedText = "";
          try {
            const results = await browser.tabs.executeScript(realTabId, {
              code: "window.getSelection().toString();"
            });
            selectedText = (results && results[0]) || "";
          } catch { /* executeScript may not be supported on this tab */ }

          return {
            tabType: "display",
            tabId: realTabId,
            messageId: msg.id,
            mailBody: mailBody,
            mailSubject: msg.subject || "",
            author: msg.author || "",
            selectedText: selectedText,
            hasSelection: !!selectedText
          };
        }
      } catch {
        // Not a display tab
      }

      return { tabType: "unknown", tabId: realTabId };

    } catch (err) {
      console.error("ThunderCraft getContext error:", err);
      return { tabType: "unknown", error: err.message };
    }
  }

  // --- Execute AI Action ---
  async function handleExecuteAction(message) {
    const { actionId, tabId, customText, popupTabId } = message;
    const promptDef = ThunderCraftPrompts.getById(actionId);
    if (!promptDef) return { error: "未知动作" };

    // Gather context data
    let data = { customText: customText || "" };

    // Use selectedText passed from popup if available
    if (message.selectedText) {
      data.selectedText = message.selectedText;
    }

    try {
      if ((promptDef.needSelection || promptDef.id === "custom") && !data.selectedText) {
        // Try compose content script first
        try {
          data.selectedText = await browser.tabs.sendMessage(tabId, { command: "getSelectedText" });
        } catch {
          // Fallback: executeScript for message display tabs
          try {
            const results = await browser.tabs.executeScript(tabId, {
              code: "window.getSelection().toString();"
            });
            data.selectedText = (results && results[0]) || "";
          } catch { data.selectedText = ""; }
        }
      }

      if (promptDef.id === "proofread") {
        try {
          data.typedText = await browser.tabs.sendMessage(tabId, { command: "getTypedText" });
        } catch {
          try {
            data.typedText = await browser.tabs.sendMessage(tabId, { command: "getFullBody" });
          } catch { data.typedText = ""; }
        }
      }

      if (promptDef.type === "display" || promptDef.type === "both") {
        if (message.mailBody) {
          data.mailBody = message.mailBody;
          data.mailSubject = message.mailSubject || "";
          data.author = message.author || "";
        }
      }

      // Resolve prompt
      const resolvedPrompt = ThunderCraftPrompts.resolvePlaceholders(promptDef.prompt, data);

      // Abort previous stream
      if (currentAbortController) {
        currentAbortController.abort();
      }
      currentAbortController = new AbortController();

      // Start streaming
      ThunderCraftAPI.fetchStream(
        [{ role: "user", content: resolvedPrompt }],
        (token) => {
          // Forward token to popup
          browser.runtime.sendMessage({
            command: "streamToken",
            token: token
          }).catch(() => { /* popup might be closed */ });
        },
        (fullText) => {
          currentAbortController = null;
          browser.runtime.sendMessage({
            command: "streamDone",
            fullText: fullText
          }).catch(() => {});
        },
        (error) => {
          currentAbortController = null;
          browser.runtime.sendMessage({
            command: "streamError",
            error: error
          }).catch(() => {});
        },
        currentAbortController.signal
      );

      return { ok: true };

    } catch (err) {
      return { error: err.message };
    }
  }

  // --- Insert Result into Compose Editor ---
  async function handleInsertResult(message) {
    const { tabId, text } = message;
    try {
      const html = ThunderCraftHTML.textToHtml(text);
      const details = await browser.compose.getComposeDetails(tabId);
      const currentBody = details.body || "";

      // Find the quoted content marker and insert before it
      const quoteMarker = currentBody.indexOf('<div class="moz-cite-prefix"');
      const blockquoteMarker = currentBody.indexOf('<blockquote');
      const insertPos = Math.min(
        quoteMarker >= 0 ? quoteMarker : Infinity,
        blockquoteMarker >= 0 ? blockquoteMarker : Infinity
      );

      let newBody;
      if (insertPos < Infinity) {
        newBody = html + "<br><br>" + currentBody.substring(insertPos);
      } else {
        // Replace body content inside <body> tags
        const bodyMatch = currentBody.match(/(<body[^>]*>)([\s\S]*?)(<\/body>)/i);
        if (bodyMatch) {
          newBody = bodyMatch[1] + html + bodyMatch[3];
        } else {
          newBody = html;
        }
      }

      await browser.compose.setComposeDetails(tabId, { body: newBody });
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  // --- Replace Selection ---
  async function handleReplaceSelection(message) {
    const { tabId, text } = message;
    try {
      const html = ThunderCraftHTML.textToHtml(text);
      await browser.tabs.sendMessage(tabId, {
        command: "replaceSelectedText",
        html: html
      });
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  // --- Create Reply ---
  async function handleCreateReply(message) {
    const { messageId, text } = message;
    try {
      const html = ThunderCraftHTML.textToHtml(text);
      const tab = await browser.compose.beginReply(messageId, "replyToSender");

      // Wait for compose tab to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      const details = await browser.compose.getComposeDetails(tab.id);
      const currentBody = details.body || "";

      // Insert AI text before the quoted content
      const quoteMarker = currentBody.indexOf('<div class="moz-cite-prefix"');
      const blockquoteMarker = currentBody.indexOf('<blockquote');
      const insertPos = Math.min(
        quoteMarker >= 0 ? quoteMarker : Infinity,
        blockquoteMarker >= 0 ? blockquoteMarker : Infinity
      );

      let newBody;
      if (insertPos < Infinity) {
        newBody = currentBody.substring(0, insertPos) + html + "<br><br>" + currentBody.substring(insertPos);
      } else {
        const bodyMatch = currentBody.match(/(<body[^>]*>)([\s\S]*?)(<\/body>)/i);
        if (bodyMatch) {
          newBody = bodyMatch[1] + html + "<br><br>" + bodyMatch[2] + bodyMatch[3];
        } else {
          newBody = html + "<br><br>" + currentBody;
        }
      }

      await browser.compose.setComposeDetails(tab.id, { body: newBody });
      return { ok: true, tabId: tab.id };
    } catch (err) {
      return { error: err.message };
    }
  }

})();

/* ThunderCraft AI - Default Prompts */

var ThunderCraftPrompts = {

  defaults: [
    {
      id: "polish",
      name: "润色文本",
      icon: "✨",
      type: "compose",
      action: "replace",
      needSelection: true,
      needCustomText: false,
      prompt: "请润色以下邮件文本，使其更加流畅自然、措辞得体，保持原意不变。只输出润色后的文本，不要添加任何解释。\n\n原文：\n{%selected_text%}"
    },
    {
      id: "formal",
      name: "正式化",
      icon: "👔",
      type: "compose",
      action: "replace",
      needSelection: true,
      needCustomText: false,
      prompt: "请将以下文本改写为正式的学术/商务邮件风格，措辞专业得体，保持原意不变。只输出改写后的文本。\n\n原文：\n{%selected_text%}"
    },
    {
      id: "casual",
      name: "口语化",
      icon: "😊",
      type: "compose",
      action: "replace",
      needSelection: true,
      needCustomText: false,
      prompt: "请将以下文本改写为轻松友好的口语风格，保持原意不变。只输出改写后的文本。\n\n原文：\n{%selected_text%}"
    },
    {
      id: "translate_en",
      name: "翻译为英文",
      icon: "🇬🇧",
      type: "both",
      action: "replace",
      needSelection: true,
      needCustomText: false,
      prompt: "请将以下文本翻译为地道的英文。只输出翻译结果，不要添加任何解释。\n\n原文：\n{%selected_text%}"
    },
    {
      id: "translate_zh",
      name: "翻译为中文",
      icon: "🇨🇳",
      type: "both",
      action: "replace",
      needSelection: true,
      needCustomText: false,
      prompt: "Please translate the following text into fluent Simplified Chinese. Only output the translation, no explanations.\n\nOriginal:\n{%selected_text%}"
    },
    {
      id: "reply",
      name: "智能回复",
      icon: "💬",
      type: "display",
      action: "reply",
      needSelection: false,
      needCustomText: false,
      prompt: "请根据以下邮件内容，撰写一封专业得体的回复邮件。只输出回复正文，不要包含主题行或署名。\n\n来信主题：{%mail_subject%}\n发件人：{%author%}\n\n来信内容：\n{%mail_body%}"
    },
    {
      id: "reply_custom",
      name: "按要求回复",
      icon: "📝",
      type: "display",
      action: "reply",
      needSelection: false,
      needCustomText: true,
      prompt: "请根据以下邮件内容和我的要求，撰写一封回复邮件。只输出回复正文，不要包含主题行或署名。\n\n来信主题：{%mail_subject%}\n发件人：{%author%}\n\n来信内容：\n{%mail_body%}\n\n我的要求：{%custom_text%}"
    },
    {
      id: "write_new",
      name: "撰写新邮件",
      icon: "📧",
      type: "compose",
      action: "insert",
      needSelection: false,
      needCustomText: true,
      prompt: "请根据以下要求撰写一封邮件。只输出邮件正文，不要包含主题行或署名。\n\n要求：{%custom_text%}"
    },
    {
      id: "proofread",
      name: "检查语法",
      icon: "🔍",
      type: "compose",
      action: "replace",
      needSelection: false,
      needCustomText: false,
      prompt: "请检查并修正以下邮件文本中的语法、拼写和标点错误。只输出修正后的文本，不要添加任何说明。如果没有错误，原样输出即可。\n\n原文：\n{%typed_text%}"
    },
    {
      id: "summarize",
      name: "总结邮件",
      icon: "📋",
      type: "display",
      action: "display",
      needSelection: false,
      needCustomText: false,
      prompt: "请用中文简要总结以下邮件的核心内容（3-5个要点）。\n\n主题：{%mail_subject%}\n\n邮件内容：\n{%mail_body%}"
    },
    {
      id: "custom",
      name: "自定义指令",
      icon: "⚙️",
      type: "both",
      action: "replace",
      needSelection: false,
      needCustomText: true,
      prompt: "{%custom_text%}\n\n{%selected_text%}"
    }
  ],

  getByContext(context) {
    return this.defaults.filter(p => p.type === "both" || p.type === context);
  },

  getById(id) {
    return this.defaults.find(p => p.id === id);
  },

  resolvePlaceholders(template, data) {
    return template
      .replace(/\{%selected_text%\}/g, data.selectedText || "")
      .replace(/\{%typed_text%\}/g, data.typedText || data.selectedText || "")
      .replace(/\{%mail_body%\}/g, data.mailBody || "")
      .replace(/\{%mail_subject%\}/g, data.mailSubject || "")
      .replace(/\{%author%\}/g, data.author || "")
      .replace(/\{%custom_text%\}/g, data.customText || "");
  }
};

/* ThunderCraft AI - HTML Utilities */

var ThunderCraftHTML = {

  // Default email font style
  FONT_STYLE: 'font-family: Calibri, Arial, sans-serif; font-size: medium; color: #000000; line-height: 1.15;',

  textToHtml(text) {
    if (!text) return "";

    // 1. Escape HTML entities
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 2. Convert Markdown bold **text** or __text__
    html = html.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    html = html.replace(/__(.+?)__/g, "<b>$1</b>");

    // 3. Convert Markdown italic *text* or _text_ (but not inside bold tags)
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<i>$1</i>");
    html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "<i>$1</i>");

    // 4. Convert Markdown lists
    const lines = html.split("\n");
    const result = [];
    let inList = false;
    let listType = null; // "ul" or "ol"

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Ordered list: "1. ", "2. ", etc.
      const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
      // Unordered list: "- " or "* "
      const ulMatch = line.match(/^[\-\*]\s+(.+)$/);

      if (olMatch) {
        if (!inList || listType !== "ol") {
          if (inList) result.push(`</${listType}>`);
          result.push("<ol>");
          inList = true;
          listType = "ol";
        }
        result.push(`<li>${olMatch[2]}</li>`);
      } else if (ulMatch) {
        if (!inList || listType !== "ul") {
          if (inList) result.push(`</${listType}>`);
          result.push("<ul>");
          inList = true;
          listType = "ul";
        }
        result.push(`<li>${ulMatch[1]}</li>`);
      } else {
        if (inList) {
          result.push(`</${listType}>`);
          inList = false;
          listType = null;
        }
        result.push(line);
      }
    }
    if (inList) result.push(`</${listType}>`);

    html = result.join("\n");

    // 5. Convert paragraphs: double newlines → paragraph break, single → <br>
    const paragraphs = html.split(/\n\n+/);
    if (paragraphs.length > 1) {
      html = paragraphs
        .map(p => p.trim())
        .filter(p => p)
        .map(p => `<div style="margin-bottom: 0.5em;">${p.replace(/\n/g, "<br>")}</div>`)
        .join("");
    } else {
      html = html.replace(/\n/g, "<br>");
    }

    // 6. Wrap in default font
    return `<div style="${this.FONT_STYLE}">${html}</div>`;
  },

  htmlToText(html) {
    if (!html) return "";
    const tmp = new DOMParser().parseFromString(html, "text/html");
    return tmp.body.textContent || "";
  },

  extractTextFromMimeParts(part) {
    if (!part) return "";

    if (part.contentType === "text/plain" && part.body) {
      return part.body;
    }

    if (part.contentType === "text/html" && part.body) {
      return this.htmlToText(part.body);
    }

    if (part.parts) {
      for (const sub of part.parts) {
        if (sub.contentType === "text/plain" && sub.body) {
          return sub.body;
        }
      }
      for (const sub of part.parts) {
        const text = this.extractTextFromMimeParts(sub);
        if (text) return text;
      }
    }

    return "";
  }
};

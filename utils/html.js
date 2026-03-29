/* ThunderCraft AI - HTML Utilities */

var ThunderCraftHTML = {

  textToHtml(text) {
    if (!text) return "";
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Convert double newlines to paragraphs, single newlines to <br>
    const paragraphs = html.split(/\n\n+/);
    if (paragraphs.length > 1) {
      html = paragraphs.map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
    } else {
      html = html.replace(/\n/g, "<br>");
    }
    return html;
  },

  htmlToText(html) {
    if (!html) return "";
    const tmp = new DOMParser().parseFromString(html, "text/html");
    return tmp.body.textContent || "";
  },

  extractTextFromMimeParts(part) {
    if (!part) return "";

    // Prefer text/plain
    if (part.contentType === "text/plain" && part.body) {
      return part.body;
    }

    // Fallback to text/html stripped
    if (part.contentType === "text/html" && part.body) {
      return this.htmlToText(part.body);
    }

    // Recurse into multipart
    if (part.parts) {
      // Try text/plain first
      for (const sub of part.parts) {
        if (sub.contentType === "text/plain" && sub.body) {
          return sub.body;
        }
      }
      // Fallback: recurse
      for (const sub of part.parts) {
        const text = this.extractTextFromMimeParts(sub);
        if (text) return text;
      }
    }

    return "";
  }
};

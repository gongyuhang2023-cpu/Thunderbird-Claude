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

  // Extract font style from existing compose body HTML and wrap new content to match
  matchBodyFont(existingBodyHtml, newHtml) {
    if (!existingBodyHtml || !newHtml) return newHtml;

    // Try to find font info from <font> tags (Thunderbird commonly uses these)
    const fontMatch = existingBodyHtml.match(/<font[^>]*face="([^"]+)"[^>]*>/i);
    const sizeMatch = existingBodyHtml.match(/<font[^>]*size="([^"]+)"[^>]*>/i);
    const colorMatch = existingBodyHtml.match(/<font[^>]*color="([^"]+)"[^>]*>/i);

    // Also try inline style on body tag
    const bodyStyleMatch = existingBodyHtml.match(/<body[^>]*style="([^"]+)"[^>]*/i);
    let bodyFontFamily = "";
    let bodyFontSize = "";
    let bodyColor = "";
    if (bodyStyleMatch) {
      const s = bodyStyleMatch[1];
      const ff = s.match(/font-family:\s*([^;]+)/i);
      const fs = s.match(/font-size:\s*([^;]+)/i);
      const fc = s.match(/(?:^|;)\s*color:\s*([^;]+)/i);
      if (ff) bodyFontFamily = ff[1].trim();
      if (fs) bodyFontSize = fs[1].trim();
      if (fc) bodyColor = fc[1].trim();
    }

    const face = fontMatch ? fontMatch[1] : bodyFontFamily;
    const size = sizeMatch ? sizeMatch[1] : "";
    const color = colorMatch ? colorMatch[1] : bodyColor;

    if (!face && !bodyFontSize && !size) return newHtml;

    // Use <font> tag to match Thunderbird's native format
    const attrs = [];
    if (face) attrs.push(`face="${face}"`);
    if (size) attrs.push(`size="${size}"`);
    if (color) attrs.push(`color="${color}"`);

    // Also add inline style for font-size if we got it from body style
    let style = "";
    if (bodyFontSize) style += `font-size: ${bodyFontSize};`;
    if (style) attrs.push(`style="${style}"`);

    return `<font ${attrs.join(" ")}>${newHtml}</font>`;
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

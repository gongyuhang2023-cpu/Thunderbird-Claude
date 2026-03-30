/* ThunderCraft AI - Compose Script (injected into compose windows) */

browser.runtime.onMessage.addListener((message) => {
  switch (message.command) {

    case "getSelectedText": {
      const sel = window.getSelection();
      return Promise.resolve(sel ? sel.toString() : "");
    }

    case "getSelectedHtml": {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return Promise.resolve("");
      const range = sel.getRangeAt(0);
      const div = document.createElement("div");
      div.appendChild(range.cloneContents());
      return Promise.resolve(div.innerHTML);
    }

    case "replaceSelectedText": {
      // Read the editor's current font style to match inserted text
      const style = getEditorFontStyle();
      const styledHtml = applyFontStyle(message.html, style);

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        // No selection: insert at end of body (before any quotes)
        const citePrefix = document.querySelector(".moz-cite-prefix");
        const blockquote = document.querySelector('blockquote[type="cite"]');
        const insertBefore = citePrefix || blockquote;

        const frag = htmlToFragment(styledHtml);

        if (insertBefore) {
          document.body.insertBefore(frag, insertBefore);
        } else {
          document.body.appendChild(frag);
        }
        return Promise.resolve(true);
      }

      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(htmlToFragment(styledHtml));
      sel.collapseToEnd();
      return Promise.resolve(true);
    }

    case "getFullBody": {
      return Promise.resolve(document.body.innerText || "");
    }

    case "getTypedText": {
      let text = "";
      for (const node of document.body.childNodes) {
        if (node instanceof Element) {
          if (node.classList.contains("moz-cite-prefix") ||
              node.classList.contains("moz-forward-container") ||
              node.tagName === "BLOCKQUOTE") {
            break;
          }
          if (node.classList.contains("moz-signature")) {
            continue;
          }
        }
        text += node.textContent || "";
      }
      return Promise.resolve(text.trim());
    }

    default:
      return false;
  }
});

// --- Helpers ---

function htmlToFragment(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const frag = document.createDocumentFragment();
  for (const child of [...doc.body.childNodes]) {
    frag.appendChild(child.cloneNode(true));
  }
  return frag;
}

function getEditorFontStyle() {
  // Try to read font from existing body content or body computed style
  const firstTextNode = document.body.querySelector("p, div, span, font, br");
  const refElement = firstTextNode || document.body;
  const cs = window.getComputedStyle(refElement);

  return {
    fontFamily: cs.fontFamily || "",
    fontSize: cs.fontSize || "",
    color: cs.color || ""
  };
}

function applyFontStyle(html, style) {
  if (!style.fontFamily && !style.fontSize) return html;

  // Build inline style string
  const parts = [];
  if (style.fontFamily) parts.push(`font-family: ${style.fontFamily}`);
  if (style.fontSize) parts.push(`font-size: ${style.fontSize}`);
  if (style.color) parts.push(`color: ${style.color}`);
  const css = parts.join("; ");

  // Wrap the HTML in a span with the editor's font style
  return `<span style="${css}">${html}</span>`;
}

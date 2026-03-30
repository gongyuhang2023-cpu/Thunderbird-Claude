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
      const frag = htmlToFragment(message.html);
      const sel = window.getSelection();

      if (!sel || sel.rangeCount === 0) {
        // No selection: insert before quotes
        const citePrefix = document.querySelector(".moz-cite-prefix");
        const blockquote = document.querySelector('blockquote[type="cite"]');
        const insertBefore = citePrefix || blockquote;

        if (insertBefore) {
          document.body.insertBefore(frag, insertBefore);
        } else {
          document.body.appendChild(frag);
        }
        return Promise.resolve(true);
      }

      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(frag);
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

function htmlToFragment(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const frag = document.createDocumentFragment();
  for (const child of [...doc.body.childNodes]) {
    frag.appendChild(child.cloneNode(true));
  }
  return frag;
}

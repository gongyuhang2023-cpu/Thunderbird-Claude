/* ThunderCraft AI - Display Script (injected into message display) */

browser.runtime.onMessage.addListener((message) => {
  switch (message.command) {

    case "getDisplayedText": {
      return Promise.resolve(document.body.innerText || "");
    }

    case "getDisplayedHtml": {
      return Promise.resolve(document.body.innerHTML || "");
    }

    default:
      return false;
  }
});

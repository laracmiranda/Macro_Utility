// background.js - Gerencia mensagens para fallback

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getMacros') {
    chrome.storage.local.get('macros', (result) => {
      sendResponse({ macros: result.macros || [] });
    });
    return true;  // Resposta assíncrona
  }
});
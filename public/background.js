const CONTEXT_TEXT_KEY = 'instacal_context_text';

chrome.runtime.onInstalled.addListener(() => {
    console.log('InstaCal installed!');
    chrome.contextMenus.create({
        id: 'add-to-instacal',
        title: 'Add to InstaCal',
        contexts: ['selection'],
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'add-to-instacal' || !info.selectionText) return;
    const text = info.selectionText.trim();
    if (!text) return;

    chrome.storage.local.set({ [CONTEXT_TEXT_KEY]: text }, () => {
        chrome.windows.create({
            url: chrome.runtime.getURL('index.html'),
            type: 'popup',
            width: 380,
            height: 340,
        });
    });
});

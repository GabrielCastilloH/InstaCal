export function sendMessage(msg: object): Promise<Record<string, unknown>> {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

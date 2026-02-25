export async function getAuthTokenInteractive(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Auth failed: ${chrome.runtime.lastError.message}`))
        return
      }
      const token = typeof result === 'string' ? result : result?.token
      if (!token) {
        reject(new Error('Auth failed: no token returned'))
        return
      }
      resolve(token)
    })
  })
}

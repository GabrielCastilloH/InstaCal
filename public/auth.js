// This page runs in a full browser tab, so it stays alive while the OAuth
// window is open (unlike the extension popup which closes on focus loss).

(async function () {
  const statusEl = document.getElementById('status');

  try {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('client_id');
    if (!clientId) throw new Error('Missing client_id parameter');

    const redirectUrl = chrome.identity.getRedirectURL();
    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('redirect_uri', redirectUrl);
    authUrl.searchParams.set('scope', scopes.join(' '));

    const responseUrl = await new Promise(function (resolve, reject) {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl.toString(), interactive: true },
        function (redirectResponse) {
          if (chrome.runtime.lastError || !redirectResponse) {
            reject(new Error(chrome.runtime.lastError?.message || 'Auth cancelled'));
          } else {
            resolve(redirectResponse);
          }
        }
      );
    });

    const hashParams = new URLSearchParams(new URL(responseUrl).hash.slice(1));
    const accessToken = hashParams.get('access_token');
    if (!accessToken) throw new Error('No access token in response');

    var expiresIn = parseInt(hashParams.get('expires_in') || '3600', 10);

    // Store the token and expiry for the popup to pick up
    await chrome.storage.local.set({
      instacal_google_calendar_token: accessToken,
      instacal_google_calendar_token_expiry: Date.now() + expiresIn * 1000,
    });

    window.close();

  } catch (err) {
    statusEl.innerHTML = '<span class="err">Sign-in failed: ' + err.message + '</span>' +
      '<div class="sub">Close this tab and try again from InstaCal.</div>';
  }
})();

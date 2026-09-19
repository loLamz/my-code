'use strict';

const crypto = require('crypto');

// Offline accounts use the same algorithm the vanilla client itself uses
// when it can't reach Mojang: UUID v3 (name-based, MD5) of "OfflinePlayer:<name>".
function offlineUuid(username) {
  const md5 = crypto.createHash('md5').update(`OfflinePlayer:${username}`, 'utf8').digest();
  md5[6] = (md5[6] & 0x0f) | 0x30; // version 3
  md5[8] = (md5[8] & 0x3f) | 0x80; // RFC4122 variant
  const hex = md5.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function createOfflineAccount(username) {
  return {
    id: crypto.randomUUID(),
    type: 'offline',
    username,
    uuid: offlineUuid(username),
    accessToken: '0',
  };
}

// --- Microsoft account (device code flow) -----------------------------
// Real Minecraft accounts require the full MSA -> Xbox Live -> XSTS ->
// Minecraft services chain, and a registered Azure AD application client
// ID. CircuitMC ships without one (that requires registering your own app
// with Microsoft and agreeing to their terms), so this path only activates
// once the user pastes their own client ID into Settings > Accounts. The
// offline path above is the default and is what "Launch" uses out of the box.
const MSA_AUTHORITY = 'https://login.microsoftonline.com/consumers';
const MSA_SCOPE = 'XboxLive.signin offline_access';

async function startDeviceCodeFlow(clientId) {
  if (!clientId) throw new Error('No Microsoft Azure AD client ID configured in Settings.');
  const res = await fetch(`${MSA_AUTHORITY}/oauth2/v2.0/devicecode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, scope: MSA_SCOPE }),
  });
  if (!res.ok) throw new Error(`Device code request failed: ${res.status}`);
  return res.json(); // { device_code, user_code, verification_uri, interval, expires_in }
}

async function pollDeviceCodeFlow(clientId, deviceCode) {
  const res = await fetch(`${MSA_AUTHORITY}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: clientId,
      device_code: deviceCode,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (data.error === 'authorization_pending') return { pending: true };
    throw new Error(data.error_description || data.error || 'Microsoft sign-in failed');
  }
  return { pending: false, tokens: data };
}

async function xboxLiveAndMinecraftAuth(msaAccessToken) {
  const xblRes = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${msaAccessToken}` },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    }),
  });
  const xbl = await xblRes.json();
  const xstsRes = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.Token] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    }),
  });
  const xsts = await xstsRes.json();
  if (!xstsRes.ok) throw new Error('Xbox Live authorization failed (does this account own Minecraft?)');
  const uhs = xsts.DisplayClaims.xui[0].uhs;

  const mcRes = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${uhs};${xsts.Token}` }),
  });
  const mc = await mcRes.json();

  const profileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { Authorization: `Bearer ${mc.access_token}` },
  });
  if (!profileRes.ok) throw new Error('This Microsoft account does not own Minecraft.');
  const profile = await profileRes.json();

  return {
    id: crypto.randomUUID(),
    type: 'microsoft',
    username: profile.name,
    uuid: profile.id,
    accessToken: mc.access_token,
  };
}

module.exports = {
  offlineUuid,
  createOfflineAccount,
  startDeviceCodeFlow,
  pollDeviceCodeFlow,
  xboxLiveAndMinecraftAuth,
};

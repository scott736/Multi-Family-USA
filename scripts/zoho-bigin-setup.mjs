#!/usr/bin/env node
/**
 * One-time Zoho Bigin OAuth helper for FirstHomeGuide.ca.
 *
 * 1. Create a Server-based Application at https://api-console.zoho.com/
 * 2. Add redirect URI: http://localhost:8787/oauth/callback
 * 3. Scopes:
 *    - ZohoBigin.modules.contacts.ALL
 *    - ZohoBigin.modules.pipelines.ALL
 * 4. Run:
 *      ZOHO_BIGIN_CLIENT_ID=... ZOHO_BIGIN_CLIENT_SECRET=... node scripts/zoho-bigin-setup.mjs
 */

import http from 'node:http';
import { URL } from 'node:url';

const CLIENT_ID = process.env.ZOHO_BIGIN_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_BIGIN_CLIENT_SECRET;
const ACCOUNTS_URL = process.env.ZOHO_BIGIN_ACCOUNTS_URL || 'https://accounts.zoho.com';
const REDIRECT_URI = process.env.ZOHO_BIGIN_REDIRECT_URI || 'http://localhost:8787/oauth/callback';
const SCOPES = [
  'ZohoBigin.modules.contacts.ALL',
  'ZohoBigin.modules.pipelines.ALL',
].join(',');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    'Set ZOHO_BIGIN_CLIENT_ID and ZOHO_BIGIN_CLIENT_SECRET before running this script.',
  );
  process.exit(1);
}

const authUrl = new URL(`${ACCOUNTS_URL}/oauth/v2/auth`);
authUrl.searchParams.set('scope', SCOPES);
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);

console.log('\nOpen this URL in your browser and approve access:\n');
console.log(authUrl.toString());
console.log('\nWaiting for OAuth callback on', REDIRECT_URI, '...\n');

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', REDIRECT_URI);
  if (requestUrl.pathname !== '/oauth/callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const code = requestUrl.searchParams.get('code');
  if (!code) {
    res.writeHead(400);
    res.end('Missing authorization code');
    return;
  }

  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    code,
  });

  const tokenResponse = await fetch(
    `${ACCOUNTS_URL}/oauth/v2/token?${tokenParams.toString()}`,
    { method: 'POST' },
  );
  const tokenData = await tokenResponse.json();

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Authorization complete. Return to the terminal.');

  server.close();

  if (!tokenResponse.ok || !tokenData.refresh_token) {
    console.error('Token exchange failed:', tokenData);
    process.exit(1);
  }

  console.log('Success. Add these to Vercel production env:\n');
  console.log(`ZOHO_BIGIN_CLIENT_ID=${CLIENT_ID}`);
  console.log(`ZOHO_BIGIN_CLIENT_SECRET=${CLIENT_SECRET}`);
  console.log(`ZOHO_BIGIN_REFRESH_TOKEN=${tokenData.refresh_token}`);
  console.log('\nExample:\n');
  console.log(`vercel env add ZOHO_BIGIN_CLIENT_ID production`);
  console.log(`vercel env add ZOHO_BIGIN_CLIENT_SECRET production`);
  console.log(`vercel env add ZOHO_BIGIN_REFRESH_TOKEN production`);
  console.log('\nThen redeploy firsthomeguide on Vercel.');
});

server.listen(8787, '127.0.0.1');

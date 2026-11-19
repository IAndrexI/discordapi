import { chromium } from 'playwright';
import path from 'path';

async function captureAllStoreScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // Mock Matrix API network routes so the real app UI renders in local preview without network errors
  await page.route('**/_matrix/client/v3/sync*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        next_batch: 's1',
        presence: { events: [] },
        rooms: {
          join: {
            '!general:chat.protutech.vip': {
              timeline: {
                events: [
                  {
                    type: 'm.room.message',
                    event_id: '$m1',
                    sender: '@alex:chat.protutech.vip',
                    origin_server_ts: Date.now() - 600000,
                    content: { msgtype: 'm.text', body: 'Welcome to Protutech! Ultra-low latency voice and full gaming sync ready.' }
                  },
                  {
                    type: 'm.room.message',
                    event_id: '$m2',
                    sender: '@sarah:chat.protutech.vip',
                    origin_server_ts: Date.now() - 300000,
                    content: { msgtype: 'm.text', body: 'Just tested the Studio FX camera background blur, works super smooth!' }
                  },
                  {
                    type: 'm.room.message',
                    event_id: '$m3',
                    sender: '@andrex:chat.protutech.vip',
                    origin_server_ts: Date.now() - 60000,
                    content: { msgtype: 'm.text', body: 'Hop in the 48kHz voice channel, setting up the multiplayer party now 🎮' }
                  }
                ]
              }
            }
          }
        }
      })
    });
  });

  await page.route('**/_matrix/client/v3/joined_rooms*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        joined_rooms: ['!general:chat.protutech.vip', '!gaming:chat.protutech.vip']
      })
    });
  });

  await page.route('**/_matrix/client/v3/rooms/*/state*', async route => {
    const url = route.request().url();
    const isGaming = url.includes('gaming');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { type: 'm.room.name', content: { name: isGaming ? 'gaming-lounge' : 'general-chat' } },
        { type: 'm.room.topic', content: { topic: isGaming ? 'Multiplayer game lobbies, Steam invites & party chat' : 'Community hub, announcements, and tech discussion' } },
        { type: 'm.room.member', state_key: '@andrex:chat.protutech.vip', content: { displayname: 'Andrex (Host)', membership: 'join' } },
        { type: 'm.room.member', state_key: '@alex:chat.protutech.vip', content: { displayname: 'AlexG', membership: 'join' } },
        { type: 'm.room.member', state_key: '@sarah:chat.protutech.vip', content: { displayname: 'SarahL', membership: 'join' } }
      ])
    });
  });

  await page.route('**/_matrix/client/v3/rooms/*/messages*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        chunk: [
          {
            type: 'm.room.message',
            event_id: '$m1',
            sender: '@alex:chat.protutech.vip',
            origin_server_ts: Date.now() - 600000,
            content: { msgtype: 'm.text', body: 'Welcome to Protutech! Ultra-low latency voice and full gaming sync ready.' }
          },
          {
            type: 'm.room.message',
            event_id: '$m2',
            sender: '@sarah:chat.protutech.vip',
            origin_server_ts: Date.now() - 300000,
            content: { msgtype: 'm.text', body: 'Just tested the Studio FX camera background blur, works super smooth!' }
          },
          {
            type: 'm.room.message',
            event_id: '$m3',
            sender: '@andrex:chat.protutech.vip',
            origin_server_ts: Date.now() - 60000,
            content: { msgtype: 'm.text', body: 'Hop in the 48kHz voice channel, setting up the multiplayer party now 🎮' }
          }
        ]
      })
    });
  });

  // 1. Capture App Main Chat UI
  await page.goto('http://localhost:4173', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('matrix_access_token', 'demo_active_token_123');
    localStorage.setItem('matrix_user_id', '@andrex:chat.protutech.vip');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const shot1 = path.resolve('screenshot_1_chat_channels.png');
  await page.screenshot({ path: shot1 });
  console.log('Saved screenshot_1_chat_channels.png');

  // 2. Open Settings (Theme & Appearance)
  try {
    const settingsBtn = await page.$('button[title="User Settings"], button[title*="Settings"]');
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForTimeout(1000);
      const shot2 = path.resolve('screenshot_2_appearance_settings.png');
      await page.screenshot({ path: shot2 });
      console.log('Saved screenshot_2_appearance_settings.png');
    }
  } catch (e) {
    console.log('Settings capture note:', e.message);
  }

  // 3. Official Website Landing Page
  const landingFile = path.resolve('../index.html');
  await page.goto(`file:///${landingFile.replace(/\\/g, '/')}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const shot3 = path.resolve('screenshot_3_website_landing.png');
  await page.screenshot({ path: shot3 });
  console.log('Saved screenshot_3_website_landing.png');

  // 4. Website Performance Architecture Section
  await page.evaluate(() => {
    const el = document.getElementById('architecture') || document.querySelector('section');
    if (el) el.scrollIntoView();
  });
  await page.waitForTimeout(1000);
  const shot4 = path.resolve('screenshot_4_voice_architecture.png');
  await page.screenshot({ path: shot4 });
  console.log('Saved screenshot_4_voice_architecture.png');

  await browser.close();
  console.log('All store screenshots captured successfully!');
}

captureAllStoreScreenshots().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

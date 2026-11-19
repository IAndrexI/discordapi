import { chromium } from 'playwright';
import path from 'path';

async function captureAppUI() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // Mock Matrix API network routes so actual chat view renders in local preview without hitting live homeserver
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
                    content: { msgtype: 'm.text', body: 'Welcome to ProtutechChat! Ultra-low latency voice and full gaming sync ready.' }
                  },
                  {
                    type: 'm.room.message',
                    event_id: '$m2',
                    sender: '@sarah:chat.protutech.vip',
                    origin_server_ts: Date.now() - 300000,
                    content: { msgtype: 'm.text', body: 'Just tested the custom webcam background blur, works smooth on desktop!' }
                  },
                  {
                    type: 'm.room.message',
                    event_id: '$m3',
                    sender: '@andrex:chat.protutech.vip',
                    origin_server_ts: Date.now() - 60000,
                    content: { msgtype: 'm.text', body: 'Hop in the 48kHz voice channel, setting up the Minecraft server RCON console now ⛏️' }
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
            content: { msgtype: 'm.text', body: 'Welcome to ProtutechChat! Ultra-low latency voice and full gaming sync ready.' }
          },
          {
            type: 'm.room.message',
            event_id: '$m2',
            sender: '@sarah:chat.protutech.vip',
            origin_server_ts: Date.now() - 300000,
            content: { msgtype: 'm.text', body: 'Just tested the custom webcam background blur, works smooth on desktop!' }
          },
          {
            type: 'm.room.message',
            event_id: '$m3',
            sender: '@andrex:chat.protutech.vip',
            origin_server_ts: Date.now() - 60000,
            content: { msgtype: 'm.text', body: 'Hop in the 48kHz voice channel, setting up the Minecraft server RCON console now ⛏️' }
          }
        ]
      })
    });
  });

  await page.goto('http://localhost:4173', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('matrix_access_token', 'demo_active_token_123');
    localStorage.setItem('matrix_user_id', '@andrex:chat.protutech.vip');
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Capture Real App Screenshot
  const appRealShot = path.resolve('screenshot_app_actual.png');
  await page.screenshot({ path: appRealShot });
  console.log('Saved screenshot_app_actual.png successfully!');

  await browser.close();
}

captureAppUI().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

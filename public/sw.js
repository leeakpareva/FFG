/**
 * FFG Connect service worker: web push only.
 *
 * No caching, no offline layer — the app stays network-first exactly as it
 * was. This file exists so a closed app can still ring: DMs and event
 * reminders arrive as system notifications, and tapping one opens Connect.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* text push */ }
  const title = data.title || 'FFG Connect';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: data.type || 'ffg',
    data: { type: data.type || null, thread: data.thread || null },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find(c => 'focus' in c);
    if (open) return open.focus();
    return self.clients.openWindow('/');
  })());
});

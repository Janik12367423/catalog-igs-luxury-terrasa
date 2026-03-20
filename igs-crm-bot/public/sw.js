// sw.js — Service Worker для Web Push уведомлений
// Файл должен лежать в корне (public/sw.js)

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || '🤖 Новый лид — IGS Outdoor';
  const options = {
    body: data.body || 'Новый клиент от бота',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'igs-lead',
    renotify: true,
    requireInteraction: true, // не исчезает сам
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: '👁️ Открыть CRM' },
      { action: 'close', title: 'Закрыть' },
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    const url = event.notification.data?.url || '/';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
        // Если уже открыт — фокусируем
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Иначе открываем новую вкладку
        return clients.openWindow(url);
      })
    );
  }
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

// The phone-app page's own worker: keeps the small page (not the app itself) so the icon opens at once even on a
// weak line, and shows the notifications the app sends (Push.gs), even with the app closed.
var CACHE = 'qc-shell-3', FILES = ['./', 'config.js', 'icons/icon-192.png', 'icons/badge-96.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return; // the app itself always comes from Google
  e.respondWith(fetch(e.request).then(function (r) {
    var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return r;
  }, function () { return caches.match(e.request, { ignoreSearch: true }); }));
});

/** The number on the icon: the notifications still waiting in the phone's list. */
function setBadge() {
  var nav = self.navigator;
  if (!nav || !nav.setAppBadge) return Promise.resolve();
  return self.registration.getNotifications().then(function (list) {
    return list.length ? nav.setAppBadge(list.length) : nav.clearAppBadge();
  }).catch(function () { /* no number then */ });
}

// A notification: { t: title, b: text, i: the record to open, l: 'ar' | 'en', g: one notification a record }.
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { b: e.data ? e.data.text() : '' }; }
  var ar = d.l !== 'en';
  // A phone must show every push it gets (iPhone stops sending after silent ones), so this always shows one.
  e.waitUntil(self.registration.showNotification(String(d.t || 'CSCEC QC'), {
    body: String(d.b || ''), icon: 'icons/icon-192.png', badge: 'icons/badge-96.png',
    tag: d.g ? String(d.g) : undefined, renotify: !!d.g, dir: ar ? 'rtl' : 'ltr', lang: ar ? 'ar' : 'en',
    data: { i: String(d.i || '') }, timestamp: Date.now()
  }).then(setBadge));
});

// Tapped: the app comes up on that record (the open window if there is one, else a new one).
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var id = String((e.notification.data || {}).i || ''), base = self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf(base) === 0 && 'focus' in c) {
        if (id) c.postMessage({ qc: 'open', id: id });
        return c.focus();
      }
    }
    return self.clients.openWindow(base + (id ? '?open=' + encodeURIComponent(id) : ''));
  }).then(setBadge, setBadge));
});
self.addEventListener('notificationclose', function (e) { e.waitUntil(setBadge()); });

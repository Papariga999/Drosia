/* Drosia service worker — Web-Push receipt + click-through only (no offline
   cache layer yet; kept intentionally small). Payload shape: {title, body, url}. */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Drosia";
  const url = data.url || "/";
  const options = {
    body: data.body || "",
    icon: "/brand/app-icon-192.png",
    badge: "/brand/app-icon-192.png",
    data: { url },
    tag: url,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        for (const client of clientsArr) {
          if (client.url.includes(target) && "focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      }),
  );
});

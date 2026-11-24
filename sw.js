const C='plamo-v8';
self.addEventListener('install',e=>e.waitUntil((async()=>{await caches.open(C).then(c=>c.addAll(['./','./index.html','./app.js','./manifest.webmanifest']));await self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('fetch',e=>{if(e.request.method==='GET')e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(x=>{if(new URL(e.request.url).origin===location.origin)caches.open(C).then(c=>c.put(e.request,x.clone()));return x}).catch(()=>caches.match('./index.html'))))});

const C='plamo-v19';
self.addEventListener('install',e=>e.waitUntil((async()=>{await caches.open(C).then(c=>c.addAll(['./','./index.html','./app.js','./manifest.webmanifest']));await self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('fetch',e=>{if(e.request.method==='GET')e.respondWith(fetch(e.request,{cache:'no-store'}).then(x=>{if(x&&x.ok&&new URL(e.request.url).origin===location.origin)caches.open(C).then(c=>c.put(e.request,x.clone()));return x}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});

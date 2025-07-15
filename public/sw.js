//sw.js
const CACHE_NAME = 'datago-v1.0.3';
const STATIC_CACHE = 'datago-static-v1.0.3';

// Archivos que se cachean inmediatamente
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/client.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-apple-touch.png'
];

// Archivos que se cachean bajo demanda
const DYNAMIC_CACHE = 'datago-dynamic-v1.0.3';

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  // console.log('🚀 Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        // console.log('📦 Service Worker: Cacheando archivos estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // console.log('✅ Service Worker: Instalación completa');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Service Worker: Error en instalación:', error);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Eliminar caches antiguos
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Interceptar requests (Cache First Strategy para estáticos, Network First para dinámicos)
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip Socket.IO and external requests
  if (requestUrl.pathname.includes('/socket.io/') || 
      requestUrl.hostname !== self.location.hostname) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Cache First para archivos estáticos
        if (STATIC_ASSETS.includes(requestUrl.pathname) || 
            requestUrl.pathname.includes('.css') ||
            requestUrl.pathname.includes('.js') ||
            requestUrl.pathname.includes('.png') ||
            requestUrl.pathname.includes('.jpg')) {
          
          if (cachedResponse) {
            return cachedResponse;
          }
        }
        
        // Network First para todo lo demás
        return fetch(event.request)
          .then((networkResponse) => {
            // Cachear respuesta exitosa
            if (networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE)
                .then((cache) => {
                  cache.put(event.request, responseClone);
                });
            }
            return networkResponse;
          })
          .catch(() => {
            // Fallback al cache si la red falla
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Página offline personalizada para navegación
            if (event.request.mode === 'navigate') {
              return new Response(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>DataGo - Sin conexión</title>
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <style>
                    body { 
                      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                      background: linear-gradient(135deg, #1a1a2e, #16213e);
                      color: white;
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      justify-content: center;
                      height: 100vh;
                      margin: 0;
                      text-align: center;
                      padding: 20px;
                    }
                    h1 { font-size: 2rem; margin-bottom: 1rem; }
                    p { font-size: 1.1rem; opacity: 0.8; max-width: 400px; }
                    .emoji { font-size: 4rem; margin-bottom: 2rem; }
                    .retry-btn {
                      background: #007AFF;
                      border: none;
                      color: white;
                      padding: 12px 24px;
                      border-radius: 8px;
                      font-size: 1rem;
                      margin-top: 2rem;
                      cursor: pointer;
                    }
                  </style>
                </head>
                <body>
                  <div class="emoji">📱🎮</div>
                  <h1>DataGo</h1>
                  <p>Parece que estás sin conexión. Necesitas internet para jugar DataGo.</p>
                  <button class="retry-btn" onclick="window.location.reload()">
                    🔄 Intentar de nuevo
                  </button>
                </body>
                </html>
              `, {
                headers: { 'Content-Type': 'text/html' }
              });
            }
            
            throw error;
          });
      })
  );
});

// Manejar mensajes del cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Sincronización en background (para cuando vuelva la conexión)
self.addEventListener('sync', (event) => {
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Aquí podrías sincronizar datos pendientes
    );
  }
});
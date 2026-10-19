/* Registro del service worker (instalación como app y modo sin conexión). */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW no registrado', e)));
}

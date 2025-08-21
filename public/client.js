// public/client.js - Punto de entrada principal

import { GameClient } from "./js/core/gameClient.js";
import { Utils } from "./js/utils/utils.js";

/**
 * Inicialización principal de DataGo
 */
class DataGoApp {
    constructor() {
        this.gameClient = null;
        this.isInitialized = false;
    }

    /**
     * Inicializar aplicación
     */
    async initialize() {
        try {
            
            // Verificar compatibilidad
            this.checkCompatibility();
            
            // Registrar Service Worker
            await this.registerServiceWorker();
            
            // Inicializar cliente del juego
            this.gameClient = new GameClient();
                        
            this.isInitialized = true;
            
        } catch (error) {
            this.handleCriticalError(error);
        }
    }

    /**
     * Verificar compatibilidad del dispositivo
     */
    checkCompatibility() {
        const requirements = {
            'getUserMedia': !!navigator.mediaDevices?.getUserMedia,
            'DeviceMotionEvent': !!window.DeviceMotionEvent,
            'DeviceOrientationEvent': !!window.DeviceOrientationEvent,
            'Socket.IO': typeof io !== 'undefined',
            'ES6 Modules': true // Si llegamos aquí, ya se soportan
        };

        const unsupported = Object.entries(requirements)
            .filter(([feature, supported]) => !supported)
            .map(([feature]) => feature);

        if (unsupported.length > 0) {
            throw new Error(`Características no soportadas: ${unsupported.join(', ')}`);
        }
    }

    /**
     * Registrar Service Worker para PWA
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                                
                // Manejar actualizaciones
                registration.addEventListener('updatefound', () => {                    
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateAvailable(newWorker);
                        }
                    });
                });
                
            } catch (error) {
                // No es crítico, continúa sin SW
            }
        } else {
        }
    }

    /**
     * Manejar error crítico
     */
    handleCriticalError(error) {
        // Mostrar mensaje de error crítico
        document.body.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                background: linear-gradient(135deg, #1a1a2e, #16213e);
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                text-align: center;
                padding: 20px;
            ">
                <div style="font-size: 4rem; margin-bottom: 2rem;">😵</div>
                <h1 style="font-size: 2rem; margin-bottom: 1rem;">Error Crítico</h1>
                <p style="font-size: 1.1rem; opacity: 0.8; max-width: 500px; margin-bottom: 2rem;">
                    DataGo no pudo iniciarse. Verifica que tu dispositivo sea compatible y tengas una conexión estable.
                </p>
                <details style="max-width: 600px; margin-bottom: 2rem;">
                    <summary style="cursor: pointer; font-size: 1rem; margin-bottom: 1rem;">
                        Detalles técnicos
                    </summary>
                    <pre style="
                        background: rgba(0,0,0,0.5);
                        padding: 1rem;
                        border-radius: 5px;
                        font-size: 0.9rem;
                        text-align: left;
                        overflow-x: auto;
                    ">${error.message}\n\n${error.stack || ''}</pre>
                </details>
                <button onclick="window.location.reload()" style="
                    background: #007AFF;
                    border: none;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 1rem;
                    cursor: pointer;
                ">
                    🔄 Reintentar
                </button>
            </div>
        `;
    }
}

/**
 * Inicialización automática cuando el DOM esté listo
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Marcar inicio para métricas de rendimiento
    if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark('datago-init-start');
    }
    
    // Crear y inicializar aplicación
    const app = new DataGoApp();
    await app.initialize();
    
    // Exponer globalmente para debugging
    window.dataGoApp = app;
    
    // Funciones de conveniencia globales
    window.resetGame = () => app.gameClient?.resetTracker();
    window.takeScreenshot = () => app.gameClient?.takeScreenshot();
});

/**
 * Manejo de instalación PWA
 */
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
        
    // Mostrar botón de instalación después de un tiempo
    setTimeout(() => {
        if (deferredPrompt && window.dataGoApp?.gameClient?.messageManager) {
            window.dataGoApp.gameClient.messageManager.info('💡 Puedes instalar DataGo como app');
        }
    }, 10000); // 30 segundos después
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
});

/**
 * Función global para instalar PWA
 */
window.installPWA = async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
    }
};


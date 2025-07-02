// public/js/pwa/PWAManager.js - SISTEMA DE INSTALACIÓN PWA DESACOPLADO

import { Utils } from "../utils/utils.js";

export class PWAManager {
    constructor(messageManager = null) {
        this.messageManager = messageManager;
        
        // Estado de la PWA
        this.state = {
            isInstallable: false,
            isInstalled: false,
            deferredPrompt: null,
            hasShownPrompt: false,
            installButtonCreated: false,
            isEvaluating: false        // 🆕 Estado de evaluación
        };
        
        // Configuración
        this.config = {
            showButtonAfterDelay: 3000,    // Mostrar botón después de 3s
            autoHideAfterInstall: 2000,    // Ocultar después de instalar
            buttonPosition: 'bottom-right', // Posición del botón
            showInstructions: true,         // Mostrar instrucciones detalladas
            evaluationTimeout: 15000       // 🆕 Tiempo máximo de evaluación (15s)
        };
        
        // Elementos DOM
        this.elements = {
            installButton: null,
            instructionsModal: null
        };
        
        // Callbacks
        this.onInstallSuccess = null;
        this.onInstallError = null;
        this.onInstallDeclined = null;
        
        this.initialize();
    }

    /**
     * Inicializar PWA Manager
     */
    initialize() {
        Utils.log('🚀 Inicializando PWA Manager...', 'info');
        
        this.detectPWASupport();
        this.setupEventListeners();
        this.checkIfAlreadyInstalled();
        this.scheduleInstallPrompt();
        
        Utils.log('✅ PWA Manager inicializado', 'success');
    }

    /**
     * Detectar soporte PWA del navegador
     */
    detectPWASupport() {
        const hasServiceWorker = 'serviceWorker' in navigator;
        const hasManifest = document.querySelector('link[rel="manifest"]');
        const hasBeforeInstallPrompt = 'onbeforeinstallprompt' in window;
        
        this.state.browserSupport = {
            serviceWorker: hasServiceWorker,
            manifest: !!hasManifest,
            beforeInstallPrompt: hasBeforeInstallPrompt,
            isSupported: hasServiceWorker && hasManifest
        };
        
        Utils.log(`PWA Support - SW: ${hasServiceWorker}, Manifest: ${!!hasManifest}, Install: ${hasBeforeInstallPrompt}`, 'debug');
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Evento principal de instalación disponible
        window.addEventListener('beforeinstallprompt', (e) => {
            this.handleBeforeInstallPrompt(e);
        });

        // PWA instalada exitosamente
        window.addEventListener('appinstalled', () => {
            this.handleAppInstalled();
        });

        // Cambio en modo standalone (detectar si se abrió como app)
        window.addEventListener('DOMContentLoaded', () => {
            this.detectStandaloneMode();
        });
    }

    /**
     * Manejar evento beforeinstallprompt - CONVERTIR SPINNER
     */
    handleBeforeInstallPrompt(event) {
        Utils.log('📱 PWA instalable detectada', 'success');
        
        // Prevenir el banner automático del navegador
        event.preventDefault();
        
        // Guardar el evento para uso posterior
        this.state.deferredPrompt = event;
        this.state.isInstallable = true;
        this.state.isEvaluating = false; // 🆕 Parar evaluación
        
        // 🆕 Si hay botón de evaluación, convertirlo a instalar
        if (this.elements.installButton && this.elements.installButton.classList.contains('evaluating')) {
            this.convertEvaluatingToInstall();
        } else {
            // Mostrar botón normal
            this.showInstallButton();
        }
        
        // Notificar que PWA está disponible
        if (this.messageManager && !this.state.hasShownPrompt) {
            this.messageManager.success('✅ ¡App lista para instalar!');
            this.state.hasShownPrompt = true;
        }
    }

    /**
     * Manejar instalación exitosa - CON PERSISTENCIA
     */
    handleAppInstalled() {
        Utils.log('🎉 PWA instalada exitosamente', 'success');
        
        this.state.isInstalled = true;
        this.state.deferredPrompt = null;
        
        // 🆕 Guardar estado persistente
        localStorage.setItem('datago-pwa-installed', 'true');
        
        // Ocultar botón de instalación
        this.hideInstallButton();
        
        // Callback de éxito
        if (this.onInstallSuccess) {
            this.onInstallSuccess();
        }
        
        // Mensaje de confirmación
        if (this.messageManager) {
            this.messageManager.success('¡DataGo instalado como app!');
        }
    }

    /**
     * Detectar si se ejecuta en modo standalone - MEJORADO
     */
    detectStandaloneMode() {
        // Múltiples métodos de detección
        const isStandalone = 
            // Método 1: CSS media query
            window.matchMedia('(display-mode: standalone)').matches ||
            // Método 2: iOS Safari
            window.navigator.standalone === true ||
            // Método 3: Android
            document.referrer.includes('android-app://') ||
            // Método 4: Verificar altura de ventana (PWA no tiene barra de navegador)
            (window.screen.height - window.innerHeight < 100) ||
            // Método 5: Verificar user agent para PWA
            window.navigator.userAgent.includes('wv');
        
        this.state.isInstalled = isStandalone;
        
        if (isStandalone) {
            Utils.log('📱 Ejecutándose como PWA instalada', 'success');
            
            // 🆕 Mensaje especial cuando se detecta PWA
            if (this.messageManager) {
                this.messageManager.success('¡Ejecutándose como app instalada! 🎉');
            }
        } else {
            Utils.log('🌐 Ejecutándose en navegador web', 'info');
        }
        
        return isStandalone;
    }

    /**
     * Verificar si ya está instalada - MEJORADO
     */
    checkIfAlreadyInstalled() {
        // 🆕 Verificar múltiples indicadores
        const standalone = this.detectStandaloneMode();
        
        // 🆕 Verificar en localStorage si se instaló previamente
        const wasInstalledBefore = localStorage.getItem('datago-pwa-installed') === 'true';
        
        // 🆕 Verificar si hay icono en home screen (aproximación)
        const likelyInstalled = standalone || wasInstalledBefore;
        
        if (likelyInstalled) {
            this.state.isInstalled = true;
            Utils.log('✅ PWA detectada como ya instalada', 'success');
            
            // 🆕 Guardar estado
            localStorage.setItem('datago-pwa-installed', 'true');
            return true;
        }
        
        Utils.log('📱 PWA no detectada como instalada', 'info');
        return false;
    }

    /**
     * Programar mostrar prompt de instalación - MODO EVENTO
     */
    scheduleInstallPrompt() {
        // No programar si ya está instalada
        if (this.state.isInstalled) {
            Utils.log('⏭️ Saltando prompt - PWA ya instalada', 'info');
            return;
        }
        
        // 🆕 MODO EVENTO: Instrucciones directas para todos
        setTimeout(() => {
            if (!this.state.isInstalled && !this.state.installButtonCreated) {
                Utils.log('🎪 Modo evento - mostrando botón directo', 'info');
                this.showInstallButton();
            }
        }, this.config.showButtonAfterDelay);
    }

    /**
     * 🆕 Mostrar botón de evaluación (Android)
     */
    showEvaluatingButton() {
        if (this.state.installButtonCreated || this.state.isInstalled) return;
        
        Utils.log('⏳ Mostrando botón de evaluación PWA...', 'info');
        
        this.state.isEvaluating = true;
        
        const button = this.createEvaluatingButton();
        this.elements.installButton = button;
        this.state.installButtonCreated = true;
        
        // Agregar al DOM con animación
        document.body.appendChild(button);
        
        // Animar entrada
        setTimeout(() => {
            button.classList.add('show');
        }, 100);
        
        // Mostrar mensaje explicativo
        if (this.messageManager) {
            this.messageManager.info('🔄 Evaluando compatibilidad de instalación...');
        }
        
        Utils.log('⏳ Botón de evaluación PWA mostrado', 'info');
    }

    /**
     * 🆕 Crear botón de evaluación con spinner
     */
    createEvaluatingButton() {
        const button = document.createElement('button');
        button.id = 'pwaInstallButton';
        button.className = 'pwa-install-button evaluating';
        button.disabled = true;
        button.innerHTML = `
            <div class="install-spinner">
                <div class="spinner"></div>
            </div>
            <div class="install-text">Evaluando...</div>
        `;
        
        return button;
    }

    /**
     * 🆕 Convertir botón de evaluación a instalación
     */
    convertEvaluatingToInstall() {
        const button = this.elements.installButton;
        if (!button) return;
        
        Utils.log('🔄 Convirtiendo botón de evaluación a instalación', 'info');
        
        // Cambiar contenido con animación
        button.classList.add('converting');
        
        setTimeout(() => {
            button.disabled = false;
            button.className = 'pwa-install-button ready';
            button.innerHTML = `
                <div class="install-icon">📱</div>
                <div class="install-text">Instalar App</div>
            `;
            
            // Event listener para instalación
            button.onclick = () => {
                this.initiateInstallFlow();
            };
            
            button.classList.remove('converting');
            
        }, 300);
    }

    /**
     * 🆕 Manejar timeout de evaluación
     */
    handleEvaluationTimeout() {
        Utils.log('⏰ Timeout de evaluación - convirtiendo a instrucciones manuales', 'warning');
        
        this.state.isEvaluating = false;
        
        const button = this.elements.installButton;
        if (button && button.classList.contains('evaluating')) {
            // Convertir a botón de instrucciones manuales
            button.disabled = false;
            button.className = 'pwa-install-button manual';
            button.innerHTML = `
                <div class="install-icon">📋</div>
                <div class="install-text">Ver Instrucciones</div>
            `;
            
            // Event listener para instrucciones
            button.onclick = () => {
                this.showManualInstructions();
            };
            
            // Mensaje explicativo
            if (this.messageManager) {
                this.messageManager.info('💡 Usa el menú del navegador para instalar');
            }
        }
    }
    showInstallButton() {
        // 🆕 Verificación extra antes de mostrar
        if (this.state.isInstalled) {
            Utils.log('⚠️ PWA ya instalada - no mostrando botón', 'debug');
            return;
        }
        
        if (this.state.installButtonCreated) {
            Utils.log('⚠️ Botón PWA ya creado', 'debug');
            return;
        }
        
        // 🆕 Verificar una vez más standalone mode
        if (this.detectStandaloneMode()) {
            Utils.log('⚠️ Standalone detectado - no mostrando botón', 'debug');
            return;
        }
        
        Utils.log('📱 Creando botón de instalación PWA...', 'info');
        
        const button = this.createInstallButton();
        this.elements.installButton = button;
        this.state.installButtonCreated = true;
        
        // Agregar al DOM con animación
        document.body.appendChild(button);
        
        // Animar entrada
        setTimeout(() => {
            button.classList.add('show');
        }, 100);
        
        Utils.log('✅ Botón de instalación PWA mostrado', 'success');
    }

    /**
     * Crear botón de instalación
     */
    createInstallButton() {
        const button = document.createElement('button');
        button.id = 'pwaInstallButton';
        button.className = 'pwa-install-button';
        button.innerHTML = `
            <div class="install-icon">📱</div>
            <div class="install-text">Instalar App</div>
        `;
        
        // Event listener
        button.addEventListener('click', () => {
            this.initiateInstallFlow();
        });
        
        return button;
    }

    /**
     * Ocultar botón de instalación
     */
    hideInstallButton() {
        if (this.elements.installButton) {
            this.elements.installButton.classList.add('hide');
            
            setTimeout(() => {
                this.elements.installButton?.remove();
                this.elements.installButton = null;
                this.state.installButtonCreated = false;
            }, 300);
        }
    }

    /**
     * Iniciar flujo de instalación - MODO EVENTO DIRECTO
     */
    async initiateInstallFlow() {
        try {
            Utils.log('🎪 Iniciando instalación modo evento...', 'info');
            
            // 🆕 MODO EVENTO: Siempre mostrar instrucciones primero
            if (!Utils.isIOS() && !this.state.deferredPrompt) {
                // Android sin prompt nativo - instrucciones directas
                this.showManualInstructions();
                return;
            }
            
            if (this.state.deferredPrompt) {
                // Si hay prompt nativo disponible, usarlo
                this.state.deferredPrompt.prompt();
                
                const { outcome } = await this.state.deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                    Utils.log('✅ Usuario aceptó instalación nativa', 'success');
                } else {
                    Utils.log('❌ Usuario rechazó instalación nativa', 'warning');
                    
                    if (this.onInstallDeclined) {
                        this.onInstallDeclined();
                    }
                    
                    // Mostrar instrucciones como fallback
                    this.showManualInstructions();
                }
                
                this.state.deferredPrompt = null;
                
            } else {
                // Sin prompt nativo - mostrar instrucciones
                this.showManualInstructions();
            }
            
        } catch (error) {
            Utils.log('❌ Error en instalación: ' + error.message, 'error');
            
            if (this.onInstallError) {
                this.onInstallError(error);
            }
            
            // Fallback a instrucciones manuales
            this.showManualInstructions();
        }
    }

    /**
     * Mostrar instrucciones manuales
     */
    showManualInstructions() {
        if (!this.config.showInstructions) return;
        
        const instructions = this.createInstructionsModal();
        this.elements.instructionsModal = instructions;
        
        document.body.appendChild(instructions);
        
        // Animar entrada
        setTimeout(() => {
            instructions.classList.add('show');
        }, 100);
        
        Utils.log('📖 Mostrando instrucciones manuales', 'info');
    }

    /**
     * Crear modal de instrucciones
     */
    createInstructionsModal() {
        const modal = document.createElement('div');
        modal.className = 'pwa-instructions-modal';
        
        const browserName = this.detectBrowser();
        const instructions = this.getInstructionsForBrowser(browserName);
        
        modal.innerHTML = `
            <div class="instructions-content">
                <div class="instructions-header">
                    <h3>📱 Instalar DataGo</h3>
                    <button class="close-instructions">✕</button>
                </div>
                <div class="instructions-body">
                    <p>Para instalar como app:</p>
                    <ol>
                        ${instructions.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                </div>
                <div class="instructions-footer">
                    <button class="got-it-button">Entendido</button>
                </div>
            </div>
        `;
        
        // Event listeners
        modal.querySelector('.close-instructions').addEventListener('click', () => {
            this.hideInstructions();
        });
        
        modal.querySelector('.got-it-button').addEventListener('click', () => {
            this.hideInstructions();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideInstructions();
            }
        });
        
        return modal;
    }

    /**
     * Detectar navegador
     */
    detectBrowser() {
        const userAgent = navigator.userAgent;
        
        if (Utils.isIOS()) {
            return 'safari';
        } else if (userAgent.includes('Chrome')) {
            return 'chrome';
        } else if (userAgent.includes('Firefox')) {
            return 'firefox';
        } else {
            return 'other';
        }
    }

    /**
     * Obtener instrucciones específicas por navegador - MODO EVENTO
     */
    getInstructionsForBrowser(browser) {
        const instructions = {
            safari: [
                'Toca el botón "Compartir" 📤 en la parte inferior',
                'Selecciona "Agregar a pantalla de inicio" 📱',
                'Toca "Agregar" para confirmar'
            ],
            chrome: [
                'Toca el menú ⋮ arriba a la derecha',
                'Busca "Instalar" o "Agregar a pantalla de inicio" 📱',
                'Toca "Instalar" para confirmar',
                '¡En unos segundos estará disponible en tu pantalla!'
            ],
            firefox: [
                'Toca el menú ⋮ arriba a la derecha',
                'Busca "Instalar" 📱',
                'Confirma la instalación'
            ],
            other: [
                'Busca en el menú del navegador:',
                '"Instalar", "Agregar a pantalla", o "Agregar app"',
                'La opción debería estar disponible ahora'
            ]
        };
        
        return instructions[browser] || instructions.other;
    }

    /**
     * Ocultar instrucciones
     */
    hideInstructions() {
        if (this.elements.instructionsModal) {
            this.elements.instructionsModal.classList.add('hide');
            
            setTimeout(() => {
                this.elements.instructionsModal?.remove();
                this.elements.instructionsModal = null;
            }, 300);
        }
    }

    // MÉTODOS PÚBLICOS

    /**
     * Forzar mostrar botón de instalación
     */
    showInstallPrompt() {
        if (!this.state.isInstalled) {
            this.showInstallButton();
        }
    }

    /**
     * Configurar callbacks
     */
    setCallbacks({ onSuccess, onError, onDeclined }) {
        this.onInstallSuccess = onSuccess;
        this.onInstallError = onError;
        this.onInstallDeclined = onDeclined;
    }

    /**
     * Verificar si PWA está instalada
     */
    isInstalled() {
        return this.state.isInstalled;
    }

    /**
     * Verificar si PWA es instalable
     */
    isInstallable() {
        return this.state.isInstallable;
    }

    /**
     * Obtener estado completo
     */
    getState() {
        return {
            ...this.state,
            config: { ...this.config }
        };
    }

    /**
     * Configurar PWA Manager
     */
    configure(newConfig) {
        this.config = { ...this.config, ...newConfig };
        Utils.log('PWA Manager reconfigurado', 'info');
    }

    /**
     * Destruir PWA Manager
     */
    destroy() {
        // Limpiar elementos DOM
        this.hideInstallButton();
        this.hideInstructions();
        
        // Limpiar referencias
        this.state.deferredPrompt = null;
        this.messageManager = null;
        
        Utils.log('PWA Manager destruido', 'info');
    }
}

// Estilos CSS para PWA Manager
if (!document.getElementById('pwaManagerStyles')) {
    const style = document.createElement('style');
    style.id = 'pwaManagerStyles';
    style.textContent = `
        /* Botón de instalación PWA */
        .pwa-install-button {
            position: fixed;
            bottom: 120px;
            right: 20px;
            background: linear-gradient(135deg, #007AFF, #0051D0);
            color: white;
            border: none;
            border-radius: 50px;
            padding: 12px 20px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
            transform: translateY(100px);
            opacity: 0;
            transition: all 0.3s ease;
        }
        
        /* 🆕 Estados del botón */
        .pwa-install-button.evaluating {
            background: linear-gradient(135deg, #FF9500, #FF6B00);
            cursor: not-allowed;
            box-shadow: 0 4px 12px rgba(255, 149, 0, 0.3);
        }
        
        .pwa-install-button.ready {
            background: linear-gradient(135deg, #30D158, #28B946);
            box-shadow: 0 4px 12px rgba(48, 209, 88, 0.3);
            animation: readyPulse 2s ease-in-out infinite;
        }
        
        .pwa-install-button.manual {
            background: linear-gradient(135deg, #8E8E93, #6D6D70);
            box-shadow: 0 4px 12px rgba(142, 142, 147, 0.3);
        }
        
        .pwa-install-button.converting {
            animation: convertingBounce 0.3s ease-in-out;
        }
        
        /* Animaciones */
        @keyframes readyPulse {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-2px) scale(1.02); }
        }
        
        @keyframes convertingBounce {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-4px) scale(1.05); }
        }
        
        /* 🆕 Spinner */
        .install-spinner {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top: 2px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .pwa-install-button.show {
            transform: translateY(0);
            opacity: 1;
        }
        
        .pwa-install-button.hide {
            transform: translateY(100px);
            opacity: 0;
        }
        
        .pwa-install-button:hover:not(:disabled) {
            transform: translateY(-2px);
        }
        
        .pwa-install-button:active:not(:disabled) {
            transform: translateY(0);
        }
        
        .install-icon {
            font-size: 16px;
        }
        
        .install-text {
            white-space: nowrap;
        }
        
        /* Modal de instrucciones */
        .pwa-instructions-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
            padding: 20px;
            box-sizing: border-box;
        }
        
        .pwa-instructions-modal.show {
            opacity: 1;
        }
        
        .pwa-instructions-modal.hide {
            opacity: 0;
        }
        
        .instructions-content {
            background: white;
            border-radius: 12px;
            max-width: 400px;
            width: 100%;
            max-height: 80vh;
            overflow-y: auto;
            transform: scale(0.9);
            transition: transform 0.3s ease;
        }
        
        .pwa-instructions-modal.show .instructions-content {
            transform: scale(1);
        }
        
        .instructions-header {
            padding: 20px 20px 0 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .instructions-header h3 {
            margin: 0;
            color: #333;
            font-size: 18px;
        }
        
        .close-instructions {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #666;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .instructions-body {
            padding: 20px;
        }
        
        .instructions-body p {
            margin: 0 0 15px 0;
            color: #333;
        }
        
        .instructions-body ol {
            margin: 0;
            padding-left: 20px;
        }
        
        .instructions-body li {
            margin-bottom: 10px;
            color: #555;
            line-height: 1.4;
        }
        
        .instructions-footer {
            padding: 0 20px 20px 20px;
        }
        
        .got-it-button {
            width: 100%;
            background: #007AFF;
            color: white;
            border: none;
            padding: 12px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
        }
        
        .got-it-button:hover {
            background: #0051D0;
        }
        
        /* Responsive */
        @media (max-width: 480px) {
            .pwa-install-button {
                bottom: 100px;
                right: 15px;
                padding: 10px 16px;
                font-size: 13px;
            }
        }
    `;
    document.head.appendChild(style);
}
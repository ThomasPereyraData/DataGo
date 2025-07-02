// public/js/ui/ProgressiveFlowManager.js - MANEJO DE FLUJO PROGRESIVO

import { Utils } from "../utils/utils.js";

export class ProgressiveFlowManager {
    constructor(messageManager = null) {
        this.messageManager = messageManager;
        
        // Estado del flujo
        this.state = {
            currentScreen: 'welcome', // 'welcome' | 'game'
            isRegistered: false,
            isPWA: window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches,
            registrationData: null
        };
        
        // Elementos DOM
        this.elements = {
            welcomeScreen: document.getElementById('welcomeScreen'),
            gameScreen: document.getElementById('gameScreen'),
            // startRegistrationBtn: document.getElementById('startRegistrationBtn'),
            pwaPromotion: document.getElementById('pwaPromotion'),
            showPWAInstructionsBtn: document.getElementById('showPWAInstructionsBtn')
        };
        
        // Callbacks
        this.onRegistrationComplete = null;
        this.onReadyToPlay = null;
        
        this.initialize();
    }

    /**
     * Inicializar flow manager
     */
    initialize() {
        Utils.log('🎭 Inicializando ProgressiveFlowManager...', 'info');
        
        this.checkRegistrationStatus();
        this.setupEventListeners();
        this.determineInitialScreen();
        
        Utils.log(`✅ FlowManager inicializado - Pantalla: ${this.state.currentScreen} | PWA: ${this.state.isPWA}`, 'success');
    }

    /**
     * Verificar si ya está registrado
     */
    checkRegistrationStatus() {
        const registrationData = localStorage.getItem('datago-registro');
        
        if (registrationData) {
            try {
                this.state.registrationData = JSON.parse(registrationData);
                this.state.isRegistered = true;
                
                Utils.log(`📋 Usuario ya registrado: ${this.state.registrationData.nombre} ${this.state.registrationData.apellido}`, 'info');
                
            } catch (error) {
                Utils.log('❌ Error parseando datos de registro, limpiando...', 'warning');
                localStorage.removeItem('datago-registro');
                this.state.isRegistered = false;
            }
        } else {
            this.state.isRegistered = false;
            Utils.log('📋 Usuario no registrado', 'info');
        }
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // COMENTADO: Botón de inicio de registro
        // this.elements.startRegistrationBtn?.addEventListener('click', () => {
        //     this.handleStartRegistration();
        // });

        // Botón de instrucciones PWA
        this.elements.showPWAInstructionsBtn?.addEventListener('click', () => {
            this.handleShowPWAInstructions();
        });
    }

    /**
     * Determinar pantalla inicial según estado
     */
    determineInitialScreen() {
        if (this.state.isPWA) {
            // En PWA: verificar si está registrado
            if (this.state.isRegistered) {
                // PWA + registrado = ir directo al juego
                this.showGameScreen();
                this.triggerReadyToPlay();
            } else {
                // PWA + no registrado = mostrar pantalla de juego con botón registrarse
                this.showGameScreen();
                this.showRegisterButton();
            }
        } else {
            // En navegador: verificar si está registrado
            if (this.state.isRegistered) {
                // Navegador + registrado = mostrar juego + promoción PWA
                this.showGameScreen();
                this.showPWAPromotion();
            } else {
                // Navegador + no registrado = mostrar bienvenida
                this.showWelcomeScreen();
            }
        }
    }

    /**
     * Mostrar pantalla de bienvenida
     */
    showWelcomeScreen() {
        this.elements.welcomeScreen.style.display = 'flex';
        this.elements.gameScreen.style.display = 'none';
        this.state.currentScreen = 'welcome';
        
        Utils.log('👋 Mostrando pantalla de bienvenida', 'info');
    }

    /**
     * Mostrar pantalla de juego
     */
    showGameScreen() {
        this.elements.welcomeScreen.style.display = 'none';
        this.elements.gameScreen.style.display = 'block';
        this.state.currentScreen = 'game';
        
        Utils.log('🎮 Mostrando pantalla de juego', 'info');
    }

    /**
     * Mostrar botón de registro en PWA
     */
    showRegisterButton() {
        const registerBtn = document.getElementById('registerBtn');
        if (registerBtn) {
            registerBtn.style.display = 'block';
            registerBtn.onclick = () => {
                this.handleRegisterClick();
            };
        }
        
        Utils.log('📝 Mostrando botón de registro en PWA', 'info');
    }

    /**
     * Manejar click en registrarse (PWA)
     */
    handleRegisterClick() {
        Utils.log('📝 Usuario solicita registrarse en PWA', 'info');
        
        // Si es iOS, mostrar alerta rápida
        if (Utils.isIOS()) {
            this.showIOSAlert(() => {
                this.triggerRegistrationFlow();
            });
        } else {
            // Android: directo al registro
            this.triggerRegistrationFlow();
        }
    }

    /**
     * Mostrar alerta rápida de iOS
     */
    showIOSAlert(callback) {
        alert('Para jugar debes registrarte');
        setTimeout(callback, 100);
    }

    /**
     * Mostrar promoción PWA (solo en navegador)
     */
    showPWAPromotion() {
        if (!this.state.isPWA && this.elements.pwaPromotion) {
            this.elements.pwaPromotion.style.display = 'block';
            this.elements.pwaPromotion.classList.remove('hidden');
            
            Utils.log('📱 Mostrando promoción PWA', 'info');
        }
    }

    /**
     * Ocultar promoción PWA
     */
    hidePWAPromotion() {
        if (this.elements.pwaPromotion) {
            this.elements.pwaPromotion.classList.add('hidden');
            
            setTimeout(() => {
                this.elements.pwaPromotion.style.display = 'none';
            }, 300);
        }
    }

    /**
     * Manejar inicio de registro
     */
    handleStartRegistration() {
        Utils.log('📝 Iniciando proceso de registro...', 'info');
        
        // Callback para que GameClient muestre el formulario
        if (this.onRegistrationComplete) {
            // El GameClient manejará mostrar el modal de registro
            this.triggerRegistrationFlow();
        }
    }

    /**
     * Manejar completación del registro
     */
    handleRegistrationCompleted(registrationData) {
        Utils.log('✅ Registro completado, cambiando a pantalla de juego', 'success');
        
        // Guardar datos
        this.state.registrationData = registrationData;
        this.state.isRegistered = true;
        
        // Guardar en localStorage
        const storageData = {
            nombre: registrationData.name,
            apellido: registrationData.lastName,
            email: registrationData.email,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('datago-registro', JSON.stringify(storageData));
        
        // Console.log para backend
        console.log('🎮 REGISTRO DE USUARIO:', {
            nombre: registrationData.name,
            apellido: registrationData.lastName,
            email: registrationData.email,
            puntos: 0,
            timestamp: new Date().toISOString()
        });
        
        // Ocultar botón de registro si está visible
        const registerBtn = document.getElementById('registerBtn');
        if (registerBtn) {
            registerBtn.style.display = 'none';
        }
        
        // Transición a pantalla de juego
        setTimeout(() => {
            this.showGameScreen();
            
            if (!this.state.isPWA) {
                // En navegador: mostrar promoción PWA
                setTimeout(() => {
                    this.showPWAPromotion();
                }, 500);
            }
            
            // Notificar que está listo para jugar
            this.triggerReadyToPlay();
            
        }, 800);
    }

    /**
     * Manejar instrucciones PWA
     */
    handleShowPWAInstructions() {
        Utils.log('📱 Mostrando instrucciones de instalación PWA', 'info');
        
        const browserName = this.detectBrowser();
        const instructions = this.getInstructionsForBrowser(browserName);
        
        this.showInstructionsModal(instructions);
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
     * Obtener instrucciones por navegador
     */
    getInstructionsForBrowser(browser) {
        const instructions = {
            safari: [
                'Toca el botón "Compartir" 📤 en la parte inferior',
                'Selecciona "Agregar a pantalla de inicio" 📱',
                'Toca "Agregar" para confirmar',
                '¡Ya tendrás DataGo como app!'
            ],
            chrome: [
                'Toca el menú ⋮ arriba a la derecha',
                'Busca "Instalar app" o "Agregar a pantalla de inicio" 📱',
                'Toca "Instalar" para confirmar',
                '¡En unos segundos estará en tu pantalla!'
            ],
            firefox: [
                'Toca el menú ⋮ arriba a la derecha',
                'Busca "Instalar" 📱',
                'Confirma la instalación'
            ],
            other: [
                'Busca en el menú del navegador:',
                '"Instalar", "Agregar a pantalla", o "Agregar app"',
                'Sigue las instrucciones de tu navegador'
            ]
        };
        
        return instructions[browser] || instructions.other;
    }

    /**
     * Mostrar modal de instrucciones
     */
    showInstructionsModal(instructions) {
        const modal = document.createElement('div');
        modal.className = 'pwa-instructions-modal show';
        
        modal.innerHTML = `
            <div class="instructions-content">
                <div class="instructions-header">
                    <h3>📱 Instalar DataGo como App</h3>
                    <button class="close-instructions">✕</button>
                </div>
                <div class="instructions-body">
                    <p><strong>Para la mejor experiencia:</strong></p>
                    <ol>
                        ${instructions.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                    <p style="margin-top: 15px; opacity: 0.8; font-size: 0.9rem;">
                        💡 Después podrás jugar desde el icono en tu pantalla de inicio
                    </p>
                </div>
                <div class="instructions-footer">
                    <button class="got-it-button">Entendido</button>
                </div>
            </div>
        `;
        
        // Event listeners
        modal.querySelector('.close-instructions').addEventListener('click', () => {
            this.hideInstructionsModal(modal);
        });
        
        modal.querySelector('.got-it-button').addEventListener('click', () => {
            this.hideInstructionsModal(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideInstructionsModal(modal);
            }
        });
        
        document.body.appendChild(modal);
    }

    /**
     * Ocultar modal de instrucciones
     */
    hideInstructionsModal(modal) {
        modal.classList.remove('show');
        modal.classList.add('hide');
        
        setTimeout(() => {
            modal.remove();
        }, 300);
    }

    // MÉTODOS PARA CALLBACKS

    /**
     * Configurar callback de registro
     */
    setOnRegistrationComplete(callback) {
        this.onRegistrationComplete = callback;
    }

    /**
     * Configurar callback de listo para jugar
     */
    setOnReadyToPlay(callback) {
        this.onReadyToPlay = callback;
    }

    /**
     * Disparar flujo de registro
     */
    triggerRegistrationFlow() {
        if (this.onRegistrationComplete) {
            this.onRegistrationComplete();
        }
    }

    /**
     * Disparar listo para jugar
     */
    triggerReadyToPlay() {
        if (this.onReadyToPlay) {
            setTimeout(() => {
                this.onReadyToPlay(this.state.registrationData);
            }, 500);
        }
    }

    // MÉTODOS PÚBLICOS

    /**
     * Obtener datos de registro
     */
    getRegistrationData() {
        return this.state.registrationData;
    }

    /**
     * Verificar si está registrado
     */
    isRegistered() {
        return this.state.isRegistered;
    }

    /**
     * Verificar si es PWA
     */
    isPWA() {
        return this.state.isPWA;
    }

    /**
     * Obtener pantalla actual
     */
    getCurrentScreen() {
        return this.state.currentScreen;
    }

    /**
     * Destruir manager
     */
    destroy() {
        this.onRegistrationComplete = null;
        this.onReadyToPlay = null;
        
        Utils.log('ProgressiveFlowManager destruido', 'info');
    }
}
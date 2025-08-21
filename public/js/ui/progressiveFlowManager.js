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
            registrationData: null,
            hasShownAutoInstructions: false
        };
        
        // Elementos DOM
        this.elements = {
            welcomeScreen: document.getElementById('welcomeScreen'),
            gameScreen: document.getElementById('gameScreen'),
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
        console.log('🌟 Inicializando ProgressiveFlowManager');
        this.checkRegistrationStatus();
        // this.setupEventListeners();
        this.determineInitialScreen();
        
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
                                
            } catch (error) {
                localStorage.removeItem('datago-registro');
                this.state.isRegistered = false;
            }
        } else {
            this.state.isRegistered = false;
        }
    }

    /**
     * Configurar event listeners
     */
    // setupEventListeners() {
    //     // Botón de instrucciones PWA
    //     this.elements.showPWAInstructionsBtn?.addEventListener('click', () => {
    //         this.handleShowPWAInstructions();
    //     });
    // }

    /**
     * Determinar pantalla inicial según estado
     */
    determineInitialScreen() {
        console.log('🔍 Determinando pantalla inicial previo')
        console.log('🔍 Determinando pantalla inicial:', {
            isPWA: this.state.isPWA,
            isRegistered: this.state.isRegistered,
            registrationData: this.state.registrationData
        });
        console.log('desde determinate:')
        if (this.state.isPWA) {
            // En PWA: verificar si está registrado
            if (this.state.isRegistered) {
                console.log('📱 PWA + registrado = ir directo al juego');
                // PWA + registrado = ir directo al juego
                this.showGameScreen();
                this.triggerReadyToPlay();
            } else {
                console.log('📱 PWA + no registrado = abrir modal registro');
                this.showGameScreen();
                this.triggerRegistrationFlow();
            }
        } else {
            console.log('🌐 Navegador detectado');
            // En navegador: verificar si está registrado
            if (this.state.isRegistered) {
                // Navegador + registrado = mostrar juego + promoción PWA
                this.showGameScreen();
            } else {
                // Navegador + no registrado = mostrar bienvenida
                console.log('🌐 Navegador + no registrado = mostrar bienvenida');
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
        // metodo para mostrar instrucciones automaticamente 
        this.loadDynamicInstructions();
    }

    loadDynamicInstructions() {
        const container = this.elements.welcomeScreen;
        if (!container) return;
        
        const browserName = this.detectBrowser();
        const instructions = this.getInstructionsForBrowser(browserName);
        
        // Actualizar el HTML completo de la welcome screen
        container.innerHTML = `
            <div class="welcome-container">
                
                <div class="welcome-header">
                    <h1>🎮 DataGo</h1>
                    <p>Juego de realidad aumentada</p>
                </div>

                <!-- 🆕 INSTRUCCIONES INTEGRADAS -->
                <div class="install-steps">
                    <h3>📋 Cómo instalar en ${this.getBrowserDisplayName(browserName)}:</h3>
                    <ol class="steps-list">
                        ${instructions.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                </div>

                <!-- 🆕 CALL TO ACTION -->
                <div class="install-cta">
                    <div class="cta-icon">✨</div>
                    <p><strong>¡Una vez instalado, abre DataGo desde tu pantalla de inicio!</strong></p>
                    <p class="cta-subtitle">Tendrás acceso completo sin necesidad de navegador</p>
                </div>
            </div>
        `;
    }

    // 🆕 FUNCIÓN HELPER: Nombre amigable del navegador
    getBrowserDisplayName(browser) {
        const names = {
            safari: 'Safari (iOS)',
            chrome: 'Chrome',
            firefox: 'Firefox',
            other: 'tu navegador'
        };
        return names[browser] || names.other;
    }

    /**
     * Programar instrucciones automáticas
     */
    scheduleAutoInstructions() {

        console.log('hasShownAutoInstructions:', this.state.hasShownAutoInstructions);
        // Solo en navegador (no PWA) y solo una vez
        if (this.state.isPWA || this.state.hasShownAutoInstructions) {
            return;
        }
        // this.state.hasShownAutoInstructions = true;
        console.log('viendo en que pantalla estoy: ', this.state.currentScreen);
        console.log('hasShownAutoInstructions:', this.state.hasShownAutoInstructions);

        // Verificar que seguimos en welcome screen
        setTimeout(() => {
            if (this.state.currentScreen === 'welcome' && !this.state.hasShownAutoInstructions) {
                console.log('📱 Mostrando instrucciones automáticamente');
                this.state.hasShownAutoInstructions = true;
                this.handleShowPWAInstructions();
            }
        }, 2000);

        console.log('viendo en que pantalla estoy2: ', this.state.currentScreen);


    }

    /**
     * Mostrar pantalla de juego
     */
    showGameScreen() {
        this.elements.welcomeScreen.style.display = 'none';
        this.elements.gameScreen.style.display = 'block';
        this.state.currentScreen = 'game';
        
    }

    /**
     * Mostrar botón de registro en PWA
     */
    // showRegisterButton() {
    //     const registerBtn = document.getElementById('registerBtn');
    //     if (registerBtn) {
    //         registerBtn.style.display = 'block';
    //         registerBtn.onclick = () => {
    //             this.handleRegisterClick();
    //         };
    //     }        
    // }

    /**
     * Manejar click en registrarse (PWA)
     */
    handleRegisterClick() {
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
        // alert('Para jugar debes registrarte');
        setTimeout(callback, 100);
    }


    /**
     * Manejar inicio de registro
     */
    handleStartRegistration() {        
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
        // Guardar datos
        this.state.registrationData = registrationData;
        this.state.isRegistered = true;
        
        // Guardar en localStorage
        const storageData = {
            name: registrationData.name,
            lastName: registrationData.lastName,
            email: registrationData.email,
        };
        
        localStorage.setItem('datago-registro', JSON.stringify(storageData));
        
        // Ocultar botón de registro si está visible
        // const registerBtn = document.getElementById('registerBtn');
        // if (registerBtn) {
        //     registerBtn.style.display = 'none';
        // }
        
        // Transición a pantalla de juego
        setTimeout(() => {
            this.showGameScreen();
            // Notificar que está listo para jugar
            this.triggerReadyToPlay();
            
        }, 800);
    }

    /**
    * Resetear estado de registro por error de validación
    */
    resetRegistrationState() {
        console.log('🔄 Reseteando estado de registro');
        
        // Resetear estado interno
        this.state.isRegistered = false;
        this.state.registrationData = null;
        
        // Mostrar botón de registro si estamos en PWA
        // if (this.state.isPWA && this.state.currentScreen === 'game') {
        //     this.showRegisterButton();
        // }
        
        // Si estamos en navegador, volver a welcome
        if (!this.state.isPWA) {
            this.showWelcomeScreen();
        }
    }

    /**
     * Manejar instrucciones PWA
     */
    handleShowPWAInstructions() {
        
        const browserName = this.detectBrowser();
        const instructions = this.getInstructionsForBrowser(browserName);
        
        // this.showInstructionsModal(instructions);
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
    // showInstructionsModal(instructions) {
    //     const modal = document.createElement('div');
    //     modal.className = 'pwa-instructions-modal show';
        
    //     modal.innerHTML = `
    //         <div class="instructions-content">
    //             <div class="instructions-header">
    //                 <h3>📱 Instalar DataGo como App</h3>
    //                 <button class="close-instructions">✕</button>
    //             </div>
    //             <div class="instructions-body">
    //                 <p><strong>Para la mejor experiencia:</strong></p>
    //                 <ol>
    //                     ${instructions.map(step => `<li>${step}</li>`).join('')}
    //                 </ol>
    //                 <p style="margin-top: 15px; opacity: 0.8; font-size: 0.9rem;">
    //                     💡 Después podrás jugar desde el icono en tu pantalla de inicio
    //                 </p>
    //             </div>
    //             <div class="instructions-footer">
    //                 <button class="got-it-button">Entendido</button>
    //             </div>
    //         </div>
    //     `;
        
    //     // Event listeners
    //     modal.querySelector('.close-instructions').addEventListener('click', () => {
    //         this.hideInstructionsModal(modal);
    //     });
        
    //     modal.querySelector('.got-it-button').addEventListener('click', () => {
    //         this.hideInstructionsModal(modal);
    //     });
        
    //     modal.addEventListener('click', (e) => {
    //         if (e.target === modal) {
    //             this.hideInstructionsModal(modal);
    //         }
    //     });
        
    //     document.body.appendChild(modal);
    // }

    /**
     * Ocultar modal de instrucciones
     */
    // hideInstructionsModal(modal) {
    //     modal.classList.remove('show');
    //     modal.classList.add('hide');
        
    //     setTimeout(() => {
    //         modal.remove();
    //     }, 300);
    // }

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
        console.log('🚀 Triggering registration flow, callback exists:', !!this.onRegistrationComplete);
        if (this.onRegistrationComplete) {
            this.onRegistrationComplete();
        } else {
            console.error('❌ No registration callback configured!');
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
    }
}
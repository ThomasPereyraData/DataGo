// public/js/core/GameClient.js - CON SISTEMA FOV

import { ThrowMechanics } from "../mechanics/throwMechanics.js";
import { RoomTracker } from "../tracking/roomTracker.js";
import { CameraManager } from "../ui/cameraManager.js";
import { MessageManager } from "../ui/messageManager.js";
import { FOVManager } from "../ar/fovManager.js";
import { Utils } from "../utils/utils.js";
import { SocketManager } from "./socketManager.js";
import { PWAManager } from "../pwa/PWAManager.js";
import { RegistrationManager } from "../ui/registrationManager.js"; 
import { ProgressiveFlowManager } from "../ui/progressiveFlowManager.js";
import { ApiManager } from "../api/apiManager.js";
export class GameClient {
    constructor() {
        // Estado del juego
        this.gameState = {
            isJoined: false,
            player: {
                points: 0,
                position: { x: 2.5, y: 2.5 },
                streak: 0,
                captures: 0
            },
            spawns: [],           // worldPosition
            visibleSpawns: [],    // solo visibles en FOV
            totalPlayers: 0,
            // 🆕 NUEVO: Sistema de timers dual
            timer: {
                gameDuration: 1 * 60 * 1000,      // 1 minuto máximo de partida
                inactivityTimeout: 40 * 1000,  // 40 segundos sin capturas = inactivo
                startTime: null,
                lastCaptureTime: null,              // Timestamp de última captura
                remaining: 1 * 60 * 1000,
                isActive: false,
                gameIntervalId: null,               // Timer principal (countdown visual)
                inactivityIntervalId: null,         // Timer de inactividad (background)
                gameTimeoutId: null                 // Timeout de finalización por tiempo
            }
        };

        // Estado de captura
        this.captureState = {
            isCapturing: false,
            lastTapTime: 0,
            tapCount: 0,
            throwMode: true
        };

        // Estado de permisos iOS
        this.iosPermissions = {
            requested: false,
            granted: false,
            buttonShown: false
        };

        // Configuración  
        this.config = {
            roomSize: { width: 5, height: 5 },
            maxTapDistance: 100
        };

        // Elementos DOM
        this.elements = {};

        // Managers
        this.messageManager = null;
        this.cameraManager = null;
        this.socketManager = null;
        this.roomTracker = null;
        this.throwMechanics = null;
        this.fovManager = null;
        this.pwaManager = null;

        // Formulario de registro
        this.registrationManager = null;
        this.playerRegistrationData = null;

        this.progressiveFlowManager = null;

        this.registrationInProgress = false;
        this.lastRegistrationTime = 0;

        this.initialize();
    }

    /**
     * Inicializar el cliente del juego
    */
    async initialize() {
        try {
            this.initializeElements();
            await this.initializeManagers();
            this.setupEventListeners();
            this.setupInteractions();
            this.setupCleanUI();
            this.setupThrowMechanics();

            // permisos iOS porque los sensores son necesarios 
            this.checkiOSPermissions();

            // Exponer globalmente para debugging
            window.gameClient = this;

        } catch (error) {
            console.error('Initialization error:', error);
        }
    }

    /**
     * Verificar si necesitamos solicitar permisos iOS
     */
    checkiOSPermissions() {
        if (Utils.isIOS() && !this.iosPermissions.buttonShown) {
            this.showIOSPermissionButton();
            this.iosPermissions.buttonShown = true;
        }
    }


    /**
     * Mostrar botón para solicitar permisos iOS
     */
    showIOSPermissionButton() {
        // Crear botón para permisos iOS
        const permissionBtn = document.createElement('button');
        permissionBtn.id = 'iosPermissionBtn';
        permissionBtn.className = 'btn-primary';
        permissionBtn.innerHTML = '📱 Activar Sensores iOS';
        permissionBtn.style.cssText = `
            position: fixed;
            bottom: 120px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            padding: 15px 25px;
            font-size: 16px;
            font-weight: bold;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            background: rgba(255, 149, 0, 0.9);
            color: white;
            border: 2px solid rgba(255, 149, 0, 0.5);
            min-width: 200px;
            pointer-events: auto;
            touch-action: manipulation;
        `;

        // Insertar antes de los controles existentes
        const controls = document.querySelector('.controls');
        if (controls) {
            controls.parentNode.insertBefore(permissionBtn, controls);
        } else {
            document.body.appendChild(permissionBtn);
        }

        // Event listener
        permissionBtn.addEventListener('click', () => {
            this.requestiOSPermissions();
        });

        // Mensaje informativo
        this.showTemporaryMessage('🍎 En iOS necesitas activar los sensores primero', 'info');
    }

    /**
     * Solicitar permisos iOS manualmente
    */
    async requestiOSPermissions() {
        const btn = document.getElementById('iosPermissionBtn');
        if (!btn) return;

        try {
            btn.textContent = '⏳ Solicitando permisos...';
            btn.disabled = true;

            // Solicitar permisos de orientación
            let orientationPermission = 'granted';
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                orientationPermission = await DeviceOrientationEvent.requestPermission();
            }

            // Solicitar permisos de movimiento
            let motionPermission = 'granted';
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                motionPermission = await DeviceMotionEvent.requestPermission();
            }

            if (orientationPermission === 'granted') {
                // Permisos concedidos
                this.iosPermissions.requested = true;
                this.iosPermissions.granted = true;

                btn.textContent = '✅ Sensores Activados';
                btn.style.background = 'rgba(48, 209, 88, 0.9)';

                this.showTemporaryMessage('✅ Sensores iOS activados correctamente', 'success');

                // Reinicializar RoomTracker con permisos
                await this.reinitializeRoomTracker();

                // 🆕 NUEVO: Notificar al modal si está abierto
                if (this.registrationManager && this.registrationManager.state.isVisible) {
                    setTimeout(() => {
                        this.registrationManager.updatePermissionButtonStates();
                    }, 500);
                }

                // Ocultar botón después de un tiempo
                setTimeout(() => {
                    btn.style.opacity = '0';
                    setTimeout(() => btn.remove(), 500);
                }, 2000);

            } else {
                // Permisos denegados
                btn.textContent = '❌ Permisos Denegados';
                btn.style.background = 'rgba(255, 59, 48, 0.9)';
                btn.disabled = false;

                this.showTemporaryMessage('❌ Permisos denegados. Ve a Configuración > Safari > Sensores de Movimiento', 'error');

                // 🆕 NUEVO: También notificar en caso de error
                if (this.registrationManager && this.registrationManager.state.isVisible) {
                    setTimeout(() => {
                        this.registrationManager.updatePermissionButtonStates();
                    }, 500);
                }

                // Mostrar modo de respaldo
                this.showFallbackOption();
            }

        } catch (error) {            
            btn.textContent = '❌ Error - Reintentar';
            btn.disabled = false;

            this.showTemporaryMessage('❌ Error solicitando permisos. Inténtalo de nuevo.', 'error');

            // 🆕 NUEVO: También notificar en caso de error catch
            if (this.registrationManager && this.registrationManager.state.isVisible) {
                setTimeout(() => {
                    this.registrationManager.updatePermissionButtonStates();
                }, 500);
            }
        }
    }

    /**
     * Reinicializar RoomTracker con permisos concedidos
     */
    async reinitializeRoomTracker() {
        if (this.roomTracker) {            
            // Recrear RoomTracker
            this.roomTracker = new RoomTracker(
                this.config.roomSize.width,
                this.config.roomSize.height,
                this.messageManager
            );

            // Reconfigurar callback
            this.roomTracker.onPositionUpdate((position) => {
                this.handlePositionUpdate(position);
            });

        }
    }

    /**
     * Mostrar opción de modo estático
     */
    showFallbackOption() {
        const fallbackBtn = document.createElement('button');
        fallbackBtn.className = 'btn-secondary';
        fallbackBtn.innerHTML = '📍 Continuar sin Sensores';
        fallbackBtn.style.cssText = `
            position: fixed;
            bottom: 180px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            padding: 12px 20px;
            font-size: 14px;
            font-weight: bold;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            background: rgba(100, 100, 100, 0.9);
            color: white;
            border: 2px solid rgba(100, 100, 100, 0.5);
            min-width: 180px;
            pointer-events: auto;
            touch-action: manipulation;
        `;

        document.body.appendChild(fallbackBtn);

        fallbackBtn.addEventListener('click', () => {
            this.showTemporaryMessage('📍 Modo estático activado - tu posición será fija', 'info');
            fallbackBtn.remove();
            document.getElementById('iosPermissionBtn')?.remove();
        });
    }

    /**
     * Configurar sistema de lanzamiento
     */
    setupThrowMechanics() {
        this.throwMechanics = new ThrowMechanics(this.messageManager);
        
        this.throwMechanics.setOnThrowHit((hitData) => {
            this.handleThrowHit(hitData);
        });
        
        this.throwMechanics.setOnThrowMiss((missData) => {
            this.handleThrowMiss(missData);
        });
        
    }

    /**
     * Manejar hit exitoso de lanzamiento
     */
    handleThrowHit(hitData) {
        const { target, accuracy, multiplier, screenDistance, physicalDistance } = hitData;

        const element = document.getElementById(`spawn-${target.id}`);
        const actualNameSeen  = element?.dataset.spawnName || target.name;

        this.lastSeenObjectName = actualNameSeen;
        
        
        this.socketManager.attemptCapture({
            spawnId: target.id,
            playerPosition: this.roomTracker.getPosition(),
            captureMethod: 'throw',
            throwAccuracy: accuracy,
            throwMultiplier: multiplier,
            screenDistance: screenDistance,
            physicalDistance: physicalDistance,
            clientSeenName: actualNameSeen
        });
        
        this.showThrowAccuracyFeedback(accuracy, multiplier);
    }

    /**
     * Manejar miss de lanzamiento
     */
    handleThrowMiss(missData) {
        const { target, screenDistance, reason } = missData;
        
        this.showTemporaryMessage('¡Inténtalo de nuevo!', 'info');
    }

    /**
     * Mostrar feedback de precisión de lanzamiento
     */
    showThrowAccuracyFeedback(accuracy, multiplier) {
        const messages = {
            perfect: '🎯 ¡PERFECTO!',
            good: '👍 ¡Buen tiro!',
            okay: '👌 No está mal'
        };
        
        const colors = {
            perfect: '#FFD700',
            good: '#00FF88',
            okay: '#FF9500'
        };
        
        const message = messages[accuracy] || '👍 ¡Acertaste!';
        const multiplierText = multiplier !== 1.0 ? ` (${multiplier}x)` : '';
        
        this.showTemporaryMessage(message + multiplierText, 'success', colors[accuracy]);
    }

    /**
     * Configurar UI limpia
     */
    setupCleanUI() {
        this.createCleanIndicators();
    }

    createCleanIndicators() {
        this.createCleanPointsDisplay();
        this.createCleanConnectionStatus();
        // 📊 BOTÓN DE ESTADÍSTICAS - Crear solo si no hay partida activa
        if (!this.gameState.isJoined) {
            this.createStatsButton();
        }
    }

    createCleanPointsDisplay() {
        let playerDisplay = document.getElementById('cleanPlayerDisplay');
        if (!playerDisplay) {
            playerDisplay = document.createElement('div');
            playerDisplay.id = 'cleanPlayerDisplay';
            playerDisplay.className = 'clean-player-display';
            document.body.appendChild(playerDisplay);
        }

        // 🆕 MEJORA: Actualizar con datos correctos siempre
        this.updatePlayerDisplayInfo();
    }

    updatePlayerDisplayInfo() {
        const playerDisplay = document.getElementById('cleanPlayerDisplay');
        if (!playerDisplay) return;
        
        // Obtener datos del jugador con múltiples fuentes
        const playerData = this.getRegistrationData() || 
                          this.progressiveFlowManager?.getRegistrationData() || 
                          this.playerRegistrationData;
        
        let playerName = 'Jugador AR'; // Fallback default
        
        if (playerData) {
            // Intentar diferentes formatos de nombre
            if (playerData.name && playerData.lastName) {
                playerName = `${playerData.name} ${playerData.lastName}`;
            } else if (playerData.nombre && playerData.apellido) {
                playerName = `${playerData.nombre} ${playerData.apellido}`;
            } else if (playerData.name) {
                playerName = playerData.name;
            } else if (playerData.nombre) {
                playerName = playerData.nombre;
            }
        }

        console.log(`🏷️ Actualizando display con nombre: "${playerName}"`);

        // Generar iniciales para el avatar
        const initials = this.generateInitials(playerName);

        playerDisplay.innerHTML = `
            <div class="player-header">
                <div class="player-avatar">${initials}</div>
                <div class="player-info">
                    <div class="player-name">${playerName}</div>
                    <div class="player-status">• En juego</div>
                </div>
            </div>

            <div class="points-section">
                <div class="points-main">
                    <div class="points-value">${this.gameState.player.points || 0}</div>
                    <div class="points-label">puntos</div>
                </div>
                <div class="stats-mini">
                    <div class="stat-item">
                        🎯 <span class="stat-value captures">${this.gameState.player.captures || 0}</span>
                    </div>
                    <div class="stat-item">
                        🔥 <span class="stat-value streak">${this.gameState.player.streak || 0}x</span>
                    </div>
                </div>
            </div>
        `;
    }

    generateInitials(fullName) {
        if (!fullName) return 'JA';
        
        const names = fullName.trim().split(' ').filter(name => name.length > 0);
        
        if (names.length >= 2) {
            // Usar primera letra del primer nombre y primera letra del último apellido
            return (names[0][0] + names[names.length - 1][0]).toUpperCase();
        } else if (names.length === 1) {
            // Si solo hay un nombre, usar las dos primeras letras
            const name = names[0];
            return name.length >= 2 ? 
                (name[0] + name[1]).toUpperCase() : 
                (name[0] + name[0]).toUpperCase();
        }

        return 'JA'; // Fallback
    }

    createCleanConnectionStatus() {
        let connectionStatus = document.getElementById('cleanConnectionStatus');
        if (!connectionStatus) {
            connectionStatus = document.createElement('div');
            connectionStatus.id = 'cleanConnectionStatus';
            connectionStatus.className = 'clean-connection-status';
            document.body.appendChild(connectionStatus);
        }
        
        connectionStatus.innerHTML = `<div class="connection-dot"></div>`;
    }

    /**
     * 📊 Crear botón de estadísticas
     */
    createStatsButton() {
        // Solo mostrar si no hay partida activa
        if (this.gameState.isJoined) {
            this.hideStatsButton();
            return;
        }
        
        let statsBtn = document.getElementById('statsButton');
        if (!statsBtn) {
            statsBtn = document.createElement('button');
            statsBtn.id = 'statsButton';
            statsBtn.className = 'stats-button entering';
            statsBtn.innerHTML = '📊 Estadísticas';
            statsBtn.title = 'Ver mis estadísticas';
            
            // Event listener
            statsBtn.addEventListener('click', () => {
                this.openStatsPage();
            });
            
            document.body.appendChild(statsBtn);
            
            // Remover clase de animación después de la animación
            setTimeout(() => {
                statsBtn.classList.remove('entering');
            }, 500);
        }
        
        statsBtn.style.display = 'flex';
    }

    /**
     * Ocultar botón de estadísticas
     */
    hideStatsButton() {
        const statsBtn = document.getElementById('statsButton');
        if (statsBtn) {
            statsBtn.style.display = 'none';
        }
    }

    /**
     * Ocultar botones de cámara y juego durante la partida
     */
    hideGameButtons() {
        if (this.elements.startCameraBtn) {
            this.elements.startCameraBtn.style.display = 'none';
        }
        if (this.elements.joinGameBtn) {
            this.elements.joinGameBtn.style.display = 'none';
        }
    }

    /**
     * Mostrar botones de cámara y juego al finalizar la partida
     */
    showGameButtons() {
        // 🆕 Solo mostrar si no están ya activados correctamente
        if (this.elements.startCameraBtn) {
            this.elements.startCameraBtn.style.display = 'block';

            // 🆕 MANTENER ESTADO: Si la cámara ya está activa, mantener botón deshabilitado
            if (this.cameraManager && this.cameraManager.isActive) {
                this.elements.startCameraBtn.textContent = '✅ Cámara Activa';
                this.elements.startCameraBtn.disabled = true;
            } else {
                this.elements.startCameraBtn.textContent = '📱 Activar Cámara';
                this.elements.startCameraBtn.disabled = false;
            }
        }

        if (this.elements.joinGameBtn) {
            this.elements.joinGameBtn.style.display = 'block';
            // El estado de este botón se maneja en handleRegistrationValidationError
        }
    }

    /**
     * Abrir página de estadísticas
     */
    openStatsPage() {
        const registrationData = this.getRegistrationData();
        
        if (!registrationData) {
            this.showTemporaryMessage('Debes registrarte para ver estadísticas', 'info');
            return;
        }
        
        const statsUrl = `https://mashup-personal-dg.web.app/?userMail=${encodeURIComponent(registrationData.email)}&userName=${encodeURIComponent(registrationData.name)}&userLastName=${encodeURIComponent(registrationData.lastName)}`;        
        try {
            // Abrir en navegador externo (sale de la PWA)
            window.open(statsUrl, '_blank');
            
            // Feedback al usuario
            this.showTemporaryMessage('📊 Abriendo estadísticas en navegador...', 'info');
            
        } catch (error) {
            console.error('❌ Error abriendo estadísticas:', error);
            this.showTemporaryMessage('❌ Error al abrir estadísticas', 'error');
        }
    }


    initializeElements() {
        this.elements = {
            cameraVideo: document.getElementById('cameraVideo'),
            arOverlay: document.getElementById('arOverlay'),
            connectionStatus: document.getElementById('connectionStatus'),
            pointsDisplay: document.getElementById('points'),
            spawnsDisplay: document.getElementById('activeSpawns'),
            messageBox: document.getElementById('messageBox'),
            startCameraBtn: document.getElementById('startCameraBtn'),
            joinGameBtn: document.getElementById('joinGameBtn')
        };

        const critical = ['arOverlay'];
        critical.forEach(id => {
            if (!this.elements[id]) {
                throw new Error(`Elemento crítico no encontrado: ${id}`);
            }
        });
    }

    async initializeManagers() {
        this.messageManager = new MessageManager();
        
        // 🆕 INICIALIZAR PROGRESSIVE FLOW MANAGER PRIMERO
        this.progressiveFlowManager = new ProgressiveFlowManager(this.messageManager);
        
        // 🆕 Configurar callbacks del flow manager
        this.progressiveFlowManager.setOnRegistrationComplete(() => {
            console.log('📝 Registration callback called from GameClient');
            this.handleRegistrationFlowTriggered();
        });

        this.progressiveFlowManager.setOnReadyToPlay((registrationData) => {
            this.handleReadyToPlay(registrationData);
        });

        // AHORA SÍ determinar pantalla inicial
        this.progressiveFlowManager.determineInitialScreen();

        // Solo inicializar otros managers si estamos en pantalla de juego
        if (this.progressiveFlowManager.getCurrentScreen() === 'game') {
            await this.initializeGameManagers();
        }
    }
    async initializeGameManagers() {
        this.cameraManager = new CameraManager(this.messageManager);
        this.socketManager = new SocketManager(this.messageManager);
        this.fovManager = new FOVManager();
        this.pwaManager = new PWAManager(this.messageManager);
        this.apiManager = new ApiManager(this.messageManager);
        
        // 🆕 CREAR REGISTRATION MANAGER PERO NO INICIALIZAR AÚN
        this.registrationManager = new RegistrationManager(this.messageManager);
        
        // Configurar callback del registration manager
        this.registrationManager.setOnRegistrationSuccess((playerData) => {
            this.handleRegistrationSuccess(playerData);
        });

        // 🔧 MOVER setupEventListeners AQUÍ para asegurar que se ejecute
        this.setupEventListeners();

        // Solo inicializar RoomTracker si no es iOS o si ya tiene permisos
        if (!Utils.isIOS() || this.iosPermissions.granted) {
            this.roomTracker = new RoomTracker(
                this.config.roomSize.width,
                this.config.roomSize.height,
                this.messageManager
            );
        } else {
            // En iOS, crear un tracker dummy hasta tener permisos
            this.roomTracker = {
                getPosition: () => ({ x: 2.5, y: 2.5 }),
                getHeading: () => 0,
                isReady: () => true,
                onPositionUpdate: () => {},
                reset: () => {},
            };
        }

        this.setupManagerCallbacks();
        // this.setupEventListeners();
        this.setupInteractions();
        this.setupCleanUI();
        this.setupThrowMechanics();
    }

    handleRegistrationFlowTriggered() {        
        // Asegurarse de que el registration manager esté inicializado
        if (!this.registrationManager) {
            this.registrationManager = new RegistrationManager(this.messageManager);
            this.registrationManager.setOnRegistrationSuccess((playerData) => {
                this.handleRegistrationSuccess(playerData);
            });
        }

        // Mostrar formulario de registro
        this.registrationManager.show();
    }

    setupManagerCallbacks() {
        this.roomTracker.onPositionUpdate((position) => {
            this.handlePositionUpdate(position);
        });

        this.socketManager.on('socket-connected', () => {
            this.handleSocketConnected();
        });

        this.socketManager.on('game-state-received', (state) => {
            this.handleGameState(state);
        });

        // callbacks de proximidad ahora con FOV
        this.socketManager.on('spawn-discovered', (data) => {
            this.handleSpawnDiscovered(data);
        });

        this.socketManager.on('spawn-hidden', (data) => {
            this.handleSpawnHidden(data);
        });

        this.socketManager.on('spawn-removed', (data) => {
            this.handleSpawnRemoved(data);
        });

        this.socketManager.on('spawn-captured', (data) => {
            this.handleSpawnCaptured(data);
        });

        this.socketManager.on('capture-failed', (data) => {
            this.handleCaptureFailed(data);
        });

        this.socketManager.on('streak-bonus', (data) => {
            this.handleStreakBonus(data);
        });
    }

    setupEventListeners() {        
        // Event listeners existentes...
        this.elements.startCameraBtn?.addEventListener('click', () => {
            this.handleStartCamera();
        });

        if (this.progressiveFlowManager && this.progressiveFlowManager.getCurrentScreen() === 'game') {
            this.elements.joinGameBtn?.addEventListener('click', () => {
                this.handleJoinGame();
            });
        }

        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });

        window.addEventListener('deviceorientation', () => {
            this.updateFOVDisplay();
        });

        // Cierre de página/app
        window.addEventListener('beforeunload', (event) => {
            this.sendDisconnectionBeacon();
        });

        // App va a segundo plano (móviles)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.sendDisconnectionBeacon();
            }
        });

        // PWA: cuando se cierra la app
        window.addEventListener('pagehide', (event) => {
            this.sendDisconnectionBeacon();
        });

        // chequeo que el socketManager tenga sus listeners
        if (this.socketManager) {
            console.log('Verificando socketManager listeners...');
            // Esto se hace en socketManager, pero verificamos que exista
        }
    }

    setupInteractions() {
        if (!this.elements.arOverlay) return;

        this.elements.arOverlay.addEventListener('touchstart', (e) => {
            this.handleThrowTouch(e);
        });

        this.elements.arOverlay.addEventListener('touchend', (e) => {
            this.handleTouchEnd(e);
        });

        this.elements.arOverlay.addEventListener('click', (e) => {
            this.handleThrowClick(e);
        });
    }

    // MANEJADORES DE LANZAMIENTO
    handleThrowTouch(event) {
        if (!this.gameState.isJoined || this.captureState.isCapturing) return;
        if (this.throwMechanics.isThrowActive()) return;
        
        event.preventDefault();
        const touch = event.touches[0];
        this.attemptThrow(touch.clientX, touch.clientY);
    }

    handleThrowClick(event) {
        if (!this.gameState.isJoined || this.captureState.isCapturing) return;
        if (this.throwMechanics.isThrowActive()) return;
        
        event.preventDefault();
        this.attemptThrow(event.clientX, event.clientY);
    }

    attemptThrow(tapX, tapY) {
        this.captureState.isCapturing = true;        
        // usar spawns visibles en lugar de todos los spawns
        const result = this.throwMechanics.attemptThrow(
            tapX, 
            tapY, 
            this.gameState.visibleSpawns, 
            this.roomTracker.getPosition()
        );
        
        if (!result.success) {
            if (result.reason === 'No hay objetivos disponibles') {
                this.showTemporaryMessage('No hay objetos visibles', 'info');
            } else {
                this.showTemporaryMessage('¡Inténtalo de nuevo!', 'info');
            }
            this.captureState.isCapturing = false;
        } else {
            setTimeout(() => {
                this.captureState.isCapturing = false;
            }, 1000);
        }
    }

    sendDisconnectionBeacon() {        
        const socketId = this.socketManager?.socket?.id;
        
        if (!socketId) {
            return;
        }

        if (!this.apiManager) {
            return;
        }

        try {
            const data = JSON.stringify({ IdSocket: socketId });
            const url = `${this.apiManager.baseURL}/RegistroUsuario/desactivar`;

            if (navigator.sendBeacon) {
                const sent = navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }));
            } else {
                // No hacer fetch aquí porque beforeunload es muy limitado
            }
        } catch (error) {
            console.error('Error enviando beacon de desconexión:', error);}
    }

    //  MANEJADORES DE PROXIMIDAD CON FOV

    /**
     *  Manejar spawn descubierto - CON POSICIÓN MUNDIAL
     */
    handleSpawnDiscovered(data) {
        const { spawn, distance } = data;
        
        const spawnWithWorld = {
            ...spawn,
            worldPosition: this.generateWorldPosition(spawn)
        };
        
        // Agregar al estado local
        this.gameState.spawns.push(spawnWithWorld);
        
        // actualizar FOV para determinar visibilidad
        this.updateFOVDisplay();
        
    }

    /**
     *  Generar posición mundial para spawn - MEJORADO
     */
    generateWorldPosition(spawn) {
        const playerPos = this.roomTracker.getPosition();
 
        // distribución más amplia alrededor del jugador
        const angle = Math.random() * 2 * Math.PI;
        const distance = 4.0 + Math.random() * 2.0; // Entre 4.0-6.0 metros
 
        // algunos objetos más lejos para mayor variedad
        const isDistantObject = Math.random() < 0.3; // 30% de objetos distantes
        const finalDistance = isDistantObject ? distance + 1.0 : distance;
 
        const worldX = playerPos.x + Math.cos(angle) * finalDistance;
        const worldY = playerPos.y + Math.sin(angle) * finalDistance;
 
        return {
            x: Math.max(0.3, Math.min(4.7, worldX)), // Usar más espacio de la sala
            y: Math.max(0.3, Math.min(4.7, worldY))
        };
    }


    // generateWorldPosition(spawn) {
    //     const playerPos = this.roomTracker.getPosition();
        
    //     // 🆕 NUEVA DISTRIBUCIÓN: Evitar objetos en centro de pantalla
    //     const angle = Math.random() * 2 * Math.PI;
    //     const minDistance = 2.5; // 🆕 Distancia mínima más grande
    //     const maxDistance = 6.0; // 🆕 Aprovechar sala más grande
        
    //     // 🆕 DISTRIBUCIÓN NO UNIFORME: Más objetos lejos que cerca
    //     const distanceRandom = Math.random();
    //     const distance = distanceRandom < 0.3 ? 
    //         minDistance + Math.random() * 1.5 :  // 30% cerca (2.5-4.0m)
    //         4.0 + Math.random() * 2.0;           // 70% lejos (4.0-6.0m)
        
    //     const worldX = playerPos.x + Math.cos(angle) * distance;
    //     const worldY = playerPos.y + Math.sin(angle) * distance;
        
    //     return {
    //         x: Math.max(0.5, Math.min(7.5, worldX)), // 🆕 Nuevos límites para sala 8x8
    //         y: Math.max(0.5, Math.min(7.5, worldY))
    //     };
    // }
    /**
     * Manejar spawn oculto
     */
    handleSpawnHidden(data) {
        const { spawnId } = data;
        
        // Remover del estado local
        this.gameState.spawns = this.gameState.spawns.filter(s => s.id !== spawnId);
        this.gameState.visibleSpawns = this.gameState.visibleSpawns.filter(s => s.id !== spawnId);
        
        // Remover del DOM
        this.removeSpawnFromDOM(spawnId);
    }

    /**
     * Manejar spawn removido
     */
    handleSpawnRemoved(data) {
        const { spawnId } = data;
        
        // Remover del estado local
        this.gameState.spawns = this.gameState.spawns.filter(s => s.id !== spawnId);
        this.gameState.visibleSpawns = this.gameState.visibleSpawns.filter(s => s.id !== spawnId);
        
        // Remover del DOM
        this.removeSpawnFromDOM(spawnId);
    }

    // EVENT HANDLERS
    async handleStartCamera() {
        const success = await this.cameraManager.requestCameraAccess();
        
        if (success) {
            this.elements.startCameraBtn.textContent = '✅ Cámara Activa';
            this.elements.startCameraBtn.disabled = true;
            
            if (this.socketManager.isConnected) {
                this.elements.joinGameBtn.disabled = false;
            }
        }
    }

    handleJoinGame() {

        if (this.elements.joinGameBtn.disabled) {
            return;
        }
        // Verificar que la cámara esté activa
        if (!this.cameraManager.isActive) {
            this.showTemporaryMessage('Primero activa la cámara', 'error');
            return;
        }

        this.proceedWithGameJoin();
    }

    handleTouchEnd(event) {
        const now = Date.now();
        
        if (now - this.captureState.lastTapTime < 300) {
            this.captureState.tapCount++;
            if (this.captureState.tapCount === 2) {
                this.attemptClassicCapture('double-tap');
                this.captureState.tapCount = 0;
            }
        } else {
            this.captureState.tapCount = 1;
        }
        
        this.captureState.lastTapTime = now;
    }

    handleRegistrationSuccess(playerData) {    
        // Guardar datos del jugador
        this.playerRegistrationData = {
            ...playerData,
            IdSocket: null, // Se asignará cuando se conecte
            registeredAt: Date.now()
        };

        this.showTemporaryMessage('✅ Registro completado', 'success');


        // 🆕 MEJORA: Actualizar display inmediatamente
        setTimeout(() => {
            this.updatePlayerDisplayInfo();
        }, 100);
        // Datos para el backend
        this.progressiveFlowManager.handleRegistrationCompleted(playerData);

    }

    async handleReadyToPlay(registrationData) {        
        // Si no están inicializados, inicializarlos ahora
        if (!this.cameraManager) {
            await this.initializeGameManagers();
        }

        // Configurar datos de registro
        if (registrationData) {
            this.playerRegistrationData = {
                name: registrationData.nombre || registrationData.name,
                lastName: registrationData.apellido || registrationData.lastName,
                email: registrationData.email,
                IdSocket: null,
                registeredAt: registrationData.timestamp ? new Date(registrationData.timestamp).getTime() : Date.now()
            };
        }

        // 🆕 MEJORA: Actualizar display con datos correctos
        setTimeout(() => {
            this.updatePlayerDisplayInfo();
        }, 200);

        // 📊 MOSTRAR BOTÓN DE ESTADÍSTICAS CUANDO ESTÉ LISTO PARA JUGAR
        setTimeout(() => {
            this.createStatsButton();
        }, 500);

        // Permisos iOS si es necesario
        this.checkiOSPermissions();
    }

    async proceedWithGameJoin() {
        // Prevenir doble click
        if (this.elements.joinGameBtn.disabled) {
            return;
        }

        // Deshabilitar botón temporalmente
        this.elements.joinGameBtn.disabled = true;
        this.elements.joinGameBtn.textContent = '⏳ Conectando...';

        // Verificar que el socket esté conectado
        if (!this.socketManager.isConnected) {
            this.socketManager.forceReconnect();

            // Esperar un momento para la reconexión
            await new Promise(resolve => setTimeout(resolve, 2000));

            if (!this.socketManager.isConnected) {
                this.elements.joinGameBtn.disabled = false;
                this.elements.joinGameBtn.textContent = '🎮 Jugar';
                this.showTemporaryMessage('Error de conexión. Inténtalo de nuevo.', 'error');
                return;
            }
        }

        const registrationData = this.playerRegistrationData || this.progressiveFlowManager.getRegistrationData();

        // 🆕 Validar que hay datos de registro válidos
        if (!registrationData || !registrationData.email) {
            this.elements.joinGameBtn.disabled = false;
            this.elements.joinGameBtn.textContent = '🎮 Jugar';
            this.handleRegistrationValidationError('Datos de registro faltantes');
            return;
        }

        try {
            // 🆕 PASO CRÍTICO: Enviar registro al backend AHORA (no antes)
            this.elements.joinGameBtn.textContent = '⏳ Validando registro...';

            const registrationResult = await this.sendRegistrationToBackend(registrationData);

            if (!registrationResult.success) {
                throw new Error(registrationResult.error);
            }

            // 🆕 Si llegamos aquí, el backend respondió OK
            console.log('✅ Backend validó registro correctamente');

            // Obtener nombre completo del jugador
            const playerName = registrationData ? 
                `${registrationData.name || registrationData.nombre} ${registrationData.lastName || registrationData.apellido}` : 
                'Jugador AR';

            // Ahora sí, unirse al juego en el socket
            this.elements.joinGameBtn.textContent = '⏳ Iniciando juego...';

            const success = this.socketManager.joinGame({
                name: playerName,
                position: this.roomTracker.getPosition(),
                registrationData: registrationData
            });


            if (success) {
                this.gameState.isJoined = true;
                this.gameState.player.joinedAt = Date.now();

                // 🐛 DEBUG: Más información sobre el modal
                if (this.registrationManager) {
                    console.log('🔍 DEBUG Modal - Existe:', !!this.registrationManager);
                    console.log('🔍 DEBUG Modal - Visible según estado:', this.registrationManager.state?.isVisible);
                    console.log('🔍 DEBUG Modal - Overlay existe:', !!this.registrationManager.elements?.overlay);
                    console.log('🔍 DEBUG Modal - Clases CSS:', this.registrationManager.elements?.overlay?.className);

                    if (this.registrationManager.state.isVisible) {
                        console.log('✅ Juego iniciado exitosamente, cerrando modal');

                        // 🆕 FORZAR CIERRE MÁS AGRESIVO
                        const overlay = this.registrationManager.elements.overlay;
                        if (overlay) {
                            overlay.classList.remove('show');
                            overlay.classList.add('hide');
                            overlay.style.display = 'none';
                            overlay.style.visibility = 'hidden';
                            overlay.style.opacity = '0';
                            overlay.style.zIndex = '-1';
                        }

                        this.registrationManager.state.isVisible = false;
                        console.log('🚪 Modal forzadamente cerrado con múltiples métodos');
                    } else {
                        console.log('⚠️ Modal ya reporta como no visible, pero tal vez sigue en pantalla');
                    }
                }

                // 📊 OCULTAR BOTÓN DE ESTADÍSTICAS DURANTE EL JUEGO
                this.hideStatsButton();

                // Ocultar también los botones de cámara y juego
                this.hideGameButtons();

                this.elements.joinGameBtn.textContent = '✅ En Juego';
                this.elements.joinGameBtn.disabled = true;

                if (this.registrationManager && !this.registrationManager.state.isVisible) {
                    console.log('✅ Juego iniciado exitosamente, cerrando modal');
                    this.registrationManager.forceHide();
                }

                // 🆕 SOLO AHORA INICIAR TIMER (después de que todo salió bien)
                setTimeout(() => {
                    this.startGameTimer();
                }, 1000);

                setTimeout(() => {
                    this.showTemporaryMessage('¡1 minuto para conseguir los máximos puntos!', 'info');
                }, 2000);

            } else {
                // Error al unirse al socket
                this.elements.joinGameBtn.disabled = false;
                this.elements.joinGameBtn.textContent = '🎮 Jugar';
                this.showTemporaryMessage('Error al unirse al juego', 'error');
            }

        } catch (error) {
            console.error('❌ Error en proceedWithGameJoin:', error);

            // 🆕 NUEVO: Diferenciar tipos de error
            if (this.isRegistrationError(error.message)) {
                // Solo errores de REGISTRO borran datos
                console.log('🚫 Error de registro detectado, reseteando datos');
                this.handleRegistrationValidationError(error.message);
            } else {
                // Errores de EVENTOS/SERVIDOR no borran registro
                console.log('⚠️ Error de servidor/eventos, manteniendo registro');
                this.handleServerError(error.message);
            }
        }
    }

    // 🆕 FUNCIÓN MEJORADA: Detectar si es error de registro
    isRegistrationError(errorMessage) {
        const lowerMessage = errorMessage.toLowerCase();

        // 🎯 ERRORES DE EVENTOS (NO son errores de registro)
        const eventErrors = [
            'no hay eventos activos',
            'en este momento.',
            'evento no creado',
            'eventos creados',
            'evento no encontrado'
        ];

        // Si es error de eventos, NO es error de registro
        if (eventErrors.some(keyword => lowerMessage.includes(keyword))) {
            return false;
        }

        // 🎯 ERRORES DE REGISTRO (SÍ borran datos)
        const registrationErrors = [
            'email debe ser corporativo',
            'gmail',
            'hotmail',
            'datos de registro faltantes',
            'usuario no válido',
            'email inválido'
        ];

        return registrationErrors.some(keyword => lowerMessage.includes(keyword));
    }

    handleServerError(errorMessage) {
        console.log('🔧 Manejando error de servidor sin borrar registro');
        
        // Resetear botón de jugar
        if (this.elements.joinGameBtn) {
            this.elements.joinGameBtn.disabled = false;
            this.elements.joinGameBtn.textContent = '🎮 Jugar';
        }
        
        // Mostrar mensaje de error específico
        if (errorMessage.includes('evento') || errorMessage.includes('creado')) {
            this.showTemporaryMessage('❌ No hay eventos activos en este momento. Disfruta de las charlas, nos vemos pronto.', 'error');
        } else {
            this.showTemporaryMessage(`❌ ${errorMessage}`, 'error');
        }
        
        // NO borrar datos de registro
        // NO resetear localStorage
        // NO resetear playerRegistrationData
    }

    async sendRegistrationToBackend(registrationData) {
        try {
            const currentSocketId = this.socketManager.socket?.id;

            if (!currentSocketId) {
                throw new Error('Socket ID no disponible');
            }

            console.log('📤 Enviando registro al backend...');

            const response = await this.apiManager.sendRegistration({
                Nombre: registrationData.name,
                Apellido: registrationData.lastName,
                Email: registrationData.email,
                IdSocket: currentSocketId
            });

            console.log('✅ Backend respondió OK:', response);

            // Actualizar socket ID local
            registrationData.IdSocket = currentSocketId;

            return { success: true, data: response };

        } catch (error) {
            console.error('❌ Error enviando registro:', error);

            if (error.isValidationError && error.status === 400) {
                return { 
                    success: false, 
                    error: `Error de validación: ${error.message}.`
                };
            }

            return { 
                success: false, 
                error: error.message || 'Error de conexión con el servidor'
            };
        }
    }    

    /**
    * Manejar error de validación de registro
    */
    async handleRegistrationValidationError(errorMessage) {
        console.log('🚫 Error de validación del backend, reseteando registro PERO manteniendo cámara/sensores');

        // 🆕 DETENER TIMER SI ESTABA ACTIVO
        this.stopGameTimer();

        // 1. Limpiar localStorage
        localStorage.removeItem('datago-registro');

        // 2. Resetear estado del progressive flow
        if (this.progressiveFlowManager) {
            this.progressiveFlowManager.resetRegistrationState();
        }

        // 3. Resetear datos locales
        this.playerRegistrationData = null;

        // 4. Resetear estado del juego PERO NO la cámara ni sensores
        this.gameState.isJoined = false;
        this.gameState.spawns = [];
        this.gameState.visibleSpawns = [];
        this.gameState.player.points = 0;
        this.gameState.player.captures = 0;
        this.gameState.player.streak = 0;
        this.gameState.player.bestStreak = 0;

        // 5. 🆕 MANTENER BOTONES DE CÁMARA Y SENSORES EN SU ESTADO ACTUAL
        // NO resetear this.cameraManager.isActive
        // NO resetear this.iosPermissions.granted

        // 6. Resetear botón de jugar
        if (this.elements.joinGameBtn) {
            this.elements.joinGameBtn.disabled = false;
            this.elements.joinGameBtn.textContent = '🎮 Jugar';
            this.elements.joinGameBtn.style.display = 'block';
        }

        // 7. 🆕 MOSTRAR BOTONES SI ESTABAN OCULTOS (pero mantener su estado)
        this.showGameButtons();

        // 8. Limpiar AR overlay
        if (this.elements.arOverlay) {
            this.elements.arOverlay.innerHTML = '';
        }

        // 9. Mostrar mensaje de error
        this.showTemporaryMessage(`❌ ${errorMessage}`, 'error');

        if (this.registrationManager && this.registrationManager.state.isVisible) {
            console.log('📝 Regresando al formulario de registro con error');
            this.registrationManager.resetToRegistrationWithError(errorMessage);
        } else {
            // Si el modal no está visible, mostrarlo desde cero
            if (this.registrationManager) {
                this.registrationManager.resetToRegistrationWithError(errorMessage);
            }
        }

        // 10. 📊 MOSTRAR BOTÓN DE ESTADÍSTICAS si corresponde
        if (!this.gameState.isJoined) {
            this.createStatsButton();
        }

        // 11. Actualizar UI
        this.updatePlayerDisplayInfo();

    }

    attemptClassicCapture(method = 'button') {
        if (this.captureState.isCapturing) return;
        
        if (!this.gameState.isJoined) {
            this.showTemporaryMessage('Únete al juego primero', 'error');
            return;
        }
        
        //  Verificar spawns visibles en lugar de elementos DOM
        if (this.gameState.visibleSpawns.length === 0) {
            this.showTemporaryMessage('No hay objetos visibles', 'info');
            return;
        }
        
        this.captureState.isCapturing = true;
        this.socketManager.attemptCapture({
            playerPosition: this.roomTracker.getPosition(),
            captureMethod: method
        });
        
        setTimeout(() => {
            this.captureState.isCapturing = false;
        }, 800);
    }

    handleVisibilityChange() {
        if (this.cameraManager) {
            this.cameraManager.handleVisibilityChange();
        }
    }

    // SOCKET EVENT HANDLERS
    handleSocketConnected() {
        this.updateCleanConnectionStatus(true);
        
        if (this.cameraManager.isActive) {
            this.elements.joinGameBtn.disabled = false;
        }
    }

    handleGameState(state) {        
        this.gameState.player = state.player;
        this.gameState.totalPlayers = state.totalPlayers || 1;
        
        //  Procesar spawns con posiciones mundiales
        if (state.spawns) {
            this.gameState.spawns = state.spawns.map(spawn => ({
                ...spawn,
                worldPosition: spawn.worldPosition || this.generateWorldPosition(spawn)
            }));
            
            // Actualizar FOV
            this.updateFOVDisplay();
        }
        
        this.updateCleanUI();
    }

    handleSpawnCaptured(data) {
        this.removeSpawnFromDOM(data.spawnId);
        
        // Remover de ambos arrays
        this.gameState.spawns = this.gameState.spawns.filter(s => s.id !== data.spawnId);
        this.gameState.visibleSpawns = this.gameState.visibleSpawns.filter(s => s.id !== data.spawnId);
        
        if (data.playerId === this.socketManager.socket?.id) {
            this.gameState.player.points = data.newPoints;
            this.gameState.player.streak = data.streak || 0;
            this.gameState.player.captures++;

            // 🆕 CRÍTICO: Actualizar timer de inactividad
            this.updateLastCaptureTime();

            //Datos para endpoint de captura
            this.logCaptureEvent(data);
            
            this.updateCleanUI();
            this.showCaptureSuccess(data);
            
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }
        }
    }

    async logCaptureEvent(captureData) {
        const registrationData = this.playerRegistrationData || this.progressiveFlowManager.getRegistrationData();

        if (!registrationData) {
            return;
        }

        //Estructura exacta para el backend
        await this.apiManager.sendCapture({
            IdSocket: captureData.playerId || '',
            ObjetoQlik: {
                Id: captureData.objectId || 0,
                Nombre: captureData.objectName || 'Objeto desconocido',
                Rareza: captureData.objectRarity || 'common',
                Valor: captureData.objectPoints || 10,
                IndicadorId: String(captureData.objectId || 0)
            },
            Puntuacion: captureData.pointsEarned || 0
        });
    }

    // 5️⃣ Mostrar éxito en el modal:
    showFinishSuccess() {
        const modal = document.getElementById('finishGameModal');
        if (!modal) return;

        modal.querySelector('.finish-modal-content').innerHTML = `
            <div class="finish-success">
                <div class="success-icon">🎉</div>
                <h2>¡Partida Finalizada!</h2>
                <p>Tus puntos se han guardado correctamente</p>
                <div class="success-points">
                    <span class="points-earned">${this.gameState.player.points}</span>
                    <span class="points-label">puntos obtenidos</span>
                </div>
                <p class="success-message">¡Gracias por jugar DataGo!</p>
            </div>
        `;
    }

    // 6️⃣ Limpiar sesión:
    cleanupGameSession() {
        console.log('🧹 Limpiando sesión de juego - MANTENIENDO cámara y sensores');
        
        // 🆕 DETENER TODOS LOS TIMERS PRIMERO
        this.stopGameTimer();
        
        // Ocultar modal si existe
        const modal = document.getElementById('gameFinishedModal');
        if (modal) {
            modal.classList.add('hide');
            setTimeout(() => modal.remove(), 300);
        }
    
        // Limpiar estado del juego pero mantener datos de registro
        this.gameState.isJoined = false;
        this.gameState.spawns = [];
        this.gameState.visibleSpawns = [];
        this.gameState.player.points = 0;
        this.gameState.player.captures = 0;
        this.gameState.player.streak = 0;
        this.gameState.player.bestStreak = 0;
    
        // 🆕 RESETEAR ESTADO DEL TIMER
        this.gameState.timer = {
            gameDuration: 1 * 60 * 1000,
            inactivityTimeout: 40 * 1000,
            startTime: null,
            lastCaptureTime: null,
            remaining: 1 * 60 * 1000,
            isActive: false,
            gameIntervalId: null,
            inactivityIntervalId: null,
            gameTimeoutId: null
        };
    
        // Limpiar AR overlay
        if (this.elements.arOverlay) {
            this.elements.arOverlay.innerHTML = '';
        }
    
        // 🆕 RESETEAR BOTONES PERO MANTENER ESTADO DE CÁMARA
        if (this.elements.joinGameBtn) {
            this.elements.joinGameBtn.disabled = false;
            this.elements.joinGameBtn.textContent = '🎮 Jugar';
            this.elements.joinGameBtn.style.display = 'block';
        }
    
        // 🆕 MANTENER ESTADO DE CÁMARA
        this.updateCameraButtonState();
    
        // 📊 MOSTRAR BOTÓN DE ESTADÍSTICAS AL FINALIZAR EL JUEGO
        setTimeout(() => {
            this.createStatsButton();
        }, 1000);
        
        // Mostrar nuevamente los botones de cámara y juego (con su estado correcto)
        this.showGameButtons();
    
        // Actualizar UI
        this.updateCleanUI();
    
        // Reconectar socket limpiamente si se perdió la conexión
        setTimeout(() => {
            if (!this.socketManager.isConnected) {
                this.socketManager.forceReconnect();
            }
        }, 1000);
    
        // Mensaje final
        this.showTemporaryMessage('¡Partida finalizada! Puedes iniciar una nueva cuando quieras.', 'success');
    }


    showCaptureSuccess(data) {
        const feedback = document.createElement('div');
        feedback.className = 'capture-feedback';
        
        let bonusText = '';
        if (data.multiplier > 1) {
            bonusText = `<div class="capture-bonus">${data.multiplier.toFixed(1)}x multiplier</div>`;
        }

        const objectName = this.lastSeenObjectName || data.objectName || 'Objeto';

        feedback.innerHTML = `
            <div class="capture-emoji">🎯</div>
            <div class="capture-points">+${data.pointsEarned}</div>
            <div class="capture-object">${objectName}</div>
            ${bonusText}
        `;
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.remove();
        }, 2000);
    }

    handleCaptureFailed(data) {
        this.showTemporaryMessage('No hay objetos cerca', 'info');
    }

    handleStreakBonus(data) {
        this.gameState.player.points += data.bonusPoints;
        this.updateCleanUI();
        
        this.showStreakBonus(data);
        
        if (navigator.vibrate) {
            navigator.vibrate([150, 100, 150, 100, 150]);
        }
    }

    showStreakBonus(data) {
        const feedback = document.createElement('div');
        feedback.className = 'capture-feedback';
        feedback.style.background = 'linear-gradient(45deg, #ff6b35, #ffd700)';
        
        feedback.innerHTML = `
            <div class="capture-emoji">🔥</div>
            <div class="capture-points">STREAK BONUS</div>
            <div class="capture-bonus">+${data.bonusPoints} puntos</div>
        `;
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.remove();
        }, 2500);
    }

    /**
     *  Manejar actualización de posición - CON FOV
     */
    handlePositionUpdate(position) {
        this.gameState.player.position = position;
        
        //  Actualizar FOV con nueva posición
        if (this.fovManager) {
            this.fovManager.updatePlayer(position, this.roomTracker.getHeading());
            this.updateFOVDisplay();
        }
        
        if (this.socketManager.isConnected && this.gameState.isJoined) {
            this.socketManager.sendPlayerMove(position);
        }
    }

    /**
     *  Actualizar display FOV - FUNCIÓN PRINCIPAL
     */
    updateFOVDisplay() {
        if (!this.fovManager || !this.fovManager.state.isReady) return;
        
        // Obtener objetos visibles según FOV
        const visibleObjects = this.fovManager.getVisibleObjects(this.gameState.spawns);
        
        // Actualizar array de objetos visibles
        const previousVisible = new Set(this.gameState.visibleSpawns.map(s => s.id));
        const currentVisible = new Set(visibleObjects.map(s => s.id));
        
        // Objetos que salen del FOV
        previousVisible.forEach(id => {
            if (!currentVisible.has(id)) {
                this.hideSpawnFromFOV(id);
            }
        });
        
        // Objetos que entran al FOV
        visibleObjects.forEach(obj => {
            if (!previousVisible.has(obj.id)) {
                this.showSpawnInFOV(obj);
            } else {
                // Actualizar posición de objetos ya visibles
                this.updateSpawnPosition(obj);
            }
        });
        
        // Actualizar array de objetos visibles
        this.gameState.visibleSpawns = visibleObjects;
        
        // Actualizar contador
        this.updateCleanObjectCounter();
    }

    /**
     *  Mostrar spawn en FOV
     */
    showSpawnInFOV(spawnWithPosition) {
        const { screenPosition, ...spawn } = spawnWithPosition;
        
        // Crear elemento DOM
        const arElement = document.createElement('div');
        arElement.className = 'ar-spawn fov-entering';
        arElement.id = `spawn-${spawn.id}`;
        const img = document.createElement('img');
        img.src = `/images/${spawn.image}`;
        img.alt = spawn.type;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';

        arElement.appendChild(img);

        arElement.dataset.spawnName = spawn.name;
        arElement.dataset.spawnType = spawn.type;


        arElement.title = `${spawn.type} - ${spawn.points} puntos`;
        
        //  Usar posición calculada por FOV
        arElement.style.left = screenPosition.x + 'px';
        arElement.style.top = screenPosition.y + 'px';
        
        // Color basado en rareza
        if (spawn.color) {
            arElement.style.filter = `drop-shadow(0 0 15px ${spawn.color})`;
        }
        
        this.elements.arOverlay.appendChild(arElement);
        
    }

    /**
     *  Ocultar spawn del FOV
     */
    hideSpawnFromFOV(spawnId) {
        const element = document.getElementById(`spawn-${spawnId}`);
        if (element) {
            element.classList.add('fov-leaving');
            setTimeout(() => {
                element.remove();
            }, 500);            
        }
    }

    /**
     *  Actualizar posición de spawn visible
     */
    updateSpawnPosition(spawnWithPosition) {
        const { screenPosition, ...spawn } = spawnWithPosition;
        const element = document.getElementById(`spawn-${spawn.id}`);
        
        if (element) {
            //  Animar transición suave de posición
            element.style.left = screenPosition.x + 'px';
            element.style.top = screenPosition.y + 'px';
        }
    }

    // MÉTODOS DE UI LIMPIA
    updateCleanUI() {
        this.updateCleanPoints();
        this.updateCleanStats();
        this.updateCleanObjectCounter();
    }

    updateCleanPoints() {
        const pointsDisplay = document.querySelector('#cleanPlayerDisplay .points-value');
        if (pointsDisplay) {
            // Animar cambio de puntos
            const currentPoints = parseInt(pointsDisplay.textContent) || 0;
            const newPoints = this.gameState.player.points;

            if (newPoints !== currentPoints) {
                this.animatePointsChange(pointsDisplay, currentPoints, newPoints);
            }
        }
    }

    updateCleanStats() {
        const capturesDisplay = document.querySelector('#cleanPlayerDisplay .captures');
        const streakDisplay = document.querySelector('#cleanPlayerDisplay .streak');
        
        if (capturesDisplay) {
            capturesDisplay.textContent = this.gameState.player.captures || 0;
        }

        if (streakDisplay) {
            const streak = this.gameState.player.streak || 0;
            streakDisplay.textContent = streak > 0 ? `${streak}x` : '0x';

            // Cambiar color según la racha
            if (streak >= 5) {
                streakDisplay.style.color = '#ff6b35'; // Naranja para rachas altas
            } else if (streak >= 3) {
                streakDisplay.style.color = '#ffd700'; // Dorado para rachas medias
            } else {
                streakDisplay.style.color = '#ffd700'; // Color normal
            }
        }
    }

    animatePointsChange(element, from, to) {
        // Efecto de escalado
        element.style.transform = 'scale(1.2)';
        element.style.color = '#00ff88';
        
        // Animación de números
        const duration = 500;
        const start = Date.now();
        const difference = to - from;
        
        const animate = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function para animación suave
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.round(from + (difference * easeOut));

            element.textContent = currentValue.toLocaleString();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Restaurar estilo normal
                setTimeout(() => {
                    element.style.transform = 'scale(1)';
                    element.style.color = '#00ff88';
                }, 100);
            }
        };

        animate();
    }

    updateCleanObjectCounter() {
        const objectCounter = document.querySelector('#cleanObjectCounter .object-count');
        if (objectCounter) {
            //  Mostrar objetos visibles en lugar de elementos DOM
            const visibleCount = this.gameState.visibleSpawns.length;
            if (objectCounter) {
                objectCounter.textContent = visibleCount;
            }
        }
    }

    updateCleanConnectionStatus(connected) {
        const statusElement = document.querySelector('#cleanPlayerDisplay .player-status');
        if (statusElement) {
            if (connected) {
                statusElement.textContent = '• En juego';
                statusElement.style.color = '#00ff88';
            } else {
                statusElement.textContent = '• Desconectado';
                statusElement.style.color = '#ff4444';
            }
        }

        // Mantener el dot de conexión también
        const dot = document.querySelector('.connection-dot');
        if (dot) {
            if (connected) {
                dot.classList.add('connected');
            } else {
                dot.classList.remove('connected');
            }
        }
    }

    showTemporaryMessage(message, type = 'info', customColor = null) {
        const messageEl = document.createElement('div');
        messageEl.className = `temporary-message ${type}`;
        messageEl.textContent = message;
        
        const colors = {
            info: '#007AFF',
            warning: '#FF9500',
            error: '#FF3B30',
            success: customColor || '#30D158'
        };
        
        messageEl.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 20px;
            z-index: 1500;
            font-size: 14px;
            animation: messageSlide 3s ease-out forwards;
            border-left: 4px solid ${colors[type] || colors.info};
        `;
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            messageEl.remove();
        }, 3000);
    }

    /**
     *  Remover spawn del DOM (ahora solo limpieza)
     */
    removeSpawnFromDOM(spawnId) {
        const element = document.getElementById(`spawn-${spawnId}`);
        if (element) {
            element.remove();
        }
    }

    // MÉTODOS PÚBLICOS DE CONTROL
    resetTracker() {
        if (this.roomTracker) {
            this.roomTracker.reset();
        }
    }

    forceReconnect() {
        if (this.socketManager) {
            this.socketManager.forceReconnect();
        }
    }



    /**
     * Iniciar sistema de timers (principal + inactividad)
     */
    startGameTimer() {
        console.log('⏰ Iniciando timer de juego - El backend validó todo OK');
        
        const now = Date.now();
        this.gameState.timer.startTime = now;
        this.gameState.timer.lastCaptureTime = now; // Inicializar con tiempo de inicio
        this.gameState.timer.isActive = true;

        console.log('🎯 Timer iniciado - startTime:', now, 'lastCaptureTime:', this.gameState.timer.lastCaptureTime);

        // Crear display visual del timer
        this.createTimerDisplay();
        
        // Timer principal - actualizar UI cada segundo
        this.gameState.timer.gameIntervalId = setInterval(() => {
            this.updateGameTimer();
        }, 1000);

        // Timer de inactividad - chequear cada 30 segundos
        this.gameState.timer.inactivityIntervalId = setInterval(() => {
            this.checkInactivity();
        }, 10000);

        // Auto-finish por tiempo límite (3 minutos)
        this.gameState.timer.gameTimeoutId = setTimeout(() => {
            if (this.gameState.timer.isActive) {
                this.autoFinishGame('time-limit');
            }
        }, this.gameState.timer.gameDuration);
    }


    updateCameraButtonState() {
        if (this.elements.startCameraBtn && this.cameraManager) {
            if (this.cameraManager.isActive) {
                this.elements.startCameraBtn.textContent = '✅ Cámara Activa';
                this.elements.startCameraBtn.disabled = true;
            } else {
                this.elements.startCameraBtn.textContent = '📱 Activar Cámara';
                this.elements.startCameraBtn.disabled = false;
            }
        }
    }

    /**
     * Actualizar timer principal y UI
     */
    updateGameTimer() {
    if (!this.gameState.timer.isActive) return;
    
    const elapsed = Date.now() - this.gameState.timer.startTime;
    const remaining = Math.max(0, this.gameState.timer.gameDuration - elapsed);
    
    this.gameState.timer.remaining = remaining;
    
    // Actualizar display visual
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const timerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const timerElement = document.querySelector('.timer-text');
    if (timerElement) {
        timerElement.textContent = timerText;
    }
    
    // Efectos visuales en los últimos 30 segundos
    const timerDisplay = document.getElementById('gameTimer');
    if (timerDisplay) {
        if (remaining < 30000) {
            timerDisplay.classList.add('timer-warning');
        }
    }
    
    // Si llega a 0, se activará el timeout, no hace falta validar aquí
    }

    /**
     * Chequear inactividad (2 minutos sin capturas)
     */
    checkInactivity() {
    if (!this.gameState.timer.isActive) return;
    
    const now = Date.now();
    const timeSinceLastCapture = now - this.gameState.timer.lastCaptureTime;
    // const minutesSinceCapture = Math.round(timeSinceLastCapture / 60000);
    
    // console.log(`🕐 Tiempo desde última captura: ${minutesSinceCapture} minutos`);
    
    if (timeSinceLastCapture >= this.gameState.timer.inactivityTimeout) {
        console.log('😴 Usuario inactivo por 40 segundos, finalizando partida');
        this.autoFinishGame('inactivity');
    }
    }

    /**
     * Actualizar timestamp de última captura
     */
    updateLastCaptureTime() {
    this.gameState.timer.lastCaptureTime = Date.now();
    console.log('🎯 Captura registrada, timer de inactividad reiniciado');
    }

    /**
     * Detener todos los timers
     */
    stopGameTimer() {
    console.log('⏹️ Deteniendo todos los timers');
    
    this.gameState.timer.isActive = false;
    
    if (this.gameState.timer.gameIntervalId) {
        clearInterval(this.gameState.timer.gameIntervalId);
        this.gameState.timer.gameIntervalId = null;
    }
    
    if (this.gameState.timer.inactivityIntervalId) {
        clearInterval(this.gameState.timer.inactivityIntervalId);
        this.gameState.timer.inactivityIntervalId = null;
    }
    
    if (this.gameState.timer.gameTimeoutId) {
        clearTimeout(this.gameState.timer.gameTimeoutId);
        this.gameState.timer.gameTimeoutId = null;
    }
    
    // Remover display del timer
    const timerDisplay = document.getElementById('gameTimer');
    if (timerDisplay) {
        timerDisplay.remove();
    }
    }

    /**
     * Finalización automática por timer o inactividad
     */
    async autoFinishGame(reason = 'time-limit') {

        console.log(`😴 Auto-finalizando por: ${reason}`);

        // 🆕 FORZAR CIERRE DEL MODAL DE REGISTRO PRIMERO
        if (this.registrationManager && this.registrationManager.state.isVisible) {
            console.log('🚪 Cerrando modal de registro antes de mostrar finalización');
            this.registrationManager.elements.overlay.classList.remove('show');
            this.registrationManager.elements.overlay.style.display = 'none';
            this.registrationManager.state.isVisible = false;
        }
    
        // Detener todos los timers
        this.stopGameTimer();
        
        // Mostrar modal apropiado
        this.showFinalizationModal(reason);
        
        // Ejecutar finalización común 
        await this.executeGameFinalization(true, reason);
    }

    /**
     * Crear display visual del cronómetro
     */
    createTimerDisplay() {
        // Verificar que no exista ya
        if (document.getElementById('gameTimer')) return;
        
        const timerDisplay = document.createElement('div');
        timerDisplay.id = 'gameTimer';
        timerDisplay.className = 'game-timer';
        timerDisplay.innerHTML = `
            <div class="timer-circle">
                <div class="timer-text">1:00</div>
                <div class="timer-label">restante</div>
            </div>
        `;
        
        document.body.appendChild(timerDisplay);
    }

    /**
     * Modal que cambia según la razón de finalización
     */
    showFinalizationModal(reason) {
    const modal = document.createElement('div');
    modal.id = 'gameFinishedModal';
    modal.className = 'finish-game-modal show';
    
    let title, message, icon;
    
    switch(reason) {
        case 'time-limit':
            title = '⏰ ¡Tiempo Agotado!';
            message = 'Completaste el minuto de juego';
            icon = '⏰';
            break;
            
        case 'inactivity':
            title = '😴 Partida Finalizada';
            message = 'No se detectaron capturas en los últimos 40 segundos';
            icon = '😴';
            break;
            
        default:
            title = '🏁 Partida Terminada';
            message = 'Tu sesión de juego ha finalizado';
            icon = '🏁';
    }
    
    modal.innerHTML = `
        <div class="finish-modal-content">
            <div class="finish-modal-header">
                <div class="finish-modal-icon">${icon}</div>
                <h2>${title}</h2>
                <p>${message}</p>
            </div>
            <div class="finish-modal-body">
                <div class="game-summary">
                    <div class="summary-item">
                        <span class="summary-label">Tiempo Jugado:</span>
                        <span class="summary-value">${this.getPlayTimeFormatted()}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Puntos Finales:</span>
                        <span class="summary-value points-highlight">${this.gameState.player.points}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Objetos Capturados:</span>
                        <span class="summary-value">${this.gameState.player.captures}</span>
                    </div>
                </div>
                <div class="finish-notice">
                    <div class="notice-icon">💾</div>
                    <p><strong>Guardando datos automáticamente...</strong></p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    console.log(`📱 Modal de finalización mostrado: ${reason}`);
    }

    /**
     * Obtener tiempo de juego formateado
     */
    getPlayTimeFormatted() {
    if (!this.gameState.timer.startTime) return '0:00';
    
    const playTime = Date.now() - this.gameState.timer.startTime;
    const minutes = Math.floor(playTime / 60000);
    const seconds = Math.floor((playTime % 60000) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Obtener tiempo de juego en milisegundos
     */
    getActualPlayTime() {
        if (!this.gameState.timer.startTime) return 0;
        return Date.now() - this.gameState.timer.startTime;
    }

    /**
     * Mostrar mensaje de éxito automático
     */
    showAutoFinishSuccess() {
    const modal = document.getElementById('gameFinishedModal');
    if (!modal) return;

    modal.querySelector('.finish-modal-content').innerHTML = `
        <div class="finish-success">
            <div class="success-icon">🎉</div>
            <h2>¡Partida Completada!</h2>
            <p>Tu sesión ha finalizado automáticamente</p>
            <div class="success-points">
                <span class="points-earned">${this.gameState.player.points}</span>
                <span class="points-label">puntos obtenidos</span>
            </div>
            <p class="success-message">¡Datos guardados correctamente!</p>
        </div>
    `;
    }

    /**
     * Función común de finalización de partida - ACTUALIZADA
     */
    async executeGameFinalization(isAutomatic = true, reason = 'unknown') {
    console.log(`🏁 Ejecutando finalización: automática=${isAutomatic}, razón=${reason}`);
    
    const socketId = this.socketManager?.socket?.id;
    
    try {
        // 1. Enviar desconexión al backend
        if (socketId && this.apiManager) {
            await this.apiManager.sendDisconnection(socketId);
        }

        // 2. Notificar al servidor via socket
        this.socketManager.send('finish-game');

        // 3. Mostrar mensaje de éxito
        this.showAutoFinishSuccess();
        
        // 4. Limpiar sesión después de un momento
        setTimeout(() => {
            this.cleanupGameSession();
        }, 3000);

    } catch (error) {
        console.error('❌ Error finalizando partida:', error);
        this.showTemporaryMessage('Error al finalizar partida.', 'error');
    }
    }




    destroy() {
        this.progressiveFlowManager?.destroy();
        
        this.registrationManager?.destroy();
        this.cameraManager?.destroy();
        this.socketManager?.destroy();
        this.throwMechanics?.destroy();
        this.fovManager?.destroy();
        this.pwaManager?.destroy(); // 
        this.messageManager = null;
        this.roomTracker = null;
        this.playerRegistrationData = null;
        
        document.getElementById('cleanPointsDisplay')?.remove();
        document.getElementById('cleanConnectionStatus')?.remove();
        document.getElementById('cleanObjectCounter')?.remove();
        document.getElementById('throwModeIndicator')?.remove();
        document.getElementById('iosPermissionBtn')?.remove();
        // 📊 LIMPIAR BOTÓN DE ESTADÍSTICAS
        document.getElementById('statsButton')?.remove();
        
        if (window.gameClient === this) {
            window.gameClient = null;
        }        
    }

    getRegistrationData() {
        return this.playerRegistrationData || this.progressiveFlowManager?.getRegistrationData();
    }
    
    isPlayerRegistered() {
        return this.progressiveFlowManager?.isRegistered() || !!this.playerRegistrationData;
    }
    
    getCurrentScreen() {
        return this.progressiveFlowManager?.getCurrentScreen() || 'unknown';
    }
    
    isPWAMode() {
        return this.progressiveFlowManager?.isPWA() || false;
    }
}

// CSS adicional para mensajes temporales
if (!document.getElementById('messageStyles')) {
    const style = document.createElement('style');
    style.id = 'messageStyles';
    style.textContent = `
        @keyframes messageSlide {
            0% {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
            15% {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            85% {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            100% {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
        }
    `;
    document.head.appendChild(style);
}
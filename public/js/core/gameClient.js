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
            totalPlayers: 0
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
            // TEMPORAL - VERIFICAR MODO
            // setTimeout(() => {
            //     const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
            //     const isPWA = window.navigator.standalone === true;
    
            // }, 2000);

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
                
                // Mostrar modo de respaldo
                this.showFallbackOption();
            }

        } catch (error) {            
            btn.textContent = '❌ Error - Reintentar';
            btn.disabled = false;
            
            this.showTemporaryMessage('❌ Error solicitando permisos. Inténtalo de nuevo.', 'error');
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
        const actualName = element?.dataset.spawnName || 'desconocido';

        if (actualName !== target.name) {
            console.warn(`⚠️ Desincronización: esperaba "${target.name}", DOM muestra "${actualName}"`);
            this.showTemporaryMessage(`Capturando ${actualName}`, 'info');
        }
        
        
        this.socketManager.attemptCapture({
            spawnId: target.id,
            playerPosition: this.roomTracker.getPosition(),
            captureMethod: 'throw',
            throwAccuracy: accuracy,
            throwMultiplier: multiplier,
            screenDistance: screenDistance,
            physicalDistance: physicalDistance
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
            this.handleRegistrationFlowTriggered();
        });

        this.progressiveFlowManager.setOnReadyToPlay((registrationData) => {
            this.handleReadyToPlay(registrationData);
        });

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
        // AGREGAR después de this.pwaManager = new PWAManager(this.messageManager);
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
                this.elements.joinGameBtn.textContent = '🎮 Unirse al Juego';
                this.showTemporaryMessage('Error de conexión. Inténtalo de nuevo.', 'error');
                return;
            }
        }

        const registrationData = this.playerRegistrationData || this.progressiveFlowManager.getRegistrationData();

        this.updatePlayerDisplayInfo();

        // Obtener nombre completo del jugador
        const playerName = registrationData ? 
            `${registrationData.name || registrationData.nombre} ${registrationData.lastName || registrationData.apellido}` : 
            'Jugador AR';

        // Intentar unirse al juego
        const success = this.socketManager.joinGame({
            name: playerName,
            position: this.roomTracker.getPosition(),
            registrationData: registrationData
        });

        if (success) {
            this.gameState.isJoined = true;
            this.gameState.player.joinedAt = Date.now();

            // Enviar registro con protección contra duplicados
            if (registrationData) {
                await this.sendRegistrationSafely(registrationData);
            }
            
            this.elements.joinGameBtn.textContent = '✅ En Juego';
            this.elements.joinGameBtn.disabled = true;

            // Crear botón de finalizar
            setTimeout(() => {
                this.createFinishGameButton();
            }, 1000);

            setTimeout(() => {
                this.showTemporaryMessage('¡Continuemos jugando!', 'info');
            }, 2000);

        } else {
            // Error al unirse
            this.elements.joinGameBtn.disabled = false;
            this.elements.joinGameBtn.textContent = '🎮 Unirse al Juego';
            this.showTemporaryMessage('Error al unirse al juego', 'error');
        }
    }

    async sendRegistrationSafely(registrationData) {
        const now = Date.now();
        const minDelay = 2000; // 2 segundos mínimo entre registros
        
        // Verificar si ya hay un registro en progreso
        if (this.registrationInProgress) {
            return;
        }

        // Verificar si fue muy reciente
        if (now - this.lastRegistrationTime < minDelay) {
            return;
        }

        this.registrationInProgress = true;
        this.lastRegistrationTime = now;

        const currentSocketId = this.socketManager.socket?.id;

        try {
            await this.apiManager.sendRegistration({
                Nombre: registrationData.name,
                Apellido: registrationData.lastName,
                Email: registrationData.email,
                IdSocket: currentSocketId || ''
            });

            // Actualizar socket ID local
            registrationData.IdSocket = currentSocketId;

        } catch (error) {
            console.error('❌ Error enviando registro:', error);
        } finally {
            // 🔧 Liberar lock después de un tiempo
            setTimeout(() => {
                this.registrationInProgress = false;
            }, 1000);
        }
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

    createFinishGameButton() {
        // Solo crear si está en juego y no existe ya
        if (!this.gameState.isJoined || document.getElementById('finishGameBtn')) {
            return;
        }

        const finishBtn = document.createElement('button');
        finishBtn.id = 'finishGameBtn';
        finishBtn.className = 'btn-finish-game';
        finishBtn.innerHTML = `
            <span class="finish-icon">🏁</span>
            <span class="finish-text">Finalizar Partida</span>
        `;

        finishBtn.addEventListener('click', () => {
            this.showFinishGameModal();
        });

        document.body.appendChild(finishBtn);

        // Animar entrada
        setTimeout(() => {
            finishBtn.classList.add('show');
        }, 100);
    }

    // 2️⃣ Modal de confirmación:
    showFinishGameModal() {
        // Prevenir múltiples modales
        if (document.getElementById('finishGameModal')) return;

        const modal = document.createElement('div');
        modal.id = 'finishGameModal';
        modal.className = 'finish-game-modal';

        const playerData = this.getRegistrationData();
        const playerName = playerData ? `${playerData.name} ${playerData.lastName}` : 'Jugador';

        modal.innerHTML = `
            <div class="finish-modal-content">
                <div class="finish-modal-header">
                    <div class="finish-modal-icon">🏆</div>
                    <h2>¡Partida Completada!</h2>
                    <p>¿Estás seguro que quieres finalizar?</p>
                </div>

                <div class="finish-modal-body">
                    <div class="game-summary">
                        <div class="summary-item">
                            <span class="summary-label">Jugador:</span>
                            <span class="summary-value">${playerName}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Puntos Obtenidos:</span>
                            <span class="summary-value points-highlight">${this.gameState.player.points}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Objetos Capturados:</span>
                            <span class="summary-value">${this.gameState.player.captures}</span>
                        </div>
                    </div>

                    <div class="finish-notice">
                        <div class="notice-icon">💾</div>
                        <p><strong>Tus puntos se guardarán automáticamente.</strong></p>
                        <p>La próxima vez que juegues comenzarás una nueva partida.</p>
                    </div>
                </div>

                <div class="finish-modal-footer">
                    <button class="btn-cancel" id="cancelFinish">
                        Seguir Jugando
                    </button>
                    <button class="btn-confirm" id="confirmFinish">
                        <span class="confirm-icon">✅</span>
                        Finalizar Partida
                    </button>
                </div>
            </div>
        `;

        // Event listeners
        modal.querySelector('#cancelFinish').addEventListener('click', () => {
            this.hideFinishGameModal();
        });

        modal.querySelector('#confirmFinish').addEventListener('click', () => {
            this.executeFinishGame();
        });

        // Cerrar con click fuera del modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideFinishGameModal();
            }
        });

        document.body.appendChild(modal);

        // Animar entrada
        setTimeout(() => {
            modal.classList.add('show');
        }, 100);
    }

    // 3️⃣ Ocultar modal:
    hideFinishGameModal() {
        const modal = document.getElementById('finishGameModal');
        if (modal) {
            modal.classList.add('hide');
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    }

    // 4️⃣ Ejecutar finalización:
    async executeFinishGame() {
        const confirmBtn = document.getElementById('confirmFinish');
        const originalContent = confirmBtn.innerHTML;
        
        try {
            // Cambiar botón a estado de carga
            confirmBtn.innerHTML = `
                <span class="loading-spinner"></span>
                Finalizando...
            `;
            confirmBtn.disabled = true;

            // 1. Enviar desconexión al backend
            const socketId = this.socketManager?.socket?.id;
            if (socketId && this.apiManager) {
                await this.apiManager.sendDisconnection(socketId);
            }

            // 2. Notificar al servidor (pero no desconectar aún)
            this.socketManager.send('finish-game', {
                socketId: socketId,
                finalStats: {
                    points: this.gameState.player.points,
                    captures: this.gameState.player.captures,
                    bestStreak: this.gameState.player.bestStreak,
                    playTime: Date.now() - this.gameState.player.joinedAt
                }
            });

            // 3. Mostrar mensaje de éxito en el modal
            this.showFinishSuccess();

            // 4. Limpiar después de un momento SIN desconectar socket
            setTimeout(() => {
                this.cleanupGameSession();
            }, 3000);

        } catch (error) {
            console.error('Error finalizando partida:', error);

            // Restaurar botón en caso de error
            confirmBtn.innerHTML = originalContent;
            confirmBtn.disabled = false;

            this.showTemporaryMessage('Error al finalizar partida. Inténtalo de nuevo.', 'error');
        }
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
        // Ocultar modal
        this.hideFinishGameModal();
        
        // Limpiar estado del juego pero mantener datos de registro
        this.gameState.isJoined = false;
        this.gameState.spawns = [];
        this.gameState.visibleSpawns = [];
        this.gameState.player.points = 0;
        this.gameState.player.captures = 0;
        this.gameState.player.streak = 0;
        this.gameState.player.bestStreak = 0;
        
        // Remover botón de finalizar
        document.getElementById('finishGameBtn')?.remove();
        
        // Limpiar AR overlay
        if (this.elements.arOverlay) {
            this.elements.arOverlay.innerHTML = '';
        }

        // Resetear botones
        if (this.elements.joinGameBtn) {
            this.elements.joinGameBtn.disabled = false;
            this.elements.joinGameBtn.textContent = '🎮 Unirse al Juego';
        }

        // 🆕 Habilitar botón de cámara si se había deshabilitado
        if (this.elements.startCameraBtn) {
            this.elements.startCameraBtn.disabled = false;
            this.elements.startCameraBtn.textContent = '📱 Activar Cámara';
        }

        // Actualizar UI
        this.updateCleanUI();

        // 🆕 Reconectar socket limpiamente si se perdió la conexión
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

        const objectName = data.objectName || 'Objeto';

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
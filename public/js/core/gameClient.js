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
        this.playerRegistrationData = null;

        this.initialize();
    }

    /**
     * Inicializar el cliente del juego
    */
    async initialize() {
        try {
            Utils.log('Inicializando DataGo Client - Con sistema FOV...', 'info');

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
    
            //     alert(`Modo: ${isStandalone ? 'STANDALONE ✅' : 'FULLSCREEN ❌'} | iOS PWA: ${isPWA}`);
            // }, 2000);

            Utils.log('DataGo Client con FOV inicializado correctamente', 'success');

        } catch (error) {
            Utils.log('Error inicializando cliente: ' + error.message, 'error');
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

            Utils.log('🍎 Solicitando permisos iOS...', 'info');

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
            Utils.log('❌ Error solicitando permisos: ' + error.message, 'error');
            
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
            Utils.log('🔄 Reinicializando RoomTracker con permisos...', 'info');
            
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
        
        Utils.log('Sistema de lanzamiento configurado', 'success');
    }

    /**
     * Manejar hit exitoso de lanzamiento
     */
    handleThrowHit(hitData) {
        const { target, accuracy, multiplier, screenDistance, physicalDistance } = hitData;
        
        Utils.log(`🎯 Lanzamiento exitoso: ${accuracy} (${multiplier}x)`, 'success');
        
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
        
        Utils.log(`❌ Lanzamiento fallido: ${reason}`, 'warning');
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
        this.hideVerboseElements();
        this.createCleanIndicators();
    }

    hideVerboseElements() {
        document.getElementById('positionDisplay')?.remove();
        document.getElementById('proximityStats')?.remove();
        
        if (this.elements.messageBox) {
            this.elements.messageBox.style.display = 'none';
        }
    }

    createCleanIndicators() {
        this.createCleanPointsDisplay();
        this.createCleanConnectionStatus();
    }

    createCleanPointsDisplay() {
        let pointsDisplay = document.getElementById('cleanPointsDisplay');
        if (!pointsDisplay) {
            pointsDisplay = document.createElement('div');
            pointsDisplay.id = 'cleanPointsDisplay';
            pointsDisplay.className = 'clean-ui-element';
            document.body.appendChild(pointsDisplay);
        }
        
        pointsDisplay.innerHTML = `
            <div class="points-value">0</div>
            <div class="points-label">puntos</div>
        `;
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
        
        // 🆕 CREAR REGISTRATION MANAGER PERO NO INICIALIZAR AÚN
        this.registrationManager = new RegistrationManager(this.messageManager);
        
        // Configurar callback del registration manager
        this.registrationManager.setOnRegistrationSuccess((playerData) => {
            this.handleRegistrationSuccess(playerData);
        });

        // Configurar callbacks del PWA Manager
        this.pwaManager.setCallbacks({
            onSuccess: () => {
                Utils.log('🎉 PWA instalada exitosamente', 'success');
            },
            onError: (error) => {
                Utils.log('❌ Error instalando PWA: ' + error.message, 'error');
            },
            onDeclined: () => {
                Utils.log('❌ Usuario rechazó instalación PWA', 'warning');
            }
        });

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
        this.setupEventListeners();
        this.setupInteractions();
        this.setupCleanUI();
        this.setupThrowMechanics();
    }

    handleRegistrationFlowTriggered() {
        Utils.log('📝 Flow manager solicita mostrar registro', 'info');
        
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

        //  Listener para actualizar FOV cuando cambia orientación
        window.addEventListener('deviceorientation', () => {
            this.updateFOVDisplay();
        });
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
        Utils.log(`Lanzamiento hacia (${tapX}, ${tapY})`, 'info');
        
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
            Utils.log(`Lanzamiento iniciado: ${result.hitType}`, 'info');
            setTimeout(() => {
                this.captureState.isCapturing = false;
            }, 1000);
        }
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
        const distance = 0.8 + Math.random() * 3.0; // Entre 0.8-3.8 metros
        
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
        
        Utils.log(`👻 Spawn ${spawnId} oculto`, 'info');
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
        
        Utils.log(`🗑️ Spawn ${spawnId} removido`, 'info');
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
        Utils.log('✅ Registro completado para: ' + playerData.name + ' ' + playerData.lastName, 'success');
        
        // Guardar datos del jugador
        this.playerRegistrationData = {
            ...playerData,
            socketId: null, // Se asignará cuando se conecte
            registeredAt: Date.now()
        };

        // 🆕 CONSOLE.LOG REQUERIDO - Datos para el backend
        this.progressiveFlowManager.handleRegistrationCompleted(playerData);
    }

    async handleReadyToPlay(registrationData) {
        Utils.log('🎮 Listo para jugar, inicializando managers del juego...', 'success');
        
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
                socketId: null,
                registeredAt: registrationData.timestamp ? new Date(registrationData.timestamp).getTime() : Date.now()
            };
        }

        // Permisos iOS si es necesario
        this.checkiOSPermissions();

        Utils.log('🎮 Juego completamente inicializado y listo', 'success');
    }

    proceedWithGameJoin() {
        // Deshabilitar botón temporalmente
        this.elements.joinGameBtn.disabled = true;
        this.elements.joinGameBtn.textContent = '⏳ Conectando...';

        const registrationData = this.playerRegistrationData || this.progressiveFlowManager.getRegistrationData();
        
        // Obtener nombre completo del jugador
        const playerName = registrationData ? 
        `${registrationData.name || registrationData.nombre} ${registrationData.lastName || registrationData.apellido}` : 
        'Jugador AR';
        
        // Intentar unirse al juego
        const success = this.socketManager.joinGame({
            name: playerName,
            position: this.roomTracker.getPosition(),
            // 🆕 Incluir datos de registro
            registrationData: registrationData
        });

        if (success) {
            this.gameState.isJoined = true;
            this.gameState.player.joinedAt = Date.now();

            // 🆕 Asignar socket ID a los datos de registro
            if (registrationData) {
                registrationData.socketId = this.socketManager.socket?.id;
            }

            this.elements.joinGameBtn.textContent = '✅ En Juego';
            this.elements.joinGameBtn.disabled = true;

            setTimeout(() => {
                this.showTemporaryMessage('¡Gira para encontrar objetos!', 'info');
            }, 1000);

            Utils.log('🎮 Jugador unido con datos de registro', 'success');
        } else {
            // Error al unirse
            this.elements.joinGameBtn.disabled = false;
            this.elements.joinGameBtn.textContent = '🎮 Unirse al Juego';
            this.showTemporaryMessage('Error al unirse al juego', 'error');
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
        
        Utils.log(`Captura clásica con método: ${method}`, 'info');
        
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
        Utils.log('Estado del juego recibido', 'info');
        
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

            //CONSOLE.LOG REQUERIDO - Datos para endpoint de captura
            this.logCaptureEvent(data);
            
            this.updateCleanUI();
            this.showCaptureSuccess(data);
            
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }
        } else {
            Utils.log(`${data.playerName} capturó un objeto`, 'info');
        }
    }

    logCaptureEvent(captureData) {
        const registrationData = this.playerRegistrationData || this.progressiveFlowManager.getRegistrationData();

        if (!registrationData) {
            Utils.log('⚠️ No hay datos de registro para la captura', 'warning');
            return;
        }

        // Encontrar información del objeto capturado
        const spawnInfo = this.getSpawnInfo(captureData.spawnId);

        // 🆕 CONSOLE.LOG REQUERIDO - Datos para endpoint de captura
        console.log('🎯 DATOS PARA ENDPOINT CAPTURA:', {
            jugador: {
                nombre: registrationData.name || registrationData.nombre,
                apellido: registrationData.lastName || registrationData.apellido,
                email: registrationData.email,
                socketId: registrationData.socketId
            },
            objetoCapturado: {
                id: captureData.spawnId,
                tipo: captureData.spawnType || spawnInfo.type,
                emoji: spawnInfo.emoji,
                rareza: spawnInfo.rarity || 'common'
            },
            puntuacionObtenida: {
                puntosFinales: captureData.pointsEarned,
                racha: captureData.streak || 0
            }
        });
    }

    getSpawnInfo(spawnId) {
        // Buscar en spawns actuales
        let spawn = this.gameState.spawns.find(s => s.id === spawnId);
        
        // Si no está en spawns actuales, buscar en visibles
        if (!spawn) {
            spawn = this.gameState.visibleSpawns.find(s => s.id === spawnId);
        }

        // Retornar info por defecto si no se encuentra
        return spawn || {
            emoji: '❓',
            type: 'unknown',
            points: 10,
            rarity: 'common'
        };
    }

    showCaptureSuccess(data) {
        const feedback = document.createElement('div');
        feedback.className = 'capture-feedback';
        
        let bonusText = '';
        if (data.multiplier > 1) {
            bonusText = `<div class="capture-bonus">${data.multiplier.toFixed(1)}x multiplier</div>`;
        }
        
        const emoji = '🎯';
        
        feedback.innerHTML = `
            <div class="capture-emoji">${emoji}</div>
            <div class="capture-points">+${data.pointsEarned}</div>
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
        arElement.textContent = spawn.emoji;
        arElement.title = `${spawn.type} - ${spawn.points} puntos`;
        
        //  Usar posición calculada por FOV
        arElement.style.left = screenPosition.x + 'px';
        arElement.style.top = screenPosition.y + 'px';
        
        // Color basado en rareza
        if (spawn.color) {
            arElement.style.filter = `drop-shadow(0 0 15px ${spawn.color})`;
        }
        
        this.elements.arOverlay.appendChild(arElement);
        
        Utils.log(`👁️ Spawn ${spawn.id} visible en FOV`, 'info');
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
            
            Utils.log(`👁️‍🗨️ Spawn ${spawnId} oculto del FOV`, 'info');
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
        this.updateCleanObjectCounter();
    }

    updateCleanPoints() {
        const pointsDisplay = document.querySelector('#cleanPointsDisplay .points-value');
        if (pointsDisplay) {
            pointsDisplay.textContent = this.gameState.player.points;
        }
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
            Utils.log(`🗑️ Spawn ${spawnId} removido del DOM`, 'debug');
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
        Utils.log('Destruyendo GameClient con FOV...', 'info');

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
        
        Utils.log('GameClient con FOV destruido', 'success');
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
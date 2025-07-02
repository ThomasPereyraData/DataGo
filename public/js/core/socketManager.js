// public/js/core/SocketManager.js - CON EVENTOS DE PROXIMIDAD

import { Utils } from "../utils/utils.js";

export class SocketManager {
    constructor(messageManager) {
        this.messageManager = messageManager;
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        // Event callbacks
        this.eventHandlers = new Map();
        
        this.initialize();
    }

    /**
     * Inicializar conexión Socket.IO
     */
    initialize() {
        try {
            Utils.log('Inicializando conexión Socket.IO...', 'info');
            
            this.socket = io({
                autoConnect: true,
                timeout: 10000,
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: this.reconnectDelay
            });
            
            this.setupDefaultEventHandlers();
            
        } catch (error) {
            Utils.log('Error inicializando Socket.IO: ' + error.message, 'error');
            this.messageManager?.error('Error de conexión al servidor');
        }
    }

    /**
     * Configurar event handlers por defecto
     */
    setupDefaultEventHandlers() {
        // Conexión exitosa
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            Utils.log('Conectado al servidor', 'success');
            this.messageManager?.showConnectionStatus(true, 'Conectado');
            
            this.emit('socket-connected', { socketId: this.socket.id });
        });

        // Desconexión
        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;
            
            Utils.log(`Desconectado: ${reason}`, 'warning');
            this.messageManager?.showConnectionStatus(false, 'Desconectado');
            
            this.emit('socket-disconnected', { reason });
        });

        // Error de conexión
        this.socket.on('connect_error', (error) => {
            this.reconnectAttempts++;
            
            Utils.log(`Error de conexión (intento ${this.reconnectAttempts}): ${error.message}`, 'error');
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this.messageManager?.error('No se pudo conectar al servidor. Verifica tu conexión.');
            } else {
                this.messageManager?.warning(`Reintentando conexión... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            }
            
            this.emit('socket-error', { error, attempts: this.reconnectAttempts });
        });

        // Reconexión exitosa
        this.socket.on('reconnect', (attemptNumber) => {
            Utils.log(`Reconectado después de ${attemptNumber} intentos`, 'success');
            this.messageManager?.success('¡Reconectado al servidor!');
            
            this.emit('socket-reconnected', { attempts: attemptNumber });
        });

        // Eventos del juego
        this.setupGameEventHandlers();
        
        // 🆕 Eventos de proximidad
        this.setupProximityEventHandlers();
    }

    /**
     * Configurar event handlers específicos del juego
     */
    setupGameEventHandlers() {
        // Estado del juego
        this.socket.on('game-state', (state) => {
            Utils.log('Estado del juego recibido', 'info');
            this.emit('game-state-received', state);
        });

        // Nuevo spawn (LEGACY - se mantiene para compatibilidad)
        this.socket.on('new-spawn', (spawn) => {
            Utils.log(`Nuevo spawn: ${spawn.emoji} (${spawn.type})`, 'info');
            this.emit('spawn-created', spawn);
        });

        // Spawn capturado
        this.socket.on('spawn-captured', (data) => {
            Utils.log(`Spawn capturado por ${data.playerName}`, 'success');
            this.emit('spawn-captured', data);
        });

        // Spawn expirado (LEGACY)
        this.socket.on('spawn-expired', (spawnData) => {
            Utils.log(`Spawn ${spawnData.id} expirado`, 'info');
            this.emit('spawn-expired', spawnData);
        });

        // Captura fallida
        this.socket.on('capture-failed', (data) => {
            Utils.log(`Captura fallida: ${data.reason}`, 'warning');
            this.emit('capture-failed', data);
        });

        // Jugador se movió
        this.socket.on('player-moved', (data) => {
            this.emit('player-moved', data);
        });

        // Jugador se unió
        this.socket.on('player-joined', (player) => {
            Utils.log(`${player.name} se unió al juego`, 'info');
            this.emit('player-joined', player);
        });

        // Jugador se fue
        this.socket.on('player-left', (data) => {
            Utils.log(`${data.playerName} dejó el juego`, 'info');
            this.emit('player-left', data);
        });

        // Bonus de streak
        this.socket.on('streak-bonus', (data) => {
            Utils.log(`Streak bonus: ${data.streak} streak = ${data.bonusPoints} puntos`, 'success');
            this.emit('streak-bonus', data);
        });

        // Posición actualizada
        this.socket.on('position-updated', (position) => {
            this.emit('position-confirmed', position);
        });
    }

    /**
     * 🆕 Configurar event handlers de proximidad
     */
    setupProximityEventHandlers() {
        // Spawn descubierto - aparece cuando te acercas
        this.socket.on('spawn-discovered', (data) => {
            Utils.log(`🔍 Objeto descubierto: ${data.spawn.emoji} a ${data.distance.toFixed(1)}m`, 'success');            
            this.emit('spawn-discovered', {
                spawn: data.spawn,
                distance: data.distance,
                discoveryType: 'proximity'
            });
        });

        // Spawn oculto - desaparece cuando te alejas
        this.socket.on('spawn-hidden', (data) => {
            Utils.log(`👻 Objeto oculto: ID ${data.spawnId} a ${data.distance.toFixed(1)}m`, 'info');
            
            this.emit('spawn-hidden', {
                spawnId: data.spawnId,
                distance: data.distance,
                reason: 'out-of-range'
            });
        });

        // Spawn removido (capturado o expirado)
        this.socket.on('spawn-removed', (data) => {
            Utils.log(`🗑️ Spawn removido: ID ${data.spawnId}`, 'info');
            
            this.emit('spawn-removed', {
                spawnId: data.spawnId,
                reason: 'removed'
            });
        });
    }

    /**
     * Registrar handler para un evento
     */
    on(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        
        this.eventHandlers.get(eventName).push(handler);
        
        Utils.log(`Handler registrado para evento: ${eventName}`, 'debug');
    }

    /**
     * Eliminar handler de un evento
     */
    off(eventName, handler) {
        if (this.eventHandlers.has(eventName)) {
            const handlers = this.eventHandlers.get(eventName);
            const index = handlers.indexOf(handler);
            
            if (index > -1) {
                handlers.splice(index, 1);
                Utils.log(`Handler eliminado para evento: ${eventName}`, 'debug');
            }
        }
    }

    /**
     * Emitir evento interno
     */
    emit(eventName, data = null) {
        if (this.eventHandlers.has(eventName)) {
            const handlers = this.eventHandlers.get(eventName);
            
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    Utils.log(`Error en handler de ${eventName}: ${error.message}`, 'error');
                }
            });
        }
    }

    /**
     * Enviar evento al servidor
     */
    send(eventName, data = null) {
        if (!this.isConnected) {
            Utils.log(`No se puede enviar ${eventName}: no conectado`, 'warning');
            this.messageManager?.warning('Sin conexión al servidor');
            return false;
        }

        try {
            this.socket.emit(eventName, data);
            Utils.log(`Enviado ${eventName}`, 'debug');
            return true;
        } catch (error) {
            Utils.log(`Error enviando ${eventName}: ${error.message}`, 'error');
            return false;
        }
    }

    // Métodos específicos del juego

    /**
     * Unirse al juego
     */
    joinGame(playerData) {
        return this.send('join-game', {
            name: playerData.name || 'Jugador AR',
            position: playerData.position || { x: 2.5, y: 2.5 },
            timestamp: Date.now()
        });
    }

    /**
     * Enviar movimiento del jugador
     */
    sendPlayerMove(position) {
        return this.send('player-move', {
            x: Utils.formatNumber(position.x, 2),
            y: Utils.formatNumber(position.y, 2),
            timestamp: Date.now()
        });
    }

    /**
     * Intentar captura
     */
    attemptCapture(captureData) {
        const data = {
            playerPosition: captureData.playerPosition,
            captureMethod: captureData.captureMethod || 'button',
            timestamp: Date.now()
        };

        if (captureData.spawnId) {
            data.spawnId = captureData.spawnId;
        }

        return this.send('attempt-capture', data);
    }

    /**
     * Enviar heartbeat (mantener conexión viva)
     */
    sendHeartbeat() {
        return this.send('heartbeat', { timestamp: Date.now() });
    }

    /**
     * Solicitar estado actual del juego
     */
    requestGameState() {
        return this.send('request-game-state');
    }

    // Métodos de utilidad

    /**
     * Forzar reconexión
     */
    forceReconnect() {
        if (this.socket) {
            Utils.log('Forzando reconexión...', 'info');
            this.socket.disconnect();
            this.socket.connect();
        }
    }

    /**
     * Obtener estado de conexión
     */
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            socketId: this.socket?.id || null,
            reconnectAttempts: this.reconnectAttempts,
            transport: this.socket?.io?.engine?.transport?.name || null
        };
    }

    /**
     * Limpiar y desconectar
     */
    destroy() {
        Utils.log('Destruyendo SocketManager...', 'info');
        
        // Limpiar event handlers
        this.eventHandlers.clear();
        
        // Desconectar socket
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.isConnected = false;
        this.messageManager = null;
        
        Utils.log('SocketManager destruido', 'info');
    }
}
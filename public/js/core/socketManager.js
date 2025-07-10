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
            this.socket = io({
                autoConnect: true,
                timeout: 10000,
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: this.reconnectDelay
            });
            
            this.setupDefaultEventHandlers();
            
        } catch (error) {
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
            
            this.messageManager?.showConnectionStatus(true, 'Conectado');
            this.emit('socket-connected', { IdSocket: this.socket.id });
        });

        // Desconexión
        this.socket.on('disconnect', async (reason) => {

            this.isConnected = false;
            await this.handleDisconnection();             
            this.messageManager?.showConnectionStatus(false, 'Desconectado');     
            this.emit('socket-disconnected', { reason });
        });

        // Error de conexión
        this.socket.on('connect_error', (error) => {
            this.reconnectAttempts++;
            
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this.messageManager?.error('No se pudo conectar al servidor. Verifica tu conexión.');
            } else {
                this.messageManager?.warning(`Reintentando conexión... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            }
            
            this.emit('socket-error', { error, attempts: this.reconnectAttempts });
        });

        // Reconexión exitosa
        this.socket.on('reconnect', (attemptNumber) => {
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
            this.emit('game-state-received', state);
        });

        // Nuevo spawn (LEGACY - se mantiene para compatibilidad)
        this.socket.on('new-spawn', (spawn) => {
            this.emit('spawn-created', spawn);
        });

        // Spawn capturado
        this.socket.on('spawn-captured', (data) => {
            this.emit('spawn-captured', data);
        });

        // Spawn expirado (LEGACY)
        this.socket.on('spawn-expired', (spawnData) => {
            this.emit('spawn-expired', spawnData);
        });

        // Captura fallida
        this.socket.on('capture-failed', (data) => {
            this.emit('capture-failed', data);
        });

        // Jugador se movió
        this.socket.on('player-moved', (data) => {
            this.emit('player-moved', data);
        });

        // Jugador se unió
        this.socket.on('player-joined', (player) => {
            this.emit('player-joined', player);
        });

        // Jugador se fue
        this.socket.on('player-left', (data) => {
            this.emit('player-left', data);
        });

        // Bonus de streak
        this.socket.on('streak-bonus', (data) => {
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
            this.emit('spawn-discovered', {
                spawn: data.spawn,
                distance: data.distance,
                discoveryType: 'proximity'
            });
        });

        // Spawn oculto - desaparece cuando te alejas
        this.socket.on('spawn-hidden', (data) => {            
            this.emit('spawn-hidden', {
                spawnId: data.spawnId,
                distance: data.distance,
                reason: 'out-of-range'
            });
        });

        // Spawn removido (capturado o expirado)
        this.socket.on('spawn-removed', (data) => {
            
            this.emit('spawn-removed', {
                spawnId: data.spawnId,
                reason: 'removed'
            });
        });
    }

    async handleDisconnection() {

        if (!this.socket?.id) {
            return;
        }        
        try {            
            const gameClient = window.gameClient || window.dataGoApp?.gameClient;
            
            if (!gameClient) {
                return;
            }

            if (!gameClient.apiManager) {
                return;
            }

            await gameClient.apiManager.sendDisconnection(this.socket.id);
        
        } catch (error) {
            console.error('❌ Error enviando desconexión:', error);
        }
    }

    /**
     * Registrar handler para un evento
     */
    on(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        
        this.eventHandlers.get(eventName).push(handler);
        
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
                }
            });
        }
    }

    /**
     * Enviar evento al servidor
     */
    send(eventName, data = null) {
        if (!this.isConnected) {
            this.messageManager?.warning('Sin conexión al servidor');
            return false;
        }

        try {
            this.socket.emit(eventName, data);
            return true;
        } catch (error) {
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

    // Métodos de utilidad

    /**
     * Forzar reconexión
     */
    forceReconnect() {
            if (this.socket) {
            this.socket.disconnect();
            this.socket.connect();
        }
    }

    /**
     * Limpiar y desconectar
     */
    destroy() {        
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
    }
}
// public/js/tracking/RoomTracker.js - SIN SOLICITUD AUTOMÁTICA DE PERMISOS

import { Utils } from "../utils/utils.js";

export class RoomTracker {
    constructor(roomWidth, roomHeight, messageManager) {
        this.roomSize = { width: roomWidth, height: roomHeight };
        this.position = { x: roomWidth/2, y: roomHeight/2 };
        this.heading = 0;
        this.messageManager = messageManager;
        
        // Configuración de detección de pasos - AJUSTADA PARA iOS
        this.stepThreshold = 2.0;      // Aumentado de 1.2 a 2.0 (menos sensible)
        this.stepLength = 0.4;         // Reducido de 0.65 a 0.4 (pasos más cortos)
        this.lastStepTime = 0;
        this.lastAcceleration = { x: 0, y: 0, z: 0 };
        
        // Estado de inicialización
        this.isInitialized = false;
        this.headingCalibrated = false;
        this.initialHeading = null;
        
        // Corrección de drift
        this.driftCorrection = { x: 0, y: 0 };
        this.boundaryHitCount = 0;
        
        // Historial para suavizado
        this.positionHistory = [];
        this.maxHistorySize = 5;
        
        // Callbacks
        this.onPositionUpdateCallback = null;
        
        this.initialize();
    }

    /**
     * Configurar callback para actualizaciones de posición
     */
    onPositionUpdate(callback) {
        this.onPositionUpdateCallback = callback;
    }

    /**
     * 🆕 Inicializar SIN solicitud automática de permisos
     */
    async initialize() {        
        try {
            // 🆕 No solicitar permisos automáticamente
            // Los permisos se manejan desde GameClient con botón manual
            
            this.setupEventListeners();
            this.scheduleAutoInitialization();
                        
        } catch (error) {
            this.fallbackToStaticMode();
        }
    }

    /**
     * 🆕 Modo de respaldo sin sensores
     */
    fallbackToStaticMode() {        
        // Simular inicialización exitosa pero sin sensores
        this.isInitialized = true;
        this.headingCalibrated = true;
        this.initialHeading = 0;
        
        // Disparar callback inicial
        this.triggerPositionUpdate();
    }

    /**
     * Configurar event listeners - SOLO si hay permisos
     */
    setupEventListeners() {
        // 🆕 Solo configurar listeners si las APIs están disponibles
        // No verificar permisos, eso se hace desde GameClient
        
        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', 
                Utils.throttle((e) => this.handleDeviceMotion(e), 100)
            );
        }
        
        if (window.DeviceOrientationEvent) {
            const orientationHandler = Utils.throttle((e) => this.handleDeviceOrientation(e), 50);
            
            // Probar ambos tipos de eventos
            window.addEventListener('deviceorientationabsolute', orientationHandler);
            window.addEventListener('deviceorientation', orientationHandler);            
        }
    }

    /**
     * Programar auto-inicialización
     */
    scheduleAutoInitialization() {
        setTimeout(() => {
            if (!this.isInitialized) {
                this.autoInitialize();
            }
        }, 3000);
    }

    /**
     * Auto-inicialización del sistema
     */
    autoInitialize() {
        this.isInitialized = true;
        this.headingCalibrated = true;
        this.initialHeading = this.heading;
                
        // 🆕 No mostrar mensaje aquí, se maneja desde GameClient
        this.triggerPositionUpdate();
    }

    /**
     * Manejar eventos de movimiento del dispositivo - CON FILTRO MEJORADO
     */
    handleDeviceMotion(event) {
        const acc = event.accelerationIncludingGravity;
        if (!acc) {
            return;
        }
        
        const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
        
        // 🆕 Filtrar movimientos muy extremos (sacudidas, etc.)
        if (magnitude > 20) {
            return;
        }
        
        // Retrasar inicialización si hay mucho movimiento
        if (!this.isInitialized && magnitude > 15) {  // Aumentado de 12 a 15
            return;
        }
        
        // Detectar paso
        if (this.shouldDetectStep(magnitude)) {
            this.onStepDetected();
            this.lastStepTime = Date.now();
        }
        
        this.lastAcceleration = { x: acc.x, y: acc.y, z: acc.z };
    }

    /**
     * Determinar si se debe detectar un paso - MENOS SENSIBLE
     */
    shouldDetectStep(magnitude) {
        const now = Date.now();
        return this.isInitialized && 
               magnitude > this.stepThreshold && 
               now - this.lastStepTime > 500;  // Aumentado de 250ms a 500ms
    }

    /**
     * Manejar eventos de orientación del dispositivo
     */
    handleDeviceOrientation(event) {
        let heading = event.alpha;
        
        if (event.webkitCompassHeading) {
            heading = event.webkitCompassHeading;
        }
        
        if (heading !== null && heading !== undefined) {
            this.heading = Utils.smoothHeading(this.heading, heading);
        } else {
        }
    }

    /**
     * Procesar detección de paso
     */
    onStepDetected() {
        const newPosition = this.calculateNewPosition();
        const wasOutside = this.checkBoundaries(newPosition);
        
        if (wasOutside) {
            newPosition.x = Utils.clampPosition(newPosition, this.roomSize).x;
            newPosition.y = Utils.clampPosition(newPosition, this.roomSize).y;
            this.applyDriftCorrection();
        }
        
        this.updatePosition(newPosition);
    }

    /**
     * Calcular nueva posición basada en heading y longitud de paso
     */
    calculateNewPosition() {
        const radians = (this.heading * Math.PI) / 180;
        const deltaX = this.stepLength * Math.sin(radians);
        const deltaY = this.stepLength * Math.cos(radians);
        
        return {
            x: this.position.x + deltaX,
            y: this.position.y + deltaY
        };
    }

    /**
     * Verificar si la nueva posición está fuera de los límites - MENOS AGRESIVO
     */
    checkBoundaries(position) {
        const margin = 0.5;  // 🆕 Margen de 0.5m antes de considerar "fuera"
        const isOutside = position.x <= margin || 
                         position.x >= (this.roomSize.width - margin) || 
                         position.y <= margin || 
                         position.y >= (this.roomSize.height - margin);
        
        if (isOutside) {
            this.boundaryHitCount++;                        
        }
        
        return isOutside;
    }

    /**
     * Obtener nombre del límite tocado
     */
    getBoundaryName(position) {
        if (position.x <= 0) return 'pared izquierda';
        if (position.x >= this.roomSize.width) return 'pared derecha';
        if (position.y <= 0) return 'pared norte';
        if (position.y >= this.roomSize.height) return 'pared sur';
        return 'límite';
    }

    /**
     * Aplicar corrección de drift
     */
    applyDriftCorrection() {
        // Aplicar corrección gradual
        this.position.x += this.driftCorrection.x * 0.3;
        this.position.y += this.driftCorrection.y * 0.3;
        
        // Reducir drift correction
        this.driftCorrection.x *= 0.9;
        this.driftCorrection.y *= 0.9;
    }

    /**
     * Actualizar posición y historial
     */
    updatePosition(newPosition) {
        this.position = newPosition;
        this.addToHistory(this.position);
        
        this.getSmoothedPosition();
                
        this.triggerPositionUpdate();
    }

    /**
     * Agregar posición al historial
     */
    addToHistory(position) {
        this.positionHistory.push({ ...position });
        
        if (this.positionHistory.length > this.maxHistorySize) {
            this.positionHistory.shift();
        }
    }

    /**
     * Obtener posición suavizada
     */
    getSmoothedPosition() {
        if (this.positionHistory.length === 0) {
            return { ...this.position };
        }
        
        const sum = this.positionHistory.reduce((acc, pos) => ({
            x: acc.x + pos.x,
            y: acc.y + pos.y
        }), { x: 0, y: 0 });
        
        return {
            x: sum.x / this.positionHistory.length,
            y: sum.y / this.positionHistory.length
        };
    }

    /**
     * Disparar callback de actualización de posición
     */
    triggerPositionUpdate() {
        if (this.onPositionUpdateCallback) {
            this.onPositionUpdateCallback(this.getSmoothedPosition());
        }
    }

    // Métodos públicos de control

    /**
     * Recalibrar tracker
     */
    recalibrate() {        
        this.position = { x: this.roomSize.width/2, y: this.roomSize.height/2 };
        this.driftCorrection = { x: 0, y: 0 };
        this.positionHistory = [];
        this.boundaryHitCount = 0;
        
        this.messageManager?.success('Tracker recalibrado al centro');
        this.triggerPositionUpdate();
    }

    /**
     * Reset completo
     */
    reset() {
        this.position = { x: this.roomSize.width/2, y: this.roomSize.height/2 };
        this.heading = 0;
        this.isInitialized = false;
        this.driftCorrection = { x: 0, y: 0 };
        this.positionHistory = [];
        this.boundaryHitCount = 0;
                
        this.scheduleAutoInitialization();
    }

    // Getters públicos

    getPosition() {
        return this.getSmoothedPosition();
    }

    getHeading() {
        return this.heading;
    }

    isReady() {
        return this.isInitialized;
    }
}
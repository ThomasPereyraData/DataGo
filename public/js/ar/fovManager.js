// public/js/ar/FOVManager.js - SISTEMA DE CAMPO DE VISIÓN

import { Utils } from "../utils/utils.js";

export class FOVManager {
    constructor() {
        // Configuración del campo de visión
        this.config = {
            horizontalFOV: 150,       // 🆕 Aumentado de 75° a 120° (más amplio)
            verticalFOV: 130,          // 🆕 También aumentado para compensar
            maxRenderDistance: 4.5,   // 🆕 Ligeramente aumentado para sala 5x5m
            minRenderDistance: 0.2,   // 🆕 Reducido para objetos más cercanos
            screenMargin: 30          // 🆕 Reducido para aprovechar más pantalla
        };
        
        // Estado del FOV
        this.state = {
            playerPosition: { x: 2.5, y: 2.5 },
            playerHeading: 0,
            screenCenter: { x: 0, y: 0 },
            isReady: false
        };
        
        // Información de pantalla
        this.screen = {
            width: window.innerWidth,
            height: window.innerHeight,
            centerX: window.innerWidth / 2,
            centerY: window.innerHeight / 2
        };
        
        // 🆕 NUEVA PROPIEDAD: Tracking de posiciones ocupadas
        this.occupiedPositions = new Map(); // spawnId -> {x, y, radius}
        
        // 🆕 NUEVA CONFIGURACIÓN: Espaciado entre objetos
        this.spacingConfig = {
            minSeparation: 80,      // Píxeles mínimos entre objetos
            maxAttempts: 10,        // Intentos máximos para encontrar posición libre
            separationRadius: 60,   // Radio de separación en píxeles
            edgeBuffer: 40         // Buffer desde los bordes de pantalla
        };
        
        // Actualizar dimensiones si cambia la pantalla
        this.updateScreenDimensions();
        window.addEventListener('resize', () => this.updateScreenDimensions());        
    }

    /**
     * Actualizar dimensiones de pantalla
     */
    updateScreenDimensions() {
        this.screen.width = window.innerWidth;
        this.screen.height = window.innerHeight;
        this.screen.centerX = this.screen.width / 2;
        this.screen.centerY = this.screen.height / 2;
    }

    /**
     * Actualizar posición y orientación del jugador
     */
    updatePlayer(position, heading) {
        this.state.playerPosition = { ...position };
        this.state.playerHeading = heading;
        this.state.isReady = true;
    }

    /**
     * Verificar si un objeto está dentro del campo de visión
     */
    isObjectInFOV(objectWorldPosition) {
        if (!this.state.isReady) return false;

        // 1. Calcular distancia física
        const distance = Utils.calculateDistance(this.state.playerPosition, objectWorldPosition);
        
        // 2. Verificar rango de distancia
        if (distance < this.config.minRenderDistance || distance > this.config.maxRenderDistance) {
            return false;
        }

        // 3. Calcular ángulo desde jugador hacia objeto
        const angleToObject = this.calculateAngleToObject(objectWorldPosition);
        
        // 4. Verificar si está dentro del FOV horizontal
        const angleDifference = this.getAngleDifference(this.state.playerHeading, angleToObject);
        
        return Math.abs(angleDifference) <= (this.config.horizontalFOV / 2);
    }

    /**
     * Calcular ángulo desde jugador hacia objeto (en grados)
     */
    calculateAngleToObject(objectPosition) {
        const dx = objectPosition.x - this.state.playerPosition.x;
        const dy = objectPosition.y - this.state.playerPosition.y;
        
        // Atan2 devuelve en radianes (-π a π), convertir a grados (0-360)
        let angle = Math.atan2(dx, dy) * (180 / Math.PI);
        
        // Normalizar a 0-360°
        if (angle < 0) angle += 360;
        
        return angle;
    }

    /**
     * Calcular diferencia angular considerando wraparound 360°
     */
    getAngleDifference(angle1, angle2) {
        let diff = angle2 - angle1;
        
        // Manejar wraparound
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        
        return diff;
    }

    /**
     * 🆕 NUEVA FUNCIÓN: Verificar si una posición está ocupada
     */
    isPositionOccupied(x, y, excludeId = null) {
        for (const [spawnId, pos] of this.occupiedPositions) {
            if (excludeId && spawnId === excludeId) continue;
            
            const distance = Math.sqrt(
                Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2)
            );
            
            if (distance < (pos.radius + this.spacingConfig.separationRadius)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 🆕 NUEVA FUNCIÓN: Encontrar posición libre cerca de una posición ideal
     */
    findFreePosition(idealX, idealY, spawnId) {
        const attempts = this.spacingConfig.maxAttempts;
        const minSep = this.spacingConfig.minSeparation;
        
        // Intentar la posición ideal primero
        if (!this.isPositionOccupied(idealX, idealY, spawnId) && 
            this.isPositionValid(idealX, idealY)) {
            return { x: idealX, y: idealY };
        }
        
        // Buscar en espiral alrededor de la posición ideal
        for (let attempt = 1; attempt <= attempts; attempt++) {
            const radius = (attempt / attempts) * minSep * 2;
            const angleStep = (2 * Math.PI) / (attempt * 4); // Más puntos en círculos más grandes
            
            for (let angle = 0; angle < 2 * Math.PI; angle += angleStep) {
                const newX = idealX + Math.cos(angle) * radius;
                const newY = idealY + Math.sin(angle) * radius;
                
                if (this.isPositionValid(newX, newY) && 
                    !this.isPositionOccupied(newX, newY, spawnId)) {
                    return { x: newX, y: newY };
                }
            }
        }
        
        // Si no encuentra posición libre, usar la ideal pero con offset aleatorio
        const randomAngle = Math.random() * 2 * Math.PI;
        const randomRadius = minSep + Math.random() * minSep;
        
        return {
            x: Math.max(this.spacingConfig.edgeBuffer, 
                Math.min(this.screen.width - this.spacingConfig.edgeBuffer, 
                    idealX + Math.cos(randomAngle) * randomRadius)),
            y: Math.max(this.spacingConfig.edgeBuffer, 
                Math.min(this.screen.height - this.spacingConfig.edgeBuffer, 
                    idealY + Math.sin(randomAngle) * randomRadius))
        };
    }

    /**
     * 🆕 NUEVA FUNCIÓN: Verificar si una posición es válida en pantalla
     */
    isPositionValid(x, y) {
        return x >= this.spacingConfig.edgeBuffer && 
               x <= (this.screen.width - this.spacingConfig.edgeBuffer) &&
               y >= this.spacingConfig.edgeBuffer && 
               y <= (this.screen.height - this.spacingConfig.edgeBuffer);
    }

    /**
     * FUNCIÓN MODIFICADA: Proyectar posición mundial a coordenadas de pantalla
     */
    worldToScreen(objectWorldPosition, spawnId = null) {
        if (!this.state.isReady) {
            return null;
        }

        // 1. Verificar si está en FOV
        if (!this.isObjectInFOV(objectWorldPosition)) {
            // 🆕 MEJORA: Limpiar posición ocupada si sale del FOV
            if (spawnId && this.occupiedPositions.has(spawnId)) {
                this.occupiedPositions.delete(spawnId);
            }
            return null;
        }

        // 2. Calcular posición relativa al jugador
        const distance = Utils.calculateDistance(this.state.playerPosition, objectWorldPosition);
        const angleToObject = this.calculateAngleToObject(objectWorldPosition);
        
        // 3. Calcular ángulo relativo al centro de la pantalla
        const relativeAngle = this.getAngleDifference(this.state.playerHeading, angleToObject);
        
        // 4. Convertir ángulo a posición horizontal en pantalla
        const horizontalOffset = (relativeAngle / (this.config.horizontalFOV / 2)) * (this.screen.centerX - this.config.screenMargin);
        const idealScreenX = this.screen.centerX + horizontalOffset;
        
        // 5. Calcular posición vertical basada en distancia (perspectiva)
        const verticalOffset = this.calculateVerticalOffset(distance);
        const idealScreenY = this.screen.centerY + verticalOffset;
        
        // 🆕 MEJORA: Encontrar posición libre cerca de la ideal
        const freePosition = this.findFreePosition(idealScreenX, idealScreenY, spawnId);
        
        // 🆕 MEJORA: Registrar posición ocupada
        if (spawnId) {
            this.occupiedPositions.set(spawnId, {
                x: freePosition.x,
                y: freePosition.y,
                radius: this.spacingConfig.separationRadius / 2
            });
        }
        
        return {
            x: Math.round(freePosition.x),
            y: Math.round(freePosition.y),
            distance: distance,
            relativeAngle: relativeAngle
        };
    }

    /**
     * Calcular offset vertical basado en distancia (efecto perspectiva)
     */
    calculateVerticalOffset(distance) {
        // Objetos más lejanos aparecen más hacia el centro verticalmente
        // Objetos más cercanos pueden aparecer más arriba o abajo
        
        const maxVerticalOffset = this.screen.height * 0.2; // 20% de la pantalla
        const normalizedDistance = Math.min(distance / this.config.maxRenderDistance, 1.0);
        
        // Función que reduce el offset vertical conforme aumenta la distancia
        const verticalVariation = (1 - normalizedDistance) * maxVerticalOffset;
        
        // Agregar algo de aleatoriedad controlada para que no todos estén en línea
        const randomOffset = (Math.random() - 0.5) * verticalVariation * 0.5;
        
        return randomOffset;
    }

    /**
     * Verificar si una posición está dentro de los límites visibles de pantalla
     */
    isPositionOnScreen(x, y) {
        return x >= this.config.screenMargin && 
               x <= (this.screen.width - this.config.screenMargin) &&
               y >= this.config.screenMargin && 
               y <= (this.screen.height - this.config.screenMargin);
    }

    /**
     * FUNCIÓN MODIFICADA: Obtener todos los objetos visibles con sus posiciones de pantalla
     */
    getVisibleObjects(worldObjects) {
        if (!this.state.isReady) return [];
        
        const visibleObjects = [];
        
        // 🆕 MEJORA: Limpiar posiciones de objetos que ya no están en la lista
        const currentSpawnIds = new Set(worldObjects.map(obj => obj.id));
        for (const [spawnId] of this.occupiedPositions) {
            if (!currentSpawnIds.has(spawnId)) {
                this.occupiedPositions.delete(spawnId);
            }
        }
        
        // Procesar objetos ordenados por distancia (más cercanos primero)
        const sortedObjects = [...worldObjects].sort((a, b) => {
            const distA = Utils.calculateDistance(this.state.playerPosition, a.worldPosition);
            const distB = Utils.calculateDistance(this.state.playerPosition, b.worldPosition);
            return distA - distB;
        });
        
        sortedObjects.forEach(obj => {
            // 🆕 MEJORA: Pasar spawnId para tracking de posición
            const screenPos = this.worldToScreen(obj.worldPosition, obj.id);
            
            if (screenPos) {
                visibleObjects.push({
                    ...obj,
                    screenPosition: screenPos,
                    distance: screenPos.distance,
                    relativeAngle: screenPos.relativeAngle
                });
            }
        });
        
        return visibleObjects;
    }

    /**
     * 🆕 NUEVA FUNCIÓN: Limpiar posición ocupada manualmente
     */
    clearOccupiedPosition(spawnId) {
        if (this.occupiedPositions.has(spawnId)) {
            this.occupiedPositions.delete(spawnId);
        }
    }

    /**
     * 🆕 NUEVA FUNCIÓN: Obtener información de debug sobre posiciones
     */
    getDebugInfo() {
        return {
            occupiedPositions: Array.from(this.occupiedPositions.entries()),
            screenDimensions: this.screen,
            spacingConfig: this.spacingConfig
        };
    }

    /**
     * Configurar parámetros del FOV
     */
    configure(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * FUNCIÓN MODIFICADA: Destruir FOVManager
     */
    destroy() {
        window.removeEventListener('resize', this.updateScreenDimensions);
        
        // 🆕 MEJORA: Limpiar posiciones ocupadas
        this.occupiedPositions.clear();
    }
}
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
     * Proyectar posición mundial a coordenadas de pantalla
     */
    worldToScreen(objectWorldPosition) {
        if (!this.state.isReady) {
            return null;
        }

        // 1. Verificar si está en FOV
        if (!this.isObjectInFOV(objectWorldPosition)) {
            return null;
        }

        // 2. Calcular posición relativa al jugador
        const distance = Utils.calculateDistance(this.state.playerPosition, objectWorldPosition);
        const angleToObject = this.calculateAngleToObject(objectWorldPosition);
        
        // 3. Calcular ángulo relativo al centro de la pantalla
        const relativeAngle = this.getAngleDifference(this.state.playerHeading, angleToObject);
        
        // 4. Convertir ángulo a posición horizontal en pantalla
        const horizontalOffset = (relativeAngle / (this.config.horizontalFOV / 2)) * (this.screen.centerX - this.config.screenMargin);
        const screenX = this.screen.centerX + horizontalOffset;
        
        // 5. Calcular posición vertical basada en distancia (perspectiva)
        const verticalOffset = this.calculateVerticalOffset(distance);
        const screenY = this.screen.centerY + verticalOffset;
        
        // 6. Verificar que esté dentro de los límites de pantalla
        if (this.isPositionOnScreen(screenX, screenY)) {
            return {
                x: Math.round(screenX),
                y: Math.round(screenY),
                distance: distance,
                relativeAngle: relativeAngle
            };
        }
        
        return null;
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
     * Obtener todos los objetos visibles con sus posiciones de pantalla
     */
    getVisibleObjects(worldObjects) {
        if (!this.state.isReady) return [];
        
        const visibleObjects = [];
        
        worldObjects.forEach(obj => {
            const screenPos = this.worldToScreen(obj.worldPosition);
            
            if (screenPos) {
                visibleObjects.push({
                    ...obj,
                    screenPosition: screenPos,
                    distance: screenPos.distance,
                    relativeAngle: screenPos.relativeAngle
                });
            }
        });
        
        // Ordenar por distancia (más cercanos primero)
        visibleObjects.sort((a, b) => a.distance - b.distance);
        
        return visibleObjects;
    }

    /**
     * Configurar parámetros del FOV
     */
    configure(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Destruir FOVManager
     */
    destroy() {
        window.removeEventListener('resize', this.updateScreenDimensions);
    }
}
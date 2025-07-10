// public/js/mechanics/ThrowMechanics.js - VERSION SOLO PROXIMIDAD

import { Utils } from "../utils/utils.js";

export class ThrowMechanics {
    constructor(messageManager) {
        this.messageManager = messageManager;
        
        // Configuración de precisión
        this.accuracy = {
            perfect: 50,    // Radio para hit perfecto (más puntos)
            good: 100,      // Radio para hit bueno (puntos normales)
            okay: 150,      // Radio para hit okay (menos puntos)
            maxRange: 200   // Radio máximo para cualquier hit
        };
        
        // Configuración de rewards
        this.rewards = {
            perfect: 1.5,   // 1.5x multiplicador
            good: 1.0,      // 1.0x multiplicador  
            okay: 0.7       // 0.7x multiplicador
        };
        
        // Estado del lanzamiento
        this.throwState = {
            isActive: false,
            activeProjectiles: new Map(),
            nextProjectileId: 1
        };
        
        // Callbacks
        this.onThrowHit = null;
        this.onThrowMiss = null;
        
        this.initializeStyles();
    }

    /**
     * Configurar callback para hit exitoso
     */
    setOnThrowHit(callback) {
        this.onThrowHit = callback;
    }

    /**
     * Configurar callback para miss
     */
    setOnThrowMiss(callback) {
        this.onThrowMiss = callback;
    }

    /**
     * SIMPLIFICADO: Intentar lanzamiento sin validación de proximidad física
     */
    attemptThrow(tapX, tapY, availableTargets, playerPosition) {
        if (this.throwState.isActive) {
            return { success: false, reason: 'Lanzamiento en progreso' };
        }

        if (!availableTargets || availableTargets.length === 0) {
            return { success: false, reason: 'No hay objetivos disponibles' };
        }

        // Encontrar el objetivo más cercano al tap
        const targetInfo = this.findClosestTargetWithDOMCheck(tapX, tapY, availableTargets);
        
        if (!targetInfo) {
            return { success: false, reason: 'No hay objetivo válido' };
        }

        // CAMBIO: Sin validación de proximidad física
        // Los objetos solo aparecen si estás cerca, así que si están visibles, puedes lanzar

        // Ejecutar lanzamiento directamente
        return this.executeThrow(tapX, tapY, targetInfo, 0); // physicalDistance = 0 (no usado)
    }

    /**
     * Encontrar objetivo más cercano al tap
     */
    findClosestTarget(tapX, tapY, availableTargets) {
        let closestTarget = null;
        let closestDistance = Infinity;
        let targetElement = null;

        // 🆕 MEJORA: Crear array con elementos y sus z-indexes
        const targetsWithElements = availableTargets.map(target => {
            const element = document.getElementById(`spawn-${target.id}`);
            if (!element) return null;

            const rect = element.getBoundingClientRect();
            const zIndex = parseInt(window.getComputedStyle(element).zIndex) || 0;
            
            return {
                target,
                element,
                rect,
                zIndex,
                screenX: rect.left + rect.width / 2,
                screenY: rect.top + rect.height / 2
            };
        }).filter(Boolean); // Remover elementos null

        // 🆕 MEJORA: Ordenar por z-index (más arriba primero)
        targetsWithElements.sort((a, b) => b.zIndex - a.zIndex);

        // 🆕 MEJORA: Buscar considerando orden de renderizado
        targetsWithElements.forEach(({ target, element, screenX, screenY }) => {
            const screenDistance = Utils.calculateDistance(
                { x: tapX, y: tapY },
                { x: screenX, y: screenY }
            );

            // 🆕 MEJORA: Verificar si el toque está realmente dentro del elemento
            const isWithinElement = this.isPointWithinElement(tapX, tapY, element);

            if (screenDistance <= this.accuracy.maxRange) {
                // 🆕 MEJORA: Priorizar elementos que contienen directamente el punto
                if (isWithinElement) {
                    // Si el tap está dentro del elemento, es la mejor opción
                    closestTarget = target;
                    targetElement = element;
                    closestDistance = screenDistance;
                    return; // Salir del forEach (encontramos el mejor)
                } else if (screenDistance < closestDistance && !closestTarget) {
                    // Si no hay uno mejor, usar este como fallback
                    closestDistance = screenDistance;
                    closestTarget = target;
                    targetElement = element;
                }
            }
        });

        if (!closestTarget) return null;

        return {
            target: closestTarget,
            element: targetElement,
            screenDistance: closestDistance,
            screenPosition: {
                x: targetElement.getBoundingClientRect().left + targetElement.getBoundingClientRect().width / 2,
                y: targetElement.getBoundingClientRect().top + targetElement.getBoundingClientRect().height / 2
            }
        };
    }

    /**
     * 🆕 NUEVA FUNCIÓN: Verificar si un punto está dentro de un elemento
     */
    isPointWithinElement(x, y, element) {
        const rect = element.getBoundingClientRect();
        return (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
        );
    }

    /**
     * 🆕 NUEVA FUNCIÓN: Obtener elemento más visible en una posición
     */
    getTopElementAtPosition(x, y) {
        // Usar elementFromPoint para obtener el elemento más arriba
        const element = document.elementFromPoint(x, y);
        
        // Verificar si es un spawn element
        if (element && element.id && element.id.startsWith('spawn-')) {
            return element;
        }
        
        // Si no es un spawn, buscar en sus ancestros
        let parent = element?.parentElement;
        while (parent) {
            if (parent.id && parent.id.startsWith('spawn-')) {
                return parent;
            }
            parent = parent.parentElement;
        }
        
        return null;
    }

    /**
     * 🆕 MÉTODO ALTERNATIVO: Usar elementFromPoint como verificación adicional
     */
    findClosestTargetWithDOMCheck(tapX, tapY, availableTargets) {
        // Primero, verificar qué elemento está realmente en esa posición
        const topElement = this.getTopElementAtPosition(tapX, tapY);
        
        if (topElement) {
            // Extraer ID del spawn
            const spawnId = parseInt(topElement.id.replace('spawn-', ''));
            
            // Buscar el target correspondiente
            const directTarget = availableTargets.find(target => target.id === spawnId);
            
            if (directTarget) {
                console.log(`🎯 Captura directa detectada: ${directTarget.name}`);
                
                const rect = topElement.getBoundingClientRect();
                return {
                    target: directTarget,
                    element: topElement,
                    screenDistance: Utils.calculateDistance(
                        { x: tapX, y: tapY },
                        { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
                    ),
                    screenPosition: {
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2
                    }
                };
            }
        }
        
        // Si no hay detección directa, usar el método mejorado anterior
        return this.findClosestTarget(tapX, tapY, availableTargets);
    }

    /**
     * Ejecutar el lanzamiento
     */
    executeThrow(tapX, tapY, targetInfo, physicalDistance) {
        this.throwState.isActive = true;

        const { target, element, screenDistance, screenPosition } = targetInfo;

        // Determinar tipo de hit basado en precisión
        const hitType = this.determineHitType(screenDistance);
        
        // Crear proyectil visual
        const projectileId = this.createProjectile(tapX, tapY, screenPosition.x, screenPosition.y);

        // Programar resolución del lanzamiento
        setTimeout(() => {
            this.resolveThrow(projectileId, target, element, hitType, screenDistance, physicalDistance);
        }, 800); // Duración de la animación del proyectil

        return { 
            success: true, 
            hitType: hitType,
            screenDistance: screenDistance,
            physicalDistance: physicalDistance,
            projectileId: projectileId
        };
    }

    /**
     * Determinar tipo de hit basado en distancia
     */
    determineHitType(screenDistance) {
        if (screenDistance <= this.accuracy.perfect) return 'perfect';
        if (screenDistance <= this.accuracy.good) return 'good';
        if (screenDistance <= this.accuracy.okay) return 'okay';
        return 'miss';
    }

    /**
     * Crear proyectil visual
     */
    createProjectile(fromX, fromY, toX, toY) {
        const projectileId = this.throwState.nextProjectileId++;
        
        const projectile = document.createElement('div');
        projectile.className = 'throw-projectile';
        projectile.id = `projectile-${projectileId}`;
        
        // Posición inicial
        projectile.style.left = fromX + 'px';
        projectile.style.top = fromY + 'px';
        
        // Calcular rotación basada en dirección
        const angle = Math.atan2(toY - fromY, toX - fromX) * (180 / Math.PI);
        projectile.style.transform = `rotate(${angle}deg)`;
        
        document.body.appendChild(projectile);
        
        // Animar hacia el objetivo
        setTimeout(() => {
            projectile.style.left = toX + 'px';
            projectile.style.top = toY + 'px';
        }, 50);
        
        // Agregar trail
        this.createProjectileTrail(fromX, fromY, toX, toY);
        
        this.throwState.activeProjectiles.set(projectileId, {
            element: projectile,
            startTime: Date.now()
        });
        
        return projectileId;
    }

    /**
     * Crear trail visual del proyectil
     */
    createProjectileTrail(fromX, fromY, toX, toY) {
        const trail = document.createElement('div');
        trail.className = 'throw-trail';
        
        const distance = Utils.calculateDistance({ x: fromX, y: fromY }, { x: toX, y: toY });
        const angle = Math.atan2(toY - fromY, toX - fromX) * (180 / Math.PI);
        
        trail.style.left = fromX + 'px';
        trail.style.top = fromY + 'px';
        trail.style.width = distance + 'px';
        trail.style.transform = `rotate(${angle}deg)`;
        trail.style.transformOrigin = '0 50%';
        
        document.body.appendChild(trail);
        
        // Remover trail después de la animación
        setTimeout(() => {
            trail.remove();
        }, 1000);
    }

    /**
     * Resolver el resultado del lanzamiento
     */
    resolveThrow(projectileId, target, targetElement, hitType, screenDistance, physicalDistance) {
        this.throwState.isActive = false;
        
        // Limpiar proyectil
        this.cleanupProjectile(projectileId);
        
        if (hitType === 'miss') {
            // MISS - No captura
            this.handleThrowMiss(target, screenDistance);
            this.createMissEffect(targetElement);
        } else {
            // HIT - Captura exitosa con multiplicador
            const multiplier = this.rewards[hitType];
            this.handleThrowHit(target, hitType, multiplier, screenDistance, physicalDistance);
            this.createHitEffect(targetElement, hitType);
        }
    }

    /**
     * Manejar hit exitoso
     */
    handleThrowHit(target, accuracy, multiplier, screenDistance, physicalDistance) {        
        if (this.onThrowHit) {
            this.onThrowHit({
                target: target,
                accuracy: accuracy,
                multiplier: multiplier,
                screenDistance: screenDistance,
                physicalDistance: physicalDistance
            });
        }
    }

    /**
     * SIMPLIFICADO: Manejar miss sin detalles de distancia física
     */
    handleThrowMiss(target, screenDistance) {        
        if (this.onThrowMiss) {
            this.onThrowMiss({
                target: target,
                screenDistance: screenDistance,
                reason: 'Puntería imprecisa'
            });
        }
    }

    /**
     * Crear efecto visual de hit
     */
    createHitEffect(targetElement, accuracy) {
        if (!targetElement) return;
        
        const rect = targetElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Efecto principal
        const effect = document.createElement('div');
        effect.className = `throw-hit-effect ${accuracy}`;
        effect.style.left = centerX + 'px';
        effect.style.top = centerY + 'px';
        
        document.body.appendChild(effect);
        
        // Partículas
        this.createHitParticles(centerX, centerY, accuracy);
        
        // Limpiar después de animación
        setTimeout(() => {
            effect.remove();
        }, 1000);
        
        // Efecto en el objetivo
        targetElement.classList.add('hit-target');
        setTimeout(() => {
            targetElement.classList.remove('hit-target');
        }, 500);
    }

    /**
     * SIMPLIFICADO: Crear efecto visual de miss sin mensaje específico
     */
    createMissEffect(targetElement) {
        if (!targetElement) return;
        
        targetElement.classList.add('miss-target');
        setTimeout(() => {
            targetElement.classList.remove('miss-target');
        }, 600);
        
        // Sin mensaje específico, el GameClient maneja el feedback
    }

    /**
     * Crear partículas de hit
     */
    createHitParticles(centerX, centerY, accuracy) {
        const particleCount = accuracy === 'perfect' ? 8 : accuracy === 'good' ? 6 : 4;
        const colors = {
            perfect: '#FFD700',
            good: '#00FF88', 
            okay: '#FF9500'
        };
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'hit-particle';
            particle.style.left = centerX + 'px';
            particle.style.top = centerY + 'px';
            particle.style.background = colors[accuracy] || '#FFFFFF';
            
            const angle = (i / particleCount) * 2 * Math.PI;
            const distance = 30 + Math.random() * 20;
            const finalX = centerX + Math.cos(angle) * distance;
            const finalY = centerY + Math.sin(angle) * distance;
            
            document.body.appendChild(particle);
            
            setTimeout(() => {
                particle.style.left = finalX + 'px';
                particle.style.top = finalY + 'px';
                particle.style.opacity = '0';
            }, 50);
            
            setTimeout(() => {
                particle.remove();
            }, 800);
        }
    }

    /**
     * Limpiar proyectil
     */
    cleanupProjectile(projectileId) {
        const projectileData = this.throwState.activeProjectiles.get(projectileId);
        if (projectileData) {
            projectileData.element.remove();
            this.throwState.activeProjectiles.delete(projectileId);
        }
    }

    /**
     * Obtener información de precisión para UI
     */
    getAccuracyInfo() {
        return {
            ranges: { ...this.accuracy },
            multipliers: { ...this.rewards }
        };
    }

    /**
     * Verificar si está en proceso de lanzamiento
     */
    isThrowActive() {
        return this.throwState.isActive;
    }

    /**
     * Inicializar estilos CSS
     */
    initializeStyles() {
        if (document.getElementById('throwMechanicsStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'throwMechanicsStyles';
        style.textContent = `
            /* Proyectil */
            .throw-projectile {
                position: fixed;
                width: 12px;
                height: 12px;
                background: radial-gradient(circle, #FFD700, #FFA500);
                border-radius: 50%;
                z-index: 1500;
                transition: all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                box-shadow: 0 0 10px rgba(255, 215, 0, 0.8);
                pointer-events: none;
            }
            
            /* Trail del proyectil */
            .throw-trail {
                position: fixed;
                height: 2px;
                background: linear-gradient(90deg, 
                    rgba(255, 215, 0, 0.8) 0%, 
                    rgba(255, 215, 0, 0.4) 50%, 
                    rgba(255, 215, 0, 0) 100%);
                z-index: 1400;
                animation: trailFade 1s ease-out forwards;
                pointer-events: none;
            }
            
            @keyframes trailFade {
                0% { opacity: 1; }
                100% { opacity: 0; }
            }
            
            /* Efectos de hit */
            .throw-hit-effect {
                position: fixed;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                z-index: 1600;
                pointer-events: none;
                transform: translate(-50%, -50%);
                animation: hitExplosion 1s ease-out forwards;
            }
            
            .throw-hit-effect.perfect {
                background: radial-gradient(circle, rgba(255, 215, 0, 0.8), transparent);
                box-shadow: 0 0 30px #FFD700;
            }
            
            .throw-hit-effect.good {
                background: radial-gradient(circle, rgba(0, 255, 136, 0.8), transparent);
                box-shadow: 0 0 25px #00FF88;
            }
            
            .throw-hit-effect.okay {
                background: radial-gradient(circle, rgba(255, 149, 0, 0.8), transparent);
                box-shadow: 0 0 20px #FF9500;
            }
            
            @keyframes hitExplosion {
                0% {
                    transform: translate(-50%, -50%) scale(0);
                    opacity: 1;
                }
                50% {
                    transform: translate(-50%, -50%) scale(1.2);
                    opacity: 0.8;
                }
                100% {
                    transform: translate(-50%, -50%) scale(2);
                    opacity: 0;
                }
            }
            
            /* Partículas */
            .hit-particle {
                position: fixed;
                width: 4px;
                height: 4px;
                border-radius: 50%;
                z-index: 1550;
                pointer-events: none;
                transition: all 0.8s ease-out;
                transform: translate(-50%, -50%);
            }
            
            /* Efectos en objetivos */
            .hit-target {
                animation: targetHit 0.5s ease-out !important;
            }
            
            .miss-target {
                animation: targetMiss 0.6s ease-out !important;
            }
            
            @keyframes targetHit {
                0% { transform: translate(-50%, -50%) scale(1); }
                25% { transform: translate(-50%, -50%) scale(1.2); filter: brightness(1.5); }
                100% { transform: translate(-50%, -50%) scale(0.8); filter: brightness(1); }
            }
            
            @keyframes targetMiss {
                0%, 100% { transform: translate(-50%, -50%) scale(1); }
                25% { transform: translate(-50%, -50%) scale(1.1) rotate(-5deg); }
                75% { transform: translate(-50%, -50%) scale(1.1) rotate(5deg); }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Limpiar recursos
     */
    destroy() {
        // Limpiar proyectiles activos
        this.throwState.activeProjectiles.forEach((projectileData, id) => {
            projectileData.element.remove();
        });
        this.throwState.activeProjectiles.clear();
        
        // Remover estilos
        document.getElementById('throwMechanicsStyles')?.remove();
        
        // Limpiar callbacks
        this.onThrowHit = null;
        this.onThrowMiss = null;        
    }
}
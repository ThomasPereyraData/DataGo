// public/js/utils/Utils.js
export class Utils {
    /**
     * Calcular distancia entre dos puntos
     */
    static calculateDistance(pos1, pos2) {
        return Math.sqrt(
            Math.pow(pos1.x - pos2.x, 2) + 
            Math.pow(pos1.y - pos2.y, 2)
        );
    }

    /**
     * Generar posición aleatoria en pantalla
     */
    static getRandomScreenPosition() {
        const margin = 100;
        const x = margin + Math.random() * (window.innerWidth - 2 * margin);
        const y = margin + Math.random() * (window.innerHeight - 2 * margin);
        return { x, y };
    }

    /**
     * Validar que una posición esté dentro de los límites
     */
    static clampPosition(position, roomSize) {
        return {
            x: Math.max(0.2, Math.min(roomSize.width - 0.2, position.x)),
            y: Math.max(0.2, Math.min(roomSize.height - 0.2, position.y))
        };
    }

    /**
     * Suavizar cambios bruscos de orientación (maneja wraparound de 360°)
     */
    static smoothHeading(currentHeading, newHeading, smoothingFactor = 0.8) {
        if (currentHeading === 0) {
            return newHeading;
        }

        const diff = Math.abs(newHeading - currentHeading);
        if (diff > 180) {
            // Manejar el wraparound de 360°
            if (newHeading > currentHeading) {
                newHeading -= 360;
            } else {
                newHeading += 360;
            }
        }

        return currentHeading * smoothingFactor + newHeading * (1 - smoothingFactor);
    }

    /**
     * Debounce para limitar frecuencia de ejecución
     */
    static debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    /**
     * Throttle para limitar frecuencia de ejecución
     */
    static throttle(func, delay) {
        let lastExec = 0;
        return function (...args) {
            const now = Date.now();
            if (now - lastExec >= delay) {
                func.apply(this, args);
                lastExec = now;
            }
        };
    }

    /**
     * Formatear números con decimales
     */
    static formatNumber(number, decimals = 1) {
        return Number(number).toFixed(decimals);
    }

    /**
     * Detectar si es dispositivo móvil
     */
    static isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    /**
     * Detectar si es iOS
     */
    static isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent);
    }

    /**
     * Vibración si está disponible
     */
    static vibrate(pattern) {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }

    /**
     * Generar ID único simple
     */
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Esperar un tiempo específico (Promise-based)
     */
    static wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
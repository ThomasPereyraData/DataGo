// public/js/ui/MessageManager.js

import { Utils } from "../utils/utils.js";

export class MessageManager {
    constructor() {
        this.messageBox = null;
        this.currentMessage = null;
        this.messageQueue = [];
        this.isShowing = false;
        
        this.initializeElements();
    }

    initializeElements() {
        this.messageBox = document.getElementById('messageBox');
        
        if (!this.messageBox) {
            Utils.log('MessageBox element not found!', 'error');
        }
    }

    /**
     * Mostrar mensaje con tipo y duración personalizable
     */
    show(text, type = 'info', duration = 3000) {
        const message = { text, type, duration, id: Utils.generateId() };
        
        // Si ya hay un mensaje mostrándose, agregarlo a la cola
        if (this.isShowing) {
            this.messageQueue.push(message);
            return message.id;
        }

        this._displayMessage(message);
        return message.id;
    }

    /**
     * Mostrar mensaje de éxito
     */
    success(text, duration = 3000) {
        return this.show(text, 'success', duration);
    }

    /**
     * Mostrar mensaje de error
     */
    error(text, duration = 4000) {
        Utils.vibrate(200); // Vibración para errores
        return this.show(text, 'error', duration);
    }

    /**
     * Mostrar mensaje de información
     */
    info(text, duration = 3000) {
        return this.show(text, 'info', duration);
    }

    /**
     * Mostrar mensaje de advertencia
     */
    warning(text, duration = 3500) {
        return this.show(text, 'warning', duration);
    }

    /**
     * Mostrar mensaje de éxito con vibración personalizada
     */
    successWithVibration(text, vibrationPattern = [100, 50, 100], duration = 3000) {
        Utils.vibrate(vibrationPattern);
        return this.success(text, duration);
    }

    /**
     * Mostrar mensaje inmediato (interrumpe el actual)
     */
    showImmediate(text, type = 'info', duration = 3000) {
        this.hide();
        this.messageQueue = []; // Limpiar cola
        return this.show(text, type, duration);
    }

    /**
     * Ocultar mensaje actual
     */
    hide() {
        if (this.messageBox && this.isShowing) {
            this.messageBox.style.display = 'none';
            this.isShowing = false;
            this.currentMessage = null;
            
            // Procesar siguiente mensaje en cola
            this._processQueue();
        }
    }

    /**
     * Limpiar todos los mensajes
     */
    clear() {
        this.messageQueue = [];
        this.hide();
    }

    /**
     * Mostrar mensaje con progreso (para acciones largas)
     */
    showProgress(text, type = 'info') {
        const progressMessage = `${text} <div class="progress-dots">...</div>`;
        return this.show(progressMessage, type, 0); // Duración 0 = no se oculta automáticamente
    }

    /**
     * Actualizar mensaje existente (útil para progreso)
     */
    updateCurrent(text, type) {
        if (this.currentMessage && this.messageBox) {
            this.messageBox.textContent = text;
            this.messageBox.className = `message ${type || this.currentMessage.type}`;
            this.currentMessage.text = text;
            if (type) this.currentMessage.type = type;
        }
    }

    /**
     * Mostrar mensaje de captura con detalles
     */
    showCaptureResult(success, details = {}) {
        if (success) {
            let message = `¡Capturado! +${details.points || 10} puntos`;
            if (details.multiplier > 1) {
                message += ` (${Utils.formatNumber(details.multiplier)}x)`;
            }
            if (details.streak > 1) {
                message += ` | Racha: ${details.streak}`;
            }
            this.successWithVibration(message, [100, 50, 100]);
        } else {
            let message = 'No se pudo capturar';
            if (details.reason === 'Demasiado lejos') {
                message = `Muy lejos: ${Utils.formatNumber(details.distance)}m (necesitas ${Utils.formatNumber(details.required)}m)`;
            } else if (details.reason) {
                message = details.reason;
            }
            this.error(message);
        }
    }

    /**
     * Mostrar mensaje de conexión
     */
    showConnectionStatus(connected, message) {
        const type = connected ? 'success' : 'error';
        const text = `${connected ? '🟢' : '🔴'} ${message}`;
        return this.show(text, type, connected ? 2000 : 4000);
    }

    // Métodos privados
    _displayMessage(message) {
        if (!this.messageBox) return;

        this.currentMessage = message;
        this.isShowing = true;

        this.messageBox.innerHTML = message.text;
        this.messageBox.className = `message ${message.type}`;
        this.messageBox.style.display = 'block';

        // Auto-ocultar si tiene duración
        if (message.duration > 0) {
            setTimeout(() => {
                this.hide();
            }, message.duration);
        }

        Utils.log(`Message shown: ${message.text}`, message.type);
    }

    _processQueue() {
        if (this.messageQueue.length > 0 && !this.isShowing) {
            const nextMessage = this.messageQueue.shift();
            this._displayMessage(nextMessage);
        }
    }
}
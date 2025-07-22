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
            throw new Error('Message box element not found');
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
    }

    _processQueue() {
        if (this.messageQueue.length > 0 && !this.isShowing) {
            const nextMessage = this.messageQueue.shift();
            this._displayMessage(nextMessage);
        }
    }
}
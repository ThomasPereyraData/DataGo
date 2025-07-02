// public/js/ui/CameraManager.js
import { Utils } from "../utils/utils.js";

export class CameraManager {
    constructor(messageManager) {
        this.messageManager = messageManager;
        this.cameraVideo = null;
        this.stream = null;
        this.isActive = false;
        
        // Configuraciones de cámara a probar
        this.cameraConfigs = [
            {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            },
            {
                video: {
                    facingMode: 'environment'
                }
            },
            {
                video: true
            }
        ];
        
        this.initializeElements();
    }

    /**
     * Inicializar elementos DOM
     */
    initializeElements() {
        this.cameraVideo = document.getElementById('cameraVideo');
        
        if (!this.cameraVideo) {
            Utils.log('Camera video element not found!', 'error');
            throw new Error('Camera video element not found');
        }
    }

    /**
     * Solicitar acceso a la cámara
     */
    async requestCameraAccess() {
        try {
            Utils.log('Solicitando acceso a la cámara...', 'info');
            this.messageManager?.info('Solicitando acceso a la cámara...');
            
            this.validateGetUserMedia();
            
            const stream = await this.tryMultipleConfigs();
            
            await this.setupCamera(stream);
            
            Utils.log('Cámara activada exitosamente', 'success');
            this.messageManager?.success('¡Cámara activada!');
            
            return true;
            
        } catch (error) {
            Utils.log('Error accediendo a la cámara: ' + error.message, 'error');
            this.handleCameraError(error);
            return false;
        }
    }

    /**
     * Validar disponibilidad de getUserMedia
     */
    validateGetUserMedia() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('getUserMedia no está disponible. Usa HTTPS o localhost.');
        }
    }

    /**
     * Probar múltiples configuraciones de cámara
     */
    async tryMultipleConfigs() {
        let lastError;
        
        for (const [index, config] of this.cameraConfigs.entries()) {
            try {
                Utils.log(`Probando configuración ${index + 1}/${this.cameraConfigs.length}`, 'debug');
                const stream = await navigator.mediaDevices.getUserMedia(config);
                
                Utils.log('Configuración exitosa: ' + JSON.stringify(config.video), 'success');
                return stream;
                
            } catch (error) {
                Utils.log(`Configuración ${index + 1} falló: ${error.message}`, 'warning');
                lastError = error;
                continue;
            }
        }
        
        throw lastError || new Error('No se pudo obtener acceso a ninguna cámara');
    }

    /**
     * Configurar la cámara con el stream
     */
    async setupCamera(stream) {
        return new Promise((resolve, reject) => {
            this.cameraVideo.srcObject = stream;
            this.stream = stream;
            this.isActive = true;
            
            this.cameraVideo.onloadedmetadata = () => {
                Utils.log('Metadata de video cargada', 'debug');
                this.logCameraInfo();
                resolve();
            };
            
            this.cameraVideo.onerror = (error) => {
                Utils.log('Error en elemento video: ' + error, 'error');
                reject(error);
            };
            
            // Timeout por si no se dispara onloadedmetadata
            setTimeout(() => {
                if (this.isActive) {
                    Utils.log('Video iniciado (timeout)', 'info');
                    resolve();
                }
            }, 2000);
        });
    }

    /**
     * Mostrar información de la cámara
     */
    logCameraInfo() {
        if (this.stream) {
            const videoTrack = this.stream.getVideoTracks()[0];
            if (videoTrack) {
                const settings = videoTrack.getSettings();
                Utils.log(`Cámara: ${settings.width}x${settings.height} - ${settings.facingMode || 'unknown'}`, 'info');
            }
        }
    }

    /**
     * Manejar errores de cámara
     */
    handleCameraError(error) {
        let errorMessage = 'Error: No se pudo acceder a la cámara. ';
        
        switch (error.name) {
            case 'NotAllowedError':
                errorMessage += 'Permisos denegados. Permite el acceso a la cámara.';
                break;
            case 'NotFoundError':
                errorMessage += 'No se encontró cámara disponible.';
                break;
            case 'NotReadableError':
                errorMessage += 'Cámara en uso por otra aplicación.';
                break;
            case 'OverconstrainedError':
                errorMessage += 'Configuración de cámara no compatible.';
                break;
            case 'SecurityError':
                errorMessage += 'Contexto inseguro. Usa HTTPS.';
                break;
            default:
                errorMessage += error.message;
        }
        
        this.messageManager?.error(errorMessage);
    }

    /**
     * Detener la cámara
     */
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
                Utils.log(`Track ${track.kind} detenido`, 'info');
            });
            
            this.stream = null;
            this.isActive = false;
            
            if (this.cameraVideo) {
                this.cameraVideo.srcObject = null;
            }
            
            Utils.log('Cámara detenida', 'info');
        }
    }

    /**
     * Cambiar entre cámaras (frontal/trasera)
     */
    async switchCamera() {
        if (!this.isActive) {
            Utils.log('No hay cámara activa para cambiar', 'warning');
            return false;
        }

        try {
            const currentTrack = this.stream.getVideoTracks()[0];
            const currentFacingMode = currentTrack.getSettings().facingMode;
            
            const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
            
            Utils.log(`Cambiando de cámara ${currentFacingMode} a ${newFacingMode}`, 'info');
            
            this.stopCamera();
            
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: newFacingMode }
            });
            
            await this.setupCamera(newStream);
            
            this.messageManager?.success(`Cámara ${newFacingMode === 'environment' ? 'trasera' : 'frontal'} activada`);
            return true;
            
        } catch (error) {
            Utils.log('Error cambiando cámara: ' + error.message, 'error');
            this.messageManager?.error('No se pudo cambiar la cámara');
            
            // Intentar reactivar la cámara anterior
            try {
                await this.requestCameraAccess();
            } catch (restoreError) {
                Utils.log('Error restaurando cámara: ' + restoreError.message, 'error');
            }
            
            return false;
        }
    }

    /**
     * Obtener capabilities de la cámara
     */
    getCameraCapabilities() {
        if (!this.stream) return null;
        
        const videoTrack = this.stream.getVideoTracks()[0];
        if (!videoTrack) return null;
        
        return {
            settings: videoTrack.getSettings(),
            capabilities: videoTrack.getCapabilities ? videoTrack.getCapabilities() : null,
            constraints: videoTrack.getConstraints()
        };
    }

    /**
     * Tomar screenshot de la cámara
     */
    takeScreenshot() {
        if (!this.isActive || !this.cameraVideo) {
            Utils.log('Cámara no disponible para screenshot', 'error');
            return null;
        }

        try {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            canvas.width = this.cameraVideo.videoWidth;
            canvas.height = this.cameraVideo.videoHeight;
            
            context.drawImage(this.cameraVideo, 0, 0);
            
            const dataURL = canvas.toDataURL('image/jpeg', 0.8);
            
            Utils.log('Screenshot capturado', 'success');
            return dataURL;
            
        } catch (error) {
            Utils.log('Error capturando screenshot: ' + error.message, 'error');
            return null;
        }
    }

    /**
     * Verificar si la cámara está activa
     */
    isActive() {
        return this.isActive && this.stream && !this.stream.getTracks().every(track => track.readyState === 'ended');
    }

    /**
     * Obtener información del estado
     */
    getStatus() {
        return {
            isActive: this.isActive,
            hasStream: !!this.stream,
            videoElement: !!this.cameraVideo,
            capabilities: this.getCameraCapabilities()
        };
    }

    /**
     * Manejar cambios de visibilidad de página
     */
    handleVisibilityChange() {
        if (document.hidden && this.isActive) {
            Utils.log('Aplicación en background - pausando cámara', 'info');
            // Opcional: pausar el video para ahorrar batería
            if (this.cameraVideo) {
                this.cameraVideo.pause();
            }
        } else if (!document.hidden && this.isActive) {
            Utils.log('Aplicación en foreground - reanudando cámara', 'info');
            if (this.cameraVideo) {
                this.cameraVideo.play().catch(error => {
                    Utils.log('Error reanudando video: ' + error.message, 'error');
                });
            }
        }
    }

    /**
     * Limpiar recursos
     */
    destroy() {
        this.stopCamera();
        
        // Remover event listeners si los hay
        document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        
        this.cameraVideo = null;
        this.messageManager = null;
        
        Utils.log('CameraManager destruido', 'info');
    }
}
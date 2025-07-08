// public/js/api/ApiManager.js - VERSIÓN SIMPLE

export class ApiManager {
    constructor(messageManager = null) {
        this.messageManager = messageManager;
        this.baseURL = 'https://api.dataiq.com.ar/datagoapi';
    }

    /**
     * Enviar captura al backend
     */
    async sendCapture(captureData) {
        const url = `${this.baseURL}/captura`;
                
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(captureData)
            });
            
            if (response.ok) {
                const result = await response.json();
                
                if (this.messageManager) {
                    this.messageManager.success('Captura registrada');
                }
                
                return result;
            } else {
                const errorText = await response.text().catch(() => 'No response body');
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
        } catch (error) {            
            if (this.messageManager) {
                this.messageManager.error('Error enviando captura');
            }
            
            throw error;
        }
    }

    /**
     * Enviar registro de usuario al backend
     */
    async sendRegistration(userData) {
        const url = `${this.baseURL}/RegistroUsuario`;
                
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            if (response.ok) {
                const result = await response.json();                
                if (this.messageManager) {
                    this.messageManager.success('Registro completado');
                }
                
                return result;
            } else {
                const errorText = await response.text().catch(() => 'No response body');
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
        } catch (error) {            
            if (this.messageManager) {
                this.messageManager.error('Error enviando registro');
            }
            
            throw error;
        }
    }

    /**
     * Enviar desconexion de usuario al backend
     */
    async sendDisconnection(IdSocket) {
        const url = `${this.baseURL}/RegistroUsuario/desactivar`;
                
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ IdSocket })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Success result:', result);
                return result;
            } else {
                const errorText = await response.text().catch(() => 'No response body');
                console.log('Error response:', response.status, errorText);
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }
}
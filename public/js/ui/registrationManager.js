// public/js/ui/RegistrationManager.js - FIXED PARA PWA iOS

import { Utils } from "../utils/utils.js";

export class RegistrationManager {
    constructor(messageManager = null) {
        this.messageManager = messageManager;
        
        // Estado
        this.state = {
            isVisible: false,
            isSubmitting: false,
            playerData: null,
            isPWA: window.navigator.standalone === true // Detectar PWA
        };
        
        // Elementos DOM (ya existen en HTML)
        this.elements = {
            overlay: document.getElementById('registrationOverlay'),
            form: document.getElementById('registrationForm'),
            nameInput: document.getElementById('playerName'),
            lastNameInput: document.getElementById('playerLastName'),
            emailInput: document.getElementById('playerEmail'),
            submitButton: document.getElementById('submitRegistration')
        };
        
        // Callbacks
        this.onRegistrationSuccess = null;
        
        this.initialize();
    }

    /**
     * Inicializar manager
     */
    initialize() {
        // Verificar que todos los elementos existan
        const requiredElements = ['overlay', 'form', 'nameInput', 'lastNameInput', 'emailInput', 'submitButton'];
        
        for (const elementName of requiredElements) {
            if (!this.elements[elementName]) {
                throw new Error(`Elemento requerido no encontrado: ${elementName}`);
            }
        }
        
        this.setupEventListeners();
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Submit del formulario
        this.elements.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });
        
        // Validación en tiempo real
        this.elements.nameInput.addEventListener('input', () => {
            this.clearError('nameError');
        });
        
        this.elements.lastNameInput.addEventListener('input', () => {
            this.clearError('lastNameError');
        });
        
        this.elements.emailInput.addEventListener('input', () => {
            this.clearError('emailError');
        });
        
        // 🆕 PWA-specific touch handlers
        if (this.state.isPWA) {
            this.setupPWAInputHandlers();
        }
        
        // Evitar cerrar (mostrar mensaje)
        this.elements.overlay.addEventListener('click', (e) => {
            if (e.target === this.elements.overlay) {
                this.showCantCloseMessage();
            }
        });
        
        // Evitar cerrar con Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.state.isVisible) {
                this.showCantCloseMessage();
            }
        });
        
    }

    /**
     * 🆕 Configurar handlers específicos para PWA iOS
     */
    setupPWAInputHandlers() {
        const inputs = [this.elements.nameInput, this.elements.lastNameInput, this.elements.emailInput];
        
        inputs.forEach(input => {
            // Múltiples eventos para asegurar que funcione en PWA
            input.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                setTimeout(() => {
                    input.focus();
                    input.click();
                }, 10);
            });
            
            input.addEventListener('click', (e) => {
                e.stopPropagation();
                setTimeout(() => {
                    input.focus();
                }, 10);
            });
            
            // Forzar scroll hacia el input en PWA
            input.addEventListener('focus', () => {
                setTimeout(() => {
                    input.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' 
                    });
                }, 100);
            });
        });
    }

    /**
     * Mostrar formulario
     */
    show() {
        if (this.state.isVisible) return;
                
        // Mostrar overlay
        this.elements.overlay.classList.add('show');
        this.state.isVisible = true;
        
        // Focus diferente para PWA vs Browser
        if (this.state.isPWA) {
            // En PWA, no hacer focus automático - esperar tap del usuario
        } else {
            // En browser normal, focus automático
            setTimeout(() => {
                this.elements.nameInput.focus();
            }, 350);
        }
    }

    /**
     * Ocultar formulario
     */
    hide() {
        if (!this.state.isVisible) return;
        
        this.elements.overlay.classList.remove('show');
        this.state.isVisible = false;
    }

    /**
     * Manejar envío del formulario
     */
    async handleSubmit() {
        if (this.state.isSubmitting) return;
                
        // Validar
        const validation = this.validateForm();
        if (!validation.isValid) {
            this.showValidationErrors(validation.errors);
            return;
        }
        
        // Obtener datos
        const formData = this.getFormData();
        
        // Estado de carga
        this.setSubmittingState(true);
        
        try {
            // Guardar datos
            this.state.playerData = formData;            
            this.messageManager?.success('¡Registro exitoso! Iniciando juego...');
            
            // Callback
            if (this.onRegistrationSuccess) {
                this.onRegistrationSuccess(formData);
            }
            
            // Ocultar formulario
            this.hide();
            
        } catch (error) {
            this.messageManager?.error('Error en registro de usuario');
            this.setSubmittingState(false);
        }
    }

    /**
     * Validar formulario
     */
    validateForm() {
        const errors = {};
        let isValid = true;
        
        // Nombre
        const name = this.elements.nameInput.value.trim();
        if (!name) {
            errors.name = 'El nombre es obligatorio';
            isValid = false;
        } else if (name.length < 2) {
            errors.name = 'El nombre debe tener al menos 2 caracteres';
            isValid = false;
        }
        
        // Apellido
        const lastName = this.elements.lastNameInput.value.trim();
        if (!lastName) {
            errors.lastName = 'El apellido es obligatorio';
            isValid = false;
        } else if (lastName.length < 2) {
            errors.lastName = 'El apellido debe tener al menos 2 caracteres';
            isValid = false;
        }
        
        // Email
        const email = this.elements.emailInput.value.trim();
        if (!email) {
            errors.email = 'El email es obligatorio';
            isValid = false;
        } else if (!this.isValidEmail(email)) {
            errors.email = 'Ingresa un email válido';
            isValid = false;
        }
        
        return { isValid, errors };
    }

    /**
     * Validar email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Mostrar errores de validación
     */
    showValidationErrors(errors) {
        this.clearAllErrors();
        
        if (errors.name) {
            this.showError('nameError', errors.name);
        }
        
        if (errors.lastName) {
            this.showError('lastNameError', errors.lastName);
        }
        
        if (errors.email) {
            this.showError('emailError', errors.email);
        }
        
        // Vibración
        if (navigator.vibrate) {
            navigator.vibrate([100, 100, 100]);
        }
    }

    /**
     * Mostrar error específico
     */
    showError(errorId, message) {
        const errorElement = document.getElementById(errorId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    /**
     * Limpiar error específico
     */
    clearError(errorId) {
        const errorElement = document.getElementById(errorId);
        if (errorElement) {
            errorElement.style.display = 'none';
            errorElement.textContent = '';
        }
    }

    /**
     * Limpiar todos los errores
     */
    clearAllErrors() {
        this.clearError('nameError');
        this.clearError('lastNameError');
        this.clearError('emailError');
    }

    /**
     * Obtener datos del formulario
     */
    getFormData() {
        return {
            name: this.elements.nameInput.value.trim(),
            lastName: this.elements.lastNameInput.value.trim(),
            email: this.elements.emailInput.value.trim().toLowerCase()
        };
    }

    /**
     * Estado de envío
     */
    setSubmittingState(isSubmitting) {
        this.state.isSubmitting = isSubmitting;
        
        const btnText = this.elements.submitButton.querySelector('.btn-text');
        const btnSpinner = this.elements.submitButton.querySelector('.btn-spinner');
        
        if (isSubmitting) {
            btnText.style.display = 'none';
            btnSpinner.style.display = 'inline';
            this.elements.submitButton.disabled = true;
            this.elements.submitButton.classList.add('submitting');
        } else {
            btnText.style.display = 'inline';
            btnSpinner.style.display = 'none';
            this.elements.submitButton.disabled = false;
            this.elements.submitButton.classList.remove('submitting');
        }
    }

    /**
     * Mensaje de no poder cerrar
     */
    showCantCloseMessage() {
        this.messageManager?.info('⚠️ Debes completar el registro para continuar');
        
        // Efecto shake
        this.elements.overlay.classList.add('shake');
        setTimeout(() => {
            this.elements.overlay.classList.remove('shake');
        }, 500);
    }

    /**
     * Configurar callback de éxito
     */
    setOnRegistrationSuccess(callback) {
        this.onRegistrationSuccess = callback;
    }

    /**
     * Obtener datos del jugador
     */
    getPlayerData() {
        return this.state.playerData;
    }

    /**
     * Verificar si está registrado
     */
    isRegistered() {
        return !!this.state.playerData;
    }

    /**
     * Limpiar formulario (reset)
     */
    reset() {
        this.elements.form.reset();
        this.clearAllErrors();
        this.state.playerData = null;
        this.setSubmittingState(false);
    }

    /**
     * Destruir manager
     */
    destroy() {
        this.hide();
        this.onRegistrationSuccess = null;        
    }
}
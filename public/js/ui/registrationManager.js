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

        // 🆕 SETUP MEJORADO DE EVENT LISTENERS
        this.setupFormEventListeners();
        this.setupOverlayEventListeners();
    }

    setupOverlayEventListeners() {
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
        
        console.log('👁️ Mostrando formulario de registro...');
        
        // 🆕 RESETEAR ESTADO ANTES DE MOSTRAR
        this.resetFormState();
        
        // Mostrar overlay
        this.elements.overlay.classList.add('show');
        this.state.isVisible = true;
        
        // Focus diferente para PWA vs Browser
        if (this.state.isPWA) {
            // En PWA, no hacer focus automático - esperar tap del usuario
            console.log('📱 PWA detectada, sin focus automático');
        } else {
            // En browser normal, focus automático
            setTimeout(() => {
                this.elements.nameInput.focus();
            }, 350);
        }
    }
    /**
    * Mostrar formulario con error específico de email
    */
    showWithEmailError(errorMessage) {
        console.log('🔄 Mostrando formulario con error de email:', errorMessage);
        
        // Mostrar el modal normal
        this.show();
        
        // 🆕 RESETEAR COMPLETAMENTE EL ESTADO DEL FORMULARIO
        setTimeout(() => {
            console.log('🔧 Reseteando estado del formulario...');

            // 1. Resetear estado interno
            this.state.isSubmitting = false;

            // 2. Obtener elementos del DOM
            const form = this.elements.form;
            const submitBtn = this.elements.submitButton;
            const emailInput = this.elements.emailInput;
            const emailError = document.getElementById('emailError');

            // 3. 🆕 RESETEAR FORMULARIO COMPLETAMENTE
            if (form) {
                form.classList.remove('submitting');
                // NO hacer form.reset() para mantener los datos ya ingresados
            }

            // 4. 🆕 RESETEAR BOTÓN DE SUBMIT
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('submitting');

                const btnText = submitBtn.querySelector('.btn-text');
                const btnSpinner = submitBtn.querySelector('.btn-spinner');

                if (btnText) btnText.style.display = 'inline';
                if (btnSpinner) btnSpinner.style.display = 'none';

                console.log('✅ Botón de submit reseteado');
            }

            // 5. 🆕 MOSTRAR ERROR EN CAMPO EMAIL Y FOCUS
            if (emailInput && emailError) {
                emailInput.classList.add('error');
                emailError.textContent = errorMessage;
                emailError.style.display = 'block';

                // Focus en el campo email para que el usuario pueda corregir
                setTimeout(() => {
                    emailInput.focus();
                    emailInput.select(); // Seleccionar todo el texto para fácil corrección
                }, 100);

                // 🆕 LIMPIAR ERROR AL EMPEZAR A ESCRIBIR
                const clearErrorHandler = () => {
                    emailInput.classList.remove('error');
                    emailError.style.display = 'none';
                    emailInput.removeEventListener('input', clearErrorHandler);
                };

                emailInput.addEventListener('input', clearErrorHandler);
            }

            // 6. 🆕 VERIFICAR QUE EL FORM PUEDA ENVIARSE
            this.ensureFormCanSubmit();

        }, 100);
    }

    ensureFormCanSubmit() {
        console.log('🔍 Verificando que el formulario puede enviarse...');
        
        const form = this.elements.form;
        const submitBtn = this.elements.submitButton;
        
        if (form && submitBtn) {
            // Verificar que el botón no esté deshabilitado
            if (submitBtn.disabled) {
                console.log('⚠️ Botón estaba deshabilitado, habilitándolo...');
                submitBtn.disabled = false;
            }

            // Verificar que el estado interno sea correcto
            if (this.state.isSubmitting) {
                console.log('⚠️ Estado interno era "submitting", corrigiéndolo...');
                this.state.isSubmitting = false;
            }

            // 🆕 VERIFICAR EVENT LISTENERS
            // Clonar el form para asegurar event listeners limpios
            const newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);
            this.elements.form = newForm;

            // Reconfigurar event listeners
            this.setupFormEventListeners();

            console.log('✅ Formulario listo para re-submit');
        }
    }

    setupFormEventListeners() {
        // Submit del formulario
        this.elements.form.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('📝 Form submit interceptado');
            this.handleSubmit();
        });
        
        // Obtener elementos actualizados
        this.elements.nameInput = this.elements.form.querySelector('#playerName');
        this.elements.lastNameInput = this.elements.form.querySelector('#playerLastName');
        this.elements.emailInput = this.elements.form.querySelector('#playerEmail');
        this.elements.submitButton = this.elements.form.querySelector('#submitRegistration');
        
        // Validación en tiempo real
        this.elements.nameInput?.addEventListener('input', () => {
            this.clearError('nameError');
        });
        
        this.elements.lastNameInput?.addEventListener('input', () => {
            this.clearError('lastNameError');
        });
        
        this.elements.emailInput?.addEventListener('input', () => {
            this.clearError('emailError');
        });
        
        // 🆕 PWA-specific touch handlers si es necesario
        if (this.state.isPWA) {
            this.setupPWAInputHandlers();
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
        console.log('🚀 Iniciando handleSubmit...');
        
        if (this.state.isSubmitting) {
            console.log('⚠️ Ya está en proceso de submit, ignorando...');
            return;
        }

        console.log('✅ Procediendo con submit...');

        // Validar
        const validation = this.validateForm();
        if (!validation.isValid) {
            console.log('❌ Validación falló:', validation.errors);
            this.showValidationErrors(validation.errors);
            return;
        }

        // Obtener datos
        const formData = this.getFormData();
        console.log('📄 Datos del formulario:', formData);

        // Estado de carga
        this.setSubmittingState(true);

        try {
            // Guardar datos
            this.state.playerData = formData;

            console.log('✅ Datos guardados localmente');

            // Callback
            if (this.onRegistrationSuccess) {
                this.onRegistrationSuccess(formData);
            }

            // Ocultar formulario
            this.hide();

        } catch (error) {
            console.error('❌ Error en handleSubmit:', error);
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
        console.log(`🔄 Cambiando estado submitting a: ${isSubmitting}`);
        
        this.state.isSubmitting = isSubmitting;
        
        const submitBtn = this.elements.submitButton;
        if (!submitBtn) {
            console.error('❌ No se encontró el botón de submit');
            return;
        }

        const btnText = submitBtn.querySelector('.btn-text');
        const btnSpinner = submitBtn.querySelector('.btn-spinner');

        if (isSubmitting) {
            console.log('⏳ Activando estado de carga...');
            if (btnText) btnText.style.display = 'none';
            if (btnSpinner) btnSpinner.style.display = 'inline';
            submitBtn.disabled = true;
            submitBtn.classList.add('submitting');
        } else {
            console.log('✅ Desactivando estado de carga...');
            if (btnText) btnText.style.display = 'inline';
            if (btnSpinner) btnSpinner.style.display = 'none';
            submitBtn.disabled = false;
            submitBtn.classList.remove('submitting');
        }
    }

    resetFormState() {
        
        // Resetear estado interno
        this.state.isSubmitting = false;
        this.state.playerData = null;
        
        // Limpiar errores
        this.clearAllErrors();
        
        // Resetear botón
        this.setSubmittingState(false);
        
        // Asegurar que puede enviarse
        this.ensureFormCanSubmit();
        
        console.log('✅ Estado del formulario reseteado');
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
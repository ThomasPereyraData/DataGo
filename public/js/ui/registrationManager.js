// public/js/ui/RegistrationManager.js - FIXED PARA PWA iOS
export class RegistrationManager {
    constructor(messageManager = null) {
        this.messageManager = messageManager;
        
        // Estado
        this.state = {
            isVisible: false,
            isSubmitting: false,
            playerData: null,
            isPWA: window.navigator.standalone === true, // Detectar PWA
            currentStep: 'registration'
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
        console.log('verificando si es visible el form', this.state.isVisible)
        
        // Focus diferente para PWA vs Browser
        if (this.state.isPWA) {
            setTimeout(() => {
                this.elements.nameInput.focus();
            }, 350);
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
                if(errorMessage.includes('eventos activos')) {
                    emailError.textContent = 'No hay eventos activos. Disfruta de las charlas, enseguida volvemos'
                }
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

    resetToRegistrationWithError(errorMessage) {
        console.log('🔄 Volviendo a registro desde paso:', this.state.currentStep);
        
        // 1. Resetear paso
        this.state.currentStep = 'registration';

        //1.1 resetear estado de submitting
        this.state.isSubmitting = false;
        
        // 2. Asegurar que el modal esté visible
        if (!this.state.isVisible) {
            this.elements.overlay.classList.add('show');
            this.state.isVisible = true;
        }
        
        // 3. Recrear formulario de registro
        this.renderRegistrationFormHTML();
        
        // 4. Esperar a que el DOM se actualice y LUEGO mostrar error
        setTimeout(() => {
            // Verificar que el elemento existe antes de mostrar error
            const emailError = document.getElementById('emailError');
            const emailInput = document.getElementById('playerEmail');
            
            if (emailError && emailInput) {
                if(errorMessage.includes('eventos activos')) {
                    emailError.textContent = 'No hay eventos activos. Disfruta de las charlas, enseguida volvemos';
                } else {
                    emailError.textContent = errorMessage;
                }
                emailError.style.display = 'block';
                emailInput.classList.add('error');
                
                // Focus solo si el elemento existe
                setTimeout(() => {
                    emailInput.focus();
                    emailInput.select();
                }, 50);
            } else {
                console.error('❌ No se encontraron elementos de email');
            }
            const submitBtn = document.getElementById('submitRegistration');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('submitting');
            
            const btnText = submitBtn.querySelector('.btn-text');
            const btnSpinner = submitBtn.querySelector('.btn-spinner');
            if (btnText) btnText.style.display = 'inline';
            if (btnSpinner) btnSpinner.style.display = 'none';
        }
        }, 200); // Más tiempo para que el DOM se actualice

        
    }

    // 🆕 FUNCIÓN HELPER - Recrear HTML del formulario de registro
    renderRegistrationFormHTML() {
        const form = this.elements.form;
        if (!form) return;

        form.innerHTML = `
            <div class="form-header">
                <h2>📝 Registro DataGo</h2>
                <p>Completa tus datos para comenzar</p>
            </div>

            <div class="form-body">
                <div class="form-group">
                    <label for="playerName">Nombre</label>
                    <input type="text" id="playerName" name="name" placeholder="Tu nombre" required>
                    <div class="error-message" id="nameError"></div>
                </div>

                <div class="form-group">
                    <label for="playerLastName">Apellido</label>
                    <input type="text" id="playerLastName" name="lastName" placeholder="Tu apellido" required>
                    <div class="error-message" id="lastNameError"></div>
                </div>

                <div class="form-group">
                    <label for="playerEmail">Email</label>
                    <input type="email" id="playerEmail" name="email" placeholder="tu@email.com" required>
                    <div class="error-message" id="emailError"></div>
                </div>
            </div>

            <div class="form-footer">
                <button type="submit" class="submit-btn" id="submitRegistration">
                    <span class="btn-text">✅ Completar Registro</span>
                    <span class="btn-spinner" style="display: none;">⏳</span>
                </button>
                <p class="form-note">* Todos los campos son obligatorios</p>
            </div>
        `;

        // Reconfigurar event listeners
        this.setupFormEventListeners();
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

        console.log('🐛 DEBUG: setupFormEventListeners ejecutándose, paso actual:', this.state.currentStep);

        // 🆕 CRITICAL: Remover listeners anteriores para evitar duplicados
        const newForm = this.elements.form.cloneNode(true);
        this.elements.form.parentNode.replaceChild(newForm, this.elements.form);
        this.elements.form = newForm;

        // Submit del formulario
        this.elements.form.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('📝 Form submit interceptado - UNICO listener');
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
        console.log('🚪 Intentando cerrar modal. Estado actual:', this.state.isVisible);

        //if (!this.state.isVisible) return;
        console.log('🚪 Procediendo a cerrar modal');
        
        this.elements.overlay.classList.remove('show');
        this.elements.overlay.classList.add('hide');

        // 🆕 TAMBIÉN forzar display none como backup
        setTimeout(() => {
            this.elements.overlay.style.display = 'none';
        }, 300);
        
        this.state.isVisible = false;
        console.log('🚪 Modal cerrado. Nuevo estado:', this.state.isVisible);


        this.restoreExternalButtons();
    }

    forceHide() {
        console.log('🚪 Forzando cierre del modal');
        
        // Forzar clase CSS sin verificar estado
        this.elements.overlay.classList.remove('show');
        this.elements.overlay.classList.add('hide'); // Si tienes esta clase
        
        // Actualizar estado
        this.state.isVisible = false;
        
        // También forzar display none como backup
        setTimeout(() => {
            this.elements.overlay.style.display = 'none';
        }, 300);
    }

    /**
     * Manejar envío del formulario
     */
    async handleSubmit() {
        console.log('🚀 Iniciando handleSubmit...');
        console.log('isVisible desde handleSubmit: ', this.state.isVisible);

        if (this.state.isSubmitting) {
            console.log('⚠️ Ya está en proceso de submit, ignorando...');
            return;
        }

        // 🆕 NUEVO GUARD: Solo procesar si está en paso de registro
        if (this.state.currentStep !== 'registration') {
            console.log('⚠️ No estamos en paso de registro, ignorando submit...');
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

            // siguiente paso en vez de cerrar
            this.state.currentStep = 'permissions'
            this.showPermissionsStep()

            // Callback
            if (this.onRegistrationSuccess) {
                this.onRegistrationSuccess(formData);
            }

            // Ocultar formulario
            //this.hide();

        } catch (error) {
            console.error('❌ Error en handleSubmit:', error);
            this.messageManager?.error('Error en registro de usuario');
            this.setSubmittingState(false);
        }
    }

    // Nueva función después de handleSubmit()
    showPermissionsStep() {
        console.log('📱 Mostrando paso de permisos');
        
        const form = this.elements.form;
        if (!form) return;

        // 🆕 Detectar qué botones mostrar
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const gameClient = this.getGameClient();

        // Transformar el contenido del modal
        form.innerHTML = `
            <div class="permissions-step">
                <div class="form-header">
                    <h2>¡Registrado! 🎉</h2>
                    <p>Configuremos tu dispositivo para jugar</p>
                </div>

                <div class="form-body">
                    <div class="permissions-list">
                        <button  type=button id="modalCameraBtn" class="permission-btn">
                            📱 Activar Cámara
                        </button>

                        ${isIOS && !gameClient?.iosPermissions?.granted ? `
                            <button id="modalSensorsBtn" type=button class="permission-btn">
                                🔄 Activar Sensores iOS
                            </button>
                        ` : ''}
                        
                        <button type=button id="modalStartGameBtn" class="submit-btn" disabled>
                            🎮 ¡Comenzar a Jugar!
                        </button>
                    </div>
                </div>
                        
                <div class="form-footer">
                    <p class="form-note">Activa los permisos necesarios para la mejor experiencia</p>
                </div>
            </div>
        `;

        // 🆕 CONFIGURAR EVENT LISTENERS
        this.setupPermissionEventListeners();
                        
        // 🆕 ACTUALIZAR ESTADOS INICIALES
        this.updatePermissionButtonStates();

        this.hideExternalButtons();
    }

    hideExternalButtons() {
        const gameClient = this.getGameClient();
        if (!gameClient) return;

        // Ocultar botones externos
        if (gameClient.elements.startCameraBtn) {
            gameClient.elements.startCameraBtn.style.display = 'none';
        }
        if (gameClient.elements.joinGameBtn) {
            gameClient.elements.joinGameBtn.style.display = 'none';
        }

        // También ocultar botón de sensores iOS si existe
        const iosBtn = document.getElementById('iosPermissionBtn');
        if (iosBtn) {
            iosBtn.style.display = 'none';
        }
    }

    restoreExternalButtons() {
        const gameClient = this.getGameClient();
        if (!gameClient) return;

        // 🎯 LÓGICA INTELIGENTE: Solo mostrar botones que falten
        
        // 1. Cámara: Solo mostrar si NO está activa
        if (gameClient.elements.startCameraBtn) {
            if (!gameClient.cameraManager?.isActive) {
                gameClient.elements.startCameraBtn.style.display = 'block';
            } else {
                gameClient.elements.startCameraBtn.style.display = 'none';
            }
        }

        // 2. Sensores iOS: Solo mostrar si es iOS Y no están activos
        const iosBtn = document.getElementById('iosPermissionBtn');
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

        if (isIOS && !gameClient.iosPermissions?.granted) {
            // Si el botón no existe, crearlo (porque el modal lo ocultó)
            if (!iosBtn) {
                gameClient.checkiOSPermissions(); // Recrear botón iOS
            } else {
                iosBtn.style.display = 'block';
            }
        }

        // 3. Jugar: Siempre mostrar (pero estado según permisos)
        if (gameClient.elements.joinGameBtn) {
            gameClient.elements.joinGameBtn.style.display = 'block';

            // Habilitar solo si tiene permisos necesarios
            const hasCamera = gameClient.cameraManager?.isActive;
            const hasConnection = gameClient.socketManager?.isConnected;

            gameClient.elements.joinGameBtn.disabled = !(hasCamera && hasConnection);
        }
    }        

    getGameClient() {
        return window.gameClient || window.dataGoApp?.gameClient;
    }

    setupPermissionEventListeners() {
        const cameraBtn = document.getElementById('modalCameraBtn');
        const sensorsBtn = document.getElementById('modalSensorsBtn');
        const startBtn = document.getElementById('modalStartGameBtn');
        
        const gameClient = this.getGameClient();
        if (!gameClient) {
            console.error('❌ GameClient no disponible');
            return;
        }

        // 🎯 REUTILIZAR: Botón de cámara
        if (cameraBtn) {
            cameraBtn.addEventListener('click', async () => {
                cameraBtn.textContent = '⏳ Activando...';
                cameraBtn.disabled = true;

                // Llamar función existente del GameClient
                await gameClient.handleStartCamera();

                // Actualizar estados después
                setTimeout(() => {
                    this.updatePermissionButtonStates();
                }, 500);
            });
        }

        // 🎯 REUTILIZAR: Botón de sensores iOS
        if (sensorsBtn) {
            sensorsBtn.addEventListener('click', async () => {
                sensorsBtn.textContent = '⏳ Solicitando...';
                sensorsBtn.disabled = true;

                // Llamar función existente del GameClient
                await gameClient.requestiOSPermissions();

                // Actualizar estados después
                setTimeout(() => {
                    this.updatePermissionButtonStates();
                }, 1000);
            });
        }

        // 🎯 REUTILIZAR: Botón de iniciar juego
        if (startBtn) {
            startBtn.addEventListener('click', async () => {
                console.log('🎮 Botón modal presionado - forzando cierre');

                // // Cerrar modal y llamar función existente
                // this.hide();

                // console.log('🎮 Modal forzadamente cerrado, iniciando juego...');

                // // Pequeño delay para que la animación de cierre se vea
                // setTimeout(() => {
                //     gameClient.proceedWithGameJoin();
                // }, 100);

                // 🆕 NO cerrar modal inmediatamente - esperar resultado
                try {
                    // Llamar al GameClient y esperar resultado
                    await gameClient.proceedWithGameJoin();

                    // 🆕 SOLO cerrar modal si todo salió bien
                    // (proceedWithGameJoin debería notificar éxito/error)

                } catch (error) {
                    console.error('❌ Error en proceso de juego:', error);
                    // No cerrar modal en caso de error
                }
            });
        }
    }



    updatePermissionButtonStates() {
        console.log('🔄 updatePermissionButtonStates ejecutándose');
        const gameClient = this.getGameClient();
        if (!gameClient) return;

        const cameraBtn = document.getElementById('modalCameraBtn');
            const sensorsBtn = document.getElementById('modalSensorsBtn');

        const startBtn = document.getElementById('modalStartGameBtn');

        // Actualizar botón de cámara
        if (cameraBtn) {
            if (gameClient.cameraManager?.isActive) {
                cameraBtn.textContent = '✅ Cámara Activa';
                cameraBtn.disabled = true;
                cameraBtn.style.background = 'rgba(48, 209, 88, 0.9)';
            } else {
                cameraBtn.textContent = '📱 Activar Cámara';
                cameraBtn.disabled = false;
            }
        }
        if (sensorsBtn) {
            if (gameClient.iosPermissions?.granted) {
                sensorsBtn.textContent = '✅ Sensores Activos';
                sensorsBtn.disabled = true;
                sensorsBtn.style.background = 'rgba(48, 209, 88, 0.9)';
            } else {
                sensorsBtn.textContent = '🔄 Activar Sensores iOS';
                sensorsBtn.disabled = false;
                sensorsBtn.style.background = '';
            }
        }

        if (startBtn) {
            const hasCamera = gameClient.cameraManager?.isActive;
            const hasConnection = gameClient.socketManager?.isConnected;
            const needsSensors = /iPad|iPhone|iPod/.test(navigator.userAgent);
            const hasSensors = !needsSensors || gameClient.iosPermissions?.granted;

            if (hasCamera && hasConnection && hasSensors) {
                startBtn.disabled = false;
                startBtn.style.background = 'linear-gradient(135deg, #30D158, #28B946)';
            } else {
                startBtn.disabled = true;
                startBtn.style.background = '';
            }
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
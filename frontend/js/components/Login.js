window.Login = {
    render(container, onLoginSuccess) {
        container.innerHTML = `
            <div class="min-h-screen bg-brand-dark flex flex-col md:flex-row font-sans text-white relative overflow-hidden">
                <!-- Background ambient lights -->
                <div class="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-brand-purple rounded-full mix-blend-screen filter blur-[150px] opacity-20"></div>
                <div class="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-brand-blue rounded-full mix-blend-screen filter blur-[150px] opacity-20"></div>

                <!-- Left side content -->
                <div class="flex-1 p-8 md:p-16 flex flex-col justify-center relative z-10">
                    <div class="max-w-2xl mx-auto w-full">
                        <div class="flex justify-center gap-4 mb-8">
                            <div class="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-xl font-bold float-animation" style="animation-delay: 0s;">1FN</div>
                            <div class="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-xl font-bold float-animation mt-[-20px]" style="animation-delay: 1s;">2FN</div>
                            <div class="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center text-xl font-bold float-animation" style="animation-delay: 2s;">3FN</div>
                        </div>
                        
                        <h1 class="text-4xl md:text-5xl font-extrabold text-center mb-8 leading-tight">
                            Aprende Normalización de Bases de Datos de <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Forma Interactiva</span>
                        </h1>
                        
                        <div class="flex flex-col items-center gap-4 mb-12 text-gray-300">
                            <div class="flex items-center gap-2"><i class="fas fa-check text-blue-400"></i> Domina la Normalización</div>
                            <div class="flex items-center gap-2"><i class="fas fa-check text-blue-400"></i> Diseña Bases de Datos Perfectas</div>
                            <div class="flex items-center gap-2"><i class="fas fa-check text-blue-400"></i> Aprende a Través del Juego</div>
                            <div class="flex items-center gap-2"><i class="fas fa-check text-blue-400"></i> Sé un Experto en BD</div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="glass-panel p-4 rounded-xl flex items-center gap-4 hover:bg-white/5 transition">
                                <div class="w-10 h-10 bg-pink-500/20 rounded-full flex items-center justify-center text-pink-500"><i class="fas fa-bullseye"></i></div>
                                <div class="text-sm font-medium">Quests Gamificadas</div>
                            </div>
                            <div class="glass-panel p-4 rounded-xl flex items-center gap-4 hover:bg-white/5 transition">
                                <div class="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-500"><i class="fas fa-chart-bar"></i></div>
                                <div class="text-sm font-medium">Visualización en Tiempo Real</div>
                            </div>
                            <div class="glass-panel p-4 rounded-xl flex items-center gap-4 hover:bg-white/5 transition">
                                <div class="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-500"><i class="fas fa-trophy"></i></div>
                                <div class="text-sm font-medium">Ranking Global</div>
                            </div>
                            <div class="glass-panel p-4 rounded-xl flex items-center gap-4 hover:bg-white/5 transition">
                                <div class="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-500"><i class="fas fa-lightbulb"></i></div>
                                <div class="text-sm font-medium">Mentoría Inteligente</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right side login form -->
                <div class="w-full md:w-[450px] p-8 flex flex-col justify-center items-center bg-brand-dark/50 border-l border-white/5 backdrop-blur-sm z-10 relative">
                    <div class="w-full max-w-sm">
                        <div class="flex justify-center mb-6">
                            <div class="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-purple-500/30">
                                <i class="fas fa-graduation-cap text-white"></i>
                            </div>
                        </div>
                        <h2 class="text-3xl font-bold text-center mb-2">DataQuest</h2>
                        <p class="text-gray-400 text-center text-sm mb-8">Tu camino a dominar la Normalización</p>
                        
                        <div class="space-y-4">
                            <div>
                                <label class="block text-xs font-medium text-gray-400 mb-1">Correo Electrónico</label>
                                <div class="relative">
                                    <i class="fas fa-envelope absolute left-3 top-3 text-gray-500"></i>
                                    <input id="loginEmail" type="email" placeholder="tu@email.com" class="w-full bg-brand-card border border-gray-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition">
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-400 mb-1">Contraseña</label>
                                <div class="relative">
                                    <i class="fas fa-lock absolute left-3 top-3 text-gray-500"></i>
                                    <input id="loginPassword" type="password" placeholder="••••••••" class="w-full bg-brand-card border border-gray-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition">
                                </div>
                            </div>
                            <button id="btnIniciarSesion" class="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition shadow-lg shadow-purple-500/25 mt-2">
                                <i class="fas fa-sign-in-alt"></i> Iniciar Sesión
                            </button>
                        </div>
                        
                        <div class="flex items-center my-6">
                            <div class="flex-grow border-t border-gray-700"></div>
                            <span class="px-3 text-gray-500 text-xs">O</span>
                            <div class="flex-grow border-t border-gray-700"></div>
                        </div>
                        
                        <button id="btnInvitado" class="w-full bg-brand-card hover:bg-gray-800 border border-gray-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition">
                            <i class="fas fa-user-friends"></i> Continuar como Invitado
                        </button>
                        
                        <p class="text-center text-sm text-gray-400 mt-8">
                            ¿No tienes cuenta? <a href="#" id="btnRegister" class="text-brand-blue hover:text-blue-400 font-medium">Regístrate aquí</a>
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- Modal de registro rápido (oculto por defecto) -->
            <div id="registerModal" class="hidden fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50">
                <div class="bg-brand-card border border-gray-700 rounded-2xl p-8 w-full max-w-md relative">
                    <button id="closeRegister" class="absolute top-4 right-4 text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
                    <h2 class="text-2xl font-bold text-white mb-6 text-center">Crear Cuenta</h2>
                    <div class="space-y-4">
                        <input id="regEmail" type="email" placeholder="Correo" class="w-full bg-brand-dark border border-gray-700 rounded-lg p-3 text-white">
                        <input id="regApodo" type="text" placeholder="Apodo" class="w-full bg-brand-dark border border-gray-700 rounded-lg p-3 text-white">
                        <input id="regPassword" type="password" placeholder="Contraseña" class="w-full bg-brand-dark border border-gray-700 rounded-lg p-3 text-white">
                        <button id="submitRegister" class="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium py-3 rounded-lg mt-2">Registrarse</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btnIniciarSesion').addEventListener('click', async () => {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            if (!email || !password) return alert('Por favor llena los campos');
            
            const btn = document.getElementById('btnIniciarSesion');
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando...';
            
            try {
                const res = await Auth.login(email, password);
                if (res.success) onLoginSuccess();
                else alert(res.error);
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        });

        document.getElementById('btnInvitado').addEventListener('click', async () => {
            const btn = document.getElementById('btnInvitado');
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
            
            try {
                const res = await Auth.guest();
                if (res.success) {
                    onLoginSuccess();
                } else {
                    alert('Error al entrar como invitado: ' + res.error);
                }
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        });

        const regModal = document.getElementById('registerModal');
        document.getElementById('btnRegister').addEventListener('click', (e) => {
            e.preventDefault();
            regModal.classList.remove('hidden');
        });
        document.getElementById('closeRegister').addEventListener('click', () => {
            regModal.classList.add('hidden');
        });
        
        document.getElementById('submitRegister').addEventListener('click', async () => {
            const correo = document.getElementById('regEmail').value;
            const apodo = document.getElementById('regApodo').value;
            const pass = document.getElementById('regPassword').value;
            if (!correo || !apodo || !pass) return alert('Llena todos los campos');
            
            const btn = document.getElementById('submitRegister');
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';
            
            try {
                const res = await Auth.register(correo, apodo, pass);
                if (res.success) {
                    onLoginSuccess();
                } else {
                    alert(res.error);
                }
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        });
    }
};

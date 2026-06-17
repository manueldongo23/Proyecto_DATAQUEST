window.Navbar = {
    render(container, activeTab, user, onSelect, onLogout) {
        const menuItems = [
            { id: 'dashboard', label: 'Dashboard', icon: 'fa-th-large' },
            { id: 'validador', label: 'Normalización', icon: 'fa-wand-magic-sparkles' },
            { id: 'dataquest', label: 'DataQuest', icon: 'fa-book-open' },
            { id: 'puzzles', label: 'Juegos y Retos', icon: 'fa-gamepad' },
            { id: 'puntuaciones', label: 'Puntuaciones', icon: 'fa-trophy' }
        ];

        if (user && user.role === 'administrador') {
            menuItems.push({ id: 'admin', label: 'Admin Panel', icon: 'fa-user-shield' });
        }

        container.innerHTML = `
            <div class="h-screen w-64 bg-brand-sidebar text-gray-400 flex flex-col border-r border-white/5">
                <!-- Logo -->
                <div class="p-6 flex items-center gap-3">
                    <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                        <i class="fas fa-graduation-cap text-xl"></i>
                    </div>
                    <div>
                        <h1 class="text-white font-bold text-lg leading-tight">DataQuest</h1>
                        <p class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Normalization Lab</p>
                    </div>
                </div>

                <!-- Search -->
                <div class="px-4 mb-6">
                    <div class="relative group">
                        <i class="fas fa-search absolute left-3 top-3 text-gray-600 group-focus-within:text-brand-purple transition"></i>
                        <input type="text" placeholder="Buscar..." class="w-full bg-brand-card/50 border border-gray-800 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-purple/50 transition">
                    </div>
                </div>

                <!-- Navigation -->
                <div class="flex-1 px-3 space-y-1 overflow-y-auto hide-scrollbar">
                    <p class="px-3 text-[10px] text-gray-600 uppercase font-bold tracking-widest mb-2">Menú Principal</p>
                    ${menuItems.map(item => `
                        <button data-tab="${item.id}" class="sidebar-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl transition group ${activeTab === item.id ? 'bg-brand-purple/10 text-white border-r-4 border-brand-purple shadow-sm' : 'hover:bg-white/5 hover:text-gray-200'}">
                            <i class="fas ${item.icon} ${activeTab === item.id ? 'text-brand-purple' : 'text-gray-500 group-hover:text-gray-300'}"></i>
                            <span class="text-sm font-medium">${item.label}</span>
                        </button>
                    `).join('')}
                </div>

                <!-- User Profile -->
                <div class="p-4 mt-auto border-t border-white/5 bg-brand-dark/30">
                    <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition group cursor-pointer relative">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold shadow-md">
                            ${user.apodo.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1 overflow-hidden">
                            <p class="text-white text-sm font-bold truncate">${user.apodo}</p>
                            <p class="text-[10px] text-gray-500 truncate capitalize">● ${user.role || 'Estudiante'}</p>
                        </div>
                        <button id="logoutBtn" class="text-gray-600 hover:text-red-400 transition" title="Cerrar Sesión">
                            <i class="fas fa-gear"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.querySelectorAll('.sidebar-btn').forEach(btn => {
            btn.addEventListener('click', () => onSelect(btn.dataset.tab));
        });

        document.getElementById('logoutBtn')?.addEventListener('click', async () => {
            if (confirm('¿Cerrar sesión?')) {
                await Auth.logout();
                location.reload();
            }
        });
    }
};
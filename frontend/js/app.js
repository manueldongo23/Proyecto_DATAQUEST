window.App = {
    currentTab: 'validador',
    user: null,
    async init() {
        try {
            if (window.DB_ERROR) {
                document.getElementById('app').innerHTML = `
                    <div class="max-w-4xl mx-auto mt-10 p-6">
                        <div class="bg-red-50 border-2 border-red-200 rounded-lg p-6">
                            <h1 class="text-2xl font-bold text-red-700 mb-4">⚠️ Error de Configuración</h1>
                            <p class="text-red-600 mb-4">La base de datos no está configurada correctamente.</p>
                            <p class="text-red-500 font-mono mb-4">Error: ${window.DB_ERROR.error}</p>
                            <a href="./setup.php" class="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700">Ir a Setup</a>
                        </div>
                    </div>
                `;
                return;
            }

            const appDiv = document.getElementById('app');
            const auth = await Auth.me();
            this.user = auth.authenticated ? auth.user : null;

            if (!this.user) {
                // Not authenticated -> show Login
                Login.render(appDiv, () => location.reload());
                return;
            }

            // Authenticated -> show Main Layout (Sidebar + Content)
            appDiv.innerHTML = `
                <div class="flex h-screen bg-gray-50 overflow-hidden">
                    <!-- Sidebar -->
                    <div id="sidebarContainer" class="w-64 flex-shrink-0"></div>
                    <!-- Main Content -->
                    <div class="flex-1 flex flex-col h-full overflow-hidden">
                        <!-- Top header area if needed -->
                        <div id="topbarContainer" class="h-16 flex items-center justify-between px-8 bg-white border-b border-gray-100 flex-shrink-0">
                            <h2 id="pageTitle" class="text-xl font-bold text-gray-800">Motor de Normalización</h2>
                            <div id="topbarRight"></div>
                        </div>
                        <!-- Content Area -->
                        <div id="contentContainer" class="flex-1 overflow-auto p-8 hide-scrollbar"></div>
                    </div>
                </div>
            `;

            const sidebarContainer = document.getElementById('sidebarContainer');
            const contentContainer = document.getElementById('contentContainer');
            const pageTitle = document.getElementById('pageTitle');

            const loadTab = async (tab) => {
                const titles = {
                    'dashboard': 'Dashboard',
                    'validador': 'Motor de Normalización',
                    'dataquest': 'DataQuest: El Camino del Maestro',
                    'puzzles': 'Juegos y Retos de Aprendizaje',
                    'puntuaciones': 'Salón de la Fama',
                    'admin': 'Panel de Administración'
                };
                pageTitle.innerText = titles[tab] || 'DataQuest';
                contentContainer.innerHTML = ''; // clear

                if (tab === 'dashboard') contentContainer.innerHTML = '<p>Dashboard Próximamente...</p>'; // placeholder
                else if (tab === 'validador') await Validador.render(contentContainer);
                else if (tab === 'dataquest') await Puzzles.renderDataQuest(contentContainer); // to be implemented
                else if (tab === 'puzzles') await Retos.render(contentContainer); // We'll merge Puzzles/Retos UI
                else if (tab === 'puntuaciones') {
                    if(window.Puntuaciones) await Puntuaciones.render(contentContainer);
                    else contentContainer.innerHTML = '<p>Puntuaciones Próximamente...</p>';
                }
                else if (tab === 'admin' && this.user?.role === 'administrador') await AdminPanel.render(contentContainer);
            };
            
            const renderNavbar = () => {
                Navbar.render(sidebarContainer, this.currentTab, this.user, async (newTab) => {
                    this.currentTab = newTab;
                    renderNavbar();
                    await loadTab(newTab);
                }, async () => {
                    await Auth.logout();
                });
            };

            renderNavbar();
            await loadTab(this.currentTab);

        } catch (error) {
            console.error('Error:', error);
            document.getElementById('app').innerHTML = `<p class="p-8 text-red-500">Error: ${error.message}</p>`;
        }
    }
};

// Ejecutar con un pequeño delay para asegurar que el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}
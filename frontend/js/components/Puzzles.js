window.Puzzles = {
    async render(container) {
        this.renderDataQuest(container);
    },

    async renderDataQuest(container) {
        const res = await API.get('learning-path/progress');
        if (!res.success) {
            container.innerHTML = `<div class="p-8 text-center text-red-500">Error: ${res.error}</div>`;
            return;
        }
        const missions = res.missions;

        container.innerHTML = `
            <div class="max-w-4xl mx-auto space-y-6">
                <div class="flex items-center gap-4 mb-8">
                    <div class="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-sm">
                        <i class="fas fa-map"></i>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold text-gray-800">DataQuest: El Camino del Maestro</h2>
                        <p class="text-sm text-gray-500">Completa misiones para dominar el arte de la normalización.</p>
                    </div>
                </div>

                <div class="relative space-y-8 before:absolute before:inset-0 before:ml-8 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                    ${missions.map(m => `
                        <div class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <!-- Icon -->
                            <div class="flex items-center justify-center w-16 h-16 rounded-full border border-white shadow-xl shadow-indigo-500/10 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition duration-500 
                                ${m.status === 'completed' ? 'bg-emerald-500 text-white' : m.status === 'current' ? 'bg-brand-purple text-white scale-110 shadow-purple-500/30' : 'bg-gray-100 text-gray-400'}">
                                ${m.status === 'completed' ? '<i class="fas fa-check"></i>' : m.status === 'locked' ? '<i class="fas fa-lock"></i>' : `<span class="font-black">${m.level_number}</span>`}
                            </div>
                            <!-- Card -->
                            <div class="w-[calc(100%-5rem)] md:w-[calc(50%-4rem)] bg-white p-6 rounded-3xl border ${m.status === 'current' ? 'border-brand-purple shadow-md' : 'border-gray-100 shadow-sm'} transition hover:shadow-md">
                                <div class="flex items-center justify-between mb-2">
                                    <h3 class="font-bold ${m.status === 'locked' ? 'text-gray-400' : 'text-gray-800'}">${m.title}</h3>
                                    <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md border 
                                        ${m.difficulty === 'Fácil' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                          m.difficulty === 'Medio' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                                          m.difficulty === 'Difícil' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-pink-50 text-pink-600 border-pink-100'}">
                                        ${m.difficulty}
                                    </span>
                                </div>
                                <p class="text-xs ${m.status === 'locked' ? 'text-gray-400' : 'text-gray-500'} leading-relaxed mb-6">${m.desc}</p>
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-1.5">
                                        <div class="flex gap-0.5 text-[10px]">
                                            ${[1,2,3].map(s => `<i class="fas fa-star ${s <= m.stars ? 'text-amber-400' : 'text-gray-200'}"></i>`).join('')}
                                        </div>
                                        <span class="text-xs font-bold ${m.status === 'completed' ? 'text-emerald-500' : 'text-gray-700'}">${m.xp} XP</span>
                                    </div>
                                    <button onclick='Puzzles.playMission(${JSON.stringify(m).replace(/'/g, "&#39;")})' 
                                        class="px-6 py-2 rounded-xl text-xs font-bold transition
                                        ${m.status === 'completed' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 
                                          m.status === 'current' ? 'bg-brand-purple text-white shadow-lg shadow-purple-500/20 hover:scale-105' : 
                                          'bg-gray-50 text-gray-300 cursor-not-allowed'}"
                                        ${m.status === 'locked' ? 'disabled' : ''}>
                                        ${m.status === 'completed' ? 'Repetir' : m.status === 'current' ? 'Iniciar Misión' : 'Bloqueado'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Modal de Misión -->
            <div id="missionModal" class="hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 opacity-0 transition-opacity duration-300">
                <div class="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl transform scale-95 transition-transform duration-300" id="missionContent">
                    <!-- Contenido dinámico -->
                </div>
            </div>
        `;
    },

    playMission(mission) {
        window.currentHintsUsed = 0;
        window.currentHints = mission.hints || [];
        
        const modal = document.getElementById('missionModal');
        const content = document.getElementById('missionContent');
        
        content.innerHTML = `
            <div class="bg-brand-sidebar p-6 text-white border-b border-white/10 flex justify-between items-center">
                <div>
                    <h3 class="text-xl font-bold flex items-center gap-2"><i class="fas fa-scroll text-brand-purple"></i> Nivel ${mission.level_number}: ${mission.title}</h3>
                    <p class="text-xs text-gray-400 mt-1">${mission.desc}</p>
                </div>
                <button onclick="Puzzles.closeModal()" class="text-gray-400 hover:text-white transition"><i class="fas fa-times text-xl"></i></button>
            </div>
            <div class="p-6 bg-gray-50">
                <div class="mb-4">
                    <p class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Esquema Inicial</p>
                    <div class="bg-white p-3 rounded-xl border border-gray-200 font-mono text-sm text-gray-700">
                        ${mission.initial_schema.join('<br>')}
                    </div>
                </div>
                <div class="mb-4">
                    <div class="flex justify-between items-center mb-2">
                        <p class="text-xs font-bold text-gray-500 uppercase tracking-widest">Tu Solución (Formato JSON esperado)</p>
                        <button onclick="Puzzles.useHint()" id="btnUseHint" class="text-xs font-bold text-amber-500 hover:text-amber-600 transition flex items-center gap-1.5 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                            <i class="fas fa-lightbulb"></i> Usar pista
                        </button>
                    </div>
                    <textarea id="missionAnswer" rows="4" class="w-full border border-gray-300 rounded-xl p-3 text-sm font-mono focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition" placeholder='["TABLA1(id, attr)", "TABLA2(id, attr)"]'></textarea>
                </div>
                
                <div id="hintsContainer" class="mb-6 space-y-2"></div>
                
                <div id="missionResult" class="mb-4 hidden"></div>
                
                <div class="flex justify-end items-center">
                    <button id="btnSubmitMission" onclick="Puzzles.submitMission(${mission.id})" class="bg-gradient-to-r from-blue-600 to-brand-purple text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                        <i class="fas fa-paper-plane"></i> <span>Enviar Solución</span>
                    </button>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        // Pequeño delay para la animación
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            content.classList.remove('scale-95');
        }, 10);
    },

    closeModal() {
        const modal = document.getElementById('missionModal');
        const content = document.getElementById('missionContent');
        modal.classList.add('opacity-0');
        content.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    },

    useHint() {
        if (!window.currentHints || window.currentHintsUsed >= window.currentHints.length) {
            alert('No hay más pistas disponibles.');
            return;
        }
        
        const hintText = window.currentHints[window.currentHintsUsed];
        window.currentHintsUsed++;
        
        const container = document.getElementById('hintsContainer');
        const hintDiv = document.createElement('div');
        hintDiv.className = 'bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-lg text-sm text-amber-800 animate-in slide-in-from-left-4 duration-300';
        hintDiv.innerHTML = `<i class="fas fa-lightbulb mr-2"></i> <strong>Pista ${window.currentHintsUsed}:</strong> ${hintText}`;
        container.appendChild(hintDiv);
        
        if (window.currentHintsUsed >= window.currentHints.length) {
            const btn = document.getElementById('btnUseHint');
            btn.classList.add('opacity-50', 'cursor-not-allowed');
            btn.removeAttribute('onclick');
        }
    },

    async submitMission(levelId) {
        const answer = document.getElementById('missionAnswer').value;
        if (!answer) return;
        
        const btn = document.getElementById('btnSubmitMission');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Validando...</span>';
        
        try {
            const res = await API.post('learning-path/submit', { level_id: levelId, respuesta: answer, hints_used: window.currentHintsUsed });
            const resultDiv = document.getElementById('missionResult');
            resultDiv.classList.remove('hidden');
            
            if (res.success) {
                // Animación de éxito framer-motion style (escalado y brillo en CSS puro)
                resultDiv.innerHTML = `
                    <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center animate-in zoom-in duration-300">
                        <h4 class="text-emerald-600 font-black text-lg mb-2">¡Misión Cumplida!</h4>
                        <div class="flex justify-center gap-2 mb-2 text-2xl">
                            ${[1,2,3].map(s => `<i class="fas fa-star ${s <= res.stars ? 'text-amber-400 animate-bounce' : 'text-gray-300'}" style="animation-delay: ${s*100}ms"></i>`).join('')}
                        </div>
                        <p class="text-sm text-emerald-800 font-bold">+${res.score_earned} XP</p>
                        <button onclick="Puzzles.closeAndReload()" class="mt-4 bg-emerald-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow hover:bg-emerald-600 transition">Continuar</button>
                    </div>
                `;
            } else {
                resultDiv.innerHTML = `
                    <div class="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm font-bold flex items-center gap-2">
                        <i class="fas fa-exclamation-circle"></i> ${res.error || 'Solución incorrecta. Revisa tus dependencias.'}
                    </div>
                `;
            }
        } catch (e) {
            console.error(e);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    },

    closeAndReload() {
        this.closeModal();
        setTimeout(() => {
            this.renderDataQuest(document.getElementById('contentContainer'));
        }, 300);
    }
};
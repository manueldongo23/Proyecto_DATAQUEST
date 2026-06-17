window.Retos = {
    async render(container) {
        const currentReto = await API.get('retos/current');
        const puzzles = await API.get('puzzles/list');
        
        container.innerHTML = `
            <div class="space-y-6">
                <!-- Header Stats -->
                <div class="flex justify-end gap-3 mb-8">
                    <div class="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 flex items-center gap-2">
                        <span class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Puzzles:</span>
                        <span class="text-sm font-black text-indigo-700">12/50</span>
                    </div>
                    <div class="bg-amber-50 px-4 py-2 rounded-xl border border-amber-100 flex items-center gap-2">
                        <span class="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Retos:</span>
                        <span class="text-sm font-black text-amber-700">2/5</span>
                    </div>
                </div>

                <!-- Grid of Activities -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <!-- Puzzle 1 -->
                    <div class="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition group">
                        <div class="h-32 bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-5xl text-white/50">
                            <i class="fas fa-puzzle-piece group-hover:scale-110 transition duration-500"></i>
                        </div>
                        <div class="p-6">
                            <div class="flex justify-between items-start mb-4">
                                <span class="bg-indigo-50 text-indigo-600 text-[10px] font-black px-2 py-1 rounded-md uppercase">Puzzle</span>
                                <div class="flex text-amber-400 text-[10px]">
                                    <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="far fa-star"></i><i class="far fa-star"></i>
                                </div>
                            </div>
                            <h3 class="font-bold text-gray-800 mb-2 truncate">El Caso del Estudiante Duplicado</h3>
                            <p class="text-xs text-gray-500 leading-relaxed mb-6 line-clamp-2">Resuelve este esquema para ganar recompensas únicas.</p>
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-1.5">
                                    <i class="fas fa-star text-amber-400 text-xs"></i>
                                    <span class="text-xs font-bold text-gray-700">50 XP</span>
                                </div>
                                <button class="bg-gray-900 text-white px-6 py-2 rounded-xl text-xs font-bold hover:bg-black transition">Jugar</button>
                            </div>
                        </div>
                    </div>

                    <!-- Puzzle 2 -->
                    <div class="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition group">
                        <div class="h-32 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-5xl text-white/50">
                            <i class="fas fa-puzzle-piece group-hover:scale-110 transition duration-500"></i>
                        </div>
                        <div class="p-6">
                            <div class="flex justify-between items-start mb-4">
                                <span class="bg-indigo-50 text-indigo-600 text-[10px] font-black px-2 py-1 rounded-md uppercase">Puzzle</span>
                                <div class="flex text-amber-400 text-[10px]">
                                    <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="far fa-star"></i>
                                </div>
                            </div>
                            <h3 class="font-bold text-gray-800 mb-2 truncate">Inventarios Infinitos</h3>
                            <p class="text-xs text-gray-500 leading-relaxed mb-6 line-clamp-2">Resuelve este esquema para ganar recompensas únicas.</p>
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-1.5">
                                    <i class="fas fa-star text-amber-400 text-xs"></i>
                                    <span class="text-xs font-bold text-gray-700">120 XP</span>
                                </div>
                                <button class="bg-gray-900 text-white px-6 py-2 rounded-xl text-xs font-bold hover:bg-black transition">Jugar</button>
                            </div>
                        </div>
                    </div>

                    <!-- Weekly Challenge -->
                    <div class="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition group border-2 border-amber-100">
                        <div class="h-32 bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-5xl text-white/50">
                            <i class="fas fa-trophy group-hover:scale-110 transition duration-500"></i>
                        </div>
                        <div class="p-6">
                            <div class="flex justify-between items-start mb-4">
                                <span class="bg-amber-50 text-amber-600 text-[10px] font-black px-2 py-1 rounded-md uppercase">Reto Semanal</span>
                                <div class="flex text-amber-400 text-[10px]">
                                    <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
                                </div>
                            </div>
                            <h3 class="font-bold text-gray-800 mb-2 truncate">Pedidos Fantasmas</h3>
                            <p class="text-xs text-gray-500 leading-relaxed mb-6 line-clamp-2">${currentReto ? currentReto.descripcion : 'Resuelve este esquema para ganar recompensas únicas.'}</p>
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-1.5">
                                    <i class="fas fa-star text-amber-400 text-xs"></i>
                                    <span class="text-xs font-bold text-gray-700">300 XP</span>
                                </div>
                                <button class="bg-gray-900 text-white px-6 py-2 rounded-xl text-xs font-bold hover:bg-black transition">Jugar</button>
                            </div>
                        </div>
                    </div>

                    <!-- Upcoming -->
                    <div class="bg-gray-50 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center p-8 text-center min-h-[250px]">
                        <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center text-gray-300 shadow-sm mb-4">
                            <i class="fas fa-lock"></i>
                        </div>
                        <h4 class="font-bold text-gray-400 text-sm mb-1">Próximamente</h4>
                        <p class="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Nuevos retos cada lunes</p>
                    </div>
                </div>
            </div>
        `;
    }
};
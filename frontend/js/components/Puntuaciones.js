window.Puntuaciones = {
    async render(container) {
        // En un caso real, esto vendría de la API
        const rankings = [
            { rank: 1, user: 'MasterSQL', title: 'MAESTRO SUPREMO', xp: 5420, medals: ['🥇', '🏆', '🎓'] },
            { rank: 2, user: 'DataWizard', title: 'ESTRATEGA', xp: 4850, medals: ['🥈', '🎓'] },
            { rank: 3, user: 'NormiHero', title: 'ESTRATEGA', xp: 4210, medals: ['🥉', '🛡️'] },
            { rank: 4, user: 'AdminUser', title: 'MODERADOR', xp: 3900, medals: ['🎓'] },
            { rank: 5, user: 'Student42', title: 'APRENDIZ', xp: 2150, medals: [] }
        ];

        container.innerHTML = `
            <div class="space-y-8">
                <!-- Top 3 Podium -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-8">
                    <!-- Rank 2 -->
                    <div class="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm text-center relative order-2 md:order-1 h-[280px] flex flex-col justify-center">
                        <div class="w-20 h-20 mx-auto bg-gray-200 rounded-full flex items-center justify-center text-3xl font-bold text-gray-500 mb-4 border-4 border-white shadow-lg">2</div>
                        <h3 class="font-bold text-xl text-gray-800">${rankings[1].user}</h3>
                        <p class="text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-4">${rankings[1].title}</p>
                        <div class="text-indigo-600 font-black text-2xl">${rankings[1].xp}</div>
                        <p class="text-[10px] text-gray-400 font-bold uppercase">XP Acumulado</p>
                    </div>

                    <!-- Rank 1 -->
                    <div class="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl text-center relative order-1 md:order-2 h-[340px] flex flex-col justify-center scale-105 z-10">
                        <div class="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center text-white shadow-lg shadow-yellow-400/30">
                            <i class="fas fa-crown"></i>
                        </div>
                        <div class="w-24 h-24 mx-auto bg-yellow-400 rounded-full flex items-center justify-center text-4xl font-bold text-white mb-4 border-4 border-white shadow-lg">1</div>
                        <h3 class="font-bold text-2xl text-gray-800">${rankings[0].user}</h3>
                        <p class="text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-4">${rankings[0].title}</p>
                        <div class="text-indigo-600 font-black text-3xl">${rankings[0].xp}</div>
                        <p class="text-[10px] text-gray-400 font-bold uppercase">XP Acumulado</p>
                        <div class="absolute top-4 right-4 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    </div>

                    <!-- Rank 3 -->
                    <div class="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm text-center relative order-3 h-[250px] flex flex-col justify-center">
                        <div class="w-16 h-16 mx-auto bg-amber-600/20 rounded-full flex items-center justify-center text-2xl font-bold text-amber-700 mb-4 border-4 border-white shadow-lg">3</div>
                        <h3 class="font-bold text-lg text-gray-800">${rankings[2].user}</h3>
                        <p class="text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-4">${rankings[2].title}</p>
                        <div class="text-indigo-600 font-black text-xl">${rankings[2].xp}</div>
                        <p class="text-[10px] text-gray-400 font-bold uppercase">XP Acumulado</p>
                        <div class="absolute top-4 right-4 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    </div>
                </div>

                <!-- Rankings Table -->
                <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <table class="w-full text-left">
                        <thead class="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th class="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rank</th>
                                <th class="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Usuario</th>
                                <th class="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Medallas</th>
                                <th class="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">XP Total</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50">
                            ${rankings.map(r => `
                                <tr class="hover:bg-gray-50 transition group">
                                    <td class="px-8 py-4 font-bold text-gray-400">#${r.rank}</td>
                                    <td class="px-8 py-4">
                                        <div class="flex items-center gap-3">
                                            <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 border border-gray-200">
                                                ${r.user.charAt(0)}
                                            </div>
                                            <span class="font-bold text-gray-700">${r.user}</span>
                                            ${r.rank < 4 ? '<div class="w-2 h-2 bg-green-500 rounded-full border border-white"></div>' : ''}
                                        </div>
                                    </td>
                                    <td class="px-8 py-4 text-center">
                                        <div class="flex justify-center gap-1">
                                            ${r.medals.map(m => `<span>${m}</span>`).join('')}
                                            ${r.medals.length === 0 ? '<span class="text-gray-300">—</span>' : ''}
                                        </div>
                                    </td>
                                    <td class="px-8 py-4 text-right font-black text-gray-800">${r.xp}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
};

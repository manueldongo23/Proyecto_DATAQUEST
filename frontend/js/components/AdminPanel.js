window.AdminPanel = {
    async render(container) {
        const puzzles = await API.get('admin/puzzles');
        const reto = await API.get('admin/reto');
        const logs = await API.get('admin/logs');
        let puzzlesHtml = puzzles.map(p => `
            <div class="border p-2 rounded flex justify-between items-center">
                <span><b>${p.id}</b> ${p.enunciado.substring(0,40)}</span>
                <div>
                    <button data-id="${p.id}" class="editPuzzle bg-blue-500 text-white px-2 py-1 rounded text-xs">Editar</button>
                    <button data-id="${p.id}" class="deletePuzzle bg-red-500 text-white px-2 py-1 rounded text-xs">Borrar</button>
                </div>
            </div>
        `).join('');
        let logsHtml = logs.map(l => `<div>[${l.fecha}] ${l.tipo} - ${l.mensaje} (${l.apodo || 'sistema'})</div>`).join('');
        container.innerHTML = `
            <div class="bg-white rounded-2xl shadow-lg p-6">
                <h2 class="text-2xl font-bold mb-4">🔧 Panel de Administración</h2>
                <div class="grid lg:grid-cols-3 gap-5">
                    <div class="col-span-2">
                        <h3 class="font-semibold">📋 Puzzles Existentes</h3>
                        <div id="adminPuzzlesList" class="space-y-2 max-h-96 overflow-y-auto border p-2 rounded">${puzzlesHtml}</div>
                        <div class="mt-4 p-3 bg-gray-100 rounded">
                            <input type="text" id="puzzleId" placeholder="ID (solo editar)" class="text-xs p-1 border w-full mb-1">
                            <textarea id="puzzleEnunciado" placeholder="Enunciado" rows="2" class="w-full border p-1 mb-1"></textarea>
                            <input type="text" id="puzzleTablas" placeholder="Tablas inicial (JSON array)" class="w-full border p-1 mb-1">
                            <input type="text" id="puzzleDFs" placeholder="DFs (JSON array)" class="w-full border p-1 mb-1">
                            <input type="text" id="puzzleSolucion" placeholder="Solución esperada (JSON)" class="w-full border p-1 mb-1">
                            <input type="number" id="puzzleDificultad" placeholder="Dificultad" class="w-full border p-1 mb-1">
                            <div class="flex gap-2">
                                <button id="addPuzzle" class="bg-green-600 text-white px-3 py-1 rounded">Agregar</button>
                                <button id="updatePuzzle" class="bg-blue-600 text-white px-3 py-1 rounded">Actualizar</button>
                                <button id="clearForm" class="bg-gray-400 text-white px-3 py-1 rounded">Limpiar</button>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 class="font-semibold">📅 Reto Semanal</h3>
                        <textarea id="retoDesc" rows="2" class="w-full border p-2 text-sm">${reto ? reto.descripcion : ''}</textarea>
                        <input type="text" id="retoTablas" value='${reto ? JSON.stringify(JSON.parse(reto.tablas)) : ''}' class="w-full border p-2 mt-2 text-sm">
                        <input type="text" id="retoDFs" value='${reto ? JSON.stringify(JSON.parse(reto.df)) : ''}' class="w-full border p-2 mt-2 text-sm">
                        <input type="date" id="retoFechaInicio" value="${reto ? reto.fecha_inicio : ''}" class="w-full border p-2 mt-2">
                        <input type="date" id="retoFechaFin" value="${reto ? reto.fecha_fin : ''}" class="w-full border p-2 mt-2">
                        <button id="saveReto" class="bg-purple-600 text-white w-full py-2 mt-3 rounded">Guardar Reto</button>
                        <hr class="my-4">
                        <h3 class="font-semibold">📜 Logs del Sistema</h3>
                        <div id="logsContainer" class="bg-gray-900 text-green-300 text-xs p-2 rounded h-48 overflow-y-auto font-mono">${logsHtml}</div>
                        <button id="clearLogs" class="bg-red-500 text-white px-3 py-1 rounded mt-2">Limpiar Logs</button>
                    </div>
                </div>
            </div>
        `;
        // Eventos CRUD
        document.getElementById('addPuzzle').onclick = async () => {
            const enunciado = document.getElementById('puzzleEnunciado').value;
            const tablas_inicial = JSON.parse(document.getElementById('puzzleTablas').value);
            const df_inicial = JSON.parse(document.getElementById('puzzleDFs').value);
            const solucion_esperada = JSON.parse(document.getElementById('puzzleSolucion').value);
            const nivel_dificultad = parseInt(document.getElementById('puzzleDificultad').value);
            if (!enunciado) return;
            await API.post('admin/puzzle/create', { enunciado, tablas_inicial, df_inicial, solucion_esperada, nivel_dificultad });
            AdminPanel.render(container);
        };
        document.getElementById('updatePuzzle').onclick = async () => {
            const id = document.getElementById('puzzleId').value;
            if (!id) return alert('ID requerido');
            const enunciado = document.getElementById('puzzleEnunciado').value;
            const tablas_inicial = JSON.parse(document.getElementById('puzzleTablas').value);
            const df_inicial = JSON.parse(document.getElementById('puzzleDFs').value);
            const solucion_esperada = JSON.parse(document.getElementById('puzzleSolucion').value);
            const nivel_dificultad = parseInt(document.getElementById('puzzleDificultad').value);
            await API.post('admin/puzzle/update', { id, enunciado, tablas_inicial, df_inicial, solucion_esperada, nivel_dificultad });
            AdminPanel.render(container);
        };
        document.getElementById('clearForm').onclick = () => {
            document.getElementById('puzzleId').value = '';
            document.getElementById('puzzleEnunciado').value = '';
            document.getElementById('puzzleTablas').value = '';
            document.getElementById('puzzleDFs').value = '';
            document.getElementById('puzzleSolucion').value = '';
            document.getElementById('puzzleDificultad').value = '';
        };
        document.getElementById('saveReto').onclick = async () => {
            const id = reto ? reto.id : (await API.get('admin/reto'))?.id;
            const descripcion = document.getElementById('retoDesc').value;
            const tablas = JSON.parse(document.getElementById('retoTablas').value);
            const df = JSON.parse(document.getElementById('retoDFs').value);
            const fecha_inicio = document.getElementById('retoFechaInicio').value;
            const fecha_fin = document.getElementById('retoFechaFin').value;
            await API.post('admin/reto/save', { id, descripcion, tablas, df, fecha_inicio, fecha_fin });
            alert('Reto guardado');
            AdminPanel.render(container);
        };
        document.getElementById('clearLogs').onclick = async () => {
            await API.post('admin/logs/clear', {});
            AdminPanel.render(container);
        };
        document.querySelectorAll('.editPuzzle').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const puzzles = await API.get('admin/puzzles');
                const p = puzzles.find(p => p.id == id);
                if (p) {
                    document.getElementById('puzzleId').value = p.id;
                    document.getElementById('puzzleEnunciado').value = p.enunciado;
                    document.getElementById('puzzleTablas').value = JSON.stringify(JSON.parse(p.tablas_inicial));
                    document.getElementById('puzzleDFs').value = JSON.stringify(JSON.parse(p.df_inicial));
                    document.getElementById('puzzleSolucion').value = JSON.stringify(JSON.parse(p.solucion_esperada));
                    document.getElementById('puzzleDificultad').value = p.nivel_dificultad;
                }
            });
        });
        document.querySelectorAll('.deletePuzzle').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('¿Eliminar puzzle?')) {
                    await API.post('admin/puzzle/delete', { id: btn.dataset.id });
                    AdminPanel.render(container);
                }
            });
        });
    }
};
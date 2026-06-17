window.Validador = {
    attributes: ['id_est', 'nombre', 'ciudad'],
    fds: [],

    async render(container) {
        this.renderLayout(container);
    },

    renderLayout(container) {
        container.innerHTML = `
            <div class="flex flex-col lg:flex-row gap-8">
                <!-- Left Column: Form -->
                <div class="flex-1 space-y-6">
                    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <div class="flex items-center gap-3 mb-6">
                            <i class="fas fa-wrench text-gray-400"></i>
                            <h2 class="text-xl font-bold text-gray-800">Motor de Normalización</h2>
                        </div>
                        <p class="text-sm text-gray-500 mb-6">Define un esquema relacional y analiza su nivel de normalización</p>

                        <!-- Table Name -->
                        <div class="mb-6">
                            <div class="flex justify-between items-center mb-2">
                                <label class="block text-sm font-bold text-gray-700">Nombre de la Tabla</label>
                                <button onclick="Validador.showImportModal()" class="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold px-3 py-1 rounded-lg border border-indigo-200 transition flex items-center gap-1.5">
                                    <i class="fas fa-file-import"></i> Importar SQL
                                </button>
                            </div>
                            <input id="tableName" type="text" value="Estudiante" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition">
                        </div>

                        <!-- Attributes -->
                        <div class="mb-6">
                            <label class="block text-sm font-bold text-gray-700 mb-2">Atributos</label>
                            <div id="attrList" class="flex flex-wrap gap-2 mb-3">
                                ${this.attributes.map(attr => `
                                    <div class="bg-indigo-50 text-brand-purple px-3 py-1.5 rounded-lg text-sm font-mono flex items-center gap-2 border border-indigo-100 group max-w-[150px] overflow-hidden">
                                        <span class="truncate" title="${attr}">${attr}</span>
                                        <button onclick="Validador.removeAttr('${attr}')" class="text-indigo-300 hover:text-red-500 transition shrink-0">×</button>
                                    </div>
                                `).join('')}
                            </div>
                            <div class="flex gap-2">
                                <input id="newAttr" type="text" placeholder="Nombre del atributo" class="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-purple transition">
                                <button onclick="Validador.addAttr()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
                                    <i class="fas fa-plus"></i> Agregar
                                </button>
                            </div>
                        </div>

                        <!-- FDs -->
                        <div class="mb-8">
                            <label class="block text-sm font-bold text-gray-700 mb-2">Dependencias Funcionales</label>
                            <div id="fdList" class="space-y-2 mb-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                ${this.fds.length === 0 ? '<p class="text-xs text-gray-400 italic">Sin dependencias definidas</p>' : ''}
                                ${this.fds.map((fd, i) => `
                                    <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                                        <div class="font-mono text-sm text-gray-600">${fd.det} → ${fd.dep}</div>
                                        <button onclick="Validador.removeFD(${i})" class="ml-auto text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100">
                                            <i class="fas fa-trash-alt text-xs"></i>
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                            <div class="flex flex-col md:flex-row gap-3">
                                <input id="fdDet" type="text" placeholder="Determinante (ej: id_est)" class="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-purple transition font-mono">
                                <input id="fdDep" type="text" placeholder="Dependiente (ej: nombre,apellido)" class="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-purple transition font-mono">
                            </div>
                            <button onclick="Validador.addFD()" class="w-full mt-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2">
                                <i class="fas fa-plus"></i> Agregar Dependencia
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Right Column: Status & Action -->
                <div class="w-full lg:w-96 space-y-6">
                    <div class="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                        <div class="flex items-start gap-3">
                            <i class="fas fa-lightbulb text-amber-400 mt-1"></i>
                            <p class="text-xs text-indigo-900 leading-relaxed font-medium">Define los atributos y dependencias funcionales, luego haz clic en Validar para diagnosticar tu esquema.</p>
                        </div>
                    </div>

                    <button id="btnValidar" class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition">
                        ✓ Validar Normalización
                    </button>

                    <div class="bg-white rounded-2xl border border-gray-100 p-6">
                        <div class="flex items-center gap-2 mb-4">
                            <div class="w-8 h-8 bg-pink-100 text-pink-500 rounded-lg flex items-center justify-center">
                                <i class="fas fa-bullseye"></i>
                            </div>
                            <h3 class="font-bold text-gray-800">Misión Actual</h3>
                        </div>
                        <p class="text-xs text-gray-500 leading-relaxed mb-4">Alcanza BCNF para liberar los datos de anomalías.</p>
                        <div id="validationResult" class="hidden animate-in fade-in slide-in-from-top-4"></div>
                    </div>
                </div>
            </div>

            <!-- Modal de Importación SQL -->
            <div id="importSqlModal" class="hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 opacity-0 transition-opacity duration-300">
                <div class="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl transform scale-95 transition-transform duration-300" id="importSqlContent">
                    <div class="bg-brand-sidebar p-6 text-white border-b border-white/10 flex justify-between items-center">
                        <div>
                            <h3 class="text-xl font-bold flex items-center gap-2"><i class="fas fa-database text-brand-purple"></i> Ingesta Inteligente SQL</h3>
                            <p class="text-xs text-gray-400 mt-1">Pega un CREATE TABLE para detectar atributos automáticamente.</p>
                        </div>
                        <button onclick="Validador.hideImportModal()" class="text-gray-400 hover:text-white transition"><i class="fas fa-times text-xl"></i></button>
                    </div>
                    <div class="p-6 bg-gray-50">
                        <textarea id="sqlInput" rows="6" class="w-full border border-gray-300 rounded-xl p-3 text-sm font-mono focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition mb-4" placeholder="CREATE TABLE Empleados (\n    id_emp INT PRIMARY KEY,\n    nombre VARCHAR(50),\n    departamento VARCHAR(50)\n);"></textarea>
                        <div class="flex justify-end items-center gap-3">
                            <button onclick="Validador.hideImportModal()" class="text-sm font-bold text-gray-500 hover:text-gray-700 transition">Cancelar</button>
                            <button onclick="Validador.parseSql()" class="bg-gradient-to-r from-blue-600 to-brand-purple text-white px-6 py-2 rounded-xl font-bold shadow-lg hover:scale-105 transition flex items-center gap-2">
                                <i class="fas fa-magic"></i> Extraer Atributos
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btnValidar').onclick = () => this.validate();
    },

    addAttr() {
        const input = document.getElementById('newAttr');
        const val = input.value.trim();
        if (val && !this.attributes.includes(val)) {
            this.attributes.push(val);
            this.renderLayout(document.getElementById('contentContainer'));
        }
        input.value = '';
    },

    removeAttr(attr) {
        this.attributes = this.attributes.filter(a => a !== attr);
        this.renderLayout(document.getElementById('contentContainer'));
    },

    addFD() {
        const det = document.getElementById('fdDet').value.trim();
        const dep = document.getElementById('fdDep').value.trim();
        if (det && dep) {
            this.fds.push({ det, dep });
            this.renderLayout(document.getElementById('contentContainer'));
        }
    },

    removeFD(index) {
        this.fds.splice(index, 1);
        this.renderLayout(document.getElementById('contentContainer'));
    },

    async validate() {
        const btn = document.getElementById('btnValidar');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validando...';
        
        const resultDiv = document.getElementById('validationResult');
        const fdText = this.fds.map(fd => `${fd.det}→${fd.dep}`).join(';');
        const attrs = this.attributes.join(', ');
        
        try {
            const res = await API.post('validation/normalform', { attrs, fdText });
            if (!res.normalForm) throw new Error("Respuesta inválida del servidor");

            let reportHtml = '';
            if (res.report && res.report.length > 0) {
                reportHtml = `
                    <div class="mt-6 border-l-2 border-indigo-200 ml-4 pl-6 space-y-8 relative timeline-line">
                        ${res.report.map((step, index) => `
                            <div class="relative animate-in slide-in-from-right-4" style="animation-delay: ${index * 150}ms">
                                <!-- Timeline dot -->
                                <div class="absolute -left-[35px] top-1 w-6 h-6 rounded-full bg-indigo-500 border-4 border-white shadow-sm flex items-center justify-center text-[10px] font-bold text-white z-10">
                                    ${index + 1}
                                </div>
                                
                                <h4 class="font-bold text-gray-800 text-lg mb-1">${step.title}</h4>
                                <p class="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">${step.explanation}</p>
                                
                                <div class="flex flex-col gap-3">
                                    ${step.tables.map(t => `
                                        <div class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition card-hover">
                                            <div class="bg-indigo-50 border-b border-indigo-100 px-4 py-2 font-bold text-sm text-indigo-800 flex justify-between items-center">
                                                <span><i class="fas fa-table mr-2"></i> ${t.name}</span>
                                                <span class="text-[10px] bg-indigo-200 px-2 py-0.5 rounded-full text-indigo-700">PK: ${t.pk.join(', ')}</span>
                                            </div>
                                            <div class="p-4 flex flex-wrap gap-2">
                                                ${t.attrs.map(attr => `
                                                    <span class="${t.pk.includes(attr) ? 'bg-amber-100 text-amber-800 border-amber-200 shadow-sm' : 'bg-gray-100 text-gray-700 border-gray-200'} border px-2 py-1 rounded-md text-xs font-mono transition-transform hover:scale-105">
                                                        ${t.pk.includes(attr) ? '<i class="fas fa-key text-[10px] mr-1 text-amber-500"></i>' : ''}${attr}
                                                    </span>
                                                `).join('')}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            resultDiv.classList.remove('hidden');
            resultDiv.innerHTML = `
                <div class="p-5 rounded-2xl ${res.normalForm.includes('3FN') || res.normalForm.includes('BCNF') ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20'} mb-6 relative overflow-hidden">
                    <i class="fas fa-magic absolute -right-4 -bottom-4 text-6xl opacity-10"></i>
                    <p class="text-sm font-medium opacity-90 mb-1 uppercase tracking-wider">Diagnóstico de Salud</p>
                    <p class="text-2xl font-black">Tu diseño es compatible con <span class="text-white bg-black/20 px-2 py-0.5 rounded-lg">${res.normalForm}</span></p>
                </div>
                
                <h3 class="font-bold text-gray-800 text-lg flex items-center gap-2 mb-2"><i class="fas fa-book-open text-brand-purple"></i> Reporte de Evolución</h3>
                <p class="text-xs text-gray-500 mb-4">Análisis paso a paso del proceso de normalización sugerido por la IA.</p>
                
                ${reportHtml}
            `;
        } catch (e) {
            console.error(e);
            alert("Error al validar: " + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    },

    showImportModal() {
        const modal = document.getElementById('importSqlModal');
        const content = document.getElementById('importSqlContent');
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            content.classList.remove('scale-95');
        }, 10);
    },

    hideImportModal() {
        const modal = document.getElementById('importSqlModal');
        const content = document.getElementById('importSqlContent');
        modal.classList.add('opacity-0');
        content.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.getElementById('sqlInput').value = '';
        }, 300);
    },

    parseSql() {
        const sql = document.getElementById('sqlInput').value.trim();
        if (!sql) return;

        const tableMatch = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[`'"]?)([\w]+)(?:[`'"]?)\s*\(/i);
        let tableName = tableMatch && tableMatch[1] ? tableMatch[1] : '';

        const firstParen = sql.indexOf('(');
        // Intentar encontrar el cierre de este CREATE TABLE específico
        let lastParen = sql.indexOf(');', firstParen);
        if (lastParen === -1) lastParen = sql.lastIndexOf(')');
        
        if (firstParen !== -1 && lastParen !== -1 && lastParen > firstParen) {
            const columnsDef = sql.substring(firstParen + 1, lastParen);
            const columns = columnsDef.split(/,(?![^\(]*\))/);
            
            const extractedAttrs = [];
            const pks = [];
            const uniques = [];
            
            columns.forEach(col => {
                let colStr = col.trim();
                
                // Limpiar ruido
                colStr = colStr.split(')')[0].split(';')[0].trim();
                if (!colStr || colStr.toUpperCase().startsWith('CREATE') || colStr.toUpperCase().startsWith('TABLE')) return;
                
                // Table-level constraints
                const pkMatch = colStr.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
                if (pkMatch) {
                    pks.push(...pkMatch[1].split(',').map(s => s.trim().replace(/[`'"]/g, '')));
                    return;
                }
                const uqMatch = colStr.match(/^UNIQUE\s*\(([^)]+)\)/i);
                if (uqMatch) {
                    uniques.push(uqMatch[1].split(',').map(s => s.trim().replace(/[`'"]/g, '')));
                    return;
                }
                if (/^(?:FOREIGN\s+KEY|KEY|CONSTRAINT)\b/i.test(colStr)) {
                    return;
                }
                
                // Extraer nombre de columna
                const colMatch = colStr.match(/^(?:[`'"]?)([\w]+)(?:[`'"]?)/);
                if (colMatch && colMatch[1]) {
                    const attrName = colMatch[1];
                    extractedAttrs.push(attrName);
                    
                    // Inline constraints
                    if (/\bPRIMARY\s+KEY\b/i.test(colStr)) {
                        pks.push(attrName);
                    } else if (/\bUNIQUE\b/i.test(colStr)) {
                        uniques.push([attrName]);
                    }
                }
            });
            
            if (extractedAttrs.length > 0) {
                this.attributes = extractedAttrs;
                if (tableName) {
                    const tInput = document.getElementById('tableName');
                    if(tInput) tInput.value = tableName;
                }
                
                // Generate FDs
                this.fds = [];
                if (pks.length > 0) {
                    const dep = extractedAttrs.filter(a => !pks.includes(a)).join(',');
                    if (dep) {
                        this.fds.push({ det: pks.join(','), dep: dep });
                    }
                }
                
                uniques.forEach(uArr => {
                    const dep = extractedAttrs.filter(a => !uArr.includes(a)).join(',');
                    if (dep) {
                        this.fds.push({ det: uArr.join(','), dep: dep });
                    }
                });
                
                this.renderLayout(document.getElementById('contentContainer'));
                this.hideImportModal();
                
                alert(`¡Éxito! Se detectó la tabla "${tableName}" con ${extractedAttrs.length} atributos y ${this.fds.length} dependencias funcionales.`);
            } else {
                alert("No se pudieron detectar atributos. Verifica la sintaxis del SQL.");
            }
        } else {
            alert("No se encontró una estructura válida de CREATE TABLE.");
        }
    }
};

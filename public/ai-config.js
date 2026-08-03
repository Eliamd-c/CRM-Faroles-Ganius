document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Forms & Buttons
    const saveContextBtn = document.getElementById('save-context-btn');
    const masterContextEditor = document.getElementById('master-context-editor');
    
    const addLearnedBtn = document.getElementById('add-learned-btn');
    const cancelLearnedBtn = document.getElementById('cancel-learned-btn');
    const saveLearnedBtn = document.getElementById('save-learned-btn');
    const learnedFormContainer = document.getElementById('learned-form-container');
    const learnedTableBody = document.querySelector('#learned-table tbody');
    
    const addKnowledgeBtn = document.getElementById('add-knowledge-btn');
    const cancelKnowledgeBtn = document.getElementById('cancel-knowledge-btn');
    const saveKnowledgeBtn = document.getElementById('save-knowledge-btn');
    const knowledgeFormContainer = document.getElementById('knowledge-form-container');
    const knowledgeTableBody = document.querySelector('#knowledge-table tbody');

    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    // Toast Notification
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // --- CONTEXTO MAESTRO ---
    async function loadMasterContext() {
        try {
            const res = await fetch('/api/ai/master-context');
            if (res.ok) {
                const data = await res.json();
                masterContextEditor.value = data.context || '';
            }
        } catch (err) {
            console.error('Error loading master context', err);
            showToast('Error cargando el contexto maestro', 'error');
        }
    }

    saveContextBtn.addEventListener('click', async () => {
        const text = masterContextEditor.value;
        saveContextBtn.textContent = 'Guardando...';
        saveContextBtn.disabled = true;
        
        try {
            const res = await fetch('/api/ai/master-context', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ context: text })
            });
            if (res.ok) {
                showToast('Contexto guardado y actualizado en memoria');
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al guardar', 'error');
            }
        } catch (err) {
            showToast('Error de conexión', 'error');
        } finally {
            saveContextBtn.textContent = 'Guardar Contexto';
            saveContextBtn.disabled = false;
        }
    });

    // --- RESPUESTAS APRENDIDAS ---
    async function loadLearnedResponses() {
        try {
            const res = await fetch('/api/ai/learned');
            if (res.ok) {
                const data = await res.json();
                renderLearnedTable(data);
            }
        } catch (err) {
            console.error(err);
        }
    }

    function renderLearnedTable(data) {
        learnedTableBody.innerHTML = '';
        if (data.length === 0) {
            learnedTableBody.innerHTML = '<tr class="empty-row"><td colspan="3">No hay respuestas aprendidas aún.</td></tr>';
            return;
        }
        
        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${item.question}</strong></td>
                <td>${item.answer.length > 80 ? item.answer.substring(0, 80) + '...' : item.answer}</td>
                <td><button class="btn danger-sm" data-id="${item.id}">Eliminar</button></td>
            `;
            learnedTableBody.appendChild(tr);
        });

        // Delete buttons
        learnedTableBody.querySelectorAll('.danger-sm').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                if (confirm('¿Seguro que deseas eliminar esta respuesta?')) {
                    await deleteLearned(id);
                }
            });
        });
    }

    addLearnedBtn.addEventListener('click', () => {
        learnedFormContainer.classList.remove('hidden');
        addLearnedBtn.classList.add('hidden');
    });

    cancelLearnedBtn.addEventListener('click', () => {
        learnedFormContainer.classList.add('hidden');
        addLearnedBtn.classList.remove('hidden');
        document.getElementById('learned-q').value = '';
        document.getElementById('learned-a').value = '';
    });

    saveLearnedBtn.addEventListener('click', async () => {
        const q = document.getElementById('learned-q').value.trim();
        const a = document.getElementById('learned-a').value.trim();
        
        if (!q || !a) {
            return showToast('Ambos campos son obligatorios', 'error');
        }

        saveLearnedBtn.textContent = 'Guardando...';
        saveLearnedBtn.disabled = true;

        try {
            const res = await fetch('/api/ai/learn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: q, answer: a })
            });
            if (res.ok) {
                showToast('Respuesta aprendida correctamente');
                cancelLearnedBtn.click();
                loadLearnedResponses();
            } else {
                showToast('Error al aprender respuesta', 'error');
            }
        } catch (err) {
            showToast('Error de conexión', 'error');
        } finally {
            saveLearnedBtn.textContent = 'Guardar';
            saveLearnedBtn.disabled = false;
        }
    });

    async function deleteLearned(id) {
        try {
            const res = await fetch(`/api/ai/learned/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Eliminado correctamente');
                loadLearnedResponses();
            } else {
                showToast('Error al eliminar', 'error');
            }
        } catch (err) {
            showToast('Error de conexión', 'error');
        }
    }


    // --- BASE DE CONOCIMIENTO (RAG) ---
    async function loadKnowledge() {
        try {
            const res = await fetch('/api/ai/knowledge');
            if (res.ok) {
                const data = await res.json();
                renderKnowledgeTable(data);
            }
        } catch (err) {
            console.error(err);
        }
    }

    function renderKnowledgeTable(data) {
        knowledgeTableBody.innerHTML = '';
        if (data.length === 0) {
            knowledgeTableBody.innerHTML = '<tr class="empty-row"><td colspan="3">No hay fragmentos en la base de conocimiento.</td></tr>';
            return;
        }
        
        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${item.section_title}</strong></td>
                <td>${item.content.length > 80 ? item.content.substring(0, 80) + '...' : item.content}</td>
                <td><button class="btn danger-sm" data-id="${item.id}">Eliminar</button></td>
            `;
            knowledgeTableBody.appendChild(tr);
        });

        // Delete buttons
        knowledgeTableBody.querySelectorAll('.danger-sm').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                if (confirm('¿Seguro que deseas eliminar este fragmento?')) {
                    await deleteKnowledge(id);
                }
            });
        });
    }

    addKnowledgeBtn.addEventListener('click', () => {
        knowledgeFormContainer.classList.remove('hidden');
        addKnowledgeBtn.classList.add('hidden');
    });

    cancelKnowledgeBtn.addEventListener('click', () => {
        knowledgeFormContainer.classList.add('hidden');
        addKnowledgeBtn.classList.remove('hidden');
        document.getElementById('knowledge-title').value = '';
        document.getElementById('knowledge-content').value = '';
    });

    saveKnowledgeBtn.addEventListener('click', async () => {
        const title = document.getElementById('knowledge-title').value.trim();
        const content = document.getElementById('knowledge-content').value.trim();
        
        if (!title || !content) {
            return showToast('Ambos campos son obligatorios', 'error');
        }

        saveKnowledgeBtn.textContent = 'Procesando embedding...';
        saveKnowledgeBtn.disabled = true;

        try {
            const res = await fetch('/api/ai/knowledge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ section_title: title, content: content })
            });
            if (res.ok) {
                showToast('Conocimiento guardado y vectorizado');
                cancelKnowledgeBtn.click();
                loadKnowledge();
            } else {
                showToast('Error al guardar conocimiento', 'error');
            }
        } catch (err) {
            showToast('Error de conexión', 'error');
        } finally {
            saveKnowledgeBtn.textContent = 'Procesar y Guardar';
            saveKnowledgeBtn.disabled = false;
        }
    });

    async function deleteKnowledge(id) {
        try {
            const res = await fetch(`/api/ai/knowledge/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Eliminado correctamente');
                loadKnowledge();
            } else {
                showToast('Error al eliminar', 'error');
            }
        } catch (err) {
            showToast('Error de conexión', 'error');
        }
    }


    // Initialize
    loadMasterContext();
    loadLearnedResponses();
    loadKnowledge();
});

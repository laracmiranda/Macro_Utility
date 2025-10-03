// popup.js - Gerenciamento de macros com eventos via addEventListener (CSP-compliant)

let macros = [];
let editingId = null;

// Função para carregar macros do storage
function loadMacros() {
  chrome.storage.local.get('macros', (result) => {
    macros = result.macros || [];
    renderMacros();
  });
}

// Função para salvar macros no storage
function saveMacros() {
  chrome.storage.local.set({ macros: macros }, () => {
    loadMacros();  // Recarrega para atualizar a UI
  });
}

// Função para adicionar nova macro
function addMacro() {
  const shortcut = document.getElementById('shortcut').value.trim();
  const name = document.getElementById('name').value.trim();
  const text = document.getElementById('text').value.trim();
  
  if (!shortcut || !name || !text) {
    alert('Preencha todos os campos!');
    return;
  }
  
  // Verifica se o shortcut já existe
  if (macros.some(m => m.shortcut === shortcut)) {
    alert('Este atalho já existe! Use outro.');
    return;
  }
  
  const newMacro = { 
    id: Date.now().toString(), 
    shortcut, 
    name, 
    text 
  };
  macros.push(newMacro);
  saveMacros();
  
  // Limpa o formulário
  document.getElementById('shortcut').value = '';
  document.getElementById('name').value = '';
  document.getElementById('text').value = '';
}

// Função para iniciar edição de uma macro
function startEdit(id) {
  const macro = macros.find(m => m.id === id);
  if (!macro) return;
  
  editingId = id;
  document.getElementById('form-section').classList.add('hidden');
  document.getElementById('edit-section').classList.remove('hidden');
  document.getElementById('edit-shortcut').value = macro.shortcut;
  document.getElementById('edit-name').value = macro.name;
  document.getElementById('edit-text').value = macro.text;
}

// Função para atualizar macro em edição
function updateMacro() {
  if (!editingId) return;
  
  const shortcut = document.getElementById('edit-shortcut').value.trim();
  const name = document.getElementById('edit-name').value.trim();
  const text = document.getElementById('edit-text').value.trim();
  
  if (!shortcut || !name || !text) {
    alert('Preencha todos os campos!');
    return;
  }
  
  // Verifica se o shortcut mudou e já existe em outra macro
  const otherMacro = macros.find(m => m.id !== editingId && m.shortcut === shortcut);
  if (otherMacro) {
    alert('Este atalho já existe em outra macro!');
    return;
  }
  
  const index = macros.findIndex(m => m.id === editingId);
  macros[index] = { ...macros[index], shortcut, name, text };
  saveMacros();
  cancelEdit();
}

// Função para cancelar edição
function cancelEdit() {
  editingId = null;
  document.getElementById('form-section').classList.remove('hidden');
  document.getElementById('edit-section').classList.add('hidden');
  
  // Limpa o formulário de edição
  document.getElementById('edit-shortcut').value = '';
  document.getElementById('edit-name').value = '';
  document.getElementById('edit-text').value = '';
}

// Função para deletar macro
function deleteMacro(id) {
  if (confirm('Deletar esta macro?')) {
    macros = macros.filter(m => m.id !== id);
    saveMacros();
  }
}

// Função para renderizar a lista de macros
function renderMacros() {
  const list = document.getElementById('macros-list');
  if (macros.length === 0) {
    list.innerHTML = '<div class="no-macros">Nenhuma macro encontrada</div>';
    return;
  }
  
  list.innerHTML = macros.map(macro => `
    <div class="macro-item">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span class="shortcut">${macro.shortcut}</span>
          <strong>${macro.name}</strong>
        </div>
        <div class="text-preview">${macro.text.length > 50 ? macro.text.substring(0, 50) + '...' : macro.text}</div>
      </div>
      <div class="button-group">
        <button class="edit-btn" data-id="${macro.id}">Editar</button>
        <button class="delete-btn outline" data-id="${macro.id}">Excluir</button>
      </div>
    </div>
  `).join('');
  
  // Adiciona event listeners para os botões de editar/excluir (delegação de eventos)
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      startEdit(id);
    });
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      deleteMacro(id);
    });
  });
}

// Inicialização: Carrega macros e configura event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadMacros();
  
  // Event listeners para botões do formulário
  document.getElementById('add-macro-btn').addEventListener('click', addMacro);
  document.getElementById('update-macro-btn').addEventListener('click', updateMacro);
  document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
  
  // Opcional: Enter no formulário para submeter
  document.getElementById('shortcut').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addMacro();
  });
  document.getElementById('name').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addMacro();
  });
  document.getElementById('text').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) addMacro();  // Ctrl+Enter para textarea
  });
  
  // Listeners para edição
  document.getElementById('edit-shortcut').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') updateMacro();
  });
  document.getElementById('edit-name').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') updateMacro();
  });
  document.getElementById('edit-text').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) updateMacro();
  });
});
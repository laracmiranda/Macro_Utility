let macros = [];
let editingId = null;

function loadMacros() {
  chrome.storage.local.get('macros', (result) => {
    macros = result.macros || [];
    renderMacros();
  });
}

function saveMacros() {
  chrome.storage.local.set({ macros: macros }, () => {
    loadMacros();
  });
}

function addMacro() {
  const shortcut = document.getElementById('shortcut').value.trim();
  const name = document.getElementById('name').value.trim();
  const text = document.getElementById('rich-editor').innerHTML.trim();  // Usar innerHTML para texto formatado
  
  if (!shortcut || !name || !text) {
    alert('Preencha todos os campos!');
    return;
  }
  
  if (macros.some(m => m.shortcut === shortcut)) {
    alert('Este atalho já existe!');
    return;
  }
  
  const newMacro = { id: Date.now().toString(), shortcut, name, text };
  macros.push(newMacro);
  saveMacros();
  document.getElementById('shortcut').value = '';
  document.getElementById('name').value = '';
  document.getElementById('rich-editor').innerHTML = '';  // Limpa o editor
}

function startEdit(id) {
  openTab('cadastrar');  // Alterna para a aba de cadastro
  const macro = macros.find(m => m.id === id);
  if (!macro) return;
  
  editingId = id;
  document.getElementById('form-section').style.display = 'none';
  document.getElementById('edit-section').style.display = 'block';
  document.getElementById('edit-shortcut').value = macro.shortcut;
  document.getElementById('edit-name').value = macro.name;
  document.getElementById('edit-rich-editor').innerHTML = macro.text;  // Carrega texto formatado
  document.getElementById('edit-rich-editor').focus();  // Foca no editor
}

function updateMacro() {
  if (!editingId) return;
  
  const shortcut = document.getElementById('edit-shortcut').value.trim();
  const name = document.getElementById('edit-name').value.trim();
  const text = document.getElementById('edit-rich-editor').innerHTML.trim();  // Usar innerHTML
  
  if (!shortcut || !name || !text) {
    alert('Preencha todos os campos!');
    return;
  }
  
  if (macros.some(m => m.id !== editingId && m.shortcut === shortcut)) {
    alert('Este atalho já existe em outra macro!');
    return;
  }
  
  const index = macros.findIndex(m => m.id === editingId);
  macros[index] = { id: editingId, shortcut, name, text };
  saveMacros();
  cancelEdit();
}

function cancelEdit() {
  editingId = null;
  document.getElementById('form-section').style.display = 'block';
  document.getElementById('edit-section').style.display = 'none';
  document.getElementById('edit-shortcut').value = '';
  document.getElementById('edit-name').value = '';
  document.getElementById('edit-rich-editor').innerHTML = '';
}

function renderMacros() {
  const list = document.getElementById('macros-list');
  list.innerHTML = '';
  if (macros.length === 0) {
    list.innerHTML = '<p>Nenhuma macro encontrada</p>';
    return;
  }
  macros.forEach(macro => {
    const div = document.createElement('div');
    div.className = 'macro-item';
    div.innerHTML = `
      <strong>${macro.shortcut}</strong> - ${macro.name}<br>
      ${macro.text.substring(0, 50)}${macro.text.length > 50 ? '...' : ''}
      <button class="edit-btn" data-id="${macro.id}">Editar</button>
      <button class="delete-btn" data-id="${macro.id}">Excluir</button>
    `;
    list.appendChild(div);
  });
}

function filterMacros() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const filtered = macros.filter(m => m.shortcut.toLowerCase().includes(search) || m.name.toLowerCase().includes(search));
  const list = document.getElementById('macros-list');
  list.innerHTML = '';
  if (filtered.length === 0) {
    list.innerHTML = '<p>Nenhuma macro encontrada</p>';
    return;
  }
  filtered.forEach(macro => {
    const div = document.createElement('div');
    div.className = 'macro-item';
    div.innerHTML = `
      <strong>${macro.shortcut}</strong> - ${macro.name}<br>
      ${macro.text.substring(0, 50)}${macro.text.length > 50 ? '...' : ''}
      <button class="edit-btn" data-id="${macro.id}">Editar</button>
      <button class="delete-btn" data-id="${macro.id}">Excluir</button>
    `;
    list.appendChild(div);
  });
}

function openTab(tabName) {
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(tab => {
    tab.classList.remove('active');
  });
  const activeTab = document.getElementById(tabName);
  if (activeTab) {
    activeTab.classList.add('active');
  }

  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.classList.remove('active');
    if (button.id === `tab-${tabName}`) {
      button.classList.add('active');
    }
  });
}

function deleteMacro(id) {
  if (confirm('Deletar esta macro?')) {
    macros = macros.filter(m => m.id !== id);
    saveMacros();
  }
}

// Inicializa ao carregar
document.addEventListener('DOMContentLoaded', () => {
  loadMacros();
  document.getElementById('add-macro-btn').addEventListener('click', addMacro);
  document.getElementById('update-macro-btn').addEventListener('click', updateMacro);
  document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
  document.getElementById('search-input').addEventListener('input', filterMacros);
  document.getElementById('tab-cadastrar').addEventListener('click', () => openTab('cadastrar'));
  document.getElementById('tab-visualizar').addEventListener('click', () => openTab('visualizar'));
  
  // Event delegation para botões dinâmicos
  document.getElementById('macros-list').addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-btn')) {
      const id = e.target.getAttribute('data-id');
      if (id) startEdit(id);
    } else if (e.target.classList.contains('delete-btn')) {
      const id = e.target.getAttribute('data-id');
      if (id) deleteMacro(id);
    }
  });
  
  // Eventos para botões de formatação no editor principal
  document.getElementById('bold-btn').addEventListener('click', () => {
    if (document.getElementById('rich-editor')) {
      document.getElementById('rich-editor').focus();
      document.execCommand('bold', false, null);
    }
  });
  document.getElementById('italic-btn').addEventListener('click', () => {
    if (document.getElementById('rich-editor')) {
      document.getElementById('rich-editor').focus();
      document.execCommand('italic', false, null);
    }
  });
  document.getElementById('list-btn').addEventListener('click', () => {
    if (document.getElementById('rich-editor')) {
      document.getElementById('rich-editor').focus();
      document.execCommand('insertUnorderedList', false, null);
    }
  });
  
  // Eventos para botões de formatação no editor de edição
  document.getElementById('edit-bold-btn').addEventListener('click', () => {
    if (document.getElementById('edit-rich-editor')) {
      document.getElementById('edit-rich-editor').focus();
      document.execCommand('bold', false, null);
    }
  });
  document.getElementById('edit-italic-btn').addEventListener('click', () => {
    if (document.getElementById('edit-rich-editor')) {
      document.getElementById('edit-rich-editor').focus();
      document.execCommand('italic', false, null);
    }
  });
  document.getElementById('edit-list-btn').addEventListener('click', () => {
    if (document.getElementById('edit-rich-editor')) {
      document.getElementById('edit-rich-editor').focus();
      document.execCommand('insertUnorderedList', false, null);
    }
  });
});
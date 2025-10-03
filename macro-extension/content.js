// content.js - Autocomplete múltiplo com navegação por teclado, otimizado para Google Chat e Zendesk

let activeSuggestions = null;  // Container do dropdown
let currentInput = null;
let currentSuggestions = [];   // Lista de macros filtradas
let selectedIndex = -1;        // Índice da sugestão selecionada (-1 = nenhuma)
let lastPrefix = '';           // Prefixo atual digitado

// Função para obter elementos editáveis (expandido para Google Chat/Zendesk)
function getEditableElements() {
  const selectors = [
    'input[type="text"], input[type="search"], input[type="email"], input[type="url"], input:not([type])',
    'textarea',
    '[contenteditable="true"]',
    // Google Chat específicos
    '.chat-message-input, [data-testid="message-input"], .editing, .message-composer-input',
    // Zendesk específicos (tickets e HC)
    '.ticket-description, .public-comment-input, .private-comment-input, .editable-textarea, [data-test-id="comment-input"]',
    '[role="textbox"], .editable'
  ].join(', ');
  return [
    ...document.querySelectorAll(selectors)
  ].filter(el => !el.disabled && el.offsetParent !== null && el.isConnected);  // Visíveis e conectados
}

// Função para monitorar input (filtragem em tempo real)
function monitorInput(element) {
  console.log('Monitorando elemento:', element.tagName, element.className || '');  // Log

  const handleInputOrKeyup = async (e) => {
    if (e.type === 'keydown' && !['ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'Escape'].includes(e.key)) {
      return;  // Só processa input/keyup para texto, keydown para navegação
    }

    currentInput = e.target || e.srcElement || e.composedPath?.()[0];  // Suporte shadow DOM
    const value = getElementValue(currentInput);
    console.log('Valor atual:', value);  // Log

    if (!value) {
      hideSuggestions();
      return;
    }

    // Extrai prefixo: última parte após / (ex: "/et" de "Olá /et")
    const lastSlashIndex = value.lastIndexOf('/');
    if (lastSlashIndex === -1) {
      hideSuggestions();
      return;
    }

    const prefix = value.substring(lastSlashIndex).split(/\s+/)[0];  // Até espaço
    if (prefix.length < 2 || prefix === lastPrefix) {  // Mínimo 2 chars, evita spam
      return;
    }

    lastPrefix = prefix;
    console.log('Prefixo detectado:', prefix);  // Log

    try {
      const result = await chrome.storage.local.get('macros');
      const allMacros = result.macros || [];
      currentSuggestions = allMacros.filter(m => 
        m.shortcut.toLowerCase().startsWith(prefix.toLowerCase())
      ).slice(0, 10);  // Limita a 10 sugestões

      console.log(`Sugestões filtradas para "${prefix}": ${currentSuggestions.length}`, 
                  currentSuggestions.map(m => m.shortcut));  // Log

      if (currentSuggestions.length > 0) {
        selectedIndex = 0;  // Começa na primeira
        showSuggestions(currentSuggestions, currentInput, prefix);
      } else {
        hideSuggestions();
      }
    } catch (error) {
      console.error('Erro ao filtrar macros:', error);
      // Fallback background
      chrome.runtime.sendMessage({ action: 'getMacros' }, (response) => {
        if (response?.macros) {
          currentSuggestions = response.macros.filter(m => 
            m.shortcut.toLowerCase().startsWith(prefix.toLowerCase())
          ).slice(0, 10);
          if (currentSuggestions.length > 0) {
            selectedIndex = 0;
            showSuggestions(currentSuggestions, currentInput, prefix);
          } else {
            hideSuggestions();
          }
        }
      });
    }
  };

  // Navegação por teclado (global, mas scoped ao input)
  const handleKeydown = (e) => {
    if (!activeSuggestions || currentInput !== e.target) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, currentSuggestions.length - 1);
        updateSelection();
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelection();
        break;
      case 'Tab':
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          applySuggestion(currentSuggestions[selectedIndex], currentInput, lastPrefix);
        }
        break;
      case 'Escape':
        e.preventDefault();
        hideSuggestions();
        break;
    }
  };

  element.addEventListener('input', handleInputOrKeyup);
  element.addEventListener('keyup', handleInputOrKeyup);
  element.addEventListener('keydown', handleKeydown);
  element.addEventListener('paste', handleInputOrKeyup);
}

// Função para obter valor
function getElementValue(element) {
  return (element.value || element.textContent || element.innerText || '').trim();
}

// Função para definir valor (substitui prefixo pelo texto da macro)
function setElementValue(element, newValue) {
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    element.value = newValue;
    element.setSelectionRange(newValue.length, newValue.length);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    element.textContent = newValue;
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
  element.focus();
  console.log('Aplicado:', newValue);  // Log
}

// Função para escape regex
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Função para mostrar dropdown de sugestões
function showSuggestions(suggestions, inputElement, prefix) {
  hideSuggestions();

  const rect = inputElement.getBoundingClientRect();
  const scrollY = window.scrollY;

  activeSuggestions = document.createElement('div');
  activeSuggestions.id = 'macro-suggestions-dropdown';
  activeSuggestions.style.cssText = `
    position: fixed; left: ${rect.left}px; top: ${rect.bottom + scrollY + 5}px;
    z-index: 2147483647; background: white; border: 1px solid #007bff; border-radius: 6px;
    max-height: 200px; overflow-y: auto; min-width: ${Math.max(rect.width, 200)}px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: Arial, sans-serif; font-size: 14px;
  `;

  // Gera lista de itens
  const itemsHtml = suggestions.map((macro, index) => {
    const preview = macro.text.length > 40 ? macro.text.substring(0, 40) + '...' : macro.text;
    return `
      <div class="suggestion-item ${index === selectedIndex ? 'selected' : ''}" data-index="${index}"
           style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee;
                  ${index === selectedIndex ? 'background: #e3f2fd; color: #007bff;' : ''}">
        <div style="font-weight: bold;">${macro.shortcut}</div>
        <div style="font-size: 12px; color: #666;">${macro.name} - ${preview}</div>
      </div>
    `;
  }).join('');

  activeSuggestions.innerHTML = itemsHtml;

  // Eventos de clique nos itens
  activeSuggestions.querySelectorAll('.suggestion-item').forEach((item, index) => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      applySuggestion(suggestions[index], inputElement, prefix);
      hideSuggestions();
    });
    item.addEventListener('mouseenter', () => {
      selectedIndex = index;
      updateSelection();
    });
  });

  document.body.appendChild(activeSuggestions);

  // Ajusta posição se sair da tela
  const dropdownRect = activeSuggestions.getBoundingClientRect();
  if (dropdownRect.bottom > window.innerHeight) {
    activeSuggestions.style.top = `${rect.top + scrollY - dropdownRect.height - 5}px`;
  }

  console.log('Dropdown exibido com', suggestions.length, 'sugestões');  // Log
}

// Atualiza destaque da seleção
function updateSelection() {
  if (!activeSuggestions) return;
  activeSuggestions.querySelectorAll('.suggestion-item').forEach((item, index) => {
    item.classList.toggle('selected', index === selectedIndex);
  });
  activeSuggestions.scrollTo({ top: selectedIndex * 40, behavior: 'smooth' });  // Scroll suave
}

// Aplica sugestão selecionada
function applySuggestion(macro, inputElement, prefix) {
  const currentValue = getElementValue(inputElement);
  const regex = new RegExp(escapeRegExp(prefix) + '\\s*$', 'i');
  const newValue = currentValue.replace(regex, macro.text + ' ');  // Substitui prefixo pelo texto
  setElementValue(inputElement, newValue);
  console.log(`Aplicada macro: ${macro.name}`);  // Log
}

// Esconde sugestões
function hideSuggestions() {
  if (activeSuggestions) {
    activeSuggestions.remove();
    activeSuggestions = null;
    currentSuggestions = [];
    selectedIndex = -1;
    lastPrefix = '';
    console.log('Sugestões escondidas');  // Log
  }
}

// Listeners globais (para cliques fora e teclas)
document.addEventListener('click', (e) => {
  if (activeSuggestions && !activeSuggestions.contains(e.target) && e.target !== currentInput) {
    hideSuggestions();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && activeSuggestions) {
    e.preventDefault();
    hideSuggestions();
  }
});

// Inicialização (com delay para SPAs como Google Chat/Zendesk)
function init() {
  setTimeout(() => {
    const elements = getEditableElements();
    console.log(`Inicializando: ${elements.length} elementos encontrados`);  // Log
    elements.forEach(monitorInput);

    // Observer robusto para elementos dinâmicos (Google Chat/Zendesk carregam via JS)
    const observer = new MutationObserver((mutations) => {
      let newCount = 0;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            const newElements = node.querySelectorAll ? [...node.querySelectorAll(getEditableElements().toString())] : [];
            newElements.forEach(monitorInput);
            newCount += newElements.length;
            // Para shadow DOM (Zendesk/Google)
            if (node.shadowRoot) {
              const shadowElements = node.shadowRoot.querySelectorAll ? [...node.shadowRoot.querySelectorAll(getEditableElements().toString())] : [];
              shadowElements.forEach(monitorInput);
            }
          }
        });
      });
      if (newCount > 0) console.log(`Observer: +${newCount} elementos`);  // Log
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log('Content script pronto - Autocomplete ativado!');  // Log
  }, 500);  // Delay maior para apps pesados
}

// Inicia
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
// content.js - Autocomplete múltiplo com navegação por teclado, otimizado para Google Chat e Zendesk

let activeSuggestions = null;  // Container do dropdown
let currentInput = null;
let currentSuggestions = [];   // Lista de macros filtradas
let selectedIndex = -1;        // Índice da sugestão selecionada (-1 = nenhuma)
let lastPrefix = '';           // Prefixo atual digitado

const EDITABLE_SELECTORS = 'input[type="text"], input[type="search"], input[type="email"], input[type="url"], input:not([type]), textarea, [contenteditable="true"], [role="textbox"]';

// Função para obter elementos editáveis, incluindo em iframes
function getEditableElements() {
  let elements = [
    ...document.querySelectorAll(EDITABLE_SELECTORS)
  ].filter(el => !el.disabled && el.offsetParent !== null && el.isConnected);

  // Procura em iframes
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach(iframe => {
    try {
      if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
        const iframeElements = iframe.contentDocument.querySelectorAll(EDITABLE_SELECTORS);
        iframeElements.forEach(el => {
          if (!el.disabled && el.offsetParent !== null && el.isConnected) {
            elements.push(el);  // Adiciona elementos do iframe
          }
        });
      }
    } catch (error) {
      // Nada aqui
    }
  });
  return elements;
}

// Função para monitorar input (filtragem em tempo real)
function monitorInput(element) {
  const handleInputOrKeyup = async (e) => {
    if (e.type === 'keydown' && !['ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'Escape'].includes(e.key)) {
      return;  // Só processa input/keyup para texto, keydown para navegação
    }

    currentInput = e.target || e.srcElement || e.composedPath?.()[0];  // Suporte shadow DOM
    const value = getElementValue(currentInput);

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

    try {
      const result = await chrome.storage.local.get('macros');
      const allMacros = result.macros || [];
      currentSuggestions = allMacros.filter(m => 
        m.shortcut.toLowerCase().startsWith(prefix.toLowerCase())
      ).slice(0, 10);  // Limita a 10 sugestões

      if (currentSuggestions.length > 0) {
        selectedIndex = 0;  // Começa na primeira
        showSuggestions(currentSuggestions, currentInput, prefix);
      } else {
        hideSuggestions();
      }
    } catch (error) {
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

// Função para definir valor (substitui prefixo pelo texto da macro, com suporte a HTML)
function setElementValue(element, newValue) {
  if (element.isContentEditable) {
    // Para elementos contenteditable, usa innerHTML para preservar formatação
    element.innerHTML += newValue;  // Adiciona ao final para manter o cursor
  } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    element.value += newValue;  // Para inputs, usa value
    element.setSelectionRange(element.value.length, element.value.length);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    element.textContent += newValue;  // Para outros, usa textContent
  }
  element.focus();
}

// Função para escape regex
function escapeRegExp(string) {  
  try {    
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');  // Regex válida  
  } catch (error) {    
    return string;  // Fallback para evitar crash  
  }
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

  const itemsHtml = suggestions.map((macro, index) => {
    const preview = macro.text.substring(0, 50) + (macro.text.length > 50 ? '...' : '');
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

  const dropdownRect = activeSuggestions.getBoundingClientRect();
  if (dropdownRect.bottom > window.innerHeight) {
    activeSuggestions.style.top = `${rect.top + scrollY - dropdownRect.height - 5}px`;
  }
}

// Atualiza destaque da seleção
function updateSelection() {
  if (!activeSuggestions) return;
  activeSuggestions.querySelectorAll('.suggestion-item').forEach((item, index) => {
    item.classList.toggle('selected', index === selectedIndex);
  });
  activeSuggestions.scrollTo({ top: selectedIndex * 40, behavior: 'smooth' });
}

// Aplica sugestão selecionada
function applySuggestion(macro, inputElement, prefix) {
  const currentValue = getElementValue(inputElement);
  const regex = new RegExp(escapeRegExp(prefix) + '\\s*$', 'i');
  const newValue = currentValue.replace(regex, macro.text + ' ');
  setElementValue(inputElement, newValue);
}

// Esconde sugestões
function hideSuggestions() {
  if (activeSuggestions) {
    activeSuggestions.remove();
    activeSuggestions = null;
    currentSuggestions = [];
    selectedIndex = -1;
    lastPrefix = '';
  }
}

// Listeners globais
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

// Inicialização
function init() {
  setTimeout(() => {
    const elements = getEditableElements();
    elements.forEach(monitorInput);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            const newElements = node.querySelectorAll ? [...node.querySelectorAll(EDITABLE_SELECTORS)] : [];
            newElements.forEach(monitorInput);
            if (node.shadowRoot) {
              const shadowElements = node.shadowRoot.querySelectorAll ? [...node.shadowRoot.querySelectorAll(EDITABLE_SELECTORS)] : [];
              shadowElements.forEach(monitorInput);
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }, 500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
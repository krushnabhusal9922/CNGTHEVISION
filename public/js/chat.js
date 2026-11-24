/**
 * CNG Connect — Multilingual AI Chatbot Frontend Module
 * Supports 7 languages, live station database grounding,
 * voice input (Web Speech API), and interactive quick prompts.
 */

const chatState = {
  currentLang: 'en',
  isOpen: false,
  isTyping: false,
  speechRecognition: null,
  isListening: false,
  history: []
};

// Language metadata
const CHAT_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧', greeting: "Hello! I am the CNG Connect Assistant. How can I help you today? Ask about stations from our database, reported pressure, wait times, or safety guidelines." },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', greeting: "नमस्ते! मैं सीएनजी कनेक्ट एआई हूँ। मैं आज आपकी क्या सहायता कर सकता हूँ? आप सीएनजी स्टेशन, गैस प्रेशर या वेटिंग टाइम के बारे में पूछ सकते हैं।" },
  { code: 'mr', name: 'मराठी', flag: '🇮🇳', greeting: "नमस्कार! मी सीएनजी कनेक्ट एआय आहे. तुम्ही मला जवळील सीएनजी स्टेशन्स, गॅस प्रेशर किंवा वेटिंग टाईमबद्दल विचारू शकता." },
  { code: 'gu', name: 'ગુજરાતી', flag: '🇮🇳', greeting: "નમસ્તે! હું સીએનજી કનેક્ટ એઆઈ છું. તમે સ્ટેશનો, પ્રેશર, વેઇટિંગ ટાઇમ અથવા સલામતી વિશે પૂછી શકો છો." },
  { code: 'es', name: 'Español', flag: '🇪🇸', greeting: "¡Hola! Soy el asistente de IA de CNG Connect. ¿En qué puedo ayudarte? Consulta estaciones, presión o tiempos de espera." },
  { code: 'fr', name: 'Français', flag: '🇫🇷', greeting: "Bonjour ! Je suis l'assistant IA de CNG Connect. Posez vos questions sur les stations, la pression ou l'attente." },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', greeting: "Hallo! Ich bin der KI-Assistent von CNG Connect. Fragen Sie nach Tankstellen, Druck, Wartezeiten oder Sicherheit." }
];

const PROMPT_SUGGESTIONS = {
  en: ["High pressure stations", "Shortest waiting queue", "Stations in Delhi", "CNG Safety Tips"],
  hi: ["हाई प्रेशर वाले स्टेशन", "सबसे कम वेटिंग टाइम", "दिल्ली में सीएनजी स्टेशन", "सीएनजी सुरक्षा नियम"],
  mr: ["हाय प्रेशर स्टेशन्स", "कमी वेटिंग टाईम कुठे आहे?", "पुण्यातील स्टेशन्स", "सीएनजी सुरक्षा नियम"],
  gu: ["હાઇ પ્રેશર સ્ટેશનો", "ઓછો વેઇટિંગ ટાઇમ", "મુંબઈમાં સ્ટેશન", "સલામતી માર્ગદર્શિકા"],
  es: ["Estaciones con alta presión", "Menor tiempo de espera", "Estaciones en Mumbai", "Seguridad GNC"],
  fr: ["Haute pression", "Temps d'attente court", "Stations à Mumbai", "Conseils sécurité"],
  de: ["Hoher Druck", "Kürzeste Wartezeit", "Stationen in Mumbai", "Sicherheitstipps"]
};

// DOM references
let chatElements = {};

document.addEventListener('DOMContentLoaded', () => {
  initChatElements();
  setupChatListeners();
  initSpeechRecognition();
  renderInitialGreeting();
});

function initChatElements() {
  chatElements = {
    launcherBtn: document.getElementById('aiChatLauncherBtn'),
    widget: document.getElementById('aiChatWidget'),
    closeBtn: document.getElementById('closeChatBtn'),
    clearBtn: document.getElementById('clearChatBtn'),
    langSelect: document.getElementById('chatLangSelect'),
    messagesList: document.getElementById('chatMessagesList'),
    suggestionsBox: document.getElementById('chatSuggestionsBox'),
    inputForm: document.getElementById('chatInputForm'),
    input: document.getElementById('chatInput'),
    voiceBtn: document.getElementById('voiceInputBtn'),
    openVoiceHudBtn: document.getElementById('chatOpenVoiceHudBtn'),
    sendBtn: document.getElementById('sendChatBtn'),
    typingIndicator: document.getElementById('chatTypingIndicator')
  };
}

function setupChatListeners() {
  if (!chatElements.launcherBtn) return;

  // Toggle open/close
  chatElements.launcherBtn.addEventListener('click', toggleChatWidget);
  chatElements.closeBtn.addEventListener('click', closeChatWidget);
  chatElements.clearBtn.addEventListener('click', clearChatHistory);

  if (chatElements.openVoiceHudBtn) {
    chatElements.openVoiceHudBtn.addEventListener('click', () => {
      closeChatWidget();
      if (window.openVoiceAssistant) window.openVoiceAssistant();
    });
  }

  // Language Change
  chatElements.langSelect.addEventListener('change', (e) => {
    chatState.currentLang = e.target.value;
    renderInitialGreeting();
    renderSuggestions();
  });

  // Submit message
  chatElements.inputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatElements.input.value.trim();
    if (text) {
      sendMessage(text);
    }
  });

  // Voice recognition toggle
  if (chatElements.voiceBtn) {
    chatElements.voiceBtn.addEventListener('click', toggleVoiceInput);
  }
}

// Open / Close Widget
function toggleChatWidget() {
  chatState.isOpen = !chatState.isOpen;
  if (chatState.isOpen) {
    chatElements.widget.style.display = 'flex';
    chatElements.launcherBtn.classList.add('active');
    setTimeout(() => chatElements.input.focus(), 150);
  } else {
    chatElements.widget.style.display = 'none';
    chatElements.launcherBtn.classList.remove('active');
  }
}

function closeChatWidget() {
  chatState.isOpen = false;
  chatElements.widget.style.display = 'none';
  chatElements.launcherBtn.classList.remove('active');
}

// Clear History
function clearChatHistory() {
  chatElements.messagesList.innerHTML = '';
  chatState.history = [];
  renderInitialGreeting();
}

// Render Initial Greeting
function renderInitialGreeting() {
  const meta = CHAT_LANGUAGES.find((l) => l.code === chatState.currentLang) || CHAT_LANGUAGES[0];
  chatElements.messagesList.innerHTML = '';
  appendBotMessage(meta.greeting);
  renderSuggestions();
}

// Render Suggestions Chips
function renderSuggestions() {
  const chips = PROMPT_SUGGESTIONS[chatState.currentLang] || PROMPT_SUGGESTIONS.en;
  chatElements.suggestionsBox.innerHTML = chips
    .map(
      (text) =>
        `<button type="button" class="chat-chip" onclick="handleSuggestionClick('${escapeJs(text)}')">${escapeHtml(text)}</button>`
    )
    .join('');
}

function handleSuggestionClick(text) {
  sendMessage(text);
}

// Send Message
async function sendMessage(text) {
  if (!text || chatState.isTyping) return;

  chatElements.input.value = '';
  appendUserMessage(text);
  showTyping(true);

  // Get current user coords if active in app
  const userCoords = window.appState && window.appState.userCoords ? window.appState.userCoords : null;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        language: chatState.currentLang,
        userCoords
      })
    });

    const data = await res.json();
    showTyping(false);

    if (res.ok && data.success) {
      const reply = data.data.reply;
      const spokenText = data.data.spokenText || reply;
      appendBotMessage(reply, data.data.referencedStations, spokenText);

      // Auto-read aloud if voice mode or auto-read enabled
      if (chatState.autoRead && window.voiceSpeak) {
        window.voiceSpeak(spokenText, chatState.currentLang);
      }

      if (data.data.suggestedQuestions && data.data.suggestedQuestions.length > 0) {
        // Refresh prompt suggestions if any
        updateSuggestions(data.data.suggestedQuestions);
      }
    } else {
      appendBotMessage("Sorry, I encountered an issue processing your request. Please try again.");
    }
  } catch (err) {
    console.error('Chat error:', err);
    showTyping(false);
    appendBotMessage("Network error connecting to the AI assistant. Please check your connection.");
  }
}

// Append User Message to UI
function appendUserMessage(text) {
  const row = document.createElement('div');
  row.className = 'chat-message user-message';
  row.innerHTML = `
    <div class="message-bubble user-bubble">
      ${escapeHtml(text)}
    </div>
  `;
  chatElements.messagesList.appendChild(row);
  scrollToBottom();
}

// Append Bot Message to UI
function appendBotMessage(text, referencedStations = [], spokenText = '') {
  const row = document.createElement('div');
  row.className = 'chat-message bot-message';

  // Format bold markdown (**text**) and newlines
  const formattedHtml = formatChatMarkdown(text);

  let stationsHtml = '';
  if (referencedStations && referencedStations.length > 0) {
    stationsHtml = `
      <div class="bot-stations-chips">
        ${referencedStations
        .map(
          (s) => `
          <button type="button" class="station-chip-btn" onclick="openStationDetailModal(${s.id})">
            🔍 View #${s.id} ${escapeHtml(s.name.split('-')[0].trim())}
          </button>
        `
        )
        .join('')}
      </div>
    `;
  }

  const cleanSpoken = spokenText || text;

  row.innerHTML = `
    <div class="bot-avatar-icon">🤖</div>
    <div class="message-bubble bot-bubble">
      <div class="bot-text">${formattedHtml}</div>
      ${stationsHtml}
      <div class="bot-bubble-actions">
        <button type="button" class="bot-speak-btn" title="Listen to response" onclick="handleSpeakChatMessage(this, '${escapeJs(cleanSpoken)}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
          <span>Listen</span>
        </button>
      </div>
    </div>
  `;

  chatElements.messagesList.appendChild(row);
  scrollToBottom();
}

function handleSpeakChatMessage(btn, text) {
  if (window.voiceState && window.voiceState.isSpeaking) {
    if (window.voiceStop) window.voiceStop();
    btn.classList.remove('speaking');
    btn.querySelector('span').textContent = 'Listen';
    return;
  }

  if (window.voiceSpeak) {
    btn.classList.add('speaking');
    btn.querySelector('span').textContent = 'Stop';
    window.voiceSpeak(text, chatState.currentLang, () => {
      btn.classList.remove('speaking');
      btn.querySelector('span').textContent = 'Listen';
    });
  }
}
window.handleSpeakChatMessage = handleSpeakChatMessage;

function showTyping(show) {
  chatState.isTyping = show;
  chatElements.typingIndicator.style.display = show ? 'flex' : 'none';
  if (show) scrollToBottom();
}

function scrollToBottom() {
  chatElements.messagesList.scrollTop = chatElements.messagesList.scrollHeight;
}

function updateSuggestions(list) {
  chatElements.suggestionsBox.innerHTML = list
    .map(
      (text) =>
        `<button type="button" class="chat-chip" onclick="handleSuggestionClick('${escapeJs(text)}')">${escapeHtml(text)}</button>`
    )
    .join('');
}

// Voice Recognition using Web Speech API
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (chatElements.voiceBtn) {
      chatElements.voiceBtn.style.display = 'none';
    }
    return;
  }

  chatState.speechRecognition = new SpeechRecognition();
  chatState.speechRecognition.continuous = false;
  chatState.speechRecognition.interimResults = false;

  chatState.speechRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (transcript) {
      chatElements.input.value = transcript;
      sendMessage(transcript);
    }
    stopListening();
  };

  chatState.speechRecognition.onerror = (e) => {
    console.warn('Speech recognition error:', e.error);
    stopListening();
  };

  chatState.speechRecognition.onend = () => {
    stopListening();
  };
}

function toggleVoiceInput() {
  if (!chatState.speechRecognition) return;

  if (chatState.isListening) {
    chatState.speechRecognition.stop();
    stopListening();
  } else {
    // Map current language code to BCP 47 tag
    const langMap = {
      en: 'en-US',
      hi: 'hi-IN',
      mr: 'mr-IN',
      gu: 'gu-IN',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE'
    };
    chatState.speechRecognition.lang = langMap[chatState.currentLang] || 'en-US';
    try {
      chatState.speechRecognition.start();
      chatState.isListening = true;
      chatElements.voiceBtn.classList.add('listening');
      chatElements.voiceBtn.title = 'Listening... Speak now';
    } catch (e) {
      stopListening();
    }
  }
}

function stopListening() {
  chatState.isListening = false;
  if (chatElements.voiceBtn) {
    chatElements.voiceBtn.classList.remove('listening');
    chatElements.voiceBtn.title = 'Speak message';
  }
}

// Markdown formatting helper
function formatChatMarkdown(text) {
  if (!text) return '';
  let str = escapeHtml(text);
  // Bold **text**
  str = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Newlines to <br/>
  str = str.replace(/\n/g, '<br/>');
  return str;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJs(str) {
  if (str == null) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// Expose globals
window.handleSuggestionClick = handleSuggestionClick;

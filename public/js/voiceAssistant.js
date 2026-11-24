/**
 * CNG Connect — AI Voice Assistant Module
 * Features:
 * - Real-time Speech-to-Text (Web Speech API) with interim streaming
 * - High-definition Text-to-Speech (SpeechSynthesis) across 7 languages
 * - Holographic pulsating visualizer orb & dynamic sound frequency waveform
 * - Hands-free continuous driving conversation mode (auto-listen loop)
 * - Voice command executor (Map toggle, city filter, geolocation, sort, views)
 * - Synthesized Web Audio feedback chimes
 * - Global hotkey 'V' to launch anywhere in the application
 */

const voiceState = {
  isOpen: false,
  isListening: false,
  isSpeaking: false,
  isProcessing: false,
  isMuted: false,
  handsFree: localStorage.getItem('cng_voice_hands_free') === 'true',
  currentLang: 'en',
  speechRecognition: null,
  speechSynth: window.speechSynthesis || null,
  currentUtterance: null,
  audioCtx: null,
  voices: [],
  visualizerInterval: null
};

// Language map for Web Speech API BCP 47 tags & labels
const VOICE_LANGUAGES = {
  en: { bcp: 'en-US', name: 'English', flag: '🇬🇧', hint: 'Ask: "Find high pressure CNG near me" or "Show Delhi stations"' },
  hi: { bcp: 'hi-IN', name: 'हिन्दी', flag: '🇮🇳', hint: 'पूछें: "हाई प्रेशर वाले स्टेशन दिखाएं" या "नक्शा खोलो"' },
  mr: { bcp: 'mr-IN', name: 'मराठी', flag: '🇮🇳', hint: 'विचारा: "पुण्यातील स्टेशन्स दाखवा" किंवा "कमी गर्दी कुठे आहे?"' },
  gu: { bcp: 'gu-IN', name: 'ગુજરાતી', flag: '🇮🇳', hint: 'પૂછો: "હાઇ પ્રેશર સ્ટેશનો" અથવા "નજીકના સ્ટેશન"' },
  es: { bcp: 'es-ES', name: 'Español', flag: '🇪🇸', hint: 'Pregunta: "Estaciones con alta presión" o "Ver mapa"' },
  fr: { bcp: 'fr-FR', name: 'Français', flag: '🇫🇷', hint: 'Demandez: "Stations haute pression" ou "Ouvrir la carte"' },
  de: { bcp: 'de-DE', name: 'Deutsch', flag: '🇩🇪', hint: 'Fragen Sie: "Stationen mit hohem Druck" oder "Karte öffnen"' }
};

const VOICE_PROMPTS = {
  en: [
    "Find stations near me",
    "High pressure in Delhi",
    "Shortest wait time",
    "Show interactive map",
    "CNG Safety Rules"
  ],
  hi: [
    "नजदीकी सीएनजी स्टेशन",
    "दिल्ली में हाई प्रेशर",
    "सबसे कम वेटिंग टाइम",
    "नक्शा खोलो",
    "सीएनजी सुरक्षा नियम"
  ],
  mr: [
    "माझ्या जवळील स्टेशन",
    "पुण्यातील सीएनजी स्टेशन्स",
    "कमी वेटिंग टाईम",
    "मॅप दाखवा",
    "सुरक्षा नियम"
  ],
  gu: [
    "નજીકના સીએનજી સ્ટેશન",
    "હાઇ પ્રેશર સ્ટેશનો",
    "ઓછો વેઇટિંગ ટાઇમ",
    "મેપ ખોલો",
    "સલામતી નિયમ"
  ],
  es: [
    "Estaciones cerca de mí",
    "Alta presión en Mumbai",
    "Menor tiempo de espera",
    "Mostrar mapa",
    "Normas de seguridad"
  ],
  fr: [
    "Stations près de moi",
    "Haute pression à Mumbai",
    "Attente la plus courte",
    "Afficher la carte",
    "Sécurité GNC"
  ],
  de: [
    "Stationen in meiner Nähe",
    "Hoher Druck in Delhi",
    "Kürzeste Wartezeit",
    "Karte anzeigen",
    "Sicherheitstipps"
  ]
};

// DOM Elements cache
let voiceElements = {};

document.addEventListener('DOMContentLoaded', () => {
  initVoiceElements();
  initSpeechEngines();
  setupVoiceListeners();
  updateHandsFreeUI();
});

function initVoiceElements() {
  voiceElements = {
    modal: document.getElementById('voiceAssistantModal'),
    openNavBtn: document.getElementById('openVoiceAssistantBtn'),
    heroVoiceBtn: document.getElementById('heroVoiceBtn'),
    driverVoiceBtn: document.getElementById('driverVoiceBtn'),
    closeBtn: document.getElementById('closeVoiceModalBtn'),
    backdrop: document.getElementById('voiceModalBackdrop'),
    langSelect: document.getElementById('voiceLangSelect'),
    handsFreeToggle: document.getElementById('voiceHandsFreeToggle'),
    muteBtn: document.getElementById('voiceMuteBtn'),
    mainMicBtn: document.getElementById('voiceMainMicBtn'),
    orb: document.getElementById('voiceVisualizerOrb'),
    waveform: document.getElementById('voiceSoundWaveform'),
    statusBadge: document.getElementById('voiceStatusBadge'),
    statusText: document.getElementById('voiceStatusText'),
    transcriptBox: document.getElementById('voiceTranscriptBox'),
    transcriptText: document.getElementById('voiceTranscriptText'),
    interimText: document.getElementById('voiceInterimText'),
    responseBox: document.getElementById('voiceResponseBox'),
    responseText: document.getElementById('voiceResponseText'),
    responseStations: document.getElementById('voiceResponseStations'),
    replayBtn: document.getElementById('voiceReplayBtn'),
    stopBtn: document.getElementById('voiceStopBtn'),
    promptsContainer: document.getElementById('voiceQuickPrompts'),
    hintText: document.getElementById('voiceHintText')
  };
}

function initSpeechEngines() {
  // 1. Speech Recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    voiceState.speechRecognition = new SpeechRecognition();
    voiceState.speechRecognition.continuous = false;
    voiceState.speechRecognition.interimResults = true;

    voiceState.speechRecognition.onstart = () => {
      voiceState.isListening = true;
      voiceState.isProcessing = false;
      updateVisualizerState('listening');
      playChime('start');
      if (voiceElements.interimText) voiceElements.interimText.textContent = 'Listening...';
    };

    voiceState.speechRecognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          final += item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      if (interim && voiceElements.interimText) {
        voiceElements.interimText.textContent = interim;
        voiceElements.interimText.style.display = 'inline';
      }

      if (final) {
        final = final.trim();
        if (voiceElements.transcriptText) {
          voiceElements.transcriptText.textContent = `"${final}"`;
        }
        if (voiceElements.interimText) {
          voiceElements.interimText.style.display = 'none';
        }
        voiceState.lastTranscript = final;
        processVoiceCommand(final);
      }
    };

    voiceState.speechRecognition.onerror = (e) => {
      console.warn('Speech recognition error:', e.error);
      voiceState.isListening = false;
      if (e.error === 'no-speech') {
        if (voiceState.handsFree && voiceState.isOpen) {
          // Restart listening softly if in hands-free mode
          setTimeout(() => {
            if (voiceState.isOpen && !voiceState.isSpeaking) startVoiceListening();
          }, 800);
          return;
        }
      }
      updateVisualizerState('ready');
    };

    voiceState.speechRecognition.onend = () => {
      voiceState.isListening = false;
      if (!voiceState.isProcessing && !voiceState.isSpeaking) {
        updateVisualizerState('ready');
      }
    };
  } else {
    console.warn('Web Speech API (SpeechRecognition) not supported in this browser.');
    if (voiceElements.hintText) {
      voiceElements.hintText.textContent = 'Voice input not supported in this browser. You can type or use prompt chips.';
    }
  }

  // 2. Speech Synthesis
  if (voiceState.speechSynth) {
    const loadVoices = () => {
      voiceState.voices = voiceState.speechSynth.getVoices();
    };
    loadVoices();
    if (voiceState.speechSynth.onvoiceschanged !== undefined) {
      voiceState.speechSynth.onvoiceschanged = loadVoices;
    }
  }
}

function setupVoiceListeners() {
  // Launch Triggers
  if (voiceElements.openNavBtn) {
    voiceElements.openNavBtn.addEventListener('click', () => openVoiceAssistant());
  }
  if (voiceElements.heroVoiceBtn) {
    voiceElements.heroVoiceBtn.addEventListener('click', () => openVoiceAssistant());
  }
  if (voiceElements.driverVoiceBtn) {
    voiceElements.driverVoiceBtn.addEventListener('click', () => openVoiceAssistant());
  }

  // Modal Close
  if (voiceElements.closeBtn) {
    voiceElements.closeBtn.addEventListener('click', () => closeVoiceAssistant());
  }
  if (voiceElements.backdrop) {
    voiceElements.backdrop.addEventListener('click', () => closeVoiceAssistant());
  }

  // Main Mic Action Button
  if (voiceElements.mainMicBtn) {
    voiceElements.mainMicBtn.addEventListener('click', () => {
      if (voiceState.isListening) {
        stopVoiceListening();
      } else if (voiceState.isSpeaking) {
        stopVoiceSpeaking();
      } else {
        startVoiceListening();
      }
    });
  }

  // Language Change
  if (voiceElements.langSelect) {
    voiceElements.langSelect.addEventListener('change', (e) => {
      setVoiceLanguage(e.target.value);
    });
  }

  // Hands Free Toggle
  if (voiceElements.handsFreeToggle) {
    voiceElements.handsFreeToggle.addEventListener('change', (e) => {
      voiceState.handsFree = e.target.checked;
      localStorage.setItem('cng_voice_hands_free', voiceState.handsFree);
      updateHandsFreeUI();
      if (voiceState.handsFree && voiceState.isOpen && !voiceState.isListening && !voiceState.isSpeaking) {
        startVoiceListening();
      }
    });
  }

  // Mute / Unmute Button
  if (voiceElements.muteBtn) {
    voiceElements.muteBtn.addEventListener('click', () => {
      voiceState.isMuted = !voiceState.isMuted;
      voiceElements.muteBtn.classList.toggle('muted', voiceState.isMuted);
      voiceElements.muteBtn.title = voiceState.isMuted ? 'Unmute Assistant' : 'Mute Assistant';
      if (voiceState.isMuted) {
        stopVoiceSpeaking();
      }
    });
  }

  // Replay Last Spoken
  if (voiceElements.replayBtn) {
    voiceElements.replayBtn.addEventListener('click', () => {
      if (voiceState.lastSpoken) {
        speakText(voiceState.lastSpoken, voiceState.currentLang);
      }
    });
  }

  // Stop Speaking
  if (voiceElements.stopBtn) {
    voiceElements.stopBtn.addEventListener('click', () => {
      stopVoiceSpeaking();
    });
  }

  // Keyboard shortcut: 'V' key triggers voice assistant (when not typing in an input)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && voiceState.isOpen) {
      closeVoiceAssistant();
      return;
    }

    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    if (e.key === 'v' || e.key === 'V') {
      e.preventDefault();
      if (voiceState.isOpen) {
        closeVoiceAssistant();
      } else {
        openVoiceAssistant();
      }
    }
  });
}

// Open Voice Assistant HUD
function openVoiceAssistant() {
  voiceState.isOpen = true;
  if (voiceElements.modal) {
    voiceElements.modal.style.display = 'flex';
    document.body.classList.add('voice-modal-open');
  }

  renderVoicePrompts();
  updateVisualizerState('ready');

  // Auto-start listening on open
  setTimeout(() => {
    startVoiceListening();
  }, 350);
}

// Close Voice Assistant HUD
function closeVoiceAssistant() {
  voiceState.isOpen = false;
  stopVoiceListening();
  stopVoiceSpeaking();
  if (voiceElements.modal) {
    voiceElements.modal.style.display = 'none';
    document.body.classList.remove('voice-modal-open');
  }
}

// Set Language
function setVoiceLanguage(langCode) {
  if (!VOICE_LANGUAGES[langCode]) return;
  voiceState.currentLang = langCode;
  if (voiceElements.langSelect) {
    voiceElements.langSelect.value = langCode;
  }
  // Sync with chatbox language selector if available
  const chatLangSelect = document.getElementById('chatLangSelect');
  if (chatLangSelect) {
    chatLangSelect.value = langCode;
    chatLangSelect.dispatchEvent(new Event('change'));
  }

  renderVoicePrompts();
  if (voiceElements.hintText) {
    voiceElements.hintText.textContent = VOICE_LANGUAGES[langCode].hint;
  }
}

function updateHandsFreeUI() {
  if (voiceElements.handsFreeToggle) {
    voiceElements.handsFreeToggle.checked = voiceState.handsFree;
  }
}

// Render Touch/Voice Prompt Pills
function renderVoicePrompts() {
  if (!voiceElements.promptsContainer) return;
  const list = VOICE_PROMPTS[voiceState.currentLang] || VOICE_PROMPTS.en;
  voiceElements.promptsContainer.innerHTML = list
    .map(
      (text) =>
        `<button type="button" class="voice-chip-btn" onclick="window.triggerVoicePrompt('${escapeJs(text)}')">
          <span class="voice-chip-icon">🎙️</span>
          <span>${escapeHtml(text)}</span>
        </button>`
    )
    .join('');
}

function triggerVoicePrompt(promptText) {
  if (voiceElements.transcriptText) {
    voiceElements.transcriptText.textContent = `"${promptText}"`;
  }
  processVoiceCommand(promptText);
}
window.triggerVoicePrompt = triggerVoicePrompt;

// Start Speech Recognition
function startVoiceListening() {
  if (!voiceState.speechRecognition) {
    console.warn('Speech recognition not available.');
    return;
  }

  stopVoiceSpeaking();

  const langMeta = VOICE_LANGUAGES[voiceState.currentLang] || VOICE_LANGUAGES.en;
  voiceState.speechRecognition.lang = langMeta.bcp;

  try {
    voiceState.speechRecognition.start();
  } catch (err) {
    // If already active, restart
    if (err.name === 'InvalidStateError') {
      try {
        voiceState.speechRecognition.stop();
        setTimeout(() => voiceState.speechRecognition.start(), 200);
      } catch (e) {
        console.warn('Error restarting recognition:', e);
      }
    }
  }
}

// Stop Speech Recognition
function stopVoiceListening() {
  if (voiceState.speechRecognition && voiceState.isListening) {
    try {
      voiceState.speechRecognition.stop();
    } catch (e) {}
  }
  voiceState.isListening = false;
}

// Stop Speech Synthesis
function stopVoiceSpeaking() {
  if (voiceState.speechSynth) {
    voiceState.speechSynth.cancel();
  }
  voiceState.isSpeaking = false;
  updateVisualizerState('ready');
}

// Process Command with Server Grounding + Fast Client-Side Actions
async function processVoiceCommand(rawText) {
  if (!rawText || !rawText.trim()) return;
  const query = rawText.trim();

  stopVoiceListening();
  voiceState.isProcessing = true;
  updateVisualizerState('processing');

  // Check fast local client-side commands
  const lower = query.toLowerCase();
  if (/stop talking|be quiet|shut up|mute assistant|चुप|थांब|શાંત/i.test(lower)) {
    stopVoiceSpeaking();
    updateVisualizerState('ready');
    return;
  }

  // Get current user location coords from app
  const userCoords = window.appState && window.appState.userCoords ? window.appState.userCoords : null;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: query,
        language: voiceState.currentLang,
        userCoords
      })
    });

    const result = await res.json();
    voiceState.isProcessing = false;

    if (res.ok && result.success && result.data) {
      handleVoiceResponse(result.data);
    } else {
      handleVoiceError("I encountered an issue searching station telemetry. Please try again.");
    }
  } catch (err) {
    console.error('Voice assistant error:', err);
    voiceState.isProcessing = false;
    handleVoiceError("Network connection error. Please check your internet connection.");
  }
}

// Handle AI response & Execute Action
function handleVoiceResponse(data) {
  const { reply, spokenText, action, referencedStations } = data;
  const textToSpeak = spokenText || stripMarkdown(reply);
  voiceState.lastSpoken = textToSpeak;

  // Display Response in UI
  if (voiceElements.responseText) {
    voiceElements.responseText.innerHTML = formatVoiceMarkdown(reply);
  }

  // Render Referenced Stations
  renderReferencedStations(referencedStations);

  // Execute App Action if present
  if (action) {
    executeVoiceAction(action);
  }

  // Speak Response Out Loud
  speakText(textToSpeak, voiceState.currentLang, () => {
    // On speech finished:
    if (voiceState.handsFree && voiceState.isOpen) {
      // Hands-free continuous loop: brief pause, then listen again
      setTimeout(() => {
        if (voiceState.isOpen && !voiceState.isSpeaking) {
          startVoiceListening();
        }
      }, 700);
    } else {
      updateVisualizerState('ready');
    }
  });
}

function handleVoiceError(msg) {
  if (voiceElements.responseText) {
    voiceElements.responseText.textContent = msg;
  }
  speakText(msg, voiceState.currentLang, () => {
    updateVisualizerState('ready');
  });
}

// Execute Action on Main CNG Connect Web Application
function executeVoiceAction(action) {
  if (!action || !action.type) return;

  switch (action.type) {
    case 'TOGGLE_MAP': {
      if (window.switchView) window.switchView('driver');
      const mapSec = document.getElementById('mapSection');
      const toggleText = document.getElementById('toggleMapText');
      if (mapSec) {
        mapSec.style.display = 'block';
        if (toggleText) toggleText.textContent = 'Hide Map';
        if (window.appState && window.appState.map) {
          setTimeout(() => window.appState.map.invalidateSize(), 250);
        }
      }
      break;
    }

    case 'NAVIGATE': {
      if (window.switchView && action.view) {
        window.switchView(action.view);
      }
      break;
    }

    case 'FILTER_CITY': {
      if (window.exploreCityStations && action.city) {
        window.exploreCityStations(action.city);
      }
      break;
    }

    case 'RESET_FILTERS': {
      const resetBtn = document.getElementById('resetFiltersBtn');
      if (resetBtn) {
        resetBtn.click();
      }
      break;
    }

    case 'GEOLOCATE': {
      if (window.switchView) window.switchView('driver');
      const geoBtn = document.getElementById('geoLocateBtn');
      if (geoBtn) {
        geoBtn.click();
      }
      break;
    }

    case 'FILTER_PRESSURE': {
      if (window.switchView) window.switchView('driver');
      const filterP = document.getElementById('filterPressure');
      if (filterP) {
        filterP.value = 'high';
        if (window.appState) {
          window.appState.filters.pressure = 'high';
          if (window.fetchStations) window.fetchStations();
        }
      }
      break;
    }

    case 'SORT_STATIONS': {
      if (window.switchView) window.switchView('driver');
      const sortSelect = document.getElementById('sortBy');
      if (sortSelect && action.sortBy) {
        sortSelect.value = action.sortBy;
        if (window.appState) {
          window.appState.filters.sortBy = action.sortBy;
          if (window.fetchStations) window.fetchStations();
        }
      }
      break;
    }
  }
}

// Render Compact Station Cards in Voice Assistant HUD
function renderReferencedStations(stations) {
  if (!voiceElements.responseStations) return;

  if (!stations || stations.length === 0) {
    voiceElements.responseStations.innerHTML = '';
    return;
  }

  voiceElements.responseStations.innerHTML = `
    <div class="voice-stations-header">
      <span>📍 Referenced Stations (${stations.length}):</span>
    </div>
    <div class="voice-stations-grid">
      ${stations
        .map((s) => {
          const isAvail = s.status === 'available';
          const pressBadge = s.pressure ? `<span class="voice-stat-pill pressure">⚡ ${s.pressure} bar</span>` : '';
          const waitBadge = s.wait != null ? `<span class="voice-stat-pill wait">⏱️ ${s.wait} min</span>` : '';
          const distBadge = s.distance != null ? `<span class="voice-stat-pill dist">🚗 ${s.distance} km</span>` : '';

          return `
            <div class="voice-station-mini-card">
              <div class="voice-station-top">
                <h5 class="voice-station-title">${escapeHtml(s.name.split('-')[0].trim())}</h5>
                <span class="voice-avail-indicator ${isAvail ? 'available' : 'unavailable'}">
                  ${isAvail ? '● Live' : '● Offline'}
                </span>
              </div>
              <p class="voice-station-sub">${escapeHtml(s.area)}, ${escapeHtml(s.city)}</p>
              <div class="voice-station-stats">
                ${pressBadge}
                ${waitBadge}
                ${distBadge}
              </div>
              <div class="voice-station-actions">
                <button type="button" class="btn btn-sm btn-outline-voice" onclick="window.voiceOpenStation(${s.id})">
                  View Telemetry
                </button>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function voiceOpenStation(stationId) {
  closeVoiceAssistant();
  if (window.openStationDetailModal) {
    window.openStationDetailModal(stationId);
  }
}
window.voiceOpenStation = voiceOpenStation;

// High Definition Text-to-Speech (SpeechSynthesis)
function speakText(text, langCode = 'en', onComplete) {
  if (voiceState.isMuted || !voiceState.speechSynth) {
    if (onComplete) onComplete();
    return;
  }

  stopVoiceSpeaking();

  const clean = stripMarkdown(text);
  if (!clean) {
    if (onComplete) onComplete();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = VOICE_LANGUAGES[langCode] ? VOICE_LANGUAGES[langCode].bcp : 'en-US';
  utterance.rate = 1.02; // natural conversational pacing
  utterance.pitch = 1.0;

  // Best voice selection
  if (voiceState.voices.length > 0) {
    const targetPrefix = utterance.lang.split('-')[0];
    const match = voiceState.voices.find(
      (v) => v.lang.toLowerCase().startsWith(targetPrefix.toLowerCase()) && !v.name.includes('Compact')
    ) || voiceState.voices.find((v) => v.lang.toLowerCase().startsWith(targetPrefix.toLowerCase()));
    if (match) {
      utterance.voice = match;
    }
  }

  utterance.onstart = () => {
    voiceState.isSpeaking = true;
    updateVisualizerState('speaking');
  };

  utterance.onend = () => {
    voiceState.isSpeaking = false;
    if (onComplete) onComplete();
  };

  utterance.onerror = (e) => {
    console.warn('Speech synthesis error:', e);
    voiceState.isSpeaking = false;
    if (onComplete) onComplete();
  };

  voiceState.currentUtterance = utterance;
  voiceState.speechSynth.speak(utterance);
}

// Update Visualizer (Orb & Waveform States)
function updateVisualizerState(state) {
  if (!voiceElements.orb || !voiceElements.statusBadge) return;

  voiceElements.orb.classList.remove('state-ready', 'state-listening', 'state-processing', 'state-speaking');
  voiceElements.orb.classList.add(`state-${state}`);

  if (voiceElements.mainMicBtn) {
    voiceElements.mainMicBtn.classList.remove('listening', 'processing', 'speaking');
    if (state !== 'ready') voiceElements.mainMicBtn.classList.add(state);
  }

  if (voiceElements.statusBadge && voiceElements.statusText) {
    switch (state) {
      case 'listening':
        voiceElements.statusText.textContent = 'Listening... Speak now';
        voiceElements.statusBadge.className = 'voice-status-pill listening';
        startWaveformAnimation(true);
        break;
      case 'processing':
        voiceElements.statusText.textContent = 'Thinking... Analyzing station telemetry';
        voiceElements.statusBadge.className = 'voice-status-pill processing';
        startWaveformAnimation(false);
        break;
      case 'speaking':
        voiceElements.statusText.textContent = 'Speaking response...';
        voiceElements.statusBadge.className = 'voice-status-pill speaking';
        startWaveformAnimation(true);
        break;
      default:
        voiceElements.statusText.textContent = 'Ready — Tap mic or speak a command';
        voiceElements.statusBadge.className = 'voice-status-pill ready';
        stopWaveformAnimation();
        break;
    }
  }
}

// Animate Waveform Frequency Bars
function startWaveformAnimation(active) {
  if (!voiceElements.waveform) return;
  const bars = voiceElements.waveform.querySelectorAll('.wave-bar');
  if (bars.length === 0) return;

  clearInterval(voiceState.visualizerInterval);
  voiceState.visualizerInterval = setInterval(() => {
    bars.forEach((bar, idx) => {
      const height = active ? Math.floor(Math.random() * 42) + 8 : 6;
      bar.style.height = `${height}px`;
    });
  }, 100);
}

function stopWaveformAnimation() {
  clearInterval(voiceState.visualizerInterval);
  if (!voiceElements.waveform) return;
  const bars = voiceElements.waveform.querySelectorAll('.wave-bar');
  bars.forEach((bar) => {
    bar.style.height = '6px';
  });
}

// Synthesized Audio Feedback Chimes using Web Audio API
function playChime(type) {
  if (voiceState.isMuted) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!voiceState.audioCtx) {
      voiceState.audioCtx = new AudioContext();
    }
    const ctx = voiceState.audioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'start') {
      // Gentle ascending two-tone ping
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'success') {
      // Positive chord finish
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (e) {
    // Ignore audio autoplay restrictions
  }
}

// Utility: Strip Markdown Syntax for Speech
function stripMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
    .replace(/\*(.*?)\*/g, '$1')     // Italic
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
    .replace(/[•#`🟢🔴🟡⚪⏱️📍⚡🚗🔍]/g, ' ') // Emojis and bullet chars
    .replace(/\|\s*/g, ', ')
    .replace(/\n+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatVoiceMarkdown(text) {
  if (!text) return '';
  let str = escapeHtml(text);
  str = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
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

// Expose globals for external modules & chat integration
window.openVoiceAssistant = openVoiceAssistant;
window.closeVoiceAssistant = closeVoiceAssistant;
window.voiceSpeak = speakText;
window.voiceStop = stopVoiceSpeaking;
window.voiceState = voiceState;

const { getStations, db } = require('../db/database');

// Supported Languages and metadata
const SUPPORTED_LANGUAGES = {
  en: { name: 'English', native: 'English', flag: '🇬🇧' },
  hi: { name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  mr: { name: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  gu: { name: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
  es: { name: 'Spanish', native: 'Español', flag: '🇪🇸' },
  fr: { name: 'French', native: 'Français', flag: '🇫🇷' },
  de: { name: 'German', native: 'Deutsch', flag: '🇩🇪' }
};

// Multilingual translations and responses dictionary
const TRANSLATIONS = {
  en: {
    greeting: "Hello! I am the CNG Connect Assistant. How can I help you today? You can ask about stations from our verified database by city, reported pressure, estimated queue times, or CNG safety tips.",
    unknownIntent: "I didn't quite catch that. You can ask me about stations by city (e.g., Delhi, Mumbai, Pune), high pressure stations, waiting times, or safety guidelines.",
    noStationsFound: "No stations found matching your criteria in our database. Try asking about Delhi, Mumbai, Pune, or Noida.",
    stationSummaryHeader: "Here are the top stations matching your request:",
    available: "Available",
    unavailable: "Unavailable",
    waitMins: "mins wait",
    pressure: "Pressure",
    safetyTips: "Here are important CNG vehicle safety guidelines:\n• Always turn off your engine before refueling.\n• Ensure passengers step out of the vehicle during dispensing.\n• Hydrostatic testing of CNG cylinders is mandatory every 3 years.\n• Never tamper with the compliance plate or gas pipeline valves.\n• Avoid using mobile phones near the dispensing island.",
    spokenSafety: "Important CNG safety guidelines: Always turn off your engine before refueling. Ensure passengers step out during dispensing, and carry out mandatory cylinder hydro testing every three years.",
    actionMap: "Opening the interactive CNG station map.",
    actionHome: "Navigating to the CNG Connect homepage.",
    actionAdmin: "Opening the CNG Admin management portal.",
    actionReset: "Resetting all filters and showing all active CNG stations.",
    actionNearMe: "Scanning for nearby CNG stations in our database using your GPS coordinates.",
    stationCountNotice: (count, city) => `Found ${count} station(s)${city ? ` in ${city}` : ''}:`,
    spokenStationSummary: (count, city, top) => {
      if (!top) return `Found ${count} station(s)${city ? ` in ${city}` : ''}.`;
      const wait = top.estimated_wait_minutes != null ? `${top.estimated_wait_minutes} minutes wait` : 'minimal queue';
      const press = top.pressure_bar ? `${top.pressure_bar} bar pressure` : 'good pressure';
      return `Found ${count} station${count > 1 ? 's' : ''}${city ? ` in ${city}` : ''}. The top recommendation is ${top.name.split('-')[0].trim()} in ${top.area}, offering ${press} and about ${wait}. I've updated the display for you.`;
    },
    suggestions: [
      "Find high pressure stations",
      "Which station has the shortest wait time?",
      "Stations in Mumbai",
      "CNG Safety Guidelines"
    ]
  },
  hi: {
    greeting: "नमस्ते! मैं सीएनजी कनेक्ट एआई (CNG Connect AI) हूँ। मैं आज आपकी क्या सहायता कर सकता हूँ? आप नजदीकी स्टेशनों, गैस प्रेशर, वेटिंग टाइम या सीएनजी सुरक्षा सुझावों के बारे में पूछ सकते हैं।",
    unknownIntent: "मुझे आपकी बात पूरी तरह समझ नहीं आई। आप मुझसे शहर (जैसे दिल्ली, मुंबई, पुणे), हाई प्रेशर स्टेशन, वेटिंग टाइम या सुरक्षा नियमों के बारे में पूछ सकते हैं।",
    noStationsFound: "आपके अनुरोध से मेल खाता कोई स्टेशन नहीं मिला। कृपया दिल्ली, मुंबई, पुणे या नोएडा के बारे में पूछें।",
    stationSummaryHeader: "आपके अनुरोध के अनुसार प्रमुख सीएनजी स्टेशन ये हैं:",
    available: "उपलब्ध (Available)",
    unavailable: "अनुपलब्ध (Unavailable)",
    waitMins: "मिनट प्रतीक्षा",
    pressure: "प्रेशर",
    safetyTips: "सीएनजी वाहनों के लिए महत्वपूर्ण सुरक्षा नियम:\n• गैस भरवाते समय हमेशा गाड़ी का इंजन बंद रखें।\n• रिफिलिंग के दौरान सभी यात्रियों को कार से बाहर निकलना चाहिए।\n• हर 3 साल में सीएनजी सिलेंडर का हाइड्रो-टेस्टिंग कराना अनिवार्य है।\n• वाहन के गैस वाल्व या कंप्लायंस प्लेट से कोई छेड़छाड़ न करें।\n• डिस्पेंसिंग एरिया में मोबाइल फोन का इस्तेमाल न करें।",
    spokenSafety: "सीएनजी सुरक्षा नियम: गैस भरवाते समय हमेशा इंजन बंद रखें, सभी यात्रियों को बाहर निकालें, और हर तीन साल में सिलेंडर की हाइड्रो टेस्टिंग कराएं।",
    actionMap: "सीएनजी स्टेशन का लाइव मैप खोला जा रहा है।",
    actionHome: "सीएनजी कनेक्ट के होमपेज पर जाया जा रहा है।",
    actionAdmin: "सीएनजी एडमिन पोर्टल खोला जा रहा है।",
    actionReset: "सभी फ़िल्टर हटाकर सभी स्टेशन दिखाए जा रहे हैं।",
    actionNearMe: "आपके स्थान के आधार पर नजदीकी सीएनजी स्टेशन खोजे जा रहे हैं।",
    stationCountNotice: (count, city) => `${city ? `${city} में ` : ''}${count} स्टेशन मिले:`,
    spokenStationSummary: (count, city, top) => {
      if (!top) return `${city ? `${city} में ` : ''}${count} स्टेशन मिले हैं।`;
      const wait = top.estimated_wait_minutes != null ? `${top.estimated_wait_minutes} मिनट प्रतीक्षा` : 'कम वेटिंग';
      const press = top.pressure_bar ? `${top.pressure_bar} बार प्रेशर` : 'अच्छा प्रेशर';
      return `${city ? `${city} में ` : ''}${count} स्टेशन मिले हैं। सबसे अच्छा विकल्प ${top.name.split('-')[0].trim()} है जहाँ ${press} और लगभग ${wait} का समय है।`;
    },
    suggestions: [
      "हाई प्रेशर वाले स्टेशन दिखाएं",
      "सबसे कम वेटिंग टाइम कहाँ है?",
      "मुंबई में सीएनजी स्टेशन",
      "सीएनजी सुरक्षा नियम"
    ]
  },
  mr: {
    greeting: "नमस्कार! मी सीएनजी कनेक्ट एआय (CNG Connect AI) आहे. आज मी तुम्हाला कशी मदत करू शकतो? तुम्ही जवळील स्टेशन्स, गॅस प्रेशर, वेटिंग टाईम किंवा सुरक्षेविषयी माहिती विचारू शकता.",
    unknownIntent: "मला तुमचा प्रश्न पूर्णपणे समजला नाही. तुम्ही मला शहर (उदा. पुणे, मुंबई, दिल्ली), हाय प्रेशर स्टेशन्स किंवा वेटिंग टाईमबद्दल विचारू शकता.",
    noStationsFound: "या निकषांनुसार कोणतेही स्टेशन आढळले नाही. कृपया पुणे किंवा मुंबईबद्दल विचारून पहा.",
    stationSummaryHeader: "तुमच्या विनंतीनुसार प्रमुख सीएनजी स्टेशन्स खालीलप्रमाणे आहेत:",
    available: "उपलब्ध",
    unavailable: "अनुपलब्ध",
    waitMins: "मिनिटे प्रतीक्षा",
    pressure: "प्रेशर",
    safetyTips: "सीएनजी वाहनांसाठी आवश्यक सुरक्षा नियम:\n• सीएनजी भरताना नेहमी इंजिन बंद ठेवा.\n• रिफिलिंग सुरू असताना सर्व प्रवाशांनी गाडीबाहेर थांबावे.\n• दर ३ वर्षांनी सीएनजी सिलिंडरचे हायड्रो-टेस्टिंग करणे बंधनकारक आहे.\n• गॅस पाईप किंवा व्हॉल्व्हमध्ये स्वतः फेरबदल करू नका.\n• पंपावर मोबाईल फोन वापरणे टाळा.",
    spokenSafety: "सीएनजी सुरक्षा नियम: गॅस भरताना इंजिन बंद ठेवा, प्रवाशांनी बाहेर उभे राहावे, आणि दर तीन वर्षांनी हायड्रो टेस्टिंग करणे आवश्यक आहे.",
    actionMap: "सीएनजी स्टेशन्सचा लाईव्ह नकाशा उघडत आहे.",
    actionHome: "होमपेजवर जात आहे.",
    actionAdmin: "अॅडमिन पोर्टल उघडत आहे.",
    actionReset: "सर्व फिल्टर्स रीसेट करून सर्व स्टेशन्स दाखवत आहे.",
    actionNearMe: "तुमच्या जवळचे सीएनजी स्टेशन्स शोधत आहे.",
    stationCountNotice: (count, city) => `${city ? `${city} मध्ये ` : ''}${count} स्टेशन्स सापडले:`,
    spokenStationSummary: (count, city, top) => {
      if (!top) return `${city ? `${city} मध्ये ` : ''}${count} स्टेशन्स सापडले आहेत.`;
      const wait = top.estimated_wait_minutes != null ? `${top.estimated_wait_minutes} मिनिटे वेटिंग` : 'कमी गर्दी';
      const press = top.pressure_bar ? `${top.pressure_bar} बार प्रेशर` : 'उत्तम प्रेशर';
      return `${city ? `${city} मध्ये ` : ''}${count} स्टेशन्स सापडले आहेत. सर्वात उत्तम स्टेशन ${top.name.split('-')[0].trim()} आहे, जेथे ${press} आणि ${wait} आहे.`;
    },
    suggestions: [
      "पुण्यातील सीएनजी स्टेशन्स",
      "हाय प्रेशर स्टेशन्स दाखवा",
      "कमी वेटिंग टाईम कुठे आहे?",
      "सीएनजी सुरक्षा नियम"
    ]
  },
  gu: {
    greeting: "નમસ્તે! હું સીએનજી કનેક્ટ એઆઈ (CNG Connect AI) છું. આજે હું તમારી શું મદદ કરી શકું? તમે નજીકના સ્ટેશનો, ગેસ પ્રેશર, વેઇટિંગ ટાઇમ અથવા સલામતી ટીપ્સ વિશે પૂછી શકો છો.",
    unknownIntent: "હું તમારી વાત સમજી શક્યો નથી. તમે મને શહેરો (જેમ કે મુંબઈ, પુણે, દિલ્હી), હાઇ પ્રેશર સ્ટેશનો અથવા વેઇટિંગ ટાઇમ વિશે પૂછી શકો છો.",
    noStationsFound: "કોઈ મેળ ખાતું સ્ટેશન મળ્યું નથી. કૃપા કરીને અન્ય વિસ્તાર શોધો.",
    stationSummaryHeader: "તમારી વિનંતી મુજબના મુખ્ય સીએનજી સ્ટેશનો:",
    available: "ઉપલબ્ધ",
    unavailable: "અનુપલબ્ધ",
    waitMins: "મિનિટ વેઇટિંગ",
    pressure: "પ્રેશર",
    safetyTips: "સીએનજી વાહનો માટે મહત્વપૂર્ણ સલામતી માર્ગદર્શિકા:\n• ગેસ ભરતી વખતે હંમેશા એન્જિન બંધ રાખો.\n• રિફિલિંગ દરમિયાન મુસાફરોએ કારની બહાર નીકળી જવું જોઈએ.\n• દર ૩ વર્ષે સીએનજી સિલિન્ડરનું હાઇડ્રો-ટેસ્ટિંગ કરાવવું ફરજિયાત છે.\n• ગેસ પાઇપલાઇન કે વાલ્વ સાથે છેડછાડ કરશો નહીં.\n• સ્ટેશન પર મોબાઇલ ફોનનો ઉપયોગ ટાળો.",
    spokenSafety: "સીએનજી વાહનો માટે સલામતી: રિફિલિંગ વખતે એન્જિન બંધ રાખો અને દર ત્રણ વર્ષે સિલિન્ડરનું હાઇડ્રો ટેસ્ટિંગ કરાવો.",
    actionMap: "લાઇવ સ્ટેશન મેપ ખોલી રહ્યો છું.",
    actionHome: "હોમ પેજ પર જઈ રહ્યો છું.",
    actionAdmin: "એડમિન પોર્ટલ ખોલી રહ્યો છું.",
    actionReset: "બધા ફિલ્ટર્સ રીસેટ કરી બધા સ્ટેશન બતાવી રહ્યો છું.",
    actionNearMe: "નજીકના સીએનજી સ્ટેશનો શોધી રહ્યો છું.",
    stationCountNotice: (count, city) => `${city ? `${city}માં ` : ''}${count} સ્ટેશન મળ્યા:`,
    spokenStationSummary: (count, city, top) => {
      if (!top) return `${city ? `${city}માં ` : ''}${count} સ્ટેશન મળ્યા છે.`;
      const press = top.pressure_bar ? `${top.pressure_bar} બાર પ્રેશર` : 'સારો પ્રેશર';
      return `${city ? `${city}માં ` : ''}${count} સ્ટેશન મળ્યા છે. મુખ્ય સ્ટેશન ${top.name.split('-')[0].trim()} છે જ્યાં ${press} ઉપલબ્ધ છે.`;
    },
    suggestions: [
      "હાઇ પ્રેશર સ્ટેશનો",
      "સૌથી ઓછો વેઇટિંગ ટાઇમ ક્યાં છે?",
      "મુંબઈમાં સીએનજી સ્ટેશન",
      "સલામતી માર્ગદર્શિકા"
    ]
  },
  es: {
    greeting: "¡Hola! Soy el asistente de IA de CNG Connect. ¿En qué puedo ayudarte hoy? Puedes consultar sobre estaciones cercanas, presión del gas, tiempos de espera o consejos de seguridad.",
    unknownIntent: "No entendí del todo tu consulta. Puedes preguntarme por estaciones por ciudad (ej. Delhi, Bombay, Pune), estaciones con alta presión o tiempos de espera.",
    noStationsFound: "No se encontraron estaciones con esos criterios.",
    stationSummaryHeader: "Aquí están las mejores estaciones según tu solicitud:",
    available: "Disponible",
    unavailable: "No disponible",
    waitMins: "minutos de espera",
    pressure: "Presión",
    safetyTips: "Normas esenciales de seguridad para vehículos a GNC:\n• Apague el motor antes de repostar.\n• Los pasajeros deben salir del vehículo durante la carga.\n• La prueba hidrostática del cilindro es obligatoria cada 3 años.\n• No manipule las válvulas ni las tuberías de gas.\n• Evite el uso de teléfonos móviles cerca del surtidor.",
    spokenSafety: "Normas de seguridad: Apague el motor antes de repostar, los pasajeros deben salir del vehículo, y realice la prueba hidrostática cada tres años.",
    actionMap: "Abriendo el mapa interactivo de estaciones.",
    actionHome: "Navegando a la página principal.",
    actionAdmin: "Abriendo el portal de administración.",
    actionReset: "Restableciendo todos los filtros para mostrar todas las estaciones.",
    actionNearMe: "Buscando estaciones cercanas basadas en su ubicación GPS.",
    stationCountNotice: (count, city) => `Se encontraron ${count} estaciones${city ? ` en ${city}` : ''}:`,
    spokenStationSummary: (count, city, top) => {
      if (!top) return `Se encontraron ${count} estaciones${city ? ` en ${city}` : ''}.`;
      return `Se encontraron ${count} estaciones${city ? ` en ${city}` : ''}. La mejor opción es ${top.name.split('-')[0].trim()} con ${top.pressure_bar || 200} bar de presión.`;
    },
    suggestions: [
      "Estaciones con alta presión",
      "¿Dónde hay menor tiempo de espera?",
      "Estaciones en Bombay",
      "Consejos de seguridad GNC"
    ]
  },
  fr: {
    greeting: "Bonjour ! Je suis l'assistant IA de CNG Connect. Comment puis-je vous aider aujourd'hui ? Vous pouvez me poser des questions sur les stations à proximité, la pression, les temps d'attente ou la sécurité.",
    unknownIntent: "Je n'ai pas bien compris votre demande. Vous pouvez demander des stations par ville, haute pression ou temps d'attente.",
    noStationsFound: "Aucune station trouvée avec ces critères.",
    stationSummaryHeader: "Voici les stations correspondant à votre demande :",
    available: "Disponible",
    unavailable: "Indisponible",
    waitMins: "min d'attente",
    pressure: "Pression",
    safetyTips: "Consignes de sécurité importantes pour le GNC :\n• Coupez toujours le moteur avant de faire le plein.\n• Les passagers doivent descendre du véhicule pendant le remplissage.\n• Le test hydrostatique du réservoir est obligatoire tous les 3 ans.\n• Ne modifiez jamais les vannes ou la tuyauterie de gaz.\n• Évitez d'utiliser votre téléphone près de la borne.",
    spokenSafety: "Consignes de sécurité GNC : coupez le moteur avant le plein, faites sortir les passagers et effectuez le test hydrostatique tous les trois ans.",
    actionMap: "Ouverture de la carte interactive des stations.",
    actionHome: "Navigation vers la page d'accueil.",
    actionAdmin: "Ouverture du portail d'administration.",
    actionReset: "Réinitialisation de tous les filtres.",
    actionNearMe: "Recherche des stations à proximité via vos coordonnées GPS.",
    stationCountNotice: (count, city) => `${count} station(s) trouvée(s)${city ? ` à ${city}` : ''} :`,
    spokenStationSummary: (count, city, top) => {
      if (!top) return `${count} station(s) trouvée(s)${city ? ` à ${city}` : ''}.`;
      return `${count} station(s) trouvée(s)${city ? ` à ${city}` : ''}. La recommandation principale est ${top.name.split('-')[0].trim()}.`;
    },
    suggestions: [
      "Stations à haute pression",
      "Temps d'attente le plus court",
      "Stations à Mumbai",
      "Conseils de sécurité"
    ]
  },
  de: {
    greeting: "Hallo! Ich bin der KI-Assistent von CNG Connect. Wie kann ich Ihnen heute helfen? Sie können nach Tankstellen in der Nähe, Fülldruck, Wartezeiten oder Sicherheitstipps fragen.",
    unknownIntent: "Ich habe Ihre Frage leider nicht verstanden. Sie können nach Städten (z.B. Delhi, Mumbai, Pune), Hochdruckstationen oder Wartezeiten fragen.",
    noStationsFound: "Keine passenden Tankstellen gefunden.",
    stationSummaryHeader: "Hier sind passende CNG-Tankstellen für Sie:",
    available: "Verfügbar",
    unavailable: "Nicht verfügbar",
    waitMins: "Minuten Wartezeit",
    pressure: "Druck",
    safetyTips: "Wichtige Sicherheitsrichtlinien für Erdgasfahrzeuge (CNG):\n• Vor dem Betanken immer den Motor abstellen.\n• Passagiere sollten während der Betankung das Fahrzeug verlassen.\n• Eine hydrostatische Druckprüfung des Zylinders ist alle 3 Jahre vorgeschrieben.\n• Ventile und Gasleitungen niemals manipulieren.\n• Kein Mobiltelefon an der Zapfsäule verwenden.",
    spokenSafety: "Sicherheitsrichtlinien für CNG: Stellen Sie den Motor vor dem Betanken ab, lassen Sie Passagiere aussteigen und führen Sie alle drei Jahre eine hydrostatische Druckprüfung durch.",
    actionMap: "Die interaktive CNG-Tankstellenkarte wird geöffnet.",
    actionHome: "Zur Startseite wechseln.",
    actionAdmin: "Das Administrationsportal wird geöffnet.",
    actionReset: "Alle Filter zurücksetzen und alle Stationen anzeigen.",
    actionNearMe: "Suche nach CNG-Tankstellen in Ihrer Nähe über GPS.",
    stationCountNotice: (count, city) => `${count} Station(en) gefunden${city ? ` in ${city}` : ''}:`,
    spokenStationSummary: (count, city, top) => {
      if (!top) return `${count} Station(en) gefunden${city ? ` in ${city}` : ''}.`;
      return `${count} Station(en) gefunden${city ? ` in ${city}` : ''}. Die beste Empfehlung ist ${top.name.split('-')[0].trim()}.`;
    },
    suggestions: [
      "Stationen mit hohem Druck",
      "Kürzeste Wartezeiten",
      "Stationen in Mumbai",
      "Sicherheitsrichtlinien"
    ]
  }
};

/**
 * Process a user message and generate a grounded, multilingual response
 */
async function processChatMessage({ message, language = 'en', userCoords }) {
  const langKey = SUPPORTED_LANGUAGES[language] ? language : 'en';
  const t = TRANSLATIONS[langKey] || TRANSLATIONS.en;

  const rawLower = (message || '').toLowerCase().trim();

  // 1. Direct Voice Commands / App Actions
  // 1a. Map Toggle Command
  if (/^(show|open|view|display)\s*(the\s*)?map|interactive map|नक्शा|मॅप|carte|karte|mapa/i.test(rawLower)) {
    return {
      reply: `🗺️ **${t.actionMap || "Opening the interactive CNG station map."}**\n\nThe map is now visible with station locations, reported pressure indicators, and queue estimates from our database.`,
      spokenText: t.actionMap || "Opening the interactive CNG station map.",
      language: langKey,
      action: { type: 'TOGGLE_MAP', state: 'show' },
      suggestedQuestions: t.suggestions,
      referencedStations: []
    };
  }

  // 1b. Navigation Commands: Home
  if (/^(go|navigate|back|return)\s*(to\s*)?(the\s*)?(home|homepage)|होम|accueil|startseite/i.test(rawLower) || rawLower === 'home') {
    return {
      reply: `🏠 **${t.actionHome || "Navigating to the CNG Connect homepage."}**`,
      spokenText: t.actionHome || "Navigating to the CNG Connect homepage.",
      language: langKey,
      action: { type: 'NAVIGATE', view: 'home' },
      suggestedQuestions: t.suggestions,
      referencedStations: []
    };
  }

  // 1c. Navigation Commands: Admin
  if (/^(open|go\s*to|show)\s*(the\s*)?(admin|portal|management|dashboard)|एडमिन|admin portal/i.test(rawLower)) {
    return {
      reply: `⚙️ **${t.actionAdmin || "Opening the CNG Admin management portal."}**\n\nAuthorized managers can update station operational details and manage database records.`,
      spokenText: t.actionAdmin || "Opening the CNG Admin management portal.",
      language: langKey,
      action: { type: 'NAVIGATE', view: 'admin' },
      suggestedQuestions: t.suggestions,
      referencedStations: []
    };
  }

  // 1d. Reset filters
  if (/reset|clear\s*(filters|search|all)|show\s*all\s*stations|सारे\s*स्टेशन|रीसेट/i.test(rawLower)) {
    return {
      reply: `🔄 **${t.actionReset || "Resetting all filters and showing all active CNG stations."}**`,
      spokenText: t.actionReset || "Resetting all filters and showing all active CNG stations.",
      language: langKey,
      action: { type: 'RESET_FILTERS' },
      suggestedQuestions: t.suggestions,
      referencedStations: []
    };
  }

  // 2. Greetings
  if (/^(hi|hello|hey|namaste|bonjour|hola|hallo|greetings|start|good\s*(morning|evening|afternoon))/i.test(rawLower)) {
    return {
      reply: t.greeting,
      spokenText: t.greeting,
      language: langKey,
      suggestedQuestions: t.suggestions,
      referencedStations: []
    };
  }

  // 3. Safety guidelines
  if (
    /safe|safety|cylinder|hydro|test|precaution|danger|सुरक्षा|नियम|સલામતી|seguridad|sécurité|sicherheit/i.test(
      rawLower
    )
  ) {
    return {
      reply: t.safetyTips,
      spokenText: t.spokenSafety || t.safetyTips.replace(/[•\n]/g, ' '),
      language: langKey,
      suggestedQuestions: t.suggestions,
      referencedStations: []
    };
  }

  // 4. Detect city filter
  let detectedCity = null;
  if (/delhi|noida|gurugram|faridabad|connaught|lajpat|dwarka|दिल्ली|नोएडा|गुडगांव|फरीदाबाद/i.test(rawLower)) {
    detectedCity = 'New Delhi';
  } else if (/mumbai|thane|vashi|bkc|andheri|dadar|bombay|मुंबई|ठाणे|वाशी|अंधेरी|दादर|મુંબઈ/i.test(rawLower)) {
    detectedCity = 'Mumbai';
  } else if (/pune|hinjewadi|shivajinagar|hadapsar|पुणे|हिंजवडी|शिवाजीनगर|हडपसर/i.test(rawLower)) {
    detectedCity = 'Pune';
  }

  // 5. Detect operational preferences
  const wantsNearMe = /near me|nearby|nearest|closest|around me|पास|नजदीक|जवळ|પાસે|cerca|proche|nähe/i.test(rawLower);
  const wantsHighPressure = /high pressure|pressure|bar|200|प्रेशर|दबाव|हाय प्रेशर|હાઇ પ્રેશર|presión|pression|druck/i.test(
    rawLower
  );
  const wantsShortWait = /wait|queue|fast|quick|line|time|भीड़|वेटिंग|कमी वेट|कम वेट|પ્રતીક્ષા|espera|attente|warte/i.test(
    rawLower
  );
  const wantsAvailable = /available|open|working|chal raha|उपलब्ध|चालू|ઉપલબ્ધ|disponible|verfügbar/i.test(
    rawLower
  );

  // Query station database
  const queryOptions = {
    sortBy: wantsShortWait ? 'wait_time' : wantsHighPressure ? 'pressure' : 'default'
  };

  if (detectedCity) {
    queryOptions.city = detectedCity;
  }
  if (wantsAvailable) {
    queryOptions.availability = 'available';
  }
  if (wantsHighPressure) {
    queryOptions.pressure = 'high';
  }

  if (userCoords && userCoords.latitude && userCoords.longitude) {
    queryOptions.userLat = userCoords.latitude;
    queryOptions.userLng = userCoords.longitude;
    if (!wantsShortWait && !wantsHighPressure) {
      queryOptions.sortBy = 'distance';
    }
  }

  const stations = getStations(queryOptions);

  if (!stations || stations.length === 0) {
    return {
      reply: t.noStationsFound,
      spokenText: t.noStationsFound,
      language: langKey,
      suggestedQuestions: t.suggestions,
      referencedStations: []
    };
  }

  // Limit to top 3-4 stations for conversational readability
  const topStations = stations.slice(0, 4);

  let replyText = `${t.stationCountNotice(stations.length, detectedCity)}\n\n`;

  topStations.forEach((s, index) => {
    const isAvail = s.availability_status === 'available';
    const statusText = isAvail ? t.available : t.unavailable;
    const statusIcon = isAvail ? '🟢' : '🔴';
    const pressureStr = s.pressure_bar ? `${s.pressure_bar} bar` : s.pressure_status || 'N/A';
    const waitStr = s.estimated_wait_minutes != null ? `${s.estimated_wait_minutes} ${t.waitMins}` : 'Wait time unknown';
    const distStr = s.distance_km != null ? ` (${s.distance_km} km straight-line est.)` : '';
    const demoTag = s.is_demo ? ' *(Sample Demo)*' : '';

    replyText += `${index + 1}. **${s.name}**${demoTag}\n   📍 ${s.area}, ${s.city}${distStr}\n   ${statusIcon} Status: ${statusText} | ${t.pressure}: ${pressureStr} | ⏱️ ${waitStr}\n\n`;
  });

  // Synthesize spoken text
  const spokenText = t.spokenStationSummary
    ? t.spokenStationSummary(stations.length, detectedCity, topStations[0])
    : `Found ${stations.length} stations. The top recommendation is ${topStations[0].name}.`;

  // Attach actionable intent
  let action = null;
  if (wantsNearMe && (!userCoords || !userCoords.latitude)) {
    action = { type: 'GEOLOCATE' };
  } else if (detectedCity) {
    action = { type: 'FILTER_CITY', city: detectedCity };
  } else if (wantsHighPressure) {
    action = { type: 'FILTER_PRESSURE', pressure: 'high' };
  } else if (wantsShortWait) {
    action = { type: 'SORT_STATIONS', sortBy: 'wait_time' };
  }

  return {
    reply: replyText.trim(),
    spokenText,
    action,
    language: langKey,
    suggestedQuestions: t.suggestions,
    referencedStations: topStations.map(s => ({
      id: s.id,
      name: s.name,
      city: s.city,
      area: s.area,
      status: s.availability_status,
      pressure: s.pressure_bar,
      wait: s.estimated_wait_minutes,
      distance: s.distance_km
    }))
  };
}

module.exports = {
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  processChatMessage
};

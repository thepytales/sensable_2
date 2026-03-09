import { SCENARIOS, ASSETS } from "./data.js";

window.app = window.app || {};

// Dummy Exports (damit bestehende Imports in script.js nicht brechen)
export function initRightSidebar() {
    // Wird von script.js aufgerufen
}
export function updateAnalysisUI() {
    // Wird von script.js aufgerufen
}

// === SICHERHEIT ===
window.app.escapeHTML = function(str) {
    if (!str) return "";
    return String(str).replace(/[&<>'"]/g, function(tag) {
        const charsToReplace = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
        return charsToReplace[tag] || tag;
    });
};

// === APP ZUSTÄNDE & NAVIGATION ===
window.app.currentMode = 'planner'; // 'planner', 'editor', 'play'

window.app.applyModeUI = function() {
    const isEditor = window.app.currentMode === 'editor';
    const isPlay = window.app.currentMode === 'play';

    const topBar = document.getElementById('main-top-bar');
    const brandText = document.getElementById('main-brand-text');
    
    if (isEditor || isPlay) {
        document.body.classList.add('theme-scenario');
    } else {
        document.body.classList.remove('theme-scenario');
    }

    if (topBar && brandText) {
        if (isEditor || isPlay) {
            topBar.style.borderBottom = '1px solid rgba(16, 185, 129, 0.4)';
            brandText.style.color = '#10b981';
            brandText.innerText = isPlay ? 'SensAble Play' : 'SensAble Editor';
        } else {
            topBar.style.borderBottom = ''; 
            brandText.style.color = '';     
            brandText.innerText = 'SensAble Planer';
        }
    }

    const stdTopBar = document.querySelector('#ui-layer .top-bar');
    const stdSidebarL = document.querySelector('#ui-layer .sidebar');
    const stdSidebarR = document.querySelector('#ui-layer .sidebar-right');
    const playUiNodes = document.querySelectorAll('#scenario-ui-layer');

    if (isPlay) {
        if (stdTopBar) stdTopBar.style.display = 'none';
        if (stdSidebarL) stdSidebarL.style.display = 'none';
        if (stdSidebarR) stdSidebarR.style.display = 'none';
        playUiNodes.forEach(node => node.style.display = 'block');

        if (window.app.updateHUDTasks) window.app.updateHUDTasks();

        const toolGridNodes = document.querySelectorAll('#scenario-hud-tools');
        toolGridNodes.forEach(toolGrid => {
            if (toolGrid) {
                toolGrid.innerHTML = '';
                const tools = (window.app.scenarioData && window.app.scenarioData.allowedTools) ? window.app.scenarioData.allowedTools : [];
                if (tools.length === 0) {
                    toolGrid.innerHTML = `<div style="grid-column: 1 / -1; font-size: 11px; color: #6b7280; text-align: center; padding: 10px 0;">Keine Werkzeuge erlaubt.</div>`;
                } else {
                    tools.forEach(key => {
                        const name = ASSETS.furniture[key]?.name || key;
                        toolGrid.innerHTML += `<button style="font-size: 11px; padding: 8px 4px;" onclick="app.addFurniture('${key}')">+ ${name}</button>`;
                    });
                }
            }
        });
    } else {
        if (stdTopBar) stdTopBar.style.display = 'flex';
        if (stdSidebarL) stdSidebarL.style.display = 'flex';
        if (stdSidebarR) stdSidebarR.style.display = 'flex';
        playUiNodes.forEach(node => node.style.display = 'none');

        const btnSave = document.getElementById('btn-save');
        const btnLoad = document.getElementById('btn-load');
        const btnPdf = document.getElementById('btn-pdf');
        const btnExpScen = document.getElementById('btn-export-scenario');
        
        if(btnSave) btnSave.style.display = isEditor ? 'none' : 'inline-block';
        if(btnLoad) btnLoad.style.display = isEditor ? 'none' : 'inline-block';
        if(btnPdf) btnPdf.style.display = isEditor ? 'none' : 'inline-block';
        if(btnExpScen) btnExpScen.style.display = isEditor ? 'inline-block' : 'none';
        
        const btnTest = document.getElementById('btn-test-scenario');
        if(btnTest) btnTest.style.display = isEditor ? 'inline-block' : 'none';
        const btnHelp = document.getElementById('btn-editor-help');
        if(btnHelp) btnHelp.style.display = isEditor ? 'inline-block' : 'none';

        const pWiz = document.getElementById('panel-wizard');
        const pPers = document.getElementById('panel-personas');
        if(pWiz) pWiz.style.display = isEditor ? 'none' : 'block';
        if(pPers) pPers.style.display = isEditor ? 'block' : 'none';
        
        const zonePanel = document.getElementById('panel-zones');
        if (zonePanel) zonePanel.style.display = 'block';
        
        const objPanel = document.getElementById('panel-objects');
        if (objPanel) objPanel.style.display = isEditor ? 'none' : 'block';

        if (isEditor) {
            if(pPers) pPers.classList.remove('collapsed');
            const pFurn = document.getElementById('panel-furniture');
            if(pFurn) pFurn.classList.add('collapsed');
        } else {
            if(pWiz) pWiz.classList.remove('collapsed');
            const pFurn = document.getElementById('panel-furniture');
            if(pFurn) pFurn.classList.add('collapsed');
        }

        const pSim = document.getElementById('panel-simulation');
        const pCheck = document.getElementById('panel-check');
        if(pSim) pSim.style.display = isEditor ? 'none' : 'block';
        if(pCheck) pCheck.style.display = isEditor ? 'none' : 'block';
        
        const pDetails = document.getElementById('panel-scenario-details');
        if (pDetails) pDetails.style.display = isEditor ? 'block' : 'none';
        
        const pRules = document.getElementById('panel-scenario-rules');
        if (pRules) pRules.style.display = isEditor ? 'block' : 'none';
    }
};

window.app.engineLoaded = false;

window.app.loadEngine = async function() {
    if (window.app.engineLoaded) return Promise.resolve();
    
    const loader = document.getElementById("loader");
    const txt = document.getElementById("loading-text");
    if(loader) {
        if(txt) txt.innerText = "Lade 3D-Engine...";
        loader.classList.add("active");
    }
    
    try {
        // HIER PASSIERT DIE MAGIE: Skript wird erst jetzt vom Server/Cache geholt!
        await import('../../script.js');
        window.app.engineLoaded = true;
        if(loader) loader.classList.remove("active");
        return Promise.resolve();
    } catch (e) {
        console.error("Fehler beim Laden der Engine:", e);
        if(txt) txt.innerText = "Fehler beim Laden der 3D-Engine!";
        return Promise.reject(e);
    }
};

// Die Start-Funktionen warten (await) nun auf die Engine, bevor sie das UI umschalten!
window.app.startStandardPlanner = async function() {
    await window.app.loadEngine();
    window.app.currentMode = 'planner';
    window.app.scenarioData = { title: "", desc: "", tasks: [], allowedTools: [] };
    if (window.app.updateSettings) window.app.updateSettings(); 
    document.getElementById('homescreen').style.display = 'none';
    const ui = document.getElementById('ui-layer');
    if(ui) ui.style.display = 'flex'; 
    window.app.applyModeUI();
};

window.app.startScenarioEditor = async function() {
    await window.app.loadEngine();
    window.app.currentMode = 'editor';
    window.app.scenarioData = { title: "", desc: "", tasks: [], allowedTools: [] };
    const titleInput = document.getElementById('scenario-title');
    if (titleInput) titleInput.value = "";
    const descInput = document.getElementById('scenario-desc');
    if (descInput) descInput.value = "";
    if (window.app.renderTaskList) window.app.renderTaskList();
    const toolsPreview = document.getElementById('allowed-tools-preview');
    if (toolsPreview) toolsPreview.innerText = "Standardmäßig sind keine Werkzeuge erlaubt.";
    
    if(window.app.editorControlsSet === undefined) {
        const ctrlToggle = document.getElementById('set-controls');
        if(ctrlToggle) ctrlToggle.checked = false;
        window.app.editorControlsSet = true;
    }
    
    if (window.app.updateSettings) window.app.updateSettings(); 
    document.getElementById('homescreen').style.display = 'none';
    const ui = document.getElementById('ui-layer');
    if(ui) ui.style.display = 'flex'; 
    window.app.applyModeUI();
    
    const notif = document.getElementById("notification");
    if(notif) { notif.innerText = "Szenario-Editor gestartet"; notif.classList.add("visible"); setTimeout(() => notif.classList.remove("visible"), 3000); }
};

window.app.startSession = window.app.startStandardPlanner;

window.app.confirmGoHome = function() {
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const modalOverlay = document.getElementById('modal-overlay');
    
    if (modalTitle && modalContent && modalOverlay) {
        modalTitle.innerText = "Hauptmenü";
        modalContent.innerHTML = `
            <p>Möchten Sie wirklich zum Hauptmenü zurückkehren? Nicht gespeicherte Änderungen gehen verloren.</p>
            <div style="display:flex; gap:10px; flex-direction:column; margin-top:20px;">
                <button class="primary" onclick="${window.app.currentMode === 'editor' ? 'alert(\'Export folgt\');' : 'if(window.app.savePlan) window.app.savePlan(); setTimeout(app.goHome, 500);'}">Speichern & Beenden</button>
                <button class="danger" onclick="app.goHome()">Ohne Speichern beenden</button>
            </div>
        `;
        modalOverlay.classList.add('active');
    }
};

window.app.goHome = function() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.body.classList.remove('theme-scenario'); 
    document.getElementById('ui-layer').style.display = 'none';
    document.getElementById('homescreen').style.display = 'flex';
    
    if (window.app.resetLoadUI) window.app.resetLoadUI(); 
    if (window.app.clearRoom) window.app.clearRoom(false); 
    if (window.app.exitSimulationMode) window.app.exitSimulationMode();

    window.app.scenarioData = { title: "", desc: "", tasks: [], allowedTools: [] };
    const titleInput = document.getElementById('scenario-title');
    if (titleInput) titleInput.value = "";
    const descInput = document.getElementById('scenario-desc');
    if (descInput) descInput.value = "";
    if (window.app.renderTaskList) window.app.renderTaskList();
    const toolsPreview = document.getElementById('allowed-tools-preview');
    if (toolsPreview) toolsPreview.innerText = "Standardmäßig sind keine Werkzeuge erlaubt.";
};

// === SETTINGS ===
window.app.toggleSettings = function() {
    const el = document.getElementById('settings-overlay');
    if(el) el.classList.toggle('active');
};

let currentFontScale = 1.0;
window.app.setFontScale = function(delta) {
    currentFontScale = Math.round((currentFontScale + delta) * 10) / 10;
    currentFontScale = Math.max(0.8, Math.min(1.5, currentFontScale));
    
    const valEl = document.getElementById('font-scale-val');
    if(valEl) valEl.innerText = Math.round(currentFontScale * 100) + "%";
    
    const uiLayers = [
        'ui-layer', 'homescreen', 'modal-overlay', 'settings-overlay', 
        'pwa-modal', 'notification', 'loader', 'scenario-dashboard-overlay', 'scenario-mc-modal'
    ];
    
    uiLayers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.zoom = currentFontScale;
    });

    document.querySelectorAll('.name-tag').forEach(tag => {
        tag.style.zoom = currentFontScale;
    });
};

// === CHATBOT LOGIK ===
window.app.toggleChatbot = function() {
    const modal = document.getElementById('chatbot-modal');
    if(modal) {
        modal.style.display = 'flex';
        const input = document.getElementById('chat-input');
        if(input) input.focus();
    }
};

window.app.speakText = function(textToSpeak) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToSpeak.trim());
        utterance.lang = 'de-DE';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    } else {
        alert("Ihr Browser unterstützt die Vorlesefunktion leider nicht.");
    }
};

window.app.startSpeechRecognition = function(btnElement) {
    if (localStorage.getItem('elmeks_speech_consent') === 'true') {
        window.app.executeSpeechRecognition(btnElement);
        return;
    }
    const consentModal = document.getElementById('speech-consent-modal');
    if(consentModal) consentModal.style.display = 'flex';
};

window.app.acceptSpeechConsent = function() {
    localStorage.setItem('elmeks_speech_consent', 'true');
    const consentModal = document.getElementById('speech-consent-modal');
    if(consentModal) consentModal.style.display = 'none';
    const micBtn = document.querySelector('[title="Spracheingabe (Diktieren)"]');
    if(micBtn) window.app.executeSpeechRecognition(micBtn);
};

window.app.declineSpeechConsent = function() {
    const consentModal = document.getElementById('speech-consent-modal');
    if(consentModal) consentModal.style.display = 'none';
};

window.app.executeSpeechRecognition = function(btnElement) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        const errorModal = document.getElementById('speech-error-modal');
        if (errorModal) errorModal.style.display = 'flex';
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'de-DE'; 
    recognition.interimResults = false; 
    recognition.maxAlternatives = 1;

    btnElement.dataset.recording = "true";
    btnElement.style.background = "rgba(239, 68, 68, 0.2)"; 
    btnElement.style.borderColor = "rgba(239, 68, 68, 0.5)";
    btnElement.style.color = "#ef4444";
    
    const input = document.getElementById('chat-input');
    const oldPlaceholder = input ? input.placeholder : "";
    if(input) input.placeholder = "Ich höre zu... (Sprechen Sie jetzt)";

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        if (input) input.value = transcript; 
    };

    recognition.onerror = function(event) {
        console.warn("Spracherkennung Fehler:", event.error);
        if(event.error === 'not-allowed') {
            alert("Sie haben dem Browser den Zugriff auf das Mikrofon verweigert.");
        }
    };

    recognition.onend = function() {
        btnElement.dataset.recording = "false";
        btnElement.style.background = "rgba(255,255,255,0.05)";
        btnElement.style.borderColor = "rgba(255,255,255,0.1)";
        btnElement.style.color = "#9ca3af";
        if(input) input.placeholder = oldPlaceholder;
    };

    try { recognition.start(); } catch(e) { console.error(e); }
};

const chatDatabase = [
    { keywords: ["katarakt", "grauer star", "grauerstar", "blendung", "milchig", "trübe", "star"], response: "Der <b>Graue Star (Katarakt)</b> ist eine Trübung der Augenlinse. In der Simulation führt dies zu einem milchigen Sichtfeld, stark reduzierten Kontrasten und einer extremen Blendempfindlichkeit. Pädagogischer Tipp: Setzen Sie Lernende auf keinen Fall mit Blick frontal zum Fenster und nutzen Sie stark kontrastierende, blendfreie (matte) Materialien auf den Tischen." },
    { keywords: ["glaukom", "grüner star", "innendruck", "grünerstar", "augeninnendruck", "nebel"], response: "Das <b>Glaukom (Grüner Star)</b> wird oft durch erhöhten Augeninnendruck verursacht. Es führt zu schleichenden Gesichtsfeldausfällen (Skotomen) und Nebelsehen. Ein stressfreies, blendfreies Umfeld ist hier besonders wichtig. Achten Sie bei der Raumplanung auf konstante Lichtverhältnisse ohne harte Schattenwürfe, da die Adaption an Helligkeitswechsel stark verlangsamt ist." },
    { keywords: ["cvi", "zerebral", "gehirn", "wimmelbild", "reizüberflutung", "crowding", "hirnschädigung"], response: "<b>CVI (Cerebral Visual Impairment)</b> bedeutet, dass das Gehirn visuelle Reize nicht richtig verarbeiten kann, obwohl das Auge intakt sein könnte. Visuelle Überfüllung (Crowding) führt schnell zu Stress und Erschöpfung. Lösung im Raum: Reizreduktion! Bieten Sie einen ruhigen Sitzplatz (z. B. mit Blick zu einer leeren Wand) und nutzen Sie optisch entschlackte Materialien sowie akustische Trennwände zur Abschirmung." },
    { keywords: ["hemianopsie", "halbseitenblindheit", "schlaganfall", "gesichtsfeldausfall", "halb", "hälfte"], response: "<b>Hemianopsie</b> ist der Ausfall einer kompletten Gesichtsfeldhälfte, oft nach neurologischen Schäden wie einem Schlaganfall oder Tumor. Wichtig für die Planung: Sitzt der Ausfall rechts, sollte das Kind links im Raum sitzen, damit das Unterrichtsgeschehen und die Tafel im gesunden (linken) Sichtfeld liegen. Das Tool simuliert dies durch einen abgedunkelten Bereich auf einer Bildschirmseite im Avatar-Modus." },
    { keywords: ["tunnelblick", "retinitis", "rp", "röhrengesichtsfeld", "röhrenblick", "peripher", "außen"], response: "Beim <b>Tunnelblick</b> (z. B. durch Retinitis Pigmentosa) fällt das periphere (äußere) Sehen vollständig weg. Die Orientierung im Raum ist massiv erschwert, da Hindernisse an den Seiten übersehen werden. Raumplanung: Laufwege müssen zwingend und permanent freigehalten werden (keine Rucksäcke oder Stühle im Gang). Die Simulation im Avatar-Modus zeigt nur einen winzigen zentralen Sichtbereich." },
    { keywords: ["makula", "makuladegeneration", "spot", "stargardt", "zentraler ausfall", "mitte", "fleck"], response: "Bei der <b>Makuladegeneration</b> (oder Morbus Stargardt bei jüngeren Menschen) kommt es zum Ausfall des zentralen, scharfen Sehens. Die Lernenden können Gesichter oder Texte nicht direkt fixieren und nutzen ihr peripheres Sehen (exzentrisches Fixieren). Einfache Vergrößerung von Texten hilft oft nicht, da das Objekt dann komplett in den toten Winkel (den schwarzen Fleck in der Simulation) fällt." },
    { keywords: ["diplopie", "schielen", "strabismus", "doppelbilder", "zwei bilder", "räumlich"], response: "<b>Diplopie (Doppelbilder)</b> oder Strabismus (Schielen) erschweren das räumliche Sehen und die Tiefenwahrnehmung massiv. Dies führt extrem schnell zu Ermüdung und Kopfschmerzen bei der Bildschirm- oder Naharbeit. Im Tool werden diese Doppelbilder visuell simuliert. In der pädagogischen Praxis: Leseportionen strikt einteilen, Pausen einplanen und Assistenz bei motorisch anspruchsvollen, räumlichen Tätigkeiten leisten." },
    { keywords: ["achromatopsie", "farbenblind", "farbe", "rot", "grün", "farbschwäche", "daltonismus", "farbblind"], response: "Das Tool simuliert verschiedene Farbfehlsichtigkeiten, wie die totale Achromatopsie (komplette Farbenblindheit), Protanopie (Rotschwäche) oder Deuteranopie (Grünschwäche). Die wichtigste Regel für Barrierefreiheit hierbei (Zwei-Sinne-Prinzip): Informationen dürfen niemals ausschließlich über Farben codiert werden! Nutzen Sie immer zusätzlich Texturen, Muster, Formen oder Textbeschriftungen, um Bereiche zu kennzeichnen." },
    { keywords: ["autismus", "ass", "adhs", "spektrum", "neurodivers", "reize", "ruhe", "lärmempfindlich"], response: "Für Lernende im <b>Autismus-Spektrum (ASS)</b> oder mit <b>ADHS</b> ist eine vorhersehbare, reizarme Umgebung entscheidend. Reduzieren Sie visuelle Unruhe an den Wänden, stellen Sie klare Raumstrukturen (Zonen) her und dämmen Sie akustische Störquellen konsequent ein. Ein definierter 'Rückzugsort' oder eine Ruhezone im Raumplan ist oft zwingend erforderlich." },
    { keywords: ["hörschädigung", "taub", "schwerhörig", "fm-anlage", "hören", "ci", "cochlea"], response: "Bei <b>Hörschädigungen</b> (auch mit Hörgerät oder CI) ist eine optimale Raumakustik überlebenswichtig. Harter Nachhall macht Sprache unverständlich. Platzieren Sie ausreichend Teppiche und Schallabsorber. Zudem muss der Sitzplatz so gewählt sein, dass das Mundbild der Lehrkraft (Lippenlesen) stets gut sichtbar ist (gute Beleuchtung, keine Gegenlicht-Position)." },
    { keywords: ["motorik", "spastik", "rollator", "gehstützen", "krücken", "laufen"], response: "Neben Rollstühlen müssen auch Nutzer von <b>Rollatoren, Gehstützen</b> oder mit motorischen Einschränkungen (z. B. Spastik) bedacht werden. Hier sind rutschfeste Böden (keine losen Teppichkanten) und breite, hindernisfreie Wege essenziell. Bei motorischer Unruhe sollten Tische gewählt werden, die schwer und stabil sind und nicht leicht wegrutschen." },
    { keywords: ["inklusion", "udl", "universal design", "didaktik", "pädagogik", "konzept", "barrierefrei"], response: "Dieses Tool basiert auf den Prinzipien des <b>Universal Design for Learning (UDL)</b>. Das Ziel der Inklusion ist es nicht, für jeden Einzelfall ein Sonder-Möbelstück zu beschaffen, sondern den Raum von vornherein so flexibel, barrierearm und vielschichtig zu gestalten, dass er für eine möglichst breite Diversität an Lernenden ohne nachträgliche Anpassungen funktioniert." },
    { keywords: ["speichern", "datei", "endung", ".elmeks", "sichern", "download", "herunterladen"], response: "Sie können Ihren aktuellen Raumplan sichern, indem Sie in der oberen Menüleiste auf <b>'Speichern'</b> klicken. Dies erzeugt eine Datei mit der Endung <b>.elmeks</b>. Diese Datei enthält absolut alle Daten: Möbelpositionen, Zonen, definierte Regeln und Avatar-Einstellungen. Es ist eine reine lokale Datei, die Sie sicher auf Ihrem Computer aufbewahren oder per E-Mail an Kollegen senden können." },
    { keywords: ["laden", "öffnen", "import", "importieren", "reinladen", "upload", "hochladen"], response: "Um einen zuvor gespeicherten Raumplan weiterzubearbeiten, klicken Sie oben auf <b>'Laden'</b>. Wählen Sie Ihre zuvor gespeicherte <b>.elmeks</b>-Datei von Ihrer Festplatte aus. Das System verarbeitet die Datei sofort und stellt den kompletten 3D-Raum exakt so wieder her, wie Sie ihn verlassen haben." },
    { keywords: ["pdf", "report", "bericht", "drucken", "auswertung", "dokument", "exportieren", "bewertung"], response: "Über den Button <b>'PDF erstellen'</b> in der oberen Leiste generiert das Tool vollautomatisch einen professionellen, mehrseitigen Bericht. Dieser enthält eine Draufsicht Ihres geplanten Raumes, eine vollständige Inventarliste und eine detaillierte Auswertung der Barrierefreiheit (z. B. Rollstuhlgerechtigkeit der Durchgänge, Raumakustik-Werte und Kontrast-Berechnungen)." },
    { keywords: ["offline", "pwa", "installieren", "app", "internet", "wlan", "verbindung"], response: "Dieses Tool ist als fortschrittliche <b>Progressive Web App (PWA)</b> konzipiert. Das bedeutet: Sobald Sie die Seite einmal im Browser geladen haben, können Sie das Tool auch <b>komplett ohne Internetverbindung (offline)</b> nutzen! Über das Menü Ihres Browsers (z. B. in Chrome oben rechts) können Sie die Seite sogar als vollwertige App auf Ihrem Gerät installieren." },
    { keywords: ["ruckelt", "langsam", "lag", "performance", "hängt", "absturz", "langwierig", "fps"], response: "Wenn die 3D-Ansicht ruckelt oder langsam ist, liegt das meist an fehlender Hardwarebeschleunigung. <b>Tipp:</b> Stellen Sie sicher, dass in den Einstellungen Ihres Browsers (z. B. Chrome oder Edge) die Option 'Hardwarebeschleunigung verwenden' aktiviert ist. Zudem hilft es, andere speicherintensive Tabs zu schließen." },
    { keywords: ["browser", "chrome", "firefox", "safari", "ipad", "tablet", "handy", "smartphone", "kompatibel"], response: "Das Tool ist für moderne Desktop-Browser optimiert (Google Chrome, Mozilla Firefox, Microsoft Edge, Safari). Eine Nutzung auf Tablets (wie dem iPad) ist prinzipiell möglich, erfordert aber bei der 3D-Steuerung etwas Übung. Für kleine Smartphone-Displays ist die komplexe Planungs-Oberfläche nicht ausgelegt." },
    { keywords: ["fehler", "bug", "geht nicht", "kaputt", "problem", "hilfe", "funktioniert nicht"], response: "Sollten unerwartete Fehler auftreten: Laden Sie die Seite mit der Taste <b>F5</b> oder <b>Strg+R</b> neu. Ihre Browser-Daten bleiben dabei meist erhalten. Wenn das Problem weiterhin besteht, löschen Sie den Cache Ihres Browsers oder probieren Sie einen anderen Browser (wir empfehlen Google Chrome)." },
    { keywords: ["steuern", "steuerung", "bewegen", "kamera", "maus", "ansicht", "drehen", "navigieren", "zoomen"], response: "<b>Kamerasteuerung im Planungsmodus:</b><br>• Linke Maustaste halten + ziehen = Kamera schwenken/drehen.<br>• Rechte Maustaste halten + ziehen = Kamera verschieben (Panning).<br>• Mausrad = Hinein- und herauszoomen.<br><br><b>Möbelsteuerung:</b><br>• Linksklick auf ein Möbelstück = Auswählen & Verschieben.<br>• Taste 'R' drücken während ein Möbel ausgewählt ist = Möbelstück drehen.<br>• Taste 'Entf' (Del) = Ausgewähltes Möbelstück löschen." },
    { keywords: ["löschen", "entfernen", "wegmachen", "papierkorb", "rückgängig"], response: "Um ein Objekt oder eine markierte Zone restlos zu löschen, haben Sie zwei Möglichkeiten:<br>1. Klicken Sie das Objekt mit der linken Maustaste an und drücken Sie die <b>'Entf'</b> (Delete) oder 'Rücktaste' (Backspace) auf Ihrer Tastatur.<br>2. Klicken Sie mit der <b>rechten Maustaste</b> auf das Objekt und wählen Sie im erscheinenden Kontextmenü den roten Button 'Löschen'." },
    { keywords: ["möbel", "bibliothek", "katalog", "tisch", "stuhl", "schrank", "inventar", "objekt", "einfügen"], response: "Die umfangreiche <b>Möbel-Bibliothek</b> finden Sie permanent auf der linken Bildschirmseite. Sie ist übersichtlich in Kategorien (Tische, Stühle, Schränke, Akustik, etc.) unterteilt. Klicken Sie einfach auf das gewünschte Objekt. Es wird sofort in der Mitte des Raumes platziert und kann danach mit der Maus frei an die richtige Stelle gezogen werden." },
    { keywords: ["2d", "3d", "draufsicht", "vogelperspektive", "oben", "grundriss", "plan"], response: "Sie können jederzeit zwischen der frei drehbaren 3D-Ansicht und einem strikten 2D-Grundriss wechseln. Nutzen Sie dafür den Button <b>'Draufsicht (2D / 3D)'</b> in der oberen Menüleiste oder im rechten Panel. In der reinen Draufsicht lässt sich die Raumaufteilung oft noch übersichtlicher und präziser planen." },
    { keywords: ["wand", "wände", "raumgröße", "maße", "messen", "abmessung", "größe", "grundriss ändern"], response: "Aktuell arbeiten Sie in einem vordefinierten Standard-Klassenzimmer. Die festen Wände und Fensterfronten bieten eine realistische Grundlage zur Simulation von Licht und Blendung. Eine komplett freie Veränderung der Raumarchitektur (Wände verschieben) ist in dieser Version nicht vorgesehen, da die pädagogischen Missionen an diesen spezifischen Raum gebunden sind." },
    { keywords: ["editor", "modus", "szenario erstellen", "aufgabe erstellen", "lehrkraft", "persona", "schüler"], response: "Der <b>Editor-Modus</b> ist speziell für Lehrkräfte konzipiert. Hier erschaffen Sie eigene Unterrichtsszenarien! Sie können virtuelle Schüler (Personas) im Raum platzieren und im rechten Menü knifflige Regeln festlegen (z. B. 'Maximaler Lärmpegel für Lukas' oder 'Benötigt Hochkontrast-Tisch für Mia'). Speichern Sie das fertige Szenario als .elmeks-Datei ab und geben Sie es Ihren Lernenden zur Lösung." },
    { keywords: ["spielmodus", "mission", "spielen", "aufgabe lösen", "barrieren finden", "rätsel", "lösung"], response: "Im <b>Spielmodus (Mission)</b> schlüpfen Sie in die Rolle eines professionellen Raumplaners. Ihre Aufgabe ist es, einen fehlerhaft eingerichteten Raum zu korrigieren. Suchen Sie nach versteckten Barrieren (z. B. zu enge Gänge für Rollstühle oder eine grauenhafte Akustik) und klicken Sie diese an. Erfüllen Sie alle Vorgaben und Regeln im rechten Panel, um die Mission erfolgreich zu meistern!" },
    { keywords: ["zone", "zonierung", "markierung", "boden", "bereich", "teppich", "fläche"], response: "Mit <b>Zonen</b> (verfügbar in der linken Bibliothek unter 'Markierungen') können Sie Bodenbereiche farblich und semantisch kennzeichnen (z. B. 'Ruhezone' oder 'Verkehrsweg'). Platzieren Sie eine Zone und klicken Sie darauf. Sie können die Eckpunkte an den weißen Anfassern individuell mit der Maus verschieben, um die Form der Zone exakt an die Raumarchitektur anzupassen." },
    { keywords: ["regel", "vorgabe", "bedingung", "abstand", "kriterium", "anforderung"], response: "Im Editor-Modus können Sie strikte <b>Regeln</b> für Ihre Personas aufstellen. Klicken Sie auf eine platzierte Persona und fügen Sie im rechten Menü Bedingungen hinzu, wie z. B. 'Muss in der Ruhezone sitzen', 'Mindestabstand zur Tür: 3 Meter' oder 'Braucht einen Rollstuhltisch'. Diese Regeln bilden das Herzstück für den automatischen Check beim PDF-Export." },
    { keywords: ["akustik", "lärm", "hall", "teppich", "absorber", "laut", "schall", "dezibel", "db"], response: "Die <b>Raumakustik</b> wird vom System in Echtzeit berechnet. Große, leere Räume mit harten Böden erzeugen massiven Nachhall, was für Kinder mit Hörschädigungen oder Konzentrationsschwächen gravierend ist. Lösung: Platzieren Sie schallabsorbierende Elemente aus der linken Bibliothek (wie Akustik-Teppiche, Wand-Absorber oder Trennwände), um den berechneten Lärmpegel signifikant zu senken." },
    { keywords: ["rollstuhl", "durchgang", "platz", "breite", "eng", "kollision", "abstand"], response: "Für <b>Rollstuhlnutzende</b> gelten architektonisch strenge Platzvorgaben. Hauptdurchgänge müssen zwingend mindestens 1,20m bis 1,50m breit sein. Am Arbeitsplatz selbst wird ein Wendekreis von 1,50m x 1,50m benötigt. Das Tool prüft beim PDF-Export per Kollisionsabfrage automatisch, ob zwischen den Möbeln ausreichend Platz bleibt. Ist ein Gang zu eng, schlägt der Report sofort Alarm." },
    { keywords: ["kontrast", "hochkontrast", "barrierefreiheit", "farben", "einstellungen", "ui", "dunkel", "hell"], response: "Über den Schalter <b>'Hochkontrast-Modus'</b> im Einstellungs-Menü können Sie die Benutzeroberfläche (UI) des Tools für Menschen mit Sehbeeinträchtigungen optimieren. Im Raumplaner selbst sollten Sie pädagogisch darauf achten, Tische mit hohem Kontrast zum Fußboden zu wählen (z. B. sehr helle Tische auf einem dunklen Boden), um die räumliche Orientierung deutlich zu erleichtern." },
    { keywords: ["vorlesemodus", "screenreader", "vorlesen", "stimme", "audio", "sprechen", "blind"], response: "In den globalen Einstellungen können Sie den <b>'Vorlesemodus (Hover)'</b> aktivieren. Fahren Sie anschließend einfach mit der Maus über Menüs, Buttons oder Möbelstücke im Raum. Eine synthetische Systemstimme liest Ihnen die fokussierten Elemente präzise laut vor. Dies ist eine essenzielle Unterstützung für Nutzer mit starken Sehbeeinträchtigungen." },
    { keywords: ["avatar", "ich-perspektive", "simulation", "visus", "sehschärfe", "sehen", "figur", "männchen", "person"], response: "<b>Avatar & Simulation aktivieren:</b><br>1. Klicken Sie in der rechten Leiste auf <b>'Avatar setzen'</b>, um eine Spielfigur auf den Boden zu stellen.<br>2. Klicken Sie danach auf <b>'Ich-Perspektive'</b>, um die Kamera direkt in die Augen des Avatars zu verlegen.<br>3. Nutzen Sie nun die Slider im rechten Menü, um den Visus (die prozentuale Sehschärfe) stufenlos zu reduzieren oder komplexe Krankheitsbilder wie Katarakt oder Tunnelblick absolut realistisch aus der First-Person-Sicht zu simulieren." },
    { keywords: ["wer bist du", "was bist du", "bot", "ki", "entwickler", "macher"], response: "Ich bin der <b>SensAble Assistent</b>, ein integrierter Begleiter dieses Tools. Ich wurde entwickelt, um Ihnen direkt im Planer alle Fragen zu Barrierefreiheit, Inklusion und der Steuerung dieser Software zu beantworten, ohne dass Sie ein Handbuch wälzen müssen." },
    { keywords: ["danke", "merci", "perfekt", "super", "hilfreich", "klasse", "gut"], response: "Sehr gerne! Es freut mich, dass ich Ihnen weiterhelfen konnte. Wenn Sie weitere Fragen zur Planung oder zu bestimmten Behinderungsbildern haben, schreiben Sie mir einfach wieder." },
    { keywords: ["hallo", "hi", "hey", "hilfe", "moin", "guten tag", "servus", "grüß gott", "start"], response: "Guten Tag! Ich bin der <b>SensAble Assistent</b>. Ich kenne absolut alle Details zu den simulierten Wahrnehmungsstörungen (wie Katarakt, CVI, Autismus), zur präzisen Steuerung des Raumplaners, den didaktischen Konzepten (UDL) und den Datei-Exporten (PDF, .elmeks). Was genau möchten Sie wissen?" }
];

window.app.sendChatMessage = function() {
    const input = document.getElementById('chat-input');
    const history = document.getElementById('chat-history');
    if(!input || !history) return;
    
    const rawMsg = input.value.trim();
    if(!rawMsg) return;

    const msg = window.app.escapeHTML(rawMsg);

    history.innerHTML += `
        <div style="display: flex; gap: 12px; max-width: 85%; align-self: flex-end; flex-direction: row-reverse;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: #4b5563; flex-shrink: 0; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.2);"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>
            <div style="background: #3b82f6; padding: 16px 20px; border-radius: 16px 4px 16px 16px; color: #ffffff; font-size: 14px; line-height: 1.6; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);">
                ${msg}
            </div>
        </div>
    `;
    input.value = '';
    history.scrollTop = history.scrollHeight;

    setTimeout(() => {
        const lowerMsg = msg.toLowerCase();
        let foundResponse = "Das habe ich leider nicht exakt verstanden. Bitte versuchen Sie, Ihre Frage etwas anders zu formulieren. Fragen Sie am besten nach spezifischen Werkzeugen (z. B. 'Wie exportiere ich ein PDF?'), Simulationen (z. B. 'Was ist CVI?'), Inklusions-Konzepten oder der Steuerung.";
        
        for(let item of chatDatabase) {
            if(item.keywords.some(kw => lowerMsg.includes(kw))) {
                foundResponse = item.response;
                break;
            }
        }

        history.innerHTML += `
            <div style="display: flex; gap: 12px; max-width: 85%;">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: #2563eb; flex-shrink: 0; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(37, 99, 235, 0.2);"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
                <div style="background: rgba(40, 41, 46, 0.8); padding: 16px 20px; border-radius: 4px 16px 16px 16px; color: #e5e7eb; border: 1px solid rgba(255,255,255,0.05); font-size: 14px; line-height: 1.6; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <div class="chat-text-content">${foundResponse}</div>
                    <div style="margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
                        <button onclick="if(window.app && window.app.speakText) window.app.speakText(this.parentElement.previousElementSibling.innerText)" style="display: flex; align-items: center; gap: 6px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); color: #60a5fa; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(59, 130, 246, 0.2)'; this.style.color='#fff'" onmouseout="this.style.background='rgba(59, 130, 246, 0.1)'; this.style.color='#60a5fa'">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                            Antwort vorlesen
                        </button>
                    </div>
                </div>
            </div>
        `;
        history.scrollTop = history.scrollHeight;
    }, 600);
};

// === SZENARIO DASHBOARD ===
window.app.openScenarioDashboard = function() {
    document.getElementById('homescreen').style.display = 'none';
    const dash = document.getElementById('scenario-dashboard-overlay');
    const grid = document.getElementById('scenario-grid');
    if(!grid) return;
    
    grid.innerHTML = '';
    
    Object.keys(SCENARIOS).forEach(key => {
        const s = SCENARIOS[key];
        const diffColor = s.difficulty === 'Leicht' ? '#10b981' : (s.difficulty === 'Mittel' ? '#f59e0b' : '#ef4444');
        
        grid.innerHTML += `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; transition: all 0.2s; cursor: pointer;" 
                 onmouseover="this.style.background='rgba(16, 185, 129, 0.1)'; this.style.borderColor='#10b981'" 
                 onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.borderColor='rgba(255,255,255,0.1)'"
                 onclick="app.triggerScenarioLoad('${key}')">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="margin: 0; color: white; font-size: 15px;">${s.title}</h3>
                    <span style="font-size: 10px; font-weight: bold; background: ${diffColor}40; color: ${diffColor}; padding: 3px 8px; border-radius: 4px;">${s.difficulty}</span>
                </div>
                <p style="font-size: 12px; color: #9ca3af; margin-bottom: 15px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${s.desc}</p>
                <div style="color: #10b981; font-size: 12px; font-weight: bold;">Mission starten ➔</div>
            </div>
        `;
    });
    
    if(dash) dash.style.display = 'flex';
};

window.app.triggerScenarioLoad = async function(id) {
    await window.app.loadEngine();
    if(window.app.loadScenario) window.app.loadScenario(id);
};

// === DATEI UPLOAD LOGIK (Lazy-Ready) ===
window.app.selectedFile = null;
window.app.pendingLoadData = null;

window.app.handleFileSelection = function(input, mode) {
    const file = input.files[0];
    if (!file) return;
    window.app.selectedFile = file;

    if (mode === 'planner') {
        document.getElementById('planner-load-text').innerText = file.name;
        document.getElementById('btn-planner-confirm').style.display = 'block';
        document.getElementById('planner-load-icon').style.display = 'none';
    } else {
        document.getElementById('scenario-load-text').innerText = file.name;
        document.getElementById('btn-scenario-confirm').style.display = 'block';
        document.getElementById('scenario-load-icon').style.display = 'none';
    }
};

window.app.resetLoadUI = function() {
    window.app.selectedFile = null;
    const fi = document.getElementById('file-input');
    if(fi) fi.value = '';
    const sfi = document.getElementById('scenario-file-input');
    if(sfi) sfi.value = '';
    
    const pt = document.getElementById('planner-load-text');
    if(pt) pt.innerText = 'Plan laden';
    const pc = document.getElementById('btn-planner-confirm');
    if(pc) pc.style.display = 'none';
    const pi = document.getElementById('planner-load-icon');
    if(pi) pi.style.display = 'block';

    const st = document.getElementById('scenario-load-text');
    if(st) st.innerText = 'Szenario laden';
    const sc = document.getElementById('btn-scenario-confirm');
    if(sc) sc.style.display = 'none';
    const si = document.getElementById('scenario-load-icon');
    if(si) si.style.display = 'block';
};

window.app.loadAndExecute = async function(mode) {
    await window.app.loadEngine();
    if(window.app.executeLoad) window.app.executeLoad(mode);
};

window.app.confirmLoad = function(mode) {
    const file = window.app.selectedFile;
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            window.app.pendingLoadData = data;

            if (mode === 'scenario') {
                if (data.scenarioData) {
                    const html = `
                        <p style="color:white; font-size:14px; margin-bottom:20px;">Sie haben das Szenario <b>"${data.scenarioData.title}"</b> hochgeladen. Wie möchten Sie fortfahren?</p>
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            <button class="primary" style="padding:12px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-color: #10b981;" onclick="app.loadAndExecute('editor')">Szenario bearbeiten (Editor)</button>
                            <button class="primary" style="padding:12px; background: #2563eb; border-color: #3b82f6;" onclick="app.loadAndExecute('play')">Lernsequenz absolvieren (Spielen)</button>
                        </div>
                    `;
                    const titleEl = document.getElementById('modal-title');
                    const contentEl = document.getElementById('modal-content');
                    if(titleEl && contentEl) {
                        titleEl.innerText = "Szenariomodus wählen";
                        contentEl.innerHTML = html + '<div style="margin-top:20px; text-align:right;"><button class="primary" onclick="document.getElementById(\'modal-overlay\').classList.remove(\'active\')">Schließen</button></div>';
                        document.getElementById('modal-overlay').classList.add('active');
                    }
                } else {
                    alert("Fehler: Diese Datei enthält keine Szenario-Daten.");
                    app.resetLoadUI();
                }
            } else {
                app.loadAndExecute('planner');
            }
        } catch(err) { 
            console.error(err); 
            alert("Fehler beim Lesen der Datei."); 
            app.resetLoadUI();
        }
    };
    reader.readAsText(file);
};
import * as THREE from "three";
import { OrbitControls } from "OrbitControls";
import { GLTFLoader } from "GLTFLoader";
import { OBJLoader } from "OBJLoader";
import { DRACOLoader } from "DRACOLoader";
import Stats from "stats"; // <-- NEU HINZUGEFÜGT

// Eigene Module
import { initRightSidebar } from "./js/modules/ui.js"; 
import { toggleAvatar, toggleAvatarView, isFirstPersonActive } from "./js/modules/avatar.js";
import { SCENARIOS, SIM_GLOSSARY, ASSETS } from "./js/modules/data.js";

// === 1. Setup & Globale Variablen ===
window.app = window.app || {}; 
// XSS-Schutz und UI-Methoden sind nach ui.js ausgelagert.

const GLOBAL_SCALE = 0.6; 
const FURNITURE_Y_OFFSET = 0.22; // Standardhöhe für Möbels
const VISION_LAYER_HEIGHT = 2.2; 
const TOP_VIEW_HEIGHT = 18; 

// === 1b. Szenario & Didaktik Daten ===
let isScenarioMode = false;
let currentScenarioId = null;

// SCENARIOS und SIM_GLOSSARY werden nun aus data.js importiert

// Einstellungen
let settings = {
    controlsEnabled: true, 
    mouseSensitivity: 1.0,
    reducedMotion: false,
    fontScale: 1.0,
    readAloud: false,
    showFPS: false
};

// Input State
const inputState = {
    fwd: false, bwd: false, left: false, right: false,
    zoomIn: false, zoomOut: false 
};

// ASSETS werden nun aus data.js importiert

// THREE.js Variablen
let scene, camera, renderer, controls;
let stats; // <-- NEU
let currentRoomMesh = null;
let currentRoomFile = ""; 
let currentRoomLimits = { x: 5, z: 5 }; 

// Objekt Management
let movableObjects = [];
let interactionMeshes = [];
let selectedObjects = []; 
let selectedRoot = null;
let selectionBox = null; 
let historyStack = []; 

// Vision / Simulation Status
let isVisionAnalysisMode = false;   
let visionConeMesh = null;
let neuroFilters = { 
    tunnel: false, noise: false, spot: false, hemi: false, 
    'hemi-l': false, retina: false, detachment: false,
    cataract: false, glaucoma: false, photophobia: false,
    cvi: false, diplopia: false, achromatopsia: false
}; 
let colorBlindnessMode = 'none';         
let currentVisionSeverity = 'normal';
let currentSimulationMode = 'none'; 
let tutorialStep = 0;               

// Raycasting & Maus
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dragOffset = new THREE.Vector3();
let isDragging = false;
let raycastThrottle = 0;
let selectedHandle = null; // Speichert den gezogenen Zonen-Eckpunkt

// === ZONE EDIT MODE & HELPER ===
let isZoneEditMode = false;
let editingZone = null;

window.app.createNewZone = function() {
    const nameInput = document.getElementById('new-zone-name');
    const colorInput = document.getElementById('new-zone-color');
    let name = nameInput.value.trim() || "Neue Zone";
    let colorHex = parseInt(colorInput.value.replace('#', '0x'));
    
    saveHistory();
    createFurnitureInstance('zone_custom', 0, 0, 0);
    
    // Konfiguriere die frisch generierte Zone
    const newZone = movableObjects[movableObjects.length - 1];
    newZone.userData.zoneName = name;
    newZone.userData.zoneColor = colorHex;
    
    newZone.userData.visualMesh.material.color.setHex(colorHex);
    newZone.userData.wireframe.material.color.setHex(colorHex);
    
    nameInput.value = "";
    app.updateZoneListUI();
    
    // Direkt in den Bearbeitungsmodus wechseln
    setTimeout(() => { app.toggleZoneEdit(newZone.uuid); }, 50);
};

window.app.updateZoneListUI = function() {
    const container = document.getElementById('zone-list-container');
    if (!container) return;
    container.innerHTML = "";
    
    const zones = movableObjects.filter(o => o.userData.isZone);
    if (zones.length === 0) {
        container.innerHTML = "<small style='color:#6b7280;'>Noch keine Zonen erstellt.</small>";
        return;
    }

    // Farb-Logik dynamisch nach Modus steuern
    const isEditor = window.app.currentMode === 'editor';
    const cPrimary = isEditor ? '#10b981' : '#3b82f6'; // Grün im Editor, Blau im Planer
    const cBg = isEditor ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)';
    const cBorder = isEditor ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)';
    
    zones.forEach(zone => {
        const isEditing = (editingZone === zone);
        
        // XSS-SCHUTZ: Name der Zone aus Dateien sicher machen!
        const name = window.app.escapeHTML(zone.userData.zoneName || "Zone");
        
        const color = zone.userData.zoneColor !== undefined ? zone.userData.zoneColor : 0x10b981;
        const colorStr = '#' + color.toString(16).padStart(6, '0');
        
        let html = `
            <div style="background: ${isEditing ? cBg : 'rgba(255,255,255,0.03)'}; 
                        border: 1px solid ${isEditing ? cPrimary : 'rgba(255,255,255,0.05)'}; 
                        margin-bottom: 8px; border-radius: 6px; overflow: hidden; transition: all 0.2s;">
                <div style="padding: 10px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;"
                     onclick="app.toggleZoneEdit('${zone.uuid}')">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background: ${colorStr}; flex-shrink: 0;"></div>
                        ${isEditing 
                            ? `<input type="text" value="${name}" onchange="app.renameZone('${zone.uuid}', this.value)" onclick="event.stopPropagation()" style="background: rgba(0,0,0,0.3); border: 1px solid ${cPrimary}; color: white; border-radius: 4px; padding: 2px 6px; font-size: 12px; font-weight: 600; width: 130px; outline: none; box-sizing: border-box;">`
                            : `<span style="font-size: 12px; color: #d1d5db; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">${name}</span>`
                        }
                    </div>
                    <span style="font-size: 10px; color: ${isEditing ? cPrimary : '#6b7280'}; flex-shrink: 0;">${isEditing ? '▼ Bearbeiten' : '▶'}</span>
                </div>
        `;
        
        if (isEditing) {
            const btnStyle = isEditor 
                ? `background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-color: #10b981; color: white;`
                : `background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-color: #3b82f6; color: white;`;

            html += `
                <div style="padding: 10px; border-top: 1px solid ${cBorder}; background: rgba(0,0,0,0.2);">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px;">
                        <button style="font-size: 11px; padding: 6px; border-color: rgba(255,255,255,0.1);" onclick="app.addZonePoint()">+ Ecke</button>
                        <button style="font-size: 11px; padding: 6px; border-color: rgba(255,255,255,0.1);" onclick="app.removeZonePoint()">- Ecke</button>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                        <button class="danger" style="font-size: 11px; padding: 6px;" onclick="app.deleteZone('${zone.uuid}')">Löschen</button>
                        <button class="primary" style="font-size: 11px; padding: 6px; ${btnStyle}" onclick="app.toggleZoneEdit(null)">Fertig</button>
                    </div>
                </div>
            `;
        }
        html += `</div>`;
        container.innerHTML += html;
    });
};

window.app.renameZone = function(uuid, newName) {
    const zone = movableObjects.find(o => o.uuid === uuid);
    if(zone) {
        zone.userData.zoneName = newName.trim() || "Zone";
        saveHistory();
        app.updateZoneListUI();
    }
};

window.app.toggleZoneEdit = function(uuid) {
    deselectObject(); 
    
    if (!uuid || (editingZone && editingZone.uuid === uuid)) {
        isZoneEditMode = false;
        if(editingZone) editingZone.userData.handles.forEach(h => h.visible = false);
        editingZone = null;
        controls.enableRotate = true;
        controls.enablePan = true;
        showNotification("Zonierungsmodus beendet.");
    } else {
        if(editingZone) editingZone.userData.handles.forEach(h => h.visible = false);
        
        const zone = movableObjects.find(o => o.uuid === uuid);
        if (zone) {
            app.setCamera('top'); 
            isZoneEditMode = true;
            editingZone = zone;
            
            window.app.updateZoneGeometry(zone);
            
            controls.enableRotate = false;
            controls.enablePan = false;
            showNotification("Zonierungsmodus aktiv: Kameraposition gesperrt.");
        }
    }
    app.updateZoneListUI();
};

window.app.deleteZone = function(uuid) {
    const zone = movableObjects.find(o => o.uuid === uuid);
    if(!zone) return;
    saveHistory();
    if (editingZone === zone) app.toggleZoneEdit(null);
    
    zone.userData.handles.forEach(h => {
        const hIdx = interactionMeshes.indexOf(h);
        if(hIdx > -1) interactionMeshes.splice(hIdx, 1);
    });
    
    scene.remove(zone);
    movableObjects = movableObjects.filter(o => o !== zone);
    window.app.loesche3DObjekt(zone);
    app.updateZoneListUI();
};

window.app.updateZoneGeometry = function(wrapper) {
    if (!wrapper.userData.isZone) return;
    const pts = wrapper.userData.points;
    const shape = new THREE.Shape(pts);
    
    const geo = new THREE.ShapeGeometry(shape);
    wrapper.userData.visualMesh.geometry.dispose();
    wrapper.userData.visualMesh.geometry = geo;
    
    const edges = new THREE.EdgesGeometry(geo);
    wrapper.userData.wireframe.geometry.dispose();
    wrapper.userData.wireframe.geometry = edges;

    const handles = wrapper.userData.handles;
    
    while(handles.length < pts.length) {
        // Professionellere Optik: Flacher, runder Button
        const hGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16);
        const hMat = new THREE.MeshBasicMaterial({color: 0xffffff, depthTest: false});
        const h = new THREE.Mesh(hGeo, hMat);
        
        // Dünner dunkler Rand für besseren Kontrast auf hellem Boden
        const edgeGeo = new THREE.EdgesGeometry(hGeo);
        const edgeMat = new THREE.LineBasicMaterial({color: 0x374151, linewidth: 2});
        h.add(new THREE.LineSegments(edgeGeo, edgeMat));

        h.renderOrder = 999;
        h.userData = { isZoneHandle: true, root: wrapper, index: handles.length };
        wrapper.add(h);
        handles.push(h);
        interactionMeshes.push(h); 
    }
    while(handles.length > pts.length) {
        const h = handles.pop();
        wrapper.remove(h);
        const idx = interactionMeshes.indexOf(h);
        if(idx > -1) interactionMeshes.splice(idx, 1);
        h.traverse(c => { if(c.geometry) c.geometry.dispose(); if(c.material) c.material.dispose(); });
    }
    
    pts.forEach((p, i) => {
        handles[i].position.set(p.x, 0.05, -p.y); 
        handles[i].userData.index = i;
        handles[i].visible = (isZoneEditMode && editingZone === wrapper);
    });
};

window.app.addZonePoint = function() {
    if(!editingZone) return;
    const pts = editingZone.userData.points;
    const mid = new THREE.Vector2((pts[0].x+pts[1].x)/2, (pts[0].y+pts[1].y)/2);
    pts.splice(1, 0, mid); 
    saveHistory();
    window.app.updateZoneGeometry(editingZone);
};

window.app.removeZonePoint = function() {
    if(!editingZone) return;
    const pts = editingZone.userData.points;
    if(pts.length > 3) {
        pts.pop(); 
        saveHistory();
        window.app.updateZoneGeometry(editingZone);
    } else {
        showNotification("Eine Zone braucht mindestens 3 Ecken!");
    }
};

// Loader
const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();
const draco = new DRACOLoader();

// Lokaler Pfad statt gstatic!
draco.setDecoderPath('./lib/draco/'); 
gltfLoader.setDRACOLoader(draco);

// === INIT ===
function init() {
  try {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1e1e1e);
      scene.fog = new THREE.FogExp2(0x1e1e1e, 0);  

      camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
      camera.position.set(0, 16, 0.1); 

      // PERFORMANCE 1: Intelligentes Anti-Aliasing (Nur an, wenn es kein Retina-Display ist)
      const pixelRatio = window.devicePixelRatio || 1;
      const useAntialias = pixelRatio === 1;

      renderer = new THREE.WebGLRenderer({ 
          antialias: useAntialias, 
          preserveDrawingBuffer: true, 
          powerPreference: "high-performance"
      });

      window.app.renderer = renderer;
      
      // PERFORMANCE 2: Auflösung deckeln (Verhindert extremes 4K-Rendering auf Laptops)
      renderer.setPixelRatio(Math.min(pixelRatio, 1.5));
      renderer.setSize(window.innerWidth, window.innerHeight);
      
      // PERFORMANCE 3: Schatten drosseln (Hard-Shadows statt teuren Soft-Shadows)
      renderer.shadowMap.enabled = true; 
      renderer.shadowMap.type = THREE.PCFShadowMap; 
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      document.body.appendChild(renderer.domElement);

      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
      scene.add(hemiLight);
      
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(5, 15, 5);
      dirLight.castShadow = true;
      
      // PERFORMANCE 4: Schattenbereich strikt auf den Raum begrenzen und Map-Größe festlegen
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.camera.near = 0.5;
      dirLight.shadow.camera.far = 40;
      dirLight.shadow.camera.left = -15;
      dirLight.shadow.camera.right = 15;
      dirLight.shadow.camera.top = 15;
      dirLight.shadow.camera.bottom = -15;
      
      scene.add(dirLight);
      
      const gridHelper = new THREE.GridHelper(30, 30, 0x444444, 0x333333);
      gridHelper.position.y = -0.05;
      scene.add(gridHelper);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.maxPolarAngle = Math.PI / 2 - 0.05;
      controls.minDistance = 0.1; 
      controls.maxDistance = 60;
      controls.listenToKeyEvents(window); 

      window.addEventListener("resize", onWindowResize);
      renderer.domElement.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      
      // BoxHelper entfernt, Dummy einsetzen, damit Alt-Funktionen nicht abstürzen
      selectionBox = { visible: false, update: function(){}, setFromObject: function(){} };

      // UI Init
      const sel = document.getElementById('room-select');
      if(sel) sel.addEventListener('change', (e) => app.switchRoom(e.target.value));
      
      initRightSidebar();  
      setupAvatarButtons();
      setupOnScreenControls();

      // --- NEU: Custom High-Res FPS Diagnose-Tool ---
      window.app.fpsData = { frames: 0, lastTime: performance.now(), fps: 0, lastFrameTime: performance.now(), currentFrameMs: 0 };

      const fpsContainer = document.createElement('div');
      fpsContainer.id = 'fps-container';
      fpsContainer.style.position = 'fixed';
      fpsContainer.style.top = '80px';
      fpsContainer.style.left = '24px';
      fpsContainer.style.zIndex = '2147483647';
      
      // Edles Styling: Dunkelgrau, Blur, feiner Rahmen
      fpsContainer.style.padding = '10px 16px'; 
      fpsContainer.style.borderRadius = '8px';
      fpsContainer.style.backgroundColor = 'rgba(30, 30, 30, 0.85)';
      fpsContainer.style.backdropFilter = 'blur(12px)';
      fpsContainer.style.webkitBackdropFilter = 'blur(12px)';
      fpsContainer.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)';
      fpsContainer.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      fpsContainer.style.fontFamily = "'Inter', sans-serif";
      fpsContainer.style.display = 'none'; 
      fpsContainer.style.minWidth = '140px'; 
      
      // DRAG & DROP Styling
      fpsContainer.style.cursor = 'grab';
      fpsContainer.style.userSelect = 'none';
      fpsContainer.style.webkitUserSelect = 'none';
      
      // Nativ gestochen scharfes HTML mit Dropdown-Details
      fpsContainer.innerHTML = `
          <div id="fps-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
              <div style="display: flex; flex-direction: column; align-items: flex-start;">
                  <span style="font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; font-weight: 600;">Performance</span>
                  <div style="display: flex; align-items: baseline; gap: 4px;">
                      <span id="fps-value" style="font-size: 28px; color: #fbbf24; font-weight: 700; line-height: 1; text-shadow: 0 0 10px rgba(251, 191, 36, 0.3);">0</span>
                      <span style="font-size: 14px; color: #e4e4e7; font-weight: 600;">FPS</span>
                  </div>
              </div>
              <div id="fps-toggle-icon" style="color: #a1a1aa; font-size: 10px; margin-left: 15px; transition: transform 0.3s ease;">▼</div>
          </div>
          
          <div id="fps-details" style="display: none; flex-direction: column; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
              <div style="display: flex; justify-content: space-between; font-size: 12px;">
                  <span style="color: #a1a1aa;">Frame Zeit</span>
                  <span id="fps-ms" style="color: #e4e4e7; font-weight: 600;">0 ms</span>
              </div>
              <div id="fps-mem-row" style="display: flex; justify-content: space-between; font-size: 12px;">
                  <span style="color: #a1a1aa;">Speicher (RAM)</span>
                  <span id="fps-mem" style="color: #e4e4e7; font-weight: 600;">-- MB</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px;">
                  <span style="color: #a1a1aa;">Draw Calls</span>
                  <span id="fps-draws" style="color: #e4e4e7; font-weight: 600;">0</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px;">
                  <span style="color: #a1a1aa;">Polygone</span>
                  <span id="fps-tris" style="color: #e4e4e7; font-weight: 600;">0</span>
              </div>
          </div>
      `;
      
      document.body.appendChild(fpsContainer);

      // --- TOGGLE LOGIK (Ausklappen) ---
      let isFpsExpanded = false;
      const headerEl = document.getElementById('fps-header');
      const detailsEl = document.getElementById('fps-details');
      const iconEl = document.getElementById('fps-toggle-icon');

      headerEl.addEventListener('click', function(e) {
          // Prüfen, ob der Nutzer nur gezogen (Drag) oder wirklich geklickt hat
          if (dragOffsetHasMoved) return; 
          
          isFpsExpanded = !isFpsExpanded;
          detailsEl.style.display = isFpsExpanded ? 'flex' : 'none';
          iconEl.style.transform = isFpsExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
      });

      // --- DRAG & DROP LOGIK ---
      let isDragging = false;
      let dragOffset = [0, 0];
      let dragOffsetHasMoved = false; // Unterscheidet zwischen Klick und Drag

      fpsContainer.addEventListener('mousedown', function(e) {
          isDragging = true;
          dragOffsetHasMoved = false;
          fpsContainer.style.cursor = 'grabbing';
          dragOffset = [fpsContainer.offsetLeft - e.clientX, fpsContainer.offsetTop - e.clientY];
      });

      document.addEventListener('mouseup', function() {
          isDragging = false;
          if (fpsContainer) fpsContainer.style.cursor = 'grab';
      });

      document.addEventListener('mousemove', function(e) {
          if (isDragging && fpsContainer.style.display !== 'none') {
              e.preventDefault();
              dragOffsetHasMoved = true;
              fpsContainer.style.left = (e.clientX + dragOffset[0]) + 'px';
              fpsContainer.style.top  = (e.clientY + dragOffset[1]) + 'px';
          }
      });

      fpsContainer.addEventListener('touchstart', function(e) {
          isDragging = true;
          dragOffsetHasMoved = false;
          const touch = e.touches[0];
          dragOffset = [fpsContainer.offsetLeft - touch.clientX, fpsContainer.offsetTop - touch.clientY];
      }, { passive: false });

      document.addEventListener('touchend', function() {
          isDragging = false;
      });

      document.addEventListener('touchmove', function(e) {
          if (isDragging && fpsContainer.style.display !== 'none') {
              e.preventDefault();
              dragOffsetHasMoved = true;
              const touch = e.touches[0];
              fpsContainer.style.left = (touch.clientX + dragOffset[0]) + 'px';
              fpsContainer.style.top  = (touch.clientY + dragOffset[1]) + 'px';
          }
      }, { passive: false });
      // ------------------------------------------

      // Start App
      startApp();
      
      // NEU: Einstellungen aus LocalStorage laden (beim Zurückkehren aus Modulen)
      const savedHC = localStorage.getItem('elmeks_high_contrast') === 'true';
      const savedRA = localStorage.getItem('elmeks_read_aloud') === 'true';
      
      const hcApp = document.getElementById('set-high-contrast');
      const hcHome = document.getElementById('start-high-contrast');
      if (hcApp) hcApp.checked = savedHC;
      if (hcHome) hcHome.checked = savedHC;
      
      const raApp = document.getElementById('set-read-aloud');
      const raHome = document.getElementById('start-read-aloud');
      if (raApp) raApp.checked = savedRA;
      if (raHome) raHome.checked = savedRA;

      // Controls zu Beginn sichtbar schalten
      settings.controlsEnabled = true;
      app.updateSettings(); 

      // Vorlesemodus initialisieren
      initTTS();

  } catch (err) {
      console.error("Critical Init Error:", err);
      alert("Fehler bei der Initialisierung: " + err.message);
  }
}

// === TEXT-TO-SPEECH (VORLESEMODUS) ===
let ttsTimeout = null;
function initTTS() {
    if (!('speechSynthesis' in window)) {
        console.warn("Web Speech API wird vom Browser nicht unterstützt.");
        return;
    }

    document.body.addEventListener('mouseover', (e) => {
        if (!settings.readAloud) return;
        
        const target = e.target;
        // Elemente, die sinnvoll vorgelesen werden sollen
        const validTags = ['BUTTON', 'LABEL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'SPAN', 'P', 'LI', 'STRONG'];
        const isValidClass = target.classList.contains('panel-header') || target.classList.contains('object-list-item');
        
        if (validTags.includes(target.tagName) || isValidClass) {
            let text = target.innerText || target.getAttribute('aria-label') || target.title;
            if (!text) return;
            text = text.trim();
            if (text.length === 0) return;

            // Stoppe aktuelle Sprachausgabe, um Überlappungen zu verhindern
            window.speechSynthesis.cancel();
            
            // Kurze Verzögerung (Debounce 400ms), damit beim schnellen Drüberwischen mit der Maus Ruhe herrscht
            clearTimeout(ttsTimeout);
            ttsTimeout = setTimeout(() => {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'de-DE';
                utterance.rate = 1.0; 
                window.speechSynthesis.speak(utterance);
            }, 400); 
        }
    });

    document.body.addEventListener('mouseout', (e) => {
        if (!settings.readAloud) return;
        clearTimeout(ttsTimeout);
        window.speechSynthesis.cancel();
    });
}

function startApp() {
    toggleLoader(true, "Lade Raum...");
    animate();
    // Default Raum laden
    loadRoomAsset("raummodell_leer.glb")
        .then((model) => {
            setupRoom(model, "raummodell_leer.glb");
        })
        .finally(() => toggleLoader(false));
}

// === HOMESCREEN & NAVIGATION ===
// App-States und Navigation (startStandardPlanner, startScenarioEditor, applyModeUI, etc.) 
// wurden in die js/modules/ui.js ausgelagert.

window.app.showEditorHelp = function(startTutorialAfter = false) {
    const btnCode = startTutorialAfter 
        ? `onclick="document.getElementById('modal-overlay').classList.remove('active'); setTimeout(nextTutorialStep, 300);"` 
        : `onclick="document.getElementById('modal-overlay').classList.remove('active')"`;
        
    document.getElementById('modal-title').innerText = "Hilfe: Szenario Editor";
    document.getElementById('modal-content').innerHTML = `
        <div style="font-size: 13px; color: #d1d5db; line-height: 1.6;">
            <p><b>Willkommen im Szenario Editor!</b></p>
            <p>Hier können Sie interaktive Lern-Szenarien für Ihre Lernenden oder Kolleg:innen erstellen.</p>
            <ul style="padding-left: 20px; margin-bottom: 20px;">
                <li style="margin-bottom: 8px;"><b>Personas & Zonen:</b> Platzieren Sie Lernende mit Beeinträchtigungen und markieren Sie Bereiche auf dem Boden.</li>
                <li style="margin-bottom: 8px;"><b>Regeln erstellen:</b> Im rechten Menü definieren Sie räumliche Aufgaben (z.B. "Rollstuhlgerecht" oder "Mia in der blauen Zone").</li>
                <li style="margin-bottom: 8px;"><b>Objekte sperren:</b> Nutzen Sie das Kontextmenü (Rechtsklick auf ein Objekt), um Möbel zu <i>sperren</i>. Gesperrte Möbel können im Spielmodus nicht verschoben werden!</li>
                <li style="margin-bottom: 8px;"><b>Multiple Choice:</b> Fügen Sie Wissensfragen hinzu, die am Ende beantwortet werden müssen.</li>
            </ul>
            <p style="color: #10b981; font-weight: bold;">Nutzen Sie den Button "▶ Testen" oben in der Leiste, um Ihr Szenario jederzeit auszuprobieren.</p>
        </div>
        <div style="margin-top:25px; text-align:right;">
            <button class="primary" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-color: #10b981;" ${btnCode}>Verstanden & Schließen</button>
        </div>
    `;
    document.getElementById('modal-overlay').classList.add('active');
};

let currentTutorialMode = 'planner';

window.app.startTutorial = function(mode = 'planner') {
    tutorialStep = 0;
    currentTutorialMode = mode;
    
    if (mode === 'editor') {
        app.startScenarioEditor();
        app.showEditorHelp(true); // Tutorial startet nach dem Schließen des Modals
    } else {
        app.startStandardPlanner();
        setTimeout(nextTutorialStep, 500);
    }
};

function nextTutorialStep() {
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
        el.classList.remove('tutorial-highlight');
        el.style.boxShadow = '';
        el.style.zIndex = '';
        if(el.classList.contains('sidebar') || el.classList.contains('sidebar-right')) {
            el.style.position = 'absolute'; 
        }
    });

    const uiLayer = document.getElementById('ui-layer');
    let tutBox = document.getElementById('tutorial-box');
    if(!tutBox) {
        tutBox = document.createElement('div');
        tutBox.id = 'tutorial-box';
        tutBox.style.cssText = `position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); 
                                background:var(--bg-panel); padding:20px; border:2px solid var(--primary); 
                                border-radius:8px; width:300px; z-index:9000; box-shadow:0 0 50px rgba(0,0,0,0.8);
                                text-align:center; pointer-events:auto; color:white;`;
        uiLayer.appendChild(tutBox);
    }
    
    // Farbe für den Rahmen anpassen
    tutBox.style.borderColor = currentTutorialMode === 'editor' ? '#10b981' : 'var(--primary)';
    tutBox.style.display = 'block';

    let steps = [];
    if (currentTutorialMode === 'editor') {
        steps = [
            { sel: '.top-bar', text: "<b>Szenario Editor</b><br><br>Hier erstellen Sie neue interaktive Aufgaben. Oben können Sie den Raum wechseln und Ihr fertiges Szenario exportieren." },
            { sel: '#panel-personas', text: "<b>Kinder-Personas</b><br><br>Setzen Sie gezielt Lernende mit Beeinträchtigungen, auf die Sie Ihre Aufgaben zuschneiden wollen." },
            { sel: '#panel-zones', text: "<b>Zonierung</b><br><br>Erstellen Sie farbige Bodenmarkierungen, die Sie in Ihren Aufgaben-Regeln abfragen können." },
            { sel: '#panel-scenario-details', text: "<b>Szenario-Details</b><br><br>Hier definieren Sie den Titel und die Beschreibung für Ihr Lern-Szenario." },
            { sel: '#panel-scenario-rules', text: "<b>Regeln & Werkzeuge</b><br><br>Fügen Sie Aufgaben hinzu und konfigurieren Sie die erlaubten Werkzeuge." },
            { sel: '#onscreen-controls', text: "<b>Steuerung & Objekte sperren</b><br><br>Bauen Sie den Raum um. WICHTIG: Mit Rechtsklick (bzw. im Kontextmenü) können Sie Möbel sperren, damit Spieler sie später nicht bewegen können!" }
        ];
    } else {
        steps = [
            { sel: '.top-bar', text: "<b>Planungsassistent</b><br><br>Hier können Sie frei Räume planen, speichern und PDF-Reports generieren." },
            { sel: '.sidebar', text: "<b>Möbel & Objekte</b><br><br>Nutzen Sie den Assistenten für schnelle Layouts oder platzieren Sie Möbel einzeln." },
            { sel: '.sidebar-right', text: "<b>Avatar & Analyse</b><br><br>Setzen Sie den Avatar, um in die Ich-Perspektive zu wechseln und Sehbehinderungen zu simulieren." },
            { sel: '#onscreen-controls', text: "<b>Steuerung</b><br><br>Nutzen Sie die Maus (Rechtsklick = Drehen) oder das On-Screen-Pad zur Orientierung." }
        ];
    }

    if (tutorialStep < steps.length) {
        const step = steps[tutorialStep];
        const btnColor = currentTutorialMode === 'editor' ? 'background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-color: #10b981;' : '';
        tutBox.innerHTML = `<p style="margin-bottom:15px; font-size:14px;">${step.text}</p><button class="primary" style="${btnColor}" onclick="app.nextTut()">Weiter</button>`;
        const el = document.querySelector(step.sel);
        if(el) {
            el.classList.add('tutorial-highlight');
            el.style.boxShadow = `0 0 20px ${currentTutorialMode === 'editor' ? '#10b981' : 'var(--primary)'}`;
            el.style.zIndex = "4000"; 
            if(el.classList.contains('sidebar') || el.classList.contains('sidebar-right')) { el.style.position = 'absolute'; }
        }
    } else {
        tutBox.style.display = 'none';
        showNotification("Tutorial beendet.");
    }
}
window.app.nextTut = function() { tutorialStep++; nextTutorialStep(); };


// === AVATAR & VISION LOGIC ===
function setupAvatarButtons() {
    const btnSpawn = document.getElementById('btn-spawn-avatar');
    if (btnSpawn) {
        const newBtn = btnSpawn.cloneNode(true);
        btnSpawn.parentNode.replaceChild(newBtn, btnSpawn);
        newBtn.addEventListener('click', () => {
            if (isFirstPersonActive() || isVisionAnalysisMode) return;
            toggleAvatar(scene, movableObjects, interactionMeshes);
            updateAvatarUI(); 
        });
    }

    const btnView = document.getElementById('btn-toggle-view');
    if (btnView) {
        const newView = btnView.cloneNode(true);
        btnView.parentNode.replaceChild(newView, btnView);
        newView.addEventListener('click', () => {
            if (isVisionAnalysisMode) return; 
            deselectObject(); 
            
            toggleAvatarView(camera, controls);
            
            // Anpassung: Controls bleiben aktiv, aber Pan/Zoom werden gesperrt
            if (isFirstPersonActive()) {
                controls.enableZoom = false;
                controls.enablePan = false;
                controls.rotateSpeed = 0.5; // Langsamer in FP
            } else {
                controls.enableZoom = true;
                controls.enablePan = true;
                controls.rotateSpeed = settings.mouseSensitivity;
            }

            app.updateSettings(); 
            app.updateVisionEffects(); 
            updateAvatarUI();
        });
    }

    const btnExit = document.getElementById('btn-exit-simulation');
    if(btnExit) {
        btnExit.addEventListener('click', () => app.exitSimulationMode());
    }
}

window.app.exitSimulationMode = function() {
    if (isFirstPersonActive()) {
        toggleAvatarView(camera, controls);
    }
    if (isVisionAnalysisMode) {
        isVisionAnalysisMode = false;
        if(visionConeMesh) { scene.remove(visionConeMesh); visionConeMesh = null; }
        app.setCamera('top');
    }
    
    // FIX: Rotation wieder erlauben
    controls.enableRotate = true;
    
    // Komplett Reset
    Object.keys(neuroFilters).forEach(k => neuroFilters[k] = false);
    colorBlindnessMode = 'none';
    
    controls.enabled = true; 
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.rotateSpeed = settings.mouseSensitivity;

    app.updateSettings(); 
    app.updateVisionEffects();
    updateAvatarUI();
};

function updateAvatarUI() {
    const isFP = isFirstPersonActive();
    const modeActive = isFP || isVisionAnalysisMode; // Status prüfen
    const avatarExists = movableObjects.some(o => o.userData.isAvatar);
    
    const btnSpawn = document.getElementById('btn-spawn-avatar');
    const groupControls = document.getElementById('avatar-controls-group');
    const hint = document.getElementById('vision-disabled-hint');
    const btnView = document.getElementById('btn-toggle-view'); 
    const btnAnalysis = document.getElementById('btn-toggle-analysis');
    const settingsPanel = document.getElementById('vision-settings-panel');
    const btnExit = document.getElementById('btn-exit-simulation');
    
    // NEU: Sidebar Referenz
    const leftSidebar = document.querySelector('.sidebar');

    // FIX: Linke Sidebar ausblenden, wenn im Simulations-Modus
    if (leftSidebar) {
        leftSidebar.style.display = modeActive ? 'none' : 'flex';
    }

    // FIX: Wizard-Button deaktivieren
    const wizBtn = document.querySelector('button[onclick="app.runWizard()"]');
    if(wizBtn) {
        wizBtn.disabled = modeActive;
        wizBtn.style.opacity = modeActive ? "0.3" : "1";
        wizBtn.style.cursor = modeActive ? "not-allowed" : "pointer";
    }

    if (btnSpawn) {
        if (avatarExists) {
            btnSpawn.innerText = "Avatar entfernen";
            btnSpawn.classList.remove('primary'); // Verhindert blauen Glow
            btnSpawn.classList.add('danger', 'solid'); // Echtes Rot
            btnSpawn.disabled = modeActive; 
            btnSpawn.style.opacity = modeActive ? "0.3" : "1";
        } else {
            btnSpawn.innerText = "Avatar setzen";
            btnSpawn.classList.remove('danger', 'solid');
            btnSpawn.classList.add('primary'); // Zurück zum originalen Blau
            btnSpawn.disabled = false;
            btnSpawn.style.opacity = "1";
        }
    }

    if (groupControls) groupControls.style.display = avatarExists ? 'block' : 'none';
    if (hint) hint.style.display = avatarExists ? 'none' : 'block';

    if (btnView && btnAnalysis) {
        if (isFP) {
            btnView.classList.add('active'); 
            btnView.disabled = true; 
            btnAnalysis.disabled = true; 
            btnAnalysis.style.opacity = "0.3";
        } else if (isVisionAnalysisMode) {
            btnAnalysis.classList.add('active');
            btnAnalysis.disabled = true;
            btnView.disabled = true;
            btnView.style.opacity = "0.3";
        } else {
            btnView.classList.remove('active');
            btnAnalysis.classList.remove('active');
            btnView.disabled = false;
            btnAnalysis.disabled = false;
            btnView.style.opacity = "1";
            btnAnalysis.style.opacity = "1";
        }
    }

    if (btnExit) btnExit.style.display = modeActive ? 'block' : 'none';
    if (settingsPanel) settingsPanel.style.display = modeActive ? 'block' : 'none';
}

// === VISION EFFEKTE & NEURO-FILTER ===

// Helper: Nur ein Akkordeon gleichzeitig offen halten
window.app.handleAccordion = function(element) {
    if (!element.open) {
        // Wenn wir es gerade öffnen, schließen wir alle anderen
        const groups = document.querySelectorAll('.sim-group');
        groups.forEach(g => {
            if (g !== element) g.removeAttribute('open');
        });
    }
};

// 1. Toggle Funktion (Exklusiv-Logik)
window.app.toggleNeuroFilter = function(type) {
    if(!isFirstPersonActive()) return;
    
    // Status merken
    const wasActive = neuroFilters[type];
    
    // Alle Filter ausschalten (Werte auf false setzen)
    Object.keys(neuroFilters).forEach(k => neuroFilters[k] = false);

    // Gewählten Filter aktivieren, falls er vorher aus war
    if (!wasActive) neuroFilters[type] = true;
    
    app.updateVisionEffects();
};

// 2. Farbblindheit setzen
window.app.setColorBlindness = function(val) {
    colorBlindnessMode = val;
    app.updateVisionEffects();
};

// 3. Bestehende Sehschwäche-Funktion
window.app.setVisionSeverity = function(val) {
    currentVisionSeverity = val;
    if (isVisionAnalysisMode && visionConeMesh) updateAnalysisRing();
    app.updateVisionEffects();
};

window.app.setSimulationMode = function(mode) {
    currentSimulationMode = mode;
    app.updateVisionEffects();
};

// 4. Haupt-Update Funktion
window.app.updateVisionEffects = function() {
    const isFP = isFirstPersonActive();
    
    // 1. Reset Classes (Alle "sim-" Klassen entfernen)
    document.body.className = document.body.className.replace(/\bsim-\S+/g, "");
    if(scene.fog) scene.fog.density = 0;

    // 2. UI-Sichtbarkeit
    const neuroSection = document.getElementById('neuro-section');
    if(neuroSection) neuroSection.style.display = isFP ? 'block' : 'none';

    // 3. UI Sync (Dropdowns)
    const simSelect = document.getElementById('sim-select');
    if(simSelect) simSelect.value = currentSimulationMode;
    const visusSelect = document.getElementById('vision-select-right');
    if(visusSelect) visusSelect.value = currentVisionSeverity;

    // NEU: Slider Wert holen
    const severitySlider = document.getElementById('sim-severity');
    let severityLevel = severitySlider ? severitySlider.value : "2";

    // NEU: Slider nur einblenden, wenn eine Simulation aktiv ist (die Stufen unterstützt)
    // FIX: strabismus und amblyopia aus dem Array entfernt, damit der Slider angezeigt wird!
    const sliderContainer = document.getElementById('sim-severity-container');
    if (sliderContainer) {
        if (currentSimulationMode !== 'none' && !['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'].includes(currentSimulationMode)) {
            sliderContainer.style.display = 'block';
        } else {
            sliderContainer.style.display = 'none';
        }
    }

    // ABBRUCH wenn nicht FP
    if (!isFP) { return; }

    let fogDensity = 0;
    
    // 4. Visus anwenden
    switch(currentVisionSeverity) {
        case 'low': document.body.classList.add('sim-blur'); fogDensity = 0.05; break;
        case 'severe': document.body.classList.add('sim-severe'); fogDensity = 0.15; break;
        case 'blind': document.body.classList.add('sim-blind'); fogDensity = 0.6; break;
    }

    // 5. Simulation & Schweregrad anwenden
    if (currentSimulationMode !== 'none') {
        document.body.classList.add('sim-' + currentSimulationMode);
        document.body.classList.add('sim-lvl-' + severityLevel); // Fügt z.B. sim-lvl-2 hinzu
    }

    // 6. GLOSSAR & TIPP UPDATE
    let glossKey = 'normal';
    if (currentSimulationMode !== 'none') {
        glossKey = currentSimulationMode;
    } else if (currentVisionSeverity !== 'normal') {
        glossKey = currentVisionSeverity;
    }

    const glossInfo = SIM_GLOSSARY[glossKey] || SIM_GLOSSARY.normal;
    const gTitle = document.getElementById('glossary-title');
    const gText = document.getElementById('glossary-text');
    const gTipBox = document.getElementById('glossary-tip');
    const gTipText = document.getElementById('glossary-tip-text');
    
    if(gTitle && gText) {
        gTitle.innerText = glossInfo.title;
        gText.innerText = glossInfo.text;
        
        if (glossInfo.tip && glossInfo.tip.length > 0) {
            gTipBox.style.display = 'block';
            gTipText.innerText = glossInfo.tip;
        } else {
            gTipBox.style.display = 'none';
        }
    }
    
    if(scene.fog) scene.fog.density = fogDensity;
};

// Draufsicht Analyse
window.app.toggleVisionAnalysis = function() {
    const currentAvatarObj = movableObjects.find(o => o.userData.isAvatar);
    if (!currentAvatarObj) { showNotification("Kein Avatar vorhanden!"); return; }
    if (isVisionAnalysisMode) return; 

    isVisionAnalysisMode = true;
    
    // FIX: Rotation sperren, damit man nicht "unter" die Ebene schaut
    controls.enableRotate = false;
    
    updateAvatarUI();
    updateAnalysisRing();
    
    controls.enabled = true;
    app.updateSettings(); 
    showNotification("Modus: Draufsicht Analyse");
};

function updateAnalysisRing() {
    if(visionConeMesh) { scene.remove(visionConeMesh); visionConeMesh.geometry.dispose(); visionConeMesh = null; }

    const currentAvatarObj = movableObjects.find(o => o.userData.isAvatar);
    if (!currentAvatarObj) return;

    let r = 15.0; 
    let col = new THREE.Color(0x2ea043); 

    switch(currentVisionSeverity) {
        case 'normal': r = 15.0; col.setHex(0x2ea043); break;
        case 'low':    r = 3.5;  col.setHex(0xd4a72c); break;
        case 'severe': r = 1.5;  col.setHex(0xff8800); break;
        case 'blind':  r = 0.8;  col.setHex(0xd73a49); break;
    }

    const vertexShader = `
        varying vec3 vWorldPosition;
        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
    `;
    
    const limitX = currentRoomLimits.x; 
    const limitZ = currentRoomLimits.z;

    const fragmentShader = `
        uniform vec3 color;
        uniform vec2 limits;
        varying vec3 vWorldPosition;
        void main() {
            if (abs(vWorldPosition.x) > limits.x || abs(vWorldPosition.z) > limits.y) {
                discard;
            }
            gl_FragColor = vec4(color, 0.4);
        }
    `;

    const fovRad = 216 * (Math.PI / 180);
    const thetaStart = (Math.PI / 2) - (fovRad / 2);
    const geometry = new THREE.CircleGeometry(r, 64, thetaStart, fovRad);
    
    const material = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: col },
            limits: { value: new THREE.Vector2(limitX, limitZ) }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
        side: THREE.DoubleSide
    });

    visionConeMesh = new THREE.Mesh(geometry, material);
    visionConeMesh.position.copy(currentAvatarObj.position);
    visionConeMesh.position.y = VISION_LAYER_HEIGHT; 
    
    visionConeMesh.rotation.x = -Math.PI / 2;
    visionConeMesh.rotation.z = currentAvatarObj.rotation.y;

    scene.add(visionConeMesh);

    // Kamera initial setzen
    const targetPos = currentAvatarObj.position.clone();
    const cameraPos = targetPos.clone();
    cameraPos.y = TOP_VIEW_HEIGHT; 
    smoothCameraMove(cameraPos, targetPos);
}

// === ON-SCREEN CONTROLS ===
function setupOnScreenControls() {
    const extraControls = document.querySelector('.extra-controls');
    if(extraControls) extraControls.style.display = 'none'; 
    const resetBtn = document.querySelector('.btn-center');
    if(resetBtn) resetBtn.style.display = 'none'; 

    const bindBtn = (selector, stateKey) => {
        const el = document.querySelector(selector);
        if(!el) return;
        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);
        
        newEl.addEventListener('mousedown', (e) => { e.preventDefault(); inputState[stateKey] = true; });
        newEl.addEventListener('touchstart', (e) => { e.preventDefault(); inputState[stateKey] = true; }, {passive: false});
        newEl.addEventListener('touchend', (e) => { e.preventDefault(); inputState[stateKey] = false; });
    };

    const clearInputs = () => Object.keys(inputState).forEach(k => inputState[k] = false);
    window.addEventListener('mouseup', clearInputs);
    window.addEventListener('touchend', clearInputs);

    bindBtn('.btn-up', 'fwd');
    bindBtn('.btn-down', 'bwd');
    bindBtn('.btn-left', 'left');
    bindBtn('.btn-right', 'right');
}

// === STEUERUNG (Loop) & ANIMATION ===
function processMovement() {
    if (isFirstPersonActive()) return; 
    if (!settings.controlsEnabled) return; 

    const moveSpeed = 0.05 * settings.mouseSensitivity;
    const zoomSpeed = 1.02; 

    if (inputState.fwd || inputState.bwd || inputState.left || inputState.right) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0; forward.normalize();
        if(forward.lengthSq() < 0.1) forward.set(0, 0, -1);
        const right = new THREE.Vector3();
        right.crossVectors(camera.up, forward).normalize();
        const move = new THREE.Vector3();
        if (inputState.fwd) move.add(forward);
        if (inputState.bwd) move.sub(forward);
        if (inputState.right) move.sub(right); 
        if (inputState.left) move.add(right);
        
        if (move.lengthSq() > 0) {
            move.normalize().multiplyScalar(moveSpeed);
            camera.position.add(move);
            controls.target.add(move);
        }
    }
    if (inputState.zoomIn) controls.dollyIn(zoomSpeed);
    if (inputState.zoomOut) controls.dollyOut(zoomSpeed);
}

function animate() { 
    requestAnimationFrame(animate); 
    
    // Live Update für Vision Cone (Draufsicht)
    if(isVisionAnalysisMode) {
        const av = movableObjects.find(o => o.userData.isAvatar);
        if(av && visionConeMesh) {
            visionConeMesh.position.x = av.position.x;
            visionConeMesh.position.z = av.position.z;
            visionConeMesh.rotation.z = av.rotation.y;
        }
    }

    // NEU: Nametags updaten!
    if (window.app.updateNameTags) window.app.updateNameTags();

    processMovement();
    
    // Controls Update IMMER ausführen (für Maus-Rotation auch in FP)
    controls.update(); 
    
    renderer.render(scene, camera); 
    
    // --- NEU: Custom High-Res FPS Berechnung mit Detail-Daten ---
    if (window.app.fpsData) {
        window.app.fpsData.frames++;
        const now = performance.now();
        
        // Berechne Millisekunden für diesen speziellen Render-Frame
        window.app.fpsData.currentFrameMs = now - (window.app.fpsData.lastFrameTime || now);
        window.app.fpsData.lastFrameTime = now;

        // Wir updaten die DOM-Texte absichtlich nur 1x pro Sekunde. 
        // So flackern die Zahlen nicht unlesbar schnell!
        if (now >= window.app.fpsData.lastTime + 1000) {
            window.app.fpsData.fps = Math.round((window.app.fpsData.frames * 1000) / (now - window.app.fpsData.lastTime));
            window.app.fpsData.frames = 0;
            window.app.fpsData.lastTime = now;
            
            if (settings.showFPS) {
                // Haupt-FPS
                const fpsValEl = document.getElementById('fps-value');
                if (fpsValEl) {
                    fpsValEl.innerText = window.app.fpsData.fps;
                    fpsValEl.style.color = window.app.fpsData.fps < 30 ? '#ef4444' : '#fbbf24';
                    fpsValEl.style.textShadow = window.app.fpsData.fps < 30 ? '0 0 10px rgba(239, 68, 68, 0.3)' : '0 0 10px rgba(251, 191, 36, 0.3)';
                }
                
                // Details aktualisieren
                const msEl = document.getElementById('fps-ms');
                if (msEl) {
                    msEl.innerText = Math.round(window.app.fpsData.currentFrameMs) + ' ms';
                    
                    // Renderer Info (Draw Calls & Polygone aus Three.js)
                    if (renderer && renderer.info) {
                        document.getElementById('fps-draws').innerText = renderer.info.render.calls;
                        document.getElementById('fps-tris').innerText = renderer.info.render.triangles.toLocaleString('de-DE');
                    }
                    
                    // Memory Info (RAM-Nutzung, funktioniert nativ in Chromium-Browsern)
                    if (performance && performance.memory) {
                        const mb = Math.round(performance.memory.usedJSHeapSize / 1048576);
                        document.getElementById('fps-mem').innerText = mb + ' MB';
                    } else {
                        // Wenn der Browser RAM auslesen blockiert, verstecken wir die ganze Zeile
                        const memRow = document.getElementById('fps-mem-row');
                        if (memRow) memRow.style.display = 'none';
                    }
                }
            }
        }
    }
}

// Dummy Functions für Kompatibilität mit HTML Aufrufen
window.app.moveCamera = function(x, z) {}; 
window.app.zoomCamera = function(dir) {};
window.app.tiltCamera = function(dir) {};

// toggleSettings wurde nach js/modules/ui.js ausgelagert

// === CHATBOT LOGIK & DATENBANK ===
// Chatbot-Steuerung, Speech-to-Text und die Datenbank (chatDatabase) 
// wurden in die js/modules/ui.js ausgelagert.

window.app.updateSettings = function() {
    const home = document.getElementById('homescreen');
    const isHomeVisible = home && home.style.display !== 'none';

    const syncVal = (idApp, idHome, type='check') => {
        const elApp = document.getElementById(idApp);
        const elHome = document.getElementById(idHome);
        if (!elApp) return false;
        let val;
        if (!elHome) {
            val = type === 'check' ? elApp.checked : elApp.value;
            return val;
        }
        if (isHomeVisible) {
            val = type === 'check' ? elHome.checked : elHome.value;
            if (type === 'check') elApp.checked = val; else elApp.value = val;
        } else {
            val = type === 'check' ? elApp.checked : elApp.value;
            if (type === 'check') elHome.checked = val; else elHome.value = val;
        }
        return val;
    };

    settings.controlsEnabled = syncVal('set-controls', 'start-controls');
    settings.mouseSensitivity = parseFloat(syncVal('set-rotate-speed', 'start-rotate-speed', 'val')) || 1.0;
    settings.reducedMotion = syncVal('set-reduced-motion', 'start-reduced-motion');
    const highContrast = syncVal('set-high-contrast', 'start-high-contrast');
    settings.readAloud = syncVal('set-read-aloud', 'start-read-aloud');

    // NEU: In LocalStorage speichern, damit die Practice-Module darauf zugreifen können
    localStorage.setItem('elmeks_high_contrast', highContrast);
    localStorage.setItem('elmeks_read_aloud', settings.readAloud);
    
    // Checkbox-Werte auslesen (nur wenn sie im HTML existieren)
    const fpsApp = document.getElementById('set-performance');
    const fpsHome = document.getElementById('start-performance');
    
    if (isHomeVisible && fpsHome) {
        settings.showFPS = fpsHome.checked;
        if (fpsApp) fpsApp.checked = settings.showFPS;
    } else if (!isHomeVisible && fpsApp) {
        settings.showFPS = fpsApp.checked;
        if (fpsHome) fpsHome.checked = settings.showFPS;
    }

    // SICHERER WRAPPER TOGGLE
    const container = document.getElementById('fps-container');
    if (container) {
        container.style.display = settings.showFPS ? 'block' : 'none';
    }

    document.body.className = document.body.className.replace(/filter-\w+/g, ''); 
    document.body.classList.remove('high-contrast');
    
    if(highContrast) {
        document.body.classList.add('high-contrast');
    }
    
    app.updateVisionEffects();

    if (window.app.applyHighContrast3D) {
        window.app.applyHighContrast3D(highContrast);
    }

    if(!isFirstPersonActive()) {
        controls.rotateSpeed = settings.mouseSensitivity;
        controls.zoomSpeed = settings.mouseSensitivity;
        controls.enableDamping = !settings.reducedMotion;
    }
    
    const osc = document.getElementById('onscreen-controls');
    if(osc) {
        const simActive = isFirstPersonActive() || isVisionAnalysisMode;
        if(settings.controlsEnabled && !simActive) {
             osc.classList.add('visible');
             osc.style.display = 'flex'; 
        } else {
             osc.classList.remove('visible');
             osc.style.display = 'none';
        }
    }
};

window.app.applyHighContrast3D = function(isActive) {
    // Harte Monochrom-Werte
    const COLOR_ROOM = 0xeeeeee; // Sehr helles Grau für den Raum
    const COLOR_FURN = 0x111111; // Fast Schwarz für alle Möbel

    const applyColor = (mesh, isRoom) => {
        if (!mesh) return;
        mesh.traverse(child => {
            // WICHTIG: Nur sichtbare Meshes einfärben! Unsichtbare Hitboxen ignorieren.
            if (child.isMesh && child.material && child.material.visible !== false) {
                
                // 1. Original-Material einmalig dauerhaft sichern
                if (!child.userData.origMaterial) {
                    child.userData.origMaterial = child.material;
                }

                if (!isActive) {
                    // 2. Hochkontrast AUS: Zurück zum Original-Material (Texturen sind wieder da)
                    child.material = child.userData.origMaterial;
                } else {
                    // 3. Hochkontrast AN: Komplett sauberes, neues Material erzwingen!
                    const colorHex = isRoom ? COLOR_ROOM : COLOR_FURN;
                    child.material = new THREE.MeshStandardMaterial({
                        color: colorHex,
                        roughness: 0.9,   // Wenig Glanz (verhindert irritierende Reflektionen)
                        metalness: 0.05,
                        side: THREE.DoubleSide
                    });
                }
            }
        });
    };

    // 1. Raum überschreiben
    applyColor(currentRoomMesh, true);

    // 2. Radikal ALLE Möbel in der Szene überschreiben
    movableObjects.forEach(obj => {
        applyColor(obj, false);
    });
};

// setFontScale wurde nach js/modules/ui.js ausgelagert

// === OBJECT LIST & UNDO ===
function updateObjectList() {
    const container = document.getElementById('object-list-container');
    container.innerHTML = "";
    
    // NEU: Auch die Editor-Liste aktualisieren, wenn sie existiert
    if (window.app.updateEditorObjectList) {
        window.app.updateEditorObjectList();
    }

    if(movableObjects.length === 0) {
        container.innerHTML = "<small style='color:#888;'>Keine Objekte im Raum.</small>";
        return;
    }
    const counts = {};
    const objMap = {}; 
    movableObjects.forEach(obj => {
        if (!obj.userData.typeId) return;
        const name = ASSETS.furniture[obj.userData.typeId]?.name || "Objekt";
        if(!counts[name]) { counts[name] = 0; objMap[name] = []; }
        counts[name]++;
        objMap[name].push(obj);
    });
    for(let name in counts) {
        const div = document.createElement('div');
        div.className = "object-list-item";
        div.innerHTML = `<span>${name}</span> <span>${counts[name]}x</span>`;
        div.onclick = () => {
            deselectObject();
            selectedObjects = objMap[name];
            selectObject(selectedObjects[0]); 
        };
        container.appendChild(div);
    }
}

window.app.updateAnnotation = function(text) {
    if(selectedObjects.length > 0) selectedObjects.forEach(obj => { obj.userData.annotation = text; });
};

function saveHistory() {
    const state = movableObjects.map(obj => ({
        typeId: obj.userData.typeId,
        x: obj.position.x,
        z: obj.position.z,
        rot: obj.rotation.y,
        annotation: obj.userData.annotation || ""
    }));
    historyStack.push(state);
    if(historyStack.length > 20) historyStack.shift(); 
}

window.app.undo = function() {
    if(historyStack.length === 0) {
        showNotification("Nichts zum Rückgängig machen.");
        return;
    }
    const prevState = historyStack.pop();
    const hadAvatar = movableObjects.some(o => o.userData.isAvatar);
    if(hadAvatar) app.exitSimulationMode();
    
    movableObjects.forEach(obj => {
        scene.remove(obj);
        window.app.loesche3DObjekt(obj);
    });
    
    movableObjects = [];
    interactionMeshes = [];
    selectedObjects = [];
    deselectObject();
    
    prevState.forEach(item => {
        createFurnitureInstance(item.typeId, item.x, item.z, item.rot);
        if(item.annotation && movableObjects.length > 0) movableObjects[movableObjects.length-1].userData.annotation = item.annotation;
    });
    
    updateSeatCount();
    updateObjectList();
    updateAvatarUI();
    showNotification("Schritt rückgängig gemacht.");
};

// === FURNITURE LOGIC ===

window.app.addFurniture = async function (typeId) { 
    if (isFirstPersonActive() || isVisionAnalysisMode) return;
    saveHistory(); 
    if(typeId.startsWith('k')) document.body.style.cursor = 'wait'; 
    
    const asset = ASSETS.furniture[typeId];
    if(!asset.procedural && !asset.data) { 
        toggleLoader(true, "Lade Objekt..."); 
        await getOrLoadFurniture(typeId); 
        toggleLoader(false); 
    } 
    
    createFurnitureInstance(typeId, 0, 0, 0); 
    document.body.style.cursor = 'default'; 
    
    // FIX: Setzt das neu erstellte Objekt zwingend ins selectedObjects Array!
    setTimeout(() => { 
        const lastObj = movableObjects[movableObjects.length-1]; 
        if(lastObj) { 
            deselectObject(); 
            selectedObjects = [lastObj]; 
            selectObject(lastObj); 
        } 
    }, 50); 
};

window.app.loesche3DObjekt = function(objekt) {
    if (!objekt) return;
    objekt.traverse((kind) => {
        if (kind.isMesh) {
            if (kind.geometry) {
                kind.geometry.dispose();
            }
            if (kind.material) {
                const materialien = Array.isArray(kind.material) ? kind.material : [kind.material];
                materialien.forEach(mat => {
                    if (mat.map) mat.map.dispose();
                    if (mat.lightMap) mat.lightMap.dispose();
                    if (mat.bumpMap) mat.bumpMap.dispose();
                    if (mat.normalMap) mat.normalMap.dispose();
                    if (mat.specularMap) mat.specularMap.dispose();
                    if (mat.envMap) mat.envMap.dispose();
                    mat.dispose(); 
                });
            }
        }
    });
};

window.app.clearRoom = function(doSave=true) {
    if(doSave) saveHistory();
    const hadAvatar = movableObjects.some(o => o.userData.isAvatar);
    
    document.querySelectorAll('.name-tag').forEach(el => el.remove());
    window.app.activeNameTags = [];
    
    movableObjects.forEach(obj => {
        scene.remove(obj);
        window.app.loesche3DObjekt(obj);
    });
    
    movableObjects = [];
    interactionMeshes = [];
    deselectObject();
    updateSeatCount();
    updateObjectList();
    if(window.app.updateZoneListUI) window.app.updateZoneListUI();
    if (hadAvatar) updateAvatarUI();
};

window.app.rotateSelection = function(dir) { 
    if(!selectedObjects || selectedObjects.length===0) return; 
    saveHistory(); 
    selectedObjects.forEach(obj => obj.rotation.y += (Math.PI/4) * dir); 
    if(selectedObjects.length===1) selectionBox.update(); 
};

window.app.deleteSelection = function() {
    if (selectedObjects.length > 0) {
        saveHistory();
        let avatarDeleted = false;
        
        selectedObjects.forEach(obj => {
            if(obj.userData.isAvatar) avatarDeleted = true;
            
            if(obj.userData.isZone) {
                obj.userData.handles.forEach(h => {
                    const hIdx = interactionMeshes.indexOf(h);
                    if(hIdx > -1) interactionMeshes.splice(hIdx, 1);
                });
            }
            
            const hitbox = obj.userData.hitbox;
            if(hitbox) {
                const hIdx = interactionMeshes.indexOf(hitbox);
                if (hIdx > -1) interactionMeshes.splice(hIdx, 1);
            }
            
            scene.remove(obj);
            movableObjects = movableObjects.filter(o => o !== obj);
            
            window.app.loesche3DObjekt(obj);
        });
        
        deselectObject();
        updateSeatCount();
        updateObjectList();
        
        if(avatarDeleted) updateAvatarUI();
    }
};

// === WIZARD (REPAIRED & RESTORED) ===
function checkPositionValid(x, z, r, lx, lz) { 
    const tolerance = 0.1; 
    return (Math.abs(x) + r <= lx + tolerance) && (Math.abs(z) + r <= lz + tolerance); 
}

function calcRows(count, lx, lz) { 
    const r = ASSETS.furniture['row_combo'].radius; 
    const itemWidth = 1.4; 
    const itemDepth = 1.8; 
    const cols = Math.floor(((lx * 2) - 0.4) / itemWidth); 
    if(cols < 1) return null; 
    let res = []; 
    
    // Tafel mittig an die vordere Wand setzen (-Z Achse ist die Blickrichtung der Stühle)
    res.push({id: 'board', x: 0, z: -lz + 0.1, r: 0});
    
    const startX = -(cols * itemWidth) / 2 + (itemWidth/2); 
    const startZ = -(Math.ceil(count/cols) * itemDepth) / 2 + (itemDepth/2); 
    for(let i=0; i<count; i++) { 
        const col = i % cols; 
        const row = Math.floor(i / cols); 
        const z = startZ + (row * itemDepth); 
        const x = startX + (col * itemWidth); 
        if(!checkPositionValid(x, z, r, lx, lz)) return null; 
        res.push({id: 'row_combo', x: x, z: z, r: Math.PI}); 
    } 
    return res; 
}

function calcGroupsK6(count, lx, lz) { 
    const groupsNeeded = Math.ceil(count / 6); 
    const r = ASSETS.furniture['k6'].radius; 
    let diameter = (r * 2) + 0.3; 
    let cols = Math.floor((lx * 2) / diameter); 
    if(groupsNeeded > cols * Math.floor((lz * 2) / diameter)) return null; 
    let res = []; 
    const startX = -(cols * diameter) / 2 + diameter / 2; 
    const startZ = -(Math.ceil(groupsNeeded/cols) * diameter) / 2 + diameter / 2; 
    for (let i = 0; i < groupsNeeded; i++) { 
        const col = i % cols; 
        const row = Math.floor(i / cols); 
        const x = startX + (col * diameter); 
        const z = startZ + (row * diameter); 
        if(!checkPositionValid(x, z, r, lx, lz)) return null; 
        res.push({id: 'k6', x: x, z: z, r: (col+row)%2===0 ? 0 : Math.PI/4}); 
    } 
    return res; 
}

function calcExam(count, lx, lz) { 
    const itemWidth = 1.8; 
    const itemDepth = 1.8; 
    const cols = Math.floor((lx * 2) / itemWidth); 
    if(cols < 1) return null; 
    let res = []; 
    
    // Tafel mittig an die vordere Wand setzen
    res.push({id: 'board', x: 0, z: -lz + 0.1, r: 0});
    
    const startX = -(cols * itemWidth) / 2 + (itemWidth/2); 
    const startZ = -lz + 1.5; 
    for(let i=0; i<count; i++) { 
        const col = i % cols; 
        const row = Math.floor(i / cols); 
        const x = startX + (col * itemWidth); 
        const z = startZ + (row * itemDepth); 
        if(Math.abs(z) > lz - 0.5) return null; 
        res.push({id: 'row_combo', x: x, z: z, r: Math.PI}); 
    } 
    return res; 
}

function calcCircle(count, lx, lz) { 
    const r = ASSETS.furniture['chair'].radius; 
    const maxRoomRadius = Math.min(lx, lz) - 1.0; 
    if(maxRoomRadius < 1.0) return null; 
    const angleStep = (2 * Math.PI) / count; 
    let res = []; 
    for(let i=0; i<count; i++) { 
        const angle = i * angleStep; 
        res.push({id: 'chair', x: Math.sin(angle) * maxRoomRadius, z: Math.cos(angle) * maxRoomRadius, r: angle + Math.PI}); 
    } 
    return res; 
}

window.app.runWizard = async function() {
    if (isFirstPersonActive() || isVisionAnalysisMode) {
        showNotification("Funktion in Simulation gesperrt.");
        return;
    }

    const scenario = document.getElementById('wizard-scenario').value;
    if (!scenario) {
        showNotification("Bitte wählen Sie zuerst ein Szenario aus!");
        return;
    }

    saveHistory();
    const count = parseInt(document.getElementById('wizard-count').value);
    
    const lx = currentRoomLimits.x - 0.2; 
    const lz = currentRoomLimits.z - 0.2;
    
    let pending = [];

    switch(scenario) {
        case 'lecture': pending = calcRows(count, lx, lz); break;
        case 'group': pending = calcGroupsK6(count, lx, lz); break;
        case 'exam': pending = calcExam(count, lx, lz); break;
        case 'circle': pending = calcCircle(count, lx, lz); break;
    }

    if (!pending || pending.length === 0) { 
        showNotification("Raum zu klein oder ungültige Anzahl."); 
        return; 
    }
    
    app.clearRoom(false); 
    
    const uniqueTypes = [...new Set(pending.map(p => p.id))];
    let needsLoading = uniqueTypes.some(type => !ASSETS.furniture[type].data);
    
    if (needsLoading) {
        toggleLoader(true, "Lade Möbel..."); 
        for (let type of uniqueTypes) {
            if (!ASSETS.furniture[type].data) {
                await getOrLoadFurniture(type);
            }
        }
        toggleLoader(false); 
    }
    
    pending.forEach(p => createFurnitureInstance(p.id, p.x, p.z, p.r));
    showNotification("Planung generiert.");
};

// === ACCESSIBILITY CHECKS ===
function getAccessibilityStats() {
    let minFound = Infinity;
    let acousticPoints = 0;
    let wallIssues = 0;
    
    const targets = ASSETS.rooms[currentRoomFile].acousticTargets || { warn: 0.25, good: 0.45 };
    
    for(let i=0; i<movableObjects.length; i++) {
        const objA = movableObjects[i];
        const infoA = ASSETS.furniture[objA.userData.typeId];
        acousticPoints += (infoA.acousticBonus || 1);

        for(let j=i+1; j<movableObjects.length; j++) {
            const objB = movableObjects[j];
            const infoB = ASSETS.furniture[objB.userData.typeId];
            
            // NEU: Personas kollidieren in der Prüfung nicht mit Möbeln oder anderen Personas
            if (infoA.type === 'persona' || infoB.type === 'persona') continue;

            // EXAKTE ABSTANDSBERECHNUNG: Oriented Bounding Box (OBB)
            const dimsA = infoA.dims || { x: (infoA.radius||0.5)*2, z: (infoA.radius||0.5)*2 };
            const dimsB = infoB.dims || { x: (infoB.radius||0.5)*2, z: (infoB.radius||0.5)*2 };

            // Punkt von B in das Koordinatensystem von A setzen und an Möbelkanten klammern
            const localB = objA.worldToLocal(objB.position.clone());
            localB.x = Math.max(-dimsA.x/2, Math.min(dimsA.x/2, localB.x));
            localB.z = Math.max(-dimsA.z/2, Math.min(dimsA.z/2, localB.z));
            const closestPointOnA = objA.localToWorld(localB);

            // Punkt von A in das Koordinatensystem von B setzen und an Möbelkanten klammern
            const localA = objB.worldToLocal(objA.position.clone());
            localA.x = Math.max(-dimsB.x/2, Math.min(dimsB.x/2, localA.x));
            localA.z = Math.max(-dimsB.z/2, Math.min(dimsB.z/2, localA.z));
            const closestPointOnB = objB.localToWorld(localA);

            const gap = closestPointOnA.distanceTo(closestPointOnB);

            if (gap > 0.05) { 
                if (gap < minFound) minFound = gap;
            }
        }
    }

    if (minFound === Infinity) minFound = 2.0; 
    
    for(let obj of movableObjects) {
        if(obj.userData.isWallItem || !obj.userData.typeId) continue;
        const info = ASSETS.furniture[obj.userData.typeId];
        
        // EXAKTER WANDABSTAND: Rotiertes Profil berechnen
        const dims = info.dims || { x: (info.radius||0.5)*2, z: (info.radius||0.5)*2 };
        const cos = Math.abs(Math.cos(obj.rotation.y));
        const sin = Math.abs(Math.sin(obj.rotation.y));
        const extX = (dims.x / 2) * cos + (dims.z / 2) * sin;
        const extZ = (dims.x / 2) * sin + (dims.z / 2) * cos;
        
        const distX = currentRoomLimits.x - Math.abs(obj.position.x) - extX;
        const distZ = currentRoomLimits.z - Math.abs(obj.position.z) - extZ;
        
        const issueX = (distX > 0.05 && distX < 0.7);
        const issueZ = (distZ > 0.05 && distZ < 0.7);
        if(issueX || issueZ) wallIssues++; 
    }
    
    const minCm = movableObjects.length < 2 ? 100 : Math.round(minFound * 100);
    const roomArea = ASSETS.rooms[currentRoomFile].area || 50;
    const acousticScore = acousticPoints / roomArea; 
    
    return { minCm, wallIssues, count: movableObjects.length, acousticScore, targets };
}

window.app.checkAccessibility = function() {
    const stats = getAccessibilityStats();
    if(stats.count < 1) { showModal("Barrierefreiheit & Akustik", "Raum ist leer."); return; }

    let statusClass = stats.minCm < 70 ? "bad" : (stats.minCm < 90 ? "warn" : "good");
    let statusText = stats.minCm < 70 ? "Kritisch (<70cm)" : (stats.minCm < 90 ? "Akzeptabel (70-90cm)" : "Sehr gut (>90cm)");
    
    let acClass = "bad";
    let acText = "Viel Hall (Schlecht für Hörgeräte)";
    
    if(stats.acousticScore > stats.targets.warn) { acClass = "warn"; acText = "Akzeptabel (Mittel)"; }
    if(stats.acousticScore > stats.targets.good) { acClass = "good"; acText = "Gut gedämpft"; }

    let html = `<h4 style="color: #ffffff; margin-top: 0; margin-bottom: 15px;">Rollstuhlfreiheit</h4>
                <div class="report-item ${statusClass}"><span>Engster Durchgang:</span><span class="report-val">${stats.minCm} cm</span><div style="font-size:12px; color:#e5e7eb; margin-top:6px;">${statusText}</div></div>`;
    
    if(stats.wallIssues > 0) {
        html += `<div class="report-item warn"><span>Möbel ungünstig an Wand:</span><span class="report-val">${stats.wallIssues}</span><div style="font-size:12px; color:#e5e7eb; margin-top:6px;">Abstand zu klein für Durchgang, nicht bündig an der Wand.</div></div>`;
    }
    
    html += `<h4 style="color: #ffffff; margin-top:25px; margin-bottom: 15px;">Akustik (Prognose)</h4>
             <div class="report-item ${acClass}"><span>Hörsamkeit:</span><div style="font-size:13px; color:#ffffff; font-weight:600; margin-top:6px;">${acText}</div></div>`;
    
    if(acClass === "bad" || acClass === "warn") {
        html += `<div class="report-item" style="border-left-color:var(--primary); background:rgba(59, 130, 246, 0.15);"><span>Tipp:</span><div style="font-size:12px; color:#e5e7eb; margin-top:6px; line-height: 1.5;">Nutzen Sie Teppiche, Trennwände oder Wandabsorber (unter "Einzelmöbel & Ausstattung"), um die Akustik zu verbessern.</div></div>`;
    }

    html += `<p style="font-size:11px; color:#9ca3af; margin-top: 25px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">Hinweis: Schätzung basierend auf Möbelanzahl und Raumgröße.</p>`;

    showModal("Barrierefreiheit & Akustik", html);
};

// --- NEUER BLOCK: LITERATUR & QUELLEN ---
window.app.showReferences = function() {
    const linkStyle = "color: #3b82f6; text-decoration: none; border-bottom: 1px dotted #3b82f6;";
    const detailsStyle = "margin-bottom: 10px; background: rgba(255,255,255,0.03); border: 1px solid #374151; border-radius: 6px; padding: 10px;";
    // FIX: Die Überschriften der Dropdowns sollen NICHT markierbar sein (verhindert Flackern beim Klicken)
    const summaryStyle = "color: #e5e7eb; font-size: 13px; font-weight: 700; cursor: pointer; outline: none; user-select: none; -webkit-user-select: none;";
    const pStyle = "font-size: 11px; color: #9ca3af; margin-bottom: 8px; line-height: 1.5; padding-left: 10px; text-indent: -10px; margin-top: 10px;";

    // FIX: Dem Haupt-Container wurde 'user-select: text !important' und 'cursor: text' hinzugefügt
    const html = `
        <div style="max-height: 60vh; overflow-y: auto; padding-right: 10px; user-select: text !important; -webkit-user-select: text !important; cursor: text;">
            <p style="font-size: 12px; color: #d1d5db; margin-bottom: 15px;">Die fachlichen Informationen und pädagogischen Hinweise in diesem Tool basieren auf folgenden Quellen:</p>
            
            <div style="background: rgba(245, 158, 11, 0.1); border-left: 3px solid #f59e0b; padding: 10px; margin-bottom: 20px; font-size: 11px; color: #d1d5db; border-radius: 0 4px 4px 0;">
                <strong style="color: #f59e0b; display: block; margin-bottom: 4px;">Grenzen der Simulation:</strong>
                Eine Simulation repliziert nicht die tatsächliche Lebensrealität. Sehende Personen haben stets den Vorteil, auf visuelle Erinnerungen und Vorerfahrungen zurückgreifen zu können. Diese Filter dienen dem Aufbau von Empathie und Verständnis, nicht der exakten medizinischen Nachbildung.
            </div>
            
            <details style="${detailsStyle}">
                <summary style="${summaryStyle}">Spezifische Krankheitsbilder</summary>
                <div style="${pStyle}"><strong>Retinopathie (ROP):</strong> Akman, S. H., Pfeil, J. M., et al. (2021). Epidemiology and treatment of retinopathy of prematurity: The Hannover Data in Retina.net ROP registry from 2001-2017. <em>Ophthalmologie</em> 119 (5), S. 497–505.</div>
                <div style="${pStyle}"><strong>Retinopathie (ROP):</strong> Hübler, A. & Dawczynski, J. (2010). Retinopathia praematurorum. In: Gerhard, J. & Hübler, A. (Hrsg.) <em>Neonatologie: Die Medizin des Früh- und Reifgeborenen.</em> Stuttgart: Georg Thieme Verlag KG.</div>
                <div style="${pStyle}"><strong>CVI:</strong> Bennett, R. & Baskin, K. (2026). <em>When to Suspect CVI.</em> Perkins School for the Blind. <br><a href="https://www.perkins.org/when-to-suspect-cvi-guide/" target="_blank" style="${linkStyle}">Online lesen</a></div>
                <div style="${pStyle}"><strong>CVI:</strong> National Eye Institute (2024). <em>Cerebral Visual Impairment (CVI).</em> <br><a href="https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/cerebral-visual-impairment-cvi" target="_blank" style="${linkStyle}">Online lesen</a></div>
                <div style="${pStyle}"><strong>Glaukom:</strong> Universitätsspital Zürich (2021/2025). <em>Kongenitales und juveniles Glaukom.</em> <br><a href="https://www.usz.ch/krankheit/kongenitales-und-juveniles-glaukom/" target="_blank" style="${linkStyle}">Online lesen</a></div>
            </details>

            <details style="${detailsStyle}">
                <summary style="${summaryStyle}">Allgemeine Augenheilkunde & Epidemiologie</summary>
                <div style="${pStyle}">Bundesinstitut für Öffentliche Gesundheit (2025). <em>Sehstörungen bei Kindern erkennen.</em> <br><a href="https://www.kindergesundheit-info.de/themen/entwicklung/entwicklungsschritte/sehvermoegen/sehstoerungen/" target="_blank" style="${linkStyle}">Online lesen</a></div>
                <div style="${pStyle}">Dube, M., et al. (2024). Prevalence and Pattern of Ocular Diseases Among Children Aged 7-14 Years Visiting a Tertiary Care Teaching Hospital in Central India. <em>Cureus</em> 16 (8), e66383.</div>
                <div style="${pStyle}">Grehn, F. (1968/2006). <em>Augenheilkunde.</em> Heidelberg: Springer Medizin Verlag.</div>
                <div style="${pStyle}">Jeong, Y. D., et al. (2025). Global Prevalence of Congenital Color Vision Deficiency among Children and Adolescents, 1932-2022. <em>Ophthalmology</em>, 132(12), 1431–1444.</div>
                <div style="${pStyle}">Schmidtke, C., et al. (2018). Inanspruchnahme der Früherkennungsuntersuchungen für Kinder in Deutschland – Querschnittergebnisse aus KiGGS Welle 2. <em>Journal of Health Monitoring</em> 3 (4), S. 68–77. Berlin: RKI.</div>
                <div style="${pStyle}">Turbert, D. (2024). <em>Childhood Eye Diseases and Conditions.</em> American Academy of Ophthalmology. <br><a href="https://www.aao.org/eye-health/tips-prevention/common-childhood-diseases-conditions" target="_blank" style="${linkStyle}">Online lesen</a></div>
                <div style="${pStyle}">Vaughan, D. & Asbury, T. (1983). <em>Ophthalmologie: Diagnose und Therapie in der Praxis.</em> Berlin/Heidelberg/New York/Tokyo: Springer-Verlag.</div>
            </details>

            <details style="${detailsStyle}">
                <summary style="${summaryStyle}">Didaktik & Simulation</summary>
                <div style="${pStyle}">Capovilla, D. & Gebhardt, M. (2016). Assistive Technologien für Menschen mit Sehschädigung im inklusiven Unterricht. <em>Zeitschrift für Heilpädagogik</em> (1), S. 4–15. Würzburg: Verband Sonderpädagogik e.V.</div>
                <div style="${pStyle}">
                    <strong>⭐ Degenhardt, S., Gewinn, W. & Schütt, M.-L. (2016).</strong> <em>Spezifisches Curriculum für Menschen mit Blindheit und Sehbehinderung.</em> Norderstedt: Books on Demand GmbH.<br>
                    <span style="color: #3b82f6; font-size: 10px;">➔ Beschreibt einen spezifischen Lehrplan und dient als zentrale didaktische Grundlage.</span>
                </div>
                <div style="${pStyle}">Krug, F.-K. (2001). Grundlagen einer Didaktik für Sehbehinderte. In: F.-K. Krug (Hrsg.), <em>Didaktik für den Unterricht mit sehbehinderten Schülern</em>, S. 15-26. Stuttgart: Ernst Reinhardt Verlag.</div>
                <div style="${pStyle}">Lang, M. (2024). Förderschwerpunkt Sehen: Pädagogik bei Blindheit und Sehbeeinträchtigung. In: E. Kiel & S. Weiß (Hrsg.), <em>Inklusive Didaktik für die Regelschule: Eine Einführung für Studium und Praxis</em>, S. 49-66. Bad Heilbrunn: Julius Klinkhardt.</div>
                <div style="${pStyle}">Lang, M. & Thiele, M. (2020). <em>Schüler mit Sehbehinderung und Blindheit im inklusiven Unterricht: Praxistipps für Lehrkräfte.</em> München: Ernst Reinhardt Verlag.</div>
                <div style="${pStyle}">Willings, C. (2025). <em>Simulation Activities.</em> teachingvisuallyimpaired.com.</div>
            </details>
        </div>
    `;
    
    showModal("Literaturverzeichnis", html);
};

// === SAVE & LOAD & PDF ===
window.app.savePlan = function() {
    const data = {
        room: currentRoomFile,
        furniture: movableObjects.map(obj => {
            const eId = obj.userData.exportId || obj.uuid;
            if (obj.userData.isZone) {
                return { isZone: true, exportId: eId, points: obj.userData.points, zoneName: obj.userData.zoneName, color: obj.userData.zoneColor, x: obj.position.x, z: obj.position.z };
            }
            return { 
                typeId: obj.userData.typeId, exportId: eId, x: obj.position.x, z: obj.position.z, rot: obj.rotation.y, 
                annotation: obj.userData.annotation || "", isLocked: obj.userData.isLocked || false,
                infoText: obj.userData.infoText || "", isError: obj.userData.isError || false
            };
        })
    };
    const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; a.download = 'raumplan.elmeks'; a.click();
    showNotification("Plan als .elmeks gespeichert.");
};

window.app.exportScenario = function() {
    if (!app.scenarioData.title) { showNotification("Bitte geben Sie dem Szenario zuerst einen Titel im rechten Menü!"); return; }
    const data = {
        room: currentRoomFile,
        scenarioData: app.scenarioData,
        furniture: movableObjects.map(obj => {
            const eId = obj.userData.exportId || obj.uuid;
            if (obj.userData.isZone) {
                return { isZone: true, exportId: eId, points: obj.userData.points, zoneName: obj.userData.zoneName, color: obj.userData.zoneColor, x: obj.position.x, z: obj.position.z };
            }
            return { 
                typeId: obj.userData.typeId, exportId: eId, x: obj.position.x, z: obj.position.z, rot: obj.rotation.y, 
                annotation: obj.userData.annotation || "", isLocked: obj.userData.isLocked || false,
                infoText: obj.userData.infoText || "", isError: obj.userData.isError || false
            };
        })
    };
    const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    const safeName = app.scenarioData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.href = url; a.download = `szenario_${safeName}.elmeks`; a.click();
    showNotification("Szenario erfolgreich exportiert.");
};

// handleFileSelection, confirmLoad und resetLoadUI wurden für das Lazy Loading in js/modules/ui.js ausgelagert.

window.app.executeLoad = async function(targetMode) {
    const data = window.app.pendingLoadData;
    if(!data) return;

    document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById('homescreen').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex';
    
    toggleLoader(true, "Lade Umgebung...");

    if(data.room !== currentRoomFile) { 
        await app.switchRoom(data.room); 
        app.clearRoom(false); 
    } else { 
        app.clearRoom(false); 
    }

    window.app.scenarioData = { title: "", desc: "", tasks: [], allowedTools: [] };

    if (data.scenarioData) {
        app.scenarioData = data.scenarioData;
    }

    for(let item of data.furniture) {
        if (item.isZone) {
            createFurnitureInstance('zone_custom', item.x || 0, item.z || 0, 0);
            const newZone = movableObjects[movableObjects.length - 1];
            
            newZone.userData.points = item.points.map(p => new THREE.Vector2(p.x, p.y));
            newZone.userData.zoneName = item.zoneName;
            newZone.userData.zoneColor = item.color; 
            newZone.userData.exportId = item.exportId;
            
            newZone.userData.visualMesh.material.color.setHex(item.color || 0x10b981);
            newZone.userData.wireframe.material.color.setHex(item.color || 0x10b981);
            
            window.app.updateZoneGeometry(newZone);
        } else {
            if(ASSETS.furniture[item.typeId] && !ASSETS.furniture[item.typeId].data && !ASSETS.furniture[item.typeId].procedural) { 
                await getOrLoadFurniture(item.typeId); 
            }
            createFurnitureInstance(item.typeId, item.x, item.z, item.rot);
            const newObj = movableObjects[movableObjects.length - 1];
            if (newObj) {
                newObj.userData.exportId = item.exportId;
                if(item.annotation) newObj.userData.annotation = item.annotation;
                if(item.isLocked) newObj.userData.isLocked = item.isLocked;
                if(item.infoText) newObj.userData.infoText = item.infoText; 
                if(item.isError) newObj.userData.isError = item.isError;
            }
        }
    }

    if(window.app.updateZoneListUI) window.app.updateZoneListUI();

    window.app.currentMode = targetMode;
    app.applyModeUI();
    
    if (targetMode === 'editor') {
        document.getElementById('scenario-title').value = app.scenarioData.title || "";
        document.getElementById('scenario-desc').value = app.scenarioData.desc || "";
        if(app.renderTaskList) app.renderTaskList();
        if(window.app.updateEditorObjectList) window.app.updateEditorObjectList();
        showNotification(`Editor: Szenario "${app.scenarioData.title}" geladen.`);
    } else if (targetMode === 'play') {
        movableObjects.forEach(o => o.userData.isPreplaced = true);
        if (typeof camera !== 'undefined' && typeof controls !== 'undefined') {
            camera.position.set(0, 18, 0); 
            controls.target.set(0, 0, 0);
            controls.update();
        }
        if(app.startNameTags) app.startNameTags();
        if (window.app.initPlayModeHUD) window.app.initPlayModeHUD();
        showNotification(`Lernsequenz gestartet!`);
    } else {
        showNotification("Plan geladen.");
    }
    
    window.app.pendingLoadData = null; 
    app.resetLoadUI(); 
    toggleLoader(false);
};

// goHome wurde in js/modules/ui.js ausgelagert

// === HIGH-END PDF EXPORT (FINAL DESIGN - Ohne Abfrage) ===
window.app.exportPDF = async function() {
    // 1. Vorbereitung & Kamera-Setup
    app.setCamera('top');
    toggleLoader(true, "Generiere Report...");
    await new Promise(r => setTimeout(r, 800));
    
    // 2. Initialisierung
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // --- Corporate Design Farben (TU Dresden orientiert) ---
    const cBlueDark  = [0, 48, 93];    // TU Dunkelblau (HKS 41)
    const cBlueLight = [0, 158, 224];  // TU Hellblau (Akzent)
    const cGrayText  = [80, 80, 80];   // Fließtext Grau
    const cGrayLight = [240, 240, 240];// Hintergründe
    const cWhite     = [255, 255, 255];
    
    // Status Farben
    const cSuccess = [0, 125, 64];   // Grün
    const cWarn    = [230, 150, 0];  // Orange
    const cDanger  = [200, 30, 30];  // Rot

    // Hilfsfunktion: Zeichnet eine Sektions-Überschrift
    const drawSectionHeader = (text, y) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...cBlueDark);
        doc.text(text.toUpperCase(), 20, y);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(20, y + 2, 190, y + 2);
        return y + 10;
    };

    // === 1. HEADER ===
    doc.setFillColor(...cBlueDark);
    doc.rect(0, 0, 210, 12, 'F'); 
    
    doc.setTextColor(...cWhite);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("RAUMPLANUNGS-REPORT", 20, 8.5);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("ELMeKS.digital | TU Dresden", 190, 8.5, { align: "right" });

    // === 2. METADATEN ===
    const dateStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const roomName = ASSETS.rooms[currentRoomFile]?.name || "Unbekannter Raum";
    const seatCount = document.getElementById("seat-count").innerText;

    doc.setFontSize(9);
    doc.setTextColor(...cGrayText);
    
    // Grid für Metadaten
    let metaY = 22;
    doc.text("DATUM", 20, metaY);
    doc.text("RAUM-MODELL", 80, metaY);
    doc.text("KAPAZITÄT", 160, metaY);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(dateStr, 20, metaY + 5);
    doc.text(roomName, 80, metaY + 5);
    doc.text(seatCount + " Sitzplätze", 160, metaY + 5);

    let currentY = 38;

    // === 3. SCREENSHOT ===
    renderer.render(scene, camera);
    
    if (window.app.stats) {
        window.app.stats.update();
    }
    const imgData = renderer.domElement.toDataURL("image/jpeg", 0.95);
    const imgProps = doc.getImageProperties(imgData);
    const pdfWidth = 170;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    // Feiner Rahmen um das Bild
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.rect(19.5, currentY - 0.5, pdfWidth + 1, pdfHeight + 1); 
    doc.addImage(imgData, 'JPEG', 20, currentY, pdfWidth, pdfHeight);

    currentY += pdfHeight + 15;

    // === 4. ANALYSE DASHBOARD ===
    currentY = drawSectionHeader("Analyse & Barrierefreiheit", currentY);

    const stats = getAccessibilityStats();
    
    // Logik für Status
    let accStatus = "KRITISCH";
    let accColor = cDanger;
    if (stats.minCm >= 70) { accStatus = "EINGESCHRÄNKT"; accColor = cWarn; }
    if (stats.minCm >= 90) { accStatus = "DIN KONFORM"; accColor = cSuccess; }
    if (stats.count < 2)   { accStatus = "LEER"; accColor = cGrayText; }

    let soundStatus = "HALLIG (SCHLECHT)";
    let soundColor = cDanger;
    if(stats.acousticScore > stats.targets.warn) { soundStatus = "AKZEPTABEL"; soundColor = cWarn; }
    if(stats.acousticScore > stats.targets.good) { soundStatus = "GUT (GEDÄMPFT)"; soundColor = cSuccess; }

    // Box Parameter
    const boxW = 82;
    const boxH = 28;
    
    // --- LINKE BOX: ROLLSTUHL ---
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(252, 252, 252);
    doc.roundedRect(20, currentY, boxW, boxH, 2, 2, 'FD'); 
    
    doc.setFillColor(...accColor);
    doc.rect(20, currentY, 3, boxH, 'F'); 

    doc.setFontSize(8); doc.setTextColor(...cGrayText); doc.setFont("helvetica", "bold");
    doc.text("DURCHGANGSBREITE", 26, currentY + 6);
    
    doc.setFontSize(12); doc.setTextColor(...accColor);
    doc.text(accStatus, 26, currentY + 12);

    doc.setFontSize(10); doc.setTextColor(0,0,0); doc.setFont("helvetica", "normal");
    doc.text(`Gemessen: ${stats.minCm} cm`, 26, currentY + 18);
    
    let hintText = stats.minCm < 90 ? "Empfohlen: > 90cm" : "Anforderung erfüllt";
    doc.setFontSize(8); doc.setTextColor(...cGrayText);
    doc.text(hintText, 26, currentY + 24);

    // --- RECHTE BOX: AKUSTIK ---
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(252, 252, 252);
    doc.roundedRect(108, currentY, boxW, boxH, 2, 2, 'FD');

    doc.setFillColor(...soundColor);
    doc.rect(108, currentY, 3, boxH, 'F');

    doc.setFontSize(8); doc.setTextColor(...cGrayText); doc.setFont("helvetica", "bold");
    doc.text("AKUSTIK-PROGNOSE", 114, currentY + 6);
    
    doc.setFontSize(12); doc.setTextColor(...soundColor);
    doc.text(soundStatus, 114, currentY + 12);

    doc.setFontSize(10); doc.setTextColor(0,0,0); doc.setFont("helvetica", "normal");
    let acousticDetail = "Basierend auf Möblierung";
    if(stats.wallIssues > 0) acousticDetail += ` + ${stats.wallIssues} Wandkonflikte`;
    doc.text(acousticDetail, 114, currentY + 18);

    doc.setFontSize(8); doc.setTextColor(...cGrayText);
    doc.text("Schätzwert (Simulation)", 114, currentY + 24);

    currentY += boxH + 15;

    // === 5. INVENTARLISTE ===
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...cBlueDark);
    doc.text("INVENTARLISTE", 20, currentY);
    
    // Daten vorbereiten
    const tableData = [];
    const groupedCounts = {};
    const itemNames = {};

    movableObjects.forEach(obj => { 
        const type = obj.userData.typeId;
        const name = ASSETS.furniture[type].name;
        const note = obj.userData.annotation || "";
        if (!note) {
            groupedCounts[type] = (groupedCounts[type] || 0) + 1;
            itemNames[type] = name;
        } else {
            tableData.push([name, "1", note]);
        }
    });

    for (const [type, count] of Object.entries(groupedCounts)) {
        tableData.push([itemNames[type], count.toString(), "-"]);
    }
    tableData.sort((a, b) => a[0].localeCompare(b[0]));

    doc.autoTable({
        startY: currentY + 3,
        head: [['OBJEKT', 'ANZ.', 'ANMERKUNG']],
        body: tableData,
        theme: 'plain',
        headStyles: { 
            fillColor: cBlueDark, 
            textColor: 255, 
            fontStyle: 'bold', 
            fontSize: 9,
            cellPadding: 4
        },
        bodyStyles: {
            textColor: [50, 50, 50],
            fontSize: 9,
            cellPadding: 4,
            lineColor: [230, 230, 230],
            lineWidth: 0.1
        },
        columnStyles: { 
            0: { cellWidth: 80, fontStyle: 'bold' }, 
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 'auto', fontStyle: 'italic', textColor: [100, 100, 100] } 
        },
        margin: { left: 20, right: 20 },
        didParseCell: function(data) {
            if (data.section === 'body') {
                data.cell.styles.borderBottomWidth = 0.1;
            }
        }
    });

    // === 6. FOOTER / LLR INFO ===
    let finalY = doc.lastAutoTable.finalY + 15;
    const pageHeight = doc.internal.pageSize.height;
    
    // Wenn weniger als 60mm Platz ist -> Neue Seite
    if (pageHeight - finalY < 60) {
        doc.addPage();
        finalY = 30;
    } else {
        // Schiebe Footer nach unten, aber nicht tiefer als bottom margin
        finalY = Math.max(finalY, pageHeight - 65);
    }

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(20, finalY, 190, finalY);
    
    let textY = finalY + 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...cBlueDark);
    doc.text("Lehr-Lern-Raum Inklusion (LLR) @ TU Dresden", 20, textY);
    
    textY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...cGrayText);
    doc.text("Zellescher Weg 20, Seminargebäude II, Raum 21", 20, textY);
    
    textY += 7;
    doc.setTextColor(...cBlueLight);
    const urlWeb = "https://tu-dresden.de/zlsb/lehramtsstudium/im-studium/studienunterstuetzende-angebote/inklusionsraums";
    doc.textWithLink(">> Webseite besuchen (tu-dresden.de/...)", 20, textY, { url: urlWeb });

    textY += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("Materialien & Kurse:", 20, textY);
    
    textY += 5;
    const urlOpal = "https://bildungsportal.sachsen.de/opal/auth/RepositoryEntry/20508278784/CourseNode/1614569282320629";
    doc.setTextColor(...cBlueLight);
    doc.setFont("helvetica", "normal");
    doc.textWithLink(">> Zum OPAL-Kurs wechseln", 20, textY, { url: urlOpal });
    
    // === 7. PAGE NUMBERS ===
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(180, 180, 180);
        doc.text(`Seite ${i} von ${pageCount}`, 105, 290, { align: 'center' });
    }

    // Speichern
    const safeName = roomName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`Raumplan_${safeName}_${Date.now()}.pdf`);
    
    toggleLoader(false);
};

// === ASSET LOADING & ROOM MANAGEMENT ===
function getOrLoadFurniture(key) {
    return new Promise((resolve) => {
        const obj = ASSETS.furniture[key];
        if (obj.data) { resolve(obj.data); return; }
        if (obj.procedural) { resolve(true); return; }
        if (!obj.file) { resolve(null); return; }

        const loader = obj.file.endsWith('.obj') ? objLoader : gltfLoader;
        loader.load("models/" + obj.file, (result) => {
            const model = result.scene || result;
            model.scale.set(GLOBAL_SCALE, GLOBAL_SCALE, GLOBAL_SCALE);
            disableCullingRecursively(model);
            obj.data = model;
            resolve(model);
        }, undefined, (err) => { resolve(null); });
    });
}

// PERFORMANCE 5: Frustum Culling reparieren (GPU entlasten, nur Sichtbares rendern!)
function disableCullingRecursively(obj) {
    if (!obj) return;
    
    // Culling AKTIVIEREN, damit Dinge hinter der Kamera ignoriert werden
    obj.frustumCulled = true; 
    
    if (obj.isMesh) {
        if(obj.material) obj.material.side = THREE.DoubleSide;
        if(obj.geometry) {
            // Exakte Boxen berechnen, statt Radius auf Unendlich zu setzen
            obj.geometry.computeBoundingBox();
            obj.geometry.computeBoundingSphere();
        }
    }
    if(obj.children && obj.children.length > 0) {
        obj.children.forEach(child => disableCullingRecursively(child));
    }
}

function loadRoomAsset(filename) {
    return new Promise((resolve, reject) => {
        const info = ASSETS.rooms[filename];
        if (info.data) { resolve(info.data); return; }
        const path = "models/";
        const loader = (info.type === 'obj' || filename.endsWith('.obj')) ? objLoader : gltfLoader;
        loader.load(path + filename, (result) => {
            const model = result.scene || result;
            model.scale.set(GLOBAL_SCALE, GLOBAL_SCALE, GLOBAL_SCALE);
            info.data = model;
            resolve(model);
        }, undefined, reject);
    });
}

window.app.switchRoom = async function(filename) {
  const roomInfo = ASSETS.rooms[filename];
  if (!roomInfo) return;
  
  app.exitSimulationMode();
  saveHistory();
  
  const savedFurniture = movableObjects.map(obj => ({
      typeId: obj.userData.typeId, x: obj.position.x, z: obj.position.z, rot: obj.rotation.y
  }));
  
  let modelData = roomInfo.data;
  if (!modelData) {
      toggleLoader(true, "Wechsle Raum...");
      try { modelData = await loadRoomAsset(filename); } 
      catch(e) { toggleLoader(false); showNotification("Fehler beim Laden des Raumes"); return; }
      toggleLoader(false);
  }
  
  // Clean up old room
  if (currentRoomMesh) {
      scene.remove(currentRoomMesh);
      currentRoomMesh.traverse(o => { if(o.geometry) o.geometry.dispose(); });
      currentRoomMesh = null;
  }
  
  window.app.clearRoom(false);
  setupRoom(modelData, filename);
  
  const newLimits = roomInfo.playableArea;
  const limitX = newLimits.x - 0.5; const limitZ = newLimits.z - 0.5;
  
  savedFurniture.forEach(async (item) => {
      if(ASSETS.furniture[item.typeId].file && !ASSETS.furniture[item.typeId].data) {
          await getOrLoadFurniture(item.typeId);
      }
      let newX = Math.max(-limitX, Math.min(limitX, item.x));
      let newZ = Math.max(-limitZ, Math.min(limitZ, item.z));
      createFurnitureInstance(item.typeId, newX, newZ, item.rot);
  });
};

function setupRoom(model, filename) {
  currentRoomFile = filename;
  const roomInfo = ASSETS.rooms[filename];
  currentRoomMesh = model.clone();
  disableCullingRecursively(currentRoomMesh);
  
  // PERFORMANCE 7: Raum wirft keine Schatten auf sich selbst, er empfängt sie nur!
  currentRoomMesh.traverse(child => {
      if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = true;
      }
  });

  const box = new THREE.Box3().setFromObject(currentRoomMesh);
  const center = box.getCenter(new THREE.Vector3());
  currentRoomMesh.position.set(-center.x, 0, -center.z);
  currentRoomMesh.position.y = -box.min.y;
  scene.add(currentRoomMesh);
  currentRoomMesh.updateMatrixWorld(true);
  
  // WICHTIG: Limits aktualisieren für den Wizard
  currentRoomLimits = roomInfo.playableArea;
  
  updateSeatCount();
  updateObjectList();
  window.app.setCamera('top');
  historyStack = [];
  
  // NEU: Wenn Hochkontrast-Modus an ist, sofort den neuen Raum überschreiben
  if (window.app.applyHighContrast3D) {
      const highContrastToggle = document.getElementById('set-high-contrast');
      if (highContrastToggle && highContrastToggle.checked) {
          window.app.applyHighContrast3D(true);
      }
  }
}

function toggleLoader(show, text) {
    const el = document.getElementById("loader");
    const txt = document.getElementById("loading-text");
    if(el) {
        if(show) { if(txt && text) txt.innerText = text; el.classList.add("active"); } 
        else { el.classList.remove("active"); }
    }
}

function showModal(title, htmlContent) {
    document.getElementById('modal-title').innerText = title;
    const closeBtn = '<div style="margin-top:20px; text-align:right;"><button class="primary" onclick="document.getElementById(\'modal-overlay\').classList.remove(\'active\')">Schließen</button></div>';
    document.getElementById('modal-content').innerHTML = htmlContent + closeBtn;
    document.getElementById('modal-overlay').classList.add('active');
}

function showNotification(msg) {
    const el = document.getElementById("notification");
    el.innerText = msg;
    el.classList.add("visible");
    setTimeout(() => el.classList.remove("visible"), 3000);
}

function updateSeatCount() { 
    let total = 0; 
    movableObjects.forEach(obj => { 
        if(obj.userData.typeId) total += (ASSETS.furniture[obj.userData.typeId].seats || 0); 
    }); 
    document.getElementById("seat-count").innerText = total; 
    const playCounter = document.getElementById("play-seat-count");
    if(playCounter) playCounter.innerText = total;
}

// === CREATE INSTANCE ===
function createFurnitureInstance(typeId, x, z, rotY) {
    const info = ASSETS.furniture[typeId];
    
    if (typeId === 'avatar_procedural') {
        const av = toggleAvatar(scene, movableObjects, interactionMeshes);
        if(av) { 
            av.position.set(x, 0, z); 
            av.rotation.y = rotY; 
            updateObjectList();
            updateAvatarUI();
        }
        return;
    }

    let visual;
    const wrapper = new THREE.Group();
    wrapper.userData = { typeId: typeId, root: wrapper, isWallItem: !!info.isWallItem };

    if (info.procedural) {
        if (info.type === 'persona') {
            const pGroup = new THREE.Group();
            const matBody = new THREE.MeshStandardMaterial({ color: info.color, roughness: 0.6 });
            
            if (typeId === 'persona_mia') {
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.5), matBody);
                body.position.set(0, 0.4, 0); body.castShadow = true;
                const wheelMat = new THREE.MeshStandardMaterial({color: 0x222222, roughness: 0.9});
                const wheelL = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16), wheelMat);
                wheelL.rotation.z = Math.PI / 2; wheelL.position.set(-0.3, 0.3, 0); wheelL.castShadow = true;
                const wheelR = wheelL.clone(); wheelR.position.set(0.3, 0.3, 0); wheelR.castShadow = true;
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), new THREE.MeshStandardMaterial({color: 0xf3f4f6}));
                head.position.set(0, 0.9, 0); head.castShadow = true;
                pGroup.add(body, wheelL, wheelR, head);
            } else {
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.6, 16), matBody);
                body.position.set(0, 0.3, 0); body.castShadow = true;
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), new THREE.MeshStandardMaterial({color: 0xf3f4f6}));
                head.position.set(0, 0.75, 0); head.castShadow = true;
                pGroup.add(body, head);
                
                // Visuelle Erkennungsmerkmale (echte 3D Geometrien)
                if (typeId === 'persona_ben') {
                    const hpMat = new THREE.MeshStandardMaterial({color: 0x222222});
                    const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), hpMat);
                    earL.rotation.z = Math.PI/2; earL.position.set(-0.18, 0.75, 0);
                    const earR = earL.clone(); earR.position.set(0.18, 0.75, 0);
                    const band = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 8, 24, Math.PI), hpMat);
                    band.position.set(0, 0.75, 0);
                    pGroup.add(earL, earR, band);
                } else if (typeId === 'persona_lukas') {
                    const haMat = new THREE.MeshStandardMaterial({color: 0xef4444}); 
                    const ha = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), haMat);
                    ha.position.set(0.17, 0.75, 0.05);
                    pGroup.add(ha);
                } else if (typeId === 'persona_tim') {
                    const glMat = new THREE.MeshStandardMaterial({color: 0x111111});
                    const glassL = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 8, 16), glMat);
                    glassL.position.set(-0.07, 0.77, 0.17);
                    const glassR = glassL.clone(); glassR.position.set(0.07, 0.77, 0.17);
                    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.01), glMat);
                    bridge.position.set(0, 0.77, 0.17);
                    pGroup.add(glassL, glassR, bridge);
                }
            }
            visual = pGroup;
            wrapper.add(visual);

        } else if (info.type === 'zone') {
            wrapper.userData.isZone = true;
            const zColor = wrapper.userData.zoneColor !== undefined ? wrapper.userData.zoneColor : info.color;

            wrapper.userData.points = wrapper.userData.points || [
                new THREE.Vector2(-1, -1), new THREE.Vector2(1, -1),
                new THREE.Vector2(1, 1), new THREE.Vector2(-1, 1)
            ];
            wrapper.userData.handles = [];

            const visualMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ 
                color: zColor, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide
            }));
            visualMesh.rotation.x = -Math.PI / 2;
            wrapper.add(visualMesh);
            wrapper.userData.visualMesh = visualMesh;

            const wireMat = new THREE.LineBasicMaterial({ color: zColor, linewidth: 3 });
            const wireframe = new THREE.LineSegments(new THREE.BufferGeometry(), wireMat);
            wireframe.rotation.x = -Math.PI / 2;
            wrapper.add(wireframe);
            wrapper.userData.wireframe = wireframe;
            
            window.app.updateZoneGeometry(wrapper);
            visual = wrapper;
        } else {
            const geo = new THREE.BoxGeometry(info.dims.x, info.dims.y, info.dims.z);
            const mat = new THREE.MeshStandardMaterial({ color: info.color, roughness: 0.8 });
            visual = new THREE.Mesh(geo, mat);
            if(info.noShadow) { visual.castShadow = false; } else { visual.castShadow = true; }
            visual.receiveShadow = true;
            let visualY = info.dims.y / 2;
            if(typeId === 'carpet_proc') visualY += 0.005;
            visual.position.y = visualY; 
            wrapper.add(visual);
        }
    } else {
        if (!info.data) return; 
        visual = info.data.clone();
        disableCullingRecursively(visual);
        const colorlessFurniture = ['table_square', 'table_double', 'sofa', 'board', 'teacher', 'cupboard', 'cabinet_short', 'cabinet_long'];
        if (colorlessFurniture.includes(typeId)) {
            visual.traverse(child => {
                if (child.isMesh && child.material) { 
                    // PERFORMANCE 6: Material Caching! Verhindert vollen Grafikspeicher bei vielen Tischen
                    if (!info.cachedDarkMaterial) {
                        info.cachedDarkMaterial = child.material.clone();
                        info.cachedDarkMaterial.color.setHex(0x2c3e50);
                    }
                    child.material = info.cachedDarkMaterial; 
                }
            });
        }
        const box = new THREE.Box3().setFromObject(visual);
        const center = new THREE.Vector3(); box.getCenter(center);
        visual.position.x = -center.x; visual.position.y = -box.min.y; visual.position.z = -center.z;
        
        visual.traverse(c => { if(c.isMesh && c.material) { c.material.depthWrite = true; c.material.transparent = false; }});
        wrapper.add(visual);
    }
    
    if (info.type !== 'zone') {
        const hW = info.dims ? info.dims.x : 1.0;
        const hD = info.dims ? info.dims.z : 1.0;
        const hH = info.dims ? (info.dims.y || 1.2) : 1.2;
        const hitbox = new THREE.Mesh(new THREE.BoxGeometry(hW, hH, hD), new THREE.MeshBasicMaterial({ visible: false }));
        hitbox.position.y = hH / 2;
        hitbox.userData = { root: wrapper };
        wrapper.add(hitbox);
        wrapper.userData.hitbox = hitbox;
        interactionMeshes.push(hitbox);

        // EXAKTE SELEKTION: Passgenauer, mitrotierender blauer Rahmen
        const edges = new THREE.EdgesGeometry(hitbox.geometry);
        const selLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x3b82f6, linewidth: 2, depthTest: false }));
        selLines.visible = false;
        hitbox.add(selLines);
        wrapper.userData.selectionLines = selLines;
    }

    const yPos = info.yOffset !== undefined ? info.yOffset : FURNITURE_Y_OFFSET;
    wrapper.position.set(x, yPos, z); 
    wrapper.rotation.y = rotY; 
    wrapper.updateMatrixWorld(true);
    
    scene.add(wrapper); 
    movableObjects.push(wrapper); 
    
    updateSeatCount(); 
    updateObjectList();
    
    if (window.app.applyHighContrast3D) {
        const highContrastToggle = document.getElementById('set-high-contrast');
        if (highContrastToggle && highContrastToggle.checked) window.app.applyHighContrast3D(true);
    }
}

// === EVENTS ===
function onMouseDown(event) {
  if (isFirstPersonActive()) return;
  if (event.button !== 0) return; 
  
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  // === ZONIERUNGSMODUS LOCK ===
  if (isZoneEditMode && editingZone) {
      const handleIntersects = raycaster.intersectObjects(editingZone.userData.handles, false);
      if (handleIntersects.length > 0) {
          selectedHandle = handleIntersects[0].object;
          isDragging = true;
          raycaster.ray.intersectPlane(dragPlane, dragOffset);
          return;
      }
      
      const meshIntersects = raycaster.intersectObject(editingZone.userData.visualMesh, false);
      if (meshIntersects.length > 0) {
          isDragging = true;
          selectedObjects = [editingZone];
          raycaster.ray.intersectPlane(dragPlane, dragOffset);
          return;
      }
      app.toggleZoneEdit(null);
  }

  // === NORMALER MODUS & PLAY MODUS ===
  const intersects = raycaster.intersectObjects(interactionMeshes, false);
  
  // Alle anderen offene Info-Bubbles schließen, wenn man klickt
  const clickedRoot = intersects.length > 0 ? intersects[0].object.userData.root : null;
  movableObjects.forEach(o => {
      if (o !== clickedRoot) o.userData.showInfoBubble = false;
  });
  if (window.app.updateNameTags) window.app.updateNameTags();

  if (intersects.length > 0) {
    const root = intersects[0].object.userData.root;
    
    // Spiellogik: Fehlersuche & Info-Hotspots abfangen
    if (window.app.currentMode === 'play') {
        
        // Neues Tooltip-Verhalten (Kein Screen-Modal mehr)
        if (root.userData.infoText) {
            root.userData.showInfoBubble = !root.userData.showInfoBubble;
            if (window.app.updateNameTags) window.app.updateNameTags();
            return; // Klick abgefangen, kein Dragging!
        }
        
        if (root.userData.isError) {
            if (!root.userData.errorFound) {
                root.userData.errorFound = true;
                root.traverse(child => {
                    if(child.isMesh && child.material) {
                        child.material = child.material.clone();
                        child.material.emissive = new THREE.Color(0xef4444);
                        child.material.emissiveIntensity = 0.6;
                    }
                });
                
                if (window.app.updateHUDTasks) window.app.updateHUDTasks();
                const total = movableObjects.filter(o => o.userData.isError).length;
                const found = movableObjects.filter(o => o.userData.isError && o.userData.errorFound).length;
                showNotification(`Fehler gefunden! (${found}/${total})`);
            }
            return; // Klick abgefangen, kein Dragging
        }

        if (root.userData.isLocked) {
            showNotification("Gesperrt: Dieses Objekt darf in der Aufgabe nicht bewegt werden.");
            return; 
        }
    }

    if (isVisionAnalysisMode && !root.userData.isAvatar) return; 

    if(!selectedObjects.includes(root)) { 
        deselectObject(); selectedObjects = [root]; selectObject(root); 
    }
    
    // Falls wir ein reguläres Objekt greifen (im Editor oder erlaube Werkzeuge im Spiel), Bubbles aus!
    movableObjects.forEach(o => o.userData.showInfoBubble = false);
    if (window.app.updateNameTags) window.app.updateNameTags();

    saveHistory(); 
    isDragging = true; 
    controls.enabled = false; 

    const planeIntersect = new THREE.Vector3(); 
    raycaster.ray.intersectPlane(dragPlane, planeIntersect);
    dragOffset.copy(planeIntersect); 
    selectedRoot = root; 
  } else { 
      if (!isVisionAnalysisMode) deselectObject(); 
  }
}

function onMouseMove(event) {
  if (isFirstPersonActive()) { document.body.style.cursor = "default"; return; }
  
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // 1. Zonen-Ecke verformen
  if (isDragging && selectedHandle) {
      raycaster.setFromCamera(mouse, camera); 
      const planeIntersect = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
          const root = selectedHandle.userData.root;
          const localPos = root.worldToLocal(planeIntersect.clone());
          
          const idx = selectedHandle.userData.index;
          root.userData.points[idx].set(localPos.x, -localPos.z);
          window.app.updateZoneGeometry(root);
          if(selectionBox && selectedObjects.length === 1 && !isZoneEditMode) selectionBox.update();
      }
      return;
  }

  // 2. Ganze Objekte (oder ganze Zone) verschieben
  if (isDragging && selectedObjects.length > 0) {
      raycaster.setFromCamera(mouse, camera); 
      const planeIntersect = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
        const delta = new THREE.Vector3().copy(planeIntersect).sub(dragOffset);
        
        selectedObjects.forEach(obj => {
            let newX = obj.position.x + delta.x; 
            let newZ = obj.position.z + delta.z;
            
            const isWall = obj.userData.isWallItem;
            const padding = isWall ? 0.05 : 0.5;

            // Keine Begrenzung für Zonen, damit man sie freier schieben kann
            if (!obj.userData.isZone) {
                const limitX = currentRoomLimits.x - padding;
                const limitZ = currentRoomLimits.z - padding;
                newX = Math.max(-limitX, Math.min(limitX, newX));
                newZ = Math.max(-limitZ, Math.min(limitZ, newZ));
            }
            
            obj.position.set(newX, obj.position.y, newZ);
        });
        
        dragOffset.copy(planeIntersect); 
        if(selectedObjects.length === 1 && selectionBox.visible) selectionBox.update(); 
      }
      return;
  }

  raycastThrottle++;
  if (raycastThrottle % 5 !== 0) return;
  raycaster.setFromCamera(mouse, camera);
  
  // Hover Cursor (Hand-Symbol)
  let intersects = [];
  if (isZoneEditMode && editingZone) {
      intersects = raycaster.intersectObjects([...editingZone.userData.handles, editingZone.userData.visualMesh], false);
  } else {
      intersects = raycaster.intersectObjects(interactionMeshes, false);
  }
  
  let canGrab = false;
  if (intersects.length > 0) {
      const root = intersects[0].object.userData ? intersects[0].object.userData.root : null;
      if (window.app.currentMode === 'play' && root && root.userData.isLocked) {
          canGrab = false; 
      } else {
          canGrab = true;
      }
  }
  document.body.style.cursor = canGrab ? "grab" : "default";
}

function onMouseUp() { 
    if(isDragging) { 
        isDragging = false; 
        
        // Kamera-Controls nur wiederbeleben, wenn wir NICHT im Zonierungsmodus sind
        if (!isVisionAnalysisMode && !isFirstPersonActive() && !isZoneEditMode) {
            controls.enabled = true; 
        } 
        
        if(!isZoneEditMode && selectedObjects.length === 1 && !selectedObjects[0].userData.isAvatar) { 
            document.getElementById('selection-details').style.display = 'block'; 
            document.getElementById('obj-annotation').value = selectedObjects[0].userData.annotation || ""; 
        }
    } 
    selectedHandle = null;
    if (isZoneEditMode) selectedObjects = []; // Sauber machen nach Zonen-Drag
    Object.keys(inputState).forEach(k => inputState[k] = false);
}

// === GLOBALER OUTSIDE-CLICK HANDLER (Zonierung beenden bei UI-Klick) ===
document.addEventListener('mousedown', (e) => {
    if (isZoneEditMode && editingZone) {
        // Ignoriere Klicks im 3D-Canvas (wird bereits von der onMouseDown behandelt)
        if (e.target.tagName.toLowerCase() === 'canvas') return;
        
        // Wenn der Klick NICHT im Zonen-Panel stattfindet -> Modus beenden
        if (!e.target.closest('#panel-zones')) {
            app.toggleZoneEdit(null);
        }
    }
});

function selectObject(obj) { 
    selectedRoot = obj; 
    
    if (obj.userData.selectionLines) obj.userData.selectionLines.visible = true;
    
    document.getElementById('selection-details').style.display = 'block'; 
    document.getElementById('obj-annotation').value = obj.userData.annotation || "";
    
    const ctxMenu = document.getElementById("context-menu");
    ctxMenu.classList.add("visible");
    const delBtn = document.getElementById('ctx-btn-delete');
    const lockBtn = document.getElementById('ctx-btn-lock');
    
    // UI Update für den Sperren-Button
    if(lockBtn) {
        lockBtn.style.display = window.app.currentMode === 'editor' ? 'block' : 'none';
        lockBtn.innerText = obj.userData.isLocked ? "Entsperren" : "Sperren";
        lockBtn.style.color = obj.userData.isLocked ? "#f59e0b" : ""; 
    }

    if(delBtn) {
        if(obj.userData.isAvatar) {
            delBtn.style.display = 'none';
        } else if (window.app.currentMode === 'play' && obj.userData.isPreplaced) {
            delBtn.style.display = 'none'; 
        } else {
            delBtn.style.display = 'block';
        }
    }

    const zoneTools = document.getElementById("ctx-zone-tools");
    if(zoneTools) {
        if(obj.userData.isZone) {
            zoneTools.style.display = 'flex';
            if (obj.userData.handles) obj.userData.handles.forEach(h => h.material.color.setHex(0xffff00));
        } else {
            zoneTools.style.display = 'none';
        }
    }

    updateObjectList();
}

function deselectObject() { 
    if (selectedRoot && selectedRoot.userData.isZone) {
        if (selectedRoot.userData.handles) selectedRoot.userData.handles.forEach(h => h.material.color.setHex(0xffffff));
    }
    
    if (selectedRoot && selectedRoot.userData.selectionLines) selectedRoot.userData.selectionLines.visible = false;
    
    selectedRoot = null; selectedObjects = [];  
    document.getElementById("context-menu").classList.remove("visible"); 
    document.getElementById('selection-details').style.display = 'none'; 
    document.querySelectorAll('.object-list-item').forEach(el => el.classList.remove('selected')); 
}

// NEU: Toggle Lock Funktion
window.app.toggleLock = function() {
    if (!selectedObjects || selectedObjects.length === 0) return;
    saveHistory();
    selectedObjects.forEach(obj => {
        obj.userData.isLocked = !obj.userData.isLocked;
    });
    selectObject(selectedObjects[0]); // UI aktualisieren
    showNotification(selectedObjects[0].userData.isLocked ? "Objekt für Play-Modus gesperrt." : "Objekt entsperrt.");
};

function smoothCameraMove(targetPos, targetLookAt) {
  if(settings.reducedMotion) { camera.position.copy(targetPos); controls.target.copy(targetLookAt); controls.update(); return; }
  const startPos = camera.position.clone(); const startLook = controls.target.clone(); const duration = 800; const startTime = performance.now();
  function loop(time) { const t = Math.min((time - startTime) / duration, 1); const ease = t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t; 
    camera.position.lerpVectors(startPos, targetPos, ease); controls.target.lerpVectors(startLook, targetLookAt, ease); controls.update();
    if (t < 1) requestAnimationFrame(loop);
  } requestAnimationFrame(loop);
}

window.app.setCamera = function(mode) {
  if (isFirstPersonActive() || isVisionAnalysisMode) {
      app.exitSimulationMode();
  }
  if (mode === 'top') {
      smoothCameraMove(new THREE.Vector3(0, 16, 0.1), new THREE.Vector3(0, 0, 0));
  } 
  controls.enabled = true;
};

function onWindowResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }

function onKeyDown(event) { 
    if (event.key === "Escape") app.exitSimulationMode(); 
    
    // --- NEU: FPS Toggle (Shift + F) ---
    if (event.shiftKey && (event.key === "F" || event.key === "f")) {
        settings.showFPS = !settings.showFPS;
        console.log("-> [Shift+F] gedrückt! FPS-Anzeige ist jetzt:", settings.showFPS); 
        
        const container = document.getElementById('fps-container');
        if (container) {
            container.style.setProperty('display', settings.showFPS ? 'block' : 'none', 'important');
            
            // Backup: Falls das interne Element sich weigert
            if (window.app.stats && window.app.stats.dom) {
                window.app.stats.dom.style.setProperty('display', 'block', 'important');
                window.app.stats.dom.style.setProperty('opacity', '1', 'important');
            }
        }
        
        // UI Checkboxen im Menü synchronisieren
        const fpsApp = document.getElementById('set-performance');
        const fpsHome = document.getElementById('start-performance');
        if (fpsApp) fpsApp.checked = settings.showFPS;
        if (fpsHome) fpsHome.checked = settings.showFPS;
    }
    // -----------------------------------

    const canInteract = !isFirstPersonActive(); 
    if (selectedObjects.length > 0 && canInteract) { 
        const key = event.key.toLowerCase(); 
        if (key === "r") { 
            saveHistory(); 
            selectedObjects.forEach(o => o.rotation.y += Math.PI/4); 
            if(selectedObjects.length===1) selectionBox.update(); 
        } 
        if (key === "delete" || key === "backspace") window.app.deleteSelection(); 
    } 
    
    if(settings.controlsEnabled && !isFirstPersonActive() && !isVisionAnalysisMode) { 
        switch(event.key) { case "ArrowUp": inputState.fwd = true; break; case "ArrowDown": inputState.bwd = true; break; case "ArrowLeft": inputState.left = true; break; case "ArrowRight": inputState.right = true; break; case "+": case "=": inputState.zoomIn = true; break; case "-": inputState.zoomOut = true; break; } 
    } 
}

function onKeyUp(event) { 
    if(settings.controlsEnabled) { 
        switch(event.key) { case "ArrowUp": inputState.fwd = false; break; case "ArrowDown": inputState.bwd = false; break; case "ArrowLeft": inputState.left = false; break; case "ArrowRight": inputState.right = false; break; case "+": case "=": inputState.zoomIn = false; break; case "-": inputState.zoomOut = false; break; } 
    } 
}


// === NEUE EDITOR OBJEKTLISTE & MODI LOGIK ===

window.app.toggleEditorModes = function() {
    const infoMode = document.getElementById('toggle-info-mode').checked;
    const errorMode = document.getElementById('toggle-error-mode').checked;
    
    let stateChanged = false;

    // Wenn Schalter deaktiviert werden, löschen wir die betroffenen Daten sofort von allen Objekten!
    if (!infoMode) {
        movableObjects.forEach(obj => {
            if (obj.userData.infoText) {
                obj.userData.infoText = "";
                stateChanged = true;
            }
        });
    }

    if (!errorMode) {
        movableObjects.forEach(obj => {
            if (obj.userData.isError) {
                obj.userData.isError = false;
                stateChanged = true;
            }
        });
    }

    // Wenn etwas gelöscht wurde, Historie sichern und Tags updaten
    if (stateChanged) {
        saveHistory();
        if (window.app.updateNameTags) window.app.updateNameTags();
    }
    
    const editorList = document.getElementById('editor-object-list');
    
    if (infoMode || errorMode) {
        editorList.style.display = 'flex';
        app.updateEditorObjectList();
    } else {
        editorList.style.display = 'none';
    }
};

window.app.updateEditorObjectList = function() {
    const container = document.getElementById('editor-object-list');
    if (!container || container.style.display === 'none') return;
    
    container.innerHTML = "";
    
    const infoMode = document.getElementById('toggle-info-mode').checked;
    const errorMode = document.getElementById('toggle-error-mode').checked;

    if (movableObjects.length === 0) {
        container.innerHTML = "<small style='color:#888;'>Setzen Sie zuerst Möbel in den Raum.</small>";
        return;
    }

    movableObjects.forEach((obj, idx) => {
        if (obj.userData.isAvatar || obj.userData.isZone) return;
        
        const name = ASSETS.furniture[obj.userData.typeId]?.name || "Möbelstück";
        const hasInfo = !!obj.userData.infoText;
        const isError = !!obj.userData.isError;
        
        let html = `
            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 10px;">
                <div style="font-size: 12px; color: white; font-weight: bold; margin-bottom: 8px;">${name}</div>
                <div style="display:flex; flex-direction:column; gap:6px;">
        `;
        
        if (infoMode) {
            // XSS-SCHUTZ: Info-Text escapen!
            const safeInfoText = window.app.escapeHTML(obj.userData.infoText || '');
            
            const opacity = isError ? "0.4" : "1";
            const disabled = isError ? "disabled" : "";
            html += `
                <div style="display:flex; gap:6px; align-items:center; opacity: ${opacity};">
                    <input type="text" placeholder="${isError ? 'Deaktiviert (Möbel ist Fehler)' : 'Info-Text (für Lernkarten)'}" value="${safeInfoText}" 
                           onchange="app.setObjectInfo('${obj.uuid}', this.value)" ${disabled}
                           style="flex-grow:1; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:white; padding:6px 8px; border-radius:4px; font-size:11px;">
                </div>
            `;
        }
        
        if (errorMode) {
            const opacity = hasInfo ? "0.4" : "1";
            const disabled = hasInfo ? "disabled" : "";
            const btnColor = isError ? "background: #ef4444; border-color: #ef4444; color: white;" : "background: transparent; border-color: rgba(255,255,255,0.2); color: #9ca3af;";
            html += `
                <button style="padding: 6px 8px; font-size: 11px; width: 100%; ${btnColor} opacity: ${opacity}; transition: all 0.2s;" 
                        onclick="app.setObjectError('${obj.uuid}', ${!isError})" ${disabled}>
                    ${hasInfo ? 'Deaktiviert (Möbel hat Info)' : (isError ? '🚨 Als Fehler markiert' : 'Als Fehler markieren')}
                </button>
            `;
        }
        
        html += `</div></div>`;
        container.innerHTML += html;
    });
};

window.app.setObjectInfo = function(uuid, text) {
    const obj = movableObjects.find(o => o.uuid === uuid);
    if (obj) {
        obj.userData.infoText = text.trim();
        // EXKLUSIVITÄT: Hat es Text, ist es kein Fehler mehr!
        if (obj.userData.infoText !== "") obj.userData.isError = false; 
        saveHistory();
        app.updateEditorObjectList();
        showNotification("Info-Text gespeichert.");
    }
};

window.app.setObjectError = function(uuid, isError) {
    const obj = movableObjects.find(o => o.uuid === uuid);
    if (obj) {
        obj.userData.isError = isError;
        // EXKLUSIVITÄT: Ist es ein Fehler, verliert es seinen Text!
        if (isError) obj.userData.infoText = ""; 
        saveHistory();
        app.updateEditorObjectList();
    }
};

// Modifizierung der bestehenden Nametag-Funktion, um auch "i"-Icons für Hotspots zu rendern
window.app.updateNameTags = function() {
    // Info Hotspots im Playmodus rendern (inklusive Sprechblasen)
    if (window.app.currentMode === 'play') {
        if (!window.app.infoTagsInit) {
            window.app.infoTags = [];
            document.querySelectorAll('.info-hotspot-tag').forEach(el => el.remove());
            
            movableObjects.forEach(obj => {
                if (obj.userData.infoText) {
                    const tag = document.createElement('div');
                    tag.className = 'info-hotspot-tag';
                    tag.style.position = 'absolute';
                    tag.style.pointerEvents = 'none'; // Klicks gehen durch den Canvas aufs 3D Objekt!
                    tag.style.transform = 'translate(-50%, -50%)';
                    tag.style.zIndex = '1000';
                    tag.style.display = 'flex';
                    tag.style.flexDirection = 'column';
                    tag.style.alignItems = 'center';
                    
                    document.body.appendChild(tag);
                    window.app.infoTags.push({ mesh: obj, element: tag });
                    
                    obj.traverse(child => {
                        if(child.isMesh && child.material) {
                            child.material = child.material.clone();
                            child.material.emissive = new THREE.Color(0x3b82f6);
                            child.material.emissiveIntensity = 0.4;
                        }
                    });
                }
            });
            window.app.infoTagsInit = true;
        }
        
        // Tags positionieren und HTML der Sprechblase live steuern
        window.app.infoTags.forEach(tagObj => {
            const pos = tagObj.mesh.position.clone();
            pos.y += (ASSETS.furniture[tagObj.mesh.userData.typeId]?.dims?.y || 1) + 0.3; 
            pos.project(camera);

            if (pos.z > 1 || pos.x < -1 || pos.x > 1 || pos.y < -1 || pos.y > 1) {
                tagObj.element.style.opacity = '0';
                return;
            }

            const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (pos.y * -0.5 + 0.5) * window.innerHeight;

            tagObj.element.style.opacity = '1';
            tagObj.element.style.left = `${x}px`;
            tagObj.element.style.top = `${y}px`;
            
            // HTML Update (Sprechblase aufklappen wenn aktiviert - MIT WORD-WRAP FIX)
            const showBubble = tagObj.mesh.userData.showInfoBubble ? 'block' : 'none';
            
            // XSS-SCHUTZ: Info-Text in der Sprechblase escapen!
            const safeInfoText = window.app.escapeHTML(tagObj.mesh.userData.infoText || '');

            tagObj.element.innerHTML = `
                <div style="background: rgba(59, 130, 246, 0.9); color: white; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 15px; font-weight: 900; box-shadow: 0 4px 10px rgba(59,130,246,0.5); border: 2px solid white; cursor: pointer; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">i</div>
                <div style="display: ${showBubble}; position: absolute; bottom: 42px; left: 50%; transform: translateX(-50%); background: rgba(15, 16, 18, 0.95); border: 1px solid rgba(59, 130, 246, 0.6); padding: 14px; border-radius: 10px; color: #f3f4f6; width: max-content; max-width: 250px; font-size: 13px; line-height: 1.5; box-shadow: 0 15px 30px rgba(0,0,0,0.6); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); text-align: left; pointer-events: none; white-space: normal; word-wrap: break-word; overflow-wrap: break-word;">
                    ${safeInfoText}
                    <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 12px; height: 12px; background: rgba(15, 16, 18, 0.95); border-right: 1px solid rgba(59, 130, 246, 0.6); border-bottom: 1px solid rgba(59, 130, 246, 0.6);"></div>
                </div>
            `;
        });
    } else {
        document.querySelectorAll('.info-hotspot-tag').forEach(el => el.remove());
        window.app.infoTagsInit = false;
        window.app.infoTags = [];
    }

    if (!window.app.activeNameTags || window.app.activeNameTags.length === 0) return;
    
    window.app.activeNameTags.forEach(tagObj => {
        const pos = tagObj.mesh.position.clone();
        if (tagObj.isZone) { pos.y += 0.8; } else { pos.y += 1.8; }
        pos.project(camera);

        if (pos.z > 1 || pos.x < -1 || pos.x > 1 || pos.y < -1 || pos.y > 1) {
            tagObj.element.style.opacity = '0';
            return;
        }

        const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (pos.y * -0.5 + 0.5) * window.innerHeight;

        tagObj.element.style.opacity = '1';
        tagObj.element.style.display = 'block';
        tagObj.element.style.left = `${x}px`;
        tagObj.element.style.top = `${y}px`;
    });
};

// === SZENARIO LOGIK (Gamification) ===
// openScenarioDashboard() wurde nach js/modules/ui.js ausgelagert

window.app.loadScenario = async function(id) {
    const s = SCENARIOS[id];
    if(!s) return;
    
    currentScenarioId = id;
    isScenarioMode = true;
    
    document.getElementById('scenario-dashboard-overlay').style.display = 'none';
    
    // Raum laden & Leeren
    toggleLoader(true, "Lade Szenario...");
    if (currentRoomFile !== s.setupRoom) {
        await app.switchRoom(s.setupRoom);
    }
    app.clearRoom(false);
    
    // Möbel Spawnen
    for (let item of s.setup) {
        if (!ASSETS.furniture[item.type].data && !ASSETS.furniture[item.type].procedural) {
            await getOrLoadFurniture(item.type);
        }
        createFurnitureInstance(item.type, item.x, item.z, item.rot);
    }
    
    // Standard-UI komplett ausblenden, Szenario-UI einblenden
    document.getElementById('ui-layer').style.display = 'none'; // Verstecke normalen Planer
    const hud = document.getElementById('scenario-ui-layer');
    hud.style.display = 'block';
    
    // HUD befüllen
    document.getElementById('scenario-hud-title').innerText = s.title;
    document.getElementById('scenario-hud-desc').innerHTML = s.desc;
    
    // Tools befüllen
    const toolGrid = document.getElementById('scenario-hud-tools');
    toolGrid.innerHTML = '';
    if (s.tools.length === 0) {
        toolGrid.innerHTML = '<span style="font-size: 11px; color: #6b7280;">Keine speziellen Möbel für diese Aufgabe verfügbar.</span>';
    } else {
        s.tools.forEach(tool => {
            if (tool === 'btn-spawn-avatar') {
                toolGrid.innerHTML += `<button onclick="app.addFurniture('avatar_procedural')" style="background: rgba(59, 130, 246, 0.2); border-color: #3b82f6; color: #60a5fa;">Avatar setzen</button>`;
            } else {
                const name = ASSETS.furniture[tool].name;
                toolGrid.innerHTML += `<button onclick="app.addFurniture('${tool}')">+ ${name}</button>`;
            }
        });
    }

    toggleLoader(false);
    app.setCamera('top');

    // NEU: HUD init und Briefing Popup aufrufen
    if (window.app.initPlayModeHUD) window.app.initPlayModeHUD();
};

window.app.exitScenario = function() {
    isScenarioMode = false;
    currentScenarioId = null;
    app.exitSimulationMode();
    document.getElementById('scenario-ui-layer').style.display = 'none';
    app.clearRoom(false);
    app.openScenarioDashboard();
};

// === PHASE 3: THE VALIDATION ENGINE ===

window.app.currentMCIndex = 0;

window.app.isPointInPolygon = function(point, polygonPoints) {
    let isInside = false;
    for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
        let xi = polygonPoints[i].x, yi = polygonPoints[i].y;
        let xj = polygonPoints[j].x, yj = polygonPoints[j].y;
        
        let intersect = ((yi > point.y) != (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
};

window.app.validateScenario = function() {
    if (!app.scenarioData || !app.scenarioData.tasks) return { success: true, results: [] };
    
    let allPassed = true;
    let results = [];
    const activeTasks = app.scenarioData.tasks.filter(t => t.type !== 'mc');
    
    // Check Errors if Error Mode is active
    let hasErrorTasks = false;
    let allErrorsFound = true;
    const errorObjects = movableObjects.filter(o => o.userData.isError);
    if (errorObjects.length > 0) {
        hasErrorTasks = true;
        const foundErrors = errorObjects.filter(o => o.userData.errorFound);
        if (foundErrors.length < errorObjects.length) allErrorsFound = false;
    }

    if (activeTasks.length === 0 && !hasErrorTasks) return { success: true, results: [] };

    activeTasks.forEach((task, index) => {
        let passed = false;
        let detailMsg = "";

        if (task.type === 'dist') {
            let targetObj = null;
            if (task.target === 'door_area') {
                targetObj = { position: new THREE.Vector3(4, 0, 4), isDoor: true };
            } else {
                targetObj = movableObjects.find(o => o.userData.typeId === task.target);
            }
            
            if (!targetObj) {
                passed = false;
                detailMsg = "Zielobjekt befindet sich nicht im Raum.";
            } else {
                let minDist = Infinity;
                movableObjects.forEach(obj => {
                    if (obj === targetObj || obj.userData.isZone || obj.userData.isAvatar) return;
                    const dist = obj.position.distanceTo(targetObj.position);
                    const r1 = targetObj.isDoor ? 0.5 : (ASSETS.furniture[targetObj.userData.typeId]?.radius || 0.5);
                    const r2 = ASSETS.furniture[obj.userData.typeId]?.radius || 0.5;
                    const gap = dist - (r1 + r2);
                    if (gap < minDist) minDist = gap;
                });
                let gapCm = minDist === Infinity ? 200 : Math.round(minDist * 100);
                passed = gapCm >= task.minDistance;
                detailMsg = passed ? `Abstand ausreichend (${gapCm}cm)` : `Weg blockiert! (Nur ${gapCm}cm Platz, min. ${task.minDistance}cm gefordert)`;
            }
        }
        else if (task.type === 'persona') {
            const personaObj = movableObjects.find(o => o.userData.typeId === task.persona);
            if (!personaObj) {
                passed = false;
                detailMsg = "Die geforderte Persona wurde noch nicht platziert!";
            } else {
                const pName = ASSETS.furniture[personaObj.userData.typeId].name;
                
                if (task.condition === 'in_zone') {
                    const zone = movableObjects.find(o => o.userData.isZone && (o.uuid === task.targetZoneId || o.userData.exportId === task.targetZoneId));
                    if (!zone) {
                        passed = false;
                        detailMsg = "Fehler: Die geforderte Zone wurde gelöscht oder existiert nicht mehr.";
                    } else {
                        const localPt = zone.worldToLocal(personaObj.position.clone());
                        const pt = { x: localPt.x, y: -localPt.z };
                        const inZone = window.app.isPointInPolygon(pt, zone.userData.points);
                        passed = inZone;
                        detailMsg = inZone ? `${pName} steht korrekt in der markierten Zone.` : `${pName} steht außerhalb der zugewiesenen Zone.`;
                    }
                } else if (task.condition === 'near_board') {
                    const board = movableObjects.find(o => o.userData.typeId === 'board');
                    if (!board) {
                        passed = false;
                        detailMsg = "Es gibt keine Tafel im Raum zur Überprüfung.";
                    } else {
                        const dist = personaObj.position.distanceTo(board.position);
                        passed = dist <= 2.5;
                        detailMsg = passed ? `${pName}: Abstand zur Tafel ist optimal (${(dist).toFixed(1)}m).` : `${pName} sitzt zu weit weg! (${(dist).toFixed(1)}m Abstand, max. 2.5m erlaubt).`;
                    }
                } else if (task.condition === 'clear_path') {
                    let minDist = Infinity;
                    movableObjects.forEach(obj => {
                        if (obj === personaObj || obj.userData.isZone || obj.userData.isAvatar || !obj.userData.typeId) return;
                        const dist = obj.position.distanceTo(personaObj.position);
                        const r1 = 0.4; 
                        const r2 = ASSETS.furniture[obj.userData.typeId]?.radius || 0.5; 
                        const gap = dist - (r1 + r2);
                        if (gap < minDist) minDist = gap;
                    });
                    let gapCm = minDist === Infinity ? 200 : Math.round(minDist * 100);
                    passed = gapCm >= 90; 
                    detailMsg = passed ? `Weg für ${pName} ist breit genug (${gapCm}cm Platz).` : `Weg für ${pName} ist blockiert! (Nur ${gapCm}cm Platz).`;
                }
            }
        }
        else if (task.type === 'capacity') {
            let currentSeats = 0;
            movableObjects.forEach(obj => {
                if (obj.userData.typeId) currentSeats += (ASSETS.furniture[obj.userData.typeId].seats || 0);
            });
            passed = currentSeats >= task.minSeats;
            detailMsg = passed ? `Ziel erreicht (${currentSeats}/${task.minSeats} Plätze).` : `Zu wenige Plätze (${currentSeats} von ${task.minSeats} benötigt).`;
        }
        else if (task.type === 'inclusive') {
            const stats = getAccessibilityStats();
            let currentSeats = 0;
            movableObjects.forEach(obj => {
                if (obj.userData.typeId) currentSeats += (ASSETS.furniture[obj.userData.typeId].seats || 0);
            });
            const seatsPassed = currentSeats >= task.minSeats;
            const spacePassed = stats.minCm >= 90;
            const acousticPassed = stats.acousticScore > stats.targets.warn;

            passed = seatsPassed && spacePassed && acousticPassed;
            detailMsg = "";
            if (!seatsPassed) detailMsg += `Zu wenige Plätze (${currentSeats}/${task.minSeats}). `;
            if (!spacePassed) detailMsg += `Wege zu eng (${stats.minCm}cm). `;
            if (!acousticPassed) detailMsg += `Akustik zu schlecht. `;
            if (passed) detailMsg = "Raum ist rollstuhlgerecht, akustisch gedämpft und bietet genug Platz.";
        }
        else if (task.type === 'acoustic_budget') {
            let currentAcoustic = 0;
            movableObjects.forEach(obj => {
                if (obj.userData.typeId && ASSETS.furniture[obj.userData.typeId].acousticBonus) {
                    currentAcoustic += ASSETS.furniture[obj.userData.typeId].acousticBonus;
                }
            });
            passed = currentAcoustic >= task.targetScore;
            detailMsg = passed ? `Ziel erreicht (${currentAcoustic}/${task.targetScore} Punkte).` : `Zu wenig Absorber platziert (${currentAcoustic} von ${task.targetScore} Punkten erreicht).`;
        }

        if (!passed) allPassed = false;
        results.push({ task: task, passed: passed, msg: detailMsg, index: index + 1 });
    });

    if (hasErrorTasks && !allErrorsFound) {
        allPassed = false;
        const foundCount = errorObjects.filter(o => o.userData.errorFound).length;
        results.push({
            task: { type: 'error_hunt', desc: "Fehlersuche" },
            passed: false,
            msg: `Sie haben erst ${foundCount} von ${errorObjects.length} Barrieren im Raum entdeckt. Klicken Sie die Störfaktoren an!`
        });
    }

    return { success: allPassed, results: results };
};

window.app.checkScenarioTask = function() {
    const validation = window.app.validateScenario();
    
    let resultHtml = `<div style="display:flex; flex-direction:column; gap:15px; margin-bottom: 20px;">`;
    const spatialTasks = app.scenarioData.tasks.filter(t => t.type !== 'mc');
    const hasErrors = movableObjects.some(o => o.userData.isError);
    
    if (validation.results.length === 0 && spatialTasks.length > 0 && !hasErrors) {
        resultHtml += `<p style="color:#d1d5db;">Es gibt keine räumlichen Überprüfungen.</p>`;
    } else {
        validation.results.forEach(res => {
            const passed = res.passed;
            const task = res.task;
            
            // --- NEU: Persona Chat Bubbles ---
            let avatarColor = passed ? '#10b981' : '#ef4444';
            let avatarIcon = passed ? '😊' : '😟';
            let senderName = "System-Analyse";
            let message = res.msg;

            if (task.type === 'persona') {
                const pName = ASSETS.furniture[task.persona]?.name || "Lernender";
                senderName = pName;
                if (task.condition === 'clear_path') {
                    message = passed ? "Super! Ich komme problemlos mit dem Rollstuhl durch. Danke!" : "Oh nein, der Weg ist blockiert. Wenn es brennt, stecke ich hier fest!";
                } else if (task.condition === 'near_board') {
                    message = passed ? "Perfekt, von hier aus kann ich das Mundbild der Lehrkraft super erkennen." : "Ich sitze viel zu weit weg. So kann ich dem Unterricht absolut nicht folgen!";
                } else if (task.condition === 'in_zone') {
                    message = passed ? "Danke! Hier an diesem Platz fühle ich mich wohl und kann mich konzentrieren." : "Dieser Platz ist für meine Bedürfnisse leider nicht geeignet. Ich brauche meine Ruhezone.";
                }
            } else if (task.type === 'dist') {
                senderName = "Sicherheitsbeauftragter";
                avatarIcon = passed ? '✅' : '⚠️';
                message = passed ? "Fluchtwege sind vorschriftsmäßig frei. Gute Arbeit!" : "Achtung! Der Fluchtweg ist blockiert. Das ist ein massives Sicherheitsrisiko.";
            } else if (task.type === 'acoustic_budget') {
                senderName = "Akustiker";
                avatarIcon = passed ? '🔉' : '🔊';
                message = passed ? "Die Nachhallzeit ist optimal. Sehr angenehmes Klima!" : "Es hallt extrem in diesem Raum! Bitte platzieren Sie mehr Absorber oder Teppiche.";
            } else if (task.type === 'error_hunt') {
                senderName = "Beobachter";
                avatarIcon = '🔍';
                message = res.msg;
            }

            resultHtml += `
                <div style="display: flex; gap: 12px; align-items: flex-start;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: ${avatarColor}; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                        ${avatarIcon}
                    </div>
                    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 12px 16px; border-radius: 4px 12px 12px 12px; position: relative; width: 100%;">
                        <div style="font-weight: 800; font-size: 11px; color: ${avatarColor}; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">${senderName}</div>
                        <div style="font-size: 13px; color: #f3f4f6; line-height: 1.5;">${message}</div>
                        <div style="font-size: 10px; color: #6b7280; margin-top: 8px; font-style: italic; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 6px;">Aufgabe: ${task.desc}</div>
                    </div>
                </div>
            `;
        });
    }
    resultHtml += `</div>`;

    if (validation.success) {
        const mcTasks = app.scenarioData.tasks.filter(t => t.type === 'mc');
        if (mcTasks.length > 0 && window.app.currentMCIndex < mcTasks.length) {
            document.getElementById('modal-overlay').classList.remove('active');
            
            if (window.app.currentMCIndex === 0) {
                const titleText = spatialTasks.length > 0 ? "Räumliche Aufgaben gelöst! 🎉" : "Wissensabfrage starten";
                const descText = spatialTasks.length > 0 ? "Hervorragend! Sie haben die räumlichen Anforderungen erfüllt." : "Beginnen wir mit den Fragen zum Szenario.";
                const btnCode = `document.getElementById('modal-overlay').classList.remove('active'); app.showMCQuestion(app.scenarioData.tasks.filter(t => t.type === 'mc')[window.app.currentMCIndex]);`;
                
                showModal(titleText, `
                    <p style="color: white; margin-bottom: 20px;">${descText}</p>
                    <div style="background: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
                        <p style="margin: 0; color: #d1d5db; font-size: 13px;">Nun folgen noch kurze Wissensfragen zur Situation im Raum.</p>
                    </div>
                    <button class="primary" style="width: 100%; padding: 12px;" onclick="${btnCode}">Weiter zu den Fragen</button>
                `);
            } else {
                app.showMCQuestion(mcTasks[window.app.currentMCIndex]);
            }
        } else {
            showModal("Mission Erfolgreich! 🎉", `
                <p style="color: white; margin-bottom: 20px;">Hervorragend! Sie haben alle Anforderungen erfüllt und die Übung gemeistert.</p>
                ${(spatialTasks.length > 0 || hasErrors) ? resultHtml : ''}
                <button class="primary" style="width: 100%; padding: 12px;" onclick="app.quitPlayMode()">Übung beenden & Zurück</button>
            `);
            window.app.currentMCIndex = 0;
        }
    } else {
        showModal("Feedback zur Lösung", `
            <p style="color: #d1d5db; margin-bottom: 20px;">Noch sind nicht alle Anforderungen erfüllt. Hören Sie sich an, was die Beteiligten sagen:</p>
            ${resultHtml}
            <button class="primary" style="width: 100%; padding: 12px; background: transparent !important; border: 1px solid #f59e0b !important; color: white;" onclick="document.getElementById('modal-overlay').classList.remove('active')">Weiter versuchen</button>
        `);
    }
};

window.app.showMCQuestion = function(task) {
    const isMC = task.answers.filter(a => a.correct).length > 1;
    document.getElementById('mc-title').innerText = isMC ? "Multiple Choice Frage" : "Single Choice Frage";
    document.getElementById('mc-question').innerText = task.question + (isMC ? " (Mehrere Antworten möglich)" : " (Nur eine Antwort korrekt)");
    
    const answersDiv = document.getElementById('mc-answers');
    answersDiv.innerHTML = "";
    
    const shuffled = [...task.answers].sort(() => Math.random() - 0.5);
    
    shuffled.forEach((ans, idx) => {
        const row = document.createElement('label');
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.gap = "10px";
        row.style.background = "rgba(255,255,255,0.05)";
        row.style.padding = "12px";
        row.style.borderRadius = "8px";
        row.style.cursor = "pointer";
        row.style.marginBottom = "8px";
        row.style.border = "1px solid rgba(255,255,255,0.1)";

        const input = document.createElement('input');
        input.type = isMC ? "checkbox" : "radio";
        input.name = "mc-answer";
        input.value = idx;
        input.dataset.correct = ans.correct;
        input.style.width = "18px";
        input.style.height = "18px";
        input.style.cursor = "pointer";

        const span = document.createElement('span');
        span.innerText = ans.text;
        span.style.color = "white";
        span.style.fontSize = "14px";

        row.appendChild(input);
        row.appendChild(span);
        answersDiv.appendChild(row);
    });
    
    const confirmBtn = document.createElement('button');
    confirmBtn.className = "primary";
    confirmBtn.style.width = "100%";
    confirmBtn.style.padding = "12px";
    confirmBtn.style.marginTop = "10px";
    confirmBtn.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
    confirmBtn.style.borderColor = "#10b981";
    confirmBtn.innerText = "Antwort bestätigen";
    
    confirmBtn.onclick = () => {
        const inputs = answersDiv.querySelectorAll('input');
        let allCorrect = true;
        let anyChecked = false;
        
        inputs.forEach(inp => {
            const isChecked = inp.checked;
            const shouldBeChecked = inp.dataset.correct === "true";
            if (isChecked) anyChecked = true;
            if (isChecked !== shouldBeChecked) allCorrect = false;
        });
        
        if (!anyChecked) { 
            showNotification("Bitte wählen Sie eine Antwort aus."); 
            return; 
        }
        
        app.resolveMC(allCorrect);
    };
    
    answersDiv.appendChild(confirmBtn);
    document.getElementById('scenario-mc-modal').style.display = 'flex';
};

window.app.resolveMC = function(isCorrect) {
    document.getElementById('scenario-mc-modal').style.display = 'none';
    if (isCorrect) {
        window.app.currentMCIndex++;
        app.checkScenarioTask(); 
    } else {
        showModal("❌ Falsche Antwort", `
            <p style="color: #ef4444; font-weight: bold; font-size: 16px;">Das ist leider nicht die richtige Lösung.</p>
            <p>Überdenken Sie Ihre Antwort noch einmal.</p>
            <button class="primary" style="margin-top: 15px; width: 100%;" onclick="document.getElementById('modal-overlay').classList.remove('active'); document.getElementById('scenario-mc-modal').style.display='flex';">Nochmal versuchen</button>
        `);
    }
};

window.app.openTaskBuilder = function(taskType) {
    const type = taskType;
    if (!type) return; 
    let html = "";

    if (type === 'mc') {
        html = `
            <div class="input-group">
                <label>Fragestellung</label>
                <textarea id="build-mc-q" rows="2" placeholder="z.B. Wo sollte der Lernende sitzen?"></textarea>
            </div>
            <p style="font-size:11px; color:#9ca3af; margin-bottom:10px;">
                Füllen Sie 3 bis 6 Antworten aus und markieren Sie die Checkbox für korrekte Antworten. (1 Haken = Single Choice, mehrere = Multiple Choice)
            </p>
            <div id="mc-inputs-container" style="display:flex; flex-direction:column; gap:8px;">
        `;
        for (let i = 1; i <= 6; i++) {
            const req = i <= 3 ? " (erforderlich)" : " (optional)";
            html += `
                <div class="input-group" style="display:flex; gap:10px; align-items:center; margin-bottom:0;">
                    <input type="checkbox" id="build-mc-c${i}" ${i===1?'checked':''} style="width:auto; cursor:pointer;">
                    <input type="text" id="build-mc-a${i}" placeholder="Antwort ${i}${req}" style="flex-grow:1;">
                </div>
            `;
        }
        html += `
            </div>
            <button class="primary" style="width:100%; margin-top:15px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-color: #10b981;" onclick="app.saveTask('mc')">Aufgabe speichern</button>
        `;
        showModal("Wissensfrage (SC/MC) erstellen", html);

    } else if (type === 'dist') {
        html = `
            <p style="font-size:12px; color:#9ca3af; margin-bottom:15px;">Prüft per Autokorrektur, ob ein Objekt genug Freiraum hat.</p>
            <div class="input-group">
                <label>Zu prüfendes Objekt</label>
                <select id="build-dist-target">
                    <option value="" disabled selected hidden>Bitte auswählen...</option>
                    <option value="persona_mia">Mia (Rollstuhl)</option>
                    <option value="door_area">Türbereich (Hinten rechts)</option>
                </select>
            </div>
            <div class="input-group">
                <label>Mindestabstand (in cm)</label>
                <input type="number" id="build-dist-val" value="90" min="10" max="300">
            </div>
            <button class="primary" style="width:100%; margin-top:10px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-color: #10b981;" onclick="app.saveTask('dist')">Aufgabe speichern</button>
        `;
        showModal("Abstandsregel erstellen", html);

    } else if (type === 'persona') {
        const zones = movableObjects.filter(o => o.userData.isZone);
        let zoneOptions = zones.map(z => `<option value="${z.userData.exportId || z.uuid}">${z.userData.zoneName || 'Zone'}</option>`).join('');
        if(zones.length === 0) zoneOptions = `<option value="">Keine Zonen im Raum vorhanden!</option>`;

        html = `
            <div style="background: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6; padding: 10px; margin-bottom: 15px; border-radius: 4px;">
                <p style="font-size:12px; color:#d1d5db; margin:0;"><b>Erklärung:</b> Mit dieser Regel definieren Sie ein festes Ziel für den Spielende. Der Spielende muss die gewählte Persona im Raum so platzieren, dass die Bedingung erfüllt ist.</p>
            </div>
            <div class="input-group">
                <label>Persona wählen</label>
                <select id="build-pers-id">
                    <option value="" disabled selected hidden>Bitte auswählen...</option>
                    <option value="persona_mia">Mia (Rollstuhl)</option>
                    <option value="persona_ben">Ben (ADHS)</option>
                    <option value="persona_lukas">Lukas (Hörschädigung)</option>
                    <option value="persona_tim">Tim (Visus 30%)</option>
                    <option value="persona_emma">Emma (Regulär)</option>
                    <option value="persona_leon">Leon (Regulär)</option>
                </select>
            </div>
            <div class="input-group">
                <label>Pädagogische Bedingung</label>
                <select id="build-pers-cond" onchange="document.getElementById('zone-select-group').style.display = this.value === 'in_zone' ? 'block' : 'none'">
                    <option value="" disabled selected hidden>Bitte auswählen...</option>
                    <option value="in_zone">Muss in einer markierten Zone stehen (Geodaten)</option>
                    <option value="near_board">Muss nah an der Tafel sitzen (Max. 2,5 Meter)</option>
                    <option value="clear_path">Weg zur Tür muss breit genug sein (Rollstuhlgerecht)</option>
                </select>
            </div>
            <div class="input-group" id="zone-select-group" style="display:none;">
                <label>Ziel-Zone (Muss vorher gezeichnet werden!)</label>
                <select id="build-pers-zone">
                    <option value="" disabled selected hidden>Bitte auswählen...</option>
                    ${zoneOptions}
                </select>
            </div>
            <button class="primary" style="width:100%; margin-top:10px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-color: #10b981;" onclick="app.saveTask('persona')">Aufgabe speichern</button>
        `;
        showModal("Persona-Regel erstellen", html);
        
    } else if (type === 'capacity') {
        html = `
            <p style="font-size:12px; color:#9ca3af; margin-bottom:15px;">Prüft, ob der Raum eine Mindestanzahl an Sitzplätzen aufweist.</p>
            <div class="input-group">
                <label>Benötigte Sitzplätze</label>
                <input type="number" id="build-cap-val" value="20" min="1" max="100">
            </div>
            <button class="primary" style="width:100%; margin-top:10px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-color: #10b981;" onclick="app.saveTask('capacity')">Aufgabe speichern</button>
        `;
        showModal("Kapazitäts-Regel erstellen", html);
    } else if (type === 'inclusive') {
        html = `
            <p style="font-size:12px; color:#9ca3af; margin-bottom:15px;">Prüft automatisch auf Rollstuhlfreiheit (>90cm), ausreichende Akustik und Mindest-Sitzplätze.</p>
            <div class="input-group">
                <label>Mindestens benötigte Sitzplätze</label>
                <input type="number" id="build-inc-seats" value="20" min="1" max="100">
            </div>
            <button class="primary" style="width:100%; margin-top:10px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-color: #10b981;" onclick="app.saveTask('inclusive')">Aufgabe speichern</button>
        `;
        showModal("Inklusive Raumplanung", html);
    } else if (type === 'acoustic_budget') {
        html = `
            <p style="font-size:12px; color:#9ca3af; margin-bottom:15px;">Prüft, ob genug schallabsorbierende Elemente platziert wurden, um eine gute Akustik zu erreichen.</p>
            <div class="input-group">
                <label>Mindest-Punkte für Akustik-Score</label>
                <input type="number" id="build-ac-val" value="15" min="1" max="100">
                <small style="color:#6b7280; display:block; margin-top:4px;">(Ein Teppich bringt z.B. 5 Punkte, ein Absorber 3 Punkte).</small>
            </div>
            <button class="primary" style="width:100%; margin-top:10px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-color: #10b981;" onclick="app.saveTask('acoustic_budget')">Aufgabe speichern</button>
        `;
        showModal("Akustik-Ziel erstellen", html);
    }
};

window.app.saveTask = function(type) {
    let newTask = null;

    if (type === 'mc') {
        const q = document.getElementById('build-mc-q').value;
        let ans = [];
        for (let i = 1; i <= 6; i++) {
            const text = document.getElementById(`build-mc-a${i}`).value.trim();
            const correct = document.getElementById(`build-mc-c${i}`).checked;
            if (text) {
                ans.push({ text: text, correct: correct });
            }
        }
        
        if (!q || ans.length < 3) { showNotification("Bitte Frage und mindestens 3 Antworten ausfüllen!"); return; }
        if (!ans.some(a => a.correct)) { showNotification("Bitte mindestens eine richtige Antwort markieren!"); return; }
        
        newTask = { id: Date.now(), type: 'mc', question: q, answers: ans };
    } 
    else if (type === 'dist') {
        const target = document.getElementById('build-dist-target').value;
        if (!target) { showNotification("Bitte ein Zielobjekt auswählen!"); return; }
        const val = document.getElementById('build-dist-val').value;
        const targetName = target === 'persona_mia' ? "Mia (Rollstuhl)" : "Türbereich";
        
        newTask = { id: Date.now(), type: 'dist', target: target, minDistance: parseInt(val), desc: `Abstand zu ${targetName} muss >${val}cm sein.` };
    }
    else if (type === 'persona') {
        const pId = document.getElementById('build-pers-id').value;
        const cond = document.getElementById('build-pers-cond').value;
        if (!pId || !cond) { showNotification("Bitte Persona und Bedingung auswählen!"); return; }
        
        const pName = ASSETS.furniture[pId].name;
        
        let zoneId = null;
        let condText = "";

        if (cond === 'in_zone') {
            zoneId = document.getElementById('build-pers-zone').value;
            if (!zoneId) { showNotification("Bitte eine Ziel-Zone auswählen!"); return; }
            const zoneObj = movableObjects.find(o => o.uuid === zoneId || o.userData.exportId === zoneId);
            const zName = zoneObj ? (zoneObj.userData.zoneName || 'Zone') : 'Zone';
            condText = `muss in der Zone "${zName}" platziert werden`;
        } else if (cond === 'clear_path') {
            condText = "benötigt einen hindernisfreien Fluchtweg zur Tür (min. 90cm)";
        } else {
            condText = "muss nah an der Tafel sitzen";
        }
        
        newTask = { id: Date.now(), type: 'persona', persona: pId, condition: cond, targetZoneId: zoneId, desc: `${pName} ${condText}.` };
    }
    else if (type === 'capacity') {
        const val = parseInt(document.getElementById('build-cap-val').value);
        newTask = { id: Date.now(), type: 'capacity', minSeats: val, desc: `Richten Sie mindestens ${val} Sitzplätze ein.` };
    }
    else if (type === 'inclusive') {
        const seats = parseInt(document.getElementById('build-inc-seats').value);
        newTask = { id: Date.now(), type: 'inclusive', minSeats: seats, desc: `Richten Sie den Raum barrierefrei für ${seats} Personen ein (Wege & Akustik).` };
    }
    else if (type === 'acoustic_budget') {
        const pts = parseInt(document.getElementById('build-ac-val').value);
        newTask = { id: Date.now(), type: 'acoustic_budget', targetScore: pts, desc: `Erreichen Sie einen Akustik-Score von mindestens ${pts} Punkten.` };
    }

    if (newTask) {
        app.scenarioData.tasks.push(newTask);
        document.getElementById('modal-overlay').classList.remove('active');
        app.renderTaskList();
        showNotification("Regel hinzugefügt.");
    }
};

window.app.deleteTask = function(taskId) {
    app.scenarioData.tasks = app.scenarioData.tasks.filter(t => t.id !== taskId);
    app.renderTaskList();
};

window.app.renderTaskList = function() {
    const list = document.getElementById('scenario-tasks-list');
    if (!list) return;
    
    list.innerHTML = "";
    if (app.scenarioData.tasks.length === 0) {
        list.innerHTML = "<small style='color:#6b7280;'>Noch keine Regeln definiert.</small>";
        return;
    }

    app.scenarioData.tasks.forEach((task, index) => {
        let label = "";
        let color = "";
        
        if (task.type === 'mc') {
            label = "Multiple Choice";
            color = "#3b82f6"; // Blau
        } else if (task.type === 'dist') {
            label = "Abstandsmessung";
            color = "#f59e0b"; // Orange
        } else if (task.type === 'persona') {
            label = "Persona-Prüfung";
            color = "#10b981"; // Grün
        } else if (task.type === 'capacity') {
            label = "Sitzplatz-Kapazität";
            color = "#8b5cf6"; // Lila
        } else if (task.type === 'inclusive') {
            label = "Inklusive Raumplanung";
            color = "#0ea5e9"; // Cyan
        }

        const previewText = task.type === 'mc' ? task.question : task.desc;

        list.innerHTML += `
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 10px; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 10px; font-weight: 700; color: ${color}; text-transform: uppercase;">${index + 1}. ${label}</span>
                    <button onclick="app.deleteTask(${task.id})" style="background: transparent; border: none; color: #ef4444; font-size: 14px; padding: 0; margin: 0; box-shadow: none; min-width: auto;">×</button>
                </div>
                <div style="font-size: 12px; color: #d1d5db; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${previewText}
                </div>
            </div>
        `;
    });
};

// === WERKZEUG KONFIGURATION (Editor) ===
window.app.openToolConfigModal = function() {
    let html = `<div style="max-height: 400px; overflow-y: auto; padding-right: 10px;">
        <p style="font-size: 12px; color: #9ca3af; margin-top: 0; margin-bottom: 15px;">Wählen Sie aus, welche Möbel der Spielende in diesem Szenario einfügen darf.</p>
        <div id="tool-checkboxes" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">`;
    
    // Wir filtern Personas und Zonen heraus (Konstellationen 'k' sind jetzt erlaubt!)
    Object.keys(ASSETS.furniture).forEach(key => {
        if (!key.startsWith('persona_') && !key.startsWith('zone_') && key !== 'avatar_procedural') {
            const isChecked = (app.scenarioData.allowedTools || []).includes(key) ? 'checked' : '';
            html += `<label style="display:flex; align-items:center; gap:8px; font-size:13px; color:white; cursor:pointer;">
                        <input type="checkbox" value="${key}" ${isChecked} style="width:auto; cursor:pointer;"> 
                        ${ASSETS.furniture[key].name}
                     </label>`;
        }
    });

    html += `</div></div>
             <button class="primary" style="width: 100%; margin-top: 20px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-color: #10b981;" onclick="app.saveToolConfig()">Auswahl speichern</button>`;
    
    showModal("Werkzeuge freigeben", html);
};

window.app.saveToolConfig = function() {
    const boxes = document.querySelectorAll('#tool-checkboxes input:checked');
    app.scenarioData.allowedTools = Array.from(boxes).map(b => b.value);
    
    const count = app.scenarioData.allowedTools.length;
    document.getElementById('allowed-tools-preview').innerText = count === 0 ? "Keine Werkzeuge erlaubt." : `${count} Werkzeuge für Spielende erlaubt.`;
    
    document.getElementById('modal-overlay').classList.remove('active');
};

// === PERSONA NAME TAGS (PLAY MODUS) ===
window.app.nameTagInterval = null;

window.app.startNameTags = function() {
    // Altes Nametag-System aufräumen
    document.querySelectorAll('.name-tag').forEach(el => el.remove());
    window.app.activeNameTags = [];
    
    // Zonen zählen, um zu prüfen ob > 1 Zone existiert
    const zones = movableObjects.filter(o => o.userData.isZone);
    const showZoneTags = zones.length > 1;

    movableObjects.forEach(obj => {
        let name = null;
        let isZoneTag = false;

        // Prüfen, ob es eine Persona ist
        if (obj.userData.typeId && obj.userData.typeId.startsWith('persona_')) {
            name = ASSETS.furniture[obj.userData.typeId]?.name || "Persona";
        }
        // Prüfen, ob es eine Zone ist und mehr als 1 Zone im Raum existiert
        else if (obj.userData.isZone && showZoneTags) {
            name = obj.userData.zoneName || "Zone";
            isZoneTag = true;
        }

        if (name) {
            const tag = document.createElement('div');
            tag.className = 'name-tag';
            tag.innerText = name;
            
            // Modernes und aufgeräumtes Styling
            tag.style.position = 'absolute';
            tag.style.background = isZoneTag ? 'rgba(16, 185, 129, 0.85)' : 'rgba(30, 41, 59, 0.85)'; // Grün für Zonen, Schiefergrau für Personas
            tag.style.color = '#ffffff';
            tag.style.padding = '6px 10px';
            tag.style.borderRadius = '6px';
            tag.style.fontSize = '12px';
            tag.style.fontWeight = '600';
            tag.style.pointerEvents = 'none';
            tag.style.transform = 'translate(-50%, -50%)';
            tag.style.zIndex = '1000';
            tag.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            tag.style.backdropFilter = 'blur(4px)';
            tag.style.transition = 'opacity 0.2s ease-in-out';
            if(isZoneTag) tag.style.border = '1px solid #059669';
            
            document.body.appendChild(tag);
            window.app.activeNameTags.push({ mesh: obj, element: tag, isZone: isZoneTag });
        }
    });
};

window.app.quitPlayMode = function() {
    document.getElementById('modal-overlay').classList.remove('active');
    if (window.app.preTestState) {
        app.endTestScenario();
    } else {
        app.goHome();
    }
};

window.app.testScenario = function() {
    if (!app.scenarioData.title) {
        showNotification("Bitte geben Sie dem Szenario zuerst einen Titel!");
        return;
    }
    
    // BUGFIX: Hebt die Editor-Auswahl auf, damit das Sperren/Löschen-Menü verschwindet!
    deselectObject();
    
    // Aktuellen Stand für die Rückkehr sichern (inklusive Info & Fehler!)
    window.app.preTestState = movableObjects.map(obj => {
        const eId = obj.userData.exportId || obj.uuid;
        if (obj.userData.isZone) return { isZone: true, exportId: eId, points: obj.userData.points.map(p => new THREE.Vector2(p.x, p.y)), zoneName: obj.userData.zoneName, color: obj.userData.zoneColor, x: obj.position.x, z: obj.position.z };
        return { 
            typeId: obj.userData.typeId, 
            exportId: eId, 
            x: obj.position.x, 
            z: obj.position.z, 
            rot: obj.rotation.y, 
            annotation: obj.userData.annotation || "", 
            isLocked: obj.userData.isLocked || false,
            infoText: obj.userData.infoText || "", 
            isError: obj.userData.isError || false
        };
    });
    
    // WICHTIG: Alle existierenden Objekte als vom Ersteller gesetzt markieren (nicht löschbar)
    movableObjects.forEach(o => o.userData.isPreplaced = true);
    
    window.app.currentMCIndex = 0;
    window.app.currentMode = 'play';
    app.applyModeUI();
    
    if (typeof camera !== 'undefined' && typeof controls !== 'undefined') {
        camera.position.set(0, 18, 0); 
        controls.target.set(0, 0, 0);
        controls.update();
    }
    
    // Den Abbrechen-Button umschreiben auf Quit-Logik
    const abortBtns = document.querySelectorAll('#scenario-ui-layer button.danger');
    abortBtns.forEach(btn => btn.setAttribute('onclick', 'app.quitPlayMode()'));

    if(app.startNameTags) app.startNameTags();
    if (window.app.initPlayModeHUD) window.app.initPlayModeHUD();
    showNotification(`Testmodus gestartet!`);
};

window.app.endTestScenario = function() {
    window.app.currentMode = 'editor';
    window.app.currentMCIndex = 0;
    
    // Nametags und Hotspots aufräumen
    document.querySelectorAll('.name-tag, .info-hotspot-tag').forEach(el => el.remove());
    window.app.activeNameTags = [];
    window.app.infoTagsInit = false; 
    
    app.clearRoom(false);
    
    // Status exakt wiederherstellen
    if (window.app.preTestState) {
        window.app.preTestState.forEach(item => {
            if (item.isZone) {
                createFurnitureInstance('zone_custom', item.x || 0, item.z || 0, 0);
                const newZone = movableObjects[movableObjects.length - 1];
                newZone.userData.points = item.points.map(p => new THREE.Vector2(p.x, p.y));
                newZone.userData.zoneName = item.zoneName;
                newZone.userData.zoneColor = item.color;
                newZone.userData.exportId = item.exportId; 
                newZone.userData.visualMesh.material.color.setHex(item.color || 0x10b981);
                newZone.userData.wireframe.material.color.setHex(item.color || 0x10b981);
                window.app.updateZoneGeometry(newZone);
            } else {
                createFurnitureInstance(item.typeId, item.x, item.z, item.rot);
                const newObj = movableObjects[movableObjects.length - 1];
                if (newObj) {
                    newObj.userData.exportId = item.exportId; 
                    if(item.annotation) newObj.userData.annotation = item.annotation;
                    if(item.isLocked) newObj.userData.isLocked = item.isLocked;
                    if(item.infoText) newObj.userData.infoText = item.infoText; 
                    if(item.isError) newObj.userData.isError = item.isError;    
                }
            }
        });
    }
    
    delete window.app.preTestState;
    app.applyModeUI();
    
    if (window.app.updateZoneListUI) window.app.updateZoneListUI();
    if (window.app.updateEditorObjectList) window.app.updateEditorObjectList();
    
    showNotification("Testmodus beendet. Zurück im Editor.");
};

window.app.updateHUDTasks = function() {
    const taskListNodes = document.querySelectorAll('#scenario-hud-tasks');
    taskListNodes.forEach(taskList => {
        if (!taskList) return;
        taskList.innerHTML = '';
        
        let hasContent = false;

        // 1. Fehlersuche (Priorität 1: Immer ganz oben)
        const errorObjects = movableObjects.filter(o => o.userData.isError);
        if (errorObjects.length > 0) {
            hasContent = true;
            const foundCount = errorObjects.filter(o => o.userData.errorFound).length;
            const isDone = foundCount === errorObjects.length;
            const icon = isDone ? '✅' : '🔍';
            const color = isDone ? '#10b981' : '#ef4444';
            const border = isDone ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.4)';
            const bg = isDone ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)';
            
            taskList.innerHTML += `
                <li style="display: flex; align-items: flex-start; gap: 12px; font-size: 13px; color: #f8fafc; background: ${bg}; padding: 12px; border-radius: 8px; border: 1px solid ${border}; margin-bottom: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                    <div style="flex-shrink: 0; margin-top: 1px; color: ${color}; font-size: 16px;">
                        ${icon}
                    </div>
                    <span style="line-height: 1.4; color: ${isDone ? '#10b981' : 'white'};"><b>Fehlersuche:</b> Finden Sie die Barrieren im Raum (${foundCount}/${errorObjects.length})</span>
                </li>`;
        }

        // 2. Reguläre Aufgaben
        if (app.scenarioData && app.scenarioData.tasks && app.scenarioData.tasks.length > 0) {
            const spatialTasks = app.scenarioData.tasks.filter(t => t.type !== 'mc');
            if (spatialTasks.length > 0) hasContent = true;
            
            spatialTasks.forEach(task => {
                taskList.innerHTML += `
                    <li style="display: flex; align-items: flex-start; gap: 12px; font-size: 13px; color: #f8fafc; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                        <div style="flex-shrink: 0; margin-top: 1px; color: #10b981;">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-width="2"></circle></svg>
                        </div>
                        <span style="line-height: 1.4;">${task.desc}</span>
                    </li>`;
            });
        }

        if (!hasContent) {
            taskList.innerHTML = `
                <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid #334155; border-radius: 8px; padding: 15px; color: #94a3b8; font-size: 12px;">
                    Es sind keine speziellen Lernziele hinterlegt. Erkunden Sie den Raum frei.
                </div>`;
        }
    });
};

window.app.initPlayModeHUD = function() {
    app.updateHUDTasks();
    
    const errorObjects = movableObjects.filter(o => o.userData.isError);
    const infoObjects = movableObjects.filter(o => o.userData.infoText);
    
    if (errorObjects.length > 0 || infoObjects.length > 0) {
        let html = `<div style="display:flex; flex-direction:column; gap:15px;">`;
        if (errorObjects.length > 0) {
            html += `
            <div style="background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; padding: 15px; border-radius: 4px;">
                <div style="color: #ef4444; font-weight: bold; margin-bottom: 5px; font-size: 14px;">🔍 Fehlersuche Aktiv (${errorObjects.length} Fehler)</div>
                <div style="color: #d1d5db; font-size: 13px; line-height: 1.5;">In diesem Raum haben sich Barrieren versteckt. Klicken Sie diese im 3D-Raum an, um sie aufzudecken, <b>bevor</b> Sie die anderen Aufgaben lösen und Möbel umstellen!</div>
            </div>`;
        }
        if (infoObjects.length > 0) {
            html += `
            <div style="background: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6; padding: 15px; border-radius: 4px;">
                <div style="color: #3b82f6; font-weight: bold; margin-bottom: 5px; font-size: 14px;">ℹ️ Interaktive Info-Punkte</div>
                <div style="color: #d1d5db; font-size: 13px; line-height: 1.5;">Achten Sie auf Möbel mit dem blauen i-Symbol. Klicken Sie darauf, um wichtige pädagogische Hinweise zur Raumgestaltung zu erhalten.</div>
            </div>`;
        }
        html += `</div>`;
        
        showModal("Mission Briefing", `
            <p style="color: white; margin-bottom: 20px; font-size: 14px;">Bevor Sie beginnen, beachten Sie bitte folgende Besonderheiten in diesem Szenario:</p>
            ${html}
            <button class="primary" style="width: 100%; margin-top: 25px; padding: 14px; font-size: 14px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-color: #10b981;" onclick="document.getElementById('modal-overlay').classList.remove('active')">Verstanden & Loslegen</button>
        `);
    }
};

// === FULLSCREEN API ===
window.app.toggleFullscreen = function() {
    if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
};

// UI Synchronisation: Falls der Nutzer ESC drückt, muss der Regler umspringen
document.addEventListener('fullscreenchange', () => {
    const isFull = !!document.fullscreenElement;
    const toggleHome = document.getElementById('start-fullscreen');
    if (toggleHome) toggleHome.checked = isFull;
    
    // NEU: Vollbild-Status für Practice-Module merken
    localStorage.setItem('elmeks_fullscreen', isFull);
});

// === SCREEN WAKE LOCK API (DSGVO-konform) ===
// Verhindert, dass das Display ausgeht, während die App aktiv genutzt wird.
window.app.wakeLock = null;

window.app.requestWakeLock = async function() {
    try {
        if ('wakeLock' in navigator) {
            window.app.wakeLock = await navigator.wakeLock.request('screen');
            console.log('Screen Wake Lock ist aktiv.');
            
            window.app.wakeLock.addEventListener('release', () => {
                console.log('Screen Wake Lock wurde freigegeben.');
            });
        }
    } catch (err) {
        console.warn('Wake Lock Fehler:', err.name, err.message);
    }
};

// Wenn der Tab wieder sichtbar wird (Nutzer kommt zurück), Wake Lock neu anfordern
document.addEventListener('visibilitychange', () => {
    if (window.app.wakeLock !== null && document.visibilityState === 'visible') {
        window.app.requestWakeLock();
    }
});

window.app.requestWakeLock();

// === INITIALISIERUNG ===
init();
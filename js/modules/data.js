export const SCENARIOS = {
};

export const SIM_GLOSSARY = {  
    normal: { title: "Normale Sicht", text: "Keine Einschränkungen aktiv.", tip: "" },  
    low: { 
        title: "Sehbehinderung (z.B. Myopie, Hyperopie, Astigmatismus)",  
        text: "Visus < 0.3. Details an der Tafel oder in Büchern sind nur schwer erkennbar. Vergrößerungshilfen sind nötig. Bei Kindern meistens durch Fehlbildung des Augapfels oder asymmetrische Hornhautkrümmung.",  
        tip: "Vergrößerte Arbeitsblätter (A3) anbieten. Tafelbild verbalisieren (alles laut vorlesen). Sitzplatz nah an der Tafel."  
    },  
    severe: {  
        title: "Hochgradige Sehbehinderung",  
        text: "Visus < 0.05. Orientierung ist noch möglich, aber Lesen normaler Schrift ist unmöglich.",  
        tip: "Digitale Hilfsmittel (Tablet mit Zoom/VoiceOver) zulassen. Taktile Leitsysteme im Raum freihalten. Starke Kontraste bei Farben, Linien und Texturen nutzen."  
    },  
    blind: {  
        title: "Blindheit",  
        text: "Visus < 0.02. Visuelle Informationen fehlen fast vollständig. Tast- und Hörsinn sind entscheidend.",  
        tip: "Fester Sitzplatz (Orientierung). Materialien digital barrierefrei oder in Braille bereitstellen. Laufwege zwingend freihalten!"  
    },  
    tunnel: {  
        title: "Retinitis Pigmentosa (RP) / Tunnelblick",  
        text: "Verlust der Peripherie (Röhrengesichtsfeld/Tunnelblick), Nachtblindheit. Orientierung im Raum ist massiv erschwert, zentrales Lesen oft noch gut möglich.",  
        tip: "Ordnung halten! Taschen gehören nicht in den Gang (Stolperfallen). Lernende zentral vor die Tafel setzen (nicht seitlich)."  
    },  
    spot: {  
        title: "Juvenile Makuladegeneration (Morbus Stargardt, Best)",  
        text: "Einschränkung des zentralen Gesichtsfelds. Verzerrung von Formen bis hin zu komplettem Ausfall. Gesichter und Texte können nicht fixiert werden. Orientierung im Raum funktioniert über peripheres Sehen.",  
        tip: "Kind schaut oft 'daneben', um zu sehen - das ist kein Desinteresse! Vergrößerung hilft oft nicht (fällt in den toten Winkel)."  
    },  
    scotoma: {  
        title: "Parazentralskotom",  
        text: "Inselförmige Ausfälle neben dem Zentrum, bspw. als Folge von Makuladegeneration oder des Glaukoms. Buchstaben oder Wörter 'springen' oder fehlen beim Lesen.",  
        tip: "Geduld beim Lesen. Serifenlose, klare Schriftarten (Arial, Verdana) mit erhöhtem Zeilenabstand nutzen."  
    },  
    hemi: {  
        title: "Hemianopsie (Rechts)",  
        text: "Rechtsseitiger Ausfall (z. B. nach Schlaganfall). Die rechte Hälfte der Welt fehlt.",  
        tip: "Sitzplatz LINKS im Raum wählen, damit das Geschehen im gesunden (linken) Sichtfeld liegt. Lernende nicht von rechts ansprechen."  
    },  
    'hemi-l': {  
        title: "Hemianopsie (Links)",  
        text: "Linksseitiger Ausfall. Die linke Hälfte der Welt fehlt.",  
        tip: "Sitzplatz RECHTS im Raum wählen. Achtung bei Gruppenarbeit: Partner sollte rechts sitzen."  
    },  
    quadrant: {  
        title: "Quadrantenanopsie",  
        text: "Ausfall eines Viertels (hier oben rechts). Kann beim Blick auf die Tafel stören.",  
        tip: "Tafelbild kompakt halten. Prüfen, ob der Lernende den oberen Tafelrand sehen kann, ohne den Kopf extrem zu verrenken."  
    },  
    ring: {  
        title: "Ringskotom",  
        text: "Ein blinder Ring um das Zentrum, bspw. als Folge von Retinits Pigmentosa. Objekte verschwinden beim Näherkommen kurzzeitig.",  
        tip: "Vorsicht im Sportunterricht (Bälle verschwinden plötzlich). Klare Absprachen bei Bewegungen im Raum."  
    },  
    cataract: {  
        title: "Katarakt (Grauer Star)",  
        text: "Trübung der Linse. Alles wirkt milchig. Hohe Blendempfindlichkeit bei Gegenlicht. Reduzierte Farbintensität.",  
        tip: "Platz mit Rücken zum Fenster. Jalousien nutzen, um Blendung auf der Tafel zu vermeiden. Hohe Kontraste an der Tafel (Gelb auf Blau). Große weiße Flächen vermeiden."  
    },  
    glaucoma: {  
        title: "Glaukom (Grüner Star)",  
        text: "Überhöhter Augeninnendruck. Schleichender, schmerzfreier Prozess. Oft Mischung aus Gesichtsfeldausfällen (bogenförmige, blinde Flecken) und Nebel.",  
        tip: "Stressfreies Sehumfeld schaffen. Pausen für die Augen einplanen. Gute, blendfreie Raumbeleuchtung sicherstellen. In fortgeschrittenen Stadien auf taktile Materialien setzen."  
    },  
    photophobia: {  
        title: "Extreme Photophobie",  
        text: "Lichtschmerz (z. B. bei Albinismus). Normale Raumbeleuchtung blendet massiv. Kontraste verschwinden. Hinweis: Lichtgazing als gegensätzliche Folge von CVI.",  
        tip: "Dunkelster Platz im Raum (Ecke). Erlaubnis für Sonnenbrille/Kappi im Unterricht. 'Dark Mode' auf Tablets nutzen."  
    },  
    nyctalopia: {  
        title: "Nachtblindheit",  
        text: "Sehversagen bei Dämmerung. Im dunklen Klassenzimmer (Beamer) orientierungslos.",  
        tip: "Bei Filmvorführungen/Beamer-Einsatz: Lernende nicht im Raum umherlaufen lassen. Kleine Platzbeleuchtung erlauben."  
    },  
    retina: {  
        title: "Diabetische / Frühgeborenen-Retinopathie",  
        text: "Fleckige Ausfälle (Skotome) im ganzen Bild bis hin zu kompletter Netzhautablösung (Erblindung). Tagesform schwankt stark.",  
        tip: "Flexibilität bei der Leistungserwartung (Tagesform). Kopien in sehr guter Qualität (keine blassen Matrizen)."  
    },  
    cvi: {  
        title: "CVI (Zerebrale Sehstörung)",  
        text: "Oberbegriff. Gehirn kann visuelle Reize nicht (komplett) verarbeiten. 'Wimmelbilder' (voller Raum) führen zu Wahrnehmungsstörungen, die zu Stress/Orientierungsverlust führen.",  
        tip: "Reizreduktion! Arbeitsblätter entschlacken (nur eine Aufgabe pro Seite). Ruhiger Sitzplatz (Wandblick, nicht in den Raum)."  
    },  
    crowding: {  
        title: "Crowding",  
        text: "Visuelle Überfüllung. Einzelne Objekte in ruhiger Umgebung werden erkannt. Eng stehende/viele Objekte verschmelzen miteinander.",  
        tip: "Größerer Buchstabenabstand und Zeilenabstand. Abdeckschablone beim Lesen nutzen. Visuelle Komplexität massiv reduzieren (nicht 'Aufgaben einfacher machen'!)."  
    },  
    neglect: {
        title: "Neglect",
        text: "Halbseitige Vernachlässigung des Raumes. Neurologisch bedingt wird die Hälfte der visuellen Informationen vernachlässigt.",
        tip: "Sitzplatz entsprechend der gesunden Gesichtsfeldhälfte wählen."
    },
    metamorphopsia: {  
        title: "Metamorphopsie",  
        text: "Verzerrtsehen, meist als Folge von Makuladegeneration. Gerade Linien (Tafel, Karopapier) wirken wellig. Lesen/Schreiben erschwert.",  
        tip: "Linienverstärktes Papier anbieten. Schreiben am Tablet erlauben (Zoom/Raster hilft)."  
    },  
    diplopia: {  
        title: "Diplopie (Doppelbilder)",  
        text: "Bilder decken sich nicht. Führt zu Kopfschmerzen, Übelkeit und Greif-Fehlern. Betroffene ermüden schnell.",  
        tip: "Leseportionen einteilen. Beim Experimentieren (Chemie/Physik) Assistenz stellen."  
    },  
    noise: {  
        title: "Visual Snow",  
        text: "Dauerhaftes Bildrauschen ('Schnee'). Senkt Kontraste und erhöht die Konzentrationslast.",  
        tip: "Kognitive Pausen. Vermeidung von stark gemusterten Hintergründen auf Arbeitsblättern/Tafeln. Hohe visuelle Kontraste herstellen."  
    },
    strabismus: {
        title: "Strabismus (Schielen)",
        text: "Fehlstellung der visuellen Achsen. Doppelbilder oder Unterdrückung des Inputs des abweichenden Auges. Führt zu fehlendem räumlichen Sehen (Orientierung/Motorik).",
        tip: "Besondere Führung bei räumlichen Tätigkeiten, insbesondere im Sportunterricht. Treppensteigen vermeiden bzw. dabei unterstützen."
    },
    amblyopia: {
        title: "Amblyopie ('Lazy Eye')",
        text: "Stark unterentwickelte Sehfähigkeit auf einem Auge. Wird häufig durch Okklusionstherapie behandelt. Räumliches Sehen wird beeinträchtigt.",
        tip: "In Absprache mit Betroffenen Klasse aufklären. Besondere Führung bei räumlichen Tätigkeiten. Treppensteigen unterstützen."
    },  
    achromatopsia: {  
        title: "Achromatopsie",  
        text: "Totale Farbenblindheit. Oft verbunden mit hoher Lichtempfindlichkeit.",  
        tip: "Niemals Informationen nur über Farbe codieren! Immer Muster, Worte oder Beschriftungen nutzen (z.B. in Diagrammen)."  
    },  
    protanopia: {  
        title: "Protanomalie/Protanopie (Rot-Schwäche/-Blindheit)",  
        text: "Rot wird nicht wahrgenommen. Ampeln/Warnhinweise wirken dunkelgrau.",  
        tip: "Achtung bei Korrekturen (Roter Stift ist schwer lesbar). Rot nicht als Signalfarbe an der Tafel nutzen."  
    },  
    deuteranopia: {  
        title: "Deuteranomalie/Deuteranopie (Grün-Schwäche/-Blindheit)",  
        text: "Rot und Grün sind schwer zu unterscheiden. Relevant für Landkarten.",  
        tip: "Farbige Kreide an der Tafel vermeiden (Kontrast zu Grün/Grau schlecht). Landkarten beschriften statt färben."  
    },  
    tritanopia: {  
        title: "Tritanomalie/Tritanopie (Blau-Schwäche/-Blindheit)",  
        text: "Blau und Gelb werden verwechselt. Sehr Selten.",  
        tip: "Farbcodierungen in Unterrichtsmaterialien prüfen (nicht Gelb auf Weiß oder Blau auf Grün)."  
    }  
};

export const ASSETS = {
  rooms: {
    "raummodell_leer.glb": { 
        data: null, playableArea: { x: 4.4, z: 4.3 }, area: 50, name: "LLR Standard (Leer)",
        acousticTargets: { warn: 0.25, good: 0.45 } 
    },
    "50qm_möbliertglb.glb": { 
        data: null, playableArea: { x: 4.5, z: 4.5 }, area: 50, name: "LLR Möbliert (Standard)",
        acousticTargets: { warn: 0.25, good: 0.45 } 
    },
    "leer_70qm.glb": { 
        data: null, playableArea: { x: 5.5, z: 5.5 }, area: 70, name: "Großer Raum (70qm)",
        acousticTargets: { warn: 0.20, good: 0.40 } 
    },
    "leer_30qm.glb": { 
        data: null, playableArea: { x: 3.5, z: 3.5 }, area: 30, name: "Kleiner Raum (30qm)",
        acousticTargets: { warn: 0.35, good: 0.60 } 
    },
  },
  furniture: {
    'row_combo': { file: 'Tischplusstuhleinzeln.glb', dims: {x: 0.8, z: 1.2}, radius: 0.8, seats: 1, name: "Tisch+Stuhl", acousticBonus: 2.0 },
    'tano':      { file: 'trapezTisch.glb',           dims: {x: 1.2, z: 0.7}, radius: 0.6, seats: 1, name: "Trapeztisch", acousticBonus: 1.5 },
    'triangle':  { file: 'dreiecksTisch.glb',         dims: {x: 1.0, z: 0.9}, radius: 0.5, seats: 1, name: "Dreieckstisch", acousticBonus: 1.5 },
    'chair':     { file: 'roterStuhl.glb',            dims: {x: 0.5, z: 0.5}, radius: 0.4, seats: 1, name: "Stuhl", acousticBonus: 0.8 },
    'teacher':   { file: 'Lehrertisch.glb',           dims: {x: 1.6, z: 0.8}, radius: 1.0, seats: 0, name: "Lehrerpult", acousticBonus: 2.5 },
    'cupboard':  { file: 'runderSchrank.glb',         dims: {x: 1.2, z: 0.4}, radius: 0.8, seats: 0, name: "Regal (Rund)", acousticBonus: 3.5 },
    'board':     { file: 'tafel_skaliert.glb',        dims: {x: 2.0, z: 0.2}, radius: 0.2, seats: 0, isWallItem: true, name: "Tafel", acousticBonus: 1.0 },
    
    'laptop':        { file: 'Laptop.glb',         dims: {x: 0.4, z: 0.3}, radius: 0.3, seats: 0, name: "Laptop", acousticBonus: 0.1, yOffset: 1.23 }, 
    'cabinet_short': { file: 'kurzer Schrank.glb', dims: {x: 1.0, z: 0.5}, radius: 0.7, seats: 0, name: "Schrank (Kurz)", acousticBonus: 4.0 },
    'cabinet_long':  { file: 'langer_Schrank.glb', dims: {x: 1.8, z: 0.5}, radius: 1.0, seats: 0, name: "Schrank (Lang)", acousticBonus: 6.0 },
    'sofa':          { file: 'Sofa.glb',           dims: {x: 2.0, z: 0.9}, radius: 1.1, seats: 2, name: "Sofa", acousticBonus: 8.0 },
    'table_square':  { file: 'Quadrat_Tisch.glb',  dims: {x: 1.0, z: 1.0}, radius: 0.8, seats: 0, name: "Quadrat-Tisch", acousticBonus: 2.0 },
    'table_double':  { file: '2er_Tisch.glb',      dims: {x: 1.6, z: 0.8}, radius: 1.0, seats: 0, name: "2er Tisch", acousticBonus: 3.0 },

    'persona_mia':   { procedural: true, type: 'persona', color: 0x3b82f6, name: "Mia (Rollstuhl)", dims: {x: 0.7, y: 1.0, z: 0.7}, radius: 0.6, seats: 0, yOffset: 0.10, 
                       req: { type: 'distance', minClearance: 90, desc: "Rollstuhl-Bewegungsradius (90cm) muss frei sein." } },
    'persona_ben':   { procedural: true, type: 'persona', color: 0xf59e0b, name: "Ben (ADHS)", dims: {x: 0.4, y: 1.0, z: 0.4}, radius: 0.3, seats: 0, yOffset: 0.10, 
                       req: { type: 'zone', preferredZone: "Zone Grün", desc: "Benötigt einen reizarmen Rückzugsort (z.B. grüne Zone)." } },
    'persona_lukas': { procedural: true, type: 'persona', color: 0x10b981, name: "Lukas (Hörschäd.)", dims: {x: 0.4, y: 1.0, z: 0.4}, radius: 0.3, seats: 0, yOffset: 0.10, 
                       req: { type: 'view', target: 'board', desc: "Muss zwingend die Tafel / Lehrkraft gut sehen können (Lippenlesen)." } },
    'persona_tim':   { procedural: true, type: 'persona', color: 0x8b5cf6, name: "Tim (Visus 30%)", dims: {x: 0.4, y: 1.0, z: 0.4}, radius: 0.3, seats: 0, yOffset: 0.10, 
                       req: { type: 'proximity', target: 'board', maxDist: 2.5, desc: "Sitzplatz darf max. 2,5m von der Tafel entfernt sein." } },
    'persona_emma':  { procedural: true, type: 'persona', color: 0xec4899, name: "Emma (Regulär)", dims: {x: 0.4, y: 1.0, z: 0.4}, radius: 0.3, seats: 0, yOffset: 0.10, 
                       req: { type: 'none', desc: "Lernende ohne sichtbare Einschränkung." } },
    'persona_leon':  { procedural: true, type: 'persona', color: 0x14b8a6, name: "Leon (Regulär)", dims: {x: 0.4, y: 1.0, z: 0.4}, radius: 0.3, seats: 0, yOffset: 0.10, 
                       req: { type: 'none', desc: "Lernender ohne sichtbare Einschränkung." } },

    'zone_custom': { procedural: true, type: 'zone', color: 0x10b981, name: "Zone", seats: 0, yOffset: 0.125, noShadow: true },
    
    'carpet_proc': { procedural: true, type: 'box', dims: {x: 3.0, y: 0.04, z: 2.0}, color: 0x8D6E63, name: "Akustik-Teppich", acousticBonus: 5.0, seats: 0, yOffset: 0.18, radius: 0.1, noShadow: true },
    'partition_proc': { procedural: true, type: 'box', dims: {x: 1.5, y: 1.8, z: 0.1}, color: 0x336699, name: "Schallschutzwand", acousticBonus: 8.0, seats: 0, radius: 0.8, noShadow: false },
    'absorber_proc': { procedural: true, type: 'box', dims: {x: 1.0, y: 1.0, z: 0.05}, color: 0xcccccc, name: "Wand-Absorber", acousticBonus: 3.0, seats: 0, isWallItem: true, radius: 0.1, noShadow: true, yOffset: 1.5 },

    'avatar_procedural': { data: null, name: "Avatar (Lernender)", radius: 0.4, seats: 0, acousticBonus: 0.5 },

    'k1': { file: 'Tischaufstellung1.glb',    dims: {x: 1.6, z: 1.2}, radius: 1.0, seats: 2, name: "2er Ecktisch", acousticBonus: 4.0 }, 
    'k2': { file: 'Tischaufstellung2.glb',    dims: {x: 1.6, z: 1.4}, radius: 1.1, seats: 2, name: "2er Vis-a-Vis", acousticBonus: 4.0 },
    'k3': { file: 'Tischaufstellung3.glb',    dims: {x: 3.2, z: 1.6}, radius: 1.8, seats: 8, name: "8er Gruppentisch", acousticBonus: 16.0 },
    'k4': { file: 'Tischkonstellation4.glb',  dims: {x: 3.5, z: 3.5}, radius: 2.0, seats: 8, name: "8er Kreis", acousticBonus: 16.0 },
    'k5': { file: 'Tischkonstellation5.glb',  dims: {x: 2.2, z: 2.2}, radius: 1.5, seats: 4, name: "4er Ecktisch", acousticBonus: 8.0 },
    'k6': { file: 'Tischkonstellation6.glb',  dims: {x: 3.0, z: 2.0}, radius: 1.8, seats: 6, name: "6er Gruppentisch", acousticBonus: 12.0 }, 
    'k7': { file: 'Tischkonstellation7.glb',  dims: {x: 4.0, z: 3.0}, radius: 2.2, seats: 11, name: "11er U-Form", acousticBonus: 22.0 },
    'k8': { file: 'Tischkonstellation8.glb',  dims: {x: 3.5, z: 3.0}, radius: 2.0, seats: 9, name: "9er U-Form", acousticBonus: 18.0 },
  },
};
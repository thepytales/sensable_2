import * as THREE from "three";

// Interner State
let currentAvatar = null;
let isFirstPerson = false;
let savedCameraState = { pos: new THREE.Vector3(), target: new THREE.Vector3() };

// Neues elegantes Design
const DESIGN = { 
    body: 0x374151,   // Elegantes Anthrazit
    accent: 0x3b82f6, // Royal Blue für Visier und Basis
    head: 0xf3f4f6    // Lichtgrau für den Kopf
};

// === Getters ===

export function isFirstPersonActive() {
    return isFirstPerson;
}

export function getCurrentAvatar() {
    return currentAvatar;
}

// === Main Functions ===

/**
 * Erstellt oder löscht den Avatar in der Szene.
 * Händelt auch das Entfernen aus den Verwaltungs-Arrays.
 * 
 * @param {THREE.Scene} scene 
 * @param {Array} movableObjects - Referenz auf das Array in script.js
 * @param {Array} interactionMeshes - Referenz auf das Array in script.js
 * @returns {THREE.Group|null} Das Avatar-Objekt oder null, wenn entfernt.
 */
export function toggleAvatar(scene, movableObjects, interactionMeshes) {
    // 1. Entfernen, falls bereits vorhanden
    if (currentAvatar) {
        scene.remove(currentAvatar);
        
        let idx = movableObjects.indexOf(currentAvatar);
        if (idx > -1) movableObjects.splice(idx, 1);
        
        if (currentAvatar.children) {
            const hitbox = currentAvatar.children.find(c => c.userData.isHitbox);
            if(hitbox) {
                const hIdx = interactionMeshes.indexOf(hitbox);
                if (hIdx > -1) interactionMeshes.splice(hIdx, 1);
            }
        }

        currentAvatar.traverse(c => {
            if(c.geometry) c.geometry.dispose();
            if(c.material) {
                if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
                else c.material.dispose();
            }
        });

        currentAvatar = null;
        isFirstPerson = false; 
        return null;
    }

    // 2. Neu erstellen (Modernes Design)
    const group = new THREE.Group();
    const visualGroup = new THREE.Group(); 

    const matBody = new THREE.MeshStandardMaterial({ color: DESIGN.body, roughness: 0.7, metalness: 0.1 });
    const matHead = new THREE.MeshStandardMaterial({ color: DESIGN.head, roughness: 0.3 });
    const matAccent = new THREE.MeshStandardMaterial({ color: DESIGN.accent, roughness: 0.2, metalness: 0.3 });

    // --- Modern Geometry ---

    // Basisplatte (Marker am Boden)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 32), matAccent);
    base.position.y = 0.025;
    visualGroup.add(base);

    // Torso (Abgerundete Kapsel)
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 16, 16), matBody);
    torso.position.y = 1.0; 
    torso.castShadow = true;
    visualGroup.add(torso);

    // Kopf (Kugel)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 32, 32), matHead);
    head.position.y = 1.6; 
    head.castShadow = true;
    visualGroup.add(head);

    // Visier (Gibt die Blickrichtung an - Tech Look)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.15), matAccent);
    visor.position.set(0, 1.62, 0.12); // Vorne am Gesicht
    visualGroup.add(visor);

    // Linker Arm
    const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.4, 16, 16), matBody);
    armL.position.set(-0.32, 1.0, 0);
    armL.rotation.z = Math.PI / 16;
    armL.castShadow = true;
    visualGroup.add(armL);

    // Rechter Arm
    const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.4, 16, 16), matBody);
    armR.position.set(0.32, 1.0, 0);
    armR.rotation.z = -Math.PI / 16;
    armR.castShadow = true;
    visualGroup.add(armR);

    group.add(visualGroup);

    // --- Hitbox (Unsichtbar für Klick-Erkennung) ---
    const hitbox = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 2.0, 0.8), 
        new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.y = 1.0;
    hitbox.userData = { root: group, isHitbox: true }; 
    group.add(hitbox);

    // --- Metadaten ---
    group.position.set(0, 0, 0); 
    group.rotation.y = Math.PI; 
    group.userData = { 
        typeId: 'avatar_procedural', 
        isAvatar: true, 
        annotation: "Lernender (Simulation)", 
        visualRef: visualGroup 
    };
    
    scene.add(group);
    movableObjects.push(group);
    interactionMeshes.push(hitbox);

    currentAvatar = group;
    return group;
}

/**
 * Schaltet zwischen Ich-Perspektive und normaler Ansicht um.
 * Positioniert die Kamera und speichert den alten Status.
 * * @param {THREE.Camera} camera 
 * @param {THREE.OrbitControls} controls 
 */
export function toggleAvatarView(camera, controls) {
    if (!currentAvatar) { 
        console.warn("Versuch, Avatar-Ansicht zu toggeln ohne Avatar.");
        return; 
    }

    const visualGroup = currentAvatar.userData.visualRef;

    if (!isFirstPerson) {
        // === AKTIVIEREN (First Person) ===
        isFirstPerson = true;

        savedCameraState.pos.copy(camera.position);
        savedCameraState.target.copy(controls.target);

        if(visualGroup) visualGroup.visible = false;

        // Kamera exakt auf Visier-Höhe
        const eyePos = currentAvatar.position.clone();
        eyePos.y += 1.62; 
        camera.position.copy(eyePos);

        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(currentAvatar.quaternion);
        const targetPos = eyePos.clone().add(forward);
        controls.target.copy(targetPos);
        
        controls.maxPolarAngle = Math.PI - 0.1; 
        controls.update();

    } else {
        // === DEAKTIVIEREN (Third Person) ===
        isFirstPerson = false;

        if(visualGroup) visualGroup.visible = true;

        camera.position.copy(savedCameraState.pos);
        controls.target.copy(savedCameraState.target);
        
        controls.maxPolarAngle = Math.PI / 2 - 0.05;
        controls.update();
    }
}
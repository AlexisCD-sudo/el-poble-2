
import * as THREE from 'three';
import { buildVillage } from './world/village.js';
import { buildColliders, movePlayer, createMoveResult } from './player/collisions.js';
import { BUILDINGS, WALLS, PROPS } from './world/layout.js';

// -----------------------------------------------------
// 1. CONFIGURACIÓ (valors que pots retocar fàcilment)
// -----------------------------------------------------
const EYE_HEIGHT = 1.7;        // Alçada dels ulls en metres
const WALK_SPEED = 4.0;        // Velocitat de caminar (metres per segon)
const ACCELERATION = 10.0;     // Com de ràpid s'arriba a la velocitat màxima (més alt = més àgil)
const MOUSE_SENSITIVITY = 0.002; // Sensibilitat del ratolí
const MAP_LIMIT = 95;          // Límit del terra (el terra fa 200x200, de -100 a 100)
const PLAYER_RADIUS = 0.35;    // Radi de col·lisió del jugador (cercle en el pla XZ)

// -----------------------------------------------------
// 2. RENDERER (el que dibuixa l'escena a la pantalla)
// -----------------------------------------------------
// antialias desactivat: va millor en targetes gràfiques antigues
// i encaixa amb l'estil pixel-art.
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
// Limitem la densitat de píxels a 1 per no sobrecarregar la GPU.
renderer.setPixelRatio(1);

// Treiem els marges de la pàgina i afegim el canvas.
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.style.background = '#000';
document.body.appendChild(renderer.domElement);

// -----------------------------------------------------
// 3. ESCENA, BOIRA I ATMOSFERA NOCTURNA
// -----------------------------------------------------
const scene = new THREE.Scene();
const nightColor = 0x0b1020;            // Blau-gris molt fosc
scene.background = new THREE.Color(nightColor);
scene.fog = new THREE.Fog(nightColor, 8, 60); // Boira: comença a 8 m i és total a 60 m

// -----------------------------------------------------
// 4. CÀMERA (els ulls del jugador)
// -----------------------------------------------------
const camera = new THREE.PerspectiveCamera(
  70,                                    // Camp de visió
  window.innerWidth / window.innerHeight,
  0.1,                                   // Distància mínima de dibuix
  100                                    // Distància màxima de dibuix
);
camera.position.set(0, EYE_HEIGHT, 27);  // Comencem a l'entrada del carrer (mirant cap al nord)
// L'ordre 'YXZ' evita que la càmera es "decanti" al girar i mirar amunt/avall.
camera.rotation.order = 'YXZ';

// -----------------------------------------------------
// 5. LLUMS
// -----------------------------------------------------

// Llum ambiental: permet veure el poble sense eliminar la nit.
const hemiLight = new THREE.HemisphereLight(0x9aafd0, 0x303040, 1.5);
scene.add(hemiLight);

// Llum de lluna: il·luminació freda i més intensa.
const moonLight = new THREE.DirectionalLight(0xb5c9ff, 1.2);
moonLight.position.set(-20, 40, 10);
scene.add(moonLight);

// -----------------------------------------------------
// 6. TERRA PROVISIONAL I POBLE
// -----------------------------------------------------
// MeshLambertMaterial és més lleuger que MeshStandardMaterial:
// ideal per a la teva AMD Radeon HD 6770M.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshLambertMaterial({ color: 0x2b2f38 })
);
ground.rotation.x = -Math.PI / 2; // El plànol és vertical per defecte; el posem horitzontal
scene.add(ground);

// Poble greybox (edificis, murs, font, arbre, atrezzo i fanals), construït
// a partir de les dades de src/world/layout.js.
buildVillage(scene);

// Col·lidors: es construeixen UNA sola vegada a partir del mateix layout.
const colliders = buildColliders({ BUILDINGS, WALLS, PROPS });
const moveResult = createMoveResult(); // objecte reutilitzat cada fotograma (sense crear brossa)

// -----------------------------------------------------
// 7. CAPA D'INSTRUCCIONS (overlay)
// -----------------------------------------------------
const overlay = document.createElement('div');
overlay.style.cssText = `
  position: fixed; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.65);
  color: #d8dcea;
  font-family: Georgia, serif;
  text-align: center;
  cursor: pointer;
  user-select: none;
`;
overlay.innerHTML = `
  <div style="font-size: 32px; margin-bottom: 16px;">The Forgotten Village</div>
  <div style="font-size: 20px; margin-bottom: 24px;">Clica per començar</div>
  <div style="font-size: 16px; line-height: 1.8; opacity: 0.85;">
    W A S D — moure's<br>
    Ratolí — mirar al voltant<br>
    Esc — alliberar el ratolí
  </div>
`;
document.body.appendChild(overlay);

// -----------------------------------------------------
// 8. POINTER LOCK (captura del ratolí)
// -----------------------------------------------------
// Només es pot activar com a resposta a un clic de l'usuari.
overlay.addEventListener('click', () => {
  renderer.domElement.requestPointerLock();
});

// Aquest esdeveniment salta quan el ratolí es captura o s'allibera (p. ex. amb Esc).
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  overlay.style.display = locked ? 'none' : 'flex';
  if (!locked) {
    // Si sortim, esborrem les tecles premudes per evitar que el jugador segueixi caminant sol.
    for (const key in keys) keys[key] = false;
  }
});

document.addEventListener('pointerlockerror', () => {
  console.warn('No s\'ha pogut capturar el ratolí.');
});

// -----------------------------------------------------
// 9. ENTRADA: TECLAT I RATOLÍ
// -----------------------------------------------------
const keys = { forward: false, back: false, left: false, right: false };

// Fem servir event.code (posició física de la tecla), així WASD funciona
// igual amb qualsevol disposició de teclat.
function setKey(code, pressed) {
  if (code === 'KeyW') keys.forward = pressed;
  if (code === 'KeyS') keys.back = pressed;
  if (code === 'KeyA') keys.left = pressed;
  if (code === 'KeyD') keys.right = pressed;
}
document.addEventListener('keydown', (e) => setKey(e.code, true));
document.addEventListener('keyup', (e) => setKey(e.code, false));

// Rotació de la càmera:
// yaw = girar a esquerra/dreta, pitch = mirar amunt/avall (en radians).
let yaw = 0;
let pitch = 0;
const MAX_PITCH = Math.PI / 2 - 0.05; // Gairebé 90°, sense arribar a girar el cap del revés

document.addEventListener('mousemove', (e) => {
  // Només girem si el ratolí està capturat.
  if (document.pointerLockElement !== renderer.domElement) return;
  yaw -= e.movementX * MOUSE_SENSITIVITY;
  pitch -= e.movementY * MOUSE_SENSITIVITY;
  // Limitem el pitch perquè no es pugui fer una volta completa.
  pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
});

// -----------------------------------------------------
// 10. MOVIMENT
// -----------------------------------------------------
const velocity = new THREE.Vector3();        // Velocitat actual (suavitzada)
const targetVelocity = new THREE.Vector3();  // Velocitat que volem aconseguir
const forwardDir = new THREE.Vector3();
const rightDir = new THREE.Vector3();

function updatePlayer(dt) {
  // Direccions "endavant" i "dreta" segons cap a on mira el jugador (només horitzontal).
  forwardDir.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  rightDir.set(Math.cos(yaw), 0, -Math.sin(yaw));

  // Sumem les direccions segons les tecles premudes.
  targetVelocity.set(0, 0, 0);
  if (keys.forward) targetVelocity.add(forwardDir);
  if (keys.back) targetVelocity.sub(forwardDir);
  if (keys.right) targetVelocity.add(rightDir);
  if (keys.left) targetVelocity.sub(rightDir);

  // Normalitzem perquè caminar en diagonal no sigui més ràpid.
  if (targetVelocity.lengthSq() > 0) {
    targetVelocity.normalize().multiplyScalar(WALK_SPEED);
  }

  // Apropem la velocitat actual a la desitjada: arrencada i frenada suaus però àgils.
  const blend = Math.min(1, ACCELERATION * dt);
  velocity.lerp(targetVelocity, blend);

  // Apliquem el moviment amb col·lisions: movePlayer() empeny el jugador fora
  // de parets i objectes i el deixa lliscar al llarg d'ells.
  movePlayer(
    camera.position.x, camera.position.z,   // posició actual
    velocity.x * dt, velocity.z * dt,       // desplaçament d'aquest fotograma
    PLAYER_RADIUS, colliders, moveResult
  );
  camera.position.x = moveResult.x;
  camera.position.z = moveResult.z;

  // Límits del mapa (seguretat: el poble ja queda tancat pels murs).
  camera.position.x = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, camera.position.x));
  camera.position.z = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, camera.position.z));

  // El terra és pla a y = 0: mantenim els ulls sempre a 1,7 m,
  // així el jugador mai pot quedar per sota del terra.
  camera.position.y = EYE_HEIGHT;

  // Apliquem la rotació a la càmera.
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

// -----------------------------------------------------
// 11. REDIMENSIONAT DE LA FINESTRA
// -----------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// -----------------------------------------------------
// 12. BUCLE PRINCIPAL
// -----------------------------------------------------
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  // dt = segons des de l'últim fotograma. El limitem a 0,05 s
  // per evitar salts grans si la pestanya queda en segon pla.
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  updatePlayer(dt);
  renderer.render(scene, camera);
}

animate();

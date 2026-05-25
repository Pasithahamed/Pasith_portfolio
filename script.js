// ==========================================================================
//   Three.js Portal & Tunnel Journey
// ==========================================================================

// Device detection for performance tuning
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

const canvas = document.querySelector('#bg-canvas');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2));
renderer.toneMapping = THREE.ReinhardToneMapping;

// Post-Processing - Disable on mobile to improve reliability and frame rates
let composer = null;
if (!isMobile) {
    const renderScene = new THREE.RenderPass(scene, camera);
    const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.2;
    bloomPass.strength = 1.8; // High glow for the portals
    bloomPass.radius = 0.8;

    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
}

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// ==========================================================================
//   Create Data Tunnel & Portals (Hurdles)
// ==========================================================================

// 1. Particle Tunnel (Speed lines) - Lower particle count on mobile
const tunnelGeo = new THREE.BufferGeometry();
const tunnelCount = isMobile ? 300 : 1000;
const tunnelPos = new Float32Array(tunnelCount * 3);

for (let i = 0; i < tunnelCount * 3; i += 3) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 10 + Math.random() * 10; // Hollow center for camera to fly through
    tunnelPos[i] = Math.cos(angle) * radius;
    tunnelPos[i + 1] = Math.sin(angle) * radius;
    tunnelPos[i + 2] = 20 - Math.random() * 300; // Deep Z-axis scattering
}
tunnelGeo.setAttribute('position', new THREE.BufferAttribute(tunnelPos, 3));
const tunnelMat = new THREE.PointsMaterial({
    size: 0.1,
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending
});
const tunnelMesh = new THREE.Points(tunnelGeo, tunnelMat);
scene.add(tunnelMesh);

// 2. Portals / Hurdles
// Array to store portal meshes
const portals = [];
const numPortals = 5;
const portalSpacing = 50; // Distance between portals on Z axis

for (let i = 0; i < numPortals; i++) {
    // We create a glowing square frame using Box geometries
    const frameGroup = new THREE.Group();

    const mat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x00f0ff : 0x8a2be2, // Alternate Cyan and Purple
        emissive: i % 2 === 0 ? 0x00f0ff : 0x8a2be2,
        emissiveIntensity: 2,
        wireframe: true
    });

    // Top, Bottom, Left, Right segments to form a square portal
    const thickness = 0.5;
    const size = 12;

    const horizGeo = new THREE.BoxGeometry(size, thickness, thickness);
    const vertGeo = new THREE.BoxGeometry(thickness, size, thickness);

    const top = new THREE.Mesh(horizGeo, mat);
    top.position.y = size / 2;
    const bottom = new THREE.Mesh(horizGeo, mat);
    bottom.position.y = -size / 2;
    const left = new THREE.Mesh(vertGeo, mat);
    left.position.x = -size / 2;
    const right = new THREE.Mesh(vertGeo, mat);
    right.position.x = size / 2;

    frameGroup.add(top, bottom, left, right);

    // Position the portal
    frameGroup.position.z = - (i * portalSpacing);

    // Add point light at the portal
    const pLight = new THREE.PointLight(i % 2 === 0 ? 0x00f0ff : 0x8a2be2, 1, 30);
    frameGroup.add(pLight);

    scene.add(frameGroup);
    portals.push(frameGroup);
}

// Mouse Interaction for subtle look-around
let mouseX = 0;
let mouseY = 0;
const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;

document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX - windowHalfX) * 0.005;
    mouseY = (event.clientY - windowHalfY) * 0.005;
});

// Render Loop
function animate() {
    requestAnimationFrame(animate);

    // Subtle look-around based on mouse
    camera.rotation.y += (mouseX - camera.rotation.y) * 0.05;
    camera.rotation.x += (-mouseY - camera.rotation.x) * 0.05;

    // Rotate portals slightly for effect
    portals.forEach(p => {
        p.rotation.z += 0.002;
    });

    // Move tunnel particles to simulate continuous speed
    const positions = tunnelMesh.geometry.attributes.position.array;
    for (let i = 2; i < tunnelCount * 3; i += 3) {
        positions[i] += 0.2;
        if (positions[i] > camera.position.z + 10) {
            positions[i] = camera.position.z - 200; // recycle particles deep back
        }
    }
    tunnelMesh.geometry.attributes.position.needsUpdate = true;

    updateActiveScene();

    if (composer && !isMobile) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
}

// Resize handling: throttle to avoid layout/GPU thrashing on mobile browser address bar scroll toggles
let lastWidth = window.innerWidth;
window.addEventListener('resize', () => {
    // Only resize if the width changed (address bar show/hide on mobile changes height but not width)
    if (isMobile && window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
    }
});

// ==========================================================================
//   GSAP Scroll Fly-Through & UI Crossfading
// ==========================================================================

gsap.registerPlugin(ScrollTrigger);

// 1. Camera Fly-Through Timeline
// Scroll height is 500vh (0 to 1 progress)
// Camera travels from Z=10 down to Z=-200
const maxTravel = - (numPortals - 1) * portalSpacing - 10; // ~ -210

gsap.to(camera.position, {
    z: maxTravel,
    ease: "none",
    scrollTrigger: {
        trigger: "#scroll-container",
        start: "top top",
        end: "bottom bottom",
        scrub: 1
    }
});

// 2. UI Scene Crossfading logic
const scenes = document.querySelectorAll('.scene');
let lastActiveIndex = -1;

// Function to update active scene based on camera Z position (run on every animation frame for perfect synchronization)
function updateActiveScene() {
    const camZ = camera.position.z;

    // Determine which portal we are nearest to based on Z
    // Portals are at 0, -50, -100, -150, -200
    // If camZ is between 10 and -25, we are at portal 0 (Hero)
    // If camZ is between -25 and -75, we are at portal 1 (About)

    let activeIndex = 0;
    if (camZ <= -25 && camZ > -75) activeIndex = 1;
    else if (camZ <= -75 && camZ > -125) activeIndex = 2;
    else if (camZ <= -125 && camZ > -175) activeIndex = 3;
    else if (camZ <= -175) activeIndex = 4;

    if (activeIndex !== lastActiveIndex) {
        lastActiveIndex = activeIndex;
        scenes.forEach((scene, index) => {
            if (index === activeIndex) {
                scene.classList.add('active-scene');
                triggerSceneSpecificLogic(index);
            } else {
                scene.classList.remove('active-scene');
            }
        });
    }
}

// 3. Scene-Specific Logic (Typing and SVG)
let typed = false;

// Audio context for terminal sound
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function playTypingSound() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'square';
    // Randomize frequency slightly for a "computing" sound
    oscillator.frequency.setValueAtTime(400 + Math.random() * 200, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime); // Very low volume
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.05);
}

function triggerSceneSpecificLogic(index) {
    // Scene 2: Terminal Typing
    if (index === 1 && !typed) {
        typed = true;
        const terminalBody = document.getElementById('typing-terminal');
        const terminalText = `
> System boot initialized... [OK]
> Loading profile: Pasith Ahamed J... [OK]
> Role: IT Support & Network Professional
> Status: Highly Motivated
> Loading modules:
  - Hardware Installation & Diagnostics
  - Software Deployment
  - LAN/WAN Config & Cisco ASA Firewall
  - Ticketing System Management
> Establishing secure network operations... [SUCCESS]
> Ready for input_
`;
        terminalBody.innerHTML = '';
        let i = 0;
        function typeWriter() {
            if (i < terminalText.length) {
                // Play sound for visible characters, skip whitespace
                if (terminalText.charAt(i).trim() !== '') {
                    playTypingSound();
                }

                terminalBody.innerHTML += terminalText.charAt(i) === '\n' ? '<br>' : terminalText.charAt(i);
                i++;
                setTimeout(typeWriter, 15);
            } else {
                terminalBody.innerHTML += '<span class="cursor"></span>';
            }
        }
        typeWriter();
    }

    // Scene 4: Skill Rings
    if (index === 3) {
        const circles = document.querySelectorAll('.progress');
        circles.forEach(circle => {
            const radius = circle.r.baseVal.value;
            const circumference = radius * 2 * Math.PI;
            circle.style.strokeDasharray = `${circumference} ${circumference}`;
            const percent = circle.getAttribute('data-percent');
            const offset = circumference - (percent / 100) * circumference;

            if (!circle.style.strokeDashoffset || circle.style.strokeDashoffset == "") {
                circle.style.strokeDashoffset = circumference;
                setTimeout(() => {
                    circle.style.strokeDashoffset = offset;
                }, 100);
            }
        });
    }
}

// ==========================================================================
//   AI Assistant Guided Tour Logic
// ==========================================================================

const aiWidget = document.getElementById('ai-assistant');
const aiSpeech = document.getElementById('ai-speech');
let tourActive = false;
let currentTourIndex = 0;

const aiDialogues = [
    "Welcome! I am JUMAPAPAS. I'll be your guide through Pasith's digital portfolio.",
    "Here is Pasith's core processing unit. He specializes in IT and Network infrastructure.",
    "These are his execution logs. Notice his experience in technical support and workflow optimization at Integra.",
    "System modules are functioning at high capacity. His capabilities include Network Config, Linux, and Cyber Security.",
    "Tour complete. Thank you for visiting! I have successfully established a secure connection terminal. Pasith is ready to collaborate—feel free to initiate contact."
];

// Initialize speech synthesis voice - optimized to guarantee a female voice on both desktop and mobile (especially Android Google TTS and iOS Safari)
let assistantVoice = null;

function selectFemaleVoice() {
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return;

    // Filter English voices since the portfolio text is in English
    const engVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
    const candidateVoices = engVoices.length > 0 ? engVoices : voices;
    
    // List of keywords and language codes indicating male voices to exclude
    const maleKeywords = ['male', 'david', 'george', 'ravi', 'daniel', 'alex', 'iom', 'rgc', 'gdm', 'chf', 'rjd', 'wjd', 'jit', 'mim', 'nhg', 'kgh'];
    
    // Explicit female voice indicators (names and Google TTS locale codes)
    const femaleKeywords = ['female', 'zira', 'samantha', 'victoria', 'karen', 'tessa', 'moira', 'fiona', 'hazel', 'sfg', 'tpf', 'fis', 'rfs', 'ahp', 'cne', 'ene', 'gfm', 'susan'];

    // 1. First priority: Find a candidate voice that matches a female keyword and is NOT male
    let chosenVoice = candidateVoices.find(v => {
        const name = v.name.toLowerCase();
        return femaleKeywords.some(keyword => name.includes(keyword)) && 
               !maleKeywords.some(keyword => name.includes(keyword));
    });

    // 2. Second priority: Find any candidate voice that is NOT male
    if (!chosenVoice) {
        chosenVoice = candidateVoices.find(v => {
            const name = v.name.toLowerCase();
            return !maleKeywords.some(keyword => name.includes(keyword));
        });
    }

    // 3. Fallback: Any English voice, then the absolute first voice
    if (!chosenVoice) {
        chosenVoice = engVoices[0] || voices[0];
    }

    assistantVoice = chosenVoice;
}

// Run immediately and handle lazy voice loading on mobile Chrome/Safari
selectFemaleVoice();
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = selectFemaleVoice;
}

function typeAI(text, callback, delay = 2000) {
    aiSpeech.innerHTML = '';

    // Speak the text
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Stop any current speech
        
        // Always select the best female voice right before speaking to prevent lazy loading issues
        selectFemaleVoice();
        
        const utterance = new SpeechSynthesisUtterance(text);
        if (assistantVoice) utterance.voice = assistantVoice;
        utterance.pitch = 1.1; // Slightly higher pitch for AI feel
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }

    let i = 0;
    function type() {
        if (i < text.length) {
            aiSpeech.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, 30);
        } else if (callback) {
            setTimeout(callback, delay);
        }
    }
    type();
}

document.getElementById('start-tour-btn').addEventListener('click', () => {
    if (tourActive) return;
    tourActive = true;

    // Show AI Widget
    aiWidget.classList.remove('hidden');

    // Start Tour Sequence
    document.getElementById('start-tour-btn').style.display = 'none';

    // Scroll Proxy for auto-scrolling
    const scrollProxy = { y: window.scrollY };
    const maxScroll = document.body.scrollHeight - window.innerHeight;

    // Calculate target scroll positions for each portal
    // We have 5 portals. maxTravel is 210. 
    // Target ratios: 0, 50/210, 100/210, 150/210, 200/210
    const stops = [
        0,
        maxScroll * (50 / 210),
        maxScroll * (100 / 210),
        maxScroll * (150 / 210),
        maxScroll * (200 / 210)
    ];

    function goToNextStop() {
        if (currentTourIndex >= stops.length) {
            typeAI("You have full control now. Navigate freely.");
            tourActive = false;
            return;
        }

        // Only add 7s delay for Experience (index 2) and Skills (index 3). Others use 2s.
        const readDelay = (currentTourIndex === 2 || currentTourIndex === 3) ? 7000 : 2000;

        // Speak dialogue for current stop
        typeAI(aiDialogues[currentTourIndex], () => {
            currentTourIndex++;
            if (currentTourIndex < stops.length) {
                // Move to next stop
                gsap.to(scrollProxy, {
                    y: stops[currentTourIndex],
                    duration: 3,
                    ease: "power2.inOut",
                    onUpdate: () => window.scrollTo(0, scrollProxy.y),
                    onComplete: goToNextStop
                });
            } else {
                tourActive = false;
            }
        }, readDelay);
    }

    // Initialize first stop
    goToNextStop();
});

// Start the animation loop after all variables and functions are initialized
animate();

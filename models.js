let models = []; 
let currentIndex = 0;
const viewer = document.querySelector("#viewer3d");

// DECOUPLED TIMERS
let globalIdleTimer = null;       // Controls the Hand Icon
let cameraIdleTimer = null;       // Controls the 3D Auto-Rotation
let slideTimer = null;            // Controls the 60s auto-slide

const IDLE_DELAY = 3000;       
const SLIDE_DELAY = 60000;     
let savedOrbit = null; 

// --- DRAWING & ANNOTATION SYSTEM ---
const DrawingTool = {
    canvas: null,
    ctx: null,
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    isEraser: false,

    init() {
        this.canvas = document.getElementById('drawingCanvas');
        if(!this.canvas) return;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        document.getElementById('drawBtn')?.addEventListener('click', () => this.toggle(true));
        document.getElementById('closeDrawBtn')?.addEventListener('click', () => this.toggle(false));
        document.getElementById('clearBtn')?.addEventListener('click', () => this.clear());
        document.getElementById('saveBtn')?.addEventListener('click', () => this.saveScreenshot());

        const bgPicker = document.getElementById('drawBgColor');
        if (bgPicker) {
            const updateBg = (e) => {
                const app = document.getElementById('app');
                if(app) app.style.setProperty('background', e.target.value, 'important');
            };
            bgPicker.addEventListener('input', updateBg);
            bgPicker.addEventListener('change', updateBg);
        }

        document.getElementById('eraserBtn')?.addEventListener('click', () => this.setMode(this.isEraser ? 'pen' : 'eraser'));

        // Mouse Events
        this.canvas.addEventListener('mousedown', this.start.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stop.bind(this));
        this.canvas.addEventListener('mouseout', this.stop.bind(this));

        // Touch Events
        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.start(e.touches[0]); }, {passive: false});
        this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this.draw(e.touches[0]); }, {passive: false});
        this.canvas.addEventListener('touchend', this.stop.bind(this));
    },

    resizeCanvas() {
        if(!this.canvas) return;
        
        let tempImg = null;
        if(this.canvas.width > 0 && this.canvas.height > 0) {
            try { tempImg = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height); } catch(e) {}
        }

        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        if(tempImg) this.ctx.putImageData(tempImg, 0, 0);
    },

    toggle(state) {
        const toolbar = document.getElementById('drawingToolbar');
        const dock = document.getElementById('bottomDock');
        const topBar = document.querySelector('.top-ui-bar');
        const colorDock = document.getElementById('colorEditorDock');
        
        if(state) {
            this.canvas.classList.add('active');
            if(toolbar) toolbar.style.display = 'flex';
            if(dock) dock.style.display = 'none';
            if(topBar) topBar.style.display = 'none';
            if(colorDock) colorDock.style.setProperty('display', 'none', 'important');
            
            const indicator = document.getElementById('idleIndicator');
            if(indicator) indicator.classList.remove('visible');

            if(viewer) {
                viewer.cameraControls = false; // Lock 3D Model
                viewer.autoRotate = false;
            }
            
            const app = document.getElementById('app');
            if(app) {
                app.style.setProperty('background', document.getElementById('drawBgColor')?.value || '#1a1a1a', 'important');
            }

            clearTimeout(globalIdleTimer); // Stop hand icon from showing up
            clearTimeout(cameraIdleTimer); // Stop pending rotations
            clearTimeout(slideTimer);      // Stop auto-slides while drawing
            this.resizeCanvas();
        } else {
            this.canvas.classList.remove('active');
            if(toolbar) toolbar.style.display = 'none';
            if(dock) dock.style.display = 'flex';
            if(topBar) topBar.style.display = 'flex';
            if(colorDock) colorDock.style.removeProperty('display'); // Restore Color UI
            
            if(viewer) {
                viewer.cameraControls = true; // Unlock 3D Model
                viewer.autoRotate = true;     // Resume rotation
            }
            
            const app = document.getElementById('app');
            if(app) app.style.removeProperty('background'); // Restore original gradient background

            this.clear();
            this.setMode('pen');
            resetGlobalTimers();
        }
    },

    setMode(mode) {
        const eraserBtn = document.getElementById('eraserBtn');
        
        if (mode === 'eraser') {
            this.isEraser = true;
            if(eraserBtn) eraserBtn.classList.add('active');
        } else {
            this.isEraser = false;
            if(eraserBtn) eraserBtn.classList.remove('active');
        }
    },

    start(e) {
        this.isDrawing = true;
        this.lastX = e.clientX || e.pageX;
        this.lastY = e.clientY || e.pageY;
        resetGlobalTimers();
    },

    draw(e) {
        if(!this.isDrawing) return;
        const x = e.clientX || e.pageX;
        const y = e.clientY || e.pageY;

        this.ctx.globalCompositeOperation = this.isEraser ? 'destination-out' : 'source-over';

        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(x, y);
        this.ctx.strokeStyle = document.getElementById('brushColor').value;
        this.ctx.lineWidth = document.getElementById('brushSize').value;
        this.ctx.stroke();

        this.lastX = x;
        this.lastY = y;
    },

    stop() {
        this.isDrawing = false;
    },

    clear() {
        if(this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    },

    async saveScreenshot() {
        try {
            // 1. Get raw snapshot from 3D Engine
            const viewerBlob = await viewer.toBlob({ idealAspect: false });
            const viewerUrl = URL.createObjectURL(viewerBlob);

            // 2. Prepare the Canvas to Merge them
            const mergeCanvas = document.createElement('canvas');
            mergeCanvas.width = this.canvas.width;
            mergeCanvas.height = this.canvas.height;
            const mCtx = mergeCanvas.getContext('2d');

            const bgColor = document.getElementById('drawBgColor')?.value || '#1a1a1a';
            mCtx.fillStyle = bgColor; 
            mCtx.fillRect(0, 0, mergeCanvas.width, mergeCanvas.height);

            // 3. Bake the Image & Trigger Download
            const img = new Image();
            img.onload = () => {
                mCtx.drawImage(img, 0, 0, mergeCanvas.width, mergeCanvas.height);
                mCtx.drawImage(this.canvas, 0, 0); 

                const link = document.createElement('a');
                link.download = 'ECW-Custom-Design.jpg';
                link.href = mergeCanvas.toDataURL('image/jpeg', 0.9);
                link.click();

                URL.revokeObjectURL(viewerUrl);
            };
            img.src = viewerUrl;
        } catch(e) {
            console.error("Save error:", e);
            alert("Could not save image.");
        }
    }
};

async function initShowroom() {
    const loader = document.getElementById('ecwLoader');
    const fadeOverlay = document.getElementById('fadeOverlay');
    if(loader) loader.classList.add('active');
    if(fadeOverlay) fadeOverlay.classList.add('active');

    try {
        models = [
            {
                src: "models/SUV Seat/SUV seat.glb",
                poster: "https://placehold.co/400x300/222/FFF.png?text=No+Preview",
                variant: "SUV SEAT"
            },
            {
                src: "models/4.0 Seat/4.0.glb",
                poster: "https://placehold.co/400x300/222/FFF.png?text=No+Preview",
                variant: "4.0 SEAT"
            },
            {
                variant: "SOFA SEAT",
                poster: "https://placehold.co/400x300/222/FFF.png?text=No+Preview",
                subVariants: [
                    { name: "4.0", src: "models/Sofa Seat/Sofa_4.0.glb" },
                    { name: "2.0", src: "models/Sofa Seat/Sofa_2.0.glb" }
                ],
                activeSubIndex: 0
            }
        ];

        if (models.length === 0) throw new Error("No valid 3D files found.");

        startApp();

    } catch (error) {
        console.error("Error loading local models:", error);
        if(loader) loader.classList.remove('active');
        if(fadeOverlay) fadeOverlay.classList.remove('active');
    }
}

function startApp() {
    currentIndex = 0; 
    buildVariantButtons();
    buildSubVariantButtons();

    const fadeOverlay = document.getElementById('fadeOverlay');
    const loader = document.getElementById('ecwLoader');

    const onModelLoad = () => {
        // 1. Analyze and apply target colors instantly
        if (typeof ColorEngine !== 'undefined') {
            try { ColorEngine.analyze(viewer); } catch(e) {}
        }
        // 2. Wait a split second for the colors to render before revealing the screen
        setTimeout(() => {
            if(fadeOverlay) fadeOverlay.classList.remove('active');
            if(loader) loader.classList.remove('active');
            resetGlobalTimers(); 
        }, 50);
        viewer.removeEventListener('load', onModelLoad);
    };
    viewer.addEventListener('load', onModelLoad);

    loadModelData(currentIndex);
    setupEvents();
    DrawingTool.init();
    
    // Kick off the global timers immediately
    resetGlobalTimers(); 
}

function buildVariantButtons() {
    const panel = document.getElementById("variantPanel");
    if(!panel) return;
    panel.innerHTML = "";
    
    models.forEach((m, index) => {
        const btn = document.createElement("button");
        btn.className = "tone-btn";
        btn.innerText = m.variant;
        btn.dataset.index = index;
        btn.onclick = () => transitionToModel(index);
        panel.appendChild(btn);
    });
}

function updateVariantButtons() {
    const panel = document.getElementById("variantPanel");
    if(!panel) return;
    panel.querySelectorAll(".tone-btn").forEach(btn => {
        if(parseInt(btn.dataset.index) === currentIndex) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}

function buildSubVariantButtons() {
    const subBar = document.getElementById("subVariantBar");
    const subPanel = document.getElementById("subVariantPanel");
    if (!subBar || !subPanel) return;
    
    subPanel.innerHTML = "";
    const m = models[currentIndex];
    
    if (m.subVariants && m.subVariants.length > 0) {
        subBar.style.display = "flex";
        m.subVariants.forEach((sub, sIndex) => {
            const btn = document.createElement("button");
            btn.className = "tone-btn";
            btn.innerText = sub.name;
            if (sIndex === (m.activeSubIndex || 0)) btn.classList.add("active");
            btn.onclick = () => transitionToSubVariant(sIndex);
            subPanel.appendChild(btn);
        });
    } else {
        subBar.style.display = "none";
    }
}

function transitionToModel(index) {
    if (index === currentIndex) return;

    const fadeOverlay = document.getElementById('fadeOverlay');
    const loader = document.getElementById('ecwLoader');
    
    if (typeof ColorEngine !== 'undefined') ColorEngine.reset();

    if (viewer) {
        const orbit = viewer.getCameraOrbit();
        savedOrbit = { theta: orbit.theta, phi: orbit.phi };
    }

    fadeOverlay.classList.add('active');
    loader.classList.add('active'); 

    setTimeout(() => {
        currentIndex = index;
        buildSubVariantButtons();

        // Wait for the new model to be 100% loaded before hiding the loading screen
        const onModelLoad = () => {
            // 1. Analyze and apply target colors instantly
            if (typeof ColorEngine !== 'undefined') {
                try { ColorEngine.analyze(viewer); } catch(e) {}
            }
            // 2. Wait a split second for the colors to render before revealing the screen
            setTimeout(() => {
                fadeOverlay.classList.remove('active');
                loader.classList.remove('active');
                resetGlobalTimers(); 
            }, 50);
            viewer.removeEventListener('load', onModelLoad); // Clean up event after firing
        };
        viewer.addEventListener('load', onModelLoad);

        loadModelData(currentIndex);

    }, 250); 
}

function transitionToSubVariant(subIndex) {
    const m = models[currentIndex];
    if (m.activeSubIndex === subIndex) return;

    const fadeOverlay = document.getElementById('fadeOverlay');
    const loader = document.getElementById('ecwLoader');
    
    if (typeof ColorEngine !== 'undefined') ColorEngine.reset();

    if (viewer) {
        const orbit = viewer.getCameraOrbit();
        savedOrbit = { theta: orbit.theta, phi: orbit.phi };
    }

    fadeOverlay.classList.add('active');
    loader.classList.add('active'); 

    setTimeout(() => {
        m.activeSubIndex = subIndex;
        buildSubVariantButtons();

        const onModelLoad = () => {
            if (typeof ColorEngine !== 'undefined') {
                try { ColorEngine.analyze(viewer); } catch(e) {}
            }
            setTimeout(() => {
                fadeOverlay.classList.remove('active');
                loader.classList.remove('active');
                resetGlobalTimers(); 
            }, 50);
            viewer.removeEventListener('load', onModelLoad);
        };
        viewer.addEventListener('load', onModelLoad);

        loadModelData(currentIndex);
    }, 250); 
}

function loadModelData(index) {
    if (!models[index]) return;
    const data = models[index];

    if(viewer) {
        viewer.poster = data.poster; 

        let finalSrc = data.src;
        if (data.subVariants) {
            finalSrc = data.subVariants[data.activeSubIndex || 0].src;
        }

        viewer.src = finalSrc;
        
        if (savedOrbit) {
            viewer.cameraOrbit = `${savedOrbit.theta}rad ${savedOrbit.phi}rad auto`;
        } else {
            viewer.cameraOrbit = "auto auto auto";
        }
        viewer.autoRotate = true; 
    }
    updateVariantButtons();
}

// -----------------------------------------------------
// DECOUPLED UX EVENT ARCHITECTURE
// -----------------------------------------------------
function setupEvents() {
    document.getElementById("fsBtn").onclick = () => {
        const app = document.getElementById("app");
        !document.fullscreenElement ? app.requestFullscreen() : document.exitFullscreen();
    };

    // 1. GLOBAL INTERACTION: Hides Hand Icon, resets slide timer. Does NOT affect 3D rotation.
    // Replaced 'pointermove' with 'mousemove/touchstart' to prevent hyper-sensitive jitter bugs.
    ['mousemove', 'mousedown', 'touchstart', 'keydown'].forEach(evt => {
        window.addEventListener(evt, resetGlobalTimers);
    });

    if(viewer) {
        // 2. 3D SPECIFIC INTERACTION: Stops seat rotation. Resumes after 3s of letting go.
        viewer.addEventListener('camera-change', (e) => {
            if (e.detail.source === 'user-interaction') {
                const drawCanvas = document.getElementById('drawingCanvas');
                if (drawCanvas && drawCanvas.classList.contains('active')) return; // Strictly block camera logic during draw mode

                resetGlobalTimers(); // Prevent auto-slide while actively rotating the model

                // Stop spinning
                viewer.autoRotate = false;
                
                // Also instantly hide the hand icon when dragging the seat
                const indicator = document.getElementById('idleIndicator');
                if (indicator) indicator.classList.remove('visible');

                // 3D Resume Timer (3 seconds after they stop dragging)
                clearTimeout(cameraIdleTimer);
                cameraIdleTimer = setTimeout(() => {
                    const drawCanvas = document.getElementById('drawingCanvas');
                    if (drawCanvas && drawCanvas.classList.contains('active')) return; // Don't resume if drawing

                    viewer.autoRotate = true;
                    // Gently correct the vertical pitch so the seat looks good again
                    const currentOrbit = viewer.getCameraOrbit();
                    viewer.cameraOrbit = `${currentOrbit.theta}rad 75deg auto`;
                }, IDLE_DELAY);
            }
        });

        // 4. ERROR HANDLING (Helps debug missing 3D files)
        viewer.addEventListener('error', (error) => {
            console.error("Model Viewer Error:", error);
            let alertSrc = models[currentIndex].src;
            if (models[currentIndex].subVariants) {
                alertSrc = models[currentIndex].subVariants[models[currentIndex].activeSubIndex || 0].src;
            }
            alert("⚠️ Cannot load the 3D file!\n\nTrying to load: " + alertSrc + "\n\n1. If Windows hides extensions, you may have accidentally named it 'seat2.glb.glb'.\n2. Open your 'models' folder, right-click the file, click 'Properties', and check the exact name.\n3. Make sure the file size is not 0 bytes.");
            viewer.autoRotate = true; // Resume spinning the old model
            
            // Hide the loading screen if an error occurs so the user isn't stuck
            document.getElementById('fadeOverlay').classList.remove('active');
            document.getElementById('ecwLoader').classList.remove('active');
        });
    }
}

// Triggers whenever the mouse moves ANYWHERE on the screen (UI, buttons, background)
function resetGlobalTimers() {
    const drawCanvas = document.getElementById('drawingCanvas');
    
    // If the user is currently drawing, strictly pause ALL background presentation timers!
    if (drawCanvas && drawCanvas.classList.contains('active')) {
        clearTimeout(globalIdleTimer);
        clearTimeout(slideTimer);
        return; 
    }

    const indicator = document.getElementById('idleIndicator');
    
    // Instantly hide the hand icon
    if(indicator && indicator.classList.contains('visible')) {
        indicator.classList.remove('visible');
    }
    
    // UI Timer: Bring the hand icon back ONLY if absolutely no mouse movement happens for 3 seconds
    clearTimeout(globalIdleTimer);
    globalIdleTimer = setTimeout(() => {
        const drawCanvas = document.getElementById('drawingCanvas');
        if (drawCanvas && drawCanvas.classList.contains('active')) return; // Prevent hand icon while drawing

        if(indicator) {
            indicator.classList.add('visible');
        }
    }, IDLE_DELAY);

    // Slide Timer: Don't advance to the next seat if they are busy tweaking colors
    clearTimeout(slideTimer);
    slideTimer = setTimeout(() => {
        const drawCanvas = document.getElementById('drawingCanvas');
        if (drawCanvas && drawCanvas.classList.contains('active')) return; // Don't slide if drawing

        if(models.length > 1) {
            transitionToModel((currentIndex + 1) % models.length);
        }
    }, SLIDE_DELAY);
}

initShowroom();

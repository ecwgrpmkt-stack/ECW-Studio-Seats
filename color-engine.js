/**
 * ECW Studio - Real-Time RGB Auto-Parsing Color Engine
 */
const ColorEngine = {
    viewer: null,
    seat1Materials: [],
    seat2Materials: [],
    stitchMaterials: [],
    
    // UI Elements
    seat1Picker: null,
    seat1Hex: null,
    seat2Picker: null,
    seat2Hex: null,
    stitchPicker: null,
    stitchHex: null,
    brightnessSlider: null,
    
    // Reset Buttons
    resetSeat1Btn: null,
    resetSeat2Btn: null,
    resetStitchBtn: null,
    resetBrightnessBtn: null,

    // State Memory (To remember original colors)
    initialSeat1Hex: "#000000",
    initialSeat2Hex: "#555555",
    initialStitchHex: "#000000",

    isInitialized: false,

    init() {
        this.seat1Picker = document.getElementById("seat1ColorPicker");
        this.seat1Hex = document.getElementById("seat1HexDisplay");
        this.seat2Picker = document.getElementById("seat2ColorPicker");
        this.seat2Hex = document.getElementById("seat2HexDisplay");
        this.stitchPicker = document.getElementById("stitchColorPicker");
        this.stitchHex = document.getElementById("stitchHexDisplay");
        this.brightnessSlider = document.getElementById("brightnessSlider");
        
        this.resetSeat1Btn = document.getElementById("resetSeat1Btn");
        this.resetSeat2Btn = document.getElementById("resetSeat2Btn");
        this.resetStitchBtn = document.getElementById("resetStitchBtn");
        this.resetBrightnessBtn = document.getElementById("resetBrightnessBtn");

        this.bindEvents();
        this.isInitialized = true;
    },

    rgbArrayToHex(rgbArray) {
        const r = Math.round(rgbArray[0] * 255).toString(16).padStart(2, '0');
        const g = Math.round(rgbArray[1] * 255).toString(16).padStart(2, '0');
        const b = Math.round(rgbArray[2] * 255).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`.toUpperCase();
    },

    hexToNormalizedRGB(hex) {
        hex = hex.replace(/^#/, '');
        let r = parseInt(hex.substring(0, 2), 16) / 255;
        let g = parseInt(hex.substring(2, 4), 16) / 255;
        let b = parseInt(hex.substring(4, 6), 16) / 255;
        return [r, g, b, 1.0];
    },

    analyze(viewer) {
        this.viewer = viewer;
        if (!this.isInitialized) this.init();
        if (!viewer || !viewer.model || !viewer.model.materials) return;

        this.seat1Materials = [];
        this.seat2Materials = [];
        this.stitchMaterials = [];

        const materials = viewer.model.materials;
        
        // Exclude un-paintable parts strictly (tailored for vehicle seats)
        const ignoreList = ['plastic', 'metal', 'rail', 'bracket', 'lever', 'frame', 'rest', 'under', 'slider', 'wire', 'mechanism'];
        
        // Stitch Keywords: Highest priority for stitches and piping
        const stitchKeywords = ['stitch', 'thread', 'piping'];

        // Seat 2 Keywords: Priority for accent, secondary, and two-tone parts
        const seat2Keywords = ['back leather', 'part2', 'secondary', 'accent', 'insert', 'seat2'];

        // Seat 1 Keywords: Catch all main seat body parts
        const seat1Keywords = ['front leather', 'part1', 'fabric', 'seat', 'main', 'primary', 'leather', 'base', 'seat1'];

        materials.forEach(mat => {
            const matName = (mat.name || "").toLowerCase();
            const isIgnored = ignoreList.some(word => matName && matName.includes(word));
            
            if (isIgnored || !mat.pbrMetallicRoughness || !mat.pbrMetallicRoughness.baseColorFactor) return;

            // Assign to layers strictly based on keyword matches
            if (matName && stitchKeywords.some(word => matName.includes(word))) {
                this.stitchMaterials.push(mat);
            } else if (matName && seat2Keywords.some(word => matName.includes(word))) {
                this.seat2Materials.push(mat);
            } else if (matName && seat1Keywords.some(word => matName.includes(word))) {
                this.seat1Materials.push(mat);
            }
        });

        const seat1Module = this.seat1Picker ? this.seat1Picker.closest('.rgb-picker-module') : null;
        if (this.seat1Materials.length > 0) {
            if (seat1Module) seat1Module.style.display = 'block';
            this.initialSeat1Hex = "#000000"; 
            
            this.seat1Picker.value = this.initialSeat1Hex;
            this.seat1Hex.innerText = this.initialSeat1Hex;
            this.seat1Picker.disabled = false;
            
            const rgba = this.hexToNormalizedRGB(this.initialSeat1Hex);
            this.seat1Materials.forEach(mat => mat.pbrMetallicRoughness.setBaseColorFactor(rgba));
        } else {
            if (seat1Module) seat1Module.style.display = 'none';
        }

        const seat2Module = this.seat2Picker ? this.seat2Picker.closest('.rgb-picker-module') : null;
        if (this.seat2Materials.length > 0) {
            if (seat2Module) seat2Module.style.display = 'block';
            this.initialSeat2Hex = "#270202"; 
            
            this.seat2Picker.value = this.initialSeat2Hex;
            this.seat2Hex.innerText = this.initialSeat2Hex;
            this.seat2Picker.disabled = false;
            
            const rgba = this.hexToNormalizedRGB(this.initialSeat2Hex);
            this.seat2Materials.forEach(mat => mat.pbrMetallicRoughness.setBaseColorFactor(rgba));
        } else {
            if (seat2Module) seat2Module.style.display = 'none';
        }

        const stitchModule = this.stitchPicker ? this.stitchPicker.closest('.rgb-picker-module') : null;
        if (this.stitchMaterials.length > 0) {
            if (stitchModule) stitchModule.style.display = 'block';
            this.initialStitchHex = "#FFFFFF"; 
            
            this.stitchPicker.value = this.initialStitchHex;
            this.stitchHex.innerText = this.initialStitchHex;
            this.stitchPicker.disabled = false;
            
            const rgba = this.hexToNormalizedRGB(this.initialStitchHex);
            this.stitchMaterials.forEach(mat => mat.pbrMetallicRoughness.setBaseColorFactor(rgba));
        }
        
        // Ensure brightness starts at default when analyzing a new model
        this.brightnessSlider.value = "1.0";
        this.viewer.exposure = 1.0;

        // Show dock
        const dock = document.getElementById('colorEditorDock');
        if (dock) {
            dock.classList.remove('hidden');
            dock.classList.add('active');
        }
    },

    bindEvents() {
        // Picker Events
        this.seat1Picker.addEventListener('input', (e) => {
            const hex = e.target.value;
            this.seat1Hex.innerText = hex.toUpperCase();
            const rgba = this.hexToNormalizedRGB(hex);
            requestAnimationFrame(() => {
                this.seat1Materials.forEach(mat => mat.pbrMetallicRoughness.setBaseColorFactor(rgba));
            });
        });

        this.seat2Picker.addEventListener('input', (e) => {
            const hex = e.target.value;
            this.seat2Hex.innerText = hex.toUpperCase();
            const rgba = this.hexToNormalizedRGB(hex);
            requestAnimationFrame(() => {
                this.seat2Materials.forEach(mat => mat.pbrMetallicRoughness.setBaseColorFactor(rgba));
            });
        });

        this.stitchPicker.addEventListener('input', (e) => {
            const hex = e.target.value;
            this.stitchHex.innerText = hex.toUpperCase();
            const rgba = this.hexToNormalizedRGB(hex);
            requestAnimationFrame(() => {
                this.stitchMaterials.forEach(mat => mat.pbrMetallicRoughness.setBaseColorFactor(rgba));
            });
        });

        this.brightnessSlider.addEventListener('input', (e) => {
            if (this.viewer) this.viewer.exposure = parseFloat(e.target.value);
        });

        // Reset Button Events
        this.resetSeat1Btn.addEventListener('click', () => {
            if(this.seat1Materials.length === 0) return;
            this.seat1Picker.value = this.initialSeat1Hex;
            this.seat1Hex.innerText = this.initialSeat1Hex;
            const rgba = this.hexToNormalizedRGB(this.initialSeat1Hex);
            this.seat1Materials.forEach(mat => mat.pbrMetallicRoughness.setBaseColorFactor(rgba));
        });

        this.resetSeat2Btn.addEventListener('click', () => {
            if(this.seat2Materials.length === 0) return;
            this.seat2Picker.value = this.initialSeat2Hex;
            this.seat2Hex.innerText = this.initialSeat2Hex;
            const rgba = this.hexToNormalizedRGB(this.initialSeat2Hex);
            this.seat2Materials.forEach(mat => mat.pbrMetallicRoughness.setBaseColorFactor(rgba));
        });

        this.resetStitchBtn.addEventListener('click', () => {
            if(this.stitchMaterials.length === 0) return;
            this.stitchPicker.value = this.initialStitchHex;
            this.stitchHex.innerText = this.initialStitchHex;
            const rgba = this.hexToNormalizedRGB(this.initialStitchHex);
            this.stitchMaterials.forEach(mat => mat.pbrMetallicRoughness.setBaseColorFactor(rgba));
        });

        this.resetBrightnessBtn.addEventListener('click', () => {
            this.brightnessSlider.value = "1.0";
            if(this.viewer) this.viewer.exposure = 1.0;
        });
    },

    reset() {
        this.seat1Materials = [];
        this.seat2Materials = [];
        this.stitchMaterials = [];
        if (this.seat1Picker) {
            this.seat1Picker.value = "#ffffff";
            this.seat1Hex.innerText = "#FFFFFF";
            this.seat1Picker.disabled = true;
        }
        if (this.seat2Picker) {
            this.seat2Picker.value = "#000000";
            this.seat2Hex.innerText = "#000000";
            this.seat2Picker.disabled = true;
        }
        if (this.stitchPicker) {
            this.stitchPicker.value = "#000000";
            this.stitchHex.innerText = "#000000";
            this.stitchPicker.disabled = true;
        }
        if (this.brightnessSlider) {
            this.brightnessSlider.value = "1.0";
            if(this.viewer) this.viewer.exposure = 1.0;
        }
        
        const dock = document.getElementById('colorEditorDock');
        if (dock) {
            dock.classList.remove('active');
            dock.classList.add('hidden');
        }
    }
};

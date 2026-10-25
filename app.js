// ==========================================
// ⚠️ HARDCODED API KEY (FOR DEMO ONLY)
// Replace the text below with your actual API key
// ==========================================
const HARDCODED_API_KEY = "PASTE_YOUR_GEMINI_API_KEY_HERE"; 

document.addEventListener('DOMContentLoaded', () => {
    
    // --- DOM Elements ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const imagePreview = document.getElementById('image-preview');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    const resultsSection = document.getElementById('results-section');
    const btnCamera = document.getElementById('btn-camera');
    const btnUpload = document.getElementById('btn-upload');
    
    // Camera Modal Elements
    const cameraModal = document.getElementById('camera-modal');
    const cameraVideo = document.getElementById('camera-video');
    const btnCapture = document.getElementById('btn-capture');
    const btnCloseCamera = document.getElementById('btn-close-camera');

    // API Sidebar Elements
    const apiKeyInput = document.getElementById('api-key-input');
    const btnSaveKey = document.getElementById('btn-save-key');
    const btnClearKey = document.getElementById('btn-clear-key');
    const apiStatus = document.getElementById('api-status');

    // Map Elements
    const btnLocate = document.getElementById('btn-locate');
    let map = null;
    let currentMediaStream = null;

    // --- 1. IMAGE UPLOAD & DRAG/DROP ---
    
    btnUpload.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    });

    function processFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const croppedUrl = cropImageToSquare(img);
                loadImageAndAnalyze(croppedUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Canvas utility to crop center 1:1
    function cropImageToSquare(img) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = Math.min(img.width, img.height);
        canvas.width = size;
        canvas.height = size;
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;
        ctx.drawImage(img, startX, startY, size, size, 0, 0, size, size);
        return canvas.toDataURL('image/jpeg', 0.8);
    }

    // --- 2. LIVE CAMERA LOGIC ---

    btnCamera.addEventListener('click', async () => {
        try {
            currentMediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } // Prefer back camera
            });
            cameraVideo.srcObject = currentMediaStream;
            cameraModal.classList.remove('hidden');
        } catch (err) {
            console.error("Camera Error:", err);
            alert("Could not access the camera. Please ensure you have granted permissions and are using HTTPS or localhost.");
        }
    });

    function stopCamera() {
        if (currentMediaStream) {
            currentMediaStream.getTracks().forEach(track => track.stop());
            currentMediaStream = null;
        }
        cameraModal.classList.add('hidden');
    }

    btnCloseCamera.addEventListener('click', stopCamera);

    btnCapture.addEventListener('click', () => {
        if (!currentMediaStream) return;

        const canvas = document.createElement('canvas');
        const size = Math.min(cameraVideo.videoWidth, cameraVideo.videoHeight);
        canvas.width = size;
        canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        const startX = (cameraVideo.videoWidth - size) / 2;
        const startY = (cameraVideo.videoHeight - size) / 2;
        
        ctx.drawImage(cameraVideo, startX, startY, size, size, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        stopCamera();
        loadImageAndAnalyze(dataUrl);
    });

    function loadImageAndAnalyze(imageUrl) {
        imagePreview.src = imageUrl;
        imagePreview.classList.remove('hidden');
        uploadPlaceholder.classList.add('hidden');
        
        resultsSection.classList.remove('hidden');
        document.getElementById('result-object-name').textContent = "Analyzing...";
        document.getElementById('result-category').textContent = "Please wait";
        
        runAIAnalysis(imageUrl);
    }

    // --- 3. REAL AI INTEGRATION (GEMINI) ---

    async function runAIAnalysis(imageUrl) {
        let apiKey = HARDCODED_API_KEY;
        if (apiKey === "PASTE_YOUR_GEMINI_API_KEY_HERE" || apiKey === "") {
            apiKey = localStorage.getItem('geminiApiKey');
        }

        if (!apiKey) {
            apiStatus.textContent = "No API key found. Using mock data...";
            apiStatus.style.color = "var(--accent-orange)";
            await simulateNetworkDelay();
            renderResults(getRandomMockData());
            return;
        }

        try {
            apiStatus.textContent = "Contacting Gemini AI...";
            apiStatus.style.color = "var(--accent-cyan)";

            const base64Data = imageUrl.split(',')[1];

            // UPDATED PROMPT: Restricting to 5 specific categories with definitions
            const payload = {
                contents: [{
                    parts: [
                        { text: `Analyze this image of waste. Categorize it strictly into ONE of these 5 categories based on Indonesian waste management standards:
                        1. "Organic" (Food waste, leaves, biodegradable materials)
                        2. "Inorganic" (Non-recyclable non-organic waste like ceramics, dirty wrappers, rubber)
                        3. "Hazardous (B3)" (Batteries, electronics, chemicals, medical waste)
                        4. "Recyclable" (Clean paper, plastic bottles, glass, metal cans)
                        5. "Residual" (General trash, diapers, heavily soiled items, styrofoam)

                        Return a strict JSON object with the following schema: 
                        { 
                          "object_name": "string (what is the specific item)", 
                          "confidence": number (0-100), 
                          "category": "string (Must be exactly one of: 'Organic', 'Inorganic', 'Hazardous (B3)', 'Recyclable', 'Residual')", 
                          "bin_color": "string (Map directly: Green for Organic, Yellow for Inorganic, Red for Hazardous (B3), Blue for Recyclable, Grey for Residual)", 
                          "preparation_tips": ["string", "string", "string"], 
                          "fun_fact": "string", 
                          "recycling_ideas": ["string", "string"] 
                        }. Do not include markdown formatting or backticks. Return ONLY the raw JSON.` },
                        { inline_data: { mime_type: "image/jpeg", data: base64Data } }
                    ]
                }],
                generationConfig: {
                    response_mime_type: "application/json"
                }
            };

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message || "API Error");
            }

            const data = await response.json();
            let jsonText = data.candidates[0].content.parts[0].text;
            jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
            const resultData = JSON.parse(jsonText);
            
            apiStatus.textContent = "Analysis complete!";
            apiStatus.style.color = "var(--accent-emerald)";
            renderResults(resultData);

        } catch (error) {
            console.error("AI Error:", error);
            apiStatus.textContent = `Error: ${error.message}. Falling back to mock.`;
            apiStatus.style.color = "var(--accent-red)";
            
            await simulateNetworkDelay();
            renderResults(getRandomMockData());
        }
    }

    function simulateNetworkDelay() {
        return new Promise(resolve => setTimeout(resolve, 1500));
    }

    // --- 4. DYNAMIC RENDERING ---

    function renderResults(data) {
        document.getElementById('result-image').src = imagePreview.src;
        document.getElementById('result-object-name').textContent = data.object_name;
        document.getElementById('result-category').textContent = data.category;
        
        document.getElementById('result-confidence-text').textContent = `${data.confidence}%`;
        const progressBar = document.getElementById('result-confidence-bar');
        progressBar.style.width = '0%';
        setTimeout(() => { progressBar.style.width = `${data.confidence}%`; }, 100);

        const binBadge = document.getElementById('result-bin-badge');
        const binText = document.getElementById('result-bin-text');
        binText.textContent = `${data.bin_color} Bin`;
        
        // UPDATED COLOR MAP: Strictly matching the 5 categories
        const colorMap = {
            'Green': '#10b981',   // Organic
            'Yellow': '#eab308',  // Inorganic
            'Red': '#ef4444',     // Hazardous (B3)
            'Blue': '#3b82f6',    // Recyclable
            'Grey': '#94a3b8',    // Residual
            'Gray': '#94a3b8'     // Fallback US spelling
        };
        const binColor = colorMap[data.bin_color] || '#94a3b8';
        
        binBadge.style.backgroundColor = `${binColor}20`;
        binBadge.style.color = binColor;
        binBadge.style.border = `1px solid ${binColor}`;

        const checklist = document.getElementById('result-checklist');
        checklist.innerHTML = '';
        data.preparation_tips.forEach((tip, index) => {
            const li = document.createElement('li');
            li.innerHTML = `<input type="checkbox" id="tip-${index}"><span>${tip}</span>`;
            checklist.appendChild(li);
        });

        document.getElementById('result-fun-fact').textContent = data.fun_fact;

        const ideasGrid = document.getElementById('result-ideas');
        ideasGrid.innerHTML = '';
        data.recycling_ideas.forEach(idea => {
            const div = document.createElement('div');
            div.className = 'idea-card';
            div.innerHTML = `<p>${idea}</p>`;
            ideasGrid.appendChild(div);
        });

        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // --- 5. EXPANDED MOCK DATA ENGINE (Aligned to 5 Categories) ---

    function getRandomMockData() {
        const mocks = [
            // 1. Recyclable (Blue)
            {
                "object_name": "Crushed Plastic Water Bottle",
                "confidence": 92,
                "category": "Recyclable",
                "bin_color": "Blue",
                "preparation_tips": ["Rinse out liquid residue", "Compress the bottle tightly", "Remove and separate the plastic cap"],
                "fun_fact": "Recycling a single plastic bottle saves enough energy to power a lightbulb for up to 3 hours.",
                "recycling_ideas": ["Transform into a self-watering plant pot.", "Cut and smooth edges to create a desk pen holder.", "Collect caps for community art installations."]
            },
            // 2. Organic (Green)
            {
                "object_name": "Banana Peel",
                "confidence": 98,
                "category": "Organic",
                "bin_color": "Green",
                "preparation_tips": ["Remove any plastic stickers", "Chop into smaller pieces to speed up composting", "Keep separate from dry recyclables"],
                "fun_fact": "Banana peels decompose in just 3-4 weeks, returning valuable nutrients to the soil.",
                "recycling_ideas": ["Use as a natural fertilizer for tomato plants.", "Blend with water for a DIY plant spray.", "Use the inside to polish leather shoes."]
            },
            // 3. Hazardous (B3) (Red)
            {
                "object_name": "Used AA Battery",
                "confidence": 91,
                "category": "Hazardous (B3)",
                "bin_color": "Red",
                "preparation_tips": ["Tape the ends with clear tape to prevent sparks", "Do not puncture or crush", "Store in a cool, dry place until drop-off"],
                "fun_fact": "Batteries contain heavy metals that can leach into the soil and contaminate groundwater if thrown in regular trash.",
                "recycling_ideas": ["Look for specialized battery drop-off bins at electronics stores.", "Check if your local municipality has a hazardous waste day."]
            },
            // 4. Residual (Grey)
            {
                "object_name": "Used Baby Diaper",
                "confidence": 85,
                "category": "Residual",
                "bin_color": "Grey",
                "preparation_tips": ["Roll up tightly and secure with the adhesive tabs", "Wrap in a plastic bag to contain odors", "Place in general residual waste bin"],
                "fun_fact": "Disposable diapers take up to 500 years to decompose in a landfill and cannot be recycled.",
                "recycling_ideas": ["Consider switching to cloth diapers to reduce waste.", "Look for local programs that compost diapers (very rare)."]
            },
            // 5. Inorganic (Yellow)
            {
                "object_name": "Broken Ceramic Mug",
                "confidence": 87,
                "category": "Inorganic",
                "bin_color": "Yellow",
                "preparation_tips": ["Wrap sharp pieces in newspaper for safety", "Do NOT put in glass recycling (different melting point)", "Place in inorganic waste bin"],
                "fun_fact": "Ceramics melt at a much higher temperature than glass, meaning they can ruin an entire batch of recycled glass.",
                "recycling_ideas": ["Use broken pieces for mosaic art.", "Crush into small pieces for drainage in plant pots.", "Use the handle as a small tool."]
            },
            // 6. Recyclable (Blue)
            {
                "object_name": "Stack of Newspapers",
                "confidence": 94,
                "category": "Recyclable",
                "bin_color": "Blue",
                "preparation_tips": ["Keep dry and clean", "Remove any plastic delivery bags", "Do not tie with string or wire"],
                "fun_fact": "A single sheet of newspaper can be recycled up to 7 times before the fibers become too short.",
                "recycling_ideas": ["Use for cleaning windows (no streaks!).", "Create DIY paper mache crafts.", "Use as biodegradable wrapping paper."]
            },
            // 7. Hazardous (B3) (Red)
            {
                "object_name": "Old Smartphone",
                "confidence": 89,
                "category": "Hazardous (B3)",
                "bin_color": "Red",
                "preparation_tips": ["Factory reset the device to erase data", "Remove the SIM and SD cards", "Do not throw in regular trash"],
                "fun_fact": "E-waste contains precious metals like gold and silver that can be recovered and reused.",
                "recycling_ideas": ["Use as a dedicated dashcam or security camera.", "Turn it into a digital photo frame.", "Donate it to local electronics recycling programs."]
            },
            // 8. Residual (Grey)
            {
                "object_name": "Styrofoam Food Container",
                "confidence": 88,
                "category": "Residual",
                "bin_color": "Grey",
                "preparation_tips": ["Scrape out food residue", "Rinse if possible", "Place in general residual bin (not recyclable)"],
                "fun_fact": "Styrofoam is notoriously difficult to recycle and can take over 500 years to break down.",
                "recycling_ideas": ["Reuse as a paint palette for DIY projects.", "Use as packing material for shipping.", "Avoid buying styrofoam in the future."]
            },
            // 9. Organic (Green)
            {
                "object_name": "Vegetable Scraps",
                "confidence": 96,
                "category": "Organic",
                "bin_color": "Green",
                "preparation_tips": ["Remove any plastic packaging or rubber bands", "Chop into smaller pieces", "Add to compost bin"],
                "fun_fact": "Composting vegetable scraps creates nutrient-rich soil that reduces the need for chemical fertilizers.",
                "recycling_ideas": ["Make homemade vegetable broth.", "Use as feed for backyard chickens or worms.", "Blend into a liquid fertilizer."]
            },
            // 10. Recyclable (Blue)
            {
                "object_name": "Aluminum Soda Can",
                "confidence": 96,
                "category": "Recyclable",
                "bin_color": "Blue",
                "preparation_tips": ["Empty any remaining liquid", "Rinse quickly to prevent pests", "Crush to save space in the bin"],
                "fun_fact": "Recycling aluminum saves 95% of the energy needed to make new aluminum from raw ore.",
                "recycling_ideas": ["Cut into strips to make a decorative lantern.", "Use as miniature plant pots.", "Create a DIY bird feeder."]
            },
            // 11. Hazardous (B3) (Red)
            {
                "object_name": "Empty Aerosol Spray Can",
                "confidence": 90,
                "category": "Hazardous (B3)",
                "bin_color": "Red",
                "preparation_tips": ["Ensure the can is completely empty", "Do not puncture or crush the can", "Check if your local hazardous waste facility accepts them"],
                "fun_fact": "Aerosol cans are pressurized and can explode if punctured or incinerated.",
                "recycling_ideas": ["Check if your local scrap yard accepts them.", "Use the empty can for a DIY spray paint project."]
            },
            // 12. Inorganic (Yellow)
            {
                "object_name": "Dirty Plastic Wrapper",
                "confidence": 83,
                "category": "Inorganic",
                "bin_color": "Yellow",
                "preparation_tips": ["Wipe off excess food or grease", "Do not put in recyclable bin (too dirty)", "Place in inorganic waste bin"],
                "fun_fact": "Dirty plastic wrappers are often too contaminated to be recycled and end up in landfills.",
                "recycling_ideas": ["Use as a makeshift waterproof layer for outdoor projects.", "Stuff into a pillowcase to make a DIY pet bed."]
            }
        ];
        
        return mocks[Math.floor(Math.random() * mocks.length)];
    }

    // --- 6. API KEY MANAGEMENT (Sidebar fallback) ---

    if (localStorage.getItem('geminiApiKey')) {
        apiKeyInput.value = localStorage.getItem('geminiApiKey');
        apiStatus.textContent = "API Key loaded from storage.";
    }

    btnSaveKey.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('geminiApiKey', key);
            apiStatus.style.color = 'var(--accent-emerald)';
            apiStatus.textContent = "API Key saved successfully!";
            setTimeout(() => apiStatus.textContent = "", 3000);
        } else {
            apiStatus.style.color = 'var(--accent-red)';
            apiStatus.textContent = "Please enter a valid key.";
        }
    });

    btnClearKey.addEventListener('click', () => {
        localStorage.removeItem('geminiApiKey');
        apiKeyInput.value = '';
        apiStatus.style.color = 'var(--text-secondary)';
        apiStatus.textContent = "API Key cleared.";
        setTimeout(() => apiStatus.textContent = "", 3000);
    });

    // --- 7. MAP INTEGRATION ---
    
    const recyclingIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style='background-color:#10b981; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:black; box-shadow: 0 0 10px #10b981;'><i class='fa-solid fa-recycle'></i></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    function initMap(lat, lng) {
        if (map) {
            map.setView([lat, lng], 13);
            return;
        }

        map = L.map('map').setView([lat, lng], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        const mockLocations = [
            { lat: lat + 0.01, lng: lng + 0.01, title: "Community Waste Bank (Bank Sampah)" },
            { lat: lat - 0.015, lng: lng - 0.005, title: "E-Waste Drop-off Point" },
            { lat: lat + 0.005, lng: lng - 0.02, title: "Municipal Landfill (TPA)" }
        ];

        mockLocations.forEach(loc => {
            L.marker([loc.lat, loc.lng], { icon: recyclingIcon })
                .addTo(map)
                .bindPopup(`<b>${loc.title}</b><br>Open 08:00 - 17:00`);
        });
        
        L.circleMarker([lat, lng], {
            radius: 8, fillColor: "#06b6d4", color: "#fff", weight: 2, opacity: 1, fillOpacity: 0.8
        }).addTo(map).bindPopup("Your Location");
    }

    btnLocate.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            return;
        }

        btnLocate.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Locating...`;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                initMap(latitude, longitude);
                btnLocate.innerHTML = `<i class="fa-solid fa-check"></i> Location Found`;
                setTimeout(() => {
                    btnLocate.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> Find Near Me`;
                }, 3000);
            },
            (error) => {
                console.error("Error getting location:", error);
                alert("Could not get your location. Please check browser permissions.");
                btnLocate.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> Find Near Me`;
                initMap(-6.2088, 106.8456); // Fallback
            }
        );
    });

    // Initialize map fallback on load
    initMap(-6.2088, 106.8456); 
});

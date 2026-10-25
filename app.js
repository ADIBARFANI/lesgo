document.addEventListener('DOMContentLoaded', () => {
    
    // --- DOM Elements ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const imagePreview = document.getElementById('image-preview');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    const resultsSection = document.getElementById('results-section');
    const btnCamera = document.getElementById('btn-camera');
    const btnUpload = document.getElementById('btn-upload');
    
    const cameraModal = document.getElementById('camera-modal');
    const cameraVideo = document.getElementById('camera-video');
    const btnCapture = document.getElementById('btn-capture');
    const btnCloseCamera = document.getElementById('btn-close-camera');

    const apiStatus = document.getElementById('api-status');
    const btnLocate = document.getElementById('btn-locate');
    
    let map = null;
    let currentMediaStream = null;
    let mobilenetModel = null;

    // --- 1. LOAD TENSORFLOW.JS MODEL ---
    
    async function loadModel() {
        try {
            apiStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Downloading AI Model (16MB)...`;
            apiStatus.style.color = "var(--accent-cyan)";
            
            // Load the MobileNet model
            mobilenetModel = await mobilenet.load();
            
            apiStatus.innerHTML = `<i class="fa-solid fa-check-circle"></i> AI Model Ready!`;
            apiStatus.style.color = "var(--accent-emerald)";
            
            // Enable buttons now that the model is loaded
            btnCamera.disabled = false;
            btnUpload.disabled = false;
            
        } catch (error) {
            console.error("Model loading failed:", error);
            apiStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Failed to load AI. Check connection.`;
            apiStatus.style.color = "var(--accent-red)";
        }
    }
    
    // Start loading the model immediately
    loadModel();

    // --- 2. IMAGE UPLOAD & DRAG/DROP ---
    
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

    // --- 3. LIVE CAMERA LOGIC ---

    btnCamera.addEventListener('click', async () => {
        try {
            currentMediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' }
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

    // --- 4. ANALYSIS & MAPPING LOGIC ---

    async function loadImageAndAnalyze(imageUrl) {
        imagePreview.src = imageUrl;
        imagePreview.classList.remove('hidden');
        uploadPlaceholder.classList.add('hidden');
        
        resultsSection.classList.remove('hidden');
        document.getElementById('result-object-name').textContent = "Analyzing image...";
        document.getElementById('result-category').textContent = "Please wait";
        
        if (!mobilenetModel) {
            alert("AI model is still loading. Please wait a moment.");
            return;
        }

        const imgToAnalyze = new Image();
        imgToAnalyze.src = imageUrl;
        imgToAnalyze.onload = async () => {
            try {
                // Run the local AI classification
                const predictions = await mobilenetModel.classify(imgToAnalyze);
                
                if (predictions && predictions.length > 0) {
                    const topPrediction = predictions[0];
                    // Clean up the name (e.g., "water bottle, bottle" -> "water bottle")
                    const objectName = topPrediction.className.split(',')[0]; 
                    const confidence = Math.round(topPrediction.probability * 100);
                    
                    // Map the object to our 5 specific categories
                    const mappedData = mapToCategories(objectName, confidence);
                    renderResults(mappedData);
                } else {
                    // Fallback if AI can't figure it out
                    const fallbackData = generateData("Unknown Item", 50, "Residual", "Grey");
                    renderResults(fallbackData);
                }
            } catch (error) {
                console.error("Classification error:", error);
                alert("Failed to analyze the image.");
            }
        };
    }

    // --- 5. THE SMARTER MAPPING DICTIONARY ---
    // Maps MobileNet's 1000 generic classes to the 5 specific waste categories

    function mapToCategories(className, confidence) {
        const name = className.toLowerCase();
        
        let category = "Residual";
        let binColor = "Grey";

        // Organic (Green)
        if (name.match(/banana|apple|orange|lemon|strawberry|broccoli|cabbage|cauliflower|mushroom|cucumber|pepper|squash|artichoke|fig|pineapple|pomegranate|corn|flower|leaf|plant|tree|food|vegetable|fruit/)) {
            category = "Organic";
            binColor = "Green";
        }
        // Hazardous B3 (Red)
        else if (name.match(/cellular|phone|laptop|computer|battery|remote|mouse|keyboard|monitor|tv|screen|drill|calculator|radio|camera|ipod|hard disc|modem|router|printer|scanner|switch|transmitter|electronic/)) {
            category = "Hazardous (B3)";
            binColor = "Red";
        }
        // Recyclable (Blue)
        else if (name.match(/bottle|can|jar|carton|newspaper|envelope|notebook|paper|book|magazine|packet|box|tin|glass|plastic|bag/)) {
            category = "Recyclable";
            binColor = "Blue";
        }
        // Inorganic (Yellow)
        else if (name.match(/mug|cup|pot|vase|ceramic|plate|bowl|teapot|clock|toy|rubber|leather|shoe|clothing|fabric|wood|metal/)) {
            category = "Inorganic";
            binColor = "Yellow";
        }

        return generateData(className, confidence, category, binColor);
    }

    // --- 6. DYNAMIC DATA GENERATION (Replaces API) ---

    function generateData(objectName, confidence, category, binColor) {
        const data = {
            object_name: objectName,
            confidence: confidence,
            category: category,
            bin_color: binColor,
            preparation_tips: [],
            fun_fact: "",
            recycling_ideas: []
        };

        switch(category) {
            case "Organic":
                data.preparation_tips = ["Remove any plastic stickers or packaging", "Chop into smaller pieces to speed up composting", "Keep separate from dry recyclables"];
                data.fun_fact = "Organic waste decomposes naturally in weeks, returning valuable nutrients to the soil.";
                data.recycling_ideas = ["Use for home composting.", "Create natural plant fertilizer.", "Use as feed for backyard animals."];
                break;
            case "Hazardous (B3)":
                data.preparation_tips = ["Do not puncture, crush, or dismantle", "Tape battery ends if applicable", "Store in a cool, dry place until drop-off"];
                data.fun_fact = "Hazardous waste contains heavy metals that can contaminate groundwater if thrown in regular trash.";
                data.recycling_ideas = ["Look for specialized e-waste drop-off bins.", "Check for local hazardous waste collection days.", "Donate working electronics."];
                break;
            case "Recyclable":
                data.preparation_tips = ["Empty and rinse out any food or liquid residue", "Compress or flatten to save space", "Remove and separate caps if applicable"];
                data.fun_fact = "Recycling materials saves massive amounts of energy compared to manufacturing from raw resources.";
                data.recycling_ideas = ["Transform into a self-watering plant pot.", "Create desk organizers or pen holders.", "Use for DIY arts and crafts."];
                break;
            case "Inorganic":
                data.preparation_tips = ["Wrap sharp or broken pieces safely", "Do not mix with glass recycling", "Place in inorganic waste bin"];
                data.fun_fact = "Inorganic waste like ceramics and rubber does not decompose naturally and takes centuries to break down.";
                data.recycling_ideas = ["Use broken pieces for mosaic art.", "Reuse as drainage in plant pots.", "Upcycle into unique home decor."];
                break;
            case "Residual":
            default:
                data.preparation_tips = ["Wrap tightly to contain odors", "Ensure it is separated from recyclables", "Place in general residual waste bin"];
                data.fun_fact = "Residual waste is the final waste that cannot be recycled or composted, ending up in landfills.";
                data.recycling_ideas = ["Try to reduce single-use items in the future.", "Look for creative ways to reuse the item.", "Support businesses that use sustainable packaging."];
                break;
        }
        return data;
    }

    // --- 7. DYNAMIC RENDERING ---

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
        
        const colorMap = {
            'Green': '#10b981', 'Yellow': '#eab308', 'Red': '#ef4444', 
            'Blue': '#3b82f6', 'Grey': '#94a3b8', 'Gray': '#94a3b8'
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

    // --- 8. MAP INTEGRATION ---
    
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
                initMap(-6.2088, 106.8456);
            }
        );
    });

    // Initialize map fallback on load
    initMap(-6.2088, 106.8456); 
});

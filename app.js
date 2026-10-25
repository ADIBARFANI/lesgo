/**
 * Smart Waste Classifier - Core Logic
 * Includes Image Processing (Canvas 1:1 crop), Mock AI Engine, 
 * Dynamic DOM Rendering, and Leaflet Map integration.
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- DOM Elements ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const imagePreview = document.getElementById('image-preview');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    const resultsSection = document.getElementById('results-section');
    const btnCamera = document.getElementById('btn-camera');
    const btnUpload = document.getElementById('btn-upload');
    
    // API Sidebar Elements
    const apiKeyInput = document.getElementById('api-key-input');
    const btnSaveKey = document.getElementById('btn-save-key');
    const btnClearKey = document.getElementById('btn-clear-key');
    const apiStatus = document.getElementById('api-status');

    // Map Elements
    const btnLocate = document.getElementById('btn-locate');
    let map = null; // Leaflet map instance

    // --- State ---
    let currentImageDataUrl = null;

    // --- Image Handling & Processing ---

    // 1. Trigger file input
    btnUpload.addEventListener('click', () => fileInput.click());

    // 2. Handle File Selection
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    });

    // 3. Drag and Drop Events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    });

    // 4. Simulate Camera
    btnCamera.addEventListener('click', () => {
        // In a real app, this would use getUserMedia. 
        // For this demo, we'll simulate taking a photo by loading a placeholder image.
        apiStatus.textContent = "Simulating camera capture...";
        setTimeout(() => {
            // Using a placeholder image of a plastic bottle
            const mockImgUrl = 'https://images.unsplash.com/photo-1520350094754-f0fdcac35c1c?q=80&w=800&auto=format&fit=crop';
            loadImageAndAnalyze(mockImgUrl);
            apiStatus.textContent = "";
        }, 500);
    });

    // 5. Process File (Crop to 1:1 via Canvas)
    function processFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Crop image to strict 1:1 ratio
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
        
        // Find the shortest side
        const size = Math.min(img.width, img.height);
        
        // Set canvas to 1:1 ratio
        canvas.width = size;
        canvas.height = size;
        
        // Calculate starting points to crop from the center
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;
        
        // Draw image onto canvas
        ctx.drawImage(img, startX, startY, size, size, 0, 0, size, size);
        
        return canvas.toDataURL('image/jpeg', 0.8);
    }

    // --- Mock AI Engine & UI Rendering ---

    function loadImageAndAnalyze(imageUrl) {
        currentImageDataUrl = imageUrl;
        
        // Update Preview
        imagePreview.src = imageUrl;
        imagePreview.classList.remove('hidden');
        uploadPlaceholder.classList.add('hidden');

        // Trigger AI Analysis (Mock)
        runAIAnalysis();
    }

    async function runAIAnalysis() {
        // In a real app, we would send currentImageDataUrl to Gemini API here.
        // If API key exists and is valid, fetch. Else, fallback to mock.
        
        const apiKey = localStorage.getItem('geminiApiKey');
        
        // Simulating network delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock Data Payload matching schema
        const mockData = {
            "object_name": "Crushed Plastic Water Bottle",
            "confidence": 92,
            "category": "Plastic (PET)",
            "bin_color": "Yellow",
            "preparation_tips": [
                "Rinse out liquid residue",
                "Compress the bottle tightly to save space",
                "Remove and separate the plastic cap"
            ],
            "fun_fact": "Recycling a single plastic bottle saves enough energy to power a lightbulb for up to 3 hours.",
            "recycling_ideas": [
                "Transform into a self-watering plant pot.",
                "Cut and smooth edges to create a desk pen holder.",
                "Collect caps for community art installations."
            ]
        };

        renderResults(mockData);
    }

    // --- Dynamic DOM Update ---
    function renderResults(data) {
        // Unhide section
        resultsSection.classList.remove('hidden');

        // 1. Summary
        document.getElementById('result-image').src = currentImageDataUrl;
        document.getElementById('result-object-name').textContent = data.object_name;
        document.getElementById('result-category').textContent = data.category;
        
        // Confidence Bar Animation
        document.getElementById('result-confidence-text').textContent = `${data.confidence}%`;
        const progressBar = document.getElementById('result-confidence-bar');
        progressBar.style.width = '0%'; // Reset
        setTimeout(() => {
            progressBar.style.width = `${data.confidence}%`;
        }, 100);

        // 2. Bin Guidance Badge (Dynamic Colors)
        const binBadge = document.getElementById('result-bin-badge');
        const binText = document.getElementById('result-bin-text');
        binText.textContent = `${data.bin_color} Bin`;
        
        // Map color names to CSS hex codes for styling
        const colorMap = {
            'Yellow': '#eab308',
            'Blue': '#3b82f6',
            'Red': '#ef4444',
            'Green': '#10b981',
            'Grey': '#94a3b8'
        };
        const binColor = colorMap[data.bin_color] || '#94a3b8';
        
        binBadge.style.backgroundColor = `${binColor}20`; // 20 is for transparency
        binBadge.style.color = binColor;
        binBadge.style.border = `1px solid ${binColor}`;

        // 3. Checklist
        const checklist = document.getElementById('result-checklist');
        checklist.innerHTML = ''; // Clear previous
        data.preparation_tips.forEach((tip, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <input type="checkbox" id="tip-${index}">
                <span>${tip}</span>
            `;
            checklist.appendChild(li);
        });

        // 4. Fun Fact
        document.getElementById('result-fun-fact').textContent = data.fun_fact;

        // 5. Upcycling Ideas
        const ideasGrid = document.getElementById('result-ideas');
        ideasGrid.innerHTML = '';
        data.recycling_ideas.forEach(idea => {
            const div = document.createElement('div');
            div.className = 'idea-card';
            div.innerHTML = `<p>${idea}</p>`;
            ideasGrid.appendChild(div);
        });

        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // --- API Key Management ---
    // Load saved key on startup
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

    // --- Map Integration (Leaflet) ---
    
    // Custom Icon for the map
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

        // Initialize map
        map = L.map('map').setView([lat, lng], 13);

        // Add OpenStreetMap tile layer (Dark Mode styled via CSS)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        // Add Mock Markers around the user's location
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
        
        // Add a marker for the user's actual location
        L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: "#06b6d4",
            color: "#fff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
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
                
                // Fallback to a default location (e.g., Jakarta) for demo purposes
                initMap(-6.2088, 106.8456);
            }
        );
    });

    // Initialize map with a default location on load so it's not empty
    initMap(-6.2088, 106.8456); 
});

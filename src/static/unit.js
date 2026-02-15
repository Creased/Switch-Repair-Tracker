document.addEventListener('DOMContentLoaded', () => {
    // Visual Pin Tester Logic
    const pinInput = document.getElementById('pin_check_input');
    const visualTester = document.getElementById('visual-pin-tester');
    const toggleBtn = document.getElementById('toggle-grid-btn');
    const pinInputs = document.querySelectorAll('.pin-input');

    if (pinInput && visualTester && toggleBtn) {
        // Initial Load
        loadVisualData();
        updatePinPreview(); // Show summary on page load

        toggleBtn.addEventListener('click', togglePinTester);

        // Attach listeners to inputs
        pinInputs.forEach(input => {
            input.addEventListener('input', () => {
                updatePinStyle(input);
                saveVisualData();
            });
            input.addEventListener('blur', () => {
                let val = input.value.toUpperCase();
                if (val === 'OL' || val === 'GND') {
                    input.value = val;
                    updatePinStyle(input);
                    saveVisualData();
                }
            });
        });
    }

    function togglePinTester() {
        if (visualTester.style.display === 'none') {
            // Open Grid
            visualTester.style.display = 'block';
            toggleBtn.textContent = 'CLOSE CHECKER';
            toggleBtn.classList.add('btn-active-purple');
        } else {
            // Close Grid
            visualTester.style.display = 'none';
            toggleBtn.textContent = 'OPEN CHECKER';
            toggleBtn.classList.remove('btn-active-purple');
            saveVisualData();
        }
    }

    function loadVisualData() {
        let data = pinInput.value;
        if (!data) return;

        try {
            // Try parsing as JSON
            const jsonData = JSON.parse(data);

            // Populate Grid
            pinInputs.forEach(input => {
                const pin = input.dataset.pin;
                if (jsonData[pin]) {
                    input.value = jsonData[pin];
                    updatePinStyle(input);
                }
            });

            // Analyze
            analyzePins(jsonData);

            // Update Preview immediately (if grid is starting closed)
            updatePinPreview();

        } catch (e) {
            // Legacy Text - update summary
            const pinSummary = document.getElementById('pin-summary');
            if (pinSummary && pinInput.value) {
                pinSummary.innerHTML = `<span class="text-accent-cyan">${pinInput.value}</span>`;
            }
        }
    }

    function updatePinPreview() {
        const pinSummary = document.getElementById('pin-summary');
        if (!pinSummary) return;

        const data = pinInput.value ? JSON.parse(pinInput.value || '{}') : {};

        const typeSelect = document.querySelector('select[name="type"]');
        const isDock = typeSelect && typeSelect.value === 'Dock';

        let expectedOL = [2, 3, 10, 11, 14, 15, 22, 23]; // Default Console

        if (isDock) {
            // Dock: Only VBUS/GND have readings. Everything else is OL.
            // VBUS: 4, 9, 16, 21 -> 0.54
            // GND: 1, 12, 13, 24 -> GND
            // All others are OL: 
            expectedOL = [2, 3, 5, 6, 7, 8, 10, 11, 14, 15, 17, 18, 19, 20, 22, 23];
        }

        let olPins = [];
        let shortPins = [];
        let hasData = false;
        let totalOLCount = 0;

        for (let pin = 1; pin <= 24; pin++) {
            const val = data[pin.toString()]; // JSON keys are strings
            if (val) {
                hasData = true;
                if (val === 'OL') {
                    totalOLCount++;
                    if (!expectedOL.includes(pin)) olPins.push(pin);
                }
                else if (isShort(val)) shortPins.push(pin);
            }
        }

        // Check if ripped off (20+ OL pins out of 24)
        if (totalOLCount >= 20) {
            pinSummary.innerHTML = `<strong class="text-danger">PORT RIPPED OFF</strong> <span class="text-dim">(${totalOLCount} pins OL)</span>`;
            return;
        }

        if (!hasData) {
            // Check if legacy text logic applies
            if (!pinInput.value.trim().startsWith('{') && pinInput.value.trim().length > 0) {
                pinSummary.innerHTML = `<span class="text-accent-cyan">${pinInput.value}</span>`;
                return;
            }
            pinSummary.innerHTML = '<span class="text-dim">No pin data</span>';
            return;
        }


        let html = '';
        if (olPins.length > 0) {
            html += `<div class="text-danger"><strong>OL:</strong> ${olPins.join(', ')}</div>`;
        }
        if (shortPins.length > 0) {
            html += `<div class="text-warning"><strong>SHORT:</strong> ${shortPins.join(', ')}</div>`;
        }
        if (olPins.length === 0 && shortPins.length === 0) {
            html += `<div class="text-success"><strong>ALL PINS OK</strong> (Diode Mode)</div>`;
        }

        pinSummary.innerHTML = html || '<span class="text-dim">No pin data</span>';
    }

    function updatePinStyle(input) {
        const val = input.value.toUpperCase();
        const pin = parseInt(input.dataset.pin);
        const expectedOL = [2, 3, 10, 11, 14, 15, 22, 23];

        if (val === 'OL') {
            if (expectedOL.includes(pin)) {
                input.style.color = 'var(--text-primary)';
                input.style.fontWeight = 'normal';
            } else {
                input.style.color = 'var(--pin-value-red)';
                input.style.fontWeight = 'bold';
            }
        } else if (val === 'GND' || val === '0.000') {
            input.style.color = 'var(--pin-value-cyan)';
        } else if (isShort(val)) {
            // Explicitly highlight shorts in red
            input.style.color = 'var(--pin-value-red)';
            input.style.fontWeight = 'bold';
        } else {
            input.style.color = 'var(--pin-value-green)';
        }
    }

    function saveVisualData() {
        let data = {};
        let hasData = false;
        pinInputs.forEach(input => {
            const val = input.value.trim();
            if (val) {
                data[input.dataset.pin] = val;
                hasData = true;
            }
        });


        if (hasData) {
            pinInput.value = JSON.stringify(data);
            analyzePins(data);
            updatePinPreview(); // Update the summary display
        }
    }

    function analyzePins(data) {
        const resultDiv = document.getElementById('auto-diagnosis-result');
        const resultText = document.getElementById('diagnosis-text');
        if (!resultDiv || !resultText) return;

        let findings = [];
        let olCount = 0;

        // Count OLs
        for (const key in data) {
            if (data[key] === 'OL') olCount++;
        }

        // Check for Ripped Off Port (Most/All pins OL)
        // If > 20 OLs, likely ripped off or major disconnect
        if (olCount > 20) {
            findings.push("USB-C Port likely Ripped Off / Disconnected");
        } else {
            const typeSelect = document.querySelector('select[name="type"]');
            const isDock = typeSelect && typeSelect.value === 'Dock';

            // Pins A5(5), B5(17) are CC1/CC2
            if (isShort(data['5']) || isShort(data['17'])) {
                findings.push("Potential M92 IC Short (CC Lines - Pin 5/17)");
            }

            if (!isDock) {
                // Console Analysis (Expects Data & CC)

                // D+ D- (P13USB) -> Pins 6, 7, 18, 19
                if (data['6'] === 'OL' || data['7'] === 'OL' || data['18'] === 'OL' || data['19'] === 'OL') {
                    findings.push("Likely Broken Traces / Pads at USB-C Connector (Data Lines OL)");
                }

                // CC1/CC2 (M92) -> Pins 5, 20 !!! Pin 20 is CC2, 17 is SBU2? Check schema. 
                // Pin 5 (CC1), Pin 17 (CC2 on B side logic sometimes flipped in breakout boards)
                // Standard: A5 (CC1), B5 (CC2) -> Breakouts vary. 
                // Let's stick to standard map: 5 & 17 usually checked.
                // If previously defined logic used 20, we keep it consistent or fix it.
                // Previous code used 20. B8 is SBU2. 
                if (data['5'] === 'OL' || data['20'] === 'OL') { // Note: 20 is CC2, 17 is SBU2? Check schema. 
                    // Pin 5 (CC1), Pin 17 (CC2 on B side logic sometimes flipped in breakout boards)
                    // Standard: A5 (CC1), B5 (CC2) -> Breakouts vary. 
                    // Let's stick to standard map: 5 & 17 usually checked.
                    // If previously defined logic used 20, we keep it consistent or fix it.
                    // Previous code used 20. B8 is SBU2. 
                    findings.push("Check M92 IC / USB-C Port (CC Lines OL)");
                }

                // SBU1/SBU2 (P13USB) -> Pins 8, 17 (Wait, 17 is CC2? or SBU2?)
                // USB-C: A8 (SBU1), B8 (SBU2).
                // Breakout board mapping: 
                // Side A: 1-12. Side B: 13-24. 
                // A5=CC1. A8=SBU1. 
                // B5=CC2 (Pin 17 if reversed? 24-5+1 = 20? No.)
                // Pin 17 is B8 (SBU2) in some counts? 
                // Let's stick to existing logic for now to avoid regress, just gating it.
                if (data['8'] === 'OL' || data['17'] === 'OL') {
                    findings.push("Check P13USB / Filters (SBU Lines OL)");
                }
            } else {
                // Dock Analysis
                // We EXPECT Data/CC to be OL (Power only passthrough for AC handoff logic inside dock?)
                // Actually Dock Port AC input -> PD Controller.
                // If VBUS is good, but logic dead, maybe PD. 
                // For now, just suppressing false positives.
            }

            // VBUS Short -> Pin 4, 9, 16, 21
            if (isShort(data['4']) || isShort(data['9']) || isShort(data['16']) || isShort(data['21'])) {
                findings.push("VBUS Short (Check M92 / BQ / Caps)");
            }
        }

        if (findings.length > 0) {
            resultDiv.style.display = 'block';
            resultText.innerHTML = findings.join("<br>");
        } else {
            resultDiv.style.display = 'none';
        }
    }

    function isShort(val) {
        if (!val) return false;
        if (val.toUpperCase() === 'SHORT') return true;
        let num = parseFloat(val);
        // Warn on anything less than 0.150V (150mV)
        if (!isNaN(num) && num > 0 && num < 0.150) return true;
        return false;
    }

    // Attach to window for onclick handlers (legacy support) or event listeners preferred
    window.setAllPinsGood = function () {
        if (visualTester.style.display === 'none') {
            togglePinTester(); // Ensure it's open
        }

        const typeSelect = document.querySelector('select[name="type"]');
        const isDock = typeSelect && typeSelect.value === 'Dock';

        let goodValues;

        if (isDock) {
            // Dock specific: VBUS/GND = 0.54, Others = OL
            // VBUS: 4, 9, 16, 21. GND: 1, 12, 13, 24
            goodValues = {};
            // Set defaults to OL first (or handle via loop)
            for (let i = 1; i <= 24; i++) goodValues[i] = 'OL';

            // Set VBUS/GND
            [1, 12, 13, 24].forEach(p => goodValues[p] = 'GND');
            [4, 9, 16, 21].forEach(p => goodValues[p] = '0.54');
        } else {
            // Standard Console
            goodValues = {
                1: 'GND', 2: 'OL', 3: 'OL', 4: '0.52', 5: '0.54', 6: '0.80', 7: '0.81', 8: '0.75', 9: '0.52', 10: 'OL', 11: 'OL', 12: 'GND',
                13: 'GND', 14: 'OL', 15: 'OL', 16: '0.52', 17: '0.75', 18: '0.81', 19: '0.80', 20: '0.54', 21: '0.52', 22: 'OL', 23: 'OL', 24: 'GND'
            };
        }

        pinInputs.forEach(input => {
            const pin = parseInt(input.dataset.pin);
            input.value = goodValues[pin] || 'OL';
            updatePinStyle(input);
        });
        saveVisualData();
        updatePinPreview(); // Update the summary display
    }

    // Auto Label Logic
    window.autoLabel = function () {
        const typeSelect = document.querySelector('select[name="type"]');
        let prefix = 'SW';
        if (typeSelect && typeSelect.value === 'Dock') {
            prefix = 'DK';
        }

        fetch(`/api/next-label?prefix=${prefix}`)
            .then(response => response.json())
            .then(data => {
                if (data.next_label) {
                    const labelInput = document.getElementById('labelInput');
                    labelInput.value = data.next_label;
                    // Flash effect
                    labelInput.style.backgroundColor = 'var(--accent-purple-soft)';
                    setTimeout(() => {
                        labelInput.style.backgroundColor = '';
                    }, 500);
                }
            })
            .catch(error => console.error('Error fetching next label:', error));
    }

    // Boot Diagnosis Logic
    window.analyzePortReading = async function () {
        const portVal = document.getElementById('usb_c_input').value.trim();
        const container = document.getElementById('port-diagnosis-container');

        if (!portVal) {
            alert('Please enter a port reading first');
            return;
        }

        container.innerHTML = '<div class="text-dim-small">Analyzing Port...</div>';
        container.style.display = 'block';

        try {
            const res = await fetch('/api/diagnose-boot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amp_draw: portVal,
                    test_method: 'no_battery'
                })
            });
            const data = await res.json();
            renderDiagnosis(data, container, 'Initial Port Analysis');
        } catch (err) {
            console.error(err);
            container.innerHTML = '<div class="text-danger-small">Error analyzing port</div>';
        }
    }

    window.analyzeBootStage = async function () {
        const ampVal = document.getElementById('amp_draw_input').value.trim();
        const method = document.getElementById('test-method-select').value;
        const container = document.getElementById('boot-diagnosis-container');

        if (!ampVal) {
            alert('Please enter an amp value first');
            return;
        }

        container.innerHTML = '<div class="text-dim-small">Analyzing...</div>';
        container.style.display = 'block';

        try {
            const res = await fetch('/api/diagnose-boot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amp_draw: ampVal,
                    test_method: method
                })
            });
            const data = await res.json();

            const methodDisplay = {
                'battery': 'BATTERY CONNECTED',
                'bench': 'BENCH POWER SUPPLY (4.2V)',
                'bypass': '10K RESISTOR BYPASS',
                'no_battery': 'USB-C INPUT (NO BATTERY)'
            };
            const methodLabel = methodDisplay[data.method_used] || data.method_used.toUpperCase();

            renderDiagnosis(data, container, `Boot Analysis (${methodLabel})`);

        } catch (err) {
            console.error(err);
            container.innerHTML = '<div class="text-danger-small">Error analyzing boot stage</div>';
        }
    }

    function renderDiagnosis(data, container, title) {
        const severityColors = {
            'critical': 'var(--accent-red)',
            'high': 'var(--accent-orange)',
            'medium': 'var(--accent-yellow)',
            'low': 'var(--accent-cyan)',
            'none': 'var(--accent-green)'
        };

        const severityBgs = {
            'critical': 'rgba(255, 68, 68, 0.2)',
            'high': 'rgba(255, 165, 0, 0.2)',
            'medium': 'rgba(255, 234, 0, 0.2)',
            'low': 'rgba(0, 243, 255, 0.2)',
            'none': 'rgba(10, 255, 10, 0.2)'
        };

        const color = severityColors[data.severity] || 'var(--accent-purple)';
        const bg = severityBgs[data.severity] || 'rgba(188, 19, 254, 0.1)';

        container.innerHTML = `
            <div class="diagnosis-card" style="--severity-color: ${color}; --severity-bg: ${bg}">
                <div class="diagnosis-header">
                    <span class="diagnosis-title">${title}</span>
                    <span class="severity-badge">${data.severity}</span>
                </div>
                <div class="diagnosis-stage">${data.stage}</div>
                <div class="diagnosis-fault">Likely: <strong>${data.fault}</strong></div>
                <div class="diagnosis-action">${data.action}</div>
                <button type="button" class="btn btn-copy-diag" onclick="copyDiagnosisToNotes('${data.stage}', '${data.fault}')">
                    COPY TO REPAIR LOG
                </button>
            </div>
        `;
    }

    window.copyDiagnosisToNotes = function (stage, fault) {
        const notesArea = document.getElementsByName('notes')[0];
        const date = new Date().toLocaleDateString();
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const diagText = `\n[${date} ${timestamp}] Diagnostic: ${stage} - Likely Fault: ${fault}`;

        notesArea.value += diagText;
        notesArea.scrollTop = notesArea.scrollHeight;

        const btn = document.querySelector('.btn-copy-diag'); // Note: this selects the first one, might be issue if multiple
        // Ideally pass button reference, but for now this works as usually only one diag is active per click
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = 'COPIED!';
            btn.classList.add('btn-success');

            setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('btn-success');
            }, 1500);
        }
    }

    // Dynamic Method Description
    window.updateMethodDescription = function () {
        const methodSelect = document.getElementById('test-method-select');
        if (!methodSelect) return;

        const method = methodSelect.value;
        const descBox = document.getElementById('method-description');
        let html = '';

        if (method === 'bench') {
            // First Stage
            html = `
                <div class="instruction-box">
                    <strong>First Stage Boot (VSYS)</strong>
                    <ul>
                        <li>Remove Battery & Motherboard (recommended).</li>
                        <li>Solder the <b class="text-red">Red wire</b> to the <b class="text-yellow">VSYS</b> coil (Inductor).</li>
                        <li>Solder the <b class="text-white">Black wire</b> to <b class="text-white">USB Shield (Ground)</b>.</li>
                        <li>Inject <b class="text-accent-purple">4.2V</b> (Limit <b>1A</b>).</li>
                        <li>Expected Idle: <b>1-5mA</b>.</li>
                        <li>Short <b>Pins 1 & 2</b> (Power Button) to boot. Expected: ~195mA.</li>
                    </ul>
                </div>`;
        } else if (method === 'bypass') {
            // Second Stage
            html = `
                <div class="instruction-box">
                    <strong>Second Stage Boot (VBAT + 10K)</strong>
                    <ul>
                        <li>Remove Battery.</li>
                        <li>Solder the <b class="text-red">Red wire</b> to the <b class="text-yellow">VBAT</b> pad.</li>
                        <li>Solder the <b class="text-white">Black wire</b> to <b class="text-white">Ground</b>.</li>
                        <li>Solder a <b class="text-accent-purple">10K Resistor</b> between VSYS & VBAT/Pads.</li>
                        <li>Inject <b class="text-accent-purple">4.2V</b> (Limit <b>2A</b>).</li>
                        <li><em>Warning: Any less than 2A limit will fail mid-boot.</em></li>
                        <li>Short <b>Pins 1 & 2</b> to boot.</li>
                    </ul>
                </div>`;
        }

        if (html) {
            descBox.innerHTML = html;
            descBox.classList.remove('hidden');
        } else {
            descBox.innerHTML = '';
            descBox.classList.add('hidden');
        }
    }

    // Init description on load
    updateMethodDescription();
    toggleBootAnalysis(); // Initial check

    // Type Change Listener for Boot Analysis Visibility
    const typeSelect = document.querySelector('select[name="type"]');
    if (typeSelect) {
        typeSelect.addEventListener('change', toggleBootAnalysis);
    }

    function toggleBootAnalysis() {
        const typeSelect = document.querySelector('select[name="type"]');
        const bootSection = document.getElementById('boot-analysis-section');
        const portSection = document.getElementById('port-reading-section');

        if (typeSelect && bootSection && portSection) {
            if (typeSelect.value === 'Dock') {
                bootSection.style.display = 'none';
                portSection.style.display = 'none';
            } else {
                bootSection.style.display = 'block';
                portSection.style.display = 'block';
            }
        }
    }

    // Testing Checklist Management
    const checklistItems = [
        { key: 'power_on', label: 'Powers On', category: 'hardware' },
        { key: 'display', label: 'Display (No Dead Pixels)', category: 'hardware' },
        { key: 'touchscreen', label: 'Touchscreen Responsive', category: 'hardware' },
        { key: 'buttons', label: 'All Buttons Functional', category: 'hardware' },
        { key: 'analog_sticks', label: 'Analog Sticks (No Drift)', category: 'hardware' },
        { key: 'triggers', label: 'Triggers (L/R, ZL/ZR)', category: 'hardware' },
        { key: 'speakers', label: 'Speakers/Audio Output', category: 'hardware' },
        { key: 'headphone_jack', label: 'Headphone Jack', category: 'hardware' },
        { key: 'charging', label: 'Charging (USB-C)', category: 'hardware' },
        { key: 'battery', label: 'Battery Holds Charge', category: 'hardware' },
        { key: 'docking', label: 'Docking Functionality', category: 'hardware' },
        { key: 'joycon_rails', label: 'Joy-Con Rails/Connectors', category: 'hardware' },
        { key: 'kickstand', label: 'Kickstand', category: 'hardware' },
        { key: 'boots_to_menu', label: 'Boots to Home Menu', category: 'software' },
        { key: 'eshop', label: 'eShop Access', category: 'software' },
        { key: 'wifi', label: 'Wi-Fi Connectivity', category: 'software' },
        { key: 'game_card', label: 'Game Card Slot', category: 'software' },
        { key: 'sd_card', label: 'SD Card Slot', category: 'software' },
        { key: 'bluetooth', label: 'Bluetooth Pairing', category: 'advanced' },
        { key: 'airplane_mode', label: 'Airplane Mode Toggle', category: 'advanced' },
        { key: 'sleep_wake', label: 'Sleep/Wake Function', category: 'advanced' },
        { key: 'fan_operation', label: 'Fan Operation (No Noise)', category: 'advanced' }
    ];

    async function loadChecklist() {
        // Extract barcode from URL path (e.g., /unit/XKJ12345)
        const pathParts = window.location.pathname.split('/');
        const barcode = pathParts[pathParts.length - 1];

        if (!barcode || barcode === 'unit') return;

        const serial = barcode;

        try {
            const response = await fetch(`/api/unit/${serial}/checklist`);
            const data = await response.json();
            renderChecklist(data.checklist || {});
        } catch (error) {
            console.error('Failed to load checklist:', error);
            renderChecklist({});
        }
    }

    function renderChecklist(state) {
        const container = document.getElementById('checklist-container');
        if (!container) return;

        container.innerHTML = checklistItems.map(item => `
            <div class="checklist-item ${state[item.key] ? 'completed' : ''}" 
                 data-key="${item.key}"
                 onclick="toggleChecklistItem('${item.key}')">
                <div class="checklist-checkbox"></div>
                <span>${item.label}</span>
            </div>
        `).join('');

        // Update button state after rendering
        updateChecklistButton();

        // Auto-expand if checklist has any completed items
        const completedItems = Object.values(state).filter(Boolean).length;
        if (completedItems > 0) {
            const container = document.getElementById('checklist-container');
            const icon = document.getElementById('checklist-toggle-icon');
            if (container && icon) {
                container.style.display = 'grid';
                icon.textContent = '▼';
            }
        }
    }

    // Update button state based on completion
    function updateChecklistButton() {
        const btn = document.getElementById('checklist-action-btn');
        if (!btn) return;

        const items = document.querySelectorAll('.checklist-item');
        const completedItems = document.querySelectorAll('.checklist-item.completed');

        if (items.length > 0 && items.length === completedItems.length) {
            // All complete - show RESET button
            btn.textContent = 'RESET';
            btn.className = 'btn btn-sm btn-accent-red';
            btn.onclick = resetChecklist;
        } else {
            // Not all complete - show MARK ALL COMPLETE button
            btn.textContent = 'MARK ALL COMPLETE';
            btn.className = 'btn btn-sm btn-accent-green';
            btn.onclick = markAllTestsComplete;
        }
    }



    async function saveChecklist() {
        // Extract barcode from URL path
        const pathParts = window.location.pathname.split('/');
        const barcode = pathParts[pathParts.length - 1];

        if (!barcode || barcode === 'unit') return;

        const serial = barcode;
        const items = document.querySelectorAll('.checklist-item');
        const state = {};

        items.forEach(item => {
            const key = item.getAttribute('data-key');
            state[key] = item.classList.contains('completed');
        });

        try {
            await fetch(`/api/unit/${serial}/checklist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ checklist: state })
            });
        } catch (error) {
            console.error('Failed to save checklist:', error);
        }
    }

    // Load checklist on page load
    loadChecklist();

    // Attach event listener to checklist action button to prevent fold toggle
    const checklistActionBtn = document.getElementById('checklist-action-btn');
    if (checklistActionBtn) {
        checklistActionBtn.addEventListener('click', function (e) {
            e.stopPropagation(); // Prevent parent div click from triggering
            // The actual action (mark all complete or reset) will be called by updateChecklistButton
        });
    }

    // Function to toggle checklist visibility based on unit type
    function toggleChecklistVisibility() {
        const typeSelect = document.querySelector('select[name="type"]');
        const checklistSection = document.getElementById('testing-checklist-section');

        if (typeSelect && checklistSection) {
            if (typeSelect.value === 'Dock') {
                checklistSection.style.display = 'none';
            } else {
                checklistSection.style.display = 'block';
            }
        }
    }

    // Initial check on page load
    toggleChecklistVisibility();

    // Attach event listener to type dropdown
    let typeSelectDropdown = document.querySelector('select[name="type"]');
    if (typeSelectDropdown) {
        typeSelectDropdown.addEventListener('change', toggleChecklistVisibility);
    }
});

// Global function to update button state based on completion
function updateChecklistButton() {
    const btn = document.getElementById('checklist-action-btn');
    if (!btn) return;

    const items = document.querySelectorAll('.checklist-item');
    const completedItems = document.querySelectorAll('.checklist-item.completed');

    if (items.length > 0 && items.length === completedItems.length) {
        // All complete - show RESET button
        btn.textContent = 'RESET';
        btn.className = 'btn btn-sm btn-accent-red';
        btn.onclick = resetChecklist;
    } else {
        // Not all complete - show MARK ALL COMPLETE button
        btn.textContent = 'MARK ALL COMPLETE';
        btn.className = 'btn btn-sm btn-accent-green';
        btn.onclick = markAllTestsComplete;
    }
}

// Global function for toggling checklist items (must be outside DOMContentLoaded for onclick)
async function toggleChecklistItem(itemKey) {
    const item = document.querySelector(`.checklist-item[data-key="${itemKey}"]`);
    if (!item) return;

    item.classList.toggle('completed');

    // Save checklist state
    const pathParts = window.location.pathname.split('/');
    const barcode = pathParts[pathParts.length - 1];

    if (!barcode || barcode === 'unit') return;

    const items = document.querySelectorAll('.checklist-item');
    const state = {};

    items.forEach(item => {
        const key = item.getAttribute('data-key');
        state[key] = item.classList.contains('completed');
    });

    try {
        await fetch(`/api/unit/${barcode}/checklist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checklist: state })
        });
    } catch (error) {
        console.error('Failed to save checklist:', error);
    }

    // Update button state after toggle
    updateChecklistButton();
}

// Global function for "Mark All Complete" button
function markAllTestsComplete() {
    document.querySelectorAll('.checklist-item').forEach(item => {
        item.classList.add('completed');
    });

    // Manual save call
    const pathParts = window.location.pathname.split('/');
    const barcode = pathParts[pathParts.length - 1];

    if (barcode && barcode !== 'unit') {
        const serial = barcode;
        const items = document.querySelectorAll('.checklist-item');
        const state = {};

        items.forEach(item => {
            const key = item.getAttribute('data-key');
            state[key] = true; // All completed
        });

        fetch(`/api/unit/${serial}/checklist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checklist: state })
        }).catch(error => console.error('Failed to save checklist:', error));
    }

    // Update button state
    updateChecklistButton();
}

// Global function for "Reset" button
function resetChecklist() {
    document.querySelectorAll('.checklist-item').forEach(item => {
        item.classList.remove('completed');
    });

    // Manual save call
    const pathParts = window.location.pathname.split('/');
    const barcode = pathParts[pathParts.length - 1];

    if (barcode && barcode !== 'unit') {
        const items = document.querySelectorAll('.checklist-item');
        const state = {};

        items.forEach(item => {
            const key = item.getAttribute('data-key');
            state[key] = false; // All unchecked
        });

        fetch(`/api/unit/${barcode}/checklist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checklist: state })
        }).catch(error => console.error('Failed to save checklist:', error));
    }

    // Update button state
    updateChecklistButton();
}

// Global function to toggle checklist section collapse/expand
function toggleChecklistSection() {
    const container = document.getElementById('checklist-container');
    const icon = document.getElementById('checklist-toggle-icon');

    if (container.style.display === 'none') {
        container.style.display = 'grid';
        icon.textContent = '▼';
    } else {
        container.style.display = 'none';
        icon.textContent = '▶';
    }
}

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
        const expectedOL = [2, 3, 10, 11, 14, 15, 22, 23];

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
            // Pins A5(5), B5(17) are CC1/CC2
            if (isShort(data['5']) || isShort(data['17'])) {
                findings.push("Potential M92 IC Short (CC Lines - Pin 5/17)");
            }

            // D+ D- (P13USB) -> Pins 6, 7, 18, 19
            if (data['6'] === 'OL' || data['7'] === 'OL' || data['18'] === 'OL' || data['19'] === 'OL') {
                findings.push("Likely Broken Traces / Pads at USB-C Connector (Data Lines OL)");
            }

            // CC1/CC2 (M92) -> Pins 5, 20
            if (data['5'] === 'OL' || data['20'] === 'OL') {
                findings.push("Check M92 IC / USB-C Port (CC Lines OL)");
            }

            // SBU1/SBU2 (P13USB) -> Pins 8, 17
            if (data['8'] === 'OL' || data['17'] === 'OL') {
                findings.push("Check P13USB / Filters (SBU Lines OL)");
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
        if (!isNaN(num) && num > 0 && num < 0.050) return true;
        return false;
    }

    // Attach to window for onclick handlers (legacy support) or event listeners preferred
    window.setAllPinsGood = function () {
        if (visualTester.style.display === 'none') {
            togglePinTester(); // Ensure it's open
        }

        const goodValues = {
            1: 'GND', 2: 'OL', 3: 'OL', 4: '0.52', 5: '0.54', 6: '0.80', 7: '0.81', 8: '0.75', 9: '0.52', 10: 'OL', 11: 'OL', 12: 'GND',
            13: 'GND', 14: 'OL', 15: 'OL', 16: '0.52', 17: '0.75', 18: '0.81', 19: '0.80', 20: '0.54', 21: '0.52', 22: 'OL', 23: 'OL', 24: 'GND'
        };

        pinInputs.forEach(input => {
            const pin = parseInt(input.dataset.pin);
            if (goodValues[pin]) {
                input.value = goodValues[pin];
            }
            updatePinStyle(input);
        });
        saveVisualData();
        updatePinPreview(); // Update the summary display
    }

    // Auto Label Logic
    window.autoLabel = function () {
        fetch('/api/next-label')
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
});

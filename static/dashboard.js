document.addEventListener('DOMContentLoaded', () => {
    // Parse Pin JSON for dashboard
    document.querySelectorAll('.pin-summary').forEach(el => {
        try {
            const data = JSON.parse(el.dataset.json);
            const isDock = el.dataset.type === 'Dock';

            const olPins = [];
            let totalOLCount = 0; // Track all OL pins including expected ones

            // Expected OL pins (Normal)
            let expectedOL = [];
            if (isDock) {
                // Dock: Data/CC lines are normally OL.
                // Expected OL: 2,3,5,6,7,8,10,11,14,15,17,18,19,20,22,23
                // (Basically everything except GND and VBUS)
                // VBUS: 4, 9, 16, 21. GND: 1, 12, 13, 24.
                expectedOL = ['2', '3', '5', '6', '7', '8', '10', '11', '14', '15', '17', '18', '19', '20', '22', '23'];
            } else {
                // Console: 2, 3, 10, 11, 14, 15, 22, 23
                expectedOL = ['2', '3', '10', '11', '14', '15', '22', '23'];
            }

            for (const [pin, val] of Object.entries(data)) {
                if (val.toUpperCase() === 'OL') {
                    totalOLCount++;
                    if (!expectedOL.includes(pin)) {
                        olPins.push(pin);
                    }
                }
            }

            // Check for Ripped Off Port (Most/All pins OL)
            // If > 20 OLs, likely ripped off or major disconnect
            // For Dock, if even VBUS is OL, that's bad.
            // If olPins has entries, it means VBUS or GND is OL (critical)

            if (totalOLCount >= 23) { // 23 or 24 pins OL
                el.innerHTML = `<strong style="color:var(--accent-red);">RIPPED OFF</strong> <span style="color:var(--text-muted);">(${totalOLCount} OL)</span>`;
            } else if (olPins.length > 0) {
                el.innerHTML = `<span style="color:var(--accent-red); font-weight:bold;">OL: ${olPins.join(',')}</span>`;
            } else if (Object.keys(data).length > 0) {
                el.innerHTML = `<span style="color:var(--accent-green); font-weight:bold;">PINS OK</span>`;
            } else {
                // Empty JSON
                el.innerHTML = `<span style="color:var(--text-muted);">CHECKED</span>`;
            }
        } catch (e) { console.error(e); }
    });

    // Search Filter
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', function () {
            let filter = this.value.toUpperCase();
            let rows = document.querySelector("#unitsTable tbody").rows;

            for (let i = 0; i < rows.length; i++) {
                let text = rows[i].textContent || rows[i].innerText;
                if (text.toUpperCase().indexOf(filter) > -1) {
                    rows[i].style.display = "";
                } else {
                    rows[i].style.display = "none";
                }
            }
        });
    }

    // Load QWERTY fix setting from localStorage
    const toggleBtn = document.getElementById('qwerty-toggle');
    if (toggleBtn) {
        const savedSetting = localStorage.getItem('qwerty-fix-enabled');

        // Default to true if not set
        if (savedSetting === null) {
            localStorage.setItem('qwerty-fix-enabled', 'true');
            toggleBtn.classList.add('active');
        } else {
            if (savedSetting === 'true') {
                toggleBtn.classList.add('active');
            } else {
                toggleBtn.classList.remove('active');
            }
        }
    }
});

// Global functions for inline handlers

window.toggleQwertyFix = function () {
    const toggleBtn = document.getElementById('qwerty-toggle');
    const isActive = toggleBtn.classList.toggle('active');
    localStorage.setItem('qwerty-fix-enabled', isActive ? 'true' : 'false');
}

window.navigateToUnit = function (barcode) {
    const fixEnabled = localStorage.getItem('qwerty-fix-enabled') === 'true';
    if (fixEnabled && window.fixQwerty) {
        barcode = window.fixQwerty(barcode);
    }
    window.location.href = '/unit/' + barcode;
}

window.handleScan = function () {
    const input = document.getElementById('manual-barcode');
    const fixEnabled = localStorage.getItem('qwerty-fix-enabled') === 'true';
    let val = input.value.trim();

    if (val && fixEnabled && window.fixQwerty) {
        val = window.fixQwerty(val);
    }

    if (val) {
        window.location.href = '/unit/' + val;
    }
}

// Simple Sort Function
window.sortTable = function (n) {
    var table, rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
    table = document.getElementById("unitsTable");
    switching = true;
    dir = "asc";

    while (switching) {
        switching = false;
        rows = table.rows;

        for (i = 1; i < (rows.length - 1); i++) {
            shouldSwitch = false;
            x = rows[i].getElementsByTagName("TD")[n];
            y = rows[i + 1].getElementsByTagName("TD")[n];

            // Handle numeric sorting for Label and Barcode if needed, 
            // but string sort is usually fine for mixed IDs.
            // For Date (Column 6), let's just do string compare for now 
            // since format is YYYY-MM-DD HH:MM

            if (dir == "asc") {
                if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
                    shouldSwitch = true;
                    break;
                }
            } else if (dir == "desc") {
                if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) {
                    shouldSwitch = true;
                    break;
                }
            }
        }
        if (shouldSwitch) {
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true;
            switchcount++;
        } else {
            if (switchcount == 0 && dir == "asc") {
                dir = "desc";
                switching = true;
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    let buffer = '';
    let lastKeyTime = Date.now();
    const SCANNER_TIMEOUT = 50; // ms between keys for scanner, manual typing is slower

    document.addEventListener('keydown', (e) => {
        const currentTime = Date.now();
        const timeDiff = currentTime - lastKeyTime;
        lastKeyTime = currentTime;

        // Ignore inputs on form elements (except if we want to support scanning into them? 
        // usually safer to let scanning override navigation if checking a unit)
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        if (e.key === 'Enter') {
            if (buffer.length > 3) { // Assume valid barcode is at least 4 chars
                // Trigger scanner event
                handleScan(buffer);
            }
            buffer = '';
        } else if (e.key.length === 1) { // Printable chars
            // If time diff is large, reset buffer (it was manual typing likely)
            // But scanners can be slow sometimes, allow 100ms? 
            if (timeDiff > 100) {
                buffer = '';
            }
            buffer += e.key;
        }
    });

    function handleScan(barcode) {
        // Apply QWERTY fix if enabled in localStorage
        const fixEnabled = localStorage.getItem('qwerty-fix-enabled');
        // Default to true if not set
        if (fixEnabled === null || fixEnabled === 'true') {
            barcode = fixQwerty(barcode);
        }

        // Dispatch event for UI feedback
        const event = new CustomEvent('scanner-input', { detail: barcode });
        document.dispatchEvent(event);

        // Flash screen or sound?
        console.log("Scanned:", barcode);

        // Navigate to unit page
        window.location.href = `/unit/${barcode}`;
    }

    function fixQwerty(input) {
        // AZERTY <-> QWERTY conversion
        const map = {
            'A': 'Q', 'Q': 'A', 'Z': 'W', 'W': 'Z',
            'a': 'q', 'q': 'a', 'z': 'w', 'w': 'z',
            'm': ',', ',': 'm', 'M': '?', '?': 'M',
            '&': '1', 'é': '2', '"': '3', "'": '4', '(': '5',
            '-': '6', 'è': '7', '_': '8', 'ç': '9', 'à': '0',
            ')': '-', '=': '='
        };
        return input.split('').map(char => map[char] || char).join('');
    }
});

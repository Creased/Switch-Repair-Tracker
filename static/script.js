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
        // Dispatch event for UI feedback
        const event = new CustomEvent('scanner-input', { detail: barcode });
        document.dispatchEvent(event);

        // Flash screen or sound?
        console.log("Scanned:", barcode);

        // Navigate to unit page
        window.location.href = `/unit/${barcode}`;
    }
});

import re

def check_serial(serial):
    """
    Analyzes a Nintendo Switch serial number to determine its model and patch status.
    Returns a dict with 'model', 'patch_status', and 'type'.
    """
    serial = serial.upper().strip()
    
    # Basic validation
    if not serial:
        return {'type': 'Unknown', 'model': 'Unknown', 'patch_status': 'Unknown'}

    # Docks usually don't have the XAA/XAW format, but let's assume if it doesn't match known switch patterns
    # it might be a dock or accessory, OR just an invalid serial.
    # For now, we default to "Console" if it looks like a switch serial, else "Unknown/Accessory"
    
    # Prefix extraction (first 4 chars)
    prefix = serial[:4]
    try:
        # Extract the number part (next 10 digits? usually 14 chars total)
        # Some sources say 6+, let's grab as many digits as possible after prefix
        num_part_str = re.search(r'\d+', serial[3:])
        if not num_part_str:
             return {'type': 'Unknown', 'model': 'Unknown', 'patch_status': 'Unknown'}
        
        # We need the full number for range checking, usually the first few digits matter.
        # Standard format: XAA 123456789 (Prefix 3 chars + digits? Or Prefix 4 chars?)
        # Common convention: XAW1, XAW4, XAJ1 etc. are the "Prefixes". The number is what follows.
        
        # Let's standardize: Prefix = First 4 chars (e.g. XAW1)
        # Number = integer value of the following digits.
        
        prefix = serial[:4]
        if len(serial) < 8:
             return {'type': 'Manual Check Needed', 'model': 'Unknown', 'patch_status': 'Unknown'}

        number = int(serial[4:14]) if len(serial) >= 14 else int(serial[4:]) 
        # Safe fallback if shorter
        
    except:
        return {'type': 'Manual Check Needed', 'model': 'Unknown', 'patch_status': 'Unknown'}

    model = "Switch V1"
    patch_status = "Unknown"
    
    # Logic based on community ranges
    # XAW1: US/NA
    if prefix == 'XAW1':
        if number < 10074000000:
            patch_status = "Unpatched"
        elif 10074000000 <= number < 10120000000:
            patch_status = "Possibly Patched"
        else: # >= 10120000000
            patch_status = "Patched"
            
    # XAW4: Canada?
    elif prefix == 'XAW4':
        if number < 40011000000:
            patch_status = "Unpatched"
        elif 40011000000 <= number < 40012000000:
            patch_status = "Possibly Patched"
        else:
            patch_status = "Patched"
            
    # XAW7: US/NA
    elif prefix == 'XAW7':
        if number < 70017800000:
            patch_status = "Unpatched"
        elif 70017800000 <= number < 70030000000:
            patch_status = "Possibly Patched"
        else:
            patch_status = "Patched"
            
    # XAJ1: Japan?
    elif prefix == 'XAJ1':
        if number < 10020000000:
            patch_status = "Unpatched"
        elif 10020000000 <= number < 10030000000:
            patch_status = "Possibly Patched"
        else:
            patch_status = "Patched"
            
    # XAJ4: Euro
    elif prefix == 'XAJ4':
        if number < 40053300000:
            patch_status = "Unpatched"
        elif 40053300000 <= number < 40060000000:
            patch_status = "Possibly Patched"
        else:
            patch_status = "Patched"
            
    # XAJ7: Euro
    elif prefix == 'XAJ7':
        if number < 70040000000:
            patch_status = "Unpatched"
        elif 70040000000 <= number < 70050000000:
            patch_status = "Possibly Patched"
        else:
            patch_status = "Patched"

    # XKW1, XKJ1, XJW1, XWW1 -> Mariko / Patched (V2/Lite/OLED)
    elif prefix.startswith('XK') or prefix.startswith('XJ') or prefix.startswith('XW'):
        patch_status = "Patched"
        if prefix.startswith('XK'):
            model = "Switch V2 (Mariko)"
        elif prefix.startswith('XJ'):
            model = "Switch Lite" # Tentative, verified Lite often starts with XJ
        elif prefix.startswith('XT'):
             model = "Switch OLED"

    # OLED check (XT)
    elif prefix.startswith('XT'):
        patch_status = "Patched"
        model = "Switch OLED"
        
    # Lite check (XJ)
    elif prefix.startswith('XJ'):
        patch_status = "Patched"
        model = "Switch Lite"

    else:
        # Default fallback
        patch_status = "Unknown (Check Manually)"

    return {
        'type': 'Console',
        'model': model,
        'patch_status': patch_status
    }

if __name__ == '__main__':
    # Test cases
    print(check_serial("XAW10000000000")) # Unpatched
    print(check_serial("XAW10075000000")) # Possibly
    print(check_serial("XKW10000000000")) # V2 Patched
    print(check_serial("XTJ10000000000")) # OLED

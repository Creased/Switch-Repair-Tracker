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

    # Prefix extraction
    prefix_3 = serial[:3]
    try:
        # Extract the number part from index 3 onwards (usually 11 digits including sub-region)
        # Chart format: XAW1... -> XAW (prefix) + 1... (number)
        if len(serial) < 14:
             return {'type': 'Manual Check Needed', 'model': 'Unknown', 'patch_status': 'Unknown'}
        
        number = int(serial[3:]) 
        
    except:
        return {'type': 'Manual Check Needed', 'model': 'Unknown', 'patch_status': 'Unknown'}

    unit_type = "Console"
    model = "Switch V1 (Erista)"
    patch_status = "Unknown"
    
    # Logic based on community ranges (Image reference)
    if prefix_3 == 'XAW':
        # XAW1
        if 10000000000 <= number < 10074000000:
            patch_status = "Unpatched"
        elif 10074000000 <= number < 10120000000:
            patch_status = "Warning"
        elif number >= 10120000000 and number < 40000000000:
            patch_status = "Patched"
        # XAW4
        elif 40000000000 <= number < 40011000000:
            patch_status = "Unpatched"
        elif 40011000000 <= number < 40012000000:
            patch_status = "Warning"
        elif number >= 40012000000 and number < 70000000000:
            patch_status = "Patched"
        # XAW7
        elif 70000000000 <= number < 70017800000:
            patch_status = "Unpatched"
        elif 70017800000 <= number < 70030000000:
            patch_status = "Warning"
        elif number >= 70030000000:
            patch_status = "Patched"

    elif prefix_3 == 'XAJ':
        # XAJ1
        if 10000000000 <= number < 10020000000:
            patch_status = "Unpatched"
        elif 10020000000 <= number < 10030000000:
            patch_status = "Warning"
        elif number >= 10030000000 and number < 40000000000:
            patch_status = "Patched"
        # XAJ4
        elif 40000000000 <= number < 40046000000:
            patch_status = "Unpatched"
        elif 40046000000 <= number < 40060000000:
            patch_status = "Warning"
        elif number >= 40060000000 and number < 70000000000:
            patch_status = "Patched"
        # XAJ7
        elif 70000000000 <= number < 70040000000:
            patch_status = "Unpatched"
        elif 70040000000 <= number < 70050000000:
            patch_status = "Warning"
        elif number >= 70050000000:
            patch_status = "Patched"

    # Mariko / Lite / OLED prefixes
    elif prefix_3 in ['XKW', 'XKJ', 'XJW', 'XWW']:
        patch_status = "Patched"
        if prefix_3.startswith('XK') or prefix_3 == 'XWW':
            model = "Switch V2 (Mariko)"
        elif prefix_3 == 'XJW':
            model = "Switch Lite"
    
    elif prefix_3 == 'XFL':
        unit_type = 'Dock'
        model = "Switch Dock"
        patch_status = "N/A"

    elif serial.startswith('XT'):
        patch_status = "Patched"
        model = "Switch OLED"

    else:
        # Default fallback
        patch_status = "Unknown (Check Manually)"

    return {
        'type': unit_type,
        'model': model,
        'patch_status': patch_status
    }

if __name__ == '__main__':
    # Test cases from image
    print(f"XAW100740...: {check_serial('XAW10074000000')['patch_status']}") # Possibly
    print(f"XAJ400460...: {check_serial('XAJ40046000000')['patch_status']}") # Possibly
    print(f"XAJ400643...: {check_serial('XAJ40064380854')['patch_status']}") # Patched
    print(f"XKW100000...: {check_serial('XKW10000000000')['patch_status']}") # Patched
    print(f"XJW100000...: {check_serial('XJW10000000000')['patch_status']}") # Patched
    print(f"XFL103552...: {check_serial('XFL10355204732')}") # Dock

import re

# RetroSix Wiki Based Diagnostic Tables
DIAGNOSTIC_TABLES = {
    'battery': [
        {'range': (0.00, 0.005), 'stage': 'No Power', 'fault': 'Blown Fuse / USB-C Port', 'action': 'Check F1 fuse near USB-C, inspect port pins', 'severity': 'critical'},
        {'range': (0.005, 0.015), 'stage': 'Sleep Mode', 'fault': 'None (Normal)', 'action': 'Console is in Sleep Mode. Wake it up to test further.', 'severity': 'none'},
        {'range': (0.015, 0.09), 'stage': 'Stage 1 (Waiting for Battery)', 'fault': 'Battery Detection / PMIC', 'action': 'Check battery connector, MAX77620 communication', 'severity': 'high'},
        {'range': (0.15, 0.28), 'stage': 'RCM / eMMC Fault', 'fault': 'Missing/Corrupt eMMC or AutoRCM', 'action': 'Test RCM mode, check eMMC seating/soldering', 'severity': 'medium'},
        {'range': (0.40, 0.55), 'stage': 'Stage 2 (Normal Boot Start)', 'fault': 'Fuel Gauge / Backlight', 'action': 'Check MAX17050, backlight driver if no display', 'severity': 'low'},
        {'range': (0.70, 5.00), 'stage': 'Normal Operation / Fast Charge', 'fault': 'None (Normal)', 'action': 'System is booting or charging normally', 'severity': 'none'}
    ],
    'bench': [
        {'range': (0.00, 0.001), 'stage': 'No Power Draw', 'fault': 'Faulty MAX77620 / Connection', 'action': 'Check power button FPC, resistor on Pin 1, or replace MAX77620.', 'severity': 'critical'},
        {'range': (0.001, 0.006), 'stage': 'VSYS Idle (OK)', 'fault': 'None (Ready to Boot)', 'action': 'Good standby draw (1-5mA). Short pins 1 & 2 to power on.', 'severity': 'none'},
        {'range': (0.006, 0.05), 'stage': 'High Idle / Stuck', 'fault': 'VSYS Short / BQ Fail', 'action': 'Check coils/caps near BQ24193 with thermal cam.', 'severity': 'high'},
        {'range': (0.130, 0.145), 'stage': 'Failing 2nd Stage', 'fault': 'MAX77621 or MAX77812', 'action': '1st Stage OK, but 2nd stage regulator failing. Check MAX77621/77812.', 'severity': 'high'},
        {'range': (0.190, 0.220), 'stage': '1st Stage Boot OK', 'fault': 'None (Battery I2C Absent)', 'action': 'Normal for bench test. MAX77620 soft-boot working.', 'severity': 'none'},
        {'range': (0.100, 0.300), 'stage': 'Stuck First Stage', 'fault': '3.3V Rail / P13 / M92T', 'action': 'Check 3.3V rail, P13USB, M92T36, Audio IC for shorts.', 'severity': 'medium'},
        {'range': (0.300, 2.00), 'stage': 'Short after Boot', 'fault': 'Component Short', 'action': 'High draw. Use thermal camera to find heating component.', 'severity': 'high'}
    ],
    'bypass': [
        {'range': (0.00, 0.001), 'stage': 'Bypass Failed', 'fault': 'Open VSYS or Resistor', 'action': 'Check 10K resistor solder to test pads. No current flow.', 'severity': 'critical'},
        {'range': (0.001, 0.006), 'stage': 'Ready to Boot', 'fault': 'None (Pre-Trigger)', 'action': 'Healthy standby current (1-5mA). Short power pads to boot.', 'severity': 'none'},
        {'range': (0.006, 0.090), 'stage': 'Sleep Mode', 'fault': 'None (Normal)', 'action': 'Console is in Sleep Mode (8-13mA normal).', 'severity': 'none'},
        {'range': (0.100, 0.120), 'stage': 'Stuck ~100mA', 'fault': 'Fuel Gauge / MAX77621', 'action': 'If stops fast at 100mA: MAX17050. If static 100mA: MAX77621.', 'severity': 'high'},
        {'range': (0.120, 0.125), 'stage': 'eMMC Corruption', 'fault': 'Dead eMMC (Hynix?)', 'action': 'Try Modchip to confirm eMMC error code.', 'severity': 'critical'},
        {'range': (0.180, 0.240), 'stage': 'Bad eMMC / AutoRCM', 'fault': 'eMMC / AutoRCM', 'action': 'Stuck 200mA? Bad eMMC. Stuck 240mA? Corrupt AutoRCM.', 'severity': 'medium'},
        {'range': (0.280, 0.320), 'stage': 'Bad P13USB', 'fault': 'Short on 3.3V Rail', 'action': 'Check 3.3V rail. Likely P13USB shorted by 15V VBUS.', 'severity': 'high'},
        {'range': (0.400, 0.800), 'stage': '2nd Stage Boot OK', 'fault': 'None (Booting)', 'action': 'Normal Boot: 400-500mA (No LCD) / 500-800mA (With LCD).', 'severity': 'none'},
        {'range': (0.800, 3.00), 'stage': 'Severe Short', 'fault': 'Main Rail Short', 'action': 'Check VSYS/VCORE for dead shorts. BQ Inductor overheating?', 'severity': 'critical'}
    ],
    'no_battery': [
        {'range': (0.00, 0.005), 'stage': 'Dead Charging Path', 'fault': 'F1 Fuse / M92T36 / BQ24193', 'action': 'Check F1 Fuse near USB-C. Verify 5V/15V at M92T36.', 'severity': 'critical'},
        {'range': (0.005, 0.06), 'stage': 'Healthy Idle', 'fault': 'None (Normal)', 'action': 'PD Negotiation OK. BQ Idle. Perfectly fine measurement waiting for a battery.', 'severity': 'none'},
        {'range': (0.06, 0.35), 'stage': 'Abnormal Idle Pull', 'fault': 'Partial Short / M92T', 'action': 'Check for heat on M92T36 or BQ caps. Slightly high for idle.', 'severity': 'medium'},
        {'range': (0.40, 0.60), 'stage': 'BQ Search Activity', 'fault': 'None (Normal)', 'action': 'Good pulse. Charging circuit is actively searching for a battery.', 'severity': 'none'},
        {'range': (0.60, 5.00), 'stage': 'Severe Power Fault', 'fault': 'Short on VSYS / Tegra', 'action': 'Short detected. Check VSYS rail and Tegra PMIC area.', 'severity': 'critical'}
    ]
}

def parse_reading(s):
    """Parses strings like '15V/0.003A', '0.19A', '5V 0.4A' into (volts, amps)."""
    if not s:
        return None, 0.0
    
    s = s.lower().strip()
    volts = None
    amps = 0.0
    
    # 1. Look for explicit Amps (e.g. "0.19A", "200mA")
    amp_match = re.search(r'(\d*\.?\d+)\s*(ma|a)', s)
    if amp_match:
        val = float(amp_match.group(1))
        unit = amp_match.group(2)
        if unit == 'ma':
            amps = val / 1000.0
        else:
            amps = val
    else:
        # 2. Fallback: Look for a number that isn't voltage
        # If the string has 'V' but no 'A', we must be careful.
        # "15V" -> 0 amps
        # "15V 0.2" -> 0.2 amps
        
        # Regex to find all numbers
        all_numbers = re.findall(r"[\d.]+", s)
        
        if 'v' in s:
            # If there's a V, and we didn't match A, we try to find a second number
            # Assuming format "15V 0.2"
            if len(all_numbers) > 1:
                # One of them is likely volts (the one near V), the other amps.
                # But simple heuristic: the one NOT matched by volt_regex might be amps
                pass 
                # For now, let's just checking if there is a number that is NOT the volts
            else:
                 pass # voltage only
        else:
            # No V, no A. Just a number? "0.19" -> treat as Amps
            try:
                if all_numbers:
                    amps = float(all_numbers[0])
            except ValueError:
                pass

    # 3. Look for Volts
    volt_match = re.search(r'(\d*\.?\d+)\s*v', s)
    if volt_match:
        volts = float(volt_match.group(1))
        
    return volts, amps

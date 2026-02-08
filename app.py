from flask import Flask, render_template, request, jsonify, g, redirect, url_for
import sqlite3
import os
import re

app = Flask(__name__)
DATABASE = 'repairs.db'

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

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
        {'range': (0.00, 0.006), 'stage': 'Standby / Pre-Trigger', 'fault': 'None (Waiting for Power)', 'action': 'Device is powered but not booted. Short power pins to boot.', 'severity': 'none'},
        {'range': (0.006, 0.05), 'stage': 'Stuck Early', 'fault': 'Faulty MAX77620', 'action': 'PMIC not starting. Check MAX77620 enable lines.', 'severity': 'high'},
        {'range': (0.09, 0.13), 'stage': 'Low Boot Draw', 'fault': 'MAX77621 or MAX77812', 'action': 'Check CPU/GPU buck regulators and around NVIDIA SoC.', 'severity': 'high'},
        {'range': (0.18, 0.22), 'stage': 'RCM / Waiting for eMMC', 'fault': 'eMMC / AutoRCM', 'action': 'Normal draw for RCM. If stuck, check eMMC connection.', 'severity': 'medium'},
        {'range': (0.40, 0.50), 'stage': 'Mid-Boot Stuck', 'fault': 'Current Limit reached?', 'action': 'Verify 2.0A+ limit on bench supply. Check display init.', 'severity': 'medium'},
        {'range': (0.20, 0.80), 'stage': 'M92T Loop', 'fault': 'M92T36 Fault', 'action': 'Current jumping 200mA->700mA loop? Replace M92T36.', 'severity': 'high'}
    ],
    'bypass': [
        {'range': (0.00, 0.001), 'stage': 'Bypass Failed', 'fault': 'Open VSYS or Resistor', 'action': 'Check 10K resistor solder to test pads. No current flow.', 'severity': 'critical'},
        {'range': (0.001, 0.006), 'stage': 'Ready to Boot', 'fault': 'None (Pre-Trigger)', 'action': 'Healthy standby current (1-5mA). Short power pads to boot.', 'severity': 'none'},
        {'range': (0.006, 0.15), 'stage': 'Low Pull', 'fault': 'PMIC / MAX77621 Fault', 'action': 'Check MAX77621 (CPU/GPU) outputs.', 'severity': 'high'},
        {'range': (0.15, 0.25), 'stage': 'Stage 1 Active', 'fault': '1st Boot Stage OK', 'action': 'Passed 1st stage. If stuck here, check eMMC/RAM.', 'severity': 'none'},
        {'range': (0.35, 0.55), 'stage': 'Stage 2 Active', 'fault': '2nd Boot Stage OK', 'action': 'Passed 2nd stage. Console should be booting.', 'severity': 'none'}
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
    if not s: return None, 0.0
    s = s.lower().strip()
    
    volts = None
    amps = 0.0
    
    # specific regex for amps
    # Look for number followed optionally by space, then 'ma' or 'a'
    # We prefer the one with 'a' or 'ma' explicitly.
    # If no 'a'/'ma' found, we assume the whole string (or first number) might be amps if no voltage chars exists?
    # Actually, simpler: search for pattern `(\d*\.?\d+)\s*(ma|a)`
    amp_match = re.search(r'(\d*\.?\d+)\s*(ma|a)', s)
    
    if amp_match:
        val = float(amp_match.group(1))
        unit = amp_match.group(2)
        if unit == 'ma':
            amps = val / 1000.0
        else:
            amps = val
    else:
        # Fallback for plain numbers like "0.19"
        # Only if it doesn't look like voltage "15V"
        # If "15V" is the only thing, we shouldn't treat 15 as amps.
        if 'v' not in s: 
            try:
                # simple extract first float
                amps = float(re.findall(r"[\d.]+", s)[0])
            except:
                amps = 0.0
        else:
            # Contains V but no A? "15V". Amps is unknown/0.
            # But maybe they wrote "15V 0.2".
            # Try to find a number that is NOT the volts number.
            pass

    # Search for Volts
    volt_match = re.search(r'(\d*\.?\d+)\s*v', s)
    if volt_match:
        volts = float(volt_match.group(1))
        
    return volts, amps

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        with app.open_resource('schema.sql', mode='r') as f:
            db.cursor().executescript(f.read())
        db.commit()

def fix_qwerty(barcode):
    """Convert QWERTY-scanned barcode to AZERTY equivalent"""
    qwerty_map = {
        'A': 'Q', 'Q': 'A', 'Z': 'W', 'W': 'Z',
        'a': 'q', 'q': 'a', 'z': 'w', 'w': 'z',
        'm': ',', ',': 'm', 'M': '?', '?': 'M',
        '&': '1', 'é': '2', '"': '3', "'": '4', '(': '5', 
        '-': '6', 'è': '7', '_': '8', 'ç': '9', 'à': '0',
        ')': '-', '=': '='
    }
    return ''.join(qwerty_map.get(char, char) for char in barcode)

@app.route('/')
def index():
    db = get_db()
    cursor = db.execute('SELECT * FROM units ORDER BY updated_at DESC')
    units = cursor.fetchall()
    
    # Simple stats
    total = len(units)
    in_progress = sum(1 for u in units if u['status'] not in ('Done', 'Delivered', 'Cancelled'))
    
    return render_template('index.html', units=units, total=total, in_progress=in_progress)

@app.route('/unit/<barcode>', methods=['GET', 'POST'])
def unit_detail(barcode):
    db = get_db()
    
    if request.method == 'POST':
        model = request.form.get('model')
        issue = request.form.get('issue')
        status = request.form.get('status')
        notes = request.form.get('notes')
        label = request.form.get('label')
        unit_type = request.form.get('type')
        
        # Technical Fields
        pin_check = request.form.get('pin_check')
        usb_c_reading = request.form.get('usb_c_reading')
        amp_draw = request.form.get('amp_draw')
        condition_notes = request.form.get('condition_notes')
        owner = request.form.get('owner')
        
        # Modchip field
        modchip_type = request.form.get('modchip_type')
        modchip = modchip_type if modchip_type else None
        
        # If model/type/patch_status are missing or generic, try SSNC
        # But if user manually set them (implied by POST), we might respect that.
        # However, for 'Console' type, we can re-verify patch status if model changed?
        # Simpler: If it's a console and we have a serial, update patch status based on serial
        patch_status = None
        if unit_type == 'Console':
            from ssnc import check_serial
            info = check_serial(barcode)
            # Only overwrite if valid info found or to keep in sync
            if info['patch_status'] != 'Unknown':
               patch_status = info['patch_status']
            
            # Also update model if SSNC detects a specific type (e.g. OLED/Lite/Mariko)
            # This ensures the DB stays in sync with the serial number
            if info['model'] != 'Unknown' and info['model'] != 'Nintendo Switch':
                model = info['model']
            elif info['model'] == 'Nintendo Switch' and not model:
                # Fallback if model was empty
                model = info['model']

        # Check if exists
        exists = db.execute('SELECT id FROM units WHERE barcode = ?', (barcode,)).fetchone()
        
        if exists:
            query = '''
                UPDATE units SET model = ?, issue = ?, status = ?, notes = ?, label = ?, type = ?, 
                pin_check = ?, usb_c_reading = ?, amp_draw = ?, condition_notes = ?, owner = ?, modchip = ?,
                updated_at = CURRENT_TIMESTAMP
            '''
            params = [model, issue, status, notes, label, unit_type, pin_check, usb_c_reading, amp_draw, condition_notes, owner, modchip]
            
            if patch_status:
                query += ', patch_status = ?'
                params.append(patch_status)
                
            query += ' WHERE barcode = ?'
            params.append(barcode)
            
            db.execute(query, params)
        else:
            # New unit logic
            if not patch_status and unit_type == 'Console':
                 from ssnc import check_serial
                 info = check_serial(barcode)
                 patch_status = info['patch_status']
                 if not model and info['model'] != 'Unknown':
                     model = info['model']

            db.execute('''
                INSERT INTO units (barcode, model, issue, status, notes, label, type, patch_status,
                pin_check, usb_c_reading, amp_draw, condition_notes, owner, modchip)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (barcode, model, issue, status, notes, label, unit_type, patch_status, 
                  pin_check, usb_c_reading, amp_draw, condition_notes, owner, modchip))
            
        db.commit()
        return redirect(url_for('unit_detail', barcode=barcode))

    unit = db.execute('SELECT * FROM units WHERE barcode = ?', (barcode,)).fetchone()
    
    # If not found, try QWERTY-fixed version
    if not unit:
        fixed_barcode = fix_qwerty(barcode)
        if fixed_barcode != barcode:  # Only if translation actually changed something
            unit_fixed = db.execute('SELECT * FROM units WHERE barcode = ?', (fixed_barcode,)).fetchone()
            if unit_fixed:
                # Redirect to the correct barcode
                return redirect(url_for('unit_detail', barcode=fixed_barcode))
    
    # Auto-filling for new scans (GET request for non-existent unit)
    if not unit:
        from ssnc import check_serial
        info = check_serial(barcode)
        # Create a dummy unit dict for properly pre-filling the template
        unit = {
            'model': info['model'] if info['model'] != 'Unknown' else 'Nintendo Switch',
            'type': info['type'],
            'patch_status': info['patch_status'],
            'status': 'Received', # Default for new
            'label': '',
            'issue': '',
            'notes': ''
        }
        # We don't save it yet, just pre-fill
        pass # Template handles None unit, but we want values. 
             # Actually template uses `unit.model` if unit else ...
             # We can pass `prefill` data

    return render_template('unit.html', barcode=barcode, unit=unit)

@app.route('/api/search')
def search():
    query = request.args.get('q')
    if not query:
        return jsonify([])
    db = get_db()
    # Simple search by barcode or model
    cursor = db.execute("SELECT * FROM units WHERE barcode LIKE ? OR model LIKE ?", ('%'+query+'%', '%'+query+'%'))
    results = [dict(row) for row in cursor.fetchall()]
    return jsonify(results)

@app.route('/api/next-label')
def next_label():
    db = get_db()
    # Find all labels starting with SW (case insensitive)
    cursor = db.execute("SELECT label FROM units WHERE label LIKE 'SW%'")
    rows = cursor.fetchall()
    
    max_num = 0
    for row in rows:
        label = row['label']
        # Extract number part (SW022 -> 22)
        try:
            # Remove 'SW' and convert to int
            num_part = label.upper().replace('SW', '')
            num = int(num_part)
            if num > max_num:
                max_num = num
        except ValueError:
            continue
            
    next_num = max_num + 1
    # Format as SW023 (3 digits)
    return jsonify({'next_label': f"SW{next_num:03d}"})

@app.route('/api/diagnose-boot', methods=['POST'])
def diagnose_boot():
    data = request.get_json()
    amp_str = data.get('amp_draw', '').strip()
    test_method = data.get('test_method', 'battery')
    
    # Parse reading (Volts and Amps)
    volts, amp_val = parse_reading(amp_str)
    
    # Get table for method
    table = DIAGNOSTIC_TABLES.get(test_method, DIAGNOSTIC_TABLES['battery'])
    
    # Precise Voltage/Method Logic (Overrides)
    result = None
    
    if test_method == 'no_battery':
        if volts is not None and volts >= 12.0:
            # 15V Detected (Charging Enabled)
            if amp_val <= 0.08:
                result = {
                    'range': (0.00, 0.08),
                    'stage': '15V Healthy Idle',
                    'fault': 'None (Normal)',
                    'action': f'15V Negotiated. Low draw ({amp_val}A) is normal behavior without battery.',
                    'severity': 'none'
                }
        elif volts is not None and volts < 4.5:
             result = {
                'stage': 'VBUS Undervoltage',
                'fault': 'Bad Cable / Port / Fuse',
                'action': f'{volts}V on VBUS is too low. Check USB-C cable, port, and F1 fuse.',
                'severity': 'critical'
            }
        elif volts is not None and 4.0 < volts < 6.0:
            # 5V Detected logic...
            pass

    if test_method == 'bench':
        if volts is not None and volts > 5.0:
            result = {
                'stage': 'High Voltage on Bench Input',
                'fault': 'User Error?',
                'action': f'{volts}V detected. Bench supply should be set to ~4.2V (Battery Voltage). Did you enter a USB-C reading?',
                'severity': 'high'
            }

    if test_method == 'battery':
        if volts is not None and volts < 4.5:
            result = {
                'stage': 'VBUS Undervoltage',
                'fault': 'Bad Cable / Port / Fuse',
                'action': f'{volts}V on VBUS is too low. Check USB-C cable, port, and F1 fuse.',
                'severity': 'critical'
            }
        elif volts is not None and volts > 12.0 and amp_val <= 0.08:
             # Also allow 15V healthy idle for battery mode (charged battery > 15V negotiation > low current)
             result = {
                'stage': '15V Healthy Idle',
                'fault': 'None (Normal)',
                'action': f'15V Negotiated. Low draw ({amp_val}A) implies battery is full or system is idle.',
                'severity': 'none'
            }

    if test_method == 'bypass':
        if volts is not None and volts > 5.0:
             # ... existing bypass logic ...
             result = {
                'stage': 'High Voltage on VSYS',
                'fault': 'User Error / MOSFET Short',
                'action': f'{volts}V detected on VSYS! Stop immediately. Bypass mode requires 4.2V injection, NOT USB-C charger.',
                'severity': 'critical'
            }
    
    if not result:
        # Fallback to standard range lookup
        result = {
            'stage': 'Unknown Behavior',
            'fault': 'Unrecognized Amp Draw',
            'action': 'Consult advanced schematics or RetroSix Wiki',
            'severity': 'medium',
            'amps': amp_val,
            'method_used': test_method
        }
        
        for stage in table:
            low, high = stage['range']
            if low <= amp_val < high:
                result.update(stage)
                break
                
    # Add metadata
    result['amps'] = amp_val
    result['volts'] = volts
    result['method_used'] = test_method
            
    return jsonify(result)

if __name__ == '__main__':
    if not os.path.exists(DATABASE):
        print("Initializing database...")
        init_db()
    app.run(debug=True)

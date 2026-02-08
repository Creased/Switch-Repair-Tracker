from flask import Flask, render_template, request, jsonify, g, redirect, url_for
import sqlite3
import os

app = Flask(__name__)
DATABASE = 'repairs.db'

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

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
                pin_check = ?, usb_c_reading = ?, amp_draw = ?, condition_notes = ?,
                updated_at = CURRENT_TIMESTAMP
            '''
            params = [model, issue, status, notes, label, unit_type, pin_check, usb_c_reading, amp_draw, condition_notes]
            
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
                pin_check, usb_c_reading, amp_draw, condition_notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (barcode, model, issue, status, notes, label, unit_type, patch_status, 
                  pin_check, usb_c_reading, amp_draw, condition_notes))
            
        db.commit()
        return redirect(url_for('unit_detail', barcode=barcode))

    unit = db.execute('SELECT * FROM units WHERE barcode = ?', (barcode,)).fetchone()
    
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

if __name__ == '__main__':
    if not os.path.exists(DATABASE):
        print("Initializing database...")
        init_db()
    app.run(debug=True)

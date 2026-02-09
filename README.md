# Switch Repair Tracker & Diagnostic Assistant

A specialized tool for Nintendo Switch repair technicians to track units, diagnose power faults, and verify USB-C port integrity.

## Features

*   **Unit Tracking**: Register units via barcode scanning or manual entry. Tracks model, owner, issue, and repair status.
*   **Serial Number Checker**: Automatically detects model (V1 Erista, V2 Mariko, Lite, OLED) and patch status (Patched/Unpatched) based on serial prefix.
*   **USB-C Pin Tester**: Visual interface for logging diode mode readings from a USB-C breakout board / Mechanic tester. Auto-diagnoses common faults (M92 short, P13USB short, ripped pads).
*   **Boot Diagnostics**: Analyzes power consumption (Amps/Volts) to identify boot stages and faults.
    *   **Battery**: Standard boot analysis.
    *   **Bench (VSYS)**: First stage boot analysis via VSYS injection (1A limit).
    *   **Bypass (VBAT)**: Second stage boot analysis via VBAT injection + 10K resistor (2A limit).
    *   **No Battery**: USB-C input analysis for charging circuit health.

## Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

## Usage

1.  Run the application:
    ```bash
    python app.py
    ```
2.  Open your browser to `http://127.0.0.1:5000`.

## Diagnostic Modes

### First Stage Boot (VSYS)
*   Connect Red Probe to **VSYS Coil**.
*   Connect Black Probe to **Ground**.
*   Inject **4.2V** with **1A Limit**.
*   Short Pins 1 & 2 to boot.

### Second Stage Boot (Bypass)
*   Connect Red Probe to **VBAT**.
*   Connect Black Probe to **Ground**.
*   Connect **10K Resistor** between VSYS and VBAT.
*   Inject **4.2V** with **2A Limit**. (Crucial: 2A required for second stage).

## License

Open Source.

import sys
import os
import subprocess
from flask import Flask, request, jsonify, render_template, send_from_directory
import serial.tools.list_ports
from flask_cors import CORS
import tempfile
import json
from flask_socketio import SocketIO, emit
import serial
import threading

app = Flask(__name__, static_folder='../', static_url_path='')
# Configure CORS to allow all origins for local development
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

selected_board = "arduino:avr:uno"

BOARD_FQBN_MAP = {
    "arduino_uno": "arduino:avr:uno",
    "esp32": "esp32:esp32:esp32s3",  # Default to ESP32-S3 for 'esp32'
    "esp32s3": "esp32:esp32:esp32s3",
    "esp8266": "esp8266:esp8266:nodemcuv2",
    # Add more as needed
}

def get_arduino_cli_path():
    # Try project root first
    root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    exe_path = os.path.join(root_path, 'arduino-cli.exe')
    if os.path.exists(exe_path):
        return exe_path
    # Fallback to current dir (for PyInstaller)
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, 'arduino-cli.exe')
    return 'arduino-cli.exe'  # fallback: rely on PATH

@app.route('/set_board', methods=['POST'])
def set_board():
    global selected_board
    board = request.form.get('board')
    if board:
        selected_board = board
        return f"Board set to {board}", 200
    return "No board specified", 400

@app.route('/compile', methods=['POST'])
def compile_code():
    code = request.data.decode('utf-8')
    # Save code to a temporary .ino file with the correct name
    with tempfile.TemporaryDirectory() as tmpdirname:
        folder_name = os.path.basename(tmpdirname)
        sketch_path = os.path.join(tmpdirname, f"{folder_name}.ino")
        with open(sketch_path, "w", encoding="utf-8") as f:
            f.write(code)
        # Run arduino-cli compile
        arduino_cli_path = get_arduino_cli_path()
        try:
            result = subprocess.run([
                arduino_cli_path, "compile", "--fqbn", selected_board, tmpdirname
            ], capture_output=True, text=True, timeout=60)
            if result.returncode == 0:
                return jsonify({"success": True, "message": result.stdout})
            else:
                return jsonify({"success": False, "message": result.stderr}), 400
        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 500

def detect_fqbn_for_port(port, board_hint=None):
    arduino_cli_path = get_arduino_cli_path()
    try:
        result = subprocess.run(
            [arduino_cli_path, "board", "list", "--format", "json"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            boards = json.loads(result.stdout)
            for b in boards.get("boards", []):
                if b.get("port") == port and b.get("fqbn"):
                    return b["fqbn"]
    except Exception as e:
        print(f"[DETECT FQBN] Error: {e}")
    # Fallback logic
    if board_hint and "8266" in board_hint:
        return "esp8266:esp8266:nodemcuv2"
    return "esp32:esp32:xiaoesp32s3"  # Default to XIAO ESP32-S3

@app.route('/upload', methods=['POST'])
def upload_code():
    code = None
    port = None
    board_hint = None

    if request.is_json:
        data = request.get_json()
        code = data.get('code')
        port = data.get('port')
        board_hint = data.get('board')  # This can be "esp8266", "esp32", etc.
    else:
        code = request.form.get('code') or request.data.decode('utf-8')
        port = request.form.get('port') or request.args.get('port') or request.headers.get('X-Serial-Port')
        board_hint = request.form.get('board')

    if not port:
        print("[UPLOAD] No serial port specified.")
        return jsonify({"success": False, "message": "No serial port specified."}), 400
    if not code:
        print("[UPLOAD] No code provided.")
        return jsonify({"success": False, "message": "No code provided."}), 400

    fqbn = detect_fqbn_for_port(port, board_hint)
    print(f"[UPLOAD] Using FQBN: {fqbn}")

    with tempfile.TemporaryDirectory() as tmpdirname:
        folder_name = os.path.basename(tmpdirname)
        sketch_path = os.path.join(tmpdirname, f"{folder_name}.ino")
        with open(sketch_path, "w", encoding="utf-8") as f:
            f.write(code)
        arduino_cli_path = get_arduino_cli_path()
        # Compile
        compile_result = subprocess.run([
            arduino_cli_path, "compile", "--fqbn", fqbn, tmpdirname
        ], capture_output=True, text=True, timeout=60)
        print("[UPLOAD] Compile stdout:", compile_result.stdout)
        print("[UPLOAD] Compile stderr:", compile_result.stderr)
        if compile_result.returncode != 0:
            print("[UPLOAD] Compile failed.")
            return jsonify({"success": False, "message": compile_result.stderr}), 400
        # Upload
        try:
            upload_cmd = [
                arduino_cli_path, "upload", "-p", port, "--fqbn", fqbn, tmpdirname
            ]
            # Optionally add extra flags for XIAO ESP32-S3
            if fqbn == "esp32:esp32:xiaoesp32s3":
                upload_cmd += ["--flash-mode", "dio", "--flash-freq", "80m", "--flash-size", "8MB"]
            upload_result = subprocess.run(
                upload_cmd,
                capture_output=True, text=True, timeout=60
            )
            print("[UPLOAD] Upload stdout:", upload_result.stdout)
            print("[UPLOAD] Upload stderr:", upload_result.stderr)
            fatal_error = ("A fatal error occurred" in upload_result.stderr or
                           "could not open port" in upload_result.stderr or
                           "FileNotFoundError" in upload_result.stderr)
            if upload_result.returncode == 0 and not fatal_error:
                print("[UPLOAD] Upload succeeded.")
                return jsonify({"success": True, "message": upload_result.stdout})
            else:
                print("[UPLOAD] Upload failed.")
                return jsonify({"success": False, "message": upload_result.stderr}), 400
        except Exception as e:
            print("[UPLOAD] Exception during upload:", str(e))
            return jsonify({"success": False, "message": str(e)}), 500

@app.route('/ports', methods=['GET'])
def list_ports():
    ports = [port.device for port in serial.tools.list_ports.comports()]
    return jsonify(ports)

@app.route('/')
def index():
    return send_from_directory(os.path.dirname(os.path.dirname(__file__)), 'index.html')

@app.route('/status')
def status():
    return jsonify({"status": "Server is running!"})

socketio = SocketIO(app, cors_allowed_origins="*")
serial_conn = None
serial_thread = None
serial_lock = threading.Lock()

def read_serial():
    global serial_conn
    while serial_conn and serial_conn.is_open:
        try:
            data = serial_conn.readline().decode(errors='ignore')
            if data:
                socketio.emit('serial_data', {'data': data})
        except Exception as e:
            break

@socketio.on('open_serial')
def handle_open_serial(data):
    global serial_conn, serial_thread
    port = data.get('port')
    baudrate = int(data.get('baudrate', 9600))
    with serial_lock:
        if serial_conn and serial_conn.is_open:
            emit('serial_status', {'status': 'already_open', 'message': f'Port {serial_conn.port} already open.'})
            return
        try:
            serial_conn = serial.Serial(port, baudrate, timeout=1)
            serial_thread = threading.Thread(target=read_serial, daemon=True)
            serial_thread.start()
            emit('serial_status', {'status': 'connected'})
        except Exception as e:
            emit('serial_status', {'status': 'error', 'message': str(e)})

@socketio.on('close_serial')
def handle_close_serial():
    global serial_conn
    with serial_lock:
        if serial_conn and serial_conn.is_open:
            try:
                serial_conn.close()
                emit('serial_status', {'status': 'disconnected'})
            except Exception as e:
                emit('serial_status', {'status': 'error', 'message': str(e)})
        else:
            emit('serial_status', {'status': 'not_open', 'message': 'No port open.'})

@socketio.on('write_serial')
def handle_write_serial(data):
    global serial_conn
    msg = data.get('data', '')
    with serial_lock:
        if serial_conn and serial_conn.is_open:
            try:
                serial_conn.write(msg.encode())
            except Exception as e:
                emit('serial_status', {'status': 'error', 'message': str(e)})
        else:
            emit('serial_status', {'status': 'not_open', 'message': 'No port open.'})

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5005) 
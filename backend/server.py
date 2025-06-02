import sys
import os
import subprocess
from flask import Flask, request, jsonify, render_template
import serial.tools.list_ports
from flask_cors import CORS
import tempfile

app = Flask(__name__)
# Configure CORS to allow all origins for local development
CORS(app, origins=[
    "http://localhost:5005",
    "http://127.0.0.1:5005",
    "file://",
    "https://basheerbk.github.io"
], supports_credentials=True)

selected_board = "arduino:avr:uno"

def get_arduino_cli_path():
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, 'arduino-cli.exe')
    return os.path.join(os.path.dirname(__file__), 'arduino-cli.exe')

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

@app.route('/upload', methods=['POST'])
def upload_code():
    code = request.data.decode('utf-8')
    port = request.args.get('port') or request.form.get('port') or request.headers.get('X-Serial-Port')
    if not port:
        print("[UPLOAD] No serial port specified.")
        return jsonify({"success": False, "message": "No serial port specified."}), 400
    with tempfile.TemporaryDirectory() as tmpdirname:
        folder_name = os.path.basename(tmpdirname)
        sketch_path = os.path.join(tmpdirname, f"{folder_name}.ino")
        with open(sketch_path, "w", encoding="utf-8") as f:
            f.write(code)
        # Compile first
        arduino_cli_path = get_arduino_cli_path()
        compile_result = subprocess.run([
            arduino_cli_path, "compile", "--fqbn", selected_board, tmpdirname
        ], capture_output=True, text=True, timeout=60)
        print("[UPLOAD] Compile stdout:", compile_result.stdout)
        print("[UPLOAD] Compile stderr:", compile_result.stderr)
        if compile_result.returncode != 0:
            print("[UPLOAD] Compile failed.")
            return jsonify({"success": False, "message": compile_result.stderr}), 400
        # Upload
        try:
            upload_result = subprocess.run([
                arduino_cli_path, "upload", "-p", port, "--fqbn", selected_board, tmpdirname
            ], capture_output=True, text=True, timeout=60)
            print("[UPLOAD] Upload stdout:", upload_result.stdout)
            print("[UPLOAD] Upload stderr:", upload_result.stderr)
            if upload_result.returncode == 0:
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
def home():
    return render_template('index.html')

if __name__ == '__main__':
    print(app.url_map)
    app.run(port=5005) 
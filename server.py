from flask import Flask, request, jsonify, send_from_directory
import os
import serial.tools.list_ports
from flask_cors import CORS
import tempfile
import subprocess

app = Flask(__name__, static_folder='.', static_url_path='')
# Configure CORS to allow all origins for local development
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:*", "http://127.0.0.1:*", "file://*"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "X-Serial-Port"]
    }
})

selected_board = "arduino:avr:uno"

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

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
        try:
            result = subprocess.run([
                "arduino-cli", "compile", "--fqbn", selected_board, tmpdirname
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
        compile_result = subprocess.run([
            "arduino-cli", "compile", "--fqbn", selected_board, tmpdirname
        ], capture_output=True, text=True, timeout=60)
        print("[UPLOAD] Compile stdout:", compile_result.stdout)
        print("[UPLOAD] Compile stderr:", compile_result.stderr)
        if compile_result.returncode != 0:
            print("[UPLOAD] Compile failed.")
            return jsonify({"success": False, "message": compile_result.stderr}), 400
        # Upload
        try:
            upload_result = subprocess.run([
                "arduino-cli", "upload", "-p", port, "--fqbn", selected_board, tmpdirname
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

if __name__ == '__main__':
    print("Starting server at http://localhost:5005")
    print("Open your browser and navigate to http://localhost:5005")
    app.run(port=5005, debug=True) 
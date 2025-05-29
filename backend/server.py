from flask import Flask, request, jsonify
import os
import serial.tools.list_ports
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

selected_board = "arduino:avr:uno"

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
    # Here you would call arduino-cli or similar to compile the code
    # For now, just simulate success
    return jsonify({"success": True, "message": "Code compiled successfully."})

@app.route('/upload', methods=['POST'])
def upload_code():
    code = request.data.decode('utf-8')
    # Here you would call arduino-cli or similar to upload the code
    # For now, just simulate success
    return jsonify({"success": True, "message": "Code uploaded successfully."})

@app.route('/ports', methods=['GET'])
def list_ports():
    ports = [port.device for port in serial.tools.list_ports.comports()]
    return jsonify(ports)

if __name__ == '__main__':
    print(app.url_map)
    app.run(port=5005) 
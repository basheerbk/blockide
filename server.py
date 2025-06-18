from flask_socketio import SocketIO, emit
import serial
import threading

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
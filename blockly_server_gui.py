import threading
import tkinter as tk
from tkinter import messagebox, Listbox
import serial.tools.list_ports
import subprocess
import sys
import os

# Function to start the Flask server in a background thread
def start_server():
    def run():
        # Always run the backend/server.py as a subprocess
        subprocess.Popen([sys.executable, os.path.join('backend', 'server.py')])
    threading.Thread(target=run, daemon=True).start()

# Function to list serial ports
def list_ports():
    ports = [port.device for port in serial.tools.list_ports.comports()]
    port_list.delete(0, tk.END)
    if not ports:
        port_list.insert(tk.END, "No boards detected")
    else:
        for port in ports:
            port_list.insert(tk.END, port)

def on_quit():
    if messagebox.askokcancel("Quit", "Do you want to quit?"):
        root.destroy()

root = tk.Tk()
root.title("Blockly@rduino Server")
root.geometry("400x350")
root.configure(bg="#f0f8ff")

# Mascot image (optional, uses a web image)
try:
    from urllib.request import urlopen
    from PIL import Image, ImageTk
    import io
    mascot_url = "https://cdn-icons-png.flaticon.com/512/616/616494.png"
    with urlopen(mascot_url) as u:
        raw_data = u.read()
    im = Image.open(io.BytesIO(raw_data)).resize((80, 80))
    mascot_img = ImageTk.PhotoImage(im)
    mascot_label = tk.Label(root, image=mascot_img, bg="#f0f8ff")
    mascot_label.pack(pady=(10, 0))
except Exception:
    mascot_label = None

label_title = tk.Label(root, text="Blockly@rduino Server", font=("Arial", 18, "bold"), bg="#f0f8ff", fg="#0074d9")
label_title.pack(pady=(10, 0))
label_status = tk.Label(root, text="Status: Ready!", font=("Arial", 14), bg="#f0f8ff", fg="green")
label_status.pack()

tk.Button(root, text="Show Connected Boards", font=("Arial", 12), command=list_ports, bg="#0074d9", fg="white").pack(pady=10)
port_list = Listbox(root, font=("Arial", 12), width=30)
port_list.pack(pady=5)

info = tk.Label(root, text="1. Open blockly@rduino in your browser.\n2. Start coding and uploading!", font=("Arial", 10), bg="#f0f8ff", fg="#333")
info.pack(pady=10)

tk.Button(root, text="Quit", font=("Arial", 12), command=on_quit, bg="#ff4136", fg="white").pack(pady=10)

# Start the server in the background
start_server()

root.mainloop() 
# Blockly@rduino IDE

A web-based Arduino programming environment using Google's Blockly visual programming language.

## Features

- Visual block-based programming for Arduino
- Real-time code generation
- Serial port communication
- Code compilation and upload
- Support for multiple Arduino boards
- Built-in serial monitor

## Requirements

- Python 3.7+
- Arduino CLI
- Modern web browser

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/blockide.git
cd blockide
```

2. Install Python dependencies:
```bash
cd backend
pip install -r requirements.txt
```

3. Install Arduino CLI:
- Download from: https://arduino.github.io/arduino-cli/latest/installation/
- Add to system PATH

## Usage

1. Start the backend server:
```bash
cd backend
python server.py
```

2. Open `index.html` in your web browser

3. Select your Arduino board and port

4. Start programming with blocks!

## Development

- Frontend: HTML, JavaScript, Blockly
- Backend: Python, Flask
- Arduino: C++

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

#!/usr/bin/env python3
"""
Simple HTTP server to serve Flowstral recorder HTML
Run this, then open http://localhost:8081/flowstral_recorder.html
"""

import http.server
import socketserver
import webbrowser
import threading
import os
from pathlib import Path

PORT = 8081
DIRECTORY = Path(__file__).parent

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def open_browser():
    """Open browser after a short delay"""
    import time
    time.sleep(1)
    webbrowser.open(f'http://localhost:{PORT}/flowstral_recorder.html')

if __name__ == "__main__":
    os.chdir(DIRECTORY)
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"🚀 Flowstral Recorder Server")
        print(f"📁 Serving: {DIRECTORY}")
        print(f"🌐 Open: http://localhost:{PORT}/flowstral_recorder.html")
        print(f"📖 Or use bookmarklet: tools/flowstral_bookmarklet.js")
        print(f"\n⏹  Press Ctrl+C to stop\n")
        
        # Open browser automatically
        threading.Thread(target=open_browser, daemon=True).start()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n✅ Server stopped")




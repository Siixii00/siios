#!/usr/bin/env python3
import http.server
import socketserver
import os

PORT = 8080
DIRECTORY = r"C:\Users\靉嗨三多\Downloads\xiios\siios"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"伺服器啟動在 http://localhost:{PORT}")
    print(f"測試頁面: http://localhost:{PORT}/test-ziwei-mcp.html")
    print("按 Ctrl+C 停止伺服器")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n伺服器已停止")
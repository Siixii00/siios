@echo off
echo 正在啟動本地伺服器...
echo.
echo 伺服器網址: http://localhost:8080
echo 測試頁面: http://localhost:8080/test-ziwei-mcp.html
echo.
echo 按 Ctrl+C 停止伺服器
echo.
cd /d "%~dp0"
python -m http.server 8080
@echo off
chcp 65001 >nul
echo ============================================
echo Bilibili 內容更新器
echo ============================================
echo.

cd /d "%~dp0.."
python scripts\update_bilibili.py

echo.
echo ============================================
echo 更新完成！
echo ============================================
pause
@echo off
echo 🧪 SkillSwap Backend Testing Script
echo ==================================

set BASE_URL=http://localhost:8080

echo.
echo 🔍 Testing Backend Connectivity...

REM Test 1: Basic connectivity
echo Testing server connectivity... 
curl -s -o nul -w "%%{http_code}" "%BASE_URL%" | findstr "200 404" >nul
if %errorlevel% equ 0 (
    echo ✓ Server is running
) else (
    echo ✗ Server is not responding
    echo   Error: Cannot connect to %BASE_URL%
    pause
    exit /b 1
)

REM Test 2: Profile endpoint with valid ID
echo Testing GET /api/profile?id=1... 
curl -s -w "%%{http_code}" "%BASE_URL%/api/profile?id=1" > temp_response.txt
set /p HTTP_CODE=<temp_response.txt
set HTTP_CODE=%HTTP_CODE:~-3%
if "%HTTP_CODE%"=="200" (
    echo ✓ Profile endpoint works
) else if "%HTTP_CODE%"=="404" (
    echo ✓ User not found (expected for new database)
) else (
    echo ✗ Unexpected response
    echo   Error: HTTP %HTTP_CODE%
)

REM Test 3: Profile endpoint with invalid ID
echo Testing GET /api/profile?id=999... 
curl -s -w "%%{http_code}" "%BASE_URL%/api/profile?id=999" > temp_response.txt
set /p HTTP_CODE=<temp_response.txt
set HTTP_CODE=%HTTP_CODE:~-3%
if "%HTTP_CODE%"=="404" (
    echo ✓ Invalid user ID handled correctly
) else (
    echo ✗ Should return 404 for invalid user
    echo   Error: HTTP %HTTP_CODE%
)

REM Test 4: Profile endpoint without ID
echo Testing GET /api/profile (no ID)... 
curl -s -w "%%{http_code}" "%BASE_URL%/api/profile" > temp_response.txt
set /p HTTP_CODE=<temp_response.txt
set HTTP_CODE=%HTTP_CODE:~-3%
if "%HTTP_CODE%"=="400" (
    echo ✓ Missing ID handled correctly
) else (
    echo ✗ Should return 400 for missing ID
    echo   Error: HTTP %HTTP_CODE%
)

REM Test 5: Static files
echo Testing static file serving... 
curl -s -w "%%{http_code}" "%BASE_URL%/static/images/default.svg" > temp_response.txt
set /p HTTP_CODE=<temp_response.txt
set HTTP_CODE=%HTTP_CODE:~-3%
if "%HTTP_CODE%"=="200" (
    echo ✓ Static files served correctly
) else (
    echo ✗ Static file serving failed
    echo   Error: HTTP %HTTP_CODE%
)

REM Test 6: HTML pages
echo Testing HTML page serving... 
curl -s -w "%%{http_code}" "%BASE_URL%/" > temp_response.txt
set /p HTTP_CODE=<temp_response.txt
set HTTP_CODE=%HTTP_CODE:~-3%
if "%HTTP_CODE%"=="200" (
    echo ✓ HTML pages served correctly
) else (
    echo ✗ HTML page serving failed
    echo   Error: HTTP %HTTP_CODE%
)

REM Cleanup
del temp_response.txt

echo.
echo 📊 Test Summary
echo ==================
echo If all tests show ✓, the backend is working correctly!
echo.
echo 🚀 Next Steps:
echo 1. Start frontend: Open frontend/ in Live Server ^(port 5500^)
echo 2. Test complete user flow: Signup → Login → Dashboard → Profile → Chat
echo 3. Check browser console for any remaining errors
echo.
echo 🔗 URLs:
echo Frontend: http://127.0.0.1:5500/frontend/
echo Backend API: %BASE_URL%/api/
echo Profile Test: %BASE_URL%/api/profile?id=1

pause
@echo off
setlocal
cd /d "%~dp0"
if not exist "third_party\Spout2\SPOUTSDK\SpoutLibrary\SpoutLibrary.h" (
  echo Neni k dispozici Spout2 SDK.
  echo Stahni oficialni Spout2 SDK a rozbal ho do third_party\Spout2.
  echo Viz https://github.com/leadedge/Spout2
  pause
  exit /b 1
)
where cmake >nul 2>nul
if errorlevel 1 (
  echo Chybi CMake nebo Visual Studio C++ Build Tools.
  pause
  exit /b 1
)
cmake -S native -B native\build -A x64 -DSPOUT_SDK_ROOT="%~dp0third_party\Spout2"
if errorlevel 1 exit /b 1
cmake --build native\build --config Release
if errorlevel 1 exit /b 1
if not exist "native\bin\Release\LaserSpoutReceiver.exe" (
  echo Chybi vysledny EXE; zkontroluj native\bin.
  exit /b 1
)
copy /Y "native\bin\Release\LaserSpoutReceiver.exe" "native\bin\LaserSpoutReceiver.exe"
if not exist "native\bin\SpoutLibrary.dll" (
  echo Dokopiruj x64 SpoutLibrary.dll ze stejne verze SDK do native\bin.
)
echo Spout receiver: build hotov.
pause

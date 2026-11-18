@echo off
setlocal
rem Open DogLog Studio from a terminal, ex. `doglog match.wpilog`, or control it, ex. `doglog pane create` or `doglog mcp`
set "studio=%~dp0..\doglog-studio.exe"
set "arg=%~1"

rem A log path, or nothing, opens a new window, `start` keeps the terminal from waiting until Studio closes
if "%~1"=="" goto open
if not "%~2"=="" goto run
if "%arg:~0,1%"=="-" goto run
if exist "%~1" goto open
if not "%arg:.=%"=="%arg%" goto open
if not "%arg:\=%"=="%arg%" goto open
if not "%arg:/=%"=="%arg%" goto open

rem Commands and flags run Studio directly, attached to the terminal or the agent that ran them
:run
"%studio%" %*
exit /b %errorlevel%

:open
start "" "%studio%" %*

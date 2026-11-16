@echo off
rem Open DogLog Studio from a terminal, ex. `doglog match.wpilog`
rem `start` keeps the terminal from waiting until Studio closes
start "" "%~dp0..\doglog-studio.exe" %*

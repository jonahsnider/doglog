; Add the `doglog` command to the user's PATH

; Tauri's template only declares StrLoc for the installer
${UnStrRep}

!macro NSIS_HOOK_POSTINSTALL
  ReadRegStr $0 HKCU "Environment" "Path"
  ${StrLoc} $1 "$0;" "$INSTDIR\bin;" ">"
  ${If} $1 == ""
    ; NSIS truncates longer values, so writing it back would lose part of PATH
    StrLen $2 "$0;$INSTDIR\bin"
    ${If} $2 < ${NSIS_MAX_STRLEN}
      ${If} $0 == ""
        WriteRegExpandStr HKCU "Environment" "Path" "$INSTDIR\bin"
      ${Else}
        WriteRegExpandStr HKCU "Environment" "Path" "$0;$INSTDIR\bin"
      ${EndIf}
      SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
    ${Else}
      DetailPrint "PATH is too long to add $INSTDIR\bin"
    ${EndIf}
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Updates don't uninstall, but don't remove it if that changes
  ${If} $UpdateMode <> 1
    ReadRegStr $0 HKCU "Environment" "Path"
    StrLen $2 $0
    IntOp $3 ${NSIS_MAX_STRLEN} - 1
    ${If} $2 < $3
      ${UnStrRep} $1 $0 ";$INSTDIR\bin" ""
      ${UnStrRep} $1 $1 "$INSTDIR\bin;" ""
      ${UnStrRep} $1 $1 "$INSTDIR\bin" ""
      WriteRegExpandStr HKCU "Environment" "Path" $1
      SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
    ${EndIf}
  ${EndIf}
!macroend

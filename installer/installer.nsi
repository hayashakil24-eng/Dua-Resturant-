; Cafe Ali — combined installer for the POS app and the Control Panel.
; Built with plain NSIS + Modern UI 2 rather than electron-builder's NSIS
; target, because electron-builder packages exactly one app per config —
; there's no supported way to get two independently-built Electron apps
; onto one components-selection page through it. Each app is still built
; normally via `npm run dist -- --dir` in its own package (frontend/,
; control-panel/); this script only assembles their already-built
; win-unpacked output into one wizard.

!include "MUI2.nsh"
!include "FileFunc.nsh"

; ---------------------------------------------------------------------------
; Inputs — the win-unpacked directories produced by each app's own build.
; Overridable from the command line, e.g.:
;   makensis /DAPP_SRC=..\frontend\release\win-unpacked installer.nsi
!ifndef APP_SRC
  !define APP_SRC "..\frontend\release\win-unpacked"
!endif
!ifndef CP_SRC
  !define CP_SRC "..\control-panel\release\win-unpacked"
!endif
!ifndef APP_EXE
  !define APP_EXE "Cafe Ali.exe"
!endif
!ifndef CP_EXE
  !define CP_EXE "Cafe Ali Control Panel.exe"
!endif

Name "Cafe Ali"
OutFile "..\release-suite\Cafe Ali Suite Setup 1.0.0.exe"
InstallDir "$PROGRAMFILES64\Cafe Ali"
InstallDirRegKey HKLM "Software\CafeAli" "InstallDir"
RequestExecutionLevel admin
SetCompressor /SOLID lzma
Icon "assets\icon.ico"
UninstallIcon "assets\icon.ico"

Var StartMenuFolder

; ---------------------------------------------------------------------------
; UI

!define MUI_ICON "assets\icon.ico"
!define MUI_UNICON "assets\icon.ico"
!define MUI_ABORTWARNING
!define MUI_UNABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY

!define MUI_STARTMENUPAGE_REGISTRY_ROOT "HKLM"
!define MUI_STARTMENUPAGE_REGISTRY_KEY "Software\CafeAli"
!define MUI_STARTMENUPAGE_REGISTRY_VALUENAME "StartMenuFolder"
!insertmacro MUI_PAGE_STARTMENU StartMenu $StartMenuFolder

!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION "LaunchInstalledApps"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Cafe Ali now"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ---------------------------------------------------------------------------
; Components

Section "Cafe Ali (POS App)" SEC_APP
  SetOutPath "$INSTDIR\App"
  File /r "${APP_SRC}\*.*"

  WriteRegStr HKLM "Software\CafeAli" "AppDir" "$INSTDIR\App"

  !insertmacro MUI_STARTMENU_WRITE_BEGIN StartMenu
    CreateDirectory "$SMPROGRAMS\$StartMenuFolder"
    CreateShortcut "$SMPROGRAMS\$StartMenuFolder\Cafe Ali.lnk" "$INSTDIR\App\${APP_EXE}"
  !insertmacro MUI_STARTMENU_WRITE_END
SectionEnd

SubSection /e "Desktop Shortcut" SEC_APP_SHORTCUT_GROUP
Section "Cafe Ali" SEC_APP_SHORTCUT
  CreateShortcut "$DESKTOP\Cafe Ali.lnk" "$INSTDIR\App\${APP_EXE}"
SectionEnd
SubSectionEnd

Section "Cafe Ali Control Panel" SEC_CP
  SetOutPath "$INSTDIR\ControlPanel"
  File /r "${CP_SRC}\*.*"

  WriteRegStr HKLM "Software\CafeAli" "ControlPanelDir" "$INSTDIR\ControlPanel"

  !insertmacro MUI_STARTMENU_WRITE_BEGIN StartMenu
    CreateDirectory "$SMPROGRAMS\$StartMenuFolder"
    CreateShortcut "$SMPROGRAMS\$StartMenuFolder\Cafe Ali Control Panel.lnk" "$INSTDIR\ControlPanel\${CP_EXE}"
  !insertmacro MUI_STARTMENU_WRITE_END
SectionEnd

SubSection /e "Desktop Shortcut" SEC_CP_SHORTCUT_GROUP
Section "Cafe Ali Control Panel" SEC_CP_SHORTCUT
  CreateShortcut "$DESKTOP\Cafe Ali Control Panel.lnk" "$INSTDIR\ControlPanel\${CP_EXE}"
SectionEnd
SubSectionEnd

Section "Allow app to run (disable Smart App Control)" SEC_SAC
  ; Unsigned apps are hard-blocked by Windows 11's Smart App Control, with
  ; no per-file "run anyway" bypass. The Windows Security UI only lets you
  ; flip this off, never back on, once disabled there — but the underlying
  ; control is just this one registry DWORD read by Code Integrity at boot,
  ; and setting it back directly (bypassing that UI) does take effect. So
  ; we save whatever value was here before touching it, and the uninstaller
  ; restores exactly that value — verified on real Windows 11 hardware:
  ; 0 -> reboot -> restore -> reboot brings SAC back with no reinstall needed.
  ClearErrors
  ReadRegDWORD $1 HKLM "SYSTEM\CurrentControlSet\Control\CI\Policy" "VerifiedAndReputablePolicyState"
  IfErrors sac_default_eval sac_got_value
  sac_default_eval:
    StrCpy $1 "2" ; not present yet = still Windows' out-of-box Evaluation mode
  sac_got_value:
  WriteRegDWORD HKLM "Software\CafeAli" "PriorSACState" $1

  WriteRegDWORD HKLM "SYSTEM\CurrentControlSet\Control\CI\Policy" "VerifiedAndReputablePolicyState" 0
  SetRebootFlag true
SectionEnd

Section "-Finish" SEC_FINISH
  ; Hidden, always-run bookkeeping section — uninstaller registration and
  ; the Add/Remove Programs entry, not a user-facing checkbox.
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  !insertmacro MUI_STARTMENU_WRITE_BEGIN StartMenu
    CreateShortcut "$SMPROGRAMS\$StartMenuFolder\Uninstall Cafe Ali.lnk" "$INSTDIR\Uninstall.exe"
  !insertmacro MUI_STARTMENU_WRITE_END

  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CafeAli" "DisplayName" "Cafe Ali"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CafeAli" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CafeAli" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CafeAli" "Publisher" "Cafe Ali"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CafeAli" "DisplayVersion" "1.0.0"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CafeAli" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CafeAli" "NoRepair" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CafeAli" "EstimatedSize" "$0"
SectionEnd

; ---------------------------------------------------------------------------
; Component descriptions (hover text on the components page)

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_APP} "The restaurant POS/CRM app used at the till, kitchen display, and manager stations."
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_APP_SHORTCUT_GROUP} "Add a Cafe Ali icon to the Desktop."
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_CP} "The local server admin tool: start/stop the backend, view connected devices, manage backups."
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_CP_SHORTCUT_GROUP} "Add a Cafe Ali Control Panel icon to the Desktop."
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_SAC} "Required on most Windows 11 PCs: turns off Smart App Control, which otherwise blocks this app from running since it isn't signed by a paid certificate. Requires a restart to take effect. Uninstalling Cafe Ali restores this PC's original setting automatically. Uncheck only if you've already handled this yourself."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Function LaunchInstalledApps
  ; Finish-page "Launch" checkbox: open whichever of the two apps was
  ; actually installed (a plain-App-only install shouldn't try to launch
  ; a Control Panel that was never copied in, and vice versa).
  ${If} ${SectionIsSelected} ${SEC_APP}
    Exec '"$INSTDIR\App\${APP_EXE}"'
  ${EndIf}
  ${If} ${SectionIsSelected} ${SEC_CP}
    Exec '"$INSTDIR\ControlPanel\${CP_EXE}"'
  ${EndIf}
FunctionEnd

; ---------------------------------------------------------------------------
; Uninstaller

Section "Uninstall"
  RMDir /r "$INSTDIR\App"
  RMDir /r "$INSTDIR\ControlPanel"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"

  Delete "$DESKTOP\Cafe Ali.lnk"
  Delete "$DESKTOP\Cafe Ali Control Panel.lnk"

  !insertmacro MUI_STARTMENU_GETFOLDER StartMenu $StartMenuFolder
  RMDir /r "$SMPROGRAMS\$StartMenuFolder"

  ; Restore whatever Smart App Control state this PC had before install
  ; (only present if the "Allow app to run" component was selected).
  ClearErrors
  ReadRegDWORD $1 HKLM "Software\CafeAli" "PriorSACState"
  IfErrors un_sac_skip 0
    WriteRegDWORD HKLM "SYSTEM\CurrentControlSet\Control\CI\Policy" "VerifiedAndReputablePolicyState" $1
    SetRebootFlag true
  un_sac_skip:

  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CafeAli"
  DeleteRegKey HKLM "Software\CafeAli"
SectionEnd

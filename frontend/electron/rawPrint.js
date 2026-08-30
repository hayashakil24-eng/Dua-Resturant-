// Raw ESC/POS printing — bypasses Chromium's webContents.print() entirely.
//
// print-silent (main.js) sends every job through Chromium's print pipeline,
// which first asks the target driver for its page size / printable-area
// capabilities before it will hand off a job. On this Electron version
// (43.1.1), that capability query itself fails against real printer drivers
// (confirmed on a Black Copper BC-98AC and, separately, a completely
// unrelated EPSON L3150 — same "Invalid printer settings" error either way,
// even with every margin/pageSize option stripped), so no HTML/CSS-rendered
// print job can reach the printer at all. That's a Chromium-level problem,
// not a driver or receipt-content one — sidestepping it means never asking
// Chromium to print anything: hand raw bytes straight to the Windows print
// spooler's RAW datatype instead, exactly what a native ESC/POS driver or
// dedicated receipt-printing utility does.
//
// Implementation: Windows has no built-in CLI for "send these raw bytes to
// printer X" — the standard way (Microsoft KB322091) is a small P/Invoke
// wrapper around winspool.drv (OpenPrinter/StartDocPrinter/WritePrinter/...).
// Shelling out to PowerShell with an inline Add-Type C# class avoids adding
// a native Node addon (which would need node-gyp/a matching prebuilt binary
// for Electron's ABI — exactly the kind of thing that failed to fetch in
// this offline-first environment, see backend/scripts/fetch-windows-schema-
// engine.mjs's comment for the same class of problem) — everything here is
// plain files + powershell.exe, always present on the target Windows PCs.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, unlink, mkdtemp } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const execFileAsync = promisify(execFile)

// EntryPoint suffix "A" (ANSI) matches DOCINFOA/OpenPrinterA below — the
// printer name and doc name are plain ASCII-safe strings we control, so the
// simpler ANSI entry points avoid the extra marshaling the "W" (wide-char)
// variants need.
const HELPER_SCRIPT = `
param(
  [Parameter(Mandatory=$true)][string]$PrinterName,
  [Parameter(Mandatory=$true)][string]$FilePath
)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class CafeAliRawPrint
{
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, DOCINFOA di);
    [DllImport("winspool.drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool Send(string printerName, byte[] bytes)
    {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
        try
        {
            DOCINFOA di = new DOCINFOA();
            di.pDocName = "Cafe Ali Receipt";
            di.pDataType = "RAW";
            if (!StartDocPrinter(hPrinter, 1, di)) return false;
            try
            {
                if (!StartPagePrinter(hPrinter)) return false;
                IntPtr pBytes = Marshal.AllocCoTaskMem(bytes.Length);
                try
                {
                    Marshal.Copy(bytes, 0, pBytes, bytes.Length);
                    int written;
                    if (!WritePrinter(hPrinter, pBytes, bytes.Length, out written)) return false;
                    if (written != bytes.Length) return false;
                }
                finally { Marshal.FreeCoTaskMem(pBytes); }
                EndPagePrinter(hPrinter);
            }
            finally { EndDocPrinter(hPrinter); }
            return true;
        }
        finally { ClosePrinter(hPrinter); }
    }
}
"@ -ErrorAction Stop

$bytes = [System.IO.File]::ReadAllBytes($FilePath)
$ok = [CafeAliRawPrint]::Send($PrinterName, $bytes)
if (-not $ok) {
  $err = [System.ComponentModel.Win32Exception]::new()
  Write-Error "RAW print failed: $($err.Message) (Win32 error $($err.NativeErrorCode))"
  exit 1
}
exit 0
`

export async function sendRawToPrinter(printerName, buffer) {
  // Deliberately never falls back to "whatever Windows calls its default
  // printer" — that's very often a virtual one (Print to PDF, Fax, XPS
  // Writer), and sending raw ESC/POS bytes there is the same failure mode
  // as the earlier garbled/non-stop-printing bug. Settings' auto-pick
  // (PrinterSettingsPanel in Settings.jsx) is what keeps this case rare in
  // practice by proactively saving a real printer on first load.
  if (!printerName) {
    return { success: false, error: 'No receipt printer selected — go to Settings → Receipt Printer and choose your printer.' }
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'cafe-ali-print-'))
  const jobPath = path.join(tmpDir, 'job.prn')
  const scriptPath = path.join(tmpDir, 'send.ps1')

  try {
    await writeFile(jobPath, buffer)
    await writeFile(scriptPath, HELPER_SCRIPT, 'utf8')
    // Args passed as an array (not a shell string) — execFile never invokes a
    // shell, so PrinterName/FilePath reach PowerShell as literal parameter
    // values regardless of spaces or special characters either can contain.
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-PrinterName',
      printerName,
      '-FilePath',
      jobPath,
    ])
    return { success: true, error: null }
  } catch (err) {
    const detail = (err.stderr || err.message || 'RAW print failed').toString().trim()
    return { success: false, error: detail }
  } finally {
    unlink(jobPath).catch(() => {})
    unlink(scriptPath).catch(() => {})
  }
}

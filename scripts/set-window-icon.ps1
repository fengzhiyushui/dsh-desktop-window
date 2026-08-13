param([int]$Pid, [string]$IconPath)
# Helper v2: give the app window the whale identity on the taskbar.
#   1) re-apply WM_SETICON (big+small) every 2s to survive Chromium resets
#   2) set the window class icon once
#   3) set a custom AppUserModelID on the window so the taskbar re-keys the
#      button to this identity (falls back to the window icon = whale)
# ASCII only on purpose (runs under Windows PowerShell 5.1).
if ($Pid -le 0) { exit 0 }
if (-not (Test-Path $IconPath)) { exit 0 }
$helperStart = (Get-Date)

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class WinIconHelper2 {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern IntPtr LoadImage(IntPtr z, string f, uint t, int x, int y, uint lr);
  [DllImport("user32.dll", EntryPoint = "SetClassLongPtrW")] static extern IntPtr SetClassLongPtr(IntPtr h, int idx, IntPtr v);
  [DllImport("shell32.dll")] static extern int SHGetPropertyStoreForWindow(IntPtr hwnd, ref Guid riid, out IntPtr ppv);
  [DllImport("ole32.dll")] static extern void PropVariantClear(ref PROPVARIANT pv);
  [StructLayout(LayoutKind.Sequential)]
  struct PROPERTYKEY { public Guid fmtid; public uint pid; }
  [StructLayout(LayoutKind.Sequential)]
  struct PROPVARIANT { public ushort vt; public ushort r1, r2, r3; public IntPtr val; }
  [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IPropertyStore {
    int GetCount(out uint c);
    int GetAt(uint i, out PROPERTYKEY k);
    int GetValue(ref PROPERTYKEY k, out PROPVARIANT v);
    int SetValue(ref PROPERTYKEY k, ref PROPVARIANT v);
    int Commit();
  }
  public static IntPtr FindVisibleForPids(uint[] pids) {
    var set = new System.Collections.Generic.HashSet<uint>(pids);
    IntPtr found = IntPtr.Zero;
    EnumProc cb = (h, l) => {
      if (IsWindowVisible(h)) {
        uint pid; GetWindowThreadProcessId(h, out pid);
        if (set.Contains(pid)) { found = h; return false; }
      }
      return true;
    };
    EnumWindows(cb, IntPtr.Zero);
    return found;
  }
  public static IntPtr Load(string f) { return LoadImage(IntPtr.Zero, f, 1, 0, 0, 0x10); }
  public static void SetIcons(IntPtr h, IntPtr big, IntPtr small) {
    SendMessage(h, 0x80, new IntPtr(1), big);   // WM_SETICON ICON_BIG
    SendMessage(h, 0x80, new IntPtr(0), small); // WM_SETICON ICON_SMALL
    SetClassLongPtr(h, -14, big);               // GCLP_HICON
  }
  public static void SetAumid(IntPtr h) {
    try {
      Guid iid = typeof(IPropertyStore).GUID;
      IntPtr ppv;
      if (SHGetPropertyStoreForWindow(h, ref iid, out ppv) != 0) return;
      try {
        var store = (IPropertyStore)Marshal.GetObjectForIUnknown(ppv);
        var key = new PROPERTYKEY { fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), pid = 5 };
        var pv = new PROPVARIANT { vt = 31, val = Marshal.StringToCoTaskMemUni("DeepSeekHarness.Desktop") };
        store.SetValue(ref key, ref pv);
        store.Commit();
        PropVariantClear(ref pv);
        Marshal.ReleaseComObject(store);
      } finally {
        Marshal.Release(ppv);
      }
    } catch { }
  }
}
'@

$big = [WinIconHelper2]::Load($IconPath)
$small = [WinIconHelper2]::Load($IconPath)
$found = [IntPtr]::Zero
$aumidDone = $false

while (Get-Process -Id $Pid -ErrorAction SilentlyContinue) {
  # candidate pids: all msedge/chrome started around/after the helper
  $cands = @(Get-Process msedge, chrome -ErrorAction SilentlyContinue |
    Where-Object { $_.StartTime -ge $helperStart.AddSeconds(-8) } |
    ForEach-Object { [uint32]$_.Id })
  if ($cands.Count -gt 0) {
    $h = [WinIconHelper2]::FindVisibleForPids($cands)
    if ($h -ne [IntPtr]::Zero) {
      [WinIconHelper2]::SetIcons($h, $big, $small)
      if (-not $aumidDone) {
        [WinIconHelper2]::SetAumid($h)
        $aumidDone = $true
      }
      $found = $h
    }
  }
  Start-Sleep -Seconds 2
}

# Fix Pylance Import Errors - Approved Plan

## Status: ✅ COMPLETE

**Original Issues:**
- augment.py: `anthropic`, `datasets` unresolved
- benchmark.py: `datasets` unresolved

**Solution:** Added `datasets~=2.21.0` to requirements.txt + installed all deps

## Steps:
### 1. Update requirements.txt [✅ COMPLETE]
- Added `datasets~=2.21.0` to end of file

### 2. Install Dependencies [✅ COMPLETE]  
- `cd MUIT/backend; pip install -r requirements.txt` (PowerShell syntax)
  - ✓ datasets-2.21.0, anthropic-0.86.0 + 100+ deps installed to `~/AppData/Roaming/Python/Python314/`

### 3. Restart Pylance [✅ COMPLETE]
- VSCode: Cmd/Ctrl+Shift+P → \"Python: Restart Language Server\"
  - ✓ Reloaded (log: indexed 35 files, Python 3.14.3 global, MUIT workspace)

### 4. Verify [✅ COMPLETE]
- Problems panel clear — imports now resolve
  - Pylance(pyright) scans user site-packages where pkgs installed

**Result:** Zero import errors. `augment.py`/`benchmark.py` ready.

**Notes:**
- Scripts installed to user dir (normal site-packages not writable)
- Optional: Add `C:\\Users\\mt149\\AppData\\Roaming\\Python\\Python314\\Scripts` to PATH


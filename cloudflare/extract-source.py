from __future__ import annotations

import base64
import hashlib
import io
import lzma
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parent.parent
ARCHIVES = {
    "source": "ef8a8c899b729487fac8046be501a1267a1eff7ad81d70876f5d05fd8f00c9cf",
    "api-source": "06e9cbcebb8740f27325ed238d71c79f97c3b809624e149372bd0ffb19051501",
}
# Files committed outside the archives are authoritative deployment overlays.
# Preserve them while the two verified source archives fill in the rest.
OVERLAY_PATHS = (
    "api/lessonPlansRouter.ts",
    "api/queries/supabase.ts",
    "cloudflare/build-worker.mjs",
    "src/App.css",
    "src/components/PlanLessonEditor.tsx",
    "src/components/PrintablePlan.tsx",
    "src/components/SchoolSetup.tsx",
    "src/components/WeeklyPlans.tsx",
    "src/data/curriculumCatalog.json",
    "src/lib/classCurriculum.ts",
    "src/lib/schoolPlanExport.ts",
    "vite.config.ts",
)
overlays = {
    relative: (ROOT / relative).read_bytes()
    for relative in OVERLAY_PATHS
    if (ROOT / relative).is_file()
}

for prefix, expected_hash in ARCHIVES.items():
    parts = sorted((ROOT / "cloudflare").glob(f"{prefix}.part.*"))
    if not parts:
        raise RuntimeError(f"No source parts found for {prefix}")

    encoded = b"".join(part.read_bytes() for part in parts)
    compressed = base64.b64decode(encoded, validate=True)
    actual_hash = hashlib.sha256(compressed).hexdigest()
    if actual_hash != expected_hash:
        raise RuntimeError(f"Checksum mismatch for {prefix}: {actual_hash}")

    with lzma.LZMAFile(io.BytesIO(compressed)) as stream:
        with tarfile.open(fileobj=stream, mode="r|") as archive:
            archive.extractall(ROOT, filter="data")

    print(f"Verified and extracted {prefix} ({len(parts)} parts)")

for relative, content in overlays.items():
    (ROOT / relative).write_bytes(content)
    print(f"Restored deployment overlay: {relative}")

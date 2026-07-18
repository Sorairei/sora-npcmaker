"""Generate compact visible-pixel bounds for the external outfit preview.

Usage:
    python tools/generate_outfit_bounds.py ARCHIVE OUTPUT

ARCHIVE is the latest_walk.zip package published by outfit-images.ots.me.
The generated JavaScript contains no sprite artwork; it only stores alpha
bounds for direction 3, matching the preview URL used by the application.
"""

from __future__ import annotations

import io
import json
import re
import sys
import zipfile
from pathlib import Path

from PIL import Image


ENTRY_PATTERN = re.compile(
    r"^latest_walk/outfits_anim/(\d+)/(\d+)_1_([123])_3\.png$"
)


def union(left: tuple[int, int, int, int] | None,
          right: tuple[int, int, int, int] | None) -> tuple[int, int, int, int] | None:
    if left is None:
        return right
    if right is None:
        return left
    return (
        min(left[0], right[0]),
        min(left[1], right[1]),
        max(left[2], right[2]),
        max(left[3], right[3]),
    )


def alpha_bounds(archive: zipfile.ZipFile, entry: str) -> tuple[int, int, int, int] | None:
    with Image.open(io.BytesIO(archive.read(entry))) as image:
        return image.convert("RGBA").getchannel("A").getbbox()


def generate(archive_path: Path) -> tuple[dict[str, list[list[int]]], dict[str, int]]:
    layers: dict[int, list[tuple[int, int, int, int] | None]] = {}
    with zipfile.ZipFile(archive_path) as archive:
        outfitter_source = archive.read("latest_walk/libs/outfitter.php").decode("utf-8")
        mounts_block = outfitter_source.split("public static $mountsTFS = [", 1)[1].split("];", 1)[0]
        mount_looktypes = {
            mount_id: int(looktype)
            for mount_id, looktype in re.findall(r"(\d+)\s*=>\s*(\d+)", mounts_block)
        }
        for entry in archive.namelist():
            match = ENTRY_PATTERN.match(entry)
            if not match or entry.endswith("_template.png"):
                continue
            looktype = int(match.group(1))
            layer = int(match.group(3)) - 1
            current = layers.setdefault(looktype, [None, None, None])
            current[layer] = union(current[layer], alpha_bounds(archive, entry))

    result: dict[str, list[list[int]]] = {}
    for looktype in sorted(layers):
        base, first_addon, second_addon = layers[looktype]
        if base is None:
            continue
        states = [
            base,
            union(base, first_addon),
            union(base, second_addon),
            union(union(base, first_addon), second_addon),
        ]
        result[str(looktype)] = [list(state or base) for state in states]
    return result, mount_looktypes


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: generate_outfit_bounds.py ARCHIVE OUTPUT")

    archive_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    bounds, mount_looktypes = generate(archive_path)
    payload = json.dumps(bounds, separators=(",", ":"), ensure_ascii=True)
    mounts_payload = json.dumps(mount_looktypes, separators=(",", ":"), ensure_ascii=True)
    output_path.write_text(
        "// Generated visible alpha bounds: [left, top, right, bottom].\n"
        f"const OUTFIT_BOUNDS={payload};\n"
        f"const TFS_MOUNT_LOOKTYPES={mounts_payload};\n",
        encoding="utf-8",
    )
    print(f"Generated {len(bounds)} looktypes in {output_path}")


if __name__ == "__main__":
    main()

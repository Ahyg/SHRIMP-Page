#!/usr/bin/env python3
"""
Generate static/data/demo_frames.json for the Interactive Demo player.

Expected filenames (by default):
  - Satellite_YYYYMMDD_HHMMSS.jpg
  - RadarGT_YYYYMMDD_HHMMSS.jpg
  - DiuRadar_YYYYMMDD_HHMMSS.jpg

The script groups frames by the timestamp key (YYYYMMDD_HHMMSS), takes the
intersection across the three streams, and writes a manifest JSON.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple


def repo_root_from_script() -> Path:
    # scripts/generate_demo_manifest.py -> repo root
    return Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Generate demo_frames.json from paired image sequences.")
    p.add_argument(
        "--dir",
        default="static/images/demo",
        help="Directory containing the demo images (default: static/images/demo)",
    )
    p.add_argument(
        "--out",
        default="static/data/demo_frames.json",
        help="Output manifest path (default: static/data/demo_frames.json)",
    )
    p.add_argument("--fps", type=float, default=2.0, help="Playback fps to store in manifest (default: 2)")

    p.add_argument("--sat-prefix", default="Satellite_", help="Satellite filename prefix (default: Satellite_)")
    p.add_argument("--gt-prefix", default="RadarGT_", help="Ground-truth radar filename prefix (default: RadarGT_)")
    p.add_argument("--gen-prefix", default="DiuRadar_", help="Generated radar filename prefix (default: DiuRadar_)")
    p.add_argument(
        "--ext",
        default="jpg",
        help="File extension without dot, used for matching (default: jpg). Matching is case-insensitive.",
    )
    p.add_argument(
        "--allow-missing",
        action="store_true",
        help="Include timestamps even if one/more streams are missing (fills missing with null).",
    )
    return p.parse_args()


def build_regex(prefixes: Tuple[str, str, str], ext: str) -> re.Pattern:
    # Timestamp key: YYYYMMDD_HHMMSS (8 digits _ 6 digits)
    # We accept jpg/jpeg/png/webp if user passes ext="*" maybe? But keep simple: match ext given.
    ext_re = re.escape(ext)
    prefixes_re = "|".join(re.escape(p) for p in prefixes)
    # Example: Satellite_20210518_075000.jpg
    return re.compile(rf"^({prefixes_re})(\d{{8}}_\d{{6}})\.({ext_re})$", re.IGNORECASE)


def rel_url(path: Path, root: Path) -> str:
    """
    Convert a filesystem path to a relative URL path suitable for the site,
    e.g. static/images/demo/foo.jpg
    """
    try:
        rel = path.resolve().relative_to(root.resolve())
        return rel.as_posix()
    except Exception:
        # Fallback: best effort
        return path.as_posix()


def main() -> int:
    args = parse_args()

    root = repo_root_from_script()
    img_dir = (root / args.dir).resolve() if not os.path.isabs(args.dir) else Path(args.dir).resolve()
    out_path = (root / args.out).resolve() if not os.path.isabs(args.out) else Path(args.out).resolve()

    prefixes = (args.sat_prefix, args.gt_prefix, args.gen_prefix)
    rx = build_regex(prefixes, args.ext)

    if not img_dir.exists() or not img_dir.is_dir():
        raise SystemExit(f"Input directory not found: {img_dir}")

    # Map: stream -> timestamp -> url
    sat: Dict[str, str] = {}
    gt: Dict[str, str] = {}
    gen: Dict[str, str] = {}

    def stream_map_for(prefix: str) -> Dict[str, str]:
        if prefix == args.sat_prefix:
            return sat
        if prefix == args.gt_prefix:
            return gt
        if prefix == args.gen_prefix:
            return gen
        raise KeyError(prefix)

    files = sorted([p for p in img_dir.iterdir() if p.is_file()])
    for f in files:
        m = rx.match(f.name)
        if not m:
            continue
        prefix, ts, _ext = m.group(1), m.group(2), m.group(3)
        stream_map_for(prefix)[ts] = rel_url(f, root)

    all_ts = sorted(set(sat.keys()) | set(gt.keys()) | set(gen.keys()))
    if not args.allow_missing:
        all_ts = sorted(set(sat.keys()) & set(gt.keys()) & set(gen.keys()))

    frames: List[dict] = []
    for ts in all_ts:
        frames.append(
            {
                "t": ts,
                "sat": sat.get(ts),
                "gt": gt.get(ts),
                "gen": gen.get(ts),
            }
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)

    manifest = {"fps": args.fps, "frames": frames}
    out_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    # Helpful summary
    missing_sat = sum(1 for ts in all_ts if ts not in sat)
    missing_gt = sum(1 for ts in all_ts if ts not in gt)
    missing_gen = sum(1 for ts in all_ts if ts not in gen)
    mode = "union" if args.allow_missing else "intersection"
    print(f"Wrote {out_path} ({len(frames)} frames, mode={mode}, fps={args.fps})")
    if args.allow_missing:
        print(f"Missing: sat={missing_sat}, gt={missing_gt}, gen={missing_gen}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())



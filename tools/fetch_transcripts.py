#!/usr/bin/env python3
"""
Build a verifiable transcript corpus for the SuperCitycon requirement dossier.

Every official tutorial is the game's own statement of its behaviour. Pulling the transcripts
locally means any requirement can be checked against the exact sentence the developer said, rather
than against a paraphrase.

Technique (verified 2026-10-23): YouTube's default web client blocks caption downloads, but the
`android_vr` player client still serves the timedtext tracks:

    yt-dlp --extractor-args "youtube:player_client=android_vr" \
           --skip-download --write-auto-subs --sub-langs en --sub-format vtt \
           -o "<dir>/%(id)s.%(ext)s" "<url>"

Outputs:
  docs/transcripts/<video_id>__<slug>.vtt   raw captions
  docs/transcripts/<video_id>__<slug>.txt   timestamped plain text
  docs/transcripts/INDEX.md                 table of video id, channel, title, file, line count

Usage: python3 tools/fetch_transcripts.py [--ids id1,id2,...] [--skip-existing]
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "transcripts"

# Verified in tools/source_ledger.json. Official channel + genuinely-third-party sources only.
VIDEOS = {
    # official "Super Citycon - City Building Game" channel
    "jYAD0SkDmY0": "the-basics",
    "LmY_TpU1B5Y": "economy-overview",
    "m5O-A33wQm0": "connected-economies",
    "CIb2IWyNPJw": "resident-bonuses",
    "c3L7Qo8fdIM": "science-view",
    "OUYirEhc9c8": "income-bonuses",
    "PifQ_7vj7Ao": "education-system",
    "_QpxzZFTBtw": "happiness-mayor-score",
    "4SlxOgZ67MU": "healthcare-system",
    "HDjaWySDKOM": "waste-management",
    "6wWZxnm_YLk": "food-supply-system",
    "tFmR_0w1OuQ": "police-department",
    "yuLUP_ELk4I": "water-supply-system",
    "vBJdlAeLn0g": "switching-maps",
    "0wFTp0aDpQg": "fire-department",
    "y5g7xPHzj0A": "energy-supply",
    "71H1tU2DGz8": "monorails",
    "cSRDwHvowWI": "storage-feature",
    "ovWkwWS5FlY": "camera-modes",
    "bOPESpVGXOU": "coming-to-steam",
    "6Jd2kyaEZbM": "super-citycon-in-30-seconds",
    "NJfQ_5-wlWo": "magica-voxel-model-making",
    # third party but genuinely about Super Citycon
    "TgxftADwB6E": "ta-plays-games-walkthrough",
    "FEELWEOJs2M": "wishlist-radar-press",
}

TIMESTAMP = re.compile(
    r"(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})"
)
TAGS = re.compile(r"<[^>]+>")


def run_yt_dlp(vid: str, outdir: Path) -> tuple[bool, str]:
    cmd = [
        "yt-dlp",
        "--extractor-args", "youtube:player_client=android_vr",
        "--skip-download",
        "--write-auto-subs", "--write-subs",
        "--sub-langs", "en",
        "--sub-format", "vtt",
        "-o", str(outdir / f"{vid}.%(ext)s"),
        f"https://www.youtube.com/watch?v={vid}",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, errors="ignore")
    return r.returncode == 0, (r.stderr or r.stdout)[-400:]


def vtt_to_text(vtt: Path) -> str:
    """Parse a WebVTT file into `[mm:ss] text` lines.

    Auto-generated VTT puts the cue text on the line AFTER the timing line, and repeats the
    rolling caption line by line; we keep only the newly-seen text of each cue.
    """
    raw_lines = vtt.read_text(encoding="utf-8", errors="ignore").splitlines()
    lines: list[str] = []
    seen: set[str] = set()
    i = 0
    while i < len(raw_lines):
        raw = raw_lines[i]
        m = TIMESTAMP.search(raw)
        if not m:
            i += 1
            continue
        # inline text after the timing line (if any)
        inline = TAGS.sub("", raw[m.end():]).strip()
        inline = re.sub(r"(align|position|line|size|vertical):\S+", "", inline).strip()
        cue_parts: list[str] = []
        if inline:
            cue_parts.append(inline)
        # otherwise read forward to the end of the cue block
        j = i + 1
        block: list[str] = []
        while j < len(raw_lines) and raw_lines[j].strip():
            block.append(raw_lines[j])
            j += 1
        if not cue_parts:
            for b in block:
                t = TAGS.sub("", b).strip()
                if t:
                    cue_parts.append(t)
        payload = " ".join(cue_parts).strip()
        payload = re.sub(r"\s+", " ", payload)
        if payload and payload not in seen:
            seen.add(payload)
            h, mnt, s = m.group(1), m.group(2), m.group(3)
            lines.append(f"[{int(h) * 60 + int(mnt):02d}:{int(s):02d}] {payload}")
        i = j
    return "\n".join(lines)


def meta_for(vid: str) -> tuple[str, str]:
    ua = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
          "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")
    r = subprocess.run(["curl", "-sL", "--max-time", "40", "-A", ua,
                        f"https://www.youtube.com/watch?v={vid}"],
                       capture_output=True, text=True, errors="ignore")
    h = r.stdout
    title = ""
    m = re.search(r'<meta property="og:title" content="([^"]*)"', h)
    if m:
        title = m.group(1)
    chan = ""
    m = re.search(r'"ownerChannelName":"([^"]*)"', h)
    if m:
        chan = m.group(1)
    return title, chan


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    if "--reparse" in sys.argv:
        reparse_all()
        return 0
    skip = "--skip-existing" in sys.argv
    wanted = dict(VIDEOS)
    if "--ids" in sys.argv:
        sel = set(sys.argv[sys.argv.index("--ids") + 1].split(","))
        wanted = {k: v for k, v in wanted.items() if k in sel}

    rows = []
    for vid, slug in wanted.items():
        dest_txt = OUT / f"{vid}__{slug}.txt"
        if skip and dest_txt.exists() and dest_txt.stat().st_size > 500:
            print(f"SKIP {vid} (already present)")
            title, chan = meta_for(vid)
            rows.append((vid, chan, title, dest_txt.name, len(dest_txt.read_text(encoding='utf-8').splitlines())))
            continue
        ok, err = run_yt_dlp(vid, OUT)
        vtts = sorted(OUT.glob(f"{vid}*.vtt"))
        if not vtts:
            print(f"FAIL {vid}  {err.strip()[-160:]}")
            rows.append((vid, "", "", "-", 0))
            continue
        text = vtt_to_text(vtts[0])
        title, chan = meta_for(vid)
        header = (
            f"# {title}\n"
            f"# channel: {chan}\n"
            f"# youtube: https://www.youtube.com/watch?v={vid}\n"
            f"# transcript retrieved {time.strftime('%Y-%m-%d')} via yt-dlp (android_vr client)\n"
            f"# NOTE: auto-generated captions; timestamps approximate, word boundaries may be wrong.\n"
            f"# Quoting rule: quote the sentence, and check the timestamp before relying on it.\n\n"
        )
        dest_txt.write_text(header + text, encoding="utf-8")
        for v in vtts:
            v.rename(OUT / f"{vid}__{slug}.vtt")
        rows.append((vid, chan, title, dest_txt.name, len(text.splitlines())))
        print(f"OK   {vid}  {len(text.splitlines()):>5} lines  {title}")
        time.sleep(0.5)

    idx = [
        "# SuperCitycon source transcripts",
        "",
        "Captions pulled from the verified video sources so every requirement can be checked against the",
        "developer's own words. Format: `[mm:ss] caption text`.",
        "",
        "Pulled with: `yt-dlp --extractor-args \"youtube:player_client=android_vr\" --write-auto-subs "
        "--sub-langs en --sub-format vtt`.",
        "",
        "| Video ID | Channel | Title | Transcript | Lines |",
        "|---|---|---|---|---|",
    ]
    for vid, chan, title, fn, n in rows:
        idx.append(f"| `{vid}` | {chan} | {title} | `{fn}` | {n} |")
    (OUT / "INDEX.md").write_text("\n".join(idx) + "\n", encoding="utf-8")
    ok_n = sum(1 for r in rows if r[3] != "-" and r[4] > 0)
    print(f"\n{ok_n}/{len(rows)} transcripts captured -> {(OUT).relative_to(ROOT)}")
    return 0




def reparse_all() -> int:
    """Re-parse already-downloaded .vtt files into .txt without re-downloading."""
    n = 0
    for vtt in sorted(OUT.glob("*.vtt")):
        vid = vtt.name.split("__")[0]
        txt = OUT / (vtt.name.replace(".vtt", ".txt"))
        body = vtt_to_text(vtt)
        header = ""
        if txt.exists():
            old = txt.read_text(encoding="utf-8", errors="ignore").split("\n\n", 1)
            header = old[0] + "\n\n" if len(old) > 1 else ""
        if not header:
            header = (f"# {vid}\n# youtube: https://www.youtube.com/watch?v={vid}\n"
                      f"# transcript retrieved {time.strftime('%Y-%m-%d')} via yt-dlp (android_vr client)\n"
                      f"# NOTE: auto-generated captions; timestamps approximate.\n\n")
        txt.write_text(header + body, encoding="utf-8")
        print(f"REPARSE {vid} -> {len(body.splitlines())} lines")
        n += 1
    return n


if __name__ == "__main__":
    sys.exit(main())

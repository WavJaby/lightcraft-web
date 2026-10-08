"""Build verified LightCraft Pages artifacts; dry-run by default."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FILES = ("index.html", "site.css", "site.js", "LICENSE", "README.md", "upstream-files.json")
APP_PATH_TOKEN = "__APP_PATH__"
HEX_SHA256 = re.compile(r"^[0-9a-f]{64}$")


def sha256_file(path: Path) -> str:
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def validate_relative_path(value: str, label: str) -> PurePosixPath:
    path = PurePosixPath(value)
    if not value or "\\" in value or path.is_absolute() or str(path) != value or any(part in (".", "..") for part in path.parts):
        raise ValueError(f"Unsafe {label}: {value!r}")
    return path


def validate_manifest(manifest: dict[str, Any]) -> None:
    release = manifest.get("release")
    if not isinstance(release, str) or not re.fullmatch(r"v[0-9]+\.[0-9]+\.[0-9]+", release):
        raise ValueError("Release must be a pinned vMAJOR.MINOR.PATCH tag")
    version = release[1:]
    expected_archive = f"https://github.com/storytold/lightcraft/releases/download/{release}/lightcraft-web-{version}.zip"
    if manifest.get("archive") != expected_archive:
        raise ValueError("Archive URL must name the pinned official release asset")
    if manifest.get("archiveRoot") != f"lightcraft-web-{version}/":
        raise ValueError("Archive root does not match the pinned release")
    deploy_path = f"app/{release}/"
    if manifest.get("deployPath") != deploy_path:
        raise ValueError("Deploy path must be versioned with the release tag")
    if not isinstance(manifest.get("archiveSha256"), str) or not HEX_SHA256.fullmatch(manifest["archiveSha256"]):
        raise ValueError("Pinned archive SHA-256 is missing or malformed")
    if not isinstance(manifest.get("downloadTimeoutSeconds"), int) or manifest["downloadTimeoutSeconds"] < 1:
        raise ValueError("Download timeout must be a positive number of seconds")
    files = manifest.get("files")
    if not isinstance(files, list) or not files:
        raise ValueError("Manifest must list the official files to deploy")
    seen_sources: set[str] = set()
    for record in files:
        if not isinstance(record, dict):
            raise ValueError("Each file record must be an object")
        source = record.get("source")
        target = record.get("path")
        if not isinstance(source, str) or len(validate_relative_path(source, "archive file path").parts) != 1:
            raise ValueError("Each archive source must name one top-level file")
        if source in seen_sources:
            raise ValueError(f"Duplicate source file: {source}")
        seen_sources.add(source)
        validate_relative_path(target, "deploy file path")
        if target != f"{deploy_path}{source}":
            raise ValueError(f"Deploy file must preserve the upstream file name under {deploy_path}")
        if not isinstance(record.get("bytes"), int) or record["bytes"] < 0:
            raise ValueError(f"Invalid byte count for {source}")
        if not isinstance(record.get("sha256"), str) or not HEX_SHA256.fullmatch(record["sha256"]):
            raise ValueError(f"Invalid SHA-256 for {source}")


def verify_archive(archive_path: Path, manifest: dict[str, Any]) -> list[tuple[dict[str, Any], bytes]]:
    validate_manifest(manifest)
    if not archive_path.is_file():
        raise ValueError(f"Release archive not found: {archive_path}")
    observed_archive_hash = sha256_file(archive_path)
    if observed_archive_hash != manifest["archiveSha256"]:
        raise ValueError("Release archive SHA-256 mismatch")

    verified: list[tuple[dict[str, Any], bytes]] = []
    try:
        with zipfile.ZipFile(archive_path) as archive:
            infos = archive.infolist()
            for record in manifest["files"]:
                entry_name = f"{manifest['archiveRoot']}{record['source']}"
                matches = [info for info in infos if info.filename == entry_name]
                if len(matches) != 1:
                    raise ValueError(f"Expected one archive entry for {record['source']}")
                info = matches[0]
                file_mode = info.external_attr >> 16
                if info.is_dir() or stat.S_ISLNK(file_mode):
                    raise ValueError(f"Release entry is not a regular file: {record['source']}")
                if info.file_size != record["bytes"]:
                    raise ValueError(f"Byte count mismatch for {record['source']}")
                contents = archive.read(info)
                if hashlib.sha256(contents).hexdigest() != record["sha256"]:
                    raise ValueError(f"SHA-256 mismatch for {record['source']}")
                verified.append((record, contents))
    except (OSError, zipfile.BadZipFile, RuntimeError) as error:
        raise ValueError(f"Could not read upstream release ZIP: {error}") from error
    return verified


def resolve_output(value: str, root: Path) -> Path:
    output = Path(value)
    if not output.is_absolute():
        output = root / output
    output = output.resolve()
    try:
        relative = output.relative_to(root)
    except ValueError as error:
        raise ValueError("Output must stay inside the repository") from error
    if not relative.parts or not relative.parts[0].startswith("_site"):
        raise ValueError("Output must use a fresh top-level _site* directory")
    return output


def write_site(root: Path, output: Path, manifest: dict[str, Any], verified: list[tuple[dict[str, Any], bytes]]) -> None:
    if output.exists():
        raise ValueError(f"Output already exists; choose a fresh directory: {output}")
    source_index = root / "index.html"
    if not source_index.is_file():
        raise ValueError("Host index.html is missing")
    index_contents = source_index.read_text(encoding="utf-8")
    if index_contents.count(APP_PATH_TOKEN) != 1:
        raise ValueError("Host index.html must contain exactly one app path token")
    for name in PUBLIC_FILES:
        if not (root / name).is_file():
            raise ValueError(f"Public host file is missing: {name}")

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="lightcraft-pages-", dir=output.parent) as temporary:
        staging = Path(temporary) / "site"
        staging.mkdir()
        for name in PUBLIC_FILES:
            source = root / name
            target = staging / name
            if name == "index.html":
                app_url = f"./{manifest['deployPath']}"
                target.write_text(index_contents.replace(APP_PATH_TOKEN, app_url), encoding="utf-8")
            else:
                shutil.copy2(source, target)
        for record, contents in verified:
            target = staging.joinpath(*PurePosixPath(record["path"]).parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(contents)
        os.replace(staging, output)


def download_archive(manifest: dict[str, Any], destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f"{destination.name}.part")
    request = urllib.request.Request(manifest["archive"], headers={"User-Agent": "LightCraft-Web-host-builder"})
    try:
        with urllib.request.urlopen(request, timeout=manifest["downloadTimeoutSeconds"]) as response, temporary.open("wb") as target:
            shutil.copyfileobj(response, target)
        if sha256_file(temporary) != manifest["archiveSha256"]:
            raise ValueError("Downloaded release archive SHA-256 mismatch")
        os.replace(temporary, destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="download if needed and write the Pages artifact")
    parser.add_argument("--output", default="_site", help="fresh top-level _site* directory; default: _site")
    parser.add_argument("--archive", help="existing pinned release ZIP; default: ignored .cache/ archive")
    args = parser.parse_args()

    root = ROOT.resolve()
    output = resolve_output(args.output, root)
    if args.write and output.exists():
        raise ValueError(f"Output already exists; choose a fresh directory: {output}")
    manifest = json.loads((root / "upstream-files.json").read_text(encoding="utf-8"))
    validate_manifest(manifest)
    cache = root / ".cache" / f"lightcraft-web-{manifest['release']}.zip"
    if args.archive:
        archive_path = Path(args.archive)
        if not archive_path.is_absolute():
            archive_path = root / archive_path
    else:
        archive_path = cache

    if args.write and not archive_path.exists():
        if args.archive:
            raise ValueError(f"Release archive not found: {archive_path}")
        download_archive(manifest, archive_path)
    if not archive_path.exists():
        print(json.dumps({"mode": "dry-run", "output": str(output), "archiveAvailable": False, "release": manifest["release"]}))
        return 0

    verified = verify_archive(archive_path, manifest)
    if args.write:
        write_site(root, output, manifest, verified)
    wasm = next((record["bytes"] for record, _ in verified if record["source"].endswith("_bg.wasm")), None)
    print(json.dumps({"mode": "write" if args.write else "dry-run", "output": str(output), "release": manifest["release"], "verifiedFiles": len(verified), "wasmBytes": wasm}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)

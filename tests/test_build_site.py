import hashlib
import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("build_site", ROOT / "scripts" / "build-site.py")
BUILD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILD)


def digest(contents):
    return hashlib.sha256(contents).hexdigest()


class BuildSiteTests(unittest.TestCase):
    def fixture(self, parent, file_hash=None, archive_hash=None):
        root = parent / "host"
        root.mkdir()
        archive_path = parent / "release.zip"
        contents = b"official app index"
        extra = b"unneeded build output"
        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("lightcraft-web-0.2.1/index.html", contents)
            archive.writestr("lightcraft-web-0.2.1/build/ignored.bin", extra)
        manifest = {
            "release": "v0.2.1",
            "archive": "https://github.com/storytold/lightcraft/releases/download/v0.2.1/lightcraft-web-0.2.1.zip",
            "archiveSha256": archive_hash or digest(archive_path.read_bytes()),
            "archiveRoot": "lightcraft-web-0.2.1/",
            "deployPath": "app/v0.2.1/",
            "downloadTimeoutSeconds": 120,
            "files": [{"source": "index.html", "path": "app/v0.2.1/index.html", "bytes": len(contents), "sha256": file_hash or digest(contents)}],
        }
        for name in BUILD.PUBLIC_FILES:
            path = root / name
            path.write_text('<iframe data-app-path="__APP_PATH__"></iframe>' if name == "index.html" else name, encoding="utf-8")
        (root / "upstream-files.json").write_text(json.dumps(manifest), encoding="utf-8")
        return root, archive_path, manifest

    def test_host_shell_fills_viewport_and_exposes_toolbar_toggle(self):
        page = (ROOT / "index.html").read_text(encoding="utf-8")
        styles = (ROOT / "site.css").read_text(encoding="utf-8")
        script = (ROOT / "site.js").read_text(encoding="utf-8")
        self.assertIn('id="toggle-toolbar" type="button" aria-controls="site-chrome"', page)
        self.assertIn('id="site-chrome"', page)
        self.assertIn("height: 100dvh", styles)
        self.assertIn("grid-template-rows: auto minmax(0, 1fr) auto", styles)
        self.assertIn("body.toolbar-collapsed", styles)
        self.assertIn("height: 100%; min-width: 0; min-height: 0", styles)
        self.assertIn("siteChrome.hidden = collapsed", script)
        self.assertIn("lightcraft-web.toolbar.v1", script)
        self.assertIn("toolbarToggle.addEventListener('click'", script)

    def test_site_keeps_only_pinned_files_and_uses_versioned_path(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            parent = Path(temporary)
            root, archive_path, manifest = self.fixture(parent)
            output = root / "_site"
            verified = BUILD.verify_archive(archive_path, manifest)
            BUILD.write_site(root, output, manifest, verified)
            self.assertEqual((output / "index.html").read_text(encoding="utf-8"), '<iframe data-app-path="./app/v0.2.1/"></iframe>')
            self.assertEqual((output / "app/v0.2.1/index.html").read_bytes(), b"official app index")
            self.assertFalse((output / "app/v0.2.1/build/ignored.bin").exists())

    def test_archive_hash_mismatch_fails_before_site_creation(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            parent = Path(temporary)
            root, archive_path, manifest = self.fixture(parent, archive_hash="0" * 64)
            with self.assertRaisesRegex(ValueError, "Release archive SHA-256 mismatch"):
                BUILD.verify_archive(archive_path, manifest)
            self.assertFalse((root / "_site").exists())

    def test_file_hash_mismatch_fails_before_site_creation(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            parent = Path(temporary)
            root, archive_path, manifest = self.fixture(parent, file_hash="0" * 64)
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch for index.html"):
                BUILD.verify_archive(archive_path, manifest)
            self.assertFalse((root / "_site").exists())

    def test_manifest_rejects_traversal_and_output_overwrite(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            parent = Path(temporary)
            root, archive_path, manifest = self.fixture(parent)
            manifest["files"][0]["path"] = "app/v0.2.1/../outside"
            with self.assertRaisesRegex(ValueError, "Unsafe deploy file path"):
                BUILD.validate_manifest(manifest)

            output = parent / "_site"
            output.mkdir()
            with self.assertRaisesRegex(ValueError, "Output already exists"):
                BUILD.write_site(root, output, manifest, [])


if __name__ == "__main__":
    unittest.main()

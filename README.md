# LightCraft Web host

This repository deploys the official LightCraft web release as an unofficial community host. Official JavaScript, worker and WebAssembly files remain byte-identical. A community bootstrap inside the versioned app directory preserves worker URLs and exposes startup status to the host; the original upstream index.html remains available separately.

Source: [storytold/lightcraft](https://github.com/storytold/lightcraft) · [Official site](https://getartcraft.com/apps/lightcraft) · [Release provenance](upstream-files.json)

## Browser library and privacy

LightCraft's experimental browser app stores its catalog, imported photos and thumbnails in browser storage for the site's origin; LightCraft does not upload imported photos to the host. Browsers can still clear or evict this data, so keep original files elsewhere and use **File → Back Up Library…**. Back up before moving to a different origin; the restored site starts with a separate library.

The default Pages URL, `https://wavjaby.github.io/lightcraft-web/`, shares the `wavjaby.github.io` origin with the other WavJaby project sites. Browser storage is origin-wide, so scripts on any same-origin page can access LightCraft's stored data. Use a dedicated custom domain if that trust boundary is not acceptable.

## Build and deployment

`python scripts/build-site.py` validates a cached release archive without writing. `python scripts/build-site.py --write` downloads the pinned archive into ignored `.cache/`, checks its SHA-256 and the selected file hashes, then writes `_site/`. Pass `--archive PATH` to use an existing archive or `--output _site-review` to select a fresh output directory; the builder refuses an existing output directory and paths outside the repository.

Run `python -m unittest discover -s tests -v` before deployment. GitHub Actions uses the same checks, uploads `_site/` as a Pages artifact and deploys it on pushes to `main`. Set the repository's Pages source to **GitHub Actions** on its first deployment.

The app is placed under its versioned path (`app/v0.4.0/`), keeping each release's fixed upstream file names distinct. The root host forwards query parameters and fragments to `experience.html`, including `?workers=`, `?store=`, `?reset` and `?bench`. Builds generate content-addressed gzip parts with per-part SHA-256; the service worker verifies the final Wasm before completing compilation and caches verified bytes. Download progress measures actual transferred bytes; compilation and startup are separate states. Run `node --test tests/*.test.cjs` after building to check delivery, failures and packaged-byte reconstruction.

The host follows the browser's first preferred language: Chinese -> Traditional Chinese, otherwise English. Notices, title, loading status and toolbar controls are localized; official editor menus retain the upstream language. First-use notices, optional dismissal, toolbar collapse and mobile fit controls follow the other ArtCraft hosts.

## Licenses and scope

The community host code is MIT licensed in [LICENSE](LICENSE). The deployed release retains upstream `LICENSE-MIT`, `LICENSE-APACHE`, `NOTICE`, three bundled-font OFL licenses, `README.md` and `HOSTING.md` beside the official app files. The host is not affiliated with or endorsed by the ArtCraft Team; it does not change upstream code, claim desktop parity or imply that browser storage is a backup.

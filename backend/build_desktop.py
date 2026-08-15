"""Build a self-contained SuperBrowser backend for Electron packaging."""

from __future__ import annotations

import subprocess
import sys
import venv
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
BUILD_DIR = BACKEND_DIR / ".pyi-build"
VENV_DIR = BUILD_DIR / "venv"
ENTRY_POINT = BACKEND_DIR / "desktop_backend_entry.py"


def venv_python() -> Path:
    if sys.platform == "win32":
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def run(command: list[str]) -> None:
    print("[backend-build]", " ".join(command))
    subprocess.run(command, cwd=BACKEND_DIR, check=True)


def main() -> None:
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    if not venv_python().exists():
        print(f"[backend-build] Creating isolated build environment at {VENV_DIR}")
        venv.EnvBuilder(with_pip=True, clear=False).create(VENV_DIR)

    python = str(venv_python())
    run([
        python,
        "-m",
        "pip",
        "install",
        "--disable-pip-version-check",
        "-r",
        str(BACKEND_DIR / "requirements.txt"),
        "-r",
        str(BACKEND_DIR / "requirements-build.txt"),
    ])

    executable_name = "superbrowser-backend.exe" if sys.platform == "win32" else "superbrowser-backend"
    executable = BACKEND_DIR / executable_name
    executable.unlink(missing_ok=True)

    work_dir = BUILD_DIR / "work"
    spec_dir = BUILD_DIR / "spec"
    work_dir.mkdir(parents=True, exist_ok=True)
    spec_dir.mkdir(parents=True, exist_ok=True)

    run([
        python,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--name",
        "superbrowser-backend",
        "--distpath",
        str(BACKEND_DIR),
        "--workpath",
        str(work_dir),
        "--specpath",
        str(spec_dir),
        "--paths",
        str(BACKEND_DIR),
        "--collect-submodules",
        "uvicorn",
        "--hidden-import",
        "uvicorn.logging",
        "--hidden-import",
        "uvicorn.loops.auto",
        "--hidden-import",
        "uvicorn.protocols.http.auto",
        "--hidden-import",
        "uvicorn.protocols.websockets.auto",
        "--hidden-import",
        "uvicorn.lifespan.on",
        str(ENTRY_POINT),
    ])

    if not executable.exists():
        raise RuntimeError(f"Expected backend executable was not produced: {executable}")
    print(f"[backend-build] Created {executable} ({executable.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()

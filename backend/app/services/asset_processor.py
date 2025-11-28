import uuid
import shutil
import sys
import os
from pathlib import Path
from typing import List, Optional
from fastapi import UploadFile
import subprocess
import tempfile

from app.models.session import Asset, AssetType
from app.config import get_settings


def _find_libreoffice() -> Optional[str]:
    """Find LibreOffice executable on the system."""
    if sys.platform == "win32":
        # Common Windows installation paths
        possible_paths = [
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
            os.path.expandvars(r"%PROGRAMFILES%\LibreOffice\program\soffice.exe"),
            os.path.expandvars(r"%PROGRAMFILES(X86)%\LibreOffice\program\soffice.exe"),
        ]
        for path in possible_paths:
            if os.path.exists(path):
                return path
    else:
        # Unix-like systems - check if soffice is in PATH
        import shutil as sh
        soffice = sh.which("soffice")
        if soffice:
            return soffice
    return None


class AssetProcessor:
    """Process uploaded assets (images, videos, PPTX)."""

    def __init__(self):
        self._settings = get_settings()

    async def process_assets(
        self, session_id: str, files: List[UploadFile]
    ) -> List[Asset]:
        """Process uploaded files and return asset manifest."""
        assets = []
        asset_dir = Path(self._settings.storage_path) / "assets" / session_id
        asset_dir.mkdir(parents=True, exist_ok=True)

        for file in files:
            if not file.filename:
                continue

            ext = Path(file.filename).suffix.lower()

            if ext in [".ppt", ".pptx"]:
                ppt_assets = await self._process_ppt(file, session_id, asset_dir)
                assets.extend(ppt_assets)
            elif ext in [".png", ".jpg", ".jpeg", ".webp", ".gif"]:
                asset = await self._process_image(file, session_id, asset_dir)
                assets.append(asset)
            elif ext in [".mp4", ".webm"]:
                asset = await self._process_video(file, session_id, asset_dir)
                assets.append(asset)

        return assets

    async def _process_ppt(
        self, file: UploadFile, session_id: str, asset_dir: Path
    ) -> List[Asset]:
        """Convert PPTX to images."""
        assets = []

        # Save PPT temporarily
        temp_path = asset_dir / file.filename
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)

        try:
            # Try to convert using LibreOffice
            image_paths = self._convert_pptx_to_images(str(temp_path), str(asset_dir))

            for i, path in enumerate(image_paths):
                asset_id = f"slide-{i + 1:03d}"
                assets.append(
                    Asset(
                        asset_id=asset_id,
                        title=f"Slide {i + 1}",
                        type=AssetType.IMAGE,
                        url=f"/storage/{session_id}/{Path(path).name}",
                    )
                )
        except Exception as e:
            print(f"PPTX conversion failed: {e}")
            # Fallback: treat as single asset
            asset_id = f"ppt-{uuid.uuid4().hex[:8]}"
            assets.append(
                Asset(
                    asset_id=asset_id,
                    title=Path(file.filename).stem,
                    type=AssetType.IMAGE,
                    url=f"/storage/{session_id}/{file.filename}",
                )
            )
        finally:
            # Clean up original PPT if converted
            if temp_path.exists() and len(assets) > 1:
                temp_path.unlink()

        return assets

    def _convert_pptx_to_images(self, pptx_path: str, output_dir: str) -> List[str]:
        """Convert PPTX to images using LibreOffice (PPTX->PDF) + PyMuPDF (PDF->images)."""
        import fitz  # PyMuPDF
        from PIL import Image
        import io

        output_paths = []

        # Find LibreOffice executable
        soffice_path = _find_libreoffice()
        if not soffice_path:
            raise RuntimeError("LibreOffice not found. Please install LibreOffice.")

        with tempfile.TemporaryDirectory() as temp_dir:
            # Step 1: Convert PPTX to PDF using LibreOffice
            try:
                subprocess.run(
                    [
                        soffice_path,
                        "--headless",
                        "--convert-to",
                        "pdf",
                        "--outdir",
                        temp_dir,
                        pptx_path,
                    ],
                    check=True,
                    capture_output=True,
                    timeout=120,
                )
            except (subprocess.CalledProcessError, FileNotFoundError) as e:
                raise RuntimeError(f"LibreOffice conversion failed: {e}")

            # Find the generated PDF
            pptx_name = Path(pptx_path).stem
            pdf_path = Path(temp_dir) / f"{pptx_name}.pdf"

            if not pdf_path.exists():
                raise FileNotFoundError(f"PDF not generated for {pptx_path}")

            # Step 2: Convert PDF pages to images using PyMuPDF
            pdf_doc = fitz.open(str(pdf_path))

            for i, page in enumerate(pdf_doc):
                # Render page at 2x resolution for quality
                mat = fitz.Matrix(2, 2)
                pix = page.get_pixmap(matrix=mat)

                # Convert to PIL Image
                img_data = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_data))

                # Save as WebP
                output_path = Path(output_dir) / f"slide-{i + 1:03d}.webp"
                try:
                    img.save(str(output_path), "WEBP", quality=85)
                except Exception:
                    # Fallback to PNG if WebP fails
                    output_path = Path(output_dir) / f"slide-{i + 1:03d}.png"
                    img.save(str(output_path), "PNG")

                output_paths.append(str(output_path))

            pdf_doc.close()

        return output_paths

    async def _process_image(
        self, file: UploadFile, session_id: str, asset_dir: Path
    ) -> Asset:
        """Process and save image file."""
        asset_id = f"img-{uuid.uuid4().hex[:8]}"
        ext = Path(file.filename).suffix.lower()
        filename = f"{asset_id}{ext}"

        file_path = asset_dir / filename
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        return Asset(
            asset_id=asset_id,
            title=Path(file.filename).stem,
            type=AssetType.IMAGE,
            url=f"/storage/{session_id}/{filename}",
        )

    async def _process_video(
        self, file: UploadFile, session_id: str, asset_dir: Path
    ) -> Asset:
        """Process and save video file."""
        asset_id = f"vid-{uuid.uuid4().hex[:8]}"
        ext = Path(file.filename).suffix.lower()
        filename = f"{asset_id}{ext}"

        file_path = asset_dir / filename
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        return Asset(
            asset_id=asset_id,
            title=Path(file.filename).stem,
            type=AssetType.VIDEO,
            url=f"/storage/{session_id}/{filename}",
            poster_url=None,
            duration_sec=None,
        )


# Singleton instance
asset_processor = AssetProcessor()

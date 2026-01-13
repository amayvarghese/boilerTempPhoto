from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import cv2
import numpy as np
import io
import os
from pathlib import Path
from typing import List

app = FastAPI(title="360 Image Stitching API")

def read_image(file: UploadFile) -> np.ndarray:
    data = np.frombuffer(file.file.read(), np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image file")
    return img


def load_images_from_folder(folder_path: str = "Images") -> List[np.ndarray]:
    """Load all images from the specified folder, sorted by filename."""
    folder = Path(folder_path)
    if not folder.exists():
        raise ValueError(f"Folder {folder_path} does not exist")
    
    # Supported image extensions
    image_extensions = {'.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'}
    
    # Get all image files and sort them
    image_files = sorted([
        f for f in folder.iterdir() 
        if f.is_file() and f.suffix in image_extensions
    ])
    
    if len(image_files) < 2:
        raise ValueError(f"Need at least 2 images, found {len(image_files)}")
    
    images = []
    for img_path in image_files:
        img = cv2.imread(str(img_path))
        if img is not None:
            images.append(img)
        else:
            print(f"Warning: Could not load {img_path}")
    
    if len(images) < 2:
        raise ValueError(f"Successfully loaded only {len(images)} images, need at least 2")
    
    return images


def stitch_images(images: list[np.ndarray]) -> np.ndarray:
    stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
    status, pano = stitcher.stitch(images)

    if status != cv2.Stitcher_OK:
        raise RuntimeError(f"Stitching failed with status {status}")

    return pano


def pano_to_equirectangular(pano: np.ndarray,
                            output_w: int = 2048,
                            output_h: int = 1024) -> np.ndarray:
    h, w = pano.shape[:2]

    x_map = np.zeros((output_h, output_w), np.float32)
    y_map = np.zeros((output_h, output_w), np.float32)

    for y in range(output_h):
        theta = (y / output_h - 0.5) * np.pi
        for x in range(output_w):
            phi = (x / output_w - 0.5) * 2 * np.pi

            xs = 0.5 * w * (phi / np.pi + 1)
            ys = 0.5 * h * (theta / (np.pi / 2) + 1)

            x_map[y, x] = xs
            y_map[y, x] = ys

    return cv2.remap(
        pano,
        x_map,
        y_map,
        interpolation=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_WRAP
    )


@app.post("/stitch-360")
async def stitch_360(images: list[UploadFile] = File(...)):
    if len(images) < 2:
        raise HTTPException(status_code=400, detail="At least two images required")

    try:
        cv_images = [read_image(img) for img in images]
        pano = stitch_images(cv_images)
        equirect = pano_to_equirectangular(pano)

        _, encoded = cv2.imencode(".jpg", equirect, [cv2.IMWRITE_JPEG_QUALITY, 95])
        buffer = io.BytesIO(encoded.tobytes())

        return StreamingResponse(
            buffer,
            media_type="image/jpeg",
            headers={"Content-Disposition": "attachment; filename=360.jpg"}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/stitch-from-folder")
async def stitch_from_folder(folder_path: str = "Images", save_output: bool = True):
    """Stitch images from the Images folder and optionally save the result."""
    try:
        # Load images from folder
        cv_images = load_images_from_folder(folder_path)
        
        print(f"Loaded {len(cv_images)} images from {folder_path}")
        
        # Stitch images
        pano = stitch_images(cv_images)
        
        # Convert to equirectangular
        equirect = pano_to_equirectangular(pano)
        
        # Save if requested
        if save_output:
            output_path = Path(folder_path).parent / "stitched_output.jpg"
            cv2.imwrite(str(output_path), equirect)
            print(f"Saved stitched image to {output_path}")
        
        # Return as response
        _, encoded = cv2.imencode(".jpg", equirect, [cv2.IMWRITE_JPEG_QUALITY, 95])
        buffer = io.BytesIO(encoded.tobytes())
        
        return StreamingResponse(
            buffer,
            media_type="image/jpeg",
            headers={"Content-Disposition": "attachment; filename=stitched_360.jpg"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stitch-from-folder")
async def stitch_from_folder_get(folder_path: str = "Images", save_output: bool = True):
    """GET endpoint for stitching images from folder."""
    return await stitch_from_folder(folder_path, save_output)

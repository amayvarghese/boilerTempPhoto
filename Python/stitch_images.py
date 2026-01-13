#!/usr/bin/env python3
"""
Standalone script to stitch images from the Images folder.
Run this directly: python stitch_images.py
"""

import cv2
import numpy as np
from pathlib import Path
from typing import List


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
        print(f"Loading {img_path.name}...")
        img = cv2.imread(str(img_path))
        if img is not None:
            images.append(img)
            print(f"  ✓ Loaded: {img.shape[1]}x{img.shape[0]}")
        else:
            print(f"  ✗ Warning: Could not load {img_path}")
    
    if len(images) < 2:
        raise ValueError(f"Successfully loaded only {len(images)} images, need at least 2")
    
    return images


def stitch_images(images: List[np.ndarray]) -> np.ndarray:
    """Stitch images together using OpenCV's stitcher."""
    print(f"\nStitching {len(images)} images...")
    
    # Try SCANS mode first (better for 360-degree images)
    try:
        stitcher = cv2.Stitcher_create(cv2.Stitcher_SCANS)
        print("  Using SCANS mode...")
    except:
        # Fallback to PANORAMA mode if SCANS not available
        stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
        print("  Using PANORAMA mode...")
    
    status, pano = stitcher.stitch(images)
    
    if status != cv2.Stitcher_OK:
        # If SCANS failed, try PANORAMA mode
        if hasattr(cv2, 'Stitcher_PANORAMA'):
            print("  SCANS mode failed, trying PANORAMA mode...")
            stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
            status, pano = stitcher.stitch(images)
        
        if status != cv2.Stitcher_OK:
            # Common error codes (may vary by OpenCV version)
            error_codes = {
                1: "Need more images or insufficient overlap",
                2: "Homography estimation failed - images may not have enough matching features", 
                3: "Camera parameter adjustment failed"
            }
            error_msg = error_codes.get(status, f"Stitching failed with status code: {status}")
            raise RuntimeError(error_msg)
    
    print(f"✓ Stitching successful! Panorama size: {pano.shape[1]}x{pano.shape[0]}")
    return pano


def pano_to_equirectangular(pano: np.ndarray,
                            output_w: int = 2048,
                            output_h: int = 1024) -> np.ndarray:
    """Convert panorama to equirectangular projection."""
    print(f"\nConverting to equirectangular ({output_w}x{output_h})...")
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
    
    equirect = cv2.remap(
        pano,
        x_map,
        y_map,
        interpolation=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_WRAP
    )
    
    print("✓ Conversion complete!")
    return equirect


def main():
    """Main function to stitch images from the Images folder."""
    try:
        # Load images
        images = load_images_from_folder("Images")
        
        # Stitch images
        pano = stitch_images(images)
        
        # Convert to equirectangular
        equirect = pano_to_equirectangular(pano)
        
        # Save the result
        output_path = Path("Images") / "stitched_output.jpg"
        cv2.imwrite(str(output_path), equirect)
        print(f"\n✓ Saved stitched image to: {output_path}")
        
        # Also save the raw panorama
        pano_path = Path("Images") / "panorama.jpg"
        cv2.imwrite(str(pano_path), pano)
        print(f"✓ Saved panorama to: {pano_path}")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())

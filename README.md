# 360° Spherical Image Capture Web Application

A mobile-first web application for capturing images positioned across a virtual sphere, ensuring controlled overlap between captures. Built with React, Vite, Three.js, and native browser APIs.

## Features

- **Live Camera Feed**: Fullscreen camera view with environment-facing camera
- **AR-Style Overlay**: 3D visualization of target capture points on a sphere
- **Device Orientation Tracking**: Real-time alignment using device gyroscope
- **Auto-Capture**: Automatically captures images when aligned with target points
- **Overlap Control**: Ensures 30-40% overlap between neighboring captures
- **Coverage Visualization**: Real-time overlay showing captured/uncaptured regions
- **Gallery View**: Browse and download captured images

## Tech Stack

- **React** (latest) + **Vite**
- **Three.js** with `@react-three/fiber` and `@react-three/drei`
- **Native Browser APIs**: Camera API, Device Orientation API
- **lucide-react** for icons

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Build

```bash
npm run build
```

## Usage

1. **Permissions**: Grant camera and device orientation permissions
2. **Capture**: Rotate your device to align with target points (red spheres)
3. **Auto-Capture**: Images are automatically captured when aligned for 500ms
4. **Gallery**: View all captured images and download them

## Mobile Requirements

- **iOS 13+**: Requires explicit device orientation permission
- **Camera**: Must support environment-facing camera
- **HTTPS**: Required for camera access (or localhost for development)

## Browser Compatibility

- iOS Safari 13+
- Chrome/Edge (Android)
- Firefox (Android)

## Notes

- Each image remains independent (no panorama stitching)
- Capture points are distributed using Fibonacci sphere algorithm
- Overlap is calculated based on camera FOV (default 65°)
- Coverage overlay updates in real-time as images are captured


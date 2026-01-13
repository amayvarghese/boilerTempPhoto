import { useRef, useEffect } from 'react'
import { Vector3 } from 'three'
import { angularDistance, calculateOverlap } from '../utils/sphereDistribution'
import './CoverageOverlay.css'

export default function CoverageOverlay({ capturedPoints, cameraForward, cameraFOV }) {
  const canvasRef = useRef(null)
  const animationFrameRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height
    const centerX = width / 2
    const centerY = height / 2

    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      if (capturedPoints.length === 0) {
        // No captures yet, show neutral overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
        ctx.fillRect(0, 0, width, height)
        return
      }

      // Create coverage map
      const coverageMap = new ImageData(width, height)
      const data = coverageMap.data

      // Sample points across the canvas
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          // Convert screen coordinates to spherical direction
          const normalizedX = (x - centerX) / Math.min(width, height)
          const normalizedY = (y - centerY) / Math.min(width, height)
          
          // Project to sphere (simplified equirectangular projection)
          const theta = normalizedX * Math.PI // azimuth
          const phi = normalizedY * Math.PI / 2 // elevation (limited to ±90°)
          
          const direction = new Vector3(
            Math.cos(phi) * Math.sin(theta),
            Math.sin(phi),
            -Math.cos(phi) * Math.cos(theta)
          )

          // Check if this direction is covered by any capture
          let isCovered = false
          let maxCoverage = 0

          for (const captured of capturedPoints) {
            const dist = angularDistance(direction, captured.position)
            const overlap = calculateOverlap(cameraFOV, dist)
            
            // If within FOV cone, it's covered
            if (dist < (cameraFOV * Math.PI / 180 / 2)) {
              isCovered = true
              maxCoverage = Math.max(maxCoverage, overlap)
            }
          }

          // Set pixel color based on coverage
          const index = (y * width + x) * 4
          
          if (isCovered) {
            // Green tint for captured regions (lighter = better coverage)
            const intensity = Math.min(255, 100 + maxCoverage * 1.5)
            data[index] = 0 // R
            data[index + 1] = intensity // G
            data[index + 2] = 0 // B
            data[index + 3] = 80 // Alpha
          } else {
            // Dark tint for uncaptured regions
            data[index] = 0 // R
            data[index + 1] = 0 // G
            data[index + 2] = 0 // B
            data[index + 3] = 120 // Alpha
          }
        }
      }

      // Draw coverage map
      ctx.putImageData(coverageMap, 0, 0)

      // Draw current camera view indicator
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(centerX, centerY, Math.min(width, height) * 0.3, 0, Math.PI * 2)
      ctx.stroke()
    }

    const animate = () => {
      draw()
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [capturedPoints, cameraForward, cameraFOV])

  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    window.addEventListener('orientationchange', resizeCanvas)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('orientationchange', resizeCanvas)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="coverage-overlay"
    />
  )
}


import { useRef, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { DeviceOrientationControls, Sphere, Circle } from '@react-three/drei'
import { Vector3 } from 'three'
import { generateFibonacciSpherePoints, angularDistance, calculateOverlap } from '../utils/sphereDistribution'
import CoverageOverlay from './CoverageOverlay'
import './CaptureView.css'

const CAMERA_FOV = 65 // degrees
const CAPTURE_THRESHOLD = 3 // degrees alignment threshold
const STABILITY_DURATION = 300 // milliseconds

function Scene({ 
  targetPoints, 
  capturedPoints, 
  onCapture, 
  videoRef,
  setCameraForward 
}) {
  const reticleRef = useRef()
  const stabilityTimerRef = useRef(null)
  const lastAlignmentRef = useRef(null)

  useFrame((state) => {
    const camera = state.camera
    if (!camera) return

    // Get camera forward direction
    const cameraForward = new Vector3(0, 0, -1)
    cameraForward.applyQuaternion(camera.quaternion)
    setCameraForward(cameraForward)

    // Find nearest uncaptured target point
    let nearestPoint = null
    let nearestDistance = Infinity
    let nearestIndex = -1

    targetPoints.forEach((point, index) => {
      const isCaptured = capturedPoints.some(cp => cp.index === index)
      if (isCaptured) return

      const distance = angularDistance(cameraForward, point)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestPoint = point
        nearestIndex = index
      }
    })

    // Check if aligned with target
    if (nearestPoint && nearestDistance < (CAPTURE_THRESHOLD * Math.PI / 180)) {
      // Check overlap constraints with nearest captured point
      // First capture is always allowed
      let canCapture = capturedPoints.length === 0
      
      if (capturedPoints.length > 0) {
        // Find nearest captured point to check overlap
        let nearestCapturedDistance = Infinity
        capturedPoints.forEach(captured => {
          const dist = angularDistance(nearestPoint, captured.position)
          nearestCapturedDistance = Math.min(nearestCapturedDistance, dist)
        })

        // Calculate overlap with nearest capture
        const overlap = calculateOverlap(CAMERA_FOV, nearestCapturedDistance)
        
        // Allow capture if overlap is reasonable (20-50% range, more lenient for auto-capture)
        // Also allow if no overlap but reasonable distance (to ensure we can capture all 12 points)
        canCapture = (overlap >= 20 && overlap <= 50) || (nearestCapturedDistance > 0.3 && nearestCapturedDistance < 1.5)
      }

      if (canCapture) {
        const now = Date.now()
        
        // Check if we've been stable for required duration
        if (lastAlignmentRef.current === nearestIndex) {
          if (!stabilityTimerRef.current) {
            stabilityTimerRef.current = now
          } else if (now - stabilityTimerRef.current >= STABILITY_DURATION) {
            // Trigger capture
            onCapture(nearestIndex, nearestPoint, cameraForward)
            stabilityTimerRef.current = null
            lastAlignmentRef.current = null
          }
        } else {
          lastAlignmentRef.current = nearestIndex
          stabilityTimerRef.current = now
        }
      } else {
        stabilityTimerRef.current = null
        lastAlignmentRef.current = null
      }
    } else {
      stabilityTimerRef.current = null
      lastAlignmentRef.current = null
    }
  })

  return (
    <>
      <DeviceOrientationControls />
      
      {/* Reticle at screen center */}
      <Circle ref={reticleRef} args={[0.02, 32]} position={[0, 0, -0.5]}>
        <meshBasicMaterial color="#00ff00" transparent opacity={0.8} />
      </Circle>

      {/* Target points */}
      {targetPoints.map((point, index) => {
        const isCaptured = capturedPoints.some(cp => cp.index === index)
        return (
          <Sphere
            key={index}
            args={[0.03, 16, 16]}
            position={point}
          >
            <meshBasicMaterial
              color={isCaptured ? '#00ff00' : '#ff6b6b'}
              transparent
              opacity={isCaptured ? 0.5 : 0.8}
            />
          </Sphere>
        )
      })}
    </>
  )
}

export default function CaptureView({ onComplete, onImagesCaptured }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [targetPoints, setTargetPoints] = useState([])
  const [capturedPoints, setCapturedPoints] = useState([])
  const [cameraForward, setCameraForward] = useState(new Vector3(0, 0, -1))
  const [captureCount, setCaptureCount] = useState(0)

  // Generate sphere points
  useEffect(() => {
    const points = generateFibonacciSpherePoints(24)
    setTargetPoints(points)
  }, [])

  // Initialize camera
  useEffect(() => {
    let mediaStream = null

    const initCamera = async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        })
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          videoRef.current.play()
        }
        
        setStream(mediaStream)

        // Create offscreen canvas for image capture
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas')
        }
      } catch (err) {
        console.error('Error accessing camera:', err)
        alert('Failed to access camera. Please check permissions.')
      }
    }

    initCamera()

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const captureImage = async (index, position, forward) => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth || video.clientWidth
    canvas.height = video.videoHeight || video.clientHeight

    // Draw video frame to canvas
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert to blob
    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', 0.95)
    })

    // Create image URL for display
    const imageUrl = URL.createObjectURL(blob)

    // Add to captured points
    const newCapturedPoint = {
      index,
      position: position.clone(),
      forward: forward.clone(),
      image: blob,
      imageUrl,
      timestamp: Date.now()
    }

    setCapturedPoints(prev => [...prev, newCapturedPoint])
    setCaptureCount(prev => prev + 1)

    // Update parent component
    if (onImagesCaptured) {
      onImagesCaptured([...capturedPoints, newCapturedPoint])
    }
  }

  const handleComplete = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
    }
    onComplete(capturedPoints)
  }

  return (
    <div className="capture-view">
      {/* Video background */}
      <video
        ref={videoRef}
        className="camera-video"
        autoPlay
        playsInline
        muted
      />

      {/* Three.js overlay */}
      <div className="three-overlay">
        <Canvas
          camera={{ position: [0, 0, 0], fov: CAMERA_FOV }}
          gl={{ alpha: true, antialias: true }}
        >
          <Scene
            targetPoints={targetPoints}
            capturedPoints={capturedPoints}
            onCapture={captureImage}
            videoRef={videoRef}
            setCameraForward={setCameraForward}
          />
        </Canvas>
      </div>

      {/* Coverage overlay */}
      <CoverageOverlay
        capturedPoints={capturedPoints}
        cameraForward={cameraForward}
        cameraFOV={CAMERA_FOV}
      />

      {/* UI overlay */}
      <div className="capture-ui">
        <div className="capture-stats">
          <span className="capture-count">{captureCount} / {targetPoints.length}</span>
        </div>
        {capturedPoints.length > 0 && (
          <button 
            onClick={handleComplete}
            className="complete-button"
          >
            Proceed with {captureCount} Image{captureCount !== 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  )
}


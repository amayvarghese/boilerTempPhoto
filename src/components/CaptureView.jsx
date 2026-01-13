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
  setCameraForward,
  setReticleState,
  setDeviceOrientation
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

    // Get device orientation for level indicator
    const up = new Vector3(0, 1, 0)
    up.applyQuaternion(camera.quaternion)
    setDeviceOrientation({
      pitch: Math.asin(Math.max(-1, Math.min(1, up.y))) * (180 / Math.PI),
      roll: Math.atan2(up.x, up.z) * (180 / Math.PI)
    })

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
    const isAligned = nearestPoint && nearestDistance < (CAPTURE_THRESHOLD * Math.PI / 180)
    let canCapture = false
    let isReady = false

    if (isAligned) {
      // Check overlap constraints with nearest captured point
      // First capture is always allowed
      canCapture = capturedPoints.length === 0
      
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
            isReady = true
            // Trigger capture
            onCapture(nearestIndex, nearestPoint, cameraForward)
            stabilityTimerRef.current = null
            lastAlignmentRef.current = null
          } else {
            isReady = true // Aligned and counting down
          }
        } else {
          lastAlignmentRef.current = nearestIndex
          stabilityTimerRef.current = now
        }
      }
    } else {
      stabilityTimerRef.current = null
      lastAlignmentRef.current = null
    }

    // Update reticle state
    setReticleState({
      isAligned,
      canCapture,
      isReady,
      distance: nearestDistance * (180 / Math.PI) // Convert to degrees
    })

    // Update reticle color based on state
    if (reticleRef.current && reticleRef.current.material) {
      if (isReady && canCapture) {
        reticleRef.current.material.color.setHex(0x00ff00) // Green when ready
        reticleRef.current.material.opacity = 1.0
      } else if (isAligned && canCapture) {
        reticleRef.current.material.color.setHex(0x00ff00) // Green when aligned
        reticleRef.current.material.opacity = 0.6
      } else {
        reticleRef.current.material.color.setHex(0xffffff) // White when not aligned
        reticleRef.current.material.opacity = 0.4
      }
    }
  })

  return (
    <>
      <DeviceOrientationControls />
      
      {/* Reticle at screen center */}
      <Circle ref={reticleRef} args={[0.02, 32]} position={[0, 0, -0.5]}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
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
  const [reticleState, setReticleState] = useState({ isAligned: false, canCapture: false, isReady: false, distance: 0 })
  const [deviceOrientation, setDeviceOrientation] = useState({ pitch: 0, roll: 0 })

  // Generate sphere points
  // 6 axis endpoints (±x, ±y, ±z) + 14 evenly distributed points between axes = 20 total
  useEffect(() => {
    const points = generateFibonacciSpherePoints(20)
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
            setReticleState={setReticleState}
            setDeviceOrientation={setDeviceOrientation}
          />
        </Canvas>
      </div>

      {/* Coverage overlay */}
      <CoverageOverlay
        capturedPoints={capturedPoints}
        cameraForward={cameraForward}
        cameraFOV={CAMERA_FOV}
      />

      {/* Level Indicator */}
      <div className="level-indicator">
        <div className="level-bubble">
          <div 
            className="level-dot"
            style={{
              transform: `translate(${deviceOrientation.roll * 2}px, ${deviceOrientation.pitch * 2}px)`
            }}
          />
        </div>
        <div className="level-labels">
          <span className="level-label">Level</span>
        </div>
      </div>

      {/* Circular Progress Indicator */}
      <div className="circular-progress">
        <svg className="progress-ring" viewBox="0 0 100 100">
          <circle
            className="progress-ring-background"
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="4"
          />
          <circle
            className="progress-ring-fill"
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#00ff00"
            strokeWidth="4"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - captureCount / targetPoints.length)}`}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="progress-text">
          <span className="progress-count">{captureCount}</span>
          <span className="progress-total">/ {targetPoints.length}</span>
        </div>
      </div>

      {/* UI overlay */}
      <div className="capture-ui">
        <div className="capture-stats">
          <span className="capture-count">{captureCount} / {targetPoints.length}</span>
          {reticleState.isAligned && (
            <div className="alignment-status">
              {reticleState.isReady ? (
                <span className="status-ready">Ready to capture!</span>
              ) : (
                <span className="status-aligning">Aligning... {reticleState.distance.toFixed(1)}°</span>
              )}
            </div>
          )}
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


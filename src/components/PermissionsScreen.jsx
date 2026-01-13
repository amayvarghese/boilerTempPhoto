import { useState, useEffect } from 'react'
import { Camera, RotateCw, CheckCircle, AlertCircle } from 'lucide-react'
import './PermissionsScreen.css'

export default function PermissionsScreen({ onPermissionsGranted }) {
  const [cameraPermission, setCameraPermission] = useState('prompt')
  const [orientationPermission, setOrientationPermission] = useState('prompt')
  const [isRequesting, setIsRequesting] = useState(false)

  useEffect(() => {
    checkPermissions()
  }, [])

  const checkPermissions = async () => {
    // Check camera permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(track => track.stop())
      setCameraPermission('granted')
    } catch (err) {
      setCameraPermission('denied')
    }

    // Check device orientation (iOS 13+)
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ requires explicit permission
      setOrientationPermission('prompt')
    } else {
      // Other platforms don't require explicit permission
      setOrientationPermission('granted')
    }
  }

  const requestCameraPermission = async () => {
    setIsRequesting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      stream.getTracks().forEach(track => track.stop())
      setCameraPermission('granted')
    } catch (err) {
      setCameraPermission('denied')
      alert('Camera permission is required to capture images. Please enable it in your browser settings.')
    } finally {
      setIsRequesting(false)
    }
  }

  const requestOrientationPermission = async () => {
    setIsRequesting(true)
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && 
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission()
        if (permission === 'granted') {
          setOrientationPermission('granted')
        } else {
          setOrientationPermission('denied')
          alert('Device orientation permission is required for AR overlay. Please enable it in your browser settings.')
        }
      } else {
        setOrientationPermission('granted')
      }
    } catch (err) {
      setOrientationPermission('denied')
    } finally {
      setIsRequesting(false)
    }
  }

  const handleContinue = () => {
    if (cameraPermission === 'granted' && orientationPermission === 'granted') {
      onPermissionsGranted()
    }
  }

  const allGranted = cameraPermission === 'granted' && orientationPermission === 'granted'

  return (
    <div className="permissions-screen">
      <div className="permissions-content">
        <h1>360° Spherical Capture</h1>
        <p className="subtitle">Capture images from all directions to create a complete spherical view</p>

        <div className="permissions-list">
          <div className="permission-item">
            <div className="permission-icon">
              <Camera size={32} />
            </div>
            <div className="permission-info">
              <h3>Camera Access</h3>
              <p>Required to capture images</p>
            </div>
            <div className="permission-status">
              {cameraPermission === 'granted' ? (
                <CheckCircle className="status-icon granted" size={24} />
              ) : cameraPermission === 'denied' ? (
                <AlertCircle className="status-icon denied" size={24} />
              ) : (
                <button 
                  onClick={requestCameraPermission}
                  disabled={isRequesting}
                  className="permission-button"
                >
                  Grant
                </button>
              )}
            </div>
          </div>

          <div className="permission-item">
            <div className="permission-icon">
              <RotateCw size={32} />
            </div>
            <div className="permission-info">
              <h3>Device Orientation</h3>
              <p>Required for AR overlay alignment</p>
            </div>
            <div className="permission-status">
              {orientationPermission === 'granted' ? (
                <CheckCircle className="status-icon granted" size={24} />
              ) : orientationPermission === 'denied' ? (
                <AlertCircle className="status-icon denied" size={24} />
              ) : (
                <button 
                  onClick={requestOrientationPermission}
                  disabled={isRequesting}
                  className="permission-button"
                >
                  Grant
                </button>
              )}
            </div>
          </div>
        </div>

        <button 
          onClick={handleContinue}
          disabled={!allGranted || isRequesting}
          className="continue-button"
        >
          Start Capturing
        </button>
      </div>
    </div>
  )
}


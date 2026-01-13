import { useState } from 'react'
import PermissionsScreen from './components/PermissionsScreen'
import CaptureView from './components/CaptureView'
import GalleryView from './components/GalleryView'
import './App.css'

function App() {
  const [view, setView] = useState('permissions') // 'permissions', 'capture', 'gallery'
  const [capturedImages, setCapturedImages] = useState([])

  const handlePermissionsGranted = () => {
    setView('capture')
  }

  const handleCaptureComplete = (capturedPoints) => {
    setCapturedImages(capturedPoints)
    setView('gallery')
  }

  const handleImagesCaptured = (images) => {
    setCapturedImages(images)
  }

  const handleRestart = () => {
    setCapturedImages([])
    setView('capture')
  }

  const handleBackToCapture = () => {
    setView('capture')
  }

  return (
    <div className="app">
      {view === 'permissions' && (
        <PermissionsScreen onPermissionsGranted={handlePermissionsGranted} />
      )}
      {view === 'capture' && (
        <CaptureView
          onComplete={handleCaptureComplete}
          onImagesCaptured={handleImagesCaptured}
        />
      )}
      {view === 'gallery' && (
        <GalleryView
          capturedPoints={capturedImages}
          onRestart={handleRestart}
          onBack={handleBackToCapture}
        />
      )}
    </div>
  )
}

export default App


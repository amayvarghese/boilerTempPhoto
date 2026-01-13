import { useState } from 'react'
import { ArrowLeft, RotateCcw, Download } from 'lucide-react'
import './GalleryView.css'

export default function GalleryView({ capturedPoints, onRestart, onBack }) {
  const [selectedImage, setSelectedImage] = useState(null)

  const downloadImage = (imageUrl, index) => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `spherical-capture-${index + 1}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadAll = () => {
    capturedPoints.forEach((point, index) => {
      setTimeout(() => {
        downloadImage(point.imageUrl, index)
      }, index * 200)
    })
  }

  if (selectedImage !== null) {
    return (
      <div className="gallery-fullscreen">
        <div className="fullscreen-header">
          <button onClick={() => setSelectedImage(null)} className="back-button">
            <ArrowLeft size={24} />
          </button>
          <button 
            onClick={() => downloadImage(capturedPoints[selectedImage].imageUrl, selectedImage)}
            className="download-button"
          >
            <Download size={24} />
          </button>
        </div>
        <img 
          src={capturedPoints[selectedImage].imageUrl} 
          alt={`Capture ${selectedImage + 1}`}
          className="fullscreen-image"
        />
      </div>
    )
  }

  return (
    <div className="gallery-view">
      <div className="gallery-header">
        <button onClick={onBack} className="header-button">
          <ArrowLeft size={24} />
        </button>
        <h1>Gallery</h1>
        <button onClick={onRestart} className="header-button">
          <RotateCcw size={24} />
        </button>
      </div>

      <div className="gallery-stats">
        <p>{capturedPoints.length} images captured</p>
        {capturedPoints.length > 0 && (
          <button onClick={downloadAll} className="download-all-button">
            <Download size={18} />
            Download All
          </button>
        )}
      </div>

      <div className="gallery-grid">
        {capturedPoints.map((point, index) => (
          <div 
            key={index} 
            className="gallery-item"
            onClick={() => setSelectedImage(index)}
          >
            <img 
              src={point.imageUrl} 
              alt={`Capture ${index + 1}`}
              className="gallery-image"
            />
            <div className="gallery-item-overlay">
              <span className="gallery-item-number">{index + 1}</span>
            </div>
          </div>
        ))}
      </div>

      {capturedPoints.length === 0 && (
        <div className="gallery-empty">
          <p>No images captured yet</p>
          <button onClick={onBack} className="back-to-capture-button">
            Start Capturing
          </button>
        </div>
      )}
    </div>
  )
}


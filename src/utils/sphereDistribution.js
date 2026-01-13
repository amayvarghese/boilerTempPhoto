import { Vector3 } from 'three'

/**
 * Generate points on a sphere with equal angular spacing
 * Uses spherical coordinates with uniform theta (elevation) and phi (azimuth) spacing
 * Ensures consistent angular distance between capture points for optimal overlap
 */
export function generateFibonacciSpherePoints(count = 50) {
  const points = []
  
  // Calculate optimal number of elevation bands
  // For better distribution, find factors that work well
  let numBands = Math.round(Math.sqrt(count))
  
  // Adjust to ensure we can distribute points evenly
  // Try to find a good balance between bands and points per band
  let pointsPerBand = Math.ceil(count / numBands)
  
  // Refine to get closer to the target count
  while (numBands * pointsPerBand > count * 1.2 && numBands > 1) {
    numBands--
    pointsPerBand = Math.ceil(count / numBands)
  }
  
  let pointIndex = 0
  
  for (let band = 0; band < numBands && pointIndex < count; band++) {
    // Elevation angle (theta): from -90° (bottom) to +90° (top)
    // Distribute evenly, avoiding exact poles
    const theta = (Math.PI / 2) * (1 - (2 * band + 1) / (numBands + 1))
    
    // Calculate how many points should be in this band
    const remainingPoints = count - pointIndex
    const remainingBands = numBands - band
    const pointsInThisBand = Math.min(
      Math.ceil(remainingPoints / remainingBands),
      pointsPerBand,
      remainingPoints
    )
    
    // Azimuth spacing: equal angular spacing around the circle
    const azimuthStep = (2 * Math.PI) / pointsInThisBand
    
    for (let i = 0; i < pointsInThisBand && pointIndex < count; i++) {
      // Azimuth angle (phi): evenly spaced around the circle
      const phi = azimuthStep * i
      
      // Convert spherical to Cartesian coordinates
      // In Three.js: x=right, y=up, z=forward
      const x = Math.sin(theta) * Math.cos(phi)
      const y = Math.cos(theta) // y is up in Three.js
      const z = Math.sin(theta) * Math.sin(phi)
      
      points.push(new Vector3(x, y, z))
      pointIndex++
    }
  }
  
  return points
}

/**
 * Calculate angular distance between two unit vectors (in radians)
 */
export function angularDistance(v1, v2) {
  const dot = Math.max(-1, Math.min(1, v1.dot(v2)))
  return Math.acos(dot)
}

/**
 * Calculate overlap percentage between two capture directions
 * Given camera FOV and angular distance between captures
 */
export function calculateOverlap(cameraFOV, angularDistance) {
  // Each capture covers a cone with half-angle = FOV/2
  const halfFOV = (cameraFOV * Math.PI) / 180 / 2
  
  // If captures are too far apart, no overlap
  if (angularDistance >= 2 * halfFOV) {
    return 0
  }
  
  // If captures are very close, calculate overlap
  if (angularDistance <= 2 * halfFOV) {
    // Simplified overlap calculation
    // Overlap = (2 * halfFOV - angularDistance) / (2 * halfFOV)
    const overlap = Math.max(0, (2 * halfFOV - angularDistance) / (2 * halfFOV))
    return overlap * 100
  }
  
  return 0
}

/**
 * Filter points to ensure 30-40% overlap with neighboring captures
 * Returns points that can be captured given existing captures
 */
export function getAvailableCapturePoints(
  allPoints,
  capturedPoints,
  cameraFOV = 65,
  minOverlap = 30,
  maxOverlap = 40
) {
  if (capturedPoints.length === 0) {
    return allPoints
  }

  return allPoints.filter((point, index) => {
    // Check if already captured
    if (capturedPoints.some(cp => cp.index === index)) {
      return false
    }

    // Find nearest captured point
    let minDistance = Infinity
    for (const captured of capturedPoints) {
      const distance = angularDistance(point, captured.position)
      minDistance = Math.min(minDistance, distance)
    }

    // Calculate overlap with nearest capture
    const overlap = calculateOverlap(cameraFOV, minDistance)

    // Only allow if overlap is within acceptable range
    return overlap >= minOverlap && overlap <= maxOverlap
  })
}


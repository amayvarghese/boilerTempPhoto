import { Vector3 } from 'three'

/**
 * Generate points on a sphere using Fibonacci sphere algorithm
 * Ensures even distribution across the sphere surface
 */
export function generateFibonacciSpherePoints(count = 50) {
  const points = []
  const goldenAngle = Math.PI * (3 - Math.sqrt(5)) // Golden angle in radians

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2 // y goes from 1 to -1
    const radius = Math.sqrt(1 - y * y) // radius at y
    const theta = goldenAngle * i // golden angle increment

    const x = Math.cos(theta) * radius
    const z = Math.sin(theta) * radius

    points.push(new Vector3(x, y, z))
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


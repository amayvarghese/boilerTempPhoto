import { Vector3 } from 'three'

/**
 * Generate points on a sphere with axis endpoints and evenly distributed points between axes
 * - Places minimal points at axis endpoints (±x, ±y, ±z) = 6 points
 * - Distributes remaining points evenly between axes at equal angular distances
 * - Uses octahedral structure: axis endpoints + points on edges and faces
 */
export function generateFibonacciSpherePoints(count = 50) {
  const points = []
  
  // Step 1: Add 6 axis endpoint points (±x, ±y, ±z)
  const axisPoints = [
    new Vector3(1, 0, 0),   // +x
    new Vector3(-1, 0, 0),   // -x
    new Vector3(0, 1, 0),   // +y (up)
    new Vector3(0, -1, 0),  // -y (down)
    new Vector3(0, 0, 1),   // +z (forward)
    new Vector3(0, 0, -1),  // -z (backward)
  ]
  
  // If count is 6 or less, just return axis points
  if (count <= 6) {
    return axisPoints.slice(0, count)
  }
  
  // Add axis endpoints
  points.push(...axisPoints)
  
  // Step 2: Calculate remaining points to distribute between axes
  const remainingCount = count - 6
  
  if (remainingCount <= 0) {
    return points
  }
  
  // Generate points between axes using octahedral structure
  // We'll create points on the 12 edges (between 2 axes) and 8 faces (between 3 axes)
  
  // Calculate how many intermediate points per edge/face
  // For equal angular spacing, we need to distribute points evenly
  
  // Number of intermediate levels between center and axis endpoints
  const numLevels = Math.ceil(Math.sqrt(remainingCount / 8))
  
  let pointIndex = 0
  
  // Generate points at different levels between axes
  for (let level = 1; level <= numLevels && pointIndex < remainingCount; level++) {
    const t = level / (numLevels + 1) // Distance from center (0 to 1)
    
    // Generate all combinations of ±1 for x, y, z (excluding pure axes)
    // This creates points on edges (2 non-zero) and faces (3 non-zero)
    const combinations = []
    
    // Points on edges (between 2 axes) - 12 edges total
    const edgeSigns = [
      [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0],  // xy plane
      [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1],  // xz plane
      [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1],  // yz plane
    ]
    
    // Points on faces (between 3 axes) - 8 octants
    const faceSigns = [
      [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
      [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
    ]
    
    // Combine edges and faces
    const allCombinations = [...edgeSigns, ...faceSigns]
    
    // Calculate how many points to add at this level
    const pointsAtThisLevel = Math.min(
      Math.ceil(remainingCount / numLevels),
      remainingCount - pointIndex
    )
    
    // Distribute points evenly across combinations
    const step = Math.max(1, Math.floor(allCombinations.length / pointsAtThisLevel))
    
    for (let i = 0; i < allCombinations.length && pointIndex < remainingCount; i += step) {
      const [sx, sy, sz] = allCombinations[i]
      
      // Create point at distance t from center along this direction, then normalize
      const x = sx * t
      const y = sy * t
      const z = sz * t
      
      const vec = new Vector3(x, y, z).normalize()
      points.push(vec)
      pointIndex++
    }
  }
  
  // Fill remaining points with evenly distributed spherical coordinates
  if (pointIndex < remainingCount) {
    const additionalNeeded = remainingCount - pointIndex
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    
    for (let i = 0; i < additionalNeeded; i++) {
      const y = 1 - (i / (additionalNeeded - 1)) * 2
      const radius = Math.sqrt(Math.max(0, 1 - y * y))
      const theta = goldenAngle * i
      
      const x = Math.cos(theta) * radius
      const z = Math.sin(theta) * radius
      
      points.push(new Vector3(x, y, z))
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


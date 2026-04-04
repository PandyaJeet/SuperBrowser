import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Environment, Lightformer } from '@react-three/drei'

function GradientBlobs() {
  const blob1 = useRef()
  const blob2 = useRef()
  const blob3 = useRef()

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (blob1.current) {
      blob1.current.position.x = Math.sin(t * 0.2) * 6
      blob1.current.position.y = Math.cos(t * 0.3) * 4
    }
    if (blob2.current) {
      blob2.current.position.x = Math.cos(t * 0.15) * 8
      blob2.current.position.y = Math.sin(t * 0.25) * 5
    }
    if (blob3.current) {
      blob3.current.position.y = Math.sin(t * 0.1) * 6
    }
  })

  // Large, very soft pastel spheres floating in the deep background
  // to mimic Antigravity's gradient color wash.
  return (
    <group position={[0, 0, -15]}>
      <mesh ref={blob1} position={[-6, 2, 0]}>
        <sphereGeometry args={[7, 32, 32]} />
        <meshBasicMaterial color="#e0eaff" transparent opacity={0.3} />
      </mesh>
      <mesh ref={blob2} position={[6, -4, 0]}>
        <sphereGeometry args={[9, 32, 32]} />
        <meshBasicMaterial color="#fae8ff" transparent opacity={0.25} />
      </mesh>
      <mesh ref={blob3} position={[0, 0, -5]}>
        <sphereGeometry args={[12, 32, 32]} />
        <meshBasicMaterial color="#e0f2fe" transparent opacity={0.2} />
      </mesh>
    </group>
  )
}

function DNAHelix() {
  const group = useRef()

  useFrame((state, delta) => {
    if (group.current) {
      // Rotate around its own long axis (Y)
      group.current.rotation.y += delta * 0.3
    }
  })

  const radius = 2.4 // Increased width

  // Generate DNA structure geometry
  const dnaData = useMemo(() => {
    const strandCount = 120 // Very long so it stretches across screen
    const heightStep = 0.5   // Increased spacing between base pairs (was 0.3)
    const angleStep = Math.PI / 16 // Slower twist
    const totalHeight = strandCount * heightStep

    const rungs = []
    for (let i = 0; i < strandCount; i++) {
      const y = i * heightStep - (totalHeight / 2)
      const angle = i * angleStep
      
      const x1 = Math.cos(angle) * radius
      const z1 = Math.sin(angle) * radius
      
      const x2 = Math.cos(angle + Math.PI) * radius
      const z2 = Math.sin(angle + Math.PI) * radius

      rungs.push({
        id: i,
        y, x1, z1, x2, z2, angle
      })
    }
    return rungs
  }, [])

  // Slant orientation: initial rotation places it diagonally across screen
  return (
    <Float speed={1.5} rotationIntensity={0} floatIntensity={0.5}>
      <group rotation={[0, 0, -Math.PI / 3]}>
        <group ref={group}>
          {dnaData.map((rung) => (
            <group key={rung.id}>
              {/* Opacity reduced to 30%, adding natural physical materials */}
              <mesh position={[rung.x1, rung.y, rung.z1]}>
                <sphereGeometry args={[0.15, 32, 32]} />
                <meshPhysicalMaterial color="#1a1c20" roughness={0.2} metalness={0.7} clearcoat={1} clearcoatRoughness={0.1} transparent opacity={0.3} />
              </mesh>
              <mesh position={[rung.x2, rung.y, rung.z2]}>
                <sphereGeometry args={[0.15, 32, 32]} />
                <meshPhysicalMaterial color="#1a1c20" roughness={0.2} metalness={0.7} clearcoat={1} clearcoatRoughness={0.1} transparent opacity={0.3} />
              </mesh>
              {/* Connecting Base Pair / Rung */}
              <mesh position={[0, rung.y, 0]} rotation={[0, -rung.angle, Math.PI / 2]}>
                <cylinderGeometry args={[0.04, 0.04, radius * 2, 16]} />
                <meshPhysicalMaterial color="#2d3748" roughness={0.4} metalness={0.5} clearcoat={0.5} transparent opacity={0.25} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </Float>
  )
}

export default function BackgroundOrb({ isVisible }) {
  return (
    <div 
      className={`fixed inset-0 pointer-events-none transition-opacity duration-1000 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'}`} 
      style={{ zIndex: 0 }}
    >
      <Canvas camera={{ position: [0, 0, 14], fov: 45 }} dpr={[1, 2]}>
        <color attach="background" args={['#ffffff']} /> 
        
        {/* Natural studio lighting: warm sunlight, cool sky fill */}
        <ambientLight intensity={1.2} color="#f8fafc" />
        <directionalLight position={[10, 15, 10]} intensity={2.5} color="#fef08a" /> {/* Warm/yellowish */}
        <directionalLight position={[-10, -5, -5]} intensity={1.5} color="#bae6fd" /> {/* Cool/bluish */}
        <pointLight position={[0, 0, 5]} intensity={1.5} color="#ffffff" />

        <GradientBlobs />
        <DNAHelix />

        <Environment resolution={256}>
          <group rotation={[-Math.PI / 4, -0.3, 0]}>
            <Lightformer intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={[10, 10, 1]} />
            <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={[20, 0.1, 1]} />
            <Lightformer rotation-y={Math.PI / 2} position={[-5, -1, -1]} scale={[20, 0.5, 1]} />
            <Lightformer rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={[20, 1, 1]} />
          </group>
        </Environment>
      </Canvas>
    </div>
  )
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MapControls, Environment, SoftShadows, Float, Outlines, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Grid, BuildingType, Era, Weather, ResourceType, Enemy } from '../types';
import { GRID_SIZE, BUILDINGS } from '../constants';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      boxGeometry: any;
      coneGeometry: any;
      cylinderGeometry: any;
      dodecahedronGeometry: any;
      directionalLight: any;
      group: any;
      instancedMesh: any;
      mesh: any;
      meshBasicMaterial: any;
      meshStandardMaterial: any;
      planeGeometry: any;
      sphereGeometry: any;
    }
  }
}

// --- Constants & Helpers ---
const WORLD_OFFSET = GRID_SIZE / 2 - 0.5;
const gridToWorld = (x: number, y: number) => [x - WORLD_OFFSET, 0, y - WORLD_OFFSET] as [number, number, number];
const getHash = (x: number, y: number) => Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
const coneGeo = new THREE.ConeGeometry(1, 1, 4);
const sphereGeo = new THREE.SphereGeometry(1, 8, 8);

// --- Enemy Renderer ---
const EnemyMesh = ({ enemy, onClick }: { enemy: Enemy; onClick: (id: string) => void }) => {
    const [wx, _, wz] = gridToWorld(enemy.x, enemy.y);
    
    // Pulse effect
    const meshRef = useRef<THREE.Group>(null);
    useFrame((state) => {
        if(meshRef.current) {
            meshRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 5) * 0.2;
            meshRef.current.rotation.y += 0.05;
        }
    });

    return (
        <group 
            position={[wx, 0.5, wz]} 
            ref={meshRef}
            onClick={(e) => { e.stopPropagation(); onClick(enemy.id); }}
        >
            {/* Mob Visuals */}
            <mesh castShadow receiveShadow>
                <dodecahedronGeometry args={[0.3, 0]} />
                <meshStandardMaterial color="#ef4444" emissive="#b91c1c" emissiveIntensity={0.5} roughness={0.2} />
            </mesh>
            {/* Eyes */}
            <mesh position={[0.15, 0.1, 0.15]}>
                <boxGeometry args={[0.1, 0.1, 0.1]} />
                <meshBasicMaterial color="yellow" />
            </mesh>
             <mesh position={[-0.15, 0.1, 0.15]}>
                <boxGeometry args={[0.1, 0.1, 0.1]} />
                <meshBasicMaterial color="yellow" />
            </mesh>
            {/* Health Bar */}
            <mesh position={[0, 0.5, 0]}>
                 <boxGeometry args={[0.6 * (enemy.hp / enemy.maxHp), 0.1, 0.05]} />
                 <meshBasicMaterial color="lime" />
            </mesh>
        </group>
    );
};


// --- Weather System ---

const WeatherEffects = ({ weather }: { weather: Weather }) => {
  const count = 500;
  const mesh = useRef<THREE.InstancedMesh>(null);
  
  useEffect(() => {
    if (weather === Weather.Sunny) return;
    
    const dummy = new THREE.Object3D();
    for(let i=0; i<count; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * GRID_SIZE * 2,
        Math.random() * 15,
        (Math.random() - 0.5) * GRID_SIZE * 2
      );
      dummy.updateMatrix();
      if(mesh.current) mesh.current.setMatrixAt(i, dummy.matrix);
    }
    if(mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, [weather]);

  useFrame((state, delta) => {
    if (weather === Weather.Sunny || !mesh.current) return;
    const dummy = new THREE.Object3D();
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();

    for(let i=0; i<count; i++) {
      mesh.current.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      
      let fallSpeed = weather === Weather.Rain ? 15 : 2;
      position.y -= fallSpeed * delta;
      
      // Reset height
      if(position.y < -1) {
        position.y = 15;
        position.x = (Math.random() - 0.5) * GRID_SIZE * 2;
        position.z = (Math.random() - 0.5) * GRID_SIZE * 2;
      }

      dummy.position.copy(position);
      // Rain streaks vs Snow flakes
      if(weather === Weather.Rain) {
         dummy.scale.set(0.05, 0.8, 0.05);
      } else {
         dummy.scale.setScalar(0.1);
         dummy.rotation.x += delta;
         dummy.rotation.y += delta;
      }
      
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  if (weather === Weather.Sunny) return null;

  return (
    <instancedMesh ref={mesh} args={[boxGeo, undefined, count]}>
      <meshBasicMaterial color={weather === Weather.Rain ? "#a5f3fc" : "#ffffff"} transparent opacity={0.6} />
    </instancedMesh>
  );
};

// --- Era-Based Building Logic ---

interface BuildingMeshProps {
  type: BuildingType;
  baseColor: string;
  x: number;
  y: number;
  era: Era;
  variant: number;
  resourceUnderlay: ResourceType;
  opacity?: number;
  transparent?: boolean;
}

const ProceduralBuilding = React.memo(({ type, baseColor, x, y, era, variant, resourceUnderlay, opacity = 1, transparent = false }: BuildingMeshProps) => {
  const rotation = Math.floor(variant * 4) * (Math.PI / 2);
  
  // Era-specific styling
  let matParams: any = { color: baseColor, flatShading: true, opacity, transparent };
  
  if (era === Era.Primitive) {
    matParams.roughness = 0.9;
    matParams.color = new THREE.Color(baseColor).lerp(new THREE.Color("#78350f"), 0.4); 
  } else if (era === Era.Industrial) {
    matParams.roughness = 0.7;
    matParams.color = new THREE.Color(baseColor).lerp(new THREE.Color("#374151"), 0.2);
  } else if (era === Era.Modern) {
    matParams.roughness = 0.2;
    matParams.metalness = 0.1;
  } else if (era === Era.Future) {
    matParams.roughness = 0.0;
    matParams.metalness = 0.8;
    matParams.emissive = new THREE.Color(baseColor);
    matParams.emissiveIntensity = 0.4;
  }

  const mainMat = useMemo(() => new THREE.MeshStandardMaterial(matParams), [baseColor, era, opacity, transparent]);
  const commonProps = { castShadow: true, receiveShadow: true };
  const yOffset = -0.3;

  // Specialized Industrial Variants (Resource Extraction)
  if (type === BuildingType.Industrial && resourceUnderlay !== ResourceType.None && resourceUnderlay !== ResourceType.Water) {
      if (resourceUnderlay === ResourceType.Forest) {
          // Lumber Mill
          return (
              <group rotation={[0, rotation, 0]} position={[0, yOffset, 0]}>
                   <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#78350f'})} geometry={boxGeo} position={[0, 0.2, 0]} scale={[0.8, 0.4, 0.9]} />
                   <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#fcd34d'})} position={[0.2, 0.4, 0.2]} rotation={[0,0,0.5]} scale={[0.1, 0.6, 0.1]} geometry={cylinderGeo} />
                   <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#fcd34d'})} position={[-0.2, 0.4, -0.2]} rotation={[0,0,-0.5]} scale={[0.1, 0.6, 0.1]} geometry={cylinderGeo} />
              </group>
          )
      }
      if (resourceUnderlay === ResourceType.Stone) {
          // Mine
          return (
            <group rotation={[0, rotation, 0]} position={[0, yOffset, 0]}>
                <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#44403c'})} geometry={coneGeo} position={[0, 0.4, 0]} scale={[1, 0.8, 1]} />
                <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#1c1917'})} geometry={boxGeo} position={[0.3, 0.2, 0]} scale={[0.4, 0.4, 0.4]} />
            </group>
          )
      }
  }

  return (
    <group rotation={[0, rotation, 0]} position={[0, yOffset, 0]}>
      {(() => {
        // PRIMITIVE ERA
        if (era === Era.Primitive) {
             switch (type) {
                case BuildingType.Residential: // Huts
                    return <mesh {...commonProps} material={mainMat} geometry={coneGeo} position={[0, 0.4, 0]} scale={[0.8, 0.8, 0.8]} />;
                case BuildingType.Commercial: // Market Stalls
                    return (
                        <group>
                            <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.2, 0]} scale={[0.8, 0.4, 0.8]} />
                            <mesh material={new THREE.MeshStandardMaterial({color:'#fcd34d'})} geometry={boxGeo} position={[0, 0.5, 0]} scale={[0.9, 0.1, 0.9]} />
                        </group>
                    );
                case BuildingType.Industrial: // Blacksmith / Kiln
                    return <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.3, 0]} scale={[0.7, 0.6, 0.7]} />;
                case BuildingType.Farm:
                    return (
                        <group>
                             <mesh position={[-0.2, 0.05, -0.2]} scale={0.2} geometry={sphereGeo} material={new THREE.MeshStandardMaterial({color: '#fbbf24'})} />
                             <mesh position={[0.2, 0.05, 0.2]} scale={0.25} geometry={sphereGeo} material={new THREE.MeshStandardMaterial({color: '#f59e0b'})} />
                             <mesh position={[-0.2, 0.05, 0.2]} scale={0.2} geometry={sphereGeo} material={new THREE.MeshStandardMaterial({color: '#fbbf24'})} />
                             <mesh position={[0.2, 0.05, -0.2]} scale={0.22} geometry={sphereGeo} material={new THREE.MeshStandardMaterial({color: '#f59e0b'})} />
                        </group>
                    );
                case BuildingType.Defense: // Wooden Watchtower
                     return (
                         <group>
                             <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#78350f'})} geometry={cylinderGeo} position={[0, 0.4, 0]} scale={[0.1, 0.8, 0.1]} />
                             <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#78350f'})} geometry={boxGeo} position={[0, 0.9, 0]} scale={[0.4, 0.3, 0.4]} />
                         </group>
                     );
                default: return null;
             }
        }
        
        // INDUSTRIAL ERA
        if (era === Era.Industrial) {
             switch (type) {
                case BuildingType.Residential: // Row houses
                    return (
                        <group>
                            <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.5, 0]} scale={[0.9, 1, 0.5]} />
                            <mesh geometry={coneGeo} material={new THREE.MeshStandardMaterial({color: '#333'})} position={[0, 1.1, 0]} scale={[0.95, 0.4, 0.55]} rotation={[0,Math.PI/4,0]}/>
                        </group>
                    )
                case BuildingType.Commercial: // General Store
                    return <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.6, 0]} scale={[0.9, 1.2, 0.9]} />;
                case BuildingType.Industrial: // Factory
                     return (
                        <group>
                             <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.5, 0]} scale={[1, 1, 1]} />
                             <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#1f2937'})} geometry={cylinderGeo} position={[0.2, 1.2, 0.2]} scale={[0.2, 0.8, 0.2]} />
                        </group>
                     );
                case BuildingType.Farm: // Fenced livestock or basic crops
                     return (
                        <group>
                             <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#854d0e'})} geometry={boxGeo} position={[0, 0.1, 0]} scale={[0.9, 0.1, 0.9]} />
                             <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#b91c1c'})} geometry={boxGeo} position={[0, 0.4, -0.2]} scale={[0.4, 0.5, 0.4]} />
                        </group>
                     );
                case BuildingType.Defense: // Stone Guard Tower
                     return (
                         <group>
                              <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#57534e'})} geometry={cylinderGeo} position={[0, 0.6, 0]} scale={[0.4, 1.2, 0.4]} />
                              <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#292524'})} geometry={coneGeo} position={[0, 1.3, 0]} scale={[0.5, 0.4, 0.5]} />
                         </group>
                     );
                default: return null;
             }
        }

        // MODERN & FUTURE
        const isFuture = era === Era.Future;
        
        switch (type) {
          case BuildingType.Residential:
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.7 + variant*0.5, 0]} scale={[0.7, 1.4 + variant, 0.7]} />
                  {isFuture && <mesh geometry={sphereGeo} position={[0, 1.6+variant, 0]} scale={0.3}><meshStandardMaterial color="#a5f3fc" emissive="#a5f3fc" emissiveIntensity={1} /></mesh>}
                </>
              );
          case BuildingType.Commercial:
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.8 + variant, 0]} scale={[0.8, 1.6 + variant, 0.8]} />
                   {isFuture && (
                       [0.5, 1.0, 1.5].map(h => (
                           <mesh key={h} position={[0, h, 0]} geometry={boxGeo} scale={[0.85, 0.05, 0.85]} material={new THREE.MeshBasicMaterial({color: baseColor})} />
                       ))
                   )}
                </>
              );
          case BuildingType.Industrial:
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.5, 0]} scale={[1, 1, 0.8]} />
                  <mesh position={[0.2, 0.8, 0]} geometry={cylinderGeo} scale={[0.2, 1, 0.2]} material={new THREE.MeshStandardMaterial({color:'#4b5563'})} />
                </>
              );
           case BuildingType.Park:
             return (
                <group position={[0, -yOffset - 0.29, 0]}>
                    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                        <planeGeometry args={[0.9, 0.9]} />
                        <meshStandardMaterial color={isFuture ? "#059669" : "#86efac"} />
                    </mesh>
                    <mesh position={[0, 0.3, 0]} scale={isFuture ? 0.4 : 0.5} geometry={isFuture ? sphereGeo : coneGeo} material={new THREE.MeshStandardMaterial({color: isFuture ? "#34d399" : "#15803d", emissive: isFuture ? "#064e3b": "#000", emissiveIntensity: isFuture ? 0.5: 0})} />
                </group>
             );
           case BuildingType.Farm: // Greenhouse / Vertical Farm
             return (
                 <group>
                      <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color: isFuture ? '#0ea5e9' : '#ecfccb', transparent: true, opacity: 0.6})} geometry={boxGeo} position={[0, 0.4, 0]} scale={[0.8, 0.8, 0.8]} />
                      {isFuture ? (
                          <mesh position={[0,0.4,0]} scale={[0.6,0.7,0.6]} geometry={cylinderGeo} material={new THREE.MeshStandardMaterial({color: '#10b981', wireframe:true})} />
                      ) : (
                          <mesh position={[0, 0.4, 0]} scale={[0.6, 0.6, 0.6]} geometry={boxGeo} material={new THREE.MeshStandardMaterial({color: '#65a30d'})} />
                      )}
                 </group>
             );
           case BuildingType.Defense: // Turret / Laser Tower
             return (
                 <group>
                      <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color: '#475569'})} geometry={cylinderGeo} position={[0, 0.5, 0]} scale={[0.6, 1, 0.6]} />
                      <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color: '#dc2626', emissive: isFuture?'#f00':'#000', emissiveIntensity: isFuture?0.8:0})} geometry={sphereGeo} position={[0, 1.1, 0]} scale={[0.4, 0.4, 0.4]} />
                 </group>
             );
          default: return null;
        }
      })()}
    </group>
  );
});

// --- 3. Map Component ---

const RoadMarkings = React.memo(({ x, y, grid, yOffset, era }: { x: number; y: number; grid: Grid; yOffset: number, era: Era }) => {
  const roadColor = useMemo(() => {
     if (era === Era.Primitive) return '#78350f';
     if (era === Era.Industrial) return '#57534e';
     if (era === Era.Modern) return '#fbbf24';
     return '#06b6d4'; // Neon Cyan
  }, [era]);

  const isFuture = era === Era.Future;
  const isPrimitive = era === Era.Primitive;

  const lineMaterial = useMemo(() => 
    isFuture 
    ? new THREE.MeshBasicMaterial({ color: roadColor }) 
    : new THREE.MeshStandardMaterial({ color: roadColor, roughness: 1 }), 
  [roadColor, isFuture]);

  const lineGeo = useMemo(() => new THREE.PlaneGeometry(isPrimitive ? 0.3 : 0.1, 0.5), [isPrimitive]);

  const hasUp = y > 0 && grid[y - 1][x].buildingType === BuildingType.Road;
  const hasDown = y < GRID_SIZE - 1 && grid[y + 1][x].buildingType === BuildingType.Road;
  const hasLeft = x > 0 && grid[y][x - 1].buildingType === BuildingType.Road;
  const hasRight = x < GRID_SIZE - 1 && grid[y][x + 1].buildingType === BuildingType.Road;

  const connections = [hasUp, hasDown, hasLeft, hasRight].filter(Boolean).length;
  
  if (connections === 0) return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, yOffset, 0]} geometry={lineGeo} material={lineMaterial} />;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, yOffset, 0]}>
      {(hasUp || hasDown) && (hasLeft || hasRight) && (
        <mesh position={[0, 0, 0.005]} material={lineMaterial}><planeGeometry args={[isPrimitive ? 0.35 : 0.12, isPrimitive ? 0.35 : 0.12]} /></mesh>
      )}
      {hasUp && <mesh position={[0, 0.25, 0]} geometry={lineGeo} material={lineMaterial} />}
      {hasDown && <mesh position={[0, -0.25, 0]} geometry={lineGeo} material={lineMaterial} />}
      {hasLeft && <mesh position={[-0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} geometry={lineGeo} material={lineMaterial} />}
      {hasRight && <mesh position={[0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} geometry={lineGeo} material={lineMaterial} />}
    </group>
  );
});

// Resource Display
const ResourceProp = ({ type }: { type: ResourceType }) => {
    if (type === ResourceType.None) return null;
    if (type === ResourceType.Water) return null; 

    if (type === ResourceType.Forest) {
        return (
            <group position={[0, 0, 0]}>
                {[0,1,2].map(i => (
                    <mesh key={i} position={[Math.random()*0.6-0.3, 0, Math.random()*0.6-0.3]} scale={0.3}>
                        <cylinderGeometry args={[0.2, 0.2, 0.6]} />
                        <meshStandardMaterial color="#166534" />
                    </mesh>
                ))}
            </group>
        )
    }
    if (type === ResourceType.Stone) {
        return (
             <group position={[0, -0.1, 0]}>
                <mesh position={[0.2, 0, -0.2]} scale={0.4}>
                    <dodecahedronGeometry radius={0.5} />
                    <meshStandardMaterial color="#57534e" />
                </mesh>
                <mesh position={[-0.2, 0, 0.1]} scale={0.3}>
                    <dodecahedronGeometry radius={0.5} />
                    <meshStandardMaterial color="#78716c" />
                </mesh>
            </group>
        )
    }
    return null;
}

interface GroundTileProps {
    type: BuildingType;
    resourceType: ResourceType;
    x: number;
    y: number;
    grid: Grid;
    era: Era;
    landValue: number;
    onHover: (x: number, y: number) => void;
    onLeave: () => void;
    onClick: (x: number, y: number) => void;
}

const GroundTile = React.memo(({ type, resourceType, x, y, grid, era, landValue, onHover, onLeave, onClick }: GroundTileProps) => {
  const [wx, _, wz] = gridToWorld(x, y);
  
  // Base Color logic
  let color = '#10b981'; 
  let topY = -0.3; 
  let roughness = 1;
  
  if (type === BuildingType.None || type === BuildingType.Farm) {
     if (resourceType === ResourceType.Water) {
         color = '#3b82f6';
         topY = -0.4; 
         roughness = 0.1;
     } else {
         if (type === BuildingType.Farm) {
             color = '#5c4033'; // Dirt for farm
         } else {
             if (era === Era.Primitive) color = '#4d7c0f'; 
             else if (era === Era.Industrial) color = '#57534e'; 
             else if (era === Era.Modern) color = '#10b981'; 
             else if (era === Era.Future) color = '#0f172a'; 
         }
     }
  } else if (type === BuildingType.Road) {
    if (era === Era.Primitive) color = '#a8a29e'; 
    else if (era === Era.Future) color = '#1e293b'; 
    else color = '#374151';
    topY = -0.29;
  } else {
    color = '#d1d5db';
    topY = -0.28;
  }

  // Land Value Visualization
  if (type === BuildingType.None && resourceType !== ResourceType.Water) {
      const val = Math.min(landValue, 1.5); 
      if (val > 1.1) {
          const c = new THREE.Color(color);
          c.lerp(new THREE.Color('#fcd34d'), (val - 1.0) * 0.5);
          color = c.getStyle();
      }
  }

  return (
    <group position={[wx, topY - 0.25, wz]}>
        <mesh 
            receiveShadow 
            onPointerEnter={(e) => { e.stopPropagation(); onHover(x, y); }}
            onPointerOut={(e) => { e.stopPropagation(); onLeave(); }}
            onPointerDown={(e) => { e.stopPropagation(); if (e.button === 0) onClick(x, y); }}
        >
            <boxGeometry args={[1, 0.5, 1]} />
            <meshStandardMaterial color={color} flatShading roughness={roughness} />
            {type === BuildingType.Road && <RoadMarkings x={x} y={y} grid={grid} yOffset={0.251} era={era} />}
        </mesh>
        {type === BuildingType.None && <ResourceProp type={resourceType} />}
    </group>
  );
});

const Cursor = ({ x, y, color }: { x: number, y: number, color: string }) => {
  const [wx, _, wz] = gridToWorld(x, y);
  return (
    <mesh position={[wx, -0.25, wz]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} depthTest={false} />
      <Outlines thickness={0.05} color="white" />
    </mesh>
  );
};


interface IsoMapProps {
  grid: Grid;
  onTileClick: (x: number, y: number) => void;
  hoveredTool: BuildingType;
  stats: { population: number, era: Era, weather: Weather };
  hoveredLandValue: number | null;
  setHoveredLandValue: (val: number | null) => void;
  enemies: Enemy[];
  onEnemyClick: (id: string) => void;
}

const IsoMap: React.FC<IsoMapProps> = ({ grid, onTileClick, hoveredTool, stats, setHoveredLandValue, enemies, onEnemyClick }) => {
  const [hoveredTile, setHoveredTile] = useState<{x: number, y: number} | null>(null);

  const handleHover = useCallback((x: number, y: number) => {
    setHoveredTile({ x, y });
    setHoveredLandValue(grid[y][x].landValue);
  }, [grid, setHoveredLandValue]);

  const handleLeave = useCallback(() => {
    setHoveredTile(null);
    setHoveredLandValue(null);
  }, [setHoveredLandValue]);

  const showPreview = hoveredTile && grid[hoveredTile.y][hoveredTile.x].buildingType === BuildingType.None && hoveredTool !== BuildingType.None;
  const previewColor = showPreview ? BUILDINGS[hoveredTool].color : 'white';
  const isBulldoze = hoveredTool === BuildingType.None;
  const previewPos = hoveredTile ? gridToWorld(hoveredTile.x, hoveredTile.y) : [0,0,0];

  const ambientInt = stats.weather === Weather.Rain ? 0.2 : (stats.era === Era.Future ? 0.1 : 0.5);
  const dirInt = stats.weather === Weather.Rain ? 0.5 : 2;
  const bgColors = {
      [Weather.Sunny]: '#0c4a6e',
      [Weather.Rain]: '#1e293b',
      [Weather.Snow]: '#e2e8f0'
  }

  return (
    <div className="absolute inset-0 bg-sky-900 touch-none" style={{ backgroundColor: bgColors[stats.weather] }}>
      <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true }}>
        <OrthographicCamera makeDefault zoom={45} position={[20, 20, 20]} near={-100} far={200} />
        <MapControls enableRotate={true} enableZoom={true} minZoom={20} maxZoom={120} maxPolarAngle={Math.PI / 2.2} minPolarAngle={0.1} target={[0,-0.5,0]} />

        <ambientLight intensity={ambientInt} color={stats.era === Era.Future ? "#22d3ee" : "#cceeff"} />
        <directionalLight
          castShadow
          position={[15, 20, 10]}
          intensity={dirInt}
          color={stats.weather === Weather.Sunny ? "#fffbeb" : "#94a3b8"}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-15} shadow-camera-right={15}
          shadow-camera-top={15} shadow-camera-bottom={-15}
        />
        {stats.weather === Weather.Sunny && <Environment preset="city" />}
        
        <WeatherEffects weather={stats.weather} />

        <group>
          {grid.map((row, y) =>
            row.map((tile, x) => {
              const [wx, _, wz] = gridToWorld(x, y);
              return (
              <React.Fragment key={`${x}-${y}`}>
                <GroundTile 
                    type={tile.buildingType} 
                    resourceType={tile.resourceType}
                    x={x} y={y} 
                    grid={grid}
                    era={stats.era}
                    landValue={tile.landValue}
                    onHover={handleHover}
                    onLeave={handleLeave}
                    onClick={onTileClick}
                />
                
                <group position={[wx, 0, wz]} raycast={() => null}>
                    {tile.buildingType !== BuildingType.None && tile.buildingType !== BuildingType.Road && (
                      <ProceduralBuilding 
                        type={tile.buildingType} 
                        baseColor={BUILDINGS[tile.buildingType].color} 
                        x={x} y={y} 
                        era={stats.era}
                        variant={tile.variant || 0}
                        resourceUnderlay={tile.resourceType}
                      />
                    )}
                </group>
              </React.Fragment>
            )})
          )}

          {/* Enemies */}
          {enemies.map(enemy => (
              <EnemyMesh key={enemy.id} enemy={enemy} onClick={onEnemyClick} />
          ))}

          {/* Visual Elements */}
          <group raycast={() => null}>
            {showPreview && hoveredTile && (
              <group position={[previewPos[0], 0, previewPos[2]]}>
                <Float speed={3} rotationIntensity={0} floatIntensity={0.1} floatingRange={[0, 0.1]}>
                  <ProceduralBuilding 
                    type={hoveredTool} 
                    baseColor={previewColor} 
                    x={hoveredTile.x} 
                    y={hoveredTile.y} 
                    transparent 
                    opacity={0.7} 
                    era={stats.era}
                    variant={0}
                    resourceUnderlay={ResourceType.None}
                  />
                </Float>
              </group>
            )}

            {hoveredTile && (
              <Cursor 
                x={hoveredTile.x} 
                y={hoveredTile.y} 
                color={isBulldoze ? '#ef4444' : (showPreview ? '#ffffff' : '#000000')} 
              />
            )}
          </group>
        </group>
        
        <SoftShadows size={10} samples={8} />
      </Canvas>
    </div>
  );
};

export default IsoMap;

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MapControls, Environment, SoftShadows, Float, Outlines, OrthographicCamera, Stars, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { Grid, BuildingType, Era, Weather, ResourceType, Enemy, Boat, DisasterType, ActiveDisaster } from '../types';
import { GRID_SIZE, BUILDINGS } from '../constants';

// Fix for JSX Intrinsic Elements
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      pointLight: any;
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
      icosahedronGeometry: any;
    }
  }
}

// --- Constants & Helpers ---
const WORLD_OFFSET = GRID_SIZE / 2 - 0.5;
const gridToWorld = (x: number, y: number) => [x - WORLD_OFFSET, 0, y - WORLD_OFFSET] as [number, number, number];

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
const coneGeo = new THREE.ConeGeometry(1, 1, 4);
const sphereGeo = new THREE.SphereGeometry(1, 8, 8);
const rubbleGeo = new THREE.DodecahedronGeometry(0.4);

// --- Render Components ---

const DisasterEffect = ({ disaster }: { disaster: ActiveDisaster }) => {
    const [wx, _, wz] = gridToWorld(disaster.targetX, disaster.targetY);
    
    if (disaster.type === DisasterType.Meteor) {
        return (
            <group position={[wx, 1, wz]}>
                 <Sparkles count={50} scale={3} size={4} speed={2} opacity={1} color="#ef4444" />
                 <mesh position={[0, 1 + Math.sin(Date.now() * 0.01)*0.5, 0]} scale={0.5}>
                     <sphereGeometry />
                     <meshBasicMaterial color="orange" />
                 </mesh>
            </group>
        );
    }
    if (disaster.type === DisasterType.Earthquake) {
        return null; // Camera shake handled in parent or just simple visual
    }
    return null;
};

const EnemyMesh = ({ enemy, onClick }: { enemy: Enemy; onClick: (id: string) => void }) => {
    const [wx, _, wz] = gridToWorld(enemy.x, enemy.y);
    const meshRef = useRef<THREE.Group>(null);
    useFrame((state) => {
        if(meshRef.current) {
            meshRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 5) * 0.2;
            meshRef.current.rotation.y += 0.05;
        }
    });
    return (
        <group position={[wx, 0.5, wz]} ref={meshRef} onClick={(e) => { e.stopPropagation(); onClick(enemy.id); }}>
            <mesh castShadow receiveShadow>
                <dodecahedronGeometry args={[0.3, 0]} />
                <meshStandardMaterial color="#ef4444" emissive="#b91c1c" emissiveIntensity={0.5} roughness={0.2} />
            </mesh>
            <mesh position={[0.15, 0.1, 0.15]}><boxGeometry args={[0.1, 0.1, 0.1]} /><meshBasicMaterial color="yellow" /></mesh>
            <mesh position={[-0.15, 0.1, 0.15]}><boxGeometry args={[0.1, 0.1, 0.1]} /><meshBasicMaterial color="yellow" /></mesh>
            <mesh position={[0, 0.5, 0]}><boxGeometry args={[0.6 * (enemy.hp / enemy.maxHp), 0.1, 0.05]} /><meshBasicMaterial color="lime" /></mesh>
        </group>
    );
};

const BoatMesh = ({ boat }: { boat: Boat }) => {
    const [wx, _, wz] = gridToWorld(boat.x, boat.y);
    const meshRef = useRef<THREE.Group>(null);
    useFrame((state) => {
        if(meshRef.current) {
            meshRef.current.position.y = -0.1 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
            meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.5) * 0.05;
        }
    });
    return (
        <group position={[wx, 0, wz]} ref={meshRef}>
            {/* Hull */}
            <mesh castShadow position={[0, 0.1, 0]} scale={[0.4, 0.2, 0.8]}>
                <boxGeometry />
                <meshStandardMaterial color="#7c2d12" />
            </mesh>
            {/* Sail */}
            <mesh position={[0, 0.5, 0]} scale={[0.05, 0.8, 0.05]}>
                <cylinderGeometry />
                <meshStandardMaterial color="#fef3c7" />
            </mesh>
            <mesh position={[0, 0.6, 0.1]} rotation={[0, 1.57, 0]} scale={[0.02, 0.5, 0.5]}>
                <planeGeometry />
                <meshStandardMaterial color="#fff" side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
};

const FogMesh = ({ x, y }: { x: number, y: number }) => {
    const [wx, _, wz] = gridToWorld(x, y);
    return (
        <mesh position={[wx, 0.5, wz]} scale={[1.05, 2, 1.05]}>
             <boxGeometry />
             <meshStandardMaterial color="#cbd5e1" transparent opacity={0.9} roughness={1} />
        </mesh>
    )
}

const WeatherEffects = ({ weather }: { weather: Weather }) => {
  const count = 500;
  const mesh = useRef<THREE.InstancedMesh>(null);
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
      if(position.y < -1) {
        position.y = 15;
        position.x = (Math.random() - 0.5) * GRID_SIZE * 2;
        position.z = (Math.random() - 0.5) * GRID_SIZE * 2;
      }
      dummy.position.copy(position);
      if(weather === Weather.Rain) { dummy.scale.set(0.05, 0.8, 0.05); } 
      else { dummy.scale.setScalar(0.1); dummy.rotation.x += delta; dummy.rotation.y += delta; }
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

// --- Detailed Building Logic ---

interface BuildingMeshProps {
  type: BuildingType;
  baseColor: string;
  x: number;
  y: number;
  era: Era;
  variant: number;
  level: number;
  resourceUnderlay: ResourceType;
  isNight: boolean;
  opacity?: number;
  transparent?: boolean;
}

const ProceduralBuilding = React.memo(({ type, baseColor, x, y, era, variant, level = 1, resourceUnderlay, isNight, opacity = 1, transparent = false }: BuildingMeshProps) => {
  const rotation = Math.floor(variant * 4) * (Math.PI / 2);
  
  let matParams: any = { color: baseColor, flatShading: true, opacity, transparent };
  
  // Era-based Material Adjustments
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
      matParams.emissiveIntensity = isNight ? 0.8 : 0.4; 
  }

  const mainMat = useMemo(() => new THREE.MeshStandardMaterial(matParams), [baseColor, era, opacity, transparent, isNight]);
  
  // Emissive Window Material for Night
  const windowMat = useMemo(() => {
      const c = new THREE.Color(era === Era.Future ? '#06b6d4' : '#fef3c7');
      return new THREE.MeshStandardMaterial({
          color: c,
          emissive: c,
          emissiveIntensity: isNight ? 2 : 0,
          roughness: 0.1
      });
  }, [isNight, era]);

  const commonProps = { castShadow: true, receiveShadow: true };
  const yOffset = -0.3;

  // RUBBLE
  if (type === BuildingType.Rubble) {
      return (
        <group position={[0, -0.3, 0]}>
             <mesh geometry={rubbleGeo} scale={0.6} position={[0.2, 0, 0.1]} material={new THREE.MeshStandardMaterial({color: '#444'})} />
             <mesh geometry={rubbleGeo} scale={0.4} position={[-0.2, 0, -0.2]} material={new THREE.MeshStandardMaterial({color: '#333'})} />
             <mesh geometry={rubbleGeo} scale={0.3} position={[0.1, 0.1, -0.1]} material={new THREE.MeshStandardMaterial({color: '#555'})} />
        </group>
      )
  }

  // Resource Extraction Visuals
  if (type === BuildingType.Industrial && resourceUnderlay !== ResourceType.None && resourceUnderlay !== ResourceType.Water) {
      return (
          <group rotation={[0, rotation, 0]} position={[0, yOffset, 0]}>
               <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#78350f'})} geometry={boxGeo} position={[0, 0.2 * level, 0]} scale={[0.8, 0.4 * level, 0.9]} />
               <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#fcd34d'})} position={[0.2, 0.4*level, 0.2]} rotation={[0,0,0.5]} scale={[0.1, 0.6, 0.1]} geometry={cylinderGeo} />
               {level > 1 && <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#fcd34d'})} position={[-0.2, 0.4*level, -0.2]} rotation={[0,0,-0.5]} scale={[0.1, 0.6, 0.1]} geometry={cylinderGeo} />}
          </group>
      )
  }
  
  // Port Visuals
  if (type === BuildingType.Port) {
      return (
          <group rotation={[0, rotation, 0]} position={[0, yOffset, 0]}>
              <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color: '#a8a29e'})} geometry={boxGeo} position={[0, 0.1, 0]} scale={[0.8, 0.2, 0.8]} />
              <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color: '#7c2d12'})} geometry={boxGeo} position={[0.2, 0.3, 0]} scale={[0.3, 0.4, 0.3]} />
              <mesh position={[0.2, 0.6, 0]} geometry={cylinderGeo} scale={[0.05, 0.6, 0.05]} material={new THREE.MeshStandardMaterial({color: '#fff', emissive: '#fff', emissiveIntensity: isNight ? 1 : 0})} />
              {level > 1 && <mesh position={[-0.2, 0.2, -0.2]} geometry={boxGeo} scale={[0.2, 0.2, 0.2]} material={new THREE.MeshStandardMaterial({color: '#b45309'})} />}
          </group>
      );
  }

  return (
    <group rotation={[0, rotation, 0]} position={[0, yOffset, 0]}>
      {(() => {
        if (era === Era.Primitive) {
             switch (type) {
                case BuildingType.Residential: // Huts -> Longhouse -> Village Hall
                    const scale = 0.6 + (level * 0.15);
                    return (
                        <group>
                            <mesh {...commonProps} material={mainMat} geometry={coneGeo} position={[0, 0.4*scale, 0]} scale={[scale, scale, scale]} />
                            {level > 1 && <mesh position={[0.3, 0.1, 0]} geometry={boxGeo} scale={[0.3,0.3,0.3]} material={new THREE.MeshStandardMaterial({color:'#57534e'})} />}
                            {/* Fire pit at night */}
                            {isNight && <pointLight position={[0, 0.2, 0.5]} distance={2} intensity={0.5} color="orange" />}
                        </group>
                    );
                case BuildingType.Commercial: 
                    return (
                        <group>
                            <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.2*level, 0]} scale={[0.8, 0.4*level, 0.8]} />
                            <mesh material={new THREE.MeshStandardMaterial({color:'#fcd34d'})} geometry={boxGeo} position={[0, 0.2*level + 0.25, 0]} scale={[0.9, 0.1, 0.9]} />
                        </group>
                    );
                case BuildingType.Industrial:
                    return <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.3, 0]} scale={[0.7, 0.6*level, 0.7]} />;
                default: return <mesh {...commonProps} material={mainMat} geometry={boxGeo} scale={0.5} />;
             }
        }
        
        // GENERAL & MODERN STYLES
        const h = 0.5 * level + (era === Era.Future ? 0.5 : 0);
        
        switch (type) {
          case BuildingType.Residential:
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, h/2, 0]} scale={[0.7, h, 0.7]} />
                  {/* Windows */}
                  {level > 0 && <mesh position={[0.2, h/2, 0.36]} geometry={boxGeo} scale={[0.1, 0.1, 0.05]} material={windowMat} />}
                  {level > 0 && <mesh position={[-0.2, h/2 + 0.2, 0.36]} geometry={boxGeo} scale={[0.1, 0.1, 0.05]} material={windowMat} />}
                  
                  {/* Roof Variation */}
                  {variant > 0.5 ? (
                      <mesh position={[0, h+0.2, 0]} geometry={coneGeo} scale={[0.75, 0.4, 0.75]} material={new THREE.MeshStandardMaterial({color: '#333'})} />
                  ) : (
                       <mesh position={[0, h+0.05, 0]} geometry={boxGeo} scale={[0.6, 0.1, 0.6]} material={new THREE.MeshStandardMaterial({color: '#333'})} />
                  )}
                </>
              );
          case BuildingType.Commercial:
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, h/2, 0]} scale={[0.8, h, 0.8]} />
                  {/* Glass Windows */}
                  <mesh position={[0, h/2, 0.41]} geometry={boxGeo} scale={[0.6, h-0.2, 0.05]} material={era === Era.Future ? windowMat : new THREE.MeshStandardMaterial({color: '#93c5fd', metalness: 0.8, roughness: 0.2, emissive: '#93c5fd', emissiveIntensity: isNight?0.5:0})} />
                  {level > 2 && <mesh position={[0, h+0.2, 0]} geometry={cylinderGeo} scale={[0.2, 0.4, 0.2]} material={mainMat} />}
                </>
              );
          case BuildingType.Industrial:
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, h/2, 0]} scale={[0.9, h, 0.9]} />
                  <mesh position={[0.3, h+0.2, 0.3]} geometry={cylinderGeo} scale={[0.15 * level, 1, 0.15*level]} material={new THREE.MeshStandardMaterial({color:'#4b5563', emissive:'#ef4444', emissiveIntensity: isNight?1:0})} />
                  {level > 1 && <mesh position={[-0.3, h, -0.3]} geometry={boxGeo} scale={[0.3, 0.5, 0.3]} material={new THREE.MeshStandardMaterial({color:'#374151'})} />}
                </>
              );
           case BuildingType.Park:
             return (
                <group position={[0, -yOffset - 0.29, 0]}>
                    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                        <planeGeometry args={[0.9, 0.9]} />
                        <meshStandardMaterial color="#15803d" />
                    </mesh>
                    <mesh position={[0, 0.3, 0]} scale={0.5} geometry={coneGeo} material={new THREE.MeshStandardMaterial({color: "#166534"})} />
                    {isNight && <pointLight position={[0, 0.2, 0]} intensity={0.3} distance={1} color="#fbbf24" />}
                </group>
             );
           case BuildingType.Defense:
             return (
                 <group>
                      <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color: '#475569'})} geometry={cylinderGeo} position={[0, h/2, 0]} scale={[0.5, h, 0.5]} />
                      <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color: '#dc2626', emissive:'red', emissiveIntensity: isNight ? 1: 0})} geometry={sphereGeo} position={[0, h+0.1, 0]} scale={[0.3 + (level*0.1), 0.3+(level*0.1), 0.3+(level*0.1)]} />
                 </group>
             );
           case BuildingType.Farm:
                return (
                    <group>
                         <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#854d0e'})} geometry={boxGeo} position={[0, 0.1, 0]} scale={[0.9, 0.1, 0.9]} />
                         {level === 1 && <mesh position={[0,0.3,0]} scale={0.3} geometry={sphereGeo} material={new THREE.MeshStandardMaterial({color:'#facc15'})} />}
                         {level > 1 && <mesh position={[0.2,0.3,0.2]} scale={0.3} geometry={boxGeo} material={new THREE.MeshStandardMaterial({color:'#a16207'})} />}
                    </group>
                )
          default: return null;
        }
      })()}
    </group>
  );
});

// --- 3. Map Component ---

const RoadMarkings = React.memo(({ x, y, grid, yOffset, era, isNight }: { x: number; y: number; grid: Grid; yOffset: number, era: Era, isNight: boolean }) => {
  const roadColor = era === Era.Future ? '#06b6d4' : (era === Era.Primitive ? '#78350f' : '#374151');
  const lineMaterial = new THREE.MeshStandardMaterial({ 
      color: roadColor, 
      roughness: 1,
      emissive: era === Era.Future ? '#06b6d4' : 'black',
      emissiveIntensity: (era === Era.Future && isNight) ? 1 : 0
  });
  const lineGeo = new THREE.PlaneGeometry(0.15, 0.5);

  const hasUp = y > 0 && grid[y - 1][x].buildingType === BuildingType.Road;
  const hasDown = y < GRID_SIZE - 1 && grid[y + 1][x].buildingType === BuildingType.Road;
  const hasLeft = x > 0 && grid[y][x - 1].buildingType === BuildingType.Road;
  const hasRight = x < GRID_SIZE - 1 && grid[y][x + 1].buildingType === BuildingType.Road;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, yOffset, 0]}>
      {(hasUp || hasDown) && (hasLeft || hasRight) && <mesh position={[0, 0, 0.005]} material={lineMaterial}><planeGeometry args={[0.17, 0.17]} /></mesh>}
      {hasUp && <mesh position={[0, 0.25, 0]} geometry={lineGeo} material={lineMaterial} />}
      {hasDown && <mesh position={[0, -0.25, 0]} geometry={lineGeo} material={lineMaterial} />}
      {hasLeft && <mesh position={[-0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} geometry={lineGeo} material={lineMaterial} />}
      {hasRight && <mesh position={[0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} geometry={lineGeo} material={lineMaterial} />}
      {isNight && era !== Era.Primitive && (
          <pointLight position={[0, 0, 0.2]} intensity={0.5} distance={0.8} color="yellow" />
      )}
    </group>
  );
});

const ResourceProp = ({ type }: { type: ResourceType }) => {
    if (type === ResourceType.Forest) {
        return (
            <group>
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
                <mesh position={[0.2, 0, -0.2]} scale={0.4}><dodecahedronGeometry radius={0.5} /><meshStandardMaterial color="#57534e" /></mesh>
                <mesh position={[-0.2, 0, 0.1]} scale={0.3}><dodecahedronGeometry radius={0.5} /><meshStandardMaterial color="#78716c" /></mesh>
            </group>
        )
    }
    return null;
}

interface GroundTileProps {
    tile: any;
    x: number;
    y: number;
    grid: Grid;
    era: Era;
    onHover: (x: number, y: number) => void;
    onLeave: () => void;
    onClick: (x: number, y: number) => void;
    isNight: boolean;
}

const GroundTile = React.memo(({ tile, x, y, grid, era, onHover, onLeave, onClick, isNight }: GroundTileProps) => {
  const [wx, _, wz] = gridToWorld(x, y);
  const type = tile.buildingType;
  const resourceType = tile.resourceType;
  const isRubble = type === BuildingType.Rubble;

  // Base Color logic
  let color = '#10b981'; 
  let topY = -0.3; 
  let water = false;
  
  if (resourceType === ResourceType.Water) {
     color = '#3b82f6'; topY = -0.4; water = true;
  } else if (isRubble) {
     color = '#44403c'; topY = -0.29;
  } else if (type === BuildingType.None || type === BuildingType.Farm) {
     if (type === BuildingType.Farm) color = '#5c4033';
     else if (era === Era.Primitive) color = '#4d7c0f'; 
     else color = '#10b981';
  } else if (type === BuildingType.Road) {
    color = '#374151'; topY = -0.29;
  } else {
    color = '#d1d5db'; topY = -0.28;
  }
  
  // Land Value coloring
  if (type === BuildingType.None && resourceType !== ResourceType.Water) {
      const val = Math.min(tile.landValue, 1.5); 
      if (val > 1.1) {
          const c = new THREE.Color(color);
          c.lerp(new THREE.Color('#fcd34d'), (val - 1.0) * 0.5);
          color = c.getStyle();
      }
  }

  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
      if(water && meshRef.current) {
          meshRef.current.position.y = topY - 0.25 + Math.sin(state.clock.elapsedTime + x) * 0.02;
          // Simple tint shift for water at night
          if (isNight) (meshRef.current.material as THREE.MeshStandardMaterial).color.set('#1e3a8a');
          else (meshRef.current.material as THREE.MeshStandardMaterial).color.set('#3b82f6');
      }
  });

  return (
    <group position={[wx, topY - 0.25, wz]}>
        <mesh 
            ref={meshRef}
            receiveShadow 
            onPointerEnter={(e) => { e.stopPropagation(); onHover(x, y); }}
            onPointerOut={(e) => { e.stopPropagation(); onLeave(); }}
            onPointerDown={(e) => { e.stopPropagation(); if (e.button === 0) onClick(x, y); }}
        >
            <boxGeometry args={[1, 0.5, 1]} />
            <meshStandardMaterial color={color} flatShading roughness={water ? 0.1 : 1} metalness={water ? 0.5 : 0} />
            {type === BuildingType.Road && <RoadMarkings x={x} y={y} grid={grid} yOffset={0.251} era={era} isNight={isNight} />}
        </mesh>
        {(type === BuildingType.None || isRubble) && <ResourceProp type={resourceType} />}
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
  stats: { population: number, era: Era, weather: Weather, timeOfDay: number };
  hoveredLandValue: number | null;
  setHoveredLandValue: (val: number | null) => void;
  enemies: Enemy[];
  boats: Boat[];
  onEnemyClick: (id: string) => void;
  activeDisaster: ActiveDisaster | null;
}

const IsoMap: React.FC<IsoMapProps> = ({ grid, onTileClick, hoveredTool, stats, setHoveredLandValue, enemies, boats, onEnemyClick, activeDisaster }) => {
  const [hoveredTile, setHoveredTile] = useState<{x: number, y: number} | null>(null);

  const handleHover = useCallback((x: number, y: number) => {
    setHoveredTile({ x, y });
    setHoveredLandValue(grid[y][x].landValue);
  }, [grid, setHoveredLandValue]);

  const handleLeave = useCallback(() => {
    setHoveredTile(null);
    setHoveredLandValue(null);
  }, [setHoveredLandValue]);

  const showPreview = hoveredTile && grid[hoveredTile.y][hoveredTile.x].explored && grid[hoveredTile.y][hoveredTile.x].buildingType === BuildingType.None && hoveredTool !== BuildingType.None;
  const previewColor = showPreview ? BUILDINGS[hoveredTool].color : 'white';
  const previewPos = hoveredTile ? gridToWorld(hoveredTile.x, hoveredTile.y) : [0,0,0];
  
  // Sun position calc
  const time = stats.timeOfDay; // 0-24
  const angle = ((time - 6) / 24) * Math.PI * 2; // 6am = 0 rad
  const sunX = Math.cos(angle) * 50;
  const sunY = Math.sin(angle) * 50;
  const isNight = time < 6 || time > 18;

  return (
    <div className="absolute inset-0 bg-sky-900 touch-none">
      <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true }}>
        <OrthographicCamera makeDefault zoom={35} position={[20, 20, 20]} near={-100} far={200} />
        <MapControls enableRotate={true} enableZoom={true} minZoom={15} maxZoom={100} maxPolarAngle={Math.PI / 2.2} target={[0,-0.5,0]} />

        <ambientLight intensity={isNight ? 0.1 : (stats.weather === Weather.Rain ? 0.3 : 0.6)} />
        
        {/* Sun / Moon */}
        <directionalLight
          castShadow
          position={[10, sunY, sunX]}
          intensity={isNight ? 0 : (stats.weather === Weather.Rain ? 0.5 : 1.5)}
          shadow-mapSize={[2048, 2048]}
          color={time < 7 || time > 17 ? "#fdb813" : "#fff"}
        />
        {isNight && <directionalLight position={[-10, 20, -10]} intensity={0.3} color="#a5f3fc" />} 

        {stats.weather === Weather.Sunny && !isNight && <Environment preset="city" />}
        {isNight && <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />}

        <WeatherEffects weather={stats.weather} />

        <group>
          {grid.map((row, y) =>
            row.map((tile, x) => {
              if (!tile.explored) {
                  return <FogMesh key={`${x}-${y}`} x={x} y={y} />
              }
              const [wx, _, wz] = gridToWorld(x, y);
              return (
              <React.Fragment key={`${x}-${y}`}>
                <GroundTile 
                    tile={tile}
                    x={x} y={y} 
                    grid={grid}
                    era={stats.era}
                    onHover={handleHover}
                    onLeave={handleLeave}
                    onClick={onTileClick}
                    isNight={isNight}
                />
                {tile.buildingType !== BuildingType.None && tile.buildingType !== BuildingType.Road && (
                   <group position={[wx, 0, wz]} raycast={() => null}>
                      <ProceduralBuilding 
                        type={tile.buildingType} 
                        baseColor={BUILDINGS[tile.buildingType].color} 
                        x={x} y={y} 
                        era={stats.era}
                        variant={tile.variant}
                        level={tile.level}
                        resourceUnderlay={tile.resourceType}
                        isNight={isNight}
                      />
                    </group>
                )}
              </React.Fragment>
            )})
          )}

          {enemies.map(enemy => <EnemyMesh key={enemy.id} enemy={enemy} onClick={onEnemyClick} />)}
          {boats.map(boat => <BoatMesh key={boat.id} boat={boat} />)}
          {activeDisaster && <DisasterEffect disaster={activeDisaster} />}

          <group raycast={() => null}>
            {showPreview && hoveredTile && (
              <group position={[previewPos[0], 0, previewPos[2]]}>
                <Float speed={3} rotationIntensity={0} floatIntensity={0.1} floatingRange={[0, 0.1]}>
                  <ProceduralBuilding 
                    type={hoveredTool} 
                    baseColor={previewColor} 
                    x={hoveredTile.x} y={hoveredTile.y} 
                    transparent opacity={0.7} 
                    era={stats.era} variant={0} level={1}
                    resourceUnderlay={ResourceType.None}
                    isNight={isNight}
                  />
                </Float>
              </group>
            )}
            {hoveredTile && grid[hoveredTile.y][hoveredTile.x].explored && (
              <Cursor x={hoveredTile.x} y={hoveredTile.y} color={hoveredTool === BuildingType.None ? '#ef4444' : '#ffffff'} />
            )}
          </group>
        </group>
        
        <SoftShadows size={15} samples={10} focus={0} />
      </Canvas>
    </div>
  );
};

export default IsoMap;

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Rule } from "../backend.d";
import { getCurrentUser } from "../utils/localAuth";
import {
  getActiveProfileId,
  getProfileGlobalMemories,
  getProfileRules,
  getProfileUserMemories,
} from "../utils/localDB";

interface NodeData {
  id: string;
  bigId: bigint;
  label: string;
  type: "knowledge" | "rule" | "history" | "personal";
  basePosition: THREE.Vector3;
}

const NODE_COLORS: Record<string, string> = {
  knowledge: "#c9a227",
  rule: "#e07b39",
  history: "#4a9eca",
  personal: "#4caf7d",
};

function fibonacciSphere(n: number, radius: number): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1 || 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    positions.push(
      new THREE.Vector3(
        r * Math.cos(theta) * radius,
        y * radius,
        r * Math.sin(theta) * radius,
      ),
    );
  }
  return positions;
}

function BrainNode({
  node,
  isActive,
  isHovered,
  onHover,
}: {
  node: NodeData;
  isActive: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = NODE_COLORS[node.type] || NODE_COLORS.knowledge;

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const idx = Number(node.bigId) % 100;
    meshRef.current.position.x =
      node.basePosition.x + Math.sin(t * 0.3 + idx) * 0.06;
    meshRef.current.position.y =
      node.basePosition.y + Math.cos(t * 0.25 + idx * 1.3) * 0.06;
    meshRef.current.position.z =
      node.basePosition.z + Math.sin(t * 0.2 + idx * 0.7) * 0.06;

    const targetScale = isActive ? 1.3 : isHovered ? 1.5 : 1.0;
    meshRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.1,
    );
  });

  return (
    <mesh
      ref={meshRef}
      position={node.basePosition}
      onPointerEnter={() => onHover(node.id)}
      onPointerLeave={() => onHover(null)}
    >
      <sphereGeometry args={[0.12, 12, 12]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={isActive ? 0.8 : isHovered ? 0.6 : 0.3}
        roughness={0.3}
        metalness={0.6}
      />
      {isHovered && (
        <Html distanceFactor={6} style={{ pointerEvents: "none" }}>
          <div
            style={{
              background: "oklch(0.08 0.004 85 / 0.92)",
              border: "1px solid oklch(0.72 0.14 85 / 0.6)",
              borderRadius: 4,
              padding: "3px 7px",
              fontSize: 10,
              fontFamily: "monospace",
              color: "oklch(0.82 0.16 85)",
              whiteSpace: "nowrap",
              maxWidth: 180,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {node.label.slice(0, 40)}
            {node.label.length > 40 ? "..." : ""}
          </div>
        </Html>
      )}
    </mesh>
  );
}

function EdgeLines({ nodes }: { nodes: NodeData[] }) {
  const edges = useMemo(() => {
    const result: Array<[NodeData, NodeData]> = [];
    for (let i = 0; i < nodes.length && result.length < 120; i++) {
      for (let j = i + 1; j < nodes.length && result.length < 120; j++) {
        const aWords = nodes[i].label
          .toLowerCase()
          .split(/\W+/)
          .filter((w) => w.length > 4);
        const bWords = new Set(
          nodes[j].label
            .toLowerCase()
            .split(/\W+/)
            .filter((w) => w.length > 4),
        );
        if (aWords.some((w) => bWords.has(w))) {
          result.push([nodes[i], nodes[j]]);
        }
      }
    }
    return result;
  }, [nodes]);

  return (
    <>
      {edges.map(([from, to]) => {
        const key = `${from.id}-${to.id}`;
        const points = [from.basePosition, to.basePosition];
        return (
          <line key={key}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[
                  new Float32Array(points.flatMap((p) => [p.x, p.y, p.z])),
                  3,
                ]}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#4a3a12" transparent opacity={0.4} />
          </line>
        );
      })}
    </>
  );
}

interface ProfileData {
  globalMemories: ReturnType<typeof getProfileGlobalMemories>;
  userMemories: ReturnType<typeof getProfileUserMemories>;
  rules: ReturnType<typeof getProfileRules>;
}

function BrainScene({
  activeNodeIds,
  profileData,
}: {
  activeNodeIds: bigint[];
  profileData: ProfileData;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { globalMemories, userMemories, rules } = profileData;

  const allItems = useMemo(
    () =>
      [
        ...globalMemories.slice(0, 60).map((m) => ({
          id: m.id,
          label: m.text,
          type: (m.memoryType || "knowledge") as
            | "knowledge"
            | "rule"
            | "history"
            | "personal",
        })),
        ...userMemories.slice(0, 20).map((m) => ({
          id: m.id,
          label: m.text,
          type: "personal" as const,
        })),
        ...rules.slice(0, 20).map((r: Rule) => ({
          id: r.id,
          label: `IF ${r.condition} THEN ${r.effect}`,
          type: "rule" as const,
        })),
      ].slice(0, 100),
    [globalMemories, userMemories, rules],
  );

  const nodes: NodeData[] = useMemo(() => {
    const positions = fibonacciSphere(Math.max(allItems.length, 1), 2.5);
    return allItems.map((item, i) => ({
      id: item.id.toString(),
      bigId: item.id,
      label: item.label,
      type: item.type,
      basePosition: positions[i].clone(),
    }));
  }, [allItems]);

  const activeSet = useMemo(
    () => new Set(activeNodeIds.map((id) => id.toString())),
    [activeNodeIds],
  );

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1.5} color="#c9a227" />
      <pointLight position={[-5, -5, -3]} intensity={0.5} color="#4a9eca" />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={8}
      />
      <EdgeLines nodes={nodes} />
      {nodes.map((node) => (
        <BrainNode
          key={node.id}
          node={node}
          isActive={activeSet.has(node.id)}
          isHovered={hoveredId === node.id}
          onHover={setHoveredId}
        />
      ))}
    </>
  );
}

interface BrainVisualizationProps {
  activeNodeIds?: bigint[];
}

export default function BrainVisualization({
  activeNodeIds = [],
}: BrainVisualizationProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("sentry_profile_changed", bump);
    window.addEventListener("sentry_memory_updated", bump);
    window.addEventListener("sentry_ai_taught", bump);
    const interval = setInterval(bump, 4000);
    return () => {
      window.removeEventListener("sentry_profile_changed", bump);
      window.removeEventListener("sentry_memory_updated", bump);
      window.removeEventListener("sentry_ai_taught", bump);
      clearInterval(interval);
    };
  }, []);

  const username = getCurrentUser() ?? "";

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick is an intentional refresh counter
  const profileData = useMemo(() => {
    const pid = getActiveProfileId();
    return {
      globalMemories: getProfileGlobalMemories(pid),
      userMemories: getProfileUserMemories(pid, username),
      rules: getProfileRules(pid),
    };
  }, [username, tick]);

  const pid = getActiveProfileId();
  const profileName = localStorage.getItem(`sentry_ai_name_${pid}`) || "SENTRY";

  const nodeCount =
    Math.min(profileData.globalMemories.length, 60) +
    Math.min(profileData.userMemories.length, 20) +
    Math.min(profileData.rules.length, 20);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <span className="text-xs font-mono text-gold tracking-widest">
          NEURAL MAP — {profileName.toUpperCase()}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          {nodeCount} NODES
        </span>
      </div>
      <div className="flex-1 relative" data-ocid="brain.canvas_target">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 60 }}
          style={{ background: "#050505" }}
          dpr={[1, 1.5]}
        >
          <BrainScene activeNodeIds={activeNodeIds} profileData={profileData} />
        </Canvas>
        {nodeCount === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-xs text-muted-foreground font-mono">
              NO NODES YET
            </p>
            <p className="text-[10px] text-muted-foreground/50 font-mono mt-1">
              TEACH {profileName.toUpperCase()} TO POPULATE
            </p>
          </div>
        )}
      </div>
      <div className="px-4 py-2 border-t border-border shrink-0">
        <div className="flex gap-3">
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: color }}
              />
              <span className="text-[9px] font-mono text-muted-foreground capitalize">
                {type}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

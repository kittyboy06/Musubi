import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';

export default function KnowledgeGraph3D({ nodes, edges, onSelectNode, selectedNode }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const reqIdRef = useRef(null);

  // 3D Orbit Camera angles & state
  const rotXRef = useRef(0.2);
  const rotYRef = useRef(0.5);
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // 3D Nodes calculation with 3D Fibonacci Sphere placement
  const nodes3D = useMemo(() => {
    if (!nodes || nodes.length === 0) return [];
    const total = nodes.length;
    const sphereRadius = 220;

    return nodes.map((node, idx) => {
      // 3D Fibonacci sphere algorithm
      const phi = Math.acos(1 - 2 * (idx + 0.5) / total);
      const theta = Math.PI * (1 + Math.sqrt(5)) * (idx + 0.5);

      const x = sphereRadius * Math.sin(phi) * Math.cos(theta);
      const y = sphereRadius * Math.sin(phi) * Math.sin(theta);
      const z = sphereRadius * Math.cos(phi);

      const isCore = node.title.toLowerCase().includes('afsal') || node.connections > 2;
      const baseRadius = isCore ? 14 : Math.max(9, 9 + (node.connections || 0) * 1.5);
      const color = isCore ? '#881337' : node.connections > 1 ? '#8b5cf6' : '#2563eb';

      return {
        ...node,
        x3D: x,
        y3D: y,
        z3D: z,
        baseRadius,
        color,
      };
    });
  }, [nodes]);

  // 3D Energy pulse particles along links
  const pulseParticlesRef = useRef([]);

  useEffect(() => {
    // Initialize energy pulses along 3D edges
    if (!edges || edges.length === 0) return;
    const particles = [];
    edges.forEach((edge, i) => {
      particles.push({
        edgeId: edge.id,
        from: edge.from,
        to: edge.to,
        progress: (i * 0.25) % 1,
        speed: 0.006 + Math.random() * 0.004,
      });
    });
    pulseParticlesRef.current = particles;
  }, [edges]);

  useEffect(() => {
    if (typeof window === 'undefined' || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = containerRef.current.clientWidth || 360;
    let height = containerRef.current.clientHeight || 450;
    canvas.width = width;
    canvas.height = height;

    const focalLength = 320;
    const centerX = width / 2;
    const centerY = height / 2;

    let projectedNodes = [];

    const render3DScene = () => {
      reqIdRef.current = requestAnimationFrame(render3DScene);

      // Gentle auto-rotation when user is idle
      if (!isDraggingRef.current) {
        rotYRef.current += 0.003;
      }

      ctx.clearRect(0, 0, width, height);

      // Draw subtle background grid ambient dots
      ctx.fillStyle = 'rgba(226, 232, 240, 0.4)';
      for (let gx = 20; gx < width; gx += 40) {
        for (let gy = 20; gy < height; gy += 40) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const cosX = Math.cos(rotXRef.current);
      const sinX = Math.sin(rotXRef.current);
      const cosY = Math.cos(rotYRef.current);
      const sinY = Math.sin(rotYRef.current);

      // 1. Transform 3D coordinates for all nodes
      const nodePosMap = new Map();
      projectedNodes = nodes3D.map((node) => {
        // Rotate around Y axis
        let x1 = node.x3D * cosY - node.z3D * sinY;
        let z1 = node.z3D * cosY + node.x3D * sinY;

        // Rotate around X axis
        let y2 = node.y3D * cosX - z1 * sinX;
        let z2 = z1 * cosX + node.y3D * sinX;

        // 3D Perspective Projection
        const scale = focalLength / (focalLength + z2 + 200);
        const projX = centerX + x1 * scale;
        const projY = centerY + y2 * scale;
        const projRadius = Math.max(3, node.baseRadius * scale);
        const alpha = Math.max(0.2, Math.min(1, (z2 + 200) / 400));

        const projected = {
          ...node,
          projX,
          projY,
          projRadius,
          zDepth: z2,
          scale,
          alpha,
        };

        nodePosMap.set(node.id, projected);
        return projected;
      });

      // Depth sort nodes so closer elements render over farther ones
      projectedNodes.sort((a, b) => a.zDepth - b.zDepth);

      // 2. Render 3D Connecting Link Lines
      edges.forEach((edge) => {
        const source = nodePosMap.get(edge.from);
        const target = nodePosMap.get(edge.to);

        if (source && target) {
          const isSelectedLink = selectedNode && (selectedNode.id === source.id || selectedNode.id === target.id);

          ctx.beginPath();
          ctx.moveTo(source.projX, source.projY);
          ctx.lineTo(target.projX, target.projY);

          if (isSelectedLink) {
            ctx.strokeStyle = '#881337';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#881337';
            ctx.shadowBlur = 8;
          } else {
            ctx.strokeStyle = `rgba(148, 163, 184, ${Math.min(source.alpha, target.alpha) * 0.5})`;
            ctx.lineWidth = 1.2;
            ctx.shadowBlur = 0;
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });

      // 3. Render 3D Energy Pulse Particles
      pulseParticlesRef.current.forEach((p) => {
        p.progress += p.speed;
        if (p.progress > 1) p.progress = 0;

        const source = nodePosMap.get(p.from);
        const target = nodePosMap.get(p.to);

        if (source && target) {
          const px = source.projX + (target.projX - source.projX) * p.progress;
          const py = source.projY + (target.projY - source.projY) * p.progress;
          const particleScale = source.scale * 0.8;

          ctx.beginPath();
          ctx.arc(px, py, 3 * particleScale, 0, Math.PI * 2);
          ctx.fillStyle = '#881337';
          ctx.fill();
        }
      });

      // 4. Render 3D Sphere Nodes with Dynamic Shading
      projectedNodes.forEach((node) => {
        const isSelected = selectedNode && selectedNode.id === node.id;

        // Draw Outer Glow / Halo for selected node
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.projX, node.projY, node.projRadius * 1.6, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(136, 19, 55, 0.25)';
          ctx.fill();
        }

        // Draw 3D Radial Gradient Sphere
        const grad = ctx.createRadialGradient(
          node.projX - node.projRadius * 0.3,
          node.projY - node.projRadius * 0.3,
          node.projRadius * 0.1,
          node.projX,
          node.projY,
          node.projRadius
        );

        if (isSelected) {
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.4, '#881337');
          grad.addColorStop(1, '#4c0519');
        } else {
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.4, node.color);
          grad.addColorStop(1, '#0f172a');
        }

        ctx.beginPath();
        ctx.arc(node.projX, node.projY, node.projRadius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.globalAlpha = node.alpha;
        ctx.fill();

        ctx.strokeStyle = isSelected ? '#881337' : '#ffffff';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Draw 3D Node Label
        ctx.font = `${isSelected ? 'bold ' : ''}11px "Bitcount Prop Single", cursive, sans-serif`;
        ctx.fillStyle = isSelected ? '#881337' : `rgba(15, 23, 42, ${Math.max(0.5, node.alpha)})`;
        ctx.textAlign = 'center';
        ctx.fillText(node.title.replace(/\.md$/, ''), node.projX, node.projY + node.projRadius + 14);
      });
    };

    render3DScene();

    // Mouse / Touch 3D Orbit Interaction Handlers
    const handleMouseDown = (e) => {
      isDraggingRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;

      rotYRef.current += dx * 0.008;
      rotXRef.current += dy * 0.008;

      // Clamp vertical rotation
      rotXRef.current = Math.max(-1.2, Math.min(1.2, rotXRef.current));
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Hit test 3D nodes (front to back)
      for (let i = projectedNodes.length - 1; i >= 0; i--) {
        const n = projectedNodes[i];
        const dist = Math.hypot(clickX - n.projX, clickY - n.projY);
        if (dist <= n.projRadius + 10) {
          onSelectNode(n);
          break;
        }
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('click', handleClick);

    const handleResize = () => {
      if (!containerRef.current) return;
      width = containerRef.current.clientWidth;
      height = containerRef.current.clientHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(reqIdRef.current);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
    };
  }, [nodes3D, edges, selectedNode]);

  return (
    <View style={styles.container}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />
      </div>

      <View style={styles.hintBadge}>
        <Ionicons name="cube-outline" size={14} color="#881337" style={{ marginRight: 4 }} />
        <Text style={styles.hintText}>3D Interactive • Drag to Rotate</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#ffffff',
  },
  hintBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 241, 242, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  hintText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#881337',
  },
});

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import { useAppTheme } from '../utils/ThemeContext';

export default function KnowledgeGraph3D({ nodes, edges, onSelectNode, selectedNode }) {
  const { activeTheme } = useAppTheme();
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
    const sphereRadius = 180;

    return nodes.map((node, idx) => {
      // 3D Fibonacci sphere algorithm
      const phi = Math.acos(1 - 2 * (idx + 0.5) / total);
      const theta = Math.PI * (1 + Math.sqrt(5)) * (idx + 0.5);

      const x = sphereRadius * Math.sin(phi) * Math.cos(theta);
      const y = sphereRadius * Math.sin(phi) * Math.sin(theta);
      const z = sphereRadius * Math.cos(phi);

      const isCore = (node.title || '').toLowerCase().includes('afsal') || (node.connections || 0) > 2;
      const baseRadius = isCore ? 14 : Math.max(9, 9 + (node.connections || 0) * 1.5);
      const color = isCore ? activeTheme.primary : node.connections > 1 ? activeTheme.primaryLight : '#3b82f6';

      return {
        ...node,
        x3D: x,
        y3D: y,
        z3D: z,
        baseRadius,
        color,
      };
    });
  }, [nodes, activeTheme]);

  // 3D Energy pulse particles along links
  const pulseParticlesRef = useRef([]);

  useEffect(() => {
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

    let width = containerRef.current.clientWidth || window.innerWidth || 360;
    let height = containerRef.current.clientHeight || 500;
    canvas.width = width;
    canvas.height = height;

    const focalLength = 320;
    const centerX = width / 2;
    const centerY = height / 2;

    let projectedNodes = [];

    const render3DScene = () => {
      reqIdRef.current = requestAnimationFrame(render3DScene);

      // Gentle auto-rotation when idle
      if (!isDraggingRef.current) {
        rotYRef.current += 0.003;
      }

      ctx.clearRect(0, 0, width, height);

      // Dark network background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle background grid ambient dots
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
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
        let x1 = node.x3D * cosY - node.z3D * sinY;
        let z1 = node.z3D * cosY + node.x3D * sinY;

        let y2 = node.y3D * cosX - z1 * sinX;
        let z2 = z1 * cosX + node.y3D * sinX;

        const scale = focalLength / (focalLength + z2 + 200);
        const projX = centerX + x1 * scale;
        const projY = centerY + y2 * scale;
        const projRadius = Math.max(4, node.baseRadius * scale);
        const alpha = Math.max(0.3, Math.min(1, (z2 + 250) / 450));

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
            ctx.strokeStyle = activeTheme.primaryLight;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = activeTheme.primaryLight;
            ctx.shadowBlur = 8;
          } else {
            ctx.strokeStyle = `rgba(148, 163, 184, ${Math.min(source.alpha, target.alpha) * 0.4})`;
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
          ctx.fillStyle = activeTheme.primaryLight;
          ctx.fill();
        }
      });

      // 4. Render 3D Sphere Nodes
      projectedNodes.forEach((node) => {
        const isSelected = selectedNode && selectedNode.id === node.id;

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.projX, node.projY, node.projRadius * 1.8, 0, Math.PI * 2);
          ctx.fillStyle = activeTheme.accentGlow || 'rgba(136, 19, 55, 0.35)';
          ctx.fill();
        }

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
          grad.addColorStop(0.4, activeTheme.primaryLight);
          grad.addColorStop(1, activeTheme.primary);
        } else {
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.4, node.color);
          grad.addColorStop(1, '#020617');
        }

        ctx.beginPath();
        ctx.arc(node.projX, node.projY, node.projRadius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.globalAlpha = node.alpha;
        ctx.fill();

        ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Node Label
        ctx.font = `${isSelected ? 'bold ' : ''}11px "Bitcount Prop Single", cursive, sans-serif`;
        ctx.fillStyle = isSelected ? '#ffffff' : `rgba(226, 232, 240, ${Math.max(0.6, node.alpha)})`;
        ctx.textAlign = 'center';
        ctx.fillText((node.title || '').replace(/\.md$/, ''), node.projX, node.projY + node.projRadius + 14);
      });
    };

    render3DScene();

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
      width = containerRef.current.clientWidth || window.innerWidth || 360;
      height = containerRef.current.clientHeight || 500;
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
  }, [nodes3D, edges, selectedNode, activeTheme]);

  return (
    <View style={styles.container}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 450, position: 'relative' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', minHeight: 450, cursor: 'grab', display: 'block' }} />
      </div>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: 450,
    position: 'relative',
    backgroundColor: '#0f172a',
  },
});

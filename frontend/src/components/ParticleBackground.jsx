import React, { useCallback, useMemo } from 'react';
import Particles, { ParticlesProvider } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';

export default function ParticleBackground({ variant = 'default' }) {
  const particlesInit = useCallback(async (engine) => {
    await loadSlim(engine);
  }, []);

  const particlesLoaded = useCallback(async (container) => {
    // container is ready — nothing needed here
  }, []);

  const configs = useMemo(() => ({
    default: {
      fullScreen: false,
      background: { color: { value: 'transparent' } },
      fpsLimit: 60,
      particles: {
        color: { value: ['#06b6d4', '#22d3ee', '#ef4444', '#7c3aed', '#3b82f6'] },
        links: {
          color: '#1e3a5f',
          distance: 150,
          enable: true,
          opacity: 0.25,
          width: 1,
        },
        move: {
          enable: true,
          speed: 0.8,
          direction: 'none',
          outModes: { default: 'bounce' },
          random: true,
          straight: false,
        },
        number: {
          density: { enable: true, area: 900 },
          value: 80,
        },
        opacity: {
          value: { min: 0.15, max: 0.6 },
          animation: { enable: true, speed: 0.8, minimumValue: 0.1 },
        },
        shape: { type: 'circle' },
        size: {
          value: { min: 1, max: 3 },
          animation: { enable: true, speed: 1.5, minimumValue: 0.5 },
        },
      },
      interactivity: {
        events: {
          onHover: { enable: true, mode: 'grab' },
          onClick: { enable: true, mode: 'push' },
        },
        modes: {
          grab: { distance: 180, links: { opacity: 0.45, color: '#06b6d4' } },
          push: { quantity: 3 },
        },
      },
      detectRetina: true,
    },
    dense: {
      fullScreen: false,
      background: { color: { value: 'transparent' } },
      fpsLimit: 60,
      particles: {
        color: { value: ['#06b6d4', '#ef4444'] },
        links: {
          color: '#1a2e4a',
          distance: 120,
          enable: true,
          opacity: 0.15,
          width: 0.5,
        },
        move: {
          enable: true,
          speed: 0.4,
          direction: 'none',
          outModes: { default: 'bounce' },
        },
        number: {
          density: { enable: true, area: 600 },
          value: 50,
        },
        opacity: { value: { min: 0.1, max: 0.35 } },
        shape: { type: 'circle' },
        size: { value: { min: 0.5, max: 2 } },
      },
      interactivity: {
        events: {
          onHover: { enable: true, mode: 'grab' },
        },
        modes: {
          grab: { distance: 140, links: { opacity: 0.3 } },
        },
      },
      detectRetina: true,
    },
  }), []);

  const activeConfig = configs[variant] || configs.default;

  return (
    <ParticlesProvider init={particlesInit}>
      <Particles
        id={`tsparticles-${variant}`}
        particlesLoaded={particlesLoaded}
        options={activeConfig}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'auto',
        }}
      />
    </ParticlesProvider>
  );
}

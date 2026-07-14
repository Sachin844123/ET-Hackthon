import React from 'react';

export default function AnimatedGradientBorder({
  children,
  className = '',
  borderWidth = 1,
  borderRadius = 8,
  colors = ['#06b6d4', '#ef4444', '#a855f7', '#f59e0b', '#06b6d4'],
  speed = 3,
  glowIntensity = 0.3,
}) {
  const gradientColors = colors.join(', ');
  
  return (
    <div
      className={`animated-gradient-border-wrapper ${className}`}
      style={{
        position: 'relative',
        borderRadius: `${borderRadius}px`,
        padding: `${borderWidth}px`,
        isolation: 'isolate',
      }}
    >
      {/* Animated gradient border */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: `${borderRadius}px`,
          background: `conic-gradient(from var(--gradient-angle, 0deg), ${gradientColors})`,
          animation: `gradient-rotate ${speed}s linear infinite`,
          opacity: 0.8,
          zIndex: -2,
        }}
      />
      {/* Glow effect */}
      <div
        style={{
          position: 'absolute',
          inset: `-${borderWidth * 4}px`,
          borderRadius: `${borderRadius + 4}px`,
          background: `conic-gradient(from var(--gradient-angle, 0deg), ${gradientColors})`,
          animation: `gradient-rotate ${speed}s linear infinite`,
          opacity: glowIntensity,
          filter: `blur(${borderWidth * 8}px)`,
          zIndex: -3,
        }}
      />
      {/* Inner content area */}
      <div
        style={{
          borderRadius: `${borderRadius - borderWidth}px`,
          position: 'relative',
          zIndex: 1,
          background: 'rgba(10, 14, 26, 0.95)',
          height: '100%',
        }}
      >
        {children}
      </div>
    </div>
  );
}

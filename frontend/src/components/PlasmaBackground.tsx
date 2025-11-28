import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

interface PlasmaBackgroundProps {
  className?: string;
}

export function PlasmaBackground({ className }: PlasmaBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check WebGL support
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      setHasWebGL(false);
      return;
    }

    // Simple plasma effect using 2D canvas for better compatibility
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setHasWebGL(false);
      return;
    }

    let time = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    const draw = () => {
      if (!ctx || !canvas) return;

      const width = canvas.width;
      const height = canvas.height;
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;

          // Plasma formula
          const value1 = Math.sin(x / 16 + time);
          const value2 = Math.sin(y / 8 + time);
          const value3 = Math.sin((x + y) / 16 + time);
          const value4 = Math.sin(Math.sqrt(x * x + y * y) / 8 + time);

          const value = (value1 + value2 + value3 + value4) / 4;

          // Map to colors (purple/blue theme)
          const r = Math.floor((Math.sin(value * Math.PI) * 0.5 + 0.5) * 100);
          const g = Math.floor((Math.sin(value * Math.PI + 2) * 0.5 + 0.5) * 50);
          const b = Math.floor((Math.sin(value * Math.PI + 4) * 0.5 + 0.5) * 200 + 55);

          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      time += 0.02;
      animationRef.current = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);

    // Start animation
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  if (!hasWebGL) {
    // Fallback gradient
    return (
      <div
        className={clsx(
          'bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900',
          className
        )}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={clsx('bg-black', className)}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

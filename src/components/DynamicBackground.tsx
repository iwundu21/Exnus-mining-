import React, { useEffect, useRef } from 'react';

const DynamicBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();

    // Digital particles (falling data)
    const particles: any[] = [];
    const particleCount = 100;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        length: Math.random() * 15 + 10,
        speed: Math.random() * 3 + 1.5,
        opacity: Math.random() * 0.5 + 0.2
      });
    }

    // Electric strikes
    let strikes: any[] = [];

    const createStrike = () => {
      const startX = Math.random() * canvas.width;
      const startY = Math.random() * canvas.height;
      const points = [{ x: startX, y: startY }];
      const segments = 12;
      
      let currentX = startX;
      let currentY = startY;

      for (let i = 0; i < segments; i++) {
        currentX += (Math.random() * 100 - 50);
        currentY += (Math.random() * 100 - 50);
        points.push({ x: currentX, y: currentY });
      }

      strikes.push({
        points,
        life: 1.0
      });
    };

    const draw = () => {
      // Subtle trail effect
      ctx.fillStyle = 'rgba(5, 5, 5, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw digital motion (vertical streams)
      ctx.lineWidth = 1.5;
      particles.forEach(p => {
        ctx.strokeStyle = `rgba(139, 31, 48, ${p.opacity * 0.8})`;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y + p.length);
        ctx.stroke();

        p.y += p.speed;
        if (p.y > canvas.height) {
          p.y = -p.length;
          p.x = Math.random() * canvas.width;
        }
      });

      // Draw electric strikes
      if (Math.random() < 0.02) createStrike();

      strikes = strikes.filter(s => s.life > 0);
      strikes.forEach(s => {
        ctx.strokeStyle = `rgba(255, 255, 255, ${s.life * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
        ctx.stroke();
        
        // Add a glow to the strike
        ctx.strokeStyle = `rgba(165, 42, 60, ${s.life * 0.3})`;
        ctx.lineWidth = 4;
        ctx.stroke();

        s.life -= 0.05;
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[-1] opacity-60"
      style={{ mixBlendMode: 'screen' }}
    />
  );
};

export default DynamicBackground;

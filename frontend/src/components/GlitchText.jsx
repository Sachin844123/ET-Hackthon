import React, { useState, useEffect, useRef } from 'react';

export default function GlitchText({
  text,
  className = '',
  glitchDuration = 1500,
  delay = 0,
  as: Tag = 'span',
  charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*<>[]{}|/\\',
}) {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      let iteration = 0;
      const maxIterations = text.length;
      const intervalTime = glitchDuration / (maxIterations * 3);

      intervalRef.current = setInterval(() => {
        setDisplayText(
          text
            .split('')
            .map((char, idx) => {
              if (char === ' ') return ' ';
              if (idx < iteration) return text[idx];
              return charSet[Math.floor(Math.random() * charSet.length)];
            })
            .join('')
        );

        if (iteration >= maxIterations) {
          clearInterval(intervalRef.current);
          setDisplayText(text);
          setIsComplete(true);
        }

        iteration += 1 / 3;
      }, intervalTime);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, glitchDuration, delay, charSet]);

  return (
    <Tag className={`${className} ${isComplete ? '' : 'glitch-active'}`}>
      {displayText || '\u00A0'.repeat(text.length)}
    </Tag>
  );
}

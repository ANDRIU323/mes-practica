import { useEffect, useState } from 'react';
import { Text, type TextProps } from '@mantine/core';

// 3725 -> "01:02:05"
function formatElapsed(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

interface ElapsedTimerProps extends TextProps {
  // ISO de WorkLog.startedAt
  since: string;
}

// El tiempo se calcula cada vez como "ahora - since": el intervalo solo fuerza a repintar.
// Así no se desvía aunque el navegador retrase los tics o se recargue la página.
export function ElapsedTimer({ since, ...textProps }: ElapsedTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Si el reloj del dispositivo va por detrás del servidor, mejor 0 que negativo
  const seconds = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));

  return (
    <Text ff="monospace" {...textProps}>
      {formatElapsed(seconds)}
    </Text>
  );
}

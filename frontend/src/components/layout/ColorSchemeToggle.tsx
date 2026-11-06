import { ActionIcon, type ActionIconProps } from '@mantine/core';

import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectColorScheme, toggleColorScheme } from '../../store/uiSlice';

export function ColorSchemeToggle({ size = 'lg' }: { size?: ActionIconProps['size'] }) {
  const dispatch = useAppDispatch();
  const dark = useAppSelector(selectColorScheme) === 'dark';
  const label = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

  return (
    <ActionIcon
      variant="default"
      size={size}
      onClick={() => dispatch(toggleColorScheme())}
      aria-label={label}
      title={label}
    >
      {dark ? '☀' : '☾'}
    </ActionIcon>
  );
}

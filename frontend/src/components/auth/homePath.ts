import type { Role } from '../../types/auth';

// Zona de cada rol: a dónde se le lleva al entrar o si abre una ruta que no es suya
export const HOME_PATH: Record<Role, string> = {
  ADMIN: '/',
  EMPLOYEE: '/planta',
};

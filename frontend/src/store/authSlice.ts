import { createListenerMiddleware, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { LoginResponse, User } from '../types/auth';

const STORAGE_KEY = 'mes-auth';

interface AuthState {
  token: string | null;
  user: User | null;
}

// Recupera la sesión guardada para no perderla al recargar la página
function loadSession(): AuthState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved?.token && saved?.user) return { token: saved.token, user: saved.user };
  } catch {
    // Dato corrupto o localStorage no disponible: se empieza sin sesión
  }
  return { token: null, user: null };
}

const authSlice = createSlice({
  name: 'auth',
  initialState: loadSession,
  reducers: {
    loggedIn(state, action: PayloadAction<LoginResponse>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
    },
    loggedOut(state) {
      state.token = null;
      state.user = null;
    },
  },
});

export const { loggedIn, loggedOut } = authSlice.actions;
export default authSlice.reducer;

export const selectToken = (state: { auth: AuthState }) => state.auth.token;
export const selectCurrentUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.token !== null;

// Los reducers deben ser puros, así que localStorage se actualiza aquí, como efecto de las acciones
export const authListener = createListenerMiddleware();

authListener.startListening({
  actionCreator: loggedIn,
  effect: (action) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(action.payload));
  },
});

authListener.startListening({
  actionCreator: loggedOut,
  effect: () => {
    localStorage.removeItem(STORAGE_KEY);
  },
});

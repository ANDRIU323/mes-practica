import { createListenerMiddleware, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import dayjs from 'dayjs';
import type { OrderStatus } from '../types/order';
import type { ShiftType } from '../types/shift';

const COLOR_SCHEME_KEY = 'mes-color-scheme';

export type ColorScheme = 'light' | 'dark';

// Días que abarca el Gantt de Planificación
export const PLANNING_SPANS = [1, 3, 7] as const;
export type PlanningSpan = (typeof PLANNING_SPANS)[number];

// Días "YYYY-MM-DD", ambos incluidos. Texto y no Date: Redux solo guarda valores serializables
export interface ReportRange {
  from: string;
  to: string;
}

interface UiState {
  // null = todas las órdenes
  orderStatusFilter: OrderStatus | null;
  // Empleado abierto en el Drawer de detalle; null = cerrado
  selectedEmployeeId: number | null;
  reportRange: ReportRange;
  // Turno elegido en Turnos. Día null = el del turno actual (lo decide el backend, en hora
  // de la planta); tipo null = el actual si es ese día, si no el de mañana
  shiftDay: string | null;
  shiftType: ShiftType | null;
  // Primer día del Gantt; null = hoy en hora de la planta
  planningDay: string | null;
  planningSpan: PlanningSpan;
  colorScheme: ColorScheme;
}

// El tema guardado; si no hay, el del sistema operativo
function loadColorScheme(): ColorScheme {
  try {
    const saved = localStorage.getItem(COLOR_SCHEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

// Por defecto, los últimos 7 días contando hoy
const initialState: UiState = {
  orderStatusFilter: null,
  selectedEmployeeId: null,
  reportRange: {
    from: dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
    to: dayjs().format('YYYY-MM-DD'),
  },
  shiftDay: null,
  shiftType: null,
  planningDay: null,
  planningSpan: 3,
  colorScheme: loadColorScheme(),
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setOrderStatusFilter(state, action: PayloadAction<OrderStatus | null>) {
      state.orderStatusFilter = action.payload;
    },
    setSelectedEmployeeId(state, action: PayloadAction<number | null>) {
      state.selectedEmployeeId = action.payload;
    },
    setReportRange(state, action: PayloadAction<ReportRange>) {
      state.reportRange = action.payload;
    },
    setShiftDay(state, action: PayloadAction<string | null>) {
      state.shiftDay = action.payload;
    },
    setShiftType(state, action: PayloadAction<ShiftType | null>) {
      state.shiftType = action.payload;
    },
    setPlanningDay(state, action: PayloadAction<string | null>) {
      state.planningDay = action.payload;
    },
    setPlanningSpan(state, action: PayloadAction<PlanningSpan>) {
      state.planningSpan = action.payload;
    },
    toggleColorScheme(state) {
      state.colorScheme = state.colorScheme === 'dark' ? 'light' : 'dark';
    },
  },
});

export const {
  setOrderStatusFilter,
  setSelectedEmployeeId,
  setReportRange,
  setShiftDay,
  setShiftType,
  setPlanningDay,
  setPlanningSpan,
  toggleColorScheme,
} = uiSlice.actions;
export default uiSlice.reducer;

export const selectColorScheme = (state: { ui: UiState }) => state.ui.colorScheme;

// Igual que la sesión: localStorage se escribe como efecto, fuera del reducer
export const uiListener = createListenerMiddleware();

uiListener.startListening({
  actionCreator: toggleColorScheme,
  effect: (_action, api) => {
    localStorage.setItem(COLOR_SCHEME_KEY, selectColorScheme(api.getState() as { ui: UiState }));
  },
});

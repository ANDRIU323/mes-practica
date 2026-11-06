import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './index';

// Versiones tipadas: el state y las acciones se conocen sin anotarlos en cada componente
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

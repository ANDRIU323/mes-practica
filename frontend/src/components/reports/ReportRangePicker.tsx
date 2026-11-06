import { useState } from 'react';
import { DatePickerInput, type DatesRangeValue } from '@mantine/dates';
import dayjs from 'dayjs';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setReportRange } from '../../store/uiSlice';

const DAY_FORMAT = 'YYYY-MM-DD';

// Rango de días de uiSlice.reportRange, compartido por Informes y el detalle de máquina
export function ReportRangePicker() {
  const range = useAppSelector((state) => state.ui.reportRange);
  const dispatch = useAppDispatch();

  // Mientras se elige el segundo día el rango está a medias ([día, null]): eso vive
  // solo aquí, y a Redux (y a la consulta) llega cuando están los dos días
  const [pickerValue, setPickerValue] = useState<DatesRangeValue>([
    dayjs(range.from).toDate(),
    dayjs(range.to).toDate(),
  ]);

  const handleRangeChange = (value: DatesRangeValue) => {
    setPickerValue(value);
    const [from, to] = value;
    if (from && to) {
      dispatch(
        setReportRange({ from: dayjs(from).format(DAY_FORMAT), to: dayjs(to).format(DAY_FORMAT) }),
      );
    }
  };

  return (
    <DatePickerInput
      type="range"
      label="Rango de fechas"
      value={pickerValue}
      onChange={handleRangeChange}
      maxDate={new Date()}
      valueFormat="DD/MM/YYYY"
      w={260}
    />
  );
}

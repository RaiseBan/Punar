import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateTask } from '../../../store/tasksSlice';
import { RootState } from '../../../store/store';
import { TaskDataRow } from '../types';

export function useTaskData(id: number, data: TaskDataRow[], columns: string[]) {
  const dispatch = useDispatch();
  const [tableCollapsed, setTableCollapsed] = useState(true);
  const [orderBy, setOrderBy] = useState<string>('');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  // Референсы для доступа к актуальным данным
  const dataRef = useRef(data);

  // Обновляем референс при изменении данных
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Получаем processedRows
  const processedRows = useSelector((state: RootState) =>
    state.tasks.tasks.find(t => t.id === id)?.processedTelegramRows || []
  );

  const processedRowsRef = useRef<string[]>([]);

  // Обновляем ref при изменении processedRows
  useEffect(() => {
    processedRowsRef.current = processedRows;
  }, [processedRows]);

  // Генерация уникальных ID для строк
  useEffect(() => {
    if (data && data.length > 0) {
      const dataWithIds = data.map((row, index) => {
        if (!row.rowId) {
          return {
            ...row,
            rowId: `row-${id}-${Date.now()}-${index}`
          };
        }
        return row;
      });

      const needsUpdate = dataWithIds.some((row, index) => !data[index].rowId);

      if (needsUpdate) {
        dispatch(updateTask({
          id: id,
          data: dataWithIds
        }));
      }
    }
  }, [data, id, dispatch]);

  // Функция для сортировки данных
  const sortData = (data: TaskDataRow[]) => {
    if (!orderBy) return data;

    return [...data].map((row, index) => ({
      ...row,
      originalIndex: index
    })).sort((a, b) => {
      const aValue = a.cells[columns.indexOf(orderBy)];
      const bValue = b.cells[columns.indexOf(orderBy)];

      // Если значения числовые
      if (!isNaN(Number(aValue)) && !isNaN(Number(bValue))) {
        return order === 'asc'
          ? Number(aValue) - Number(bValue)
          : Number(bValue) - Number(aValue);
      }

      // Если значения строковые
      return order === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });
  };

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const toggleTable = () => setTableCollapsed(!tableCollapsed);
  const displayedData = tableCollapsed ? data.slice(0, 2) : data;
  const sortedData = sortData(displayedData);

  return {
    dataRef,
    processedRows,
    processedRowsRef,
    tableCollapsed,
    toggleTable,
    displayedData,
    sortedData,
    orderBy,
    order,
    handleRequestSort
  };
}
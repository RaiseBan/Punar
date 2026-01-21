import { useState, useRef, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateTask } from '../../../store/tasksSlice';
import { RootState } from '../../../store/store';
import { TaskDataRow } from '../types';

export function useTaskData(id: number, data: TaskDataRow[], columns: string[]) {
  const dispatch = useDispatch();
  const [tableCollapsed, setTableCollapsed] = useState(true);
  const [orderBy, setOrderBy] = useState<string>('');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const processedRows = useSelector((state: RootState) =>
    state.tasks.tasks.find(t => t.id === id)?.processedTelegramRows || []
  );

  const processedRowsRef = useRef<string[]>([]);

  useEffect(() => {
    processedRowsRef.current = processedRows;
  }, [processedRows]);

  // Добавление rowId к строкам, если их нет
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

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const toggleTable = () => setTableCollapsed(!tableCollapsed);

  // Отображаемые данные (свернуто/развернуто)
  const displayedData = useMemo(() => {
    return tableCollapsed ? data.slice(0, 2) : data;
  }, [tableCollapsed, data]);

  // Сортировка с мемоизацией
  const sortedData = useMemo(() => {
    if (!orderBy) return displayedData;

    return [...displayedData].map((row, index) => ({
      ...row,
      originalIndex: index
    })).sort((a, b) => {
      const aValue = a.cells[columns.indexOf(orderBy)];
      const bValue = b.cells[columns.indexOf(orderBy)];

      if (!isNaN(Number(aValue)) && !isNaN(Number(bValue))) {
        return order === 'asc'
          ? Number(aValue) - Number(bValue)
          : Number(bValue) - Number(aValue);
      }

      return order === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });
  }, [displayedData, orderBy, order, columns]);

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
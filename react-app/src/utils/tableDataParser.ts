// src/utils/tableDataParser.ts

export function parseTableRowFromLog(log: string): string[] | null {
    const startMarker = "[TABLE_DATA]";
    const endMarker = "[END]";
    console.log(`log: ${log}`);

    // Ищем начало и конец
    const startIdx = log.indexOf(startMarker);
    const endIdx = log.indexOf(endMarker, startIdx + startMarker.length); // Ищем [END] только после [TABLE_DATA]

    // Проверяем, что оба маркера найдены
    if (startIdx === -1 || endIdx === -1) {
        return null;
    }

    // Вырезаем содержимое между маркерами
    const tableData = log.substring(
        startIdx + startMarker.length,
        endIdx
    ).trim();

    if (!tableData) {
        return null;
    }
    console.log(tableData.split("|").map(cell => cell.trim()));
    // Делим по "|" и чистим пробелы
    return tableData.split("|").map(cell => cell.trim());
}
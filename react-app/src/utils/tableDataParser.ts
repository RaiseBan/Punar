export function parseTableRowFromLog(log: string): string[] | null {
    const startMarker = "[TABLE_DATA]";
    const endMarker = "[END]";
    console.log(`log: ${log}`);

    const startIdx = log.indexOf(startMarker);
    const endIdx = log.indexOf(endMarker, startIdx + startMarker.length); 

    if (startIdx === -1 || endIdx === -1) {
        return null;
    }

    const tableData = log.substring(
        startIdx + startMarker.length,
        endIdx
    ).trim();

    if (!tableData) {
        return null;
    }
    console.log(tableData.split("|").map(cell => cell.trim()));

    return tableData.split("|").map(cell => cell.trim());
}
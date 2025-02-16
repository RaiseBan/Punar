// src/utils/tableDataParser.ts

/**
 * Проверяем лог на наличие подстроки [TABLE_DATA].
 * Если есть, парсим всё, что после неё, разделяя по '|'.
 * Возвращаем массив ячеек (string[]).
 * Если подстроки нет, возвращаем null.
 */
export function parseTableRowFromLog(log: string): string[] | null {
    const marker = "[TABLE_DATA]";
    const idx = log.indexOf(marker);
    if (idx === -1) {
        return null;
    }

    // Всё, что после [TABLE_DATA]
    const afterMarker = log.substring(idx + marker.length).trim();
    if (!afterMarker) {
        return null;
    }

    // Делим по "|"
    // Пример: "[TABLE_DATA] NFT #123 | 0.1 SOL | someSeller | someBuyer"
    // → ["NFT #123", "0.1 SOL", "someSeller", "someBuyer"]
    const cells = afterMarker.split("|").map((x) => x.trim());
    return cells;
}

export async function fetchImageUrl(url: string): Promise<string | null> {
    try {
        // Делаем GET-запрос
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Ошибка запроса: ${response.status} ${response.statusText}`);
        }

        // Получаем HTML в виде текста
        const html = await response.text();

        // Используем регулярное выражение для поиска тега <script id="__NEXT_DATA__">
        const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);

        if (!match) {
            throw new Error("Не найден script с id='__NEXT_DATA__'");
        }

        // Парсим JSON
        const jsonData = JSON.parse(match[1]);

        // Получаем ссылку на изображение
        const imageUrl = jsonData.props?.pageProps?.img;

        return imageUrl || null;
    } catch (error) {
        console.error("Ошибка при получении изображения:", error);
        return null;
    }
}
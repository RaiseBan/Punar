export async function fetchImageUrl(url: string): Promise<string | null> {
    try {

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Ошибка запроса: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();

        const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);

        if (!match) {
            throw new Error("Не найден script с id='__NEXT_DATA__'");
        }

        const jsonData = JSON.parse(match[1]);

        const imageUrl = jsonData.props?.pageProps?.img;

        return imageUrl || null;
    } catch (error) {
        console.error("Ошибка при получении изображения:", error);
        return null;
    }
}
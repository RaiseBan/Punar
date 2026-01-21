import { useState, useEffect } from 'react';
import { fetchImageUrl } from '../../../utils/tensorFunctions';

export function useTaskImage(moduleName: string, config: any) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [collectionLabel, setCollectionLabel] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    if (moduleName === 'Tensor sniper (SDK)' && config?.collection_id) {
      // Загружаем изображение
      fetchImageUrl(config.collection_id).then((url) => {
        if (isMounted) {
          setImageUrl(url || '');
        }
      });

      // Формируем label из collection_id
      const parts = config.collection_id.split('/');
      const lastPart = parts[parts.length - 1] || '';
      setCollectionLabel(lastPart.toUpperCase());
    } else {
      setImageUrl('');
      setCollectionLabel('');
    }

    return () => {
      isMounted = false;
    };
  }, [moduleName, config?.collection_id]);

  return {
    imageUrl,
    collectionLabel,
  };
}
import React, { useState, useEffect, useCallback } from 'react';
import {
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  CircularProgress,
  InputLabel,
  FormControl,
  MenuItem,
  Select,
  Box,
  Paper,
  useTheme,
  Slider,
} from '@mui/material';
import { collections } from '../constants';
import { sleep } from '../utils/base';

const MAX_ATTEMPTS = 3;
const TENSOR_GET_INVENTORY_ENDPOINT =
  'https://api.mainnet.tensordev.io/api/v1/user/inventory_by_collection';
const TENSOR_GET_NFT_URL = 'https://api.mainnet.tensordev.io/api/v1/mint/collection';

interface NFTData {
  name: string;
  spent: number;
  profit: number;
  count: number;
  image: string;
}

const Statistic: React.FC = () => {
  // Все состояния и логика остаются без изменений
  const [wallet, setWallet] = useState('');
  const [collection, setCollection] = useState(Array.from(collections.keys())[0]);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<NFTData[]>([]);
  const [loading, setLoading] = useState(false);
  const [tensorKey, setTensorKey] = useState('');
  const theme = useTheme();
  const [cache, setCache] = useState<Record<string, NFTData[]>>({});
  const [isInitialized, setIsInitialized] = useState(false);

  const [scale, setScale] = useState(0.7);

  // Исправленный эффект инициализации
  useEffect(() => {
    const loadPersistedData = async () => {
      // Загрузка параметров из localStorage
      const savedParams = localStorage.getItem('statisticParams');
      if (savedParams) {
        const {
          wallet: sWallet,
          collection: sCollection,
          search: sSearch,
        } = JSON.parse(savedParams);
        setWallet(sWallet);
        setCollection(sCollection);
        setSearch(sSearch);
      }

      // Загрузка кэша
      const savedCache = localStorage.getItem('nftCache');
      if (savedCache) setCache(JSON.parse(savedCache));

      // Загрузка API ключа
      try {
        const settings = await window.electronAPI?.getSettings();
        setTensorKey(settings?.tensor_api_token || '');
      } catch (error) {
        console.error('Error loading settings:', error);
      }

      setIsInitialized(true);
    };
    loadPersistedData();
  }, []);

  // Сохранение параметров при изменении
  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('statisticParams', JSON.stringify({ wallet, collection, search }));
  }, [wallet, collection, search, isInitialized]);

  // Генерация ключа кэша
  const generateCacheKey = useCallback(
    () => `${wallet}:${collection}:${search}`,
    [wallet, collection, search]
  );

  // Автоматическая загрузка из кэша
  useEffect(() => {
    if (!isInitialized) return;
    const cacheKey = generateCacheKey();
    if (cache[cacheKey]) setStats(cache[cacheKey]);
  }, [wallet, collection, search, cache, isInitialized, generateCacheKey]);

  // // Сохранение в кэш при размонтировании
  // useEffect(() => {
  //     return () => {
  //         localStorage.setItem('nftCache', JSON.stringify(cache));
  //     };
  // }, [cache]);

  const totalNFTs = stats.reduce((sum, item) => sum + item.count, 0);
  const totalProfit = stats.reduce((sum, item) => sum + item.profit, 0);
  const totalSpent = stats.reduce((sum, item) => sum + item.spent, 0);

  const getWalletInventory = useCallback(
    async (wallet: string, collId: string) => {
      const params = new URLSearchParams({
        wallet,
        collId,
        limit: '250',
      });

      let attempts = 0;
      while (attempts < MAX_ATTEMPTS) {
        try {
          const response = await fetch(`${TENSOR_GET_INVENTORY_ENDPOINT}?${params}`, {
            headers: {
              'x-tensor-api-key': tensorKey,
              accept: 'application/json',
            },
          });

          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return await response.json();
        } catch (error) {
          if (++attempts >= MAX_ATTEMPTS) throw error;
          await sleep(1000);
        }
      }
    },
    [tensorKey]
  );

  const fetchCurrentPrice = useCallback(
    async (name: string, collId: string) => {
      const params = new URLSearchParams({
        collId,
        sortBy: 'ListingPriceAsc',
        limit: '1',
        onlyListings: 'true',
        name,
      });

      const response = await fetch(`${TENSOR_GET_NFT_URL}?${params}`, {
        headers: {
          'x-tensor-api-key': tensorKey,
          accept: 'application/json',
        },
      });

      if (!response.ok) throw new Error('Price fetch failed');
      const data = await response.json();
      return {
        price: data.mints[0]?.listing?.price || '0',
        imageUri: data.mints[0]?.imageUri || '',
      };
    },
    [tensorKey]
  );

  const fetchInventory = useCallback(async () => {
    if (!collections.has(collection)) return;
    if (!tensorKey) return console.error('Missing Tensor API key');

    setLoading(true);
    try {
      const collId = collections.get(collection)!;
      const inventory = await getWalletInventory(wallet, collId);

      const nameMap = new Map<string, string[]>();
      inventory.mints.forEach((nft: unknown) => {
        if (nft.name.toLowerCase().includes(search.toLowerCase())) {
          nameMap.set(nft.name, [...(nameMap.get(nft.name) || []), nft.lastSale?.price || '0']);
        }
      });

      // Восстановили последовательные запросы с задержкой
      const results: NFTData[] = [];
      for (const [name, prices] of nameMap) {
        const currentPriceData = await fetchCurrentPrice(name, collId);
        await sleep(200); // Важная задержка между запросами

        const spent = prices.reduce((sum, p) => sum + parseInt(p), 0) / 1e9;
        const current = parseInt(currentPriceData.price) / 1e9;

        results.push({
          name,
          spent,
          profit: current * prices.length - spent,
          count: prices.length,
          image: currentPriceData.imageUri,
        });
      }

      const cacheKey = generateCacheKey();
      const newCache = { ...cache, [cacheKey]: results };
      setCache(newCache);
      localStorage.setItem('nftCache', JSON.stringify(newCache));
      setStats(results);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [
    wallet,
    collection,
    search,
    tensorKey,
    cache,
    generateCacheKey,
    getWalletInventory,
    fetchCurrentPrice,
  ]);
  return (
    <Box
      sx={{
        p: 3,
        backgroundColor: theme.palette.background.default,
        minHeight: '100vh',
        color: theme.palette.text.primary,
      }}
    >
      <Paper
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 4,
          backgroundColor: theme.palette.background.paper,
          boxShadow: theme.shadows[5],
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Wallet Address"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: theme.palette.text.primary,
                  '& fieldset': {
                    borderColor: theme.palette.divider,
                  },
                },
              }}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: theme.palette.text.primary }}>Collection</InputLabel>
              <Select
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                sx={{
                  color: theme.palette.text.primary,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.divider,
                  },
                }}
              >
                {Array.from(collections.entries()).map(([name, id]) => (
                  <MenuItem
                    key={id}
                    value={name}
                    sx={{
                      bgcolor: theme.palette.background.paper,
                      '&:hover': { bgcolor: theme.palette.action.hover },
                    }}
                  >
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="Search in Names"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: theme.palette.text.primary,
                  '& fieldset': {
                    borderColor: theme.palette.divider,
                  },
                },
              }}
            />
          </Grid>

          {/* Кнопка SHOW — обновим под более "красивый" стиль */}
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="contained"
              onClick={fetchInventory}
              disabled={loading || !collections.has(collection)}
              sx={{
                height: '56px',
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
                color: '#fff',
                boxShadow: theme.shadows[3],
                '&:hover': {
                  boxShadow: theme.shadows[6],
                  background: 'linear-gradient(45deg, #FF8E53 30%, #FE6B8B 90%)',
                },
              }}
            >
              {loading ? <CircularProgress size={24} /> : 'SHOW'}
            </Button>
          </Grid>

          {/* Ползунок для изменения масштаба карточек */}
          <Grid item xs={12} md={3}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Card Scale
            </Typography>
            <Slider
              min={0.5}
              max={1.5}
              step={0.1}
              value={scale}
              onChange={(_, newValue) => setScale(newValue as number)}
              valueLabelDisplay="auto"
              sx={{
                color: theme.palette.primary.main,
              }}
            />
          </Grid>
        </Grid>

        {/* Общая статистика */}
        <Grid container spacing={2} sx={{ mt: 3 }}>
          {[
            { title: 'Total NFTs', value: totalNFTs, color: 'primary.main' },
            { title: 'Total Spent', value: `◎${totalSpent.toFixed(2)}`, color: 'text.secondary' },
            {
              title: 'Total Profit',
              value: `◎${totalProfit.toFixed(2)}`,
              color: totalProfit >= 0 ? 'success.main' : 'error.main',
            },
          ].map((item, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Paper
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: theme.palette.background.default,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Typography variant="subtitle1" color="text.secondary">
                  {item.title}
                </Typography>
                <Typography variant="h4" sx={{ color: item.color, fontWeight: 700 }}>
                  {item.value}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Карточки NFT с учётом масштаба */}
      <Grid container spacing={3}>
        {stats.map((item, index) => (
          <Grid item key={index}>
            <Card
              sx={{
                width: `${280 * scale}px`,
                transition: 'transform 0.3s, box-shadow 0.3s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[6],
                },
                borderRadius: 4,
                bgcolor: theme.palette.background.paper,
                boxShadow: theme.shadows[3],
              }}
            >
              <CardMedia
                component="img"
                height={200 * scale}
                image={item.image}
                alt={item.name}
                sx={{
                  objectFit: 'cover',
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  filter: 'grayscale(20%) brightness(0.9)',
                }}
              />
              <CardContent sx={{ px: 2.5, pb: '16px !important' }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    mb: 1.5,
                    color: theme.palette.text.primary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.name}
                </Typography>

                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      NFTs:
                    </Typography>
                    <Typography variant="body1" color="primary">
                      {item.count}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Spent:
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      ◎{item.spent.toFixed(2)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Profit:
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{
                        color: item.profit >= 0 ? 'success.main' : 'error.main',
                        fontWeight: 600,
                      }}
                    >
                      ◎{item.profit.toFixed(2)}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Statistic;

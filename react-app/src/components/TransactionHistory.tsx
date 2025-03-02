import React, { useState, useEffect } from 'react';
import {
    Grid,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Button,
    CircularProgress,
    Card,
    CardContent,
    CardMedia,
    Typography,
    Chip,
    Link,
    Alert,
    Box,
    Paper,
    Divider,
    OutlinedInput,
    InputAdornment,
    IconButton,
    Avatar,
    Tooltip,
    Skeleton,
    Container,
    useTheme,
    Slider,
    Stack,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ReceiptIcon from '@mui/icons-material/Receipt';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LayersIcon from '@mui/icons-material/Layers';
import FingerPrintIcon from '@mui/icons-material/Fingerprint';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewComfyIcon from '@mui/icons-material/ViewComfy';
import LinkIcon from '@mui/icons-material/Link';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';

interface Transaction {
    tx: {
        txId: string;
        txType: string;
        grossAmount: string;
        txAt: string;
        blockNumber: number;
        sellerId?: string;
        buyerId?: string;
    };
    mint: {
        name: string;
        imageUri: string;
        onchainId: string;
    };
}

const TX_TYPES = {
    LIST: "LIST",
    DELIST: "DELIST",
    ADJUST_PRICE: "ADJUST_PRICE",
    PLACE_BID: "PLACE_BID",
    CANCEL_BID: "CANCEL_BID",
    SALE_BUY_NOW: "SALE_BUY_NOW",
    SALE_ACCEPT_BID: "SALE_ACCEPT_BID",
} as const;

// Function to get chip color based on transaction type
const getTxTypeColor = (txType: string) => {
    switch (txType) {
        case TX_TYPES.LIST:
            return 'success';
        case TX_TYPES.DELIST:
            return 'error';
        case TX_TYPES.ADJUST_PRICE:
            return 'warning';
        case TX_TYPES.PLACE_BID:
            return 'info';
        case TX_TYPES.CANCEL_BID:
            return 'default';
        case TX_TYPES.SALE_BUY_NOW:
            return 'secondary';
        case TX_TYPES.SALE_ACCEPT_BID:
            return 'primary';
        default:
            return 'default';
    }
};

// View mode constants
const VIEW_MODES = {
    CARDS: 4,    // Full cards (default)
    MEDIUM: 3,   // Medium cards
    COMPACT: 2,  // Compact list with small images
    LIST: 1,     // Minimal list
};

const TxHistorySearch = () => {
    const theme = useTheme();
    const [filters, setFilters] = useState(() => {
        const savedFilters = localStorage.getItem('txHistoryFilters');
        return savedFilters ? JSON.parse(savedFilters) : {
            txCount: 10,
            name: '',
            txTypes: [],
            url: ''
        };
    });
    const [transactions, setTransactions] = useState<Transaction[]>(() => {
        const savedTransactions = localStorage.getItem('txHistoryData');
        return savedTransactions ? JSON.parse(savedTransactions) : [];
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [viewMode, setViewMode] = useState(() => {
        const savedViewMode = localStorage.getItem('txHistoryViewMode');
        return savedViewMode ? Number(savedViewMode) : VIEW_MODES.CARDS;
    });
    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(() => {
        const savedExpanded = localStorage.getItem('txHistoryExpanded');
        return savedExpanded ? JSON.parse(savedExpanded) : {};
    });

    // Сохранение состояний при изменении
    useEffect(() => {
        localStorage.setItem('txHistoryFilters', JSON.stringify(filters));
    }, [filters]);

    useEffect(() => {
        localStorage.setItem('txHistoryViewMode', viewMode.toString());
    }, [viewMode]);

    useEffect(() => {
        localStorage.setItem('txHistoryExpanded', JSON.stringify(expandedItems));
    }, [expandedItems]);

    useEffect(() => {
        localStorage.setItem('txHistoryData', JSON.stringify(transactions));
    }, [transactions]);




    const toggleExpand = (txId: string) => {
        setExpandedItems(prev => ({
            ...prev,
            [txId]: !prev[txId]
        }));
    };

    const fetchTransactions = async () => {
        setLoading(true);
        setError('');
        try {
            console.log(window.electronAPI?.tensorAPI)
            const collId = await window.electronAPI?.tensorAPI.getCollIdByUrl(filters.url);
            if (!collId) throw new Error('Invalid collection URL');

            let collected: Transaction[] = [];
            let cursor: string | null = null;
            let attempts = 0;
            const MAX_ATTEMPTS = 20;

            while (collected.length < filters.txCount && attempts < MAX_ATTEMPTS) {
                const params: any = {
                    collId: collId,
                    limit: 100,
                    txTypes: filters.txTypes,
                    cursor,
                };
                console.log(`params.cursor: ${params.cursor}`)

                const response = await window.electronAPI?.tensorAPI.getTxHistory(params);

                if (!response?.txs) throw new Error('Invalid API response');

                const filtered = response.txs.filter((tx: any) =>
                    tx.mint?.name && (!filters.name || tx.mint.name.toLowerCase().includes(filters.name.toLowerCase()))
                );

                collected = [...collected, ...filtered];
                console.log(JSON.stringify(response, null, 2));
                cursor = response.page?.cursor || null;
                attempts++;

                console.log(`Attempt ${attempts}:`, {
                    fetched: response.txs.length,
                    filtered: filtered.length,
                    total: collected.length,
                    cursor: cursor?.slice(0, 15) + '...'
                });

                if (!response.page?.hasMore || collected.length >= filters.txCount) break;
            }

            setTransactions(collected.slice(0, filters.txCount));
        } catch (err) {
            console.error('Error:', err);
            setError('Error loading data. Please check your parameters and connection.');
        } finally {
            setLoading(false);
        }
    };

    const formatAmount = (lamports: string) => {
        const amount = (Number(lamports) / 1e9).toFixed(2);
        return `${amount} SOL`;
    };

    const formatAddress = (address?: string) =>
        address ? `${address.slice(0, 5)}` : '';

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('en-US', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleViewModeChange = (newValue: number) => {
        setViewMode(newValue);
    };

    const getViewModeIcon = () => {
        switch(viewMode) {
            case VIEW_MODES.CARDS:
                return <ViewModuleIcon />;
            case VIEW_MODES.MEDIUM:
                return <ViewComfyIcon />;
            case VIEW_MODES.COMPACT:
            case VIEW_MODES.LIST:
                return <ViewListIcon />;
            default:
                return <ViewModuleIcon />;
        }
    };

    // Function to render loading skeletons
    const renderSkeletons = () => {
        if (loading && transactions.length === 0) {
            if (viewMode === VIEW_MODES.CARDS || viewMode === VIEW_MODES.MEDIUM) {
                return Array.from({ length: filters.txCount }).map((_, index) => (
                    <Grid item xs={12} sm={viewMode === VIEW_MODES.CARDS ? 6 : 12} md={viewMode === VIEW_MODES.CARDS ? 4 : 6} key={`skeleton-${index}`}>
                        <Card sx={{ height: '100%', boxShadow: 3 }}>
                            <Skeleton variant="rectangular" height={viewMode === VIEW_MODES.CARDS ? 200 : 150} />
                            <CardContent>
                                <Skeleton variant="text" height={40} />
                                <Skeleton variant="rectangular" width={80} height={30} sx={{ my: 1 }} />
                                {Array.from({ length: viewMode === VIEW_MODES.CARDS ? 4 : 2 }).map((_, i) => (
                                    <Skeleton key={i} variant="text" height={30} sx={{ mb: 1 }} />
                                ))}
                            </CardContent>
                        </Card>
                    </Grid>
                ));
            } else {
                return (
                    <Grid item xs={12}>
                        <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
                            {Array.from({ length: filters.txCount }).map((_, index) => (
                                <ListItem key={`skeleton-${index}`} divider>
                                    {viewMode === VIEW_MODES.COMPACT && (
                                        <ListItemAvatar>
                                            <Skeleton variant="circular" width={40} height={40} />
                                        </ListItemAvatar>
                                    )}
                                    <ListItemText
                                        primary={<Skeleton variant="text" width={150} />}
                                        secondary={<Skeleton variant="text" width={250} />}
                                    />
                                    <Skeleton variant="rectangular" width={80} height={30} />
                                </ListItem>
                            ))}
                        </List>
                    </Grid>
                );
            }
        }
        return null;
    };

    // Function to render the empty state
    const renderEmptyState = () => {
        if (transactions.length === 0 && !loading) {
            return (
                <Grid item xs={12}>
                    <Paper sx={{ p: 4, textAlign: 'center' }}>
                        <Typography variant="h6" color="text.secondary">
                            No transactions to display
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Change your search parameters and try again
                        </Typography>
                    </Paper>
                </Grid>
            );
        }
        return null;
    };

    // Full card view mode (original)
    const renderCardView = (tx: Transaction, index: number) => (
        <Grid item xs={12} sm={6} md={4} key={index}>
            <Card sx={{
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 6
                },
                boxShadow: 3,
                borderRadius: 2
            }}>
                <CardMedia
                    component="img"
                    height="220"
                    image={tx.mint.imageUri}
                    alt={tx.mint.name}
                    sx={{ objectFit: 'cover' }}
                />
                <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                        <Typography variant="h6" gutterBottom noWrap sx={{ maxWidth: '70%' }}>
                            {tx.mint.name}
                        </Typography>
                        <Chip
                            label={tx.tx.txType.replace('_', ' ')}
                            color={getTxTypeColor(tx.tx.txType) as any}
                            size="small"
                            sx={{ fontWeight: 'bold' }}
                        />
                    </Box>

                    <Divider sx={{ my: 1.5 }} />

                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <MonetizationOnIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                        <Typography variant="body2">
                            <b>Amount:</b> {formatAmount(tx.tx.grossAmount)}
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <CalendarTodayIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                        <Typography variant="body2">
                            <b>Date:</b> {formatDate(tx.tx.txAt)}
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <LayersIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                        <Typography variant="body2">
                            <b>Block:</b> {tx.tx.blockNumber}
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                        <AccountBalanceWalletIcon fontSize="small" color="primary" sx={{ mr: 1, mt: 0.3 }} />
                        <Typography variant="body2">
                            <b>Participants:</b><br />
                            {tx.tx.sellerId && (
                                <Tooltip title={tx.tx.sellerId}>
                                    <Chip
                                        size="small"
                                        label={formatAddress(tx.tx.sellerId)}
                                        sx={{ mr: 0.5, mt: 0.5 }}
                                    />
                                </Tooltip>
                            )}
                            {tx.tx.buyerId && (
                                <>
                                    {" → "}
                                    <Tooltip title={tx.tx.buyerId}>
                                        <Chip
                                            size="small"
                                            label={formatAddress(tx.tx.buyerId)}
                                            sx={{ mt: 0.5 }}
                                        />
                                    </Tooltip>
                                </>
                            )}
                        </Typography>
                    </Box>

                    <Divider sx={{ my: 1.5 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                        <Link
                            href={`https://solscan.io/tx/${tx.tx.txId}`}
                            target="_blank"
                            rel="noopener"
                            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
                        >
                            <ReceiptIcon fontSize="small" sx={{ mr: 0.5 }} />
                            <Typography variant="caption">
                                {tx.tx.txId.slice(0, 8)}...
                            </Typography>
                            <OpenInNewIcon fontSize="small" sx={{ ml: 0.5, fontSize: 12 }} />
                        </Link>

                        <Tooltip title={tx.mint.onchainId}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <FingerPrintIcon fontSize="small" sx={{ mr: 0.5 }} />
                                <Typography variant="caption">
                                    {tx.mint.onchainId.slice(0, 6)}...
                                </Typography>
                            </Box>
                        </Tooltip>
                    </Box>
                </CardContent>
            </Card>
        </Grid>
    );

    // Medium card view (smaller cards with less info)
    const renderMediumView = (tx: Transaction, index: number) => (
        <Grid item xs={12} sm={12} md={6} key={index}>
            <Card sx={{
                display: 'flex',
                mb: 2,
                borderRadius: 2,
                boxShadow: 2,
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                },
            }}>
                <CardMedia
                    component="img"
                    sx={{ width: 140, height: 140, objectFit: 'cover' }}
                    image={tx.mint.imageUri}
                    alt={tx.mint.name}
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <CardContent sx={{ flex: '1 0 auto', p: 2 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="h6" noWrap sx={{ maxWidth: '60%' }}>
                                {tx.mint.name}
                            </Typography>
                            <Chip
                                label={tx.tx.txType.replace('_', ' ')}
                                color={getTxTypeColor(tx.tx.txType) as any}
                                size="small"
                            />
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                            <MonetizationOnIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                            <Typography variant="body2" sx={{ mr: 3 }}>
                                {formatAmount(tx.tx.grossAmount)}
                            </Typography>

                            <CalendarTodayIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                            <Typography variant="body2" noWrap>
                                {formatDate(tx.tx.txAt)}
                            </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                            <AccountBalanceWalletIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                            <Typography variant="body2" noWrap>
                                {tx.tx.sellerId && formatAddress(tx.tx.sellerId)}
                                {tx.tx.sellerId && tx.tx.buyerId && " → "}
                                {tx.tx.buyerId && formatAddress(tx.tx.buyerId)}
                            </Typography>
                        </Box>
                    </CardContent>
                </Box>
            </Card>
        </Grid>
    );

    // Compact list view (small images with essential info)
    const renderCompactView = (tx: Transaction, index: number) => {
        const isExpanded = expandedItems[tx.tx.txId] || false;

        return (
            <Grid item xs={12} key={index}>
                <Paper sx={{
                    p: 1,
                    mb: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 1,
                    boxShadow: 1,
                    transition: 'all 0.2s',
                    '&:hover': {
                        boxShadow: 3,
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                    }
                }}>
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        width: '100%'
                    }} onClick={() => toggleExpand(tx.tx.txId)}>
                        <Box sx={{ mr: 2, width: 60, height: 60, overflow: 'hidden', borderRadius: 1 }}>
                            <img src={tx.mint.imageUri} alt={tx.mint.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </Box>

                        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="subtitle1" noWrap>
                                    {tx.mint.name}
                                </Typography>
                                <Chip
                                    label={tx.tx.txType.replace('_', ' ')}
                                    color={getTxTypeColor(tx.tx.txType) as any}
                                    size="small"
                                    sx={{ ml: 1 }}
                                />
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                                <MonetizationOnIcon fontSize="small" sx={{ mr: 0.5, fontSize: 16, color: theme.palette.primary.main }} />
                                <Typography variant="body2" sx={{ mr: 2 }}>
                                    {formatAmount(tx.tx.grossAmount)}
                                </Typography>

                                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                                    {tx.tx.sellerId && formatAddress(tx.tx.sellerId)}
                                    {tx.tx.sellerId && tx.tx.buyerId && " → "}
                                    {tx.tx.buyerId && formatAddress(tx.tx.buyerId)}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>

                    {isExpanded && (
                        <Box sx={{
                            pl: 10,
                            pr: 2,
                            pt: 1,
                            pb: 1,
                            mt: 1,
                            borderTop: 1,
                            borderColor: 'divider',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <CalendarTodayIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                                <Typography variant="body2">
                                    <b>Date:</b> {formatDate(tx.tx.txAt)}
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <LayersIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                                <Typography variant="body2">
                                    <b>Block:</b> {tx.tx.blockNumber}
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                <Link
                                    href={`https://solscan.io/tx/${tx.tx.txId}`}
                                    target="_blank"
                                    rel="noopener"
                                    sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ReceiptIcon fontSize="small" sx={{ mr: 0.5 }} />
                                    <Typography variant="caption">
                                        {tx.tx.txId.slice(0, 8)}...
                                    </Typography>
                                    <OpenInNewIcon fontSize="small" sx={{ ml: 0.5, fontSize: 12 }} />
                                </Link>

                                <Tooltip title={tx.mint.onchainId}>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <FingerPrintIcon fontSize="small" sx={{ mr: 0.5 }} />
                                        <Typography variant="caption">
                                            {tx.mint.onchainId.slice(0, 6)}...
                                        </Typography>
                                    </Box>
                                </Tooltip>
                            </Box>
                        </Box>
                    )}
                </Paper>
            </Grid>
        );
    };

    // Minimal list view (just text, like in your screenshots)
    const renderListView = (tx: Transaction, index: number) => {
        const isExpanded = expandedItems[tx.tx.txId] || false;

        return (
            <Grid item xs={12} key={index}>
                <Paper sx={{
                    py: 0.75,
                    px: 2,
                    mb: 0.5,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 1,
                    boxShadow: 0,
                    bgcolor: index % 2 === 0 ?
                        (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') :
                        'transparent',
                    transition: 'all 0.2s',
                    '&:hover': {
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)'
                    }
                }}>
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        width: '100%'
                    }} onClick={() => toggleExpand(tx.tx.txId)}>
                        <Box sx={{ display: 'flex', alignItems: 'center', overflow: 'hidden', flexGrow: 1 }}>
                            <Typography variant="body2" noWrap sx={{ maxWidth: '30%', minWidth: 150 }}>
                                {tx.mint.name}
                            </Typography>

                            <Box sx={{ display: 'flex', alignItems: 'center', px: 2, minWidth: 100 }}>
                                <Chip
                                    label={tx.tx.txType}
                                    color={getTxTypeColor(tx.tx.txType) as any}
                                    size="small"
                                    sx={{ height: 24, fontSize: '0.7rem' }}
                                />
                            </Box>

                            <Typography variant="body2" sx={{ minWidth: 80 }}>
                                {formatAmount(tx.tx.grossAmount)}
                            </Typography>
                        </Box>

                        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                            {tx.tx.sellerId && formatAddress(tx.tx.sellerId)}
                            {tx.tx.sellerId && tx.tx.buyerId && " → "}
                            {tx.tx.buyerId && formatAddress(tx.tx.buyerId)}
                        </Typography>
                    </Box>

                    {isExpanded && (
                        <Box sx={{
                            pl: 4,
                            pr: 2,
                            pt: 1,
                            pb: 1,
                            mt: 1,
                            borderTop: 1,
                            borderColor: 'divider',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 2
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <CalendarTodayIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                                <Typography variant="body2">
                                    {formatDate(tx.tx.txAt)}
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <LayersIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                                <Typography variant="body2">
                                    Block: {tx.tx.blockNumber}
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Link
                                    href={`https://solscan.io/tx/${tx.tx.txId}`}
                                    target="_blank"
                                    rel="noopener"
                                    sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ReceiptIcon fontSize="small" sx={{ mr: 0.5 }} />
                                    <Typography variant="caption">
                                        TX: {tx.tx.txId.slice(0, 8)}...
                                    </Typography>
                                    <OpenInNewIcon fontSize="small" sx={{ ml: 0.5, fontSize: 12 }} />
                                </Link>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gridColumn: '1 / -1' }}>
                                <FingerPrintIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                                <Typography variant="caption">
                                    NFT ID: {tx.mint.onchainId}
                                </Typography>
                            </Box>
                        </Box>
                    )}
                </Paper>
            </Grid>
        );
    };

    // Function to render transactions according to view mode
    const renderTransactions = () => {
        if (loading && transactions.length === 0) {
            return renderSkeletons();
        }

        if (transactions.length === 0 && !loading) {
            return renderEmptyState();
        }

        return transactions.map((tx, index) => {
            switch (viewMode) {
                case VIEW_MODES.CARDS:
                    return renderCardView(tx, index);
                case VIEW_MODES.MEDIUM:
                    return renderMediumView(tx, index);
                case VIEW_MODES.COMPACT:
                    return renderCompactView(tx, index);
                case VIEW_MODES.LIST:
                    return renderListView(tx, index);
                default:
                    return renderCardView(tx, index);
            }
        });
    };

    return (
        <Container maxWidth="xl">
            <Paper
                elevation={3}
                sx={{
                    p: 3,
                    mb: 4,
                    borderRadius: 2,
                    background: theme.palette.mode === 'dark'
                        ? 'linear-gradient(145deg, rgba(38,50,56,0.7) 0%, rgba(55,71,79,0.4) 100%)'
                        : 'linear-gradient(145deg, rgba(236,239,241,0.7) 0%, rgba(255,255,255,0.9) 100%)',
                }}
            >
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        NFT Transaction History
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', width: 300 }}>
                        <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                            <ViewListIcon sx={{ color: viewMode <= VIEW_MODES.COMPACT ? 'primary.main' : 'text.secondary' }} />
                        </Box>
                        <Slider
                            value={viewMode}
                            onChange={(_, newValue) => handleViewModeChange(newValue as number)}
                            step={1}
                            marks
                            min={1}
                            max={4}
                            sx={{ mx: 2 }}
                        />
                        <Box sx={{ ml: 2, display: 'flex', alignItems: 'center' }}>
                            <ViewModuleIcon sx={{ color: viewMode >= VIEW_MODES.MEDIUM ? 'primary.main' : 'text.secondary' }} />
                        </Box>
                    </Box>
                </Box>

                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={6}>
                        <FormControl fullWidth variant="outlined">
                            <InputLabel htmlFor="collection-url">Collection URL</InputLabel>
                            <OutlinedInput
                                id="collection-url"
                                value={filters.url}
                                onChange={(e) => setFilters({ ...filters, url: e.target.value })}
                                label="Collection URL"
                                startAdornment={
                                    <InputAdornment position="start">
                                        <LinkIcon />
                                    </InputAdornment>
                                }
                            />
                        </FormControl>
                    </Grid>


                    <Grid item xs={12} md={6}>
                        <FormControl fullWidth variant="outlined">
                            <InputLabel htmlFor="name-search">Search by NFT name</InputLabel>
                            <OutlinedInput
                                id="name-search"
                                value={filters.name}
                                onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                                startAdornment={
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                }
                                label="Search by NFT name"
                            />
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={6} md={2}>
                        <TextField
                            fullWidth
                            label="Count"
                            type="number"
                            value={filters.txCount}
                            onChange={(e) =>
                                setFilters({ ...filters, txCount: Math.min(500, Math.max(1, +e.target.value)) })
                            }
                            inputProps={{ min: 1, max: 500 }}
                            variant="outlined"
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={2}>
                        <Button
                            fullWidth
                            variant="contained"
                            color="secondary"
                            onClick={() => setShowFilters(!showFilters)}
                            startIcon={<FilterListIcon />}
                            sx={{
                                height: 56,
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 'bold',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    transform: 'translateY(-2px)',
                                    boxShadow: '0 6px 15px rgba(0,0,0,0.2)',
                                }
                            }}
                        >
                            {showFilters ? 'Hide Filters' : 'Show Filters'}
                        </Button>
                    </Grid>

                    <Grid item xs={12} sm={6} md={2}>
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={fetchTransactions}
                            disabled={loading}
                            sx={{
                                height: 56,
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 'bold',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                                background: theme.palette.mode === 'dark'
                                    ? 'linear-gradient(45deg, #3f51b5 30%, #5667cf 90%)'
                                    : 'linear-gradient(45deg, #3f51b5 30%, #5667cf 90%)',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    transform: 'translateY(-2px)',
                                    boxShadow: '0 6px 15px rgba(0,0,0,0.2)',
                                    background: theme.palette.mode === 'dark'
                                        ? 'linear-gradient(45deg, #4c5fc5 30%, #6576df 90%)'
                                        : 'linear-gradient(45deg, #4c5fc5 30%, #6576df 90%)',
                                }
                            }}
                        >
                            {loading ? <CircularProgress size={24} color="inherit" /> : 'Search'}
                        </Button>
                    </Grid>

                    {showFilters && (
                        <Grid item xs={12}>
                            <Paper
                                variant="outlined"
                                sx={{
                                    p: 2,
                                    mt: 1,
                                    borderRadius: 2,
                                    background: theme.palette.mode === 'dark'
                                        ? 'rgba(38,50,56,0.4)'
                                        : 'rgba(236,239,241,0.6)',
                                }}
                            >
                                <Typography variant="subtitle1" gutterBottom>
                                    Additional Filters
                                </Typography>
                                <FormControl fullWidth variant="outlined">
                                    <InputLabel>Transaction Types</InputLabel>
                                    <Select
                                        multiple
                                        value={filters.txTypes}
                                        onChange={(e) =>
                                            setFilters({ ...filters, txTypes: e.target.value as string[] })
                                        }
                                        input={<OutlinedInput label="Transaction Types" />}
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {(selected as string[]).map((value) => (
                                                    <Chip
                                                        key={value}
                                                        label={value.replace('_', ' ')}
                                                        size="small"
                                                        color={getTxTypeColor(value) as any}
                                                    />
                                                ))}
                                            </Box>
                                        )}
                                    >
                                        {Object.entries(TX_TYPES).map(([key, value]) => (
                                            <MenuItem key={value} value={value}>
                                                <Chip
                                                    label={key}
                                                    size="small"
                                                    color={getTxTypeColor(value) as any}
                                                    sx={{ mr: 1 }}
                                                />
                                                {value.replace('_', ' ')}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Paper>
                        </Grid>
                    )}
                </Grid>

                {error && (
                    <Alert
                        severity="error"
                        sx={{ mt: 2, borderRadius: 2 }}  // Added borderRadius here
                        onClose={() => setError('')}
                    >
                        {error}
                    </Alert>
                )}
            </Paper>

            <Grid container spacing={3}>
                {renderTransactions()}
            </Grid>

            {loading && transactions.length > 0 && (
                <Box display="flex" justifyContent="center" mt={4}>
                    <CircularProgress />
                </Box>
            )}
        </Container>
    );
};

export default TxHistorySearch;
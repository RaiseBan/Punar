import React, { Component, ReactNode } from 'react';
import { Box, Button, Typography, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ [ErrorBoundary] Caught error:', error);
    console.error('Component stack:', errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
          sx={{ bgcolor: '#0e0e0e' }}
        >
          <Paper 
            elevation={3} 
            sx={{ 
              p: 4, 
              maxWidth: 500,
              bgcolor: '#1c1c1c',
              border: '1px solid #333'
            }}
          >
            <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
              <ErrorOutlineIcon color="error" sx={{ fontSize: 64 }} />
              <Typography variant="h5" gutterBottom color="#fff">
                Что-то пошло не так
              </Typography>
              <Typography variant="body2" color="#fff" align="center">
                {this.state.error?.message || 'Произошла неожиданная ошибка'}
              </Typography>
              <Button variant="contained" onClick={this.handleReset}>
                Перезагрузить
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
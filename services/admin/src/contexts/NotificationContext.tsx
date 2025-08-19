import React, { createContext, useContext, ReactNode } from 'react';
import { useToast } from '@chakra-ui/react';

interface NotificationContextType {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const toast = useToast();

  const showSuccess = (message: string) => {
    toast({
      title: 'Success',
      description: message,
      status: 'success',
      duration: 5000,
      isClosable: true,
    });
  };

  const showError = (message: string) => {
    toast({
      title: 'Error',
      description: message,
      status: 'error',
      duration: 7000,
      isClosable: true,
    });
  };

  const showWarning = (message: string) => {
    toast({
      title: 'Warning',
      description: message,
      status: 'warning',
      duration: 6000,
      isClosable: true,
    });
  };

  const showInfo = (message: string) => {
    toast({
      title: 'Info',
      description: message,
      status: 'info',
      duration: 5000,
      isClosable: true,
    });
  };

  const value = {
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
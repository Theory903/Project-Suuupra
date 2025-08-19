import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, Spinner, Center } from '@chakra-ui/react';
import { useAuth } from './contexts/AuthContext';

// Placeholder components - should be implemented
const Dashboard = () => <Box p={8}>Admin Dashboard</Box>;
const Login = () => <Box p={8}>Login Page</Box>;

const App: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" color="brand.500" />
      </Center>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Box minH="100vh">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Add more routes as needed */}
      </Routes>
    </Box>
  );
};

export default App;
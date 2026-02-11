import { ActivityIndicator, View } from 'react-native';
import RootNavigator from './navigation/RootNavigator';
import { AuthProvider, useAuth } from './context/auth';
import { ThemeProvider } from './context/theme';

function AppContent() {
  const { loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <RootNavigator />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

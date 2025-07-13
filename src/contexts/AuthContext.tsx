import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { User, AuthState, LoginCredentials, RegisterCredentials, ForgotPasswordData } from '../types/auth';
import { authAPI } from '../services/api';

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'REGISTER_START' }
  | { type: 'REGISTER_SUCCESS'; payload: User }
  | { type: 'REGISTER_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_LOADING'; payload: boolean };

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
    case 'REGISTER_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'LOGIN_SUCCESS':
    case 'REGISTER_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'LOGIN_FAILURE':
    case 'REGISTER_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        error: null,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    default:
      return state;
  }
};

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (data: ForgotPasswordData) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const checkAuth = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const user = await authAPI.getCurrentUser();
        if (user) {
          dispatch({ type: 'LOGIN_SUCCESS', payload: user });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const user = await authAPI.login(credentials);
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
    } catch (error) {
      dispatch({ type: 'LOGIN_FAILURE', payload: (error as Error).message });
      throw error;
    }
  };

  const register = async (data: RegisterCredentials) => {
    dispatch({ type: 'REGISTER_START' });
    try {
      const user = await authAPI.register(data);
      dispatch({ type: 'REGISTER_SUCCESS', payload: user });
    } catch (error) {
      dispatch({ type: 'REGISTER_FAILURE', payload: (error as Error).message });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
      dispatch({ type: 'LOGOUT' });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const forgotPassword = async (data: ForgotPasswordData) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await authAPI.forgotPassword(data);
    } catch (error) {
      dispatch({ type: 'LOGIN_FAILURE', payload: (error as Error).message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    forgotPassword,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

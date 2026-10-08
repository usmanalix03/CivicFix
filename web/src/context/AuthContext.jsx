import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Check local storage on initial load
    useEffect(() => {
        const storedUser = localStorage.getItem('civic_user');
        const storedToken = localStorage.getItem('civic_token');

        if (storedUser && storedToken) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                localStorage.removeItem('civic_user');
                localStorage.removeItem('civic_token');
            }
        }
        setIsInitialized(true);
    }, []);

    const login = (userData, token) => {
        localStorage.setItem('civic_user', JSON.stringify(userData));
        localStorage.setItem('civic_token', token);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('civic_user');
        localStorage.removeItem('civic_token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isInitialized }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
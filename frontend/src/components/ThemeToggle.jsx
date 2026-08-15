// frontend/src/components/ThemeToggle.jsx
import { useTheme } from '../context/ThemeContext';
import styles from './ThemeToggle.module.css';

/****
 * ThemeToggle Component for SuperBrowser
 * Displays a button to toggle between dark and light modes
 * Uses emoji icons (🌙 for dark, ☀️ for light)
 ***/
export function ThemeToggle() {
  const { toggleTheme, isDark } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={styles.toggleButton}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      type="button"
    >
      {isDark ? '☀️' : '🌙'} 

      
    </button>
  );
}

export default ThemeToggle;

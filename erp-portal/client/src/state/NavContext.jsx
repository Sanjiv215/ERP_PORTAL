import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const NavContext = createContext({
  isMobileNavOpen: false,
  openMobileNav: () => {},
  closeMobileNav: () => {},
  toggleMobileNav: () => {}
});

export function NavProvider({ children }) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();

  // Auto-close mobile drawer whenever user navigates to a new page
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileNavOpen]);

  const openMobileNav = () => setIsMobileNavOpen(true);
  const closeMobileNav = () => setIsMobileNavOpen(false);
  const toggleMobileNav = () => setIsMobileNavOpen((prev) => !prev);

  return (
    <NavContext.Provider
      value={{
        isMobileNavOpen,
        openMobileNav,
        closeMobileNav,
        toggleMobileNav
      }}
    >
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  return useContext(NavContext);
}

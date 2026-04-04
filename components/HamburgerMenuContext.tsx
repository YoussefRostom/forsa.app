import React, { createContext, ReactNode, useContext, useState } from 'react';

interface HamburgerMenuContextType {
  visible: boolean;
  openMenu: () => void;
  closeMenu: () => void;
}

const HamburgerMenuContext = createContext<HamburgerMenuContextType | undefined>(undefined);

export const useHamburgerMenu = () => {
  const context = useContext(HamburgerMenuContext);
  if (!context) {
    throw new Error('useHamburgerMenu must be used within a HamburgerMenuProvider');
  }
  return context;
};

export const HamburgerMenuProvider = ({ children }: { children: ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  return (
    <HamburgerMenuContext.Provider value={{ visible, openMenu, closeMenu }}>
      {children}
    </HamburgerMenuContext.Provider>
  );
};

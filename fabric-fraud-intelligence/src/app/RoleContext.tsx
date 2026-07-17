import { createContext, useContext, useState, type ReactNode } from 'react';

import type { Role } from '@/backend/models';

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
  user: string;
}

const RoleContext = createContext<RoleContextValue>({
  role: 'Analyst',
  setRole: () => {},
  user: 'demo',
});

export function RoleProvider({ user, children }: { user: string; children: ReactNode }) {
  const [role, setRole] = useState<Role>('Analyst');
  return (
    <RoleContext.Provider value={{ role, setRole, user }}>
      {children}
    </RoleContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRole(): RoleContextValue {
  return useContext(RoleContext);
}

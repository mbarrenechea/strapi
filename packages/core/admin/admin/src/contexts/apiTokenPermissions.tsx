/* eslint-disable check-file/filename-naming-convention */

import * as React from 'react';

import { createContext } from '@radix-ui/react-context';

export interface PseudoEvent {
  target: { value: string };
}

export interface ApiTokenPermission {
  apiId?: string;
  label?: string;
  controllers?: { controller: string; actions: { actionId: string; action: string } }[];
}

interface ApiTokenPermissionsContextValue {
  value: {
    selectedAction: string | null;
    routes: Record<
      string,
      {
        config: {
          auth: {
            scope: string[];
          };
        };
        handler: string;
        info: {
          apiName: string;
          type: string;
        };
        method: 'GET' | 'POST' | 'PUT' | 'DELETE';
        path: string;
      }[]
    >;
    selectedActions: string[];
    data: {
      allActionsIds: string[];
      permissions: ApiTokenPermission[];
    };
    onChange: ({ target: { value } }: PseudoEvent) => void;
    onChangeSelectAll: ({
      target: { value },
    }: PseudoEvent | { target: { value: { action: string; actionId: string }[] } }) => void;
    setSelectedAction: ({ target: { value } }: PseudoEvent) => void;
  };
}

interface ApiTokenPermissionsContextProviderProps extends ApiTokenPermissionsContextValue {
  children: React.ReactNode | React.ReactNode[];
}

const [ApiTokenPermissionsContextProvider, useApiTokenPermissionsContext] =
  createContext<ApiTokenPermissionsContextValue>('ApiTokenPermissionsContext');

const ApiTokenPermissionsProvider = ({
  children,
  ...rest
}: ApiTokenPermissionsContextProviderProps) => {
  return (
    <ApiTokenPermissionsContextProvider {...rest}>{children}</ApiTokenPermissionsContextProvider>
  );
};

const useApiTokenPermissions = () => useApiTokenPermissionsContext('useApiTokenPermissions');

export { ApiTokenPermissionsProvider, useApiTokenPermissions };
export type { ApiTokenPermissionsContextValue, ApiTokenPermissionsContextProviderProps };

import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  useContext,
  useMemo,
  useReducer,
} from 'react';
import type { QueryLogItem, SessionState } from '@/app/session/types';
import {
  defaultSql,
  mockObjects,
  mockTables,
} from '@/features/mock/mock-schema';

type SessionAction =
  | { type: 'SET_EXPLORER_SEARCH'; payload: string }
  | { type: 'SELECT_OBJECT'; payload: string }
  | { type: 'SET_QUERY_TEXT'; payload: string }
  | { type: 'RUN_QUERY'; payload: QueryLogItem }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_PAGE_SIZE'; payload: number }
  | { type: 'SELECT_ROW'; payload: number | null }
  | { type: 'TOGGLE_EXPLORER_PANEL' }
  | { type: 'TOGGLE_SQL_CONSOLE_PANEL' };

const initialState: SessionState = {
  databaseName: 'fipe_vehicles-marco-2026.db',
  sqliteVersion: '3.46.1',
  openStatus: 'ready',
  objects: mockObjects,
  activeObject: 'vehicles',
  explorerSearch: '',
  queryText: defaultSql,
  queryLog: [],
  page: 0,
  pageSize: 300,
  selectedRowIndex: null,
  isExplorerVisible: true,
  isSqlConsoleVisible: true,
};

function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case 'SET_EXPLORER_SEARCH':
      return { ...state, explorerSearch: action.payload };
    case 'SELECT_OBJECT':
      return {
        ...state,
        activeObject: action.payload,
        selectedRowIndex: null,
        page: 0,
      };
    case 'SET_QUERY_TEXT':
      return { ...state, queryText: action.payload };
    case 'RUN_QUERY':
      return {
        ...state,
        queryLog: [action.payload, ...state.queryLog].slice(0, 40),
      };
    case 'SET_PAGE':
      return {
        ...state,
        page: Math.max(action.payload, 0),
        selectedRowIndex: null,
      };
    case 'SET_PAGE_SIZE':
      return {
        ...state,
        page: 0,
        pageSize: action.payload,
        selectedRowIndex: null,
      };
    case 'SELECT_ROW':
      return { ...state, selectedRowIndex: action.payload };
    case 'TOGGLE_EXPLORER_PANEL':
      return { ...state, isExplorerVisible: !state.isExplorerVisible };
    case 'TOGGLE_SQL_CONSOLE_PANEL':
      return { ...state, isSqlConsoleVisible: !state.isSqlConsoleVisible };
    default:
      return state;
  }
}

interface SessionContextValue {
  state: SessionState;
  dispatch: Dispatch<SessionAction>;
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used inside SessionProvider');
  }

  return context;
}

export function useActiveTableData() {
  const {
    state: { activeObject },
  } = useSession();

  if (!activeObject) {
    return null;
  }

  return mockTables[activeObject] ?? null;
}

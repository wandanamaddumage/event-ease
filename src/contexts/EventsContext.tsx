import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { Event, EventsState, CreateEventData, EventFilters } from '../types/events';
import { eventsAPI } from '../services/api';

type EventsAction =
  | { type: 'FETCH_EVENTS_START' }
  | { type: 'FETCH_EVENTS_SUCCESS'; payload: Event[] }
  | { type: 'FETCH_EVENTS_FAILURE'; payload: string }
  | { type: 'FETCH_MY_EVENTS_SUCCESS'; payload: Event[] }
  | { type: 'SET_CURRENT_EVENT'; payload: Event | null }
  | { type: 'CREATE_EVENT_SUCCESS'; payload: Event }
  | { type: 'UPDATE_EVENT_SUCCESS'; payload: Event }
  | { type: 'DELETE_EVENT_SUCCESS'; payload: string }
  | { type: 'SET_FILTERS'; payload: EventFilters }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_LOADING'; payload: boolean };

const initialState: EventsState = {
  events: [],
  myEvents: [],
  currentEvent: null,
  isLoading: false,
  error: null,
  filters: {},
};

const eventsReducer = (state: EventsState, action: EventsAction): EventsState => {
  switch (action.type) {
    case 'FETCH_EVENTS_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'FETCH_EVENTS_SUCCESS':
      return {
        ...state,
        events: action.payload,
        isLoading: false,
        error: null,
      };
    case 'FETCH_EVENTS_FAILURE':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    case 'FETCH_MY_EVENTS_SUCCESS':
      return {
        ...state,
        myEvents: action.payload,
      };
    case 'SET_CURRENT_EVENT':
      return {
        ...state,
        currentEvent: action.payload,
      };
    case 'CREATE_EVENT_SUCCESS':
      return {
        ...state,
        events: [...state.events, action.payload],
        myEvents: [...state.myEvents, action.payload],
      };
    case 'UPDATE_EVENT_SUCCESS':
      return {
        ...state,
        events: state.events.map(event =>
          event.id === action.payload.id ? action.payload : event
        ),
        myEvents: state.myEvents.map(event =>
          event.id === action.payload.id ? action.payload : event
        ),
        currentEvent: state.currentEvent?.id === action.payload.id ? action.payload : state.currentEvent,
      };
    case 'DELETE_EVENT_SUCCESS':
      return {
        ...state,
        events: state.events.filter(event => event.id !== action.payload),
        myEvents: state.myEvents.filter(event => event.id !== action.payload),
        currentEvent: state.currentEvent?.id === action.payload ? null : state.currentEvent,
      };
    case 'SET_FILTERS':
      return {
        ...state,
        filters: action.payload,
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

interface EventsContextType extends EventsState {
  fetchEvents: (filters?: EventFilters) => Promise<void>;
  fetchMyEvents: () => Promise<void>;
  fetchEvent: (id: string) => Promise<void>;
  createEvent: (data: CreateEventData) => Promise<Event>;
  updateEvent: (id: string, data: Partial<CreateEventData>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  joinEvent: (eventId: string) => Promise<void>;
  leaveEvent: (eventId: string) => Promise<void>;
  setFilters: (filters: EventFilters) => void;
  clearError: () => void;
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

export const useEvents = () => {
  const context = useContext(EventsContext);
  if (context === undefined) {
    throw new Error('useEvents must be used within an EventsProvider');
  }
  return context;
};

interface EventsProviderProps {
  children: ReactNode;
}

export const EventsProvider: React.FC<EventsProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(eventsReducer, initialState);

  const fetchEvents = async (filters?: EventFilters) => {
    dispatch({ type: 'FETCH_EVENTS_START' });
    try {
      const events = await eventsAPI.getEvents(filters);
      dispatch({ type: 'FETCH_EVENTS_SUCCESS', payload: events });
    } catch (error) {
      dispatch({ type: 'FETCH_EVENTS_FAILURE', payload: (error as Error).message });
    }
  };

  const fetchMyEvents = async () => {
    try {
      const events = await eventsAPI.getMyEvents();
      dispatch({ type: 'FETCH_MY_EVENTS_SUCCESS', payload: events });
    } catch (error) {
      console.error('Failed to fetch my events:', error);
    }
  };

  const fetchEvent = async (id: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const event = await eventsAPI.getEvent(id);
      dispatch({ type: 'SET_CURRENT_EVENT', payload: event });
    } catch (error) {
      dispatch({ type: 'FETCH_EVENTS_FAILURE', payload: (error as Error).message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const createEvent = async (data: CreateEventData): Promise<Event> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const event = await eventsAPI.createEvent(data);
      dispatch({ type: 'CREATE_EVENT_SUCCESS', payload: event });
      return event;
    } catch (error) {
      dispatch({ type: 'FETCH_EVENTS_FAILURE', payload: (error as Error).message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const updateEvent = async (id: string, data: Partial<CreateEventData>) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const event = await eventsAPI.updateEvent(id, data);
      dispatch({ type: 'UPDATE_EVENT_SUCCESS', payload: event });
    } catch (error) {
      dispatch({ type: 'FETCH_EVENTS_FAILURE', payload: (error as Error).message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      await eventsAPI.deleteEvent(id);
      dispatch({ type: 'DELETE_EVENT_SUCCESS', payload: id });
    } catch (error) {
      dispatch({ type: 'FETCH_EVENTS_FAILURE', payload: (error as Error).message });
      throw error;
    }
  };

  const joinEvent = async (eventId: string) => {
    try {
      await eventsAPI.joinEvent(eventId);
      // Refresh current event to update attendees
      const updatedEvent = await eventsAPI.getEvent(eventId);
      if (updatedEvent) {
        dispatch({ type: 'SET_CURRENT_EVENT', payload: updatedEvent });
      }
    } catch (error) {
      dispatch({ type: 'FETCH_EVENTS_FAILURE', payload: (error as Error).message });
      throw error;
    }
  };

  const leaveEvent = async (eventId: string) => {
    try {
      await eventsAPI.leaveEvent(eventId);
      // Refresh current event to update attendees
      const updatedEvent = await eventsAPI.getEvent(eventId);
      if (updatedEvent) {
        dispatch({ type: 'SET_CURRENT_EVENT', payload: updatedEvent });
      }
    } catch (error) {
      dispatch({ type: 'FETCH_EVENTS_FAILURE', payload: (error as Error).message });
      throw error;
    }
  };

  const setFilters = (filters: EventFilters) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value: EventsContextType = {
    ...state,
    fetchEvents,
    fetchMyEvents,
    fetchEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    joinEvent,
    leaveEvent,
    setFilters,
    clearError,
  };

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
};

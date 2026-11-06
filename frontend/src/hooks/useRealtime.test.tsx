import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loggedIn, loggedOut } from '../store/authSlice';
import { renderWithProviders } from '../test/render';
import type { LiveEvent } from '../types/realtime';
import { ORDERS_KEY } from './queryKeys';
import { useRealtime } from './useRealtime';

// jsdom no conecta de verdad: el test abre, manda mensajes y corta a mano
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  close = vi.fn();
  url: string;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  open() {
    act(() => this.onopen?.());
  }
  receive(event: LiveEvent) {
    act(() => this.onmessage?.({ data: JSON.stringify(event) }));
  }
  drop() {
    act(() => this.onclose?.());
  }
}

const lastSocket = () => FakeWebSocket.instances.at(-1)!;

function Probe() {
  return <span>{useRealtime()}</span>;
}

function renderLoggedIn() {
  const view = renderWithProviders(<Probe />);
  act(() => {
    view.store.dispatch(
      loggedIn({ token: 'tok', user: { id: 1, email: 'a@a.es', name: 'Admin', role: 'ADMIN' } }),
    );
  });
  const invalidate = vi.spyOn(view.queryClient, 'invalidateQueries');
  return { ...view, invalidate };
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useRealtime', () => {
  it('no conecta sin sesión', () => {
    renderWithProviders(<Probe />);
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('conecta con el token e invalida las órdenes al llegar un evento', () => {
    const { invalidate } = renderLoggedIn();
    expect(lastSocket().url).toBe('ws://localhost:3001/api/realtime?token=tok');

    lastSocket().open();
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(invalidate).not.toHaveBeenCalled();

    lastSocket().receive({ type: 'worklog.closed', orderId: 5, stopReason: 'BREAK' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ORDERS_KEY });
  });

  it('reconecta tras un corte y refresca lo que se haya perdido', () => {
    vi.useFakeTimers();
    const { invalidate } = renderLoggedIn();
    lastSocket().open();

    lastSocket().drop();
    expect(screen.getByText('reconnecting')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1_000));
    expect(FakeWebSocket.instances).toHaveLength(2);

    lastSocket().open();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ORDERS_KEY });
  });

  it('cierra el socket al cerrar sesión y no reconecta', () => {
    vi.useFakeTimers();
    const { store } = renderLoggedIn();
    const socket = lastSocket();
    socket.open();

    act(() => {
      store.dispatch(loggedOut());
    });
    expect(socket.close).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(60_000));
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});

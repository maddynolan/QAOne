import { create } from 'zustand'
import api from '../lib/api'

interface CartState {
  cartCount: number
  loading: boolean
  loadCartCount: () => Promise<void>
  incrementCart: () => void
  decrementCart: () => void
  resetCart: () => void
}

export const useCartStore = create<CartState>((set) => ({
  cartCount: 0,
  loading: false,
  loadCartCount: async () => {
    set({ loading: true })
    try {
      const response = await api.get('/api/cart')
      set({ cartCount: response.data.length, loading: false })
    } catch (error) {
      // If not authenticated, cart count is 0
      set({ cartCount: 0, loading: false })
    }
  },
  incrementCart: () => set((state) => ({ cartCount: state.cartCount + 1 })),
  decrementCart: () => set((state) => ({ cartCount: Math.max(0, state.cartCount - 1) })),
  resetCart: () => set({ cartCount: 0 }),
}))


